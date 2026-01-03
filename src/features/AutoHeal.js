import { gameManager, settings, inputState } from '@/core/state.js';
import { translations } from '@/core/obfuscatedNameTranslator.js';
import { isGameReady, inputCommands, findTeam } from '@/utils/constants.js';
import { autoFireEnabled } from '@/features/AutoFire.js';

let initialized = false;
let lastHealTime = 0;
const HEAL_COOLDOWN = 100;

let healthProp = null;
let boostProp = null;
let inventoryProp = null;

function resolveProps(localData) {
  if (!localData) return;

  // 1. Resolve Health
  if (!healthProp) {
    const candidates = [];
    for (const k in localData) {
      const v = localData[k];
      if (typeof v === 'number' && v > 5 && v <= 100) candidates.push({ k, v });
    }

    if (candidates.length === 1) {
      healthProp = candidates[0].k;
    } else if (candidates.length > 1) {
      const full = candidates.find(c => Math.abs(c.v - 100) < 0.1);
      if (full) {
        healthProp = full.k;
      } else {
        candidates.sort((a, b) => b.v - a.v);
        healthProp = candidates[0].k;
      }
    }
  }

  // 2. Resolve Boost
  // Boost is a number 0-100, distinct from health, curWeapIdx, and zoom.
  if (!boostProp && healthProp) {
    const candidates = [];
    const ignored = [healthProp, translations.curWeapIdx_, translations.zoom_];

    for (const k in localData) {
      if (ignored.includes(k)) continue;
      const v = localData[k];
      if (typeof v === 'number' && v >= 0 && v <= 100) {
        candidates.push(k);
      }
    }

    // If we find candidates, try to find one that is "boost-like"
    // Often boost is 0 initially.
    // If we have multiple, we might guess.
    // For now, let's take the first reasonable candidate.
    if (candidates.length > 0) {
      // If there's only one remaining number, it's likely boost.
      if (candidates.length === 1) {
        boostProp = candidates[0];
      } else {
        // If multiple, maybe we can assume boost <= 100
        // It's hard to distinguish without value change, but let's try.
        boostProp = candidates[0];
      }
    }
  }

  // 3. Resolve Inventory
  if (!inventoryProp) {
    for (const k in localData) {
      const v = localData[k];
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        if ('bandage' in v || 'healthkit' in v || 'soda' in v) {
          inventoryProp = k;
          break;
        }
      }
    }
  }
}

function getPlayerHealth(player) {
  const localData = player[translations.localData_];
  if (!localData) return 100;
  if (healthProp && localData[healthProp] !== undefined) return localData[healthProp];
  return 100;
}

function getPlayerBoost(player) {
  const localData = player[translations.localData_];
  if (!localData) return 0;
  if (boostProp && localData[boostProp] !== undefined) return localData[boostProp];
  return 0; // Default to 0 if not found
}

function getInventoryCount(player, item) {
  const localData = player[translations.localData_];
  if (!localData || !inventoryProp) return 0;
  const inv = localData[inventoryProp];
  return inv[item] || 0;
}

function isHealing(player) {
  const netData = player[translations.netData_];
  const activeWeapon = netData?.[translations.activeWeapon_];
  if (!activeWeapon) return false;

  const w = activeWeapon.toLowerCase();
  return w.includes('bandage') || w.includes('health') || w.includes('medkit') || w.includes('soda') || w.includes('pill');
}

function isFighting(game) {
  if (autoFireEnabled) return true;
  const binds = game[translations.inputBinds_];
  if (binds && binds.isBindDown(inputCommands.Fire_)) return true;
  if (inputState.queuedInputs_.includes(inputCommands.Fire_)) return true;
  return false;
}

function isMoving(game) {
  const binds = game[translations.inputBinds_];
  if (!binds) return false;

  // Check Manual Keys
  if (binds.isBindDown(inputCommands.MoveUp_) ||
    binds.isBindDown(inputCommands.MoveDown_) ||
    binds.isBindDown(inputCommands.MoveLeft_) ||
    binds.isBindDown(inputCommands.MoveRight_)) {
    return true;
  }

  // Check Queued Inputs (Bots)
  const q = inputState.queuedInputs_;
  if (q.includes(inputCommands.MoveUp_) ||
    q.includes(inputCommands.MoveDown_) ||
    q.includes(inputCommands.MoveLeft_) ||
    q.includes(inputCommands.MoveRight_)) {
    return true;
  }

  return false;
}

function isEnemyNear(game, me, threshold) {
  const players = game[translations.playerBarn_]?.playerPool?.[translations.pool_];
  if (!players) return false;

  const meTeam = findTeam(me);
  const mePos = me[translations.visualPos_];

  for (const p of players) {
    if (!p.active || p.__id === me.__id) continue;
    if (p[translations.netData_]?.[translations.dead_] || p.downed) continue;

    if (findTeam(p) === meTeam) continue;

    const pPos = p[translations.visualPos_];
    const dist = Math.hypot(pPos.x - mePos.x, pPos.y - mePos.y);

    if (dist < threshold) return true;
  }
  return false;
}

function autoHealTick() {
  const ahSettings = settings.autoHeal_;
  if (!ahSettings?.enabled_) return;

  if (!gameManager.game) return;
  const game = gameManager.game;
  const player = game[translations.activePlayer_];

  if (!player || !player.active) return;

  const netData = player[translations.netData_];
  if (netData?.[translations.dead_] || player.downed) return;

  const localData = player[translations.localData_];
  resolveProps(localData);

  // If health prop not found, we can't do much. Boost prop is optional but preferred.
  if (!healthProp) return;

  // 1. Combat Check
  if (isFighting(game)) return;

  // 2. Enemy Proximity Check
  if (ahSettings.enemyCheck_) {
    const dist = ahSettings.enemyDistance_ || 15;
    if (isEnemyNear(game, player, dist)) return;
  }

  // 3. Movement Check
  if (ahSettings.movementCheck_) {
    if (isMoving(game)) return;
  }

  const health = getPlayerHealth(player);
  const boost = getPlayerBoost(player);
  const now = Date.now();

  if (isHealing(player)) return;
  if (now - lastHealTime < HEAL_COOLDOWN) return;

  let itemToUse = null;

  const bandages = getInventoryCount(player, 'bandage');
  const kits = getInventoryCount(player, 'healthkit');
  const sodas = getInventoryCount(player, 'soda');
  const pills = getInventoryCount(player, 'painkiller');

  // Configurable Thresholds
  const bandageThresh = ahSettings.bandageThreshold_ || 75;
  const kitThresh = ahSettings.kitThreshold_ || 50;
  const boostKeepMax = ahSettings.boostKeepMax_; // Checkbox "Auto Boost (Keep Max)"

  // --- HEALTH LOGIC ---
  if (health < 100) {
    if (health < kitThresh && kits > 0) {
      itemToUse = 'healthkit';
    }
    else if (health < bandageThresh && bandages > 0) {
      itemToUse = 'bandage';
    }
    // Fallback logic for mid-range health
    else if (health < 100) {
      if (kits > 0 && health < 90 && health < kitThresh + 20) {
        itemToUse = 'healthkit';
      }
      if (!itemToUse && bandages > 0 && health < 75) {
        itemToUse = 'bandage';
      }
    }
  }

  // --- BOOST LOGIC ---
  // If we haven't chosen a healing item yet, check for boost
  if (!itemToUse && boostKeepMax && health >= 75) { // Only boost if health is reasonably high (priority to healing)
    // Smart Boost Logic
    // Check if we assume boostProp is valid. If 0, it might just be empty or undetected.
    // But we proceed anyway.

    if (boost < 100) {
      // If boost is low (< 50), prefer pills for big boost
      if (boost < 50) {
        if (pills > 0) itemToUse = 'painkiller';
        else if (sodas > 0) itemToUse = 'soda';
      }
      // If boost is high (>= 50), save pills, use sodas to top off
      else {
        if (sodas > 0) itemToUse = 'soda';
        else if (pills > 0) itemToUse = 'painkiller'; // Fallback if no sodas
      }
    }
  }

  if (itemToUse) {
    inputState.useItem_ = itemToUse;
    lastHealTime = now;
  }
}

export default function () {
  if (initialized) return;
  initialized = true;

  const checkReady = setInterval(() => {
    if (gameManager?.pixi?._ticker) {
      clearInterval(checkReady);
      gameManager.pixi._ticker.add(autoHealTick);
    }
  }, 500);
}
