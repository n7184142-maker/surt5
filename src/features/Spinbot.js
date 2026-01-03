import { settings, aimState, gameManager } from '@/core/state.js';
import { hook, object, ref_addEventListener, reflect } from '@/core/hook.js';
import { translations } from '@/core/obfuscatedNameTranslator.js';
import { outer } from '@/core/outer.js';

const ANGULAR_ACCELERATION_MAX = 0.15;
const DAMPING_FACTOR = 0.92;
const PRIMARY_BUTTON = 0;
const TWO_PI = Math.PI * 2;

let currentAngle = 0;
let angularVelocity = 0;
let randomAngle = Math.random() * TWO_PI;
let isMouseDown = false;
let directionCycleIndex = 0;
const FOUR_DIRECTIONS = [0, -Math.PI / 2, Math.PI, Math.PI / 2]; // Right, Up, Left, Down
const THREE_DIRECTIONS = [0, (2 * Math.PI / 3), (4 * Math.PI / 3)]; // Triangle: Right, Top-Left, Bottom-Left
const TWO_DIRECTIONS = [0, Math.PI]; // Right, Left (horizontal flip)

function updateRotation() {
  const game = gameManager.game;
  const activePlayer = game[translations.activePlayer_];
  if (!activePlayer?.bodyContainer || game[translations.uiManager_].spectating) return;

  const body = activePlayer.bodyContainer;
  const mouseX = game[translations.input_].mousePos.x - outer.innerWidth / 2;
  const mouseY = game[translations.input_].mousePos.y - outer.innerHeight / 2;

  if (isMouseDown && aimState.lastAimPos_ && (settings.aimbot_.enabled_ || settings.meleeLock_.enabled_)) {
    body.rotation = Math.atan2(
      aimState.lastAimPos_.clientY - outer.innerHeight / 2,
      aimState.lastAimPos_.clientX - outer.innerWidth / 2,
    ) || 0;
    return;
  }

  body.rotation = Math.atan2(mouseY, mouseX) || 0;
}

function spinbotTicker() {
  if (!gameManager.game?.initialized) return;
  updateRotation();
}

const getCursorRadius = () => {
  const centerX = outer.innerWidth / 2;
  const centerY = outer.innerHeight / 2;
  const deltaX = gameManager.game[translations.input_].mousePos._x - centerX;
  const deltaY = gameManager.game[translations.input_].mousePos._y - centerY;
  return { centerX, centerY, radius: Math.hypot(deltaX, deltaY) };
};

const getDirectionAngle = () => {
  if (settings.spinbot_.spinTwoDirections_) {
    return TWO_DIRECTIONS[directionCycleIndex];
  } else if (settings.spinbot_.spinThreeDirections_) {
    return THREE_DIRECTIONS[directionCycleIndex];
  } else if (settings.spinbot_.spinAllDirections_) {
    return FOUR_DIRECTIONS[directionCycleIndex];
  }
  return randomAngle; // Random mode
};

function calculateSpinbotMousePosition(axis) {
  if (gameManager.game[translations.activePlayer_].throwableState === 'cook') {
    return axis === 'x' ? gameManager.game[translations.input_].mousePos._x : gameManager.game[translations.input_].mousePos._y;
  }

  const { centerX, centerY, radius } = getCursorRadius();
  let angle;
  
  if (settings.spinbot_.realistic_) {
    angle = currentAngle;
  } else if (settings.spinbot_.spinTwoDirections_ || settings.spinbot_.spinThreeDirections_ || settings.spinbot_.spinAllDirections_) {
    angle = getDirectionAngle();
  } else {
    angle = randomAngle;
  }
  
  return axis === 'x' ? centerX + Math.cos(angle) * radius : centerY + Math.sin(angle) * radius;
}

const updateSpinPhysics = () => {
  if (isMouseDown || !settings.spinbot_.enabled_) return;

  if (settings.spinbot_.realistic_) {
    angularVelocity += (Math.random() * 2 - 1) * ((settings.spinbot_.speed_ / 50) * ANGULAR_ACCELERATION_MAX);
    angularVelocity *= DAMPING_FACTOR;
    currentAngle += angularVelocity;
    return;
  }

  if (settings.spinbot_.spinTwoDirections_) {
    // Cycle through 2 directions (horizontal flip) based on speed
    if (Math.random() < (settings.spinbot_.speed_ / 100) * 2) {
      directionCycleIndex = (directionCycleIndex + 1) % 2;
    }
  } else if (settings.spinbot_.spinThreeDirections_) {
    // Cycle through 3 directions (triangle pattern) based on speed
    if (Math.random() < (settings.spinbot_.speed_ / 100) * 2) {
      directionCycleIndex = (directionCycleIndex + 1) % 3;
    }
  } else if (settings.spinbot_.spinAllDirections_) {
    // Cycle through 4 directions based on speed
    if (Math.random() < (settings.spinbot_.speed_ / 100) * 2) {
      directionCycleIndex = (directionCycleIndex + 1) % 4;
    }
  } else {
    // Random mode
    if (Math.random() < (settings.spinbot_.speed_ / 100) * 2) {
      randomAngle = Math.random() * TWO_PI;
    }
  }
};

const createMouseAccessor = (axis, compute) => ({
  get: function () {
    return compute.call(this);
  },
  set(value) {
    this[`_${axis}`] = value;
  },
});

export default function() {
  gameManager.pixi._ticker.add(spinbotTicker);
  gameManager.pixi._ticker.add(updateSpinPhysics);

  let lastX = 0;
  let lastY = 0;

  const mousePos = gameManager.game[translations.input_].mousePos;

  object.defineProperty(mousePos, 'y', createMouseAccessor('y', function () {
    if (isMouseDown && aimState.lastAimPos_ && settings.aimbot_.enabled_) return aimState.lastAimPos_.clientY;
    if (!isMouseDown && settings.spinbot_.enabled_) {
      lastY = calculateSpinbotMousePosition('y');
      return lastY;
    }
    return this._y;
  }));

  object.defineProperty(mousePos, 'x', createMouseAccessor('x', function () {
    if (isMouseDown && aimState.lastAimPos_ && settings.aimbot_.enabled_) return aimState.lastAimPos_.clientX;
    if (!isMouseDown && settings.spinbot_.enabled_) {
      lastX = calculateSpinbotMousePosition('x');
      return lastX;
    }
    return this._x;
  }));

  const handleMouseDown = (event) => {
    if (event.button !== PRIMARY_BUTTON) return;
    isMouseDown = true;
  };

  const handleMouseUp = (event) => {
    if (event.button !== PRIMARY_BUTTON) return;
    isMouseDown = false;
  };

  reflect.apply(ref_addEventListener, outer, ['mousedown', handleMouseDown]);
  reflect.apply(ref_addEventListener, outer, ['mouseup', handleMouseUp]);
}
