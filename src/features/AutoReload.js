/**
 * ============================================
 * AUTO RELOAD
 * ============================================
 */

import { gameManager, inputState, settings } from '@/core/state.js';
import { translations } from '@/core/obfuscatedNameTranslator.js';
import { isGameReady, inputCommands, gameObjects } from '@/utils/constants.js';

let initialized = false;
let reloadTimer = 0;

function autoReloadTick() {
  const arSettings = settings.autoReload_;
  if (!arSettings?.enabled_) return;

  if (!gameManager.game) return;
  const game = gameManager.game;
  const player = game[translations.activePlayer_];

  if (!player || !player.active) return;

  const netData = player[translations.netData_];
  if (netData?.[translations.dead_] || player.downed) return;

  const localData = player[translations.localData_];
  if (!localData) return;

  const curIdx = localData[translations.curWeapIdx_];
  const weapons = localData[translations.weapons_];

  if (curIdx === null || !weapons) return;

  const activeWeapon = weapons[curIdx];
  if (!activeWeapon) return;

  // Ensure it's a primary or secondary gun (slots 0 and 1)
  if (curIdx > 1) return;

  // Needed for Max Clip
  if (!gameObjects) return;

  const weaponDef = gameObjects[activeWeapon.type];
  if (!weaponDef || !weaponDef.maxClip) return;

  const maxClip = weaponDef.maxClip;
  const currentAmmo = activeWeapon.ammo;

  const percentage = (currentAmmo / maxClip) * 100;
  const threshold = arSettings.threshold_ || 0;

  // Logic: If ammo Percentage <= threshold, reload.
  if (percentage <= threshold) {
    const now = Date.now();
    // Simple cooldown to prevent spamming input every tick
    if (now - reloadTimer > 500) {
      inputState.queuedInputs_.push(inputCommands.Reload_);
      reloadTimer = now;
    }
  }
}

export default function () {
  if (initialized) return;
  initialized = true;

  const checkReady = setInterval(() => {
    if (gameManager?.pixi?._ticker) {
      clearInterval(checkReady);
      gameManager.pixi._ticker.add(autoReloadTick);
    }
  }, 500);
}
