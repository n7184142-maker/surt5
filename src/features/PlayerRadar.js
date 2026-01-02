/**
 * PlayerRadar - Show all player positions from network data
 * Exploits the fact that server sends ALL player positions in PlayerStatus updates
 * Even though some have visible=false, the position data is still transmitted
 */

import { gameManager } from '@/core/state.js';
import { settings } from '@/core/state.js';
import { translations } from '@/core/obfuscatedNameTranslator.js';
import { hook } from '@/core/hook.js';

const RADAR_DOT_SCALE = 0.25;
const RADAR_ENEMY_COLOR = 0xff3333; // Red
const RADAR_ALLY_COLOR = 0x4da6ff; // Blue
const RADAR_DOWNED_COLOR = 0xffaa00; // Orange

let hooked = false;

export default function () {
  try {
    const game = gameManager.game;
    if (!game || !game.initialized || hooked) return;

    const uiManager = game[translations.uiManager_];
    if (!uiManager) return;

    hooked = true;

    // Hook updatePlayerStatus directly
    if (uiManager.updatePlayerStatus) {
      const originalUpdatePlayerStatus = uiManager.updatePlayerStatus.bind(uiManager);
      
      uiManager.updatePlayerStatus = function (playerStatuses) {
        // Call original
        const result = originalUpdatePlayerStatus(playerStatuses);
        
        // Add radar indicators if enabled
        if (settings.playerRadar_?.enabled_ && playerStatuses && Array.isArray(playerStatuses)) {
          createRadarIndicators(playerStatuses, uiManager, game);
        }
        
        return result;
      };
    }

    function createRadarIndicators(playerStatuses, uiManager, game) {
      try {
        const mapIndicatorBarn = uiManager.mapIndicatorBarn;
        if (!mapIndicatorBarn) return;

        const activePlayer = game[translations.activePlayer_];
        if (!activePlayer) return;

        const newIndicatorIds = new Set();
        const PIXI = game.m_renderer?.m_pixi;

        // Process each player status
        for (let i = 0; i < playerStatuses.length; i++) {
          const status = playerStatuses[i];
          
          // Skip if no data
          if (!status || !status.hasData || !status.pos) continue;
          
          // Generate unique ID (use index as fallback)
          const radarId = 'radar_' + i;
          newIndicatorIds.add(radarId);

          // Get or create indicator
          let indicator = mapIndicatorBarn.idToMapIdicator[radarId];
          
          if (!indicator) {
            // Create new radar indicator
            indicator = {
              id: radarId,
              type: 'radar_player_' + i,
              pos: { x: status.pos.x || 0, y: status.pos.y || 0 },
              equipped: false,
              mapSprite: mapIndicatorBarn.mapSpriteBarn.addSprite(),
              pulseSprite: mapIndicatorBarn.mapSpriteBarn.addSprite(),
              pulseScale: 0.5,
              pulseScaleMin: 0.5,
              pulseScaleMax: 1,
              pulseTicker: 0,
              pulseDir: 1,
              pulseSpeed: 0.3,
              isRadarIndicator: true,
            };

            mapIndicatorBarn.mapIndicators.push(indicator);
            mapIndicatorBarn.idToMapIdicator[radarId] = indicator;
          }

          // Update position
          indicator.pos.x = status.pos.x;
          indicator.pos.y = status.pos.y;
          indicator.mapSprite.pos.x = status.pos.x;
          indicator.mapSprite.pos.y = status.pos.y;
          indicator.pulseSprite.pos.x = status.pos.x;
          indicator.pulseSprite.pos.y = status.pos.y;

          // Determine color based on status
          let dotColor = RADAR_ENEMY_COLOR;
          if (status.downed) {
            dotColor = RADAR_DOWNED_COLOR;
          } else if (status.visible === false) {
            dotColor = 0xcc0000; // Dimmer red for hidden
          }

          // Create simple circle sprite if needed
          if (!indicator.mapSprite.sprite || !indicator.mapSprite.sprite.texture) {
            if (PIXI && PIXI.Graphics_) {
              try {
                const graphics = new PIXI.Graphics_();
                graphics.beginFill(dotColor);
                graphics.drawCircle(0, 0, 5);
                graphics.endFill();
                
                if (graphics.generateCanvasTexture) {
                  const texture = graphics.generateCanvasTexture();
                  if (texture && indicator.mapSprite.sprite) {
                    indicator.mapSprite.sprite.texture = texture;
                  }
                }
              } catch (e) {
                // Fallback: just use white if texture creation fails
              }
            }
          }

          // Update sprite properties
          if (indicator.mapSprite.sprite) {
            indicator.mapSprite.scale = RADAR_DOT_SCALE;
            indicator.mapSprite.alpha = status.visible ? 1 : 0.6;
            indicator.mapSprite.zOrder = 655340;
            indicator.mapSprite.visible = true;
            indicator.mapSprite.sprite.tint = dotColor;
          }

          // Update pulse
          if (indicator.pulseSprite && indicator.pulseSprite.sprite) {
            indicator.pulseSprite.scale = 0.5;
            indicator.pulseSprite.zOrder = 655339;
            indicator.pulseSprite.visible = false; // Hide pulse for radar
            indicator.pulseSprite.alpha = 0;
          }
        }

        // Clean up old indicators - keep it simple
        const indicatorsToRemove = [];
        for (let i = 0; i < mapIndicatorBarn.mapIndicators.length; i++) {
          const indicator = mapIndicatorBarn.mapIndicators[i];
          if (indicator.isRadarIndicator && !newIndicatorIds.has(indicator.id)) {
            indicatorsToRemove.push(indicator.id);
          }
        }

        for (const id of indicatorsToRemove) {
          mapIndicatorBarn.removeIndicator(id);
        }

      } catch (error) {
        // Silent fail
      }
    }

  } catch (error) {
    // Silent fail
  }
}
