import React from 'react';
import Checkbox from '@/ui/components/interaction/Checkbox.jsx';
import Slider from '@/ui/components/interaction/Slider.jsx';
import SectionTitle from '@/ui/components/layout/SectionTitle.jsx';
import { Icons } from '@/ui/components/icons.jsx';

const Visuals = ({ settings, onSettingChange }) => {
  return (
    <div className="section">
      <SectionTitle
        icon={Icons.XRay_}
        label="X-Ray"
        enabled={settings.xray_.enabled_}
        onEnabledChange={(v) => onSettingChange((s) => (s.xray_.enabled_ = v))}
      />
      <div className={`group ${!settings.xray_.enabled_ ? 'hidden' : ''}`}>
        <Checkbox
          id="remove-ceilings"
          label="Remove Ceilings"
          checked={settings.xray_.removeCeilings_}
          onChange={(v) => onSettingChange((s) => (s.xray_.removeCeilings_ = v))}
        />
        <Checkbox
          id="darker-smokes"
          label="Darker Smokes"
          checked={settings.xray_.darkerSmokes_}
          onChange={(v) => onSettingChange((s) => (s.xray_.darkerSmokes_ = v))}
        />
        <Slider
          id="smoke-opacity"
          label="Smoke Opacity"
          value={settings.xray_.smokeOpacity_}
          onChange={(v) => onSettingChange((s) => (s.xray_.smokeOpacity_ = v))}
        />
        <Slider
          id="tree-opacity"
          label="Tree Opacity"
          value={settings.xray_.treeOpacity_}
          onChange={(v) => onSettingChange((s) => (s.xray_.treeOpacity_ = v))}
        />
      </div>

      <SectionTitle
        icon={Icons.ESP_}
        label="Map ESP"
        enabled={settings.mapESP_.enabled_}
        onEnabledChange={(v) => onSettingChange((s) => (s.mapESP_.enabled_ = v))}
        warning={true}
      />

      <SectionTitle
        icon={Icons.ESP_}
        label="Player Radar"
        enabled={settings.playerRadar_.enabled_}
        onEnabledChange={(v) => onSettingChange((s) => (s.playerRadar_.enabled_ = v))}
        warning={true}
      />

      <SectionTitle
        icon={Icons.ESP_}
        label="ESP"
        enabled={settings.esp_.enabled_}
        onEnabledChange={(v) => onSettingChange((s) => (s.esp_.enabled_ = v))}
      />
      <div className={`group ${!settings.esp_.enabled_ ? 'hidden' : ''}`}>
        <Checkbox
          id="visible-nametags"
          label="Visible Nametags"
          checked={settings.esp_.visibleNametags_}
          onChange={(v) => onSettingChange((s) => (s.esp_.visibleNametags_ = v))}
        />
        <Checkbox
          id="player-esp"
          label="Player Lines"
          checked={settings.esp_.players_}
          onChange={(v) => onSettingChange((s) => (s.esp_.players_ = v))}
        />

        <div className="section-title">Grenades</div>
        <div className="subgroup">
          <Checkbox
            id="grenade-esp"
            label="Explosions"
            checked={settings.esp_.grenades_.explosions_}
            onChange={(v) => onSettingChange((s) => (s.esp_.grenades_.explosions_ = v))}
            style={{ marginRight: '0.375rem' }}
          />
          <Checkbox
            id="grenade-trajectory"
            label="Trajectory"
            checked={settings.esp_.grenades_.trajectory_}
            onChange={(v) => onSettingChange((s) => (s.esp_.grenades_.trajectory_ = v))}
            style={{ marginRight: '0.375rem' }}
          />
        </div>

        <div className="section-title">Flashlights</div>
        <div className="subgroup">
          <Checkbox
            id="own-flashlight"
            label="Own"
            checked={settings.esp_.flashlights_.own_}
            onChange={(v) => onSettingChange((s) => (s.esp_.flashlights_.own_ = v))}
            style={{ marginRight: '0.375rem' }}
          />
          <Checkbox
            id="others-flashlight"
            label="Others"
            checked={settings.esp_.flashlights_.others_}
            onChange={(v) => onSettingChange((s) => (s.esp_.flashlights_.others_ = v))}
            style={{ marginRight: '0.375rem' }}
          />
        </div>
      </div>

      <SectionTitle
        icon={Icons.Spinbot_}
        label="Spinbot"
        keybind={settings.keybinds_.toggleSpinbot_}
        keybindEditable={true}
        onKeybindChange={(newKey) => onSettingChange((s) => (s.keybinds_.toggleSpinbot_ = newKey))}
        enabled={settings.spinbot_.enabled_}
        onEnabledChange={(v) => onSettingChange((s) => (s.spinbot_.enabled_ = v))}
      />
      <div className={`group ${!settings.spinbot_.enabled_ ? 'hidden' : ''}`}>
        <Slider
          id="spinbot-speed"
          label="Speed"
          min={0}
          max={100}
          value={settings.spinbot_.speed_}
          onChange={(v) => onSettingChange((s) => (s.spinbot_.speed_ = v))}
        />
        <Checkbox
          id="spinbot-realistic"
          label="Realistic"
          checked={settings.spinbot_.realistic_}
          onChange={(v) => {
            if (v) {
              onSettingChange((s) => {
                s.spinbot_.realistic_ = true;
                s.spinbot_.spinTwoDirections_ = false;
                s.spinbot_.spinThreeDirections_ = false;
                s.spinbot_.spinAllDirections_ = false;
              });
            } else {
              onSettingChange((s) => (s.spinbot_.realistic_ = false));
            }
          }}
        />
        <Checkbox
          id="spinbot-two-directions"
          label="Spin 2 Directions (Horizontal)"
          checked={settings.spinbot_.spinTwoDirections_}
          onChange={(v) => {
            if (v) {
              onSettingChange((s) => {
                s.spinbot_.spinTwoDirections_ = true;
                s.spinbot_.spinThreeDirections_ = false;
                s.spinbot_.spinAllDirections_ = false;
              });
            } else {
              onSettingChange((s) => (s.spinbot_.spinTwoDirections_ = false));
            }
          }}
        />
        <Checkbox
          id="spinbot-three-directions"
          label="Spin 3 Directions (Triangle)"
          checked={settings.spinbot_.spinThreeDirections_}
          onChange={(v) => {
            if (v) {
              onSettingChange((s) => {
                s.spinbot_.spinThreeDirections_ = true;
                s.spinbot_.spinTwoDirections_ = false;
                s.spinbot_.spinAllDirections_ = false;
              });
            } else {
              onSettingChange((s) => (s.spinbot_.spinThreeDirections_ = false));
            }
          }}
        />
        <Checkbox
          id="spinbot-all-directions"
          label="Spin 4 Directions (Square)"
          checked={settings.spinbot_.spinAllDirections_}
          onChange={(v) => {
            if (v) {
              onSettingChange((s) => {
                s.spinbot_.spinAllDirections_ = true;
                s.spinbot_.spinTwoDirections_ = false;
                s.spinbot_.spinThreeDirections_ = false;
              });
            } else {
              onSettingChange((s) => (s.spinbot_.spinAllDirections_ = false));
            }
          }}
        />
      </div>
    </div>
  );
};

export default Visuals;
