import { settings, getUIRoot, inputState, aimState } from '@/core/state.js';
import { findTeam, findBullet, findWeapon, inputCommands } from '@/utils/constants.js';
import { gameManager } from '@/core/state.js';
import { translations } from '@/core/obfuscatedNameTranslator.js';
import { ref_addEventListener } from '@/core/hook.js';
import {
  AimState,
  setAimState,
  getCurrentAimPosition,
  aimOverlays,
} from '@/core/aimController.js';
import { outerDocument, outer } from '@/core/outer.js';
import { v2, collisionHelpers, sameLayer, ballistics } from '@/utils/math.js';

const isBypassLayer = (layer) => layer === 2 || layer === 3;

const state = {
  focusedEnemy_: null,
  previousEnemies_: {},
  currentEnemy_: null,
  meleeLockEnemy_: null,
  meleeLockTargetId_: null, // Track melee lock target ID for stability
  meleeLockStartTime_: null, // Track when melee lock started
  velocityBuffer_: {},
  lastTargetScreenPos_: null,
  canAutoFire_: true,
  isCurrentEnemyShootable_: false,
  targetPriority_: {}, // Track target scores for better prioritization
  currentLootTarget_: null, // Track current loot being targeted
  isSwitchingToMelee_: false, // Track if we just queued melee switch
  meleeVelocityHistory_: {}, // Store velocity history for better prediction
  meleeAcceleration_: {}, // Track acceleration for advanced prediction
  
  // Anti-Grenade state
  nearestGrenade_: null, // Nearest active grenade
  lastGrenadeCheckTime_: 0, // Last time we checked for grenades
  grenadeEvasionAngle_: null, // Direction to evade from grenade
};

const MELEE_ENGAGE_DISTANCE = 5.5;
const MELEE_DETECTION_DISTANCE = 7.5; // Extended range for detection
const MELEE_LOCK_HYSTERESIS = 1.0; // Prevent rapid lock/unlock switching
const MELEE_PREDICTION_TIME = 0.15; // 150ms prediction for moving targets
const MELEE_VELOCITY_HISTORY_SIZE = 30; // Store more history for better prediction
const MELEE_MIN_HISTORY_SAMPLES = 5; // Require more samples before predicting
const MELEE_VELOCITY_SMOOTHING = 0.7; // Higher smoothing for stable melee targeting
const MELEE_PREDICTION_LOOKAHEAD = 0.2; // 200ms prediction window for melee

// Anti-grenade constants
const GRENADE_EXPLOSION_RADIUS = 15; // Game units (same as ESP render)
const GRENADE_SAFE_DISTANCE = GRENADE_EXPLOSION_RADIUS + 20; // Extended buffer for earlier detection
const GRENADE_EVADE_SPEED = 255; // Max movement speed for evasion

// Anti-Grenade constants
const GRENADE_EXPLOSION_PATTERNS = [
  'frag',
  'explosion_frag',
  'smoke',
  'explosion_smoke',
  'gas',
  'concussion',
];
const GRENADE_BASE_RADIUS = 8; // Base explosion radius in game units
const ANTI_GRENADE_EVADE_DISTANCE = 20; // Distance to maintain from grenade center (increased)
const ANTI_GRENADE_CHECK_INTERVAL = 50; // Check grenades every 100ms



const computeAimAngle = (point) => {
  if (!point) return 0;
  const centerX = outer.innerWidth / 2;
  const centerY = outer.innerHeight / 2;
  return Math.atan2(point.y - centerY, point.x - centerX);
};

// Use optimized angle normalization from math.js
const normalizeAngle = (angle) => v2.normalizeAngle_(angle);

const getLocalLayer = (player) => {
  if (isBypassLayer(player.layer)) return player.layer;
  return player.layer;
};

const meetsLayerCriteria = (targetLayer, localLayer, isLocalOnBypass) => {
  if (isBypassLayer(targetLayer)) return true;
  return targetLayer === localLayer;
};

const BLOCKING_OBSTACLE_PATTERNS = [
  'metal_wall_',
  'brick_wall_',
  'concrete_wall_',
  'stone_wall_',
  'container_wall_',
  '_wall_int_',
  'bank_wall_',
  'barn_wall_',
  'cabin_wall_',
  'hut_wall_',
  'house_wall_',
  'mansion_wall_',
  'police_wall_',
  'shack_wall_',
  'outhouse_wall_',
  'teahouse_wall_',
  'warehouse_wall_',
  'silo_',
  'bollard_',
  'sandbags_',
  'hedgehog',
  'stone_01',
  'stone_02',
  'stone_03',
  'stone_04',
  'stone_05',
  'stone_06',
  'stone_07',
  'stone_08',
  'stone_09',
  'stone_0',
  'tree_',
  'glass_wall_',
  'locker_',
  'deposit_box_',
];

const NON_BLOCKING_OBSTACLE_PATTERNS = [
  'bush_',
  'brush_',
  'crate_',
  'barrel_',
  'refrigerator_',
  'control_panel_',
  'chest_',
  'case_',
  'oven_',
  'bed_',
  'bookshelf_',
  'couch_',
  'table_',
  'drawers_',
  'window',
  'toilet_',
  'pot_',
  'planter_',
  'pumpkin_',
  'potato_',
  'egg_',
  'woodpile_',
  'decal',

];

const isObstacleBlocking = (obstacle) => {
  if (obstacle.collidable === false) return false;

  const obstacleType = obstacle.type || '';

  if (obstacle.isWall === true) return true;

  if (obstacle.destructible === false) return true;

  for (const pattern of BLOCKING_OBSTACLE_PATTERNS) {
    if (obstacleType.includes(pattern)) return true;
  }

  for (const pattern of NON_BLOCKING_OBSTACLE_PATTERNS) {
    if (obstacleType.includes(pattern)) return false;
  }

  if (obstacle.health !== undefined && obstacle.health > 200) {
    return true;
  }

  return false;
};

const canCastToPlayer = (localPlayer, targetPlayer, weapon, bullet) => {
  if (!weapon || !bullet) {
    return true;
  }

  const game = gameManager.game;
  const idToObj = game?.[translations.objectCreator_]?.[translations.idToObj_];
  if (!idToObj) {
    return true;
  }

  const BULLET_HEIGHT = 0.25;
  const trueLayer = localPlayer.layer;

  const playerPos = localPlayer[translations.visualPos_];
  const targetPos = targetPlayer[translations.visualPos_];

  const dx = targetPos.x - playerPos.x;
  const dy = targetPos.y - playerPos.y;
  const aimAngle = Math.atan2(dy, dx);

  const dir = v2.create_(Math.cos(aimAngle), Math.sin(aimAngle));

  const baseSpread = (weapon.shotSpread || 0) * (Math.PI / 180);
  const generousSpread = baseSpread * 1.5;

  const maxDistance = Math.hypot(dx, dy);

  // Improved: Adaptive ray count based on spread and distance
  const rayCount = Math.max(
    Math.min(30, weapon.shotSpread ? Math.ceil((weapon.shotSpread || 0) * 2) : 15),
    Math.ceil(maxDistance / 50)
  );

  const allObstacles = Object.values(idToObj).filter((obj) => {
    if (!obj.collider) return false;
    if (obj.dead) return false;
    if (obj.height !== undefined && obj.height < BULLET_HEIGHT) return false;
    if (obj.layer !== undefined && !sameLayer(obj.layer, trueLayer)) return false;
    return true;
  });

  const blockingObstacles = allObstacles.filter(isObstacleBlocking);

  if (blockingObstacles.length === 0) {
    return true;
  }

  // Pre-calculate collision distances for all obstacles
  const collisionCache = new Map();
  for (const obstacle of blockingObstacles) {
    collisionCache.set(obstacle, new Map());
  }

  let unblocked = 0;
  for (let i = 0; i < rayCount; i++) {
    const t = rayCount === 1 ? 0.5 : i / (rayCount - 1);
    const rayAngle = aimAngle - generousSpread / 2 + generousSpread * t;
    const rayDir = v2.create_(Math.cos(rayAngle), Math.sin(rayAngle));

    const endPos = v2.add_(playerPos, v2.mul_(rayDir, maxDistance));
    let blocked = false;

    for (const obstacle of blockingObstacles) {
      let collision = collisionCache.get(obstacle).get(rayAngle);
      
      if (collision === undefined) {
        collision = collisionHelpers.intersectSegment_(obstacle.collider, playerPos, endPos);
        collisionCache.get(obstacle).set(rayAngle, collision);
      }
      
      if (collision) {
        const distToCollision = v2.length_(v2.sub_(collision.point, playerPos));
        // Improved: Check collision within target radius, not just before target
        const targetRadius = 0.75; // Approximate player collision radius
        if (distToCollision < maxDistance - targetRadius) {
          blocked = true;
          break;
        }
      }
    }

    if (!blocked) {
      unblocked++;
      // Early exit: If majority of rays pass through, target is shootable
      if (unblocked > rayCount * 0.4) {
        return true;
      }
    }
  }

  return unblocked > rayCount * 0.3; // At least 30% of rays must pass through
};

const queueInput = (command) => inputState.queuedInputs_.push(command);

let tickerAttached = false;

// Use optimized distance calculation from math.js (squared distance is faster)
const getDistance = (x1, y1, x2, y2) => {
  return v2.distanceSqr_(x1, y1, x2, y2);
};

// Use optimized angle calculation from math.js
const calcAngle = (playerPos, mePos) => {
  return v2.angleTowards_(playerPos, mePos);
};

function predictPosition(enemy, currentPlayer) {
  if (!enemy || !currentPlayer) return null;

  const enemyPos = enemy[translations.visualPos_];
  const currentPlayerPos = currentPlayer[translations.visualPos_];
  
  // Store position history for velocity calculation
  const enemyId = enemy.__id;
  const history = state.previousEnemies_[enemyId] ?? (state.previousEnemies_[enemyId] = []);
  const now = performance.now();
  
  history.push([now, { ...enemyPos }]);
  if (history.length > 20) history.shift();

  // Need at least 3 samples for proper velocity calculation
  if (history.length < 3) {
    return gameManager.game[translations.camera_][translations.pointToScreen_]({
      x: enemyPos.x,
      y: enemyPos.y,
    });
  }

  // Calculate velocity using older position samples (surviv-cheat posOldOld method)
  let velocityX = 0;
  let velocityY = 0;
  
  // Use position from 2-3 frames ago for stability
  const oldestIdx = Math.max(0, history.length - 3);
  const newestIdx = history.length - 1;
  const oldPos = history[oldestIdx][1];
  const newPos = history[newestIdx][1];
  const timeDiff = (history[newestIdx][0] - history[oldestIdx][0]) / 1000; // Convert to seconds
  
  if (timeDiff > 0.001) { // Avoid division by very small numbers
    velocityX = (newPos.x - oldPos.x) / timeDiff;
    velocityY = (newPos.y - oldPos.y) / timeDiff;
  }

  // Clamp velocity to reasonable range
  const velMag = Math.hypot(velocityX, velocityY);
  if (velMag > 2000) {
    const scale = 2000 / velMag;
    velocityX *= scale;
    velocityY *= scale;
  }

  // Get weapon and bullet information
  const weapon = findWeapon(currentPlayer);
  const bullet = findBullet(weapon);
  const bulletSpeed = bullet?.speed || 1000;

  // Use optimized quadratic ballistics solver from math.js
  // This solves: when will the bullet collide with the moving enemy?
  const targetVel = { x: velocityX, y: velocityY };
  const t = ballistics.quadraticIntercept_(currentPlayerPos, enemyPos, targetVel, bulletSpeed);
  
  if (t === null) {
    // No valid intercept - just aim at current position
    return gameManager.game[translations.camera_][translations.pointToScreen_](enemyPos);
  }

  // Calculate predicted position with optional prediction level smoothing
  const predictionLevel = settings.aimbot_.predictionLevel_ ?? 1.0;
  const predictedPos = {
    x: enemyPos.x + velocityX * t * predictionLevel,
    y: enemyPos.y + velocityY * t * predictionLevel,
  };

  return gameManager.game[translations.camera_][translations.pointToScreen_](predictedPos);
}

function predictMeleePosition(enemy, currentPlayer, distanceToEnemy) {
  // Advanced prediction specifically optimized for melee combat
  if (!enemy || !currentPlayer) return null;

  const enemyPos = enemy[translations.visualPos_];
  const enemyId = enemy.__id;
  
  // Initialize velocity history if needed
  if (!state.meleeVelocityHistory_[enemyId]) {
    state.meleeVelocityHistory_[enemyId] = {
      positions: [],
      velocities: [],
      lastVelocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 }
    };
  }
  
  const history = state.meleeVelocityHistory_[enemyId];
  const now = performance.now();
  
  // Add current position to history
  history.positions.push({ x: enemyPos.x, y: enemyPos.y, t: now });
  if (history.positions.length > MELEE_VELOCITY_HISTORY_SIZE) {
    history.positions.shift();
  }
  
  // Need minimum samples for reliable velocity calculation
  if (history.positions.length < MELEE_MIN_HISTORY_SAMPLES) {
    return enemyPos;
  }
  
  // Calculate velocity from recent position history
  const recentIdx = Math.max(0, history.positions.length - 3);
  const oldPos = history.positions[0];
  const newPos = history.positions[history.positions.length - 1];
  const timeDiffMs = newPos.t - oldPos.t;
  const timeDiffSec = timeDiffMs / 1000;
  
  if (timeDiffSec > 0.001) {
    const newVelX = (newPos.x - oldPos.x) / timeDiffSec;
    const newVelY = (newPos.y - oldPos.y) / timeDiffSec;
    
    // Apply exponential smoothing to velocity for stability
    const smoothing = MELEE_VELOCITY_SMOOTHING;
    history.lastVelocity.x = history.lastVelocity.x * smoothing + newVelX * (1 - smoothing);
    history.lastVelocity.y = history.lastVelocity.y * smoothing + newVelY * (1 - smoothing);
    
    // Calculate acceleration for advanced prediction
    if (history.velocities.length > 0) {
      const lastVel = history.velocities[history.velocities.length - 1];
      history.acceleration.x = (newVelX - lastVel.x) * (1 - smoothing);
      history.acceleration.y = (newVelY - lastVel.y) * (1 - smoothing);
    }
    
    history.velocities.push({ x: newVelX, y: newVelY });
    if (history.velocities.length > 10) {
      history.velocities.shift();
    }
  }
  
  // Clamp velocity to reasonable range
  const velMag = Math.hypot(history.lastVelocity.x, history.lastVelocity.y);
  if (velMag > 2000) {
    const scale = 2000 / velMag;
    history.lastVelocity.x *= scale;
    history.lastVelocity.y *= scale;
  }
  
  // Adaptive prediction: more prediction for faster targets
  const velocityFactor = Math.min(1.0, velMag / 500); // Scale 0-1 based on speed
  const adaptiveLookahead = MELEE_PREDICTION_LOOKAHEAD * (0.8 + velocityFactor * 0.4);
  
  // Predict position including acceleration component
  const predictedX = enemyPos.x + 
    history.lastVelocity.x * adaptiveLookahead + 
    history.acceleration.x * adaptiveLookahead * adaptiveLookahead * 0.5;
  
  const predictedY = enemyPos.y + 
    history.lastVelocity.y * adaptiveLookahead + 
    history.acceleration.y * adaptiveLookahead * adaptiveLookahead * 0.5;
  
  return { x: predictedX, y: predictedY };
}

function getAdaptiveMeleeDistance(enemy) {
  // Calculate adaptive engagement distance based on target velocity
  if (!enemy || !enemy.__id) {
    return MELEE_ENGAGE_DISTANCE;
  }
  
  const history = state.meleeVelocityHistory_[enemy.__id];
  if (!history) {
    return MELEE_ENGAGE_DISTANCE;
  }
  
  const velMag = Math.hypot(history.lastVelocity.x, history.lastVelocity.y);
  
  // For faster-moving targets, increase engagement distance slightly
  // This helps with prediction accuracy
  const speedFactor = Math.min(0.5, velMag / 1000); // Max +0.5 units
  return MELEE_ENGAGE_DISTANCE + speedFactor;
}

function findNearbyGrenades(playerPos, layer, maxDistance = GRENADE_SAFE_DISTANCE * 1.5) {
  // Find all grenades nearby that could threaten the player
  const game = gameManager.game;
  const idToObj = game?.[translations.objectCreator_]?.[translations.idToObj_];
  if (!idToObj) return [];
  
  const grenades = [];
  
  for (const obj of Object.values(idToObj)) {
    // Detect grenades: __type === 9 and not smoke, or has smoke/explosion properties
    const isGrenade = (obj.__type === 9 && obj.type !== 'smoke') || (obj.smokeEmitter && obj.explodeParticle);
    
    if (!isGrenade) continue;
    if (obj.dead) continue;
    if (!obj.pos) continue;
    
    // Check layer compatibility
    const isOnBypassLayer = layer === 2 || layer === 3;
    const grenadeOnBypass = obj.layer === 2 || obj.layer === 3;
    
    if (!isOnBypassLayer && !grenadeOnBypass && obj.layer !== layer) {
      continue; // Different layer and neither is bypass layer
    }
    
    const distance = Math.hypot(playerPos.x - obj.pos.x, playerPos.y - obj.pos.y);
    
    if (distance <= maxDistance) {
      grenades.push({
        pos: obj.pos,
        distance: distance,
        type: obj.type || 'frag',
      });
    }
  }
  
  return grenades;
}

function calculateGrenadeEvadeDirection(playerPos, grenades) {
  // Calculate the best direction to evade from grenades
  // Returns angle away from danger zones
  
  if (grenades.length === 0) return null;
  
  // Calculate weighted away-vector from all grenades
  let awayX = 0;
  let awayY = 0;
  
  for (const grenade of grenades) {
    const dx = playerPos.x - grenade.pos.x;
    const dy = playerPos.y - grenade.pos.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist < 0.1) {
      // Player is inside grenade radius - flee away HARD
      awayX += dx / (dist + 0.1) * 10;
      awayY += dy / (dist + 0.1) * 10;
    } else {
      // Weight by inverse distance - closer grenades = more weight
      const weight = 1 / (dist + 1);
      awayX += (dx / dist) * weight;
      awayY += (dy / dist) * weight;
    }
  }
  
  const magnitude = Math.hypot(awayX, awayY);
  if (magnitude < 0.1) return null;
  
  return Math.atan2(awayY / magnitude, awayX / magnitude);
}


function findGrenades(me) {
  // Find all active grenades that pose a threat
  const game = gameManager.game;
  const idToObj = game?.[translations.objectCreator_]?.[translations.idToObj_];
  if (!idToObj) return [];
  
  const mePos = me[translations.visualPos_];
  const isLocalOnBypassLayer = isBypassLayer(me.layer);
  const localLayer = getLocalLayer(me);
  const maxThreatDistance = ANTI_GRENADE_EVADE_DISTANCE * 1.5; // Check grenades within 18 units
  
  const grenades = [];
  
  for (const obj of Object.values(idToObj)) {
    if (!obj || obj.dead) continue;
    
    const objType = obj.type || '';
    
    // Check if object is a grenade/explosive
    const isGrenade = GRENADE_EXPLOSION_PATTERNS.some(pattern => objType.includes(pattern));
    if (!isGrenade) continue;
    
    // Check layer compatibility
    if (obj.layer !== undefined && !meetsLayerCriteria(obj.layer, localLayer, isLocalOnBypassLayer)) {
      continue;
    }
    
    const objPos = obj[translations.visualPos_];
    if (!objPos) continue;
    
    // Calculate distance
    const distance = Math.hypot(mePos.x - objPos.x, mePos.y - objPos.y);
    
    // Only consider nearby grenades
    if (distance > maxThreatDistance) continue;
    
    // Determine explosion radius (some grenades might have different radiuses)
    const explosionRadius = obj.explosionRadius || GRENADE_BASE_RADIUS;
    
    grenades.push({
      object: obj,
      position: objPos,
      distance: distance,
      explosionRadius: explosionRadius,
      dangerZone: explosionRadius + 1 // Add safety margin
    });
  }
  
  return grenades.sort((a, b) => a.distance - b.distance);
}

function getGrenadeEvasionDirection(grenades, mePos) {
  // Calculate direction to evade from nearest grenades
  if (!grenades || grenades.length === 0) return null;
  
  // Get the nearest grenade that threatens us
  let threatGrenade = null;
  for (const grenade of grenades) {
    if (grenade.distance <= grenade.dangerZone) {
      threatGrenade = grenade;
      break;
    }
  }
  
  if (!threatGrenade) return null;
  
  // Calculate direction AWAY from grenade center
  const grenadePos = threatGrenade.position;
  const dx = mePos.x - grenadePos.x;
  const dy = mePos.y - grenadePos.y;
  const dist = Math.hypot(dx, dy);
  
  if (dist < 0.1) {
    // We're on top of grenade, run in random direction
    return Math.random() * Math.PI * 2;
  }
  
  // Direction away from grenade
  return Math.atan2(dy, dx);
}


function findTarget(players, me) {
  const meTeam = findTeam(me);
  const isLocalOnBypassLayer = isBypassLayer(me.layer);
  const localLayer = getLocalLayer(me);
  let bestTarget = null;
  let bestScore = -Infinity;
  const fovRadiusSquared = settings.aimbot_.fov_ ** 2;
  const currentTime = performance.now();

  for (const player of players) {
    if (!player.active) continue;
    if (player[translations.netData_][translations.dead_]) continue;
    if (!settings.aimbot_.targetKnocked_ && player.downed) continue;
    if (me.__id === player.__id) continue;
    if (!meetsLayerCriteria(player.layer, localLayer, isLocalOnBypassLayer)) continue;
    if (findTeam(player) === meTeam && !settings.aimbot_.aimAllies_) continue;

    const screenPos = gameManager.game[translations.camera_][translations.pointToScreen_]({
      x: player[translations.visualPos_].x,
      y: player[translations.visualPos_].y,
    });

    const distance = getDistance(
      screenPos.x,
      screenPos.y,
      gameManager.game[translations.input_].mousePos._x,
      gameManager.game[translations.input_].mousePos._y
    );

    if (distance > fovRadiusSquared) continue;
    const screenDistance = Math.sqrt(distance);
    const distanceFactor = Math.exp(-screenDistance / 120);
    const isCurrent = player === state.currentEnemy_;
    const continuityBonus = isCurrent ? 0.02 : 0;
    
    // Simple final score (no shootability check - aim at all enemies equally)
    const score = distanceFactor + continuityBonus;

    if (score > bestScore) {
      bestScore = score;
      bestTarget = player;
    }
  }

  return bestTarget;
}

function findClosestTarget(players, me) {
  const meTeam = findTeam(me);
  const isLocalOnBypassLayer = isBypassLayer(me.layer);
  const localLayer = getLocalLayer(me);
  let enemy = null;
  let minDistance = Infinity;

  for (const player of players) {
    if (!player.active) continue;
    if (player[translations.netData_][translations.dead_]) continue;
    if (!settings.aimbot_.targetKnocked_ && player.downed) continue;
    if (me.__id === player.__id) continue;
    if (!meetsLayerCriteria(player.layer, localLayer, isLocalOnBypassLayer)) continue;
    
    // Skip teammates unless melee attackAllies or aimbot aimAllies is enabled
    if (findTeam(player) === meTeam && !(settings.meleeLock_.attackAllies_ || settings.aimbot_.aimAllies_)) continue;

    const mePos = me[translations.visualPos_];
    const playerPos = player[translations.visualPos_];
    const distance = getDistance(mePos.x, mePos.y, playerPos.x, playerPos.y);

    if (distance < minDistance) {
      minDistance = distance;
      enemy = player;
    }
  }

  return enemy;
}

function isLootTargetable(lootObject) {
  // Check if object is a valid loot item to target
  if (!lootObject || lootObject.dead) return false;
  if (!lootObject.collider) return false;
  if (lootObject.layer === undefined) return false;
  
  const objectType = lootObject.type || '';
  
  // List of loot items we can shoot
  const LOOT_PATTERNS = [
    'crate_',
    'chest_',
    'barrel_',
    'bookshelf_',
    'drawers_',
    'locker_',
    'deposit_box_',
    'refrigerator_',
    'control_panel_',
    'case_',
    'oven_',
    'bed_',
    'couch_',
    'table_',
    'window',
    'pot_',
    'planter_',
  ];
  
  return LOOT_PATTERNS.some(pattern => objectType.includes(pattern));
}

function findMeleeLootTarget(me) {
  // Find closest destructible loot object for melee targeting
  if (!settings.meleeLock_.enabled_) return null;
  
  const game = gameManager.game;
  const idToObj = game?.[translations.objectCreator_]?.[translations.idToObj_];
  if (!idToObj) return null;
  
  const mePos = me[translations.visualPos_];
  const isLocalOnBypassLayer = isBypassLayer(me.layer);
  const localLayer = getLocalLayer(me);
  const meleeLockDistance = MELEE_ENGAGE_DISTANCE + MELEE_LOCK_HYSTERESIS;
  
  let bestLoot = null;
  let bestDistance = Infinity;
  
  for (const obj of Object.values(idToObj)) {
    if (!isLootTargetable(obj)) continue;
    
    // Check layer compatibility
    if (obj.layer !== undefined && !meetsLayerCriteria(obj.layer, localLayer, isLocalOnBypassLayer)) {
      continue;
    }
    
    const objPos = obj[translations.visualPos_];
    if (!objPos) continue;
    
    // Calculate distance in game space
    const distance = Math.hypot(mePos.x - objPos.x, mePos.y - objPos.y);
    
    // Only consider objects within melee range
    if (distance > meleeLockDistance) continue;
    
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLoot = obj;
    }
  }
  
  return bestLoot;
}

function findLootTarget(me) {
  if (!settings.aimbot_.enabled_) return null;
  
  const game = gameManager.game;
  const idToObj = game?.[translations.objectCreator_]?.[translations.idToObj_];
  if (!idToObj) return null;
  
  const mePos = me[translations.visualPos_];
  const isLocalOnBypassLayer = isBypassLayer(me.layer);
  const localLayer = getLocalLayer(me);
  const fovRadiusSquared = settings.aimbot_.fov_ ** 2;
  
  let bestLoot = null;
  let bestScore = -Infinity;
  
  for (const obj of Object.values(idToObj)) {
    if (!isLootTargetable(obj)) continue;
    
    // Check layer compatibility
    if (obj.layer !== undefined && !meetsLayerCriteria(obj.layer, localLayer, isLocalOnBypassLayer)) {
      continue;
    }
    
    const objPos = obj[translations.visualPos_];
    if (!objPos) continue;
    
    // Get screen position
    const screenPos = gameManager.game[translations.camera_][translations.pointToScreen_]({
      x: objPos.x,
      y: objPos.y,
    });
    
    const distance = getDistance(
      screenPos.x,
      screenPos.y,
      gameManager.game[translations.input_].mousePos._x,
      gameManager.game[translations.input_].mousePos._y
    );
    
    // Must be within FOV
    if (distance > fovRadiusSquared) continue;
    
    // Calculate distance in game space
    const gameDist = getDistance(mePos.x, mePos.y, objPos.x, objPos.y);
    const screenDistance = Math.sqrt(distance);
    
    // Simple scoring: prefer closer loot items
    const score = -screenDistance + (gameDist < 100 ? 50 : 0); // Boost nearby items
    
    if (score > bestScore) {
      bestScore = score;
      bestLoot = obj;
    }
  }
  
  return bestLoot;
}
function isTargetingAlly(me) {
  if (!state.currentEnemy_ || !me) return false;
  const meTeam = findTeam(me);
  const targetTeam = findTeam(state.currentEnemy_);
  return meTeam === targetTeam;
}

function aimbotTicker() {
  try {
    const game = gameManager.game;
    if (
      !game.initialized ||
      !(settings.aimbot_.enabled_ || settings.meleeLock_.enabled_) ||
      game[translations.uiManager_].spectating
    ) {
      setAimState(new AimState('idle'));
      aimOverlays.updateHUD(null);
      state.lastTargetScreenPos_ = null;
      return;
    }

    const players = game[translations.playerBarn_].playerPool[translations.pool_];
    const me = game[translations.activePlayer_];
    const isLocalOnBypassLayer = isBypassLayer(me.layer);
    let aimUpdated = false;
    let dotTargetPos = null;
    let previewTargetPos = null;
    let isDotTargetShootable = false;
    
    // Check for grenades if anti-explosion is enabled
    const now = performance.now();
    if (settings.meleeLock_.antiExplosion_ && now - state.lastGrenadeCheckTime_ > ANTI_GRENADE_CHECK_INTERVAL) {
      const grenades = findGrenades(me);
      state.nearestGrenade_ = grenades.length > 0 ? grenades[0] : null;
      state.lastGrenadeCheckTime_ = now;
      
      // Calculate evasion direction if needed
      if (grenades.length > 0) {
        const mePos = me[translations.visualPos_];
        state.grenadeEvasionAngle_ = getGrenadeEvasionDirection(grenades, mePos);
      } else {
        state.grenadeEvasionAngle_ = null;
      }
    }

    try {
      const currentWeaponIndex =
        game[translations.activePlayer_][translations.localData_][translations.curWeapIdx_];
      const isMeleeEquipped = currentWeaponIndex === 2;
      const isGrenadeEquipped = currentWeaponIndex === 3;
      const isAiming = game[translations.inputBinds_].isBindDown(inputCommands.Fire_);
      
      const isGrenadeCooking = isGrenadeEquipped && isAiming;
      const hasEnemyNearby = state.currentEnemy_ && 
        state.currentEnemy_.active && 
        !state.currentEnemy_[translations.netData_][translations.dead_];
      
      // In blatant mode, aim automatically without clicking. Otherwise require clicking or automatic mode
      const shouldAim = settings.aimbot_.blatant_ || isAiming || (settings.aimbot_.automatic_ && hasEnemyNearby);
      
      const wantsMeleeLock = settings.meleeLock_.enabled_ && 
        (settings.aimbot_.automatic_ || isAiming);
      
      // Anti-grenade: Check for nearby grenades
      const mePos = me[translations.visualPos_];
      const nearbyGrenades = findNearbyGrenades(mePos, me.layer);
      const grenadeEvadeDir = calculateGrenadeEvadeDirection(mePos, nearbyGrenades);
      const shouldEvadeGrenade = grenadeEvadeDir !== null;

      let meleeEnemy = state.meleeLockEnemy_;
      if (wantsMeleeLock) {
        let targetStillValid = false;
        if (meleeEnemy) {
          // Check both if the target is still valid AND if we should stick with it (hysteresis)
          if (meleeEnemy.active !== undefined) {
            targetStillValid = meleeEnemy.active && !meleeEnemy[translations.netData_]?.[translations.dead_];
          } else {
            targetStillValid = !meleeEnemy.dead;
          }
          
          // Apply hysteresis to prevent rapid target switching
          if (targetStillValid && state.meleeLockTargetId_ === meleeEnemy.__id) {
            // Same target - check if it's still in reasonable range
            const mePos = me[translations.visualPos_];
            const enemyPos = meleeEnemy[translations.visualPos_];
            const distance = Math.hypot(mePos.x - enemyPos.x, mePos.y - enemyPos.y);
            const hysteresisDistance = MELEE_DETECTION_DISTANCE + MELEE_LOCK_HYSTERESIS * 2;
            
            targetStillValid = distance <= hysteresisDistance;
          }
        }
        
        if (!targetStillValid) {
          meleeEnemy = findClosestTarget(players, me);
          if (!meleeEnemy) {
            const lootTarget = findMeleeLootTarget(me);
            if (lootTarget) {
              meleeEnemy = lootTarget;
            }
          }
          
          state.meleeLockEnemy_ = meleeEnemy;
          state.meleeLockTargetId_ = meleeEnemy?.__id || null;
          state.meleeLockStartTime_ = meleeEnemy ? performance.now() : null;
        }
      } else {
        meleeEnemy = null;
        state.meleeLockEnemy_ = null;
        state.meleeLockTargetId_ = null;
        state.meleeLockStartTime_ = null;
      }

      let distanceToMeleeEnemy = Infinity;
      let predictedMeleePos = null;
      let isMeleeLootTarget = false;
      
      if (meleeEnemy) {
        const mePos = me[translations.visualPos_];
        const enemyPos = meleeEnemy[translations.visualPos_];
        
        // Calculate base distance
        distanceToMeleeEnemy = Math.hypot(mePos.x - enemyPos.x, mePos.y - enemyPos.y);
        
        // Check if this is a loot object vs a player
        // Players have 'active' property, loot objects don't
        isMeleeLootTarget = meleeEnemy.active === undefined;
        
        // Use improved prediction for moving targets (players only, not loot)
        if (!isMeleeLootTarget) {
          predictedMeleePos = predictMeleePosition(meleeEnemy, me, distanceToMeleeEnemy);
        } else {
          predictedMeleePos = enemyPos;
        }
      }

      // Improved: Extended detection range + hysteresis for smoother engagement
      const adaptiveEngageDistance = meleeEnemy ? getAdaptiveMeleeDistance(meleeEnemy) : MELEE_ENGAGE_DISTANCE;
      const meleeTargetInRange = distanceToMeleeEnemy <= adaptiveEngageDistance + MELEE_LOCK_HYSTERESIS;
      const meleeTargetDetected = distanceToMeleeEnemy <= MELEE_DETECTION_DISTANCE + MELEE_LOCK_HYSTERESIS;
      
      // In blatant mode with auto melee, extend detection range significantly
      // This allows auto-switch to happen from further away
      const blatantMeleeDistance = MELEE_DETECTION_DISTANCE * 1.5; // ~11 units instead of 7.5
      const isBlatantMeleeRange = settings.aimbot_.blatant_ && 
        settings.meleeLock_.autoMelee_ && 
        distanceToMeleeEnemy <= blatantMeleeDistance;

      // Auto-switch to melee if enabled and target in range
      if (
        wantsMeleeLock &&
        settings.meleeLock_.autoMelee_ &&
        !isMeleeEquipped &&
        (meleeTargetInRange || isBlatantMeleeRange) &&
        meleeEnemy
      ) {
        queueInput(inputCommands.EquipMelee_);
        state.isSwitchingToMelee_ = true; // Mark that we're switching to melee
      }

      // Reset flag if we already have melee equipped or target is out of range
      if (isMeleeEquipped || (!meleeTargetInRange && !isBlatantMeleeRange)) {
        state.isSwitchingToMelee_ = false;
      }

      // Melee lock is active if: wants melee, has enemy/loot in range, target is valid
      // Also allow engagement if we just queued melee switch and are waiting for it to complete
      const meleeLockActive = wantsMeleeLock && (meleeTargetInRange || isBlatantMeleeRange) && meleeEnemy && 
        (isMeleeEquipped || state.isSwitchingToMelee_);

      if (meleeLockActive) {
        const mePos = me[translations.visualPos_];
        const enemyPos = meleeEnemy[translations.visualPos_];
        
        // Use predicted position if available, otherwise use current position
        const targetPos = predictedMeleePos || enemyPos;

        const weapon = findWeapon(me);
        const bullet = findBullet(weapon);
        
        // Loot objects don't need wallcheck - they're always shootable
        // For enemies, check wallcheck setting
        let isMeleeTargetShootable = isMeleeLootTarget;
        if (!isMeleeTargetShootable) {
          isMeleeTargetShootable = !settings.aimbot_.wallcheck_ || canCastToPlayer(me, meleeEnemy, weapon, bullet);
        }

        if (isMeleeTargetShootable) {
          // Improved: Calculate movement direction to intercept predicted position
          // Move TOWARDS the enemy, not away from them
          const moveAngle = calcAngle(mePos, targetPos); // Direction FROM player TO target
          
          // Get target velocity for intelligent movement prediction
          const history = state.meleeVelocityHistory_[meleeEnemy.__id];
          const targetVelMag = history ? Math.hypot(history.lastVelocity.x, history.lastVelocity.y) : 0;
          
          // For fast-moving targets, slightly lead the movement angle
          let adjustedAngle = moveAngle;
          if (targetVelMag > 150) {
            // Calculate where enemy is heading
            const enemyHeadingAngle = Math.atan2(history.lastVelocity.y, history.lastVelocity.x);
            
            // Small leading adjustment (max 15 degrees for safety)
            const leadFactor = Math.min(0.15, targetVelMag / 2000);
            adjustedAngle = moveAngle + (enemyHeadingAngle - moveAngle) * leadFactor;
          }
          
          let finalMoveAngle = adjustedAngle;
          
          // Anti-explosion: Override movement if critical danger
          if (settings.meleeLock_.antiExplosion_ && nearbyGrenades.length > 0) {
            // Check if any grenade is in immediate danger zone
            for (const grenade of nearbyGrenades) {
              if (grenade.distance <= GRENADE_EXPLOSION_RADIUS * 0.8) {
                // CRITICAL: Inside explosion radius - evade immediately
                finalMoveAngle = grenadeEvadeDir;
                break;
              }
            }
          }
          
          const moveDir = {
            touchMoveActive: true,
            touchMoveLen: 255,
            x: Math.cos(finalMoveAngle),
            y: Math.sin(finalMoveAngle),
          };

          const screenPos = game[translations.camera_][translations.pointToScreen_]({
            x: targetPos.x,
            y: targetPos.y,
          });
          
          // AutoAttack (surviv-cheat style): Auto-fire melee when in range
          // Fire continuously when melee equipped and in engage distance
          if (settings.meleeLock_.autoAttack_ && isMeleeEquipped && distanceToMeleeEnemy < MELEE_ENGAGE_DISTANCE) {
            // Simulate continuous fire for melee
            inputState.queuedInputs_.push(inputCommands.Fire_);
          }
          
          setAimState(new AimState('meleeLock', { x: screenPos.x, y: screenPos.y }, moveDir, true));
          aimUpdated = true;
          aimOverlays.hideAll();
          state.lastTargetScreenPos_ = null;
          return;
        }
      }

      // Improved: More gradual target loss with detection range
      if (wantsMeleeLock && !meleeTargetDetected) {
        state.meleeLockEnemy_ = null;
      }

      // Disable regular aiming when melee is equipped or melee lock is active
      // Also disable if grenade equipped without cooking
      if (!settings.aimbot_.enabled_ || isMeleeEquipped || meleeLockActive || (isGrenadeEquipped && !isGrenadeCooking)) {
        setAimState(new AimState('idle'));
        aimOverlays.hideAll();
        state.lastTargetScreenPos_ = null;
        return;
      }

      const canEngageAimbot = shouldAim;

      let enemy =
        state.focusedEnemy_?.active &&
          !state.focusedEnemy_[translations.netData_][translations.dead_]
          ? state.focusedEnemy_
          : null;

      if (enemy) {
        const localLayer = getLocalLayer(me);
        if (!meetsLayerCriteria(enemy.layer, localLayer, isLocalOnBypassLayer)) {
          enemy = null;
          state.focusedEnemy_ = null;
          setAimState(new AimState('idle', null, null, true));
        }
      }

      if (!enemy) {
        if (state.focusedEnemy_) {
          state.focusedEnemy_ = null;
          setAimState(new AimState('idle', null, null, true));
        }
        enemy = findTarget(players, me);
        state.currentEnemy_ = enemy;
      }

      if (enemy) {
        const mePos = me[translations.visualPos_];
        const enemyPos = enemy[translations.visualPos_];
        const distanceToEnemy = Math.hypot(mePos.x - enemyPos.x, mePos.y - enemyPos.y);

        if (enemy !== state.currentEnemy_ && !state.focusedEnemy_) {
          state.currentEnemy_ = enemy;
          state.previousEnemies_[enemy.__id] = [];
          state.velocityBuffer_[enemy.__id] = [];
        }

        const predictedPos = predictPosition(enemy, me);
        if (!predictedPos) {
          setAimState(new AimState('idle'));
          aimOverlays.hideAll();
          state.lastTargetScreenPos_ = null;
          return;
        }

        previewTargetPos = { x: predictedPos.x, y: predictedPos.y };

        const weapon = findWeapon(me);
        const bullet = findBullet(weapon);
        const bulletRange = bullet?.distance || Infinity;

        // Check if target is within bullet range
        // Blatant mode: aim regardless of walls. Otherwise check shootability
        const canAimAtTarget = distanceToEnemy <= bulletRange &&
          (settings.aimbot_.blatant_ || !settings.aimbot_.wallcheck_ || canCastToPlayer(me, enemy, weapon, bullet));
        
        // For actual shooting, ALWAYS check if target is truly shootable (not blocked by walls)
        // AutoFire must always respect actual walls regardless of wallcheck setting
        const isTargetShootable =
          distanceToEnemy <= bulletRange &&
          canCastToPlayer(me, enemy, weapon, bullet);
        
        // Update state for AutoFire to check
        state.isCurrentEnemyShootable_ = isTargetShootable;
        
        // Calculate direction and target info for HUD
        const dx = enemyPos.x - mePos.x;
        const dy = enemyPos.y - mePos.y;
        const direction = Math.atan2(dy, dx);
        const targetName = enemy.nameText?._text || enemy.name || 'Unknown';
        
        // Get equipment levels from netData
        const netData = enemy[translations.netData_];
        const gameObjs = gameManager.game?.gameObjects || {};
        
        // Extract equipment type names from netData directly
        // These properties are in the netData object (m_helmet, m_chest, m_backpack)
        const helmetType = netData?.m_helmet || '';
        const chestType = netData?.m_chest || '';
        const backpackType = netData?.m_backpack || 'backpack00';
        
        // Look up levels from gameObjects definitions
        const helmetLevel = (helmetType && gameObjs[helmetType]?.level) ? gameObjs[helmetType].level : 0;
        const chestLevel = (chestType && gameObjs[chestType]?.level) ? gameObjs[chestType].level : 0;
        const bagLevel = (backpackType && gameObjs[backpackType]?.level) ? gameObjs[backpackType].level : 0;
        
        const targetInfo = {
          direction,
          targetName,
          targetPos: enemyPos,
          distance: distanceToEnemy,
          helmetLevel,
          chestLevel,
          bagLevel,
        };

        if (
          canEngageAimbot &&
          (settings.aimbot_.enabled_ || (settings.meleeLock_.enabled_ && distanceToEnemy <= 8))
        ) {
          if (canAimAtTarget) {
            setAimState(
              new AimState('aimbot', { x: predictedPos.x, y: predictedPos.y }, null, true)
            );
            state.lastTargetScreenPos_ = { x: predictedPos.x, y: predictedPos.y };
            aimUpdated = true;
            const aimSnapshot = aimState.lastAimPos_;
            dotTargetPos = aimSnapshot
              ? { x: aimSnapshot.clientX, y: aimSnapshot.clientY }
              : { x: predictedPos.x, y: predictedPos.y };
            isDotTargetShootable = isTargetShootable;
          } else {
            dotTargetPos = { x: predictedPos.x, y: predictedPos.y };
            isDotTargetShootable = false;
          }
        } else {
          dotTargetPos = { x: predictedPos.x, y: predictedPos.y };
          isDotTargetShootable = isTargetShootable;
        }
        
        aimOverlays.updateHUD(targetInfo);
      } else {
        // No enemy found, try to target loot items
        aimOverlays.updateHUD(null);
        const lootTarget = findLootTarget(me);
        if (lootTarget) {
          state.currentLootTarget_ = lootTarget; // Track loot target for AutoSwitch
          
          const lootPos = lootTarget[translations.visualPos_];
          const lootScreenPos = gameManager.game[translations.camera_][translations.pointToScreen_]({
            x: lootPos.x,
            y: lootPos.y,
          });
          
          const distanceToLoot = Math.hypot(lootPos.x - mePos.x, lootPos.y - mePos.y);
          
          if (canEngageAimbot && settings.aimbot_.enabled_) {
            const weapon = findWeapon(me);
            const bullet = findBullet(weapon);
            const bulletRange = bullet?.distance || Infinity;
            
            // Check if loot is within bullet range
            // Blatant mode: aim regardless of walls. Otherwise check shootability
            const canAimAtLoot = distanceToLoot <= bulletRange &&
              (settings.aimbot_.blatant_ || !settings.aimbot_.wallcheck_ || canCastToPlayer(me, lootTarget, weapon, bullet));
            
            const isLootShootable = distanceToLoot <= bulletRange &&
              canCastToPlayer(me, lootTarget, weapon, bullet);
            
            if (canAimAtLoot) {
              setAimState(
                new AimState('aimbot', { x: lootScreenPos.x, y: lootScreenPos.y }, null, true)
              );
              state.lastTargetScreenPos_ = { x: lootScreenPos.x, y: lootScreenPos.y };
              aimUpdated = true;
              const aimSnapshot = aimState.lastAimPos_;
              dotTargetPos = aimSnapshot
                ? { x: aimSnapshot.clientX, y: aimSnapshot.clientY }
                : { x: lootScreenPos.x, y: lootScreenPos.y };
              isDotTargetShootable = isLootShootable;
              previewTargetPos = { x: lootScreenPos.x, y: lootScreenPos.y };
            } else {
              dotTargetPos = { x: lootScreenPos.x, y: lootScreenPos.y };
              isDotTargetShootable = false;
              previewTargetPos = { x: lootScreenPos.x, y: lootScreenPos.y };
            }
          }
        } else {
          state.currentLootTarget_ = null;
        }
        
        if (!aimUpdated) {
          previewTargetPos = null;
          dotTargetPos = null;
        }
      }

      if (!aimUpdated) {
        // Check for grenade auto-evasion even when not aiming
        if (settings.meleeLock_.antiExplosion_ && nearbyGrenades.length > 0 && grenadeEvadeDir !== null) {
          // Check if in danger zone
          let inDangerZone = false;
          for (const grenade of nearbyGrenades) {
            if (grenade.distance <= GRENADE_SAFE_DISTANCE) {
              inDangerZone = true;
              break;
            }
          }
          
          if (inDangerZone) {
            const evadeDir = {
              touchMoveActive: true,
              touchMoveLen: 255,
              x: Math.cos(grenadeEvadeDir),
              y: Math.sin(grenadeEvadeDir),
            };
            
            setAimState(new AimState('idle', null, evadeDir, true));
            aimOverlays.hideAll();
            state.lastTargetScreenPos_ = null;
            return;
          }
        }
        
        setAimState(new AimState('idle'));
        state.lastTargetScreenPos_ = previewTargetPos
          ? { x: previewTargetPos.x, y: previewTargetPos.y }
          : null;
      }
      let displayPos = dotTargetPos;
      if (!displayPos && previewTargetPos) {
        displayPos = { x: previewTargetPos.x, y: previewTargetPos.y };
      }
      aimOverlays.updateDot(displayPos, isDotTargetShootable, !!state.focusedEnemy_);

    } catch (error) {
      aimOverlays.hideAll();
      setAimState(new AimState('idle', null, null, true));
      state.meleeLockEnemy_ = null;
      state.focusedEnemy_ = null;
      state.currentEnemy_ = null;
      state.lastTargetScreenPos_ = null;
    }
  } catch (error) {
    setAimState(new AimState({ mode: 'idle', immediate: true }));
    state.lastTargetScreenPos_ = null;
  }
}

export default function () {
  const startTicker = () => {
    const uiRoot = getUIRoot();
    if (aimOverlays.ensureInitialized(uiRoot)) {
      if (!tickerAttached) {
        gameManager.pixi._ticker.add(aimbotTicker);
        tickerAttached = true;
      }
    } else {
      requestAnimationFrame(startTicker);
    }
  };

  startTicker();
}

export function hasValidTarget() {
  return state.currentEnemy_ && 
    state.currentEnemy_.active && 
    !state.currentEnemy_[translations.netData_][translations.dead_];
}

export function getAimbotShootableState() {
  return state.isCurrentEnemyShootable_;
}

export function isTargetingLoot() {
  return state.currentLootTarget_ !== null;
}
