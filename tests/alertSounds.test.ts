import test from 'node:test';
import assert from 'node:assert/strict';
import { ALERT_SOUNDS, isAlertSoundId } from '../utils/alertSounds';
import { normalizeSettings } from '../data/validation';

test('alarm catalog ids are unique and validated', () => {
  const ids = ALERT_SOUNDS.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('none'));
  assert.ok(isAlertSoundId('bell'));
  assert.equal(isAlertSoundId('javascript:alert(1)'), false);
});

test('alarm settings default sensibly and reject bad values', () => {
  const s = normalizeSettings({ focusEndSound: 'nope', breakEndSound: 'gong', alertVolume: 7, alertRepeats: 9 });
  assert.equal(s.focusEndSound, 'bell');
  assert.equal(s.breakEndSound, 'gong');
  assert.equal(s.alertVolume, 1);
  assert.equal(s.alertRepeats, 3);
  const d = normalizeSettings({});
  assert.notEqual(d.focusEndSound, d.breakEndSound);
});
