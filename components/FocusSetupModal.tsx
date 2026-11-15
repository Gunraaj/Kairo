import React, { useState } from 'react';
import { Modal } from './Modal';
import { NumberField } from './NumberField';
import type { FocusSound, UserSettings } from '../types';
import { notificationPermission, requestNotificationPermission } from '../utils/notify';

export const FOCUS_SOUND_OPTIONS: Array<{ id: FocusSound; label: string; hint: string }> = [
  { id: 'off', label: 'Off', hint: 'Silence. Use Sound Studio whenever you like.' },
  { id: 'brown', label: 'Brown noise', hint: 'A steady low rumble that masks chatter and traffic.' },
  { id: 'alpha', label: 'Alpha 10 Hz', hint: 'Binaural tone for calm focus. Needs headphones.' },
  { id: 'beta', label: 'Beta 14 Hz', hint: 'Binaural tone for alert problem-solving. Needs headphones.' },
];

interface FocusSetupModalProps {
  settings: UserSettings;
  setSettings: (settings: UserSettings) => void;
  onDone: () => void;
}

export const FocusSetupFields: React.FC<{ local: UserSettings; setLocal: React.Dispatch<React.SetStateAction<UserSettings>> }> = ({ local, setLocal }) => {
  const [notif, setNotif] = useState(() => notificationPermission());
  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => setLocal(prev => ({ ...prev, [key]: value }));
  return (
    <>
      <section className="k-setup-row">
        <b>Focus session length</b>
        <div className="k-chat-options">
          {[25, 45, 50].map(m => (
            <button key={m} type="button" className={`k-faq-tab ${local.focusDuration === m ? 'is-active' : ''}`} aria-pressed={local.focusDuration === m} onClick={() => set('focusDuration', m)}>{m} min</button>
          ))}
          <label className="k-plan-type"><span>or type</span><NumberField value={local.focusDuration} min={5} max={180} unit="min" width={40} ariaLabel="Focus length in minutes" onCommit={v => set('focusDuration', v)} /></label>
        </div>
      </section>

      <section className="k-setup-row">
        <b>Sound when a focus session starts</b>
        <div className="k-chat-options" role="radiogroup" aria-label="Sound when a focus session starts">
          {FOCUS_SOUND_OPTIONS.map(o => (
            <button key={o.id} type="button" role="radio" aria-checked={local.focusSound === o.id} className={`k-faq-tab ${local.focusSound === o.id ? 'is-active' : ''}`} onClick={() => set('focusSound', o.id)}>{o.label}</button>
          ))}
        </div>
        <small>{FOCUS_SOUND_OPTIONS.find(o => o.id === local.focusSound)?.hint}</small>
      </section>

      <section className="k-setup-row k-setup-toggles">
        <label><input type="checkbox" checked={local.autoStartBreaks} onChange={e => set('autoStartBreaks', e.target.checked)} /> Start breaks automatically when focus ends</label>
        <label><input type="checkbox" checked={local.deepFocusMode} onChange={e => set('deepFocusMode', e.target.checked)} /> Pause the timer if I switch to another tab</label>
      </section>

      <section className="k-setup-row">
        <b>Tell me when a session ends</b>
        {notif === 'granted' && <small>Notifications are on.</small>}
        {notif === 'denied' && <small>Blocked by your browser. You can allow them from the address bar later.</small>}
        {notif === 'unsupported' && <small>This browser does not support notifications.</small>}
        {notif === 'default' && <button type="button" className="k-btn" onClick={async () => setNotif(await requestNotificationPermission())}>Turn on notifications</button>}
      </section>
    </>
  );
};

export const FocusSetupModal: React.FC<FocusSetupModalProps> = ({ settings, setSettings, onDone }) => {
  const [local, setLocal] = useState(settings);
  const finish = () => { setSettings(local); onDone(); };

  return (
    <Modal titleId="focus-setup-title" onClose={finish} className="k-aibridge k-focus-setup">
      <header className="k-modal-header">
        <div>
          <h2 id="focus-setup-title">Set up your focus</h2>
          <p className="k-modal-sub">Four quick choices. You can change any of them later in Settings.</p>
        </div>
      </header>
      <div className="k-modal-body k-aibridge-body">
        <FocusSetupFields local={local} setLocal={setLocal} />
        <div className="k-onboarding-actions">
          <button type="button" className="k-btn k-btn-primary" onClick={finish}>Done</button>
        </div>
      </div>
    </Modal>
  );
};
