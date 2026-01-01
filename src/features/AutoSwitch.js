import { gameManager, settings, inputState } from '@/core/state.js';
import { gameObjects, inputCommands, isGameReady } from '@/utils/constants.js';
import { translations } from '@/core/obfuscatedNameTranslator.js';
import { isTargetingLoot } from '@/features/Aimbot.js';

const BLATANT_MELEE_DISTANCE = 150; // Pixel distance threshold for auto melee switch

const WEAPON_COMMANDS = [inputCommands.EquipPrimary_, inputCommands.EquipSecondary_];

const weaponState = [
  { name_: '', ammo_: null, lastShotDate_: Date.now(), type_: '' },
  { name_: '', ammo_: null, lastShotDate_: Date.now(), type_: '' },
  { name_: '', ammo_: null, type_: '' },
  { name_: '', ammo_: null, type_: '' },
];

const queueInput = (command) => inputState.queuedInputs_.push(command);

const isSlowFiringWeapon = (weaponType) => {
  try {
    const weapon = gameObjects[weaponType];
    return (
      (weapon.fireMode === 'single' || weapon.fireMode === 'burst') && weapon.fireDelay >= 0.2
    );
  } catch {
    return false;
  }
};

export const isHandledByWeaponSwitch = (weaponType) => {
  return isSlowFiringWeapon(weaponType);
};

const isPlayerFiring = () =>
  gameManager.game[translations.touch_].shotDetected ||
  gameManager.game[translations.inputBinds_].isBindDown(inputCommands.Fire_);

const queueWeaponSwitch = (weaponIndex) => {
  queueInput(WEAPON_COMMANDS[weaponIndex]);
};

const queueWeaponCycleAndBack = (firstIndex, secondIndex) => {
  queueWeaponSwitch(firstIndex);
  queueWeaponSwitch(secondIndex);
};

const queueMeleeCycleAndBack = (weaponIndex) => {
  queueInput(inputCommands.EquipMelee_);
  queueWeaponSwitch(weaponIndex);
};

const getAlternateWeaponIndex = (index) => (index === 0 ? 1 : 0);

const getClosestEnemyDistance = () => {
  try {
    const game = gameManager.game;
    const players = game[translations.playerManager_][translations.players_];
    const me = game[translations.activePlayer_];
    const mousePos = game[translations.input_].mousePos;

    let closestDistance = Infinity;

    for (const player of players) {
      if (!player.active || me.__id === player.__id) continue;
      if (player[translations.netData_][translations.dead_]) continue;

      const screenPos = game[translations.camera_][translations.pointToScreen_]({
        x: player[translations.visualPos_].x,
        y: player[translations.visualPos_].y,
      });

      const distance = Math.hypot(screenPos.x - mousePos._x, screenPos.y - mousePos._y);
      if (distance < closestDistance) {
        closestDistance = distance;
      }
    }

    return closestDistance;
  } catch {
    return Infinity;
  }
};

const handleWeaponSwitch = () => {
  if (!isGameReady() || !settings.autoSwitch_.enabled_) return;

  try {
    const game = gameManager.game;
    const player = game[translations.activePlayer_];
    const localData = player[translations.localData_];
    const currentWeaponIndex = localData[translations.curWeapIdx_];
    const weapons = localData[translations.weapons_];
    const currentWeapon = weapons[currentWeaponIndex];
    const currentWeaponState = weaponState[currentWeaponIndex];

    // Blatant: Auto-switch to melee lock when enemy gets too close
    if (settings.aimbot_.blatant_ && settings.meleeLock_.enabled_) {
      const closestEnemyDist = getClosestEnemyDistance();
      if (closestEnemyDist < BLATANT_MELEE_DISTANCE) {
        const isMeleeEquipped = currentWeaponIndex === 2;
        if (!isMeleeEquipped) {
          queueInput(inputCommands.EquipMelee_);
          return;
        }
      }
    }

    // Auto-switch to melee when targeting loot items
    if (isTargetingLoot()) {
      const isMeleeEquipped = currentWeaponIndex === 2;
      if (!isMeleeEquipped) {
        queueInput(inputCommands.EquipMelee_);
        return;
      }
    }

    if (currentWeapon.ammo === currentWeaponState.ammo_) return;

    const otherWeaponIndex = getAlternateWeaponIndex(currentWeaponIndex);
    const otherWeapon = weapons[otherWeaponIndex];

    const shouldSwitch =
      isSlowFiringWeapon(currentWeapon.type) &&
      currentWeapon.type === currentWeaponState.type_ &&
      (currentWeapon.ammo < currentWeaponState.ammo_ ||
        (currentWeaponState.ammo_ === 0 &&
          currentWeapon.ammo > currentWeaponState.ammo_ &&
          isPlayerFiring()));

    if (shouldSwitch) {
      currentWeaponState.lastShotDate_ = Date.now();

      if (
        isSlowFiringWeapon(otherWeapon.type) &&
        otherWeapon.ammo &&
        !settings.autoSwitch_.useOneGun_
      ) {
        queueWeaponSwitch(otherWeaponIndex);
      } else if (otherWeapon.type !== '') {
        queueWeaponCycleAndBack(otherWeaponIndex, currentWeaponIndex);
      } else {
        queueMeleeCycleAndBack(currentWeaponIndex);
      }
    }

    currentWeaponState.ammo_ = currentWeapon.ammo;
    currentWeaponState.type_ = currentWeapon.type;
  } catch { }
};

export default function () {
  gameManager.pixi._ticker.add(handleWeaponSwitch);
}
