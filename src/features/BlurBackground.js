import { outer, outerDocument } from '@/core/outer.js';
import { settings } from '@/core/state.js';

const STYLE_ID = 'surt-blur-start-overlay';
const CSS_CONTENT = `
#start-overlay {
  backdrop-filter: blur(10px) brightness(0.9);
  -webkit-backdrop-filter: blur(10px) brightness(0.9);
}
#btn-game-quit {
  /* Ensure URL is quoted and provide sensible sizing */
  background-image: url("../img/gui/quit.svg") !important;
  background-repeat: no-repeat !important;
  background-size: contain !important;
}
#news-block {
  opacity: 0 !important;
  transition: 0.3s !important;
}
#news-block:hover {
  opacity: 1 !important;
}
#ad-block-left, #social-share-block, #start-bottom-middle .footer-after, #start-bottom-middle {
  pointer-events: none !important;
  opacity: 0 !important;
}
#start-row-header{
  background-image:url("https://i.postimg.cc/3JYQFmX0/image.png");
}

/* Enhanced Glass-style stats */
.surt-stat {
  display: block;
  margin-bottom: 6px;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1;
  border-radius: 12px;
  color: #ffffff;
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
  border: 1px solid rgba(255,255,255,0.18);
  box-shadow: 
    0 8px 24px rgba(0,0,0,0.5),
    inset 0 1px 0 rgba(255,255,255,0.15);
  backdrop-filter: blur(12px) saturate(180%) brightness(1.1);
  -webkit-backdrop-filter: blur(12px) saturate(180%) brightness(1.1);
  text-shadow: 0 2px 4px rgba(0,0,0,0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateZ(0);
  overflow: hidden;
  position: relative;
}

/* Glass edge highlight */
.surt-stat::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent, 
    rgba(255,255,255,0.3), 
    transparent);
  z-index: 1;
}

.surt-stat:hover {
  transform: translateY(-1px);
  box-shadow: 
    0 12px 28px rgba(0,0,0,0.6),
    inset 0 1px 0 rgba(255,255,255,0.2);
}

.surt-stat.surt-fps, .surt-stat.surt-ping {
  position: relative;
  left: 5px;
  top: -5px;
  font-size: 16px;
  font-weight: 600;
  padding: 10px 14px;
  border-radius: 14px;
}

.surt-stat.surt-health, .surt-stat.surt-adr {
  position: fixed;
  top: 12px;
  z-index: 9999;
  font-size: 16px;
  font-weight: 700;
  padding: 10px 16px;
  border-radius: 16px;
  min-width: 100px;
  text-align: center;
  letter-spacing: 0.5px;
}

.surt-stat.surt-health { 
  right: 15px; 
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.1) 0%, 
    rgba(255,107,107,0.08) 100%);
}

.surt-stat.surt-adr { 
  left: 15px; 
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.1) 0%, 
    rgba(124,252,0,0.08) 100%);
}

/* Enhanced Glow & pulse effects */
.surt-low {
  color: #FFB8B8 !important;
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.1) 0%, 
    rgba(255,107,107,0.15) 100%) !important;
  border-color: rgba(255,107,107,0.35) !important;
  animation: surt-pulse-red 1.6s ease-in-out infinite;
  transform-origin: center;
  text-shadow: 0 0 10px rgba(255,107,107,0.7);
}

.surt-warn {
  color: #FFE8A3 !important;
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.1) 0%, 
    rgba(255,209,102,0.15) 100%) !important;
  border-color: rgba(255,209,102,0.35) !important;
  animation: surt-glow-warn 2s ease-in-out infinite;
  text-shadow: 0 0 8px rgba(255,209,102,0.6);
}

.surt-good {
  color: #A8FF78 !important;
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.1) 0%, 
    rgba(124,252,0,0.15) 100%) !important;
  border-color: rgba(124,252,0,0.35) !important;
  animation: surt-glow-green 2.4s ease-in-out infinite;
  text-shadow: 0 0 8px rgba(124,252,0,0.6);
}

/* Enhanced animations with more depth */
@keyframes surt-glow-warn {
  0%, 100% { 
    box-shadow: 
      0 0 10px rgba(255,209,102,0.5),
      0 8px 24px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.15);
  }
  50% { 
    box-shadow: 
      0 0 20px rgba(255,209,102,0.9),
      0 12px 32px rgba(0,0,0,0.6),
      inset 0 1px 0 rgba(255,255,255,0.2);
  }
}

@keyframes surt-pulse-red {
  0% {
    box-shadow: 
      0 0 8px rgba(255,107,107,0.5),
      0 8px 24px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.15);
    transform: translateY(0) scale(1);
  }
  50% {
    box-shadow: 
      0 0 20px rgba(255,107,107,0.9),
      0 12px 32px rgba(0,0,0,0.6),
      inset 0 1px 0 rgba(255,255,255,0.2);
    transform: translateY(-2px) scale(1.02);
  }
  100% {
    box-shadow: 
      0 0 8px rgba(255,107,107,0.5),
      0 8px 24px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.15);
    transform: translateY(0) scale(1);
  }
}

@keyframes surt-glow-green {
  0%, 100% { 
    box-shadow: 
      0 0 10px rgba(124,252,0,0.5),
      0 8px 24px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.15);
  }
  50% { 
    box-shadow: 
      0 0 20px rgba(124,252,0,0.9),
      0 12px 32px rgba(0,0,0,0.6),
      inset 0 1px 0 rgba(255,255,255,0.2);
  }
}

/* Add subtle background noise for more glass texture */
.surt-stat::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(
      circle at 30% 30%,
      rgba(255,255,255,0.05) 0%,
      transparent 50%
    ),
    radial-gradient(
      circle at 70% 70%,
      rgba(255,255,255,0.03) 0%,
      transparent 50%
    );
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
}

/* Optional: Add a subtle shine effect on hover */
.surt-stat:hover::after {
  animation: surt-shine 0.8s ease-out;
}

@keyframes surt-shine {
  0% {
    background-position: -100px;
  }
  100% {
    background-position: 200px;
  }
}

/* Responsive adjustments */
@media (max-width: 850px) {
  .surt-stat.surt-health, .surt-stat.surt-adr {
    padding: 8px 12px;
    font-size: 14px;
    min-width: 80px;
  }
}

@media (min-width: 851px) {
  #start-row-header {
    height: 140px;
    margin-bottom: 0px;
  }
}
`;

export default function () {
  // Keep the style in sync with the user's setting.
  let applied = false;

  const applyStyle = () => {
    try {
      if (!outerDocument) return;
      const existing = outerDocument.getElementById(STYLE_ID);

      if (settings.blurBackground_ && settings.blurBackground_.enabled_) {
        if (!existing) {
          const s = outerDocument.createElement('style');
          s.id = STYLE_ID;
          s.type = 'text/css';
          s.innerHTML = CSS_CONTENT;
          outerDocument.head.appendChild(s);
        }
        applied = true;
      } else {
        if (existing) existing.remove();
        applied = false;
      }
    } catch { }
  };

  // Apply immediately and then poll occasionally so toggling in UI works.
  applyStyle();
  const interval = setInterval(applyStyle, 500);

  // Extras: FPS, Ping, Health, Armor highlights and optional FPS cap.
  let extrasInitialized = false;
  let origRequestAnimationFrame = null;
  let fpsTimes = [];
  let fpsEl = null;
  let pingEl = null;
  let healthEl = null;
  let adrEl = null;
  let healthInterval = null;
  let pingTimeout = null;
  let armorObservers = [];
  let weaponObservers = [];

  const setupWeaponBorderHandler = () => {
    try {
      if (!outerDocument) return;
      const weaponContainers = Array.from(outerDocument.getElementsByClassName("ui-weapon-switch"));
      weaponContainers.forEach((container) => {
        container.style.border = container.id === "ui-weapon-id-4" ? "3px solid #2f4032" : "3px solid #FFFFFF";
      });
      const weaponNames = Array.from(outerDocument.getElementsByClassName("ui-weapon-name"));
      weaponNames.forEach((weaponNameElement) => {
        const weaponContainer = weaponNameElement.closest(".ui-weapon-switch");
        if (!weaponContainer)
          return;
        const observer = new MutationObserver(() => {
          try {
            const weaponName = (weaponNameElement.textContent || "").trim();
            let border = "#FFFFFF";
            switch (weaponName.toUpperCase()) {
              case "CZ-3A1":
              case "G18C":
              case "M9":
              case "M93R":
              case "MAC-10":
              case "MP5":
              case "P30L":
              case "DUAL P30L":
              case "UMP9":
              case "VECTOR":
              case "VSS":
              case "FLAMETHROWER":
                border = "#FFAE00";
                break;
              case "AK-47":
              case "OT-38":
              case "OTS-38":
              case "M39 EMR":
              case "DP-28":
              case "MOSIN-NAGANT":
              case "SCAR-H":
              case "SV-98":
              case "M1 GARAND":
              case "PKP PECHENEG":
              case "AN-94":
              case "BAR M1918":
              case "BLR 81":
              case "SVD-63":
              case "M134":
              case "GROZA":
              case "GROZA-S":
                border = "#007FFF";
                break;
              case "FAMAS":
              case "M416":
              case "M249":
              case "QBB-97":
              case "MK 12 SPR":
              case "M4A1-S":
              case "SCOUT ELITE":
              case "L86A2":
                border = "#0f690d";
                break;
              case "M870":
              case "MP220":
              case "SAIGA-12":
              case "SPAS-12":
              case "USAS-12":
              case "SUPER 90":
              case "LASR GUN":
              case "M1100":
                border = "#FF0000";
                break;
              case "MODEL 94":
              case "PEACEMAKER":
              case "MK45G":
              case "M1911":
              case "M1A1":
                border = "#800080";
                break;
              case "DEAGLE 50":
              case "RAINBOW BLASTER":
                border = "#000000";
                break;
              case "AWM-S":
              case "MK 20 SSR":
                border = "#808000";
                break;
              case "POTATO CANNON":
              case "SPUD GUN":
                border = "#A52A2A";
                break;
              case "FLARE GUN":
                border = "#FF4500";
                break;
              case "M79":
                border = "#008080";
                break;
              case "HEART CANNON":
                border = "#FFC0CB";
                break;
              default:
                break;
            }
            if (weaponContainer.id !== "ui-weapon-id-4") {
              weaponContainer.style.border = `3px solid ${border}`;
            }
          } catch { }
        });
        observer.observe(weaponNameElement, { childList: true, characterData: true, subtree: true });
        weaponObservers.push(observer);
      });
    } catch { }
  };

  const initExtras = () => {
    if (extrasInitialized) return;
    try {
      // FPS cap
      const MAX = 240; // desired frame rate
      if (outer && outer.requestAnimationFrame) {
        origRequestAnimationFrame = outer.requestAnimationFrame;
        outer.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 1000 / MAX);
      }

      // FPS display
      try {
        const base = outerDocument.getElementsByClassName('ui-team-member ui-bg-standard')[0];
        if (base && !outerDocument.getElementById('surt-fps-display')) {
          fpsEl = outerDocument.createElement('p');
          fpsEl.id = 'surt-fps-display';
          base.parentNode.insertBefore(fpsEl, base);
          fpsEl.classList.add('surt-stat', 'surt-fps');
        }

        const tickFPS = () => {
          try {
            outer.requestAnimationFrame(() => {
              const now = performance.now();
              while (fpsTimes.length > 0 && fpsTimes[0] <= now - 1000) fpsTimes.shift();
              fpsTimes.push(now);
              if (fpsEl) {
                const fpsVal = fpsTimes.length;
                fpsEl.innerHTML = `${fpsVal} fps`;
                fpsEl.classList.remove('surt-low', 'surt-warn', 'surt-good');
                if (fpsVal <= 60) fpsEl.classList.add('surt-low');
                else if (fpsVal <= 120) fpsEl.classList.add('surt-warn');
                else fpsEl.classList.add('surt-good');
              }
              tickFPS();
            });
          } catch { }
        };
        tickFPS();
      } catch { }

      // Ping display
      try {
        const base = outerDocument.getElementsByClassName('ui-team-member ui-bg-standard')[0];
        if (base && !outerDocument.getElementById('surt-ping-display')) {
          pingEl = outerDocument.createElement('p');
          pingEl.id = 'surt-ping-display';
          base.parentNode.insertBefore(pingEl, base);
          pingEl.classList.add('surt-stat', 'surt-ping');
        }

        const doPing = () => {
          try {
            const start = Date.now();
            const req = new outer.XMLHttpRequest();
            req.open('GET', outer.location.href, true);
            req.onload = () => {
              const ms = Date.now() - start;
              if (pingEl) {
                pingEl.innerHTML = `${ms} ms`;
                pingEl.classList.remove('surt-low', 'surt-warn', 'surt-good');
                if (ms >= 200) pingEl.classList.add('surt-low');
                else if (ms >= 100) pingEl.classList.add('surt-warn');
                else pingEl.classList.add('surt-good');
              }
              pingTimeout = setTimeout(doPing, 500);
            };
            req.onerror = () => {
              if (pingEl) pingEl.innerHTML = '-- ms';
              pingTimeout = setTimeout(doPing, 1000);
            };
            req.send();
          } catch { pingTimeout = setTimeout(doPing, 1000); }
        };
        doPing();
      } catch { }

      // Health & ADR display
      try {
        const healthContainer = outerDocument.querySelector('#ui-health-container');
        if (healthContainer && !outerDocument.getElementById('surt-health-display')) {
          healthEl = outerDocument.createElement('span');
          healthEl.id = 'surt-health-display';
          healthEl.classList.add('surt-stat', 'surt-health');
          healthContainer.appendChild(healthEl);

          adrEl = outerDocument.createElement('span');
          adrEl.id = 'surt-adr-display';
          adrEl.classList.add('surt-stat', 'surt-adr');
          healthContainer.appendChild(adrEl);

          let lastHP = null;
          healthInterval = setInterval(() => {
            try {
              const hpEl = outerDocument.getElementById('ui-health-actual');
              const hp = hpEl ? hpEl.style.width.slice(0, -1) : null;
              if (hp !== null && hp !== lastHP) {
                lastHP = hp;
                const hpVal = Number.parseFloat(hp) || 0;
                healthEl.innerHTML = Math.round(hpVal);
                // Update health color state: <=30 red, 31-60 yellow, >60 green
                healthEl.classList.remove('surt-low', 'surt-warn', 'surt-good');
                if (hpVal <= 30) healthEl.classList.add('surt-low');
                else if (hpVal <= 60) healthEl.classList.add('surt-warn');
                else healthEl.classList.add('surt-good');
              }
              const boost0El = outerDocument.getElementById('ui-boost-counter-0')?.querySelector('.ui-bar-inner');
              const boost1El = outerDocument.getElementById('ui-boost-counter-1')?.querySelector('.ui-bar-inner');
              const boost2El = outerDocument.getElementById('ui-boost-counter-2')?.querySelector('.ui-bar-inner');
              const boost3El = outerDocument.getElementById('ui-boost-counter-3')?.querySelector('.ui-bar-inner');
              const boost0 = boost0El ? parseFloat(boost0El.style.width) : 0;
              const boost1 = boost1El ? parseFloat(boost1El.style.width) : 0;
              const boost2 = boost2El ? parseFloat(boost2El.style.width) : 0;
              const boost3 = boost3El ? parseFloat(boost3El.style.width) : 0;
              const adr0 = (boost0 * 25) / 100 + (boost1 * 25) / 100 + (boost2 * 37.5) / 100 + (boost3 * 12.5) / 100;
              adrEl.innerHTML = Math.round(adr0);
            } catch { }
          }, 250);
        }
      } catch { }

      // Armor color border
      try {
        const boxes = Array.from(outerDocument.getElementsByClassName('ui-armor-level'));
        boxes.forEach((box) => {
          const callback = () => {
            try {
              const armorlv = box.textContent?.trim();
              let color = '#000000';
              switch (armorlv) {
                case 'Lvl. 0':
                case 'Lvl. 1':
                  color = '#FFFFFF';
                  break;
                case 'Lvl. 2':
                  color = '#808080';
                  break;
                case 'Lvl. 3':
                  color = '#0C0C0C';
                  break;
                case 'Lvl. 4':
                  color = '#FFF00F';
                  break;
                default:
                  color = '#000000';
              }
              box.parentNode.style.border = `solid ${color}`;
            } catch { }
          };

          const mo = new MutationObserver(callback);
          mo.observe(box, { characterData: true, subtree: true, childList: true });
          armorObservers.push(mo);
        });
      } catch { }

      // Weapon border handler
      try {
        setupWeaponBorderHandler();
      } catch { }

      extrasInitialized = true; 
    } catch { }
  };

  const cleanupExtras = () => {
    try {
      if (origRequestAnimationFrame) outer.requestAnimationFrame = origRequestAnimationFrame;
      if (fpsEl && fpsEl.parentNode) fpsEl.remove();
      if (pingEl && pingEl.parentNode) pingEl.remove();
      if (healthEl && healthEl.parentNode) healthEl.remove();
      if (adrEl && adrEl.parentNode) adrEl.remove();
      if (healthInterval) clearInterval(healthInterval);
      if (pingTimeout) clearTimeout(pingTimeout);
      // cleanup weapon observers and borders
      weaponObservers.forEach((mo) => mo.disconnect());
      weaponObservers.length = 0;
      try {
        const weaponContainers = Array.from(outerDocument.getElementsByClassName('ui-weapon-switch'));
        weaponContainers.forEach((container) => {
          if (container && container.style) container.style.border = '';
        });
      } catch { }

      armorObservers.forEach((mo) => mo.disconnect());
      armorObservers.length = 0;
      fpsTimes.length = 0;
      extrasInitialized = false;
    } catch { }
  };

  // Keep extras in sync with setting
  const applyExtras = () => {
    if (settings.blurBackground_ && settings.blurBackground_.enabled_) {
      initExtras();
    } else {
      cleanupExtras();
    }
  };

  applyExtras();
  const extrasInterval = setInterval(applyExtras, 1000);

  // We intentionally do not clear the intervals; they're lightweight and ensure toggles are applied.
}

