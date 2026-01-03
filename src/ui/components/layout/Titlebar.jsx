import React from 'react';
import { Icons } from '@/ui/components/icons.jsx';

const Titlebar = ({ onMouseDown, version, onClose }) => {
  const handleMouseDown = (e) => {
    onMouseDown(e);
  };

  return (
    <div className="titlebar" onMouseDown={handleMouseDown}>
      <div className="titlebar-content">
        <Icons.Surplus_ className="menu-icon" />
        <div className="titlebar-text">
          <div className="title">SurMinus(dev version)</div>
          <div className="credit">by shiroko</div>
        </div>
      </div>
      {version && <div className="version-text">{version}</div>}
      <button className="close-btn" onClick={onClose}>
        ×
      </button>
    </div>
  );
};

export default Titlebar;
