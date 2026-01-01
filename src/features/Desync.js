// ============================================
// DESYNC - OPTIMAL WEAPON SWITCHING
// ============================================

import { translations } from '@/core/obfuscatedNameTranslator.js';
import { gameManager, inputState, settings } from '@/core/state.js';
import { isHandledByWeaponSwitch } from '@/features/AutoSwitch.js';
import { gameObjects, inputCommands, isGameReady } from '@/utils/constants.js';

// ============================================
// SWITCH DELAYS (données réelles du jeu)
// ============================================

const SWITCH_DELAYS = {
  // Snipers - 1s
  'sv98': 1.0,
  'mosin': 1.0,
  'awc': 1.0,
  'scout': 1.0,
  'blr': 1.0,
  'model94': 1.0,

  // Shotguns lents - 0.9s
  'm870': 0.9,
  'm1100': 0.9,
  'saiga': 0.9,

  // AR/SMG/Shotguns - 0.75s
  'mp5': 0.75,
  'mac10': 0.75,
  'ump9': 0.75,
  'vector': 0.75,
  'ak47': 0.75,
  'scar': 0.75,
  'groza': 0.75,
  'grozas': 0.75,
  'an94': 0.75,
  'spas12': 0.75,
  'super90': 0.75,
  'usas': 0.75,
  'm39': 0.75,
  'svd': 0.75,
  'mk12': 0.75,
  'garand': 0.75,
  'famas': 0.75,
  'hk416': 0.75,
  'm4a1': 0.75,
  'dp28': 0.75,
  'bar': 0.75,
  'pkp': 0.75,
  'm249': 0.75,
  'qbb97': 0.75,
  'l86': 0.75,
  'scarssr': 0.75,

  // Pistols non-9mm - 0.3s
  'mp220': 0.3,
  'deagle': 0.3,
  'ot38': 0.3,
  'ots38': 0.3,
  'm1911': 0.3,
  'p30l': 0.3,
  'peacemaker': 0.3,
  'flare_gun': 0.3,

  // 9mm Pistols - 0.25s
  'm9': 0.25,
  'glock': 0.25,
  'm93r': 0.25,
  'vss': 0.25,
  'scorpion': 0.25,
};

// ============================================
// STATE
// ============================================

const desyncState = {
  active_: false,
  currentCycle_: null,
  cycleIndex_: 0,
  lastSwitchTime_: 0,
  lastWeapon0_: null,
  lastWeapon1_: null,
  pendingSwitch_: null,
};

// ============================================
// UTILS
// ============================================

const getSwitchDelay = (weaponType) => {
  if (!weaponType) return 0.75;
  const type = weaponType.toLowerCase().replace(/[-_\s]/g, '');

  for (const [key, delay] of Object.entries(SWITCH_DELAYS)) {
    if (type.includes(key) || key.includes(type)) {
      return delay;
    }
  }

  // Fallback: lire depuis gameObjects
  try {
    const weapon = gameObjects[weaponType];
    if (weapon?.switchDelay) return weapon.switchDelay;
  } catch { }

  return 0.75;
};

const getWeaponFireDelay = (weaponType) => {
  try {
    const weapon = gameObjects[weaponType];
    return weapon?.fireDelay || 0.1;
  } catch {
    return 0.1;
  }
};

const isDesyncCompatible = (weaponType) => {
  if (!weaponType) return false;
  const type = weaponType.toLowerCase();

  // Armes qui bénéficient du desync (tir lent)
  const compatiblePatterns = [
    'sv98', 'mosin', 'awc', 'scout', 'blr', 'model94', // Snipers
    'm870', 'saiga', 'spas12', 'super90', 'm1100', 'usas', // Shotguns
    'mp220', // Double barrel
    'deagle', 'ot38', 'ots38', 'peacemaker', // Pistols lents
    'garand', 'm39', 'svd', 'mk12', 'scarssr', // DMRs
  ];

  return compatiblePatterns.some(p => type.includes(p));
};

// ============================================
// CYCLE CALCULATION
// ============================================

const calculateCycle = (delay1, delay2) => {
  // Génère un cycle optimal basé sur les 2 switch delays
  const cycle = [];
  const totalTime = Math.max(delay1, delay2) * 2;
  let time1 = 0;
  let time2 = delay2;

  // Cycle simple: alterne entre les 2 armes
  // en respectant les switch delays
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * totalTime;
    if (i % 2 === 0) {
      cycle.push({ weapon: 0, delay: delay1 });
    } else {
      cycle.push({ weapon: 1, delay: delay2 });
    }
  }

  return cycle;
};

const generateOptimalCycle = (weapon0Type, weapon1Type) => {
  const delay0 = getSwitchDelay(weapon0Type);
  const delay1 = getSwitchDelay(weapon1Type);

  // Cycles pré-calculés basés sur le document

  // MP220 (0.3) + M870 (0.9)
  if (delay0 === 0.3 && delay1 === 0.9) {
    return [
      { weapon: 0, wait: 0.3 },
      { weapon: 1, wait: 0.6 },
    ];
  }
  if (delay0 === 0.9 && delay1 === 0.3) {
    return [
      { weapon: 1, wait: 0.3 },
      { weapon: 0, wait: 0.6 },
    ];
  }

  // MP220 (0.3) + SPAS (0.75)
  if (delay0 === 0.3 && delay1 === 0.75) {
    return [
      { weapon: 0, wait: 0.3 },
      { weapon: 1, wait: 0.45 },
    ];
  }
  if (delay0 === 0.75 && delay1 === 0.3) {
    return [
      { weapon: 1, wait: 0.3 },
      { weapon: 0, wait: 0.45 },
    ];
  }

  // SPAS (0.75) + Sniper (1.0)
  if (delay0 === 0.75 && delay1 === 1.0) {
    return [
      { weapon: 0, wait: 0.75 },
      { weapon: 1, wait: 0.25 },
      { weapon: 0, wait: 0.5 },
      { weapon: 1, wait: 0.5 },
      { weapon: 0, wait: 0.25 },
    ];
  }
  if (delay0 === 1.0 && delay1 === 0.75) {
    return [
      { weapon: 1, wait: 0.75 },
      { weapon: 0, wait: 0.25 },
      { weapon: 1, wait: 0.5 },
      { weapon: 0, wait: 0.5 },
      { weapon: 1, wait: 0.25 },
    ];
  }

  // M870 (0.9) + Sniper (1.0)
  if (delay0 === 0.9 && delay1 === 1.0) {
    return [
      { weapon: 0, wait: 0.9 },
      { weapon: 1, wait: 0.1 },
      { weapon: 0, wait: 0.8 },
      { weapon: 1, wait: 0.2 },
      { weapon: 0, wait: 0.7 },
      { weapon: 1, wait: 0.3 },
      { weapon: 0, wait: 0.6 },
      { weapon: 1, wait: 0.4 },
    ];
  }
  if (delay0 === 1.0 && delay1 === 0.9) {
    return [
      { weapon: 1, wait: 0.9 },
      { weapon: 0, wait: 0.1 },
      { weapon: 1, wait: 0.8 },
      { weapon: 0, wait: 0.2 },
      { weapon: 1, wait: 0.7 },
      { weapon: 0, wait: 0.3 },
      { weapon: 1, wait: 0.6 },
      { weapon: 0, wait: 0.4 },
    ];
  }

  // Sniper (1.0) + Pistol (0.3)
  if (delay0 === 1.0 && delay1 === 0.3) {
    return [
      { weapon: 1, wait: 0.3 },
      { weapon: 1, wait: 0.3 },
      { weapon: 1, wait: 0.3 },
      { weapon: 0, wait: 0.1 },
    ];
  }
  if (delay0 === 0.3 && delay1 === 1.0) {
    return [
      { weapon: 0, wait: 0.3 },
      { weapon: 0, wait: 0.3 },
      { weapon: 0, wait: 0.3 },
      { weapon: 1, wait: 0.1 },
    ];
  }

  // Sniper (1.0) + DEagle (0.3 switch, 0.5 FSA)
  if ((delay0 === 1.0 && delay1 === 0.3) || (delay0 === 0.3 && delay1 === 1.0)) {
    const sniperIdx = delay0 === 1.0 ? 0 : 1;
    const deagleIdx = delay0 === 1.0 ? 1 : 0;
    return [
      { weapon: deagleIdx, wait: 0.5 },
      { weapon: sniperIdx, wait: 0.5 },
    ];
  }

  // Fallback: cycle simple
  const minDelay = Math.min(delay0, delay1);
  const maxDelay = Math.max(delay0, delay1);
  const fastWeapon = delay0 < delay1 ? 0 : 1;
  const slowWeapon = delay0 < delay1 ? 1 : 0;

  return [
    { weapon: fastWeapon, wait: minDelay },
    { weapon: slowWeapon, wait: maxDelay - minDelay },
  ];
};

// ============================================
// MAIN LOGIC
// ============================================

const WEAPON_COMMANDS = [inputCommands.EquipPrimary_, inputCommands.EquipSecondary_];

const queueWeaponSwitch = (weaponIndex) => {
  inputState.queuedInputs_.push(WEAPON_COMMANDS[weaponIndex]);
};

const handleDesync = () => {
  if (!isGameReady() || !settings.desync_?.enabled_) {
    desyncState.active_ = false;
    desyncState.currentCycle_ = null;
    return;
  }

  try {
    const game = gameManager.game;
    const player = game[translations.activePlayer_];
    const localData = player[translations.localData_];
    const currentWeaponIndex = localData[translations.curWeapIdx_];
    const weapons = localData[translations.weapons_];

    // Seulement pour armes 0 et 1
    if (currentWeaponIndex !== 0 && currentWeaponIndex !== 1) {
      desyncState.active_ = false;
      return;
    }

    const weapon0 = weapons[0];
    const weapon1 = weapons[1];

    // Vérifier si les armes ont changé
    if (weapon0.type !== desyncState.lastWeapon0_ || weapon1.type !== desyncState.lastWeapon1_) {
      desyncState.lastWeapon0_ = weapon0.type;
      desyncState.lastWeapon1_ = weapon1.type;
      desyncState.currentCycle_ = null;
      desyncState.cycleIndex_ = 0;
    }

    // Vérifier si WeaponSwitch gère ces armes (priorité à WeaponSwitch)
    if (isHandledByWeaponSwitch(weapon0.type) || isHandledByWeaponSwitch(weapon1.type)) {
      desyncState.active_ = false;
      return;
    }

    // Vérifier si les 2 armes sont compatibles avec Desync
    if (!isDesyncCompatible(weapon0.type) && !isDesyncCompatible(weapon1.type)) {
      desyncState.active_ = false;
      return;
    }

    // Activer le desync
    desyncState.active_ = true;

    // Générer le cycle si nécessaire
    if (!desyncState.currentCycle_) {
      desyncState.currentCycle_ = generateOptimalCycle(weapon0.type, weapon1.type);
      desyncState.cycleIndex_ = 0;
      desyncState.lastSwitchTime_ = Date.now();
    }

    const now = Date.now();
    const cycle = desyncState.currentCycle_;
    const currentStep = cycle[desyncState.cycleIndex_];

    // Vérifier si c'est le moment de switch
    const timeSinceLastSwitch = (now - desyncState.lastSwitchTime_) / 1000;

    if (timeSinceLastSwitch >= currentStep.wait) {
      // Switch vers l'arme du cycle
      if (currentWeaponIndex !== currentStep.weapon) {
        queueWeaponSwitch(currentStep.weapon);
      }

      // Passer à l'étape suivante
      desyncState.cycleIndex_ = (desyncState.cycleIndex_ + 1) % cycle.length;
      desyncState.lastSwitchTime_ = now;
    }

  } catch (e) {
    desyncState.active_ = false;
  }
};

// ============================================
// EXPORT
// ============================================

export const isDesyncActive = () => desyncState.active_;

let initialized = false;

export default function () {
  if (initialized) return;
  initialized = true;

  const checkReady = setInterval(() => {
    if (gameManager?.pixi?._ticker) {
      clearInterval(checkReady);
      gameManager.pixi._ticker.add(handleDesync);
    }
  }, 100);
}
