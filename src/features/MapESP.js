/**
 * MapESP - Show all players on map as red dots
 * Shows all alive players on map regardless of visibility or distance
 * Similar to MapHighlights but for players instead of objects
 */

import { gameManager } from '@/core/state.js';
import { settings } from '@/core/state.js';
import { translations } from '@/core/obfuscatedNameTranslator.js';

const PLAYER_DOT_SCALE = 0.35; // Size of player dots on map
const PLAYER_DOT_COLOR = 0xff3333; // Red color for enemy players
const ALLY_DOT_COLOR = 0x4da6ff; // Blue color for allies
const DEAD_PLAYER_COLOR = 0x666666; // Gray for dead players

export default function () {
  try {
    const game = gameManager.game;
    if (!game || !game.initialized) return;

    // Store reference to track created indicators
    let createdPlayerIndicators = {};

    // Hook into the map update to render player dots
    const uiManager = game[translations.uiManager_];
    if (!uiManager) return;

    const mapIndicatorBarn = uiManager.mapIndicatorBarn;
    if (!mapIndicatorBarn) return;

    // Store original update method
    const originalUpdateIndicatorData = mapIndicatorBarn.updateIndicatorData.bind(mapIndicatorBarn);

    // Override updateIndicatorData to add player indicators
    mapIndicatorBarn.updateIndicatorData = function (indicatorData) {
      // Call original method first
      originalUpdateIndicatorData(indicatorData);

      // Now add player-based indicators if MapESP is enabled
      if (!settings.mapESP_?.enabled_) return;

      const playerBarn = game[translations.playerManager_] || game[translations.playerBarn_];
      if (!playerBarn) return;

      const players = playerBarn.m_getPool?.() || playerBarn.playerPool?.[translations.pool_] || [];
      const activePlayer = game[translations.activePlayer_];
      
      if (!players || !activePlayer) return;

      const newPlayerIndicators = {};

      // Create/update indicator for each player
      for (const player of players) {
        if (!player || !player.active) continue;
        if (player.__id === activePlayer.__id) continue; // Skip self
        
        // Skip dead players
        const isDead = player[translations.netData_]?.[translations.dead_];
        if (isDead) continue;

        const playerId = player.__id;
        newPlayerIndicators[playerId] = true;

        // Get or create indicator
        let indicator = this.idToMapIdicator[playerId];
        
        if (!indicator) {
          // Create new indicator
          indicator = {
            id: playerId,
            type: 'player_' + playerId, // Unique type identifier
            pos: { x: player[translations.visualPos_]?.x || 0, y: player[translations.visualPos_]?.y || 0 },
            equipped: false,
            mapSprite: this.mapSpriteBarn.addSprite(),
            pulseSprite: this.mapSpriteBarn.addSprite(),
            pulseScale: 0.5,
            pulseScaleMin: 0.5,
            pulseScaleMax: 1,
            pulseTicker: 0,
            pulseDir: 1,
            pulseSpeed: 0.3,
            isPlayerIndicator: true, // Mark as player indicator
          };
          
          this.mapIndicators.push(indicator);
          this.idToMapIdicator[playerId] = indicator;
        }

        // Update position and appearance
        const visualPos = player[translations.visualPos_];
        if (visualPos) {
          indicator.pos.x = visualPos.x;
          indicator.pos.y = visualPos.y;
          indicator.mapSprite.pos.x = visualPos.x;
          indicator.mapSprite.pos.y = visualPos.y;
          indicator.pulseSprite.pos.x = visualPos.x;
          indicator.pulseSprite.pos.y = visualPos.y;
        }

        // Determine color based on team/status
        const meTeam = game[translations.activePlayer_]?.[translations.netData_]?.[translations.teamId_];
        const playerTeam = player[translations.netData_]?.[translations.teamId_];
        const isSameTeam = meTeam && playerTeam && meTeam === playerTeam;

        let dotColor = isSameTeam ? ALLY_DOT_COLOR : PLAYER_DOT_COLOR;

        // Create simple circle sprite for player dot
        if (!indicator.mapSprite.sprite.texture || indicator.mapSprite.sprite._texture === undefined) {
          // Create a simple circle texture if not exists
          const graphics = new (game.m_renderer?.m_pixi?.Graphics_ || window.PIXI?.Graphics)();
          graphics.beginFill(dotColor);
          graphics.drawCircle(0, 0, 8);
          graphics.endFill();
          
          const texture = graphics.generateCanvasTexture();
          indicator.mapSprite.sprite.texture = texture;
        }

        indicator.mapSprite.scale = PLAYER_DOT_SCALE;
        indicator.mapSprite.alpha = 1;
        indicator.mapSprite.zOrder = 655350;
        indicator.mapSprite.visible = true;
        indicator.mapSprite.sprite.tint = dotColor;

        // Setup pulse sprite
        if (indicator.pulseSprite.sprite) {
          indicator.pulseSprite.pos.x = indicator.pos.x;
          indicator.pulseSprite.pos.y = indicator.pos.y;
          indicator.pulseSprite.scale = 1;
          indicator.pulseSprite.zOrder = 655349;
          indicator.pulseSprite.visible = true;
          indicator.pulseSprite.alpha = 0.5;
        }
      }

      // Remove indicators for players that no longer exist
      for (const id in createdPlayerIndicators) {
        if (!newPlayerIndicators[id]) {
          const indicator = this.idToMapIdicator[id];
          if (indicator && indicator.isPlayerIndicator) {
            this.removeIndicator(id);
          }
        }
      }

      createdPlayerIndicators = newPlayerIndicators;
    };

    // Also hook the frame update to ensure visibility
    const originalUpdateIndicatorPulses = mapIndicatorBarn.updateIndicatorPulses?.bind(mapIndicatorBarn);
    if (originalUpdateIndicatorPulses) {
      mapIndicatorBarn.updateIndicatorPulses = function (dt) {
        originalUpdateIndicatorPulses(dt);

        if (!settings.mapESP_?.enabled_) return;

        // Force visibility for all player indicators
        for (const indicator of this.mapIndicators) {
          if (indicator.isPlayerIndicator) {
            if (indicator.mapSprite) {
              indicator.mapSprite.visible = true;
              indicator.mapSprite.alpha = 1;
            }
            if (indicator.pulseSprite) {
              indicator.pulseSprite.visible = true;
            }
          }
        }
      };
    }

  } catch (error) {
    console.error('[MapESP] Error:', error);
  }
}

