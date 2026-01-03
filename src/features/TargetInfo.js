import { translations } from '@/core/obfuscatedNameTranslator.js';
import { outer } from '@/core/outer.js';
import { gameManager, settings } from '@/core/state.js';

let overlay = null;
let initialized = false;

// SVG Icons as inline strings
const SVG_ICONS = {
  TARGET: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <circle cx="12" cy="12" r="6"></circle>
    <circle cx="12" cy="12" r="2"></circle>
  </svg>`,
  
  RULER: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"></path>
    <path d="m14.5 12.5 2-2"></path>
    <path d="m11.5 9.5 2-2"></path>
    <path d="m8.5 6.5 2-2"></path>
    <path d="m17.5 15.5 2-2"></path>
  </svg>`,
  
  ALERT: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
    <path d="M12 9v4"></path>
    <path d="M12 17h.01"></path>
  </svg>`,
  
  GUN: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 6 6 18"></path>
    <path d="m8 6 10 10"></path>
    <path d="M14 14 4 20l2-6 6-2Z"></path>
    <path d="m6 8 2-2"></path>
    <path d="m8 6 2-2"></path>
  </svg>`,
  
  HELMET: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 10v.2A3 3 0 0 1 8.9 16v0H5.3a.7.7 0 0 1-.5-1.2l3.6-3.6"></path>
    <path d="M14 10v.2a3 3 0 0 0 1.1 5.8v0h3.6a.7.7 0 0 0 .5-1.2l-3.6-3.6"></path>
    <circle cx="12" cy="12" r="10"></circle>
  </svg>`,
  
  ARMOR: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path>
    <path d="m14.5 9-5 5"></path>
    <path d="m9.5 9 5 5"></path>
  </svg>`,
  
  BACKPACK: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"></path>
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
    <path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5"></path>
    <path d="M8 10h8"></path>
    <path d="M8 18h8"></path>
  </svg>`
};

function createOverlay() {
  if (overlay) return;

  const savedPos = outer.localStorage.getItem('surplus_target_info_pos');
  let startX = null;
  let startY = null;

  if (savedPos) {
    try {
      const parsed = JSON.parse(savedPos);
      if (parsed.x !== undefined && parsed.y !== undefined) {
        startX = parsed.x;
        startY = parsed.y;
      }
    } catch (e) {}
  }

  overlay = outer.document.createElement('div');
  overlay.id = 'targetinfo-overlay';

  const cssTop = startY !== null ? `${startY}px` : '50%';
  const cssLeft = startX !== null ? `${startX}px` : 'auto';
  const cssRight = startX !== null ? 'auto' : '15px';
  const cssTransform = startY !== null ? 'none' : 'translateY(-50%)';

  // Clean glass morphism effect without red glow
  overlay.style.cssText = `
    position: fixed;
    top: ${cssTop};
    left: ${cssLeft};
    right: ${cssRight};
    transform: ${cssTransform};
    
    /* Glass morphism effect */
    background: linear-gradient(
      135deg,
      rgba(20, 20, 20, 0.92) 0%,
      rgba(35, 35, 35, 0.92) 100%
    );
    backdrop-filter: blur(12px) saturate(180%);
    -webkit-backdrop-filter: blur(12px) saturate(180%);
    
    /* Clean border */
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    
    /* Subtle shadow only */
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    
    color: white;
    padding: 16px 20px;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 12px;
    z-index: 99999;
    pointer-events: auto;
    cursor: move;
    user-select: none;
    min-width: 190px;
    display: none;
    overflow: hidden;
    
    /* Subtle texture overlay */
    background-image: 
      radial-gradient(
        circle at 20% 50%,
        rgba(255, 255, 255, 0.03) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 80% 30%,
        rgba(255, 255, 255, 0.02) 0%,
        transparent 50%
      );
    
    transition: all 0.2s ease;
  `;

  // Add shimmer effect element
  const shimmer = outer.document.createElement('div');
  shimmer.style.cssText = `
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.05),
      transparent
    );
    z-index: 1;
    pointer-events: none;
  `;
  overlay.appendChild(shimmer);

  // Animate shimmer on hover
  overlay.addEventListener('mouseenter', () => {
    shimmer.style.transition = 'left 1.5s ease-in-out';
    shimmer.style.left = '100%';
  });
  
  overlay.addEventListener('mouseleave', () => {
    shimmer.style.transition = 'none';
    shimmer.style.left = '-100%';
  });

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  overlay.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = overlay.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    
    // Visual feedback during drag
    overlay.style.backdropFilter = 'blur(8px) saturate(150%)';
    overlay.style.boxShadow = `
      0 12px 40px rgba(0, 0, 0, 0.4),
      0 6px 20px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.15)
    `;
    overlay.style.opacity = '0.95';
    overlay.style.transform = 'scale(0.98)';
    
    e.stopPropagation();
  });

  outer.window.addEventListener('mousemove', (e) => {
    if (!isDragging || !overlay) return;

    overlay.style.transform = 'none';
    overlay.style.right = 'auto';

    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;

    // Smooth movement with bounds checking
    const maxX = outer.window.innerWidth - overlay.offsetWidth;
    const maxY = outer.window.innerHeight - overlay.offsetHeight;
    
    overlay.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
    overlay.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
  });

  outer.window.addEventListener('mouseup', () => {
    if (isDragging && overlay) {
      isDragging = false;
      
      // Restore original styles
      overlay.style.backdropFilter = 'blur(12px) saturate(180%)';
      overlay.style.boxShadow = `
        0 8px 32px rgba(0, 0, 0, 0.3),
        0 4px 16px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1)
      `;
      overlay.style.opacity = '1';
      overlay.style.transform = 'scale(1)';

      const rect = overlay.getBoundingClientRect();
      const pos = { x: rect.left, y: rect.top };
      outer.localStorage.setItem('surplus_target_info_pos', JSON.stringify(pos));
    }
  });

  outer.document.body.appendChild(overlay);
}

function getWeaponName(type) {
  if (!type) return '---';
  const t = type.toLowerCase();

  const map = {
    'mp5': 'MP5', 'mac10': 'MAC-10', 'ump9': 'UMP9', 'vector': 'Vector',
    'ak47': 'AK-47', 'scar': 'SCAR-H', 'an94': 'AN-94', 'groza': 'Groza',
    'dp28': 'DP-28', 'm249': 'M249', 'pkm': 'PKM', 'qbb97': 'QBB-97',
    'mosin': 'Mosin', 'sv98': 'SV-98', 'awc': 'AWM-S', 'scout': 'Scout',
    'model94': 'Model 94', 'blr': 'BLR 81',
    'mk12': 'Mk 12', 'mk20': 'Mk 20', 'm39': 'M39 EMR', 'svd': 'SVD-63', 'garand': 'Garand',
    'mp220': 'MP220', 'm870': 'M870', 'spas12': 'SPAS-12', 'super90': 'Super 90',
    'saiga': 'Saiga-12', 'usas': 'USAS-12', 'm1100': 'M1100',
    'deagle': 'DEagle', 'ot38': 'OT-38', 'ots38': 'OTs-38', 'm9': 'M9',
    'm93r': 'M93R', 'm1911': 'M1911', 'p30l': 'P30L', 'peacemaker': 'Peacemaker',
    'flare_gun': 'Flare Gun', 'flare': 'Flare Gun',
    'fists': 'Fists', 'karambit': 'Karambit', 'katana': 'Katana', 'pan': 'Pan',
    'machete': 'Machete', 'kukri': 'Kukri', 'bayonet': 'Bayonet',
    'famas': 'FAMAS', 'hk416': 'HK416', 'm4a1': 'M4A1-S', 'qbz83': 'QBZ-83',
    'bar': 'BAR M1918', 'm1a1': 'M1A1', 'grozas': 'Groza-S',
  };

  for (const [key, name] of Object.entries(map)) {
    if (t.includes(key)) return name;
  }
  return type.replace(/_/g, ' ');
}

function extractLevel(value) {
  if (typeof value === 'number') return Math.min(4, Math.max(0, value));
  if (typeof value === 'string') {
    const match = value.match(/(\d+)/);
    if (match) return Math.min(4, Math.max(0, parseInt(match[1])));
  }
  return 0;
}

function getEquipment(netData) {
  let helmet = 0, armor = 0, backpack = 0;

  if (!netData) return { helmet, armor, backpack };

  for (const key in netData) {
    try {
      const val = netData[key];
      const keyLower = key.toLowerCase();

      if (keyLower.includes('helmet') || keyLower === 'he') {
        helmet = extractLevel(val);
      }
      if (keyLower.includes('chest') || keyLower.includes('armor') || keyLower === 'ch') {
        armor = extractLevel(val);
      }
      if (keyLower.includes('backpack') || keyLower.includes('pack') || keyLower === 'bp') {
        backpack = extractLevel(val);
      }

      if (typeof val === 'string') {
        const valLower = val.toLowerCase();
        if (valLower.includes('helmet') && helmet === 0) {
          helmet = extractLevel(val);
        }
        if ((valLower.includes('chest') || valLower.includes('vest')) && armor === 0) {
          armor = extractLevel(val);
        }
        if (valLower.includes('backpack') && backpack === 0) {
          backpack = extractLevel(val);
        }
      }
    } catch (e) {}
  }

  return { helmet, armor, backpack };
}

function getLevelBars(level) {
  const colors = [
    'linear-gradient(135deg, #666 0%, #444 100%)',
    'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)',
    'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
    'linear-gradient(135deg, #c084fc 0%, #9333ea 100%)',
    'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)'
  ];
  
  const gradient = colors[level] || colors[0];
  const maxBars = level === 4 ? 4 : 3;

  let bars = '';
  for (let i = 1; i <= maxBars; i++) {
    if (i <= level) {
      bars += `
        <span style="
          background: ${gradient};
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 6px currentColor;
          font-weight: bold;
          display: inline-block;
          transform: scale(1.1);
          margin: 0 1px;
        ">■</span>`;
    } else {
      bars += `<span style="
        color: rgba(255,255,255,0.1);
        margin: 0 1px;
      ">□</span>`;
    }
  }
  return bars;
}

function getTeam(player) {
  try {
    const teamInfo = gameManager.game[translations.playerBarn_]?.teamInfo;
    if (!teamInfo) return null;

    for (const teamId of Object.keys(teamInfo)) {
      if (teamInfo[teamId].playerIds?.includes(player.__id)) {
        return teamId;
      }
    }
  } catch (e) {}
  return null;
}

function createIconElement(iconName, size = 14, style = '') {
  const icon = SVG_ICONS[iconName] || '';
  return `<div style="display: inline-flex; align-items: center; justify-content: center; width: ${size}px; height: ${size}px; vertical-align: middle; margin-right: 6px; opacity: 0.8; ${style}">
    ${icon}
  </div>`;
}

function update() {
  if (!overlay) return;

  if (!settings.targetInfo_?.enabled_) {
    overlay.style.display = 'none';
    return;
  }

  const game = gameManager?.game;
  if (!game?.initialized) {
    overlay.style.display = 'none';
    return;
  }

  const me = game[translations.activePlayer_];
  if (!me) {
    overlay.style.display = 'none';
    return;
  }

  const myPos = me[translations.visualPos_] || me.pos;
  if (!myPos) {
    overlay.style.display = 'none';
    return;
  }

  const myTeam = getTeam(me);

  const playerBarn = game[translations.playerBarn_];
  const pool = playerBarn?.playerPool;
  if (!pool) {
    overlay.style.display = 'none';
    return;
  }

  let players = pool[translations.pool_] || pool.pool || pool.p || [];
  if (!Array.isArray(players)) {
    players = Object.values(pool).find(v => Array.isArray(v)) || [];
  }

  let closest = null;
  let minDist = 50 * 50;

  for (const p of players) {
    try {
      if (!p?.active) continue;
      if (p.__id === me.__id) continue;

      const nd = p[translations.netData_];
      if (nd?.[translations.dead_] || p.dead) continue;

      if (myTeam && getTeam(p) === myTeam) continue;

      const pos = p[translations.visualPos_] || p.pos;
      if (!pos) continue;

      const dx = pos.x - myPos.x;
      const dy = pos.y - myPos.y;
      const dist = dx * dx + dy * dy;

      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    } catch (e) {}
  }

  if (!closest) {
    overlay.style.display = 'none';
    return;
  }

  const nd = closest[translations.netData_];
  const name = closest.nameText?._text || closest.name || 'UNKNOWN';
  const weapon = getWeaponName(nd?.[translations.activeWeapon_]);
  const dist = Math.sqrt(minDist).toFixed(0);
  const isKnocked = closest.downed || false;
  const equip = getEquipment(nd);

  // Clean knocked badge without red glow
  const knockedBadge = isKnocked
    ? `<div style="
        background: rgba(255, 87, 87, 0.15);
        color: #ff5757;
        padding: 5px 12px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
        text-align: center;
        margin-bottom: 12px;
        border: 1px solid rgba(255, 87, 87, 0.2);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        letter-spacing: 0.5px;
      ">
        ${createIconElement('ALERT', 12, 'margin-right: 4px; color: #ff5757;')}
        KNOCKED
      </div>`
    : '';

  overlay.innerHTML = `
    <style>
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-1px); }
      }
    </style>
    
    <div style="position: relative; z-index: 2;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 14px;">
        <div style="
          color: #fff;
          font-weight: 600;
          font-size: 15px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          animation: float 3s ease-in-out infinite;
          margin-bottom: 6px;
        ">
          <div style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            color: #4dabf7;
          ">
            ${SVG_ICONS.TARGET}
          </div>
          <span style="color: #e9ecef;">${name}</span>
        </div>
        
        <!-- Distance -->
        <div style="
          color: #a5d8ff;
          font-size: 11px;
          background: rgba(77, 171, 247, 0.08);
          padding: 3px 10px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          border: 1px solid rgba(77, 171, 247, 0.15);
          font-weight: 500;
        ">
          ${createIconElement('RULER', 12, 'margin-right: 5px; color: #4dabf7;')}
          ${dist}m
        </div>
      </div>
      
      ${knockedBadge}
      
      <!-- Equipment Info -->
      <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px;">
        
        <!-- WEAPON -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding: 6px 10px;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          transition: all 0.2s;
        ">
          <span style="color: rgba(255,255,255,0.8); display: flex; align-items: center; font-size: 11px; font-weight: 500;">
            ${createIconElement('GUN', 14, 'color: #adb5bd;')}
            WEAPON
          </span>
          <span style="
            color: #fff;
            font-weight: 500;
            padding: 3px 10px;
            background: rgba(255,255,255,0.05);
            border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.08);
            font-size: 11px;
          ">
            ${weapon}
          </span>
        </div>
        
        <!-- HELMET -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding: 5px 10px;
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
        ">
          <span style="color: rgba(255,255,255,0.8); display: flex; align-items: center; font-size: 11px; font-weight: 500;">
            ${createIconElement('HELMET', 14, 'color: #adb5bd;')}
            HELMET
          </span>
          <span style="display: flex; align-items: center; gap: 8px;">
            ${getLevelBars(equip.helmet)}
            <span style="color: rgba(255,255,255,0.5); font-size: 10px; font-weight: 500;">Lv${equip.helmet}</span>
          </span>
        </div>
        
        <!-- ARMOR -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding: 5px 10px;
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
        ">
          <span style="color: rgba(255,255,255,0.8); display: flex; align-items: center; font-size: 11px; font-weight: 500;">
            ${createIconElement('ARMOR', 14, 'color: #adb5bd;')}
            ARMOR
          </span>
          <span style="display: flex; align-items: center; gap: 8px;">
            ${getLevelBars(equip.armor)}
            <span style="color: rgba(255,255,255,0.5); font-size: 10px; font-weight: 500;">Lv${equip.armor}</span>
          </span>
        </div>
        
        <!-- BACKPACK -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 10px;
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
        ">
          <span style="color: rgba(255,255,255,0.8); display: flex; align-items: center; font-size: 11px; font-weight: 500;">
            ${createIconElement('BACKPACK', 14, 'color: #adb5bd;')}
            BACKPACK
          </span>
          <span style="display: flex; align-items: center; gap: 8px;">
            ${getLevelBars(equip.backpack)}
            <span style="color: rgba(255,255,255,0.5); font-size: 10px; font-weight: 500;">Lv${equip.backpack}</span>
          </span>
        </div>
      </div>
    </div>
  `;
  
  overlay.style.display = 'block';
}

export default function init() {
  if (initialized) return;
  initialized = true;

  createOverlay();
  setInterval(update, 100);
}