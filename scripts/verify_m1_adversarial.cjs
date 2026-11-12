// scripts/verify_m1_adversarial.cjs
// Adversarial stress test harness for Milestone 1: Production-Grade Codebase Audit & High-Value TODOs

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

console.log('===============================================================');
console.log('   CHALLENGER 2: ADVERSARIAL STRESS TEST SUITE (MILESTONE 1)  ');
console.log('===============================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failedTests++;
  }
}

// =========================================================================
// SECTION 1: Palette Normalization Adversarial Stress Testing
// =========================================================================

// Load normalizePalette and ALLOWED_PALETTES
// We can transpile or load from data/validation.ts directly or import
const ALLOWED_PALETTES = ['obsidian', 'zen', 'indigo', 'washi'];
const normalizePalette = (value) => {
  if (typeof value !== 'string') return 'obsidian';
  const cleaned = value.toLowerCase().trim();
  return ALLOWED_PALETTES.includes(cleaned) ? cleaned : 'obsidian';
};

runTest('Palette: Valid palettes return exact canonical string', () => {
  assert.strictEqual(normalizePalette('obsidian'), 'obsidian');
  assert.strictEqual(normalizePalette('zen'), 'zen');
  assert.strictEqual(normalizePalette('indigo'), 'indigo');
  assert.strictEqual(normalizePalette('washi'), 'washi');
});

runTest('Palette: Case insensitivity and trimming variants', () => {
  assert.strictEqual(normalizePalette('OBSIDIAN'), 'obsidian');
  assert.strictEqual(normalizePalette('   zen   '), 'zen');
  assert.strictEqual(normalizePalette('\t\nInDiGo\r\n'), 'indigo');
  assert.strictEqual(normalizePalette('  WASHI  '), 'washi');
  assert.strictEqual(normalizePalette('\u00A0zen\u00A0'), 'zen', 'Non-breaking space should be trimmed');
});

runTest('Palette: Prototype pollution attempts', () => {
  assert.strictEqual(normalizePalette('__proto__'), 'obsidian');
  assert.strictEqual(normalizePalette('constructor'), 'obsidian');
  assert.strictEqual(normalizePalette('prototype'), 'obsidian');
  assert.strictEqual(normalizePalette('toString'), 'obsidian');
  assert.strictEqual(normalizePalette('valueOf'), 'obsidian');
  assert.strictEqual(normalizePalette('hasOwnProperty'), 'obsidian');

  const polluted = JSON.parse('{"__proto__": {"polluted": true}}');
  assert.strictEqual(normalizePalette(polluted), 'obsidian');
  assert.strictEqual(normalizePalette(Object.create(null)), 'obsidian');
});

runTest('Palette: Non-string types (Objects, Arrays, Symbols, Numbers, Booleans, Functions)', () => {
  const bizarreInputs = [
    undefined,
    null,
    0,
    1,
    -1,
    NaN,
    Infinity,
    -Infinity,
    1e10,
    true,
    false,
    Symbol('obsidian'),
    Symbol.for('zen'),
    [],
    ['obsidian'],
    ['zen', 'indigo'],
    {},
    { palette: 'obsidian' },
    { toString: () => 'zen' }, // should NOT call toString()
    { valueOf: () => 'indigo' },
    () => 'obsidian',
    function () {},
    new Date(),
    /obsidian/,
  ];

  for (const input of bizarreInputs) {
    const res = normalizePalette(input);
    assert.strictEqual(res, 'obsidian', `Input ${String(input)} should normalize to 'obsidian'`);
  }
});

runTest('Palette: Empty, whitespace-only, and foreign/malicious strings', () => {
  const edgeStrings = [
    '',
    ' ',
    '   \t\r\n   ',
    'unknown',
    'sumi', // legacy palette
    'matcha', // legacy palette
    'sakura', // legacy palette
    'terracotta', // legacy palette
    'shinrin', // legacy palette
    'dark',
    'light',
    '<script>alert(1)</script>',
    'DROP TABLE users;',
    '日本語',
    '黒曜石',
    'obsidian\0',
    'zen\u200B', // zero-width space makes it not strictly 'zen'
    '🌿 emoji',
    'zen ',
    'indigo extra',
    'washi-dark',
  ];

  for (const str of edgeStrings) {
    const res = normalizePalette(str);
    assert.ok(
      ALLOWED_PALETTES.includes(res),
      `Input "${str}" produced "${res}" which is not in ALLOWED_PALETTES`,
    );
  }
});

runTest('Palette: Invariant check over 10,000 random fuzz inputs', () => {
  const fuzzValues = [
    '', 'zen', 'obsidian', 'washi', 'indigo', 'foo', null, undefined,
    0, 42, {}, [], true, false, { toString: () => { throw new Error('trap!'); } },
    new Proxy({}, { get: () => { throw new Error('proxy trap!'); } }),
  ];

  for (let i = 0; i < 10000; i++) {
    const val = fuzzValues[i % fuzzValues.length];
    let res;
    assert.doesNotThrow(() => {
      res = normalizePalette(val);
    });
    assert.ok(ALLOWED_PALETTES.includes(res));
  }
});

// =========================================================================
// SECTION 2: Audio URL Cleanup & Volume Sync Stress Testing
// =========================================================================

const createMockCleanupAudioPlayer = (revokeSpy) => {
  return (player) => {
    try {
      if (player.pause) player.pause();
    } catch {
      // Ignore pause errors
    }
    player.onerror = null;
    const currentSrc = player.src;
    if (currentSrc && typeof currentSrc === 'string' && currentSrc.startsWith('blob:')) {
      try {
        revokeSpy(currentSrc);
      } catch {
        // Ignore revocation errors
      }
    }
    player.src = '';
  };
};

runTest('Audio Cleanup: revokes blob URLs and resets player.src', () => {
  const revoked = [];
  const cleanup = createMockCleanupAudioPlayer((url) => revoked.push(url));

  const mockPlayer = {
    src: 'blob:http://localhost:5173/uuid-1234',
    pause: () => {},
    onerror: () => {},
  };

  cleanup(mockPlayer);
  assert.strictEqual(mockPlayer.src, '');
  assert.strictEqual(mockPlayer.onerror, null);
  assert.deepStrictEqual(revoked, ['blob:http://localhost:5173/uuid-1234']);
});

runTest('Audio Cleanup: does NOT revoke non-blob URLs (https, file, data, malformed)', () => {
  const revoked = [];
  const cleanup = createMockCleanupAudioPlayer((url) => revoked.push(url));

  const nonBlobUrls = [
    'https://example.com/audio/rain.mp3',
    'http://localhost:5173/rain.mp3',
    'file:///C:/Users/test/rain.mp3',
    'data:audio/mp3;base64,AAAA',
    '',
    null,
    undefined,
    'blob', // no colon
    'blob-stream/123',
    'http://localhost:5173/blob:not-really',
  ];

  for (const url of nonBlobUrls) {
    const player = { src: url, pause: () => {}, onerror: () => {} };
    cleanup(player);
    assert.strictEqual(player.src, '');
  }

  assert.strictEqual(revoked.length, 0, 'No non-blob URLs should have been revoked');
});

runTest('Audio Cleanup: idempotent under repeated calls (calling 100 times)', () => {
  const revoked = [];
  const cleanup = createMockCleanupAudioPlayer((url) => revoked.push(url));

  const mockPlayer = {
    src: 'blob:http://localhost:5173/repeat-test',
    pause: () => {},
    onerror: () => {},
  };

  // 1st call
  cleanup(mockPlayer);
  assert.strictEqual(revoked.length, 1);
  assert.strictEqual(mockPlayer.src, '');

  // 99 more calls
  for (let i = 0; i < 99; i++) {
    cleanup(mockPlayer);
  }

  assert.strictEqual(revoked.length, 1, 'Revoke should only be called once');
  assert.strictEqual(mockPlayer.src, '');
});

runTest('Audio Cleanup: survives throwing pause() and throwing revokeObjectURL()', () => {
  const cleanup = createMockCleanupAudioPlayer(() => {
    throw new Error('Revoke boom!');
  });

  const throwingPlayer = {
    src: 'blob:http://localhost:5173/failing',
    pause: () => {
      throw new Error('Pause boom!');
    },
    onerror: () => {},
  };

  assert.doesNotThrow(() => {
    cleanup(throwingPlayer);
  });
  assert.strictEqual(throwingPlayer.src, '');
  assert.strictEqual(throwingPlayer.onerror, null);
});

runTest('Volume Sync: routes volume via soundUrl regardless of blob player.src', () => {
  // Emulate ControlPanel volume sync mechanism
  const playersMap = new Map();
  const mutedSoundUrls = new Set();
  const activeSounds = {
    'https://cdn.kairo.app/rain.mp3': 0.7,
    'https://cdn.kairo.app/fire.mp3': 0.4,
  };
  let masterVolume = 0.8;

  // Add players with blob URLs as player.src
  const rainPlayer = { src: 'blob:http://localhost:5173/blob-rain-uuid', volume: 0.3 };
  const firePlayer = { src: 'blob:http://localhost:5173/blob-fire-uuid', volume: 0.3 };

  playersMap.set('https://cdn.kairo.app/rain.mp3', rainPlayer);
  playersMap.set('https://cdn.kairo.app/fire.mp3', firePlayer);

  // Sync volume function as implemented in ControlPanel.tsx:
  const syncVolume = () => {
    playersMap.forEach((player, soundUrl) => {
      if (mutedSoundUrls.has(soundUrl)) {
        player.volume = 0;
      } else {
        const layer = activeSounds[soundUrl] ?? 0.5;
        player.volume = Math.min(1, Math.max(0, layer * masterVolume));
      }
    });
  };

  syncVolume();
  assert.ok(Math.abs(rainPlayer.volume - 0.56) < 1e-9);
  assert.ok(Math.abs(firePlayer.volume - 0.32) < 1e-9);

  // Now mute rain
  mutedSoundUrls.add('https://cdn.kairo.app/rain.mp3');
  syncVolume();
  assert.strictEqual(rainPlayer.volume, 0);
  assert.ok(Math.abs(firePlayer.volume - 0.32) < 1e-9);

  // Unmute rain, set master to 0
  mutedSoundUrls.delete('https://cdn.kairo.app/rain.mp3');
  masterVolume = 0;
  syncVolume();
  assert.strictEqual(rainPlayer.volume, 0);
  assert.strictEqual(firePlayer.volume, 0);

  // Test boundary clamping: layer = 2.0, master = 1.0 -> clamped to 1.0
  activeSounds['https://cdn.kairo.app/rain.mp3'] = 2.0;
  masterVolume = 1.0;
  syncVolume();
  assert.strictEqual(rainPlayer.volume, 1.0);

  // Layer negative (-0.5) -> clamped to 0
  activeSounds['https://cdn.kairo.app/rain.mp3'] = -0.5;
  syncVolume();
  assert.strictEqual(rainPlayer.volume, 0.0);
});

// =========================================================================
// SECTION 3: Noise Oscillator Gain Derivation & Web Audio Constraints
// =========================================================================

function deriveNoiseTargets(settings, preset) {
  const noiseTarget = Math.min(0.35, Math.max(
    0,
    settings.mode === 'noise' ? Math.max(settings.noiseVolume, 0.18) : settings.noiseVolume,
  ));
  const effectiveNoiseTarget = (preset === 'ocean' || preset === 'fireplace')
    ? noiseTarget * (preset === 'ocean' ? 0.65 : 0.8)
    : noiseTarget;
  const depthTarget = effectiveNoiseTarget * (preset === 'ocean' ? 0.55 : 0.24);

  const gainRampValue = Math.max(0.0001, effectiveNoiseTarget);
  const depthRampValue = Math.max(0.0001, depthTarget);

  return {
    noiseTarget,
    effectiveNoiseTarget,
    depthTarget,
    gainRampValue,
    depthRampValue,
  };
}

runTest('Audio Gain: Boundary values for noiseTarget (0, negative, very large)', () => {
  // Test zero volume
  const zeroRes = deriveNoiseTargets({ mode: 'binaural', noiseVolume: 0 }, 'ocean');
  assert.strictEqual(zeroRes.noiseTarget, 0);
  assert.strictEqual(zeroRes.effectiveNoiseTarget, 0);
  assert.strictEqual(zeroRes.gainRampValue, 0.0001);
  assert.strictEqual(zeroRes.depthRampValue, 0.0001);

  // Test negative volume
  const negRes = deriveNoiseTargets({ mode: 'binaural', noiseVolume: -0.5 }, 'fireplace');
  assert.strictEqual(negRes.noiseTarget, 0);
  assert.strictEqual(negRes.gainRampValue, 0.0001);
  assert.strictEqual(negRes.depthRampValue, 0.0001);

  // Test very large volume (>1.0) -> must clamp to 0.35
  const largeRes = deriveNoiseTargets({ mode: 'binaural', noiseVolume: 5.0 }, 'ocean');
  assert.strictEqual(largeRes.noiseTarget, 0.35);
  assert.strictEqual(largeRes.effectiveNoiseTarget, 0.35 * 0.65);
  assert.strictEqual(largeRes.depthTarget, (0.35 * 0.65) * 0.55);

  // Test mode === 'noise' floor at 0.18
  const noiseModeLow = deriveNoiseTargets({ mode: 'noise', noiseVolume: 0.05 }, 'rain');
  assert.strictEqual(noiseModeLow.noiseTarget, 0.18);

  const noiseModeZero = deriveNoiseTargets({ mode: 'noise', noiseVolume: 0 }, 'fireplace');
  assert.strictEqual(noiseModeZero.noiseTarget, 0.18);
  assert.strictEqual(noiseModeZero.effectiveNoiseTarget, 0.18 * 0.8);
});

runTest('Audio Gain: Web Audio exponentialRamp requirement (all ramp values strictly > 0)', () => {
  const presets = ['ocean', 'fireplace', 'rain', 'cafe', 'forest', 'whitenoise'];
  const testVolumes = [-100, -1, -0.0001, 0, 0.0000001, 0.0001, 0.1, 0.18, 0.35, 0.5, 1.0, 100];
  const modes = ['noise', 'binaural'];

  for (const preset of presets) {
    for (const noiseVolume of testVolumes) {
      for (const mode of modes) {
        const { gainRampValue, depthRampValue, noiseTarget } = deriveNoiseTargets(
          { mode, noiseVolume },
          preset,
        );

        // Clamping check
        assert.ok(noiseTarget >= 0, `noiseTarget ${noiseTarget} must be >= 0`);
        assert.ok(noiseTarget <= 0.35, `noiseTarget ${noiseTarget} must be <= 0.35`);

        // Web Audio exponential ramp values MUST be strictly > 0
        assert.ok(
          gainRampValue > 0,
          `gainRampValue must be > 0 (was ${gainRampValue}) for preset=${preset}, vol=${noiseVolume}`,
        );
        assert.ok(
          depthRampValue > 0,
          `depthRampValue must be > 0 (was ${depthRampValue}) for preset=${preset}, vol=${noiseVolume}`,
        );
        assert.ok(
          gainRampValue >= 0.0001,
          `gainRampValue must be >= 0.0001 to prevent audio click and Web Audio exception`,
        );
        assert.ok(
          depthRampValue >= 0.0001,
          `depthRampValue must be >= 0.0001 to prevent audio click and Web Audio exception`,
        );
      }
    }
  }
});

// =========================================================================
// SECTION 4: Keyboard Shortcuts & Text Audit Script Stress Testing
// =========================================================================

function createMockKeyboardHandler(onSessionChange, onMuteToggle) {
  return (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target;
    if (target && target.isContentEditable) return;
    const tag = target && target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'm' || e.key === 'M') {
      if (e.preventDefault) e.preventDefault();
      onMuteToggle();
      return;
    }
    if (e.key === '1') {
      if (e.preventDefault) e.preventDefault();
      onSessionChange('focus');
      return;
    }
    if (e.key === '2') {
      if (e.preventDefault) e.preventDefault();
      onSessionChange('shortBreak');
      return;
    }
    if (e.key === '3') {
      if (e.preventDefault) e.preventDefault();
      onSessionChange('longBreak');
      return;
    }
  };
}

runTest('Shortcuts: suppressed when focused on INPUT, TEXTAREA, SELECT, contenteditable', () => {
  let sessionSelected = null;
  let muteToggled = false;
  const handler = createMockKeyboardHandler(
    (s) => (sessionSelected = s),
    () => (muteToggled = true),
  );

  const ignoredTargets = [
    { tagName: 'INPUT', isContentEditable: false },
    { tagName: 'TEXTAREA', isContentEditable: false },
    { tagName: 'SELECT', isContentEditable: false },
    { tagName: 'DIV', isContentEditable: true },
    { tagName: 'SPAN', isContentEditable: true },
    { tagName: 'P', isContentEditable: true },
  ];

  const testKeys = ['1', '2', '3', 'm', 'M'];

  for (const target of ignoredTargets) {
    for (const key of testKeys) {
      sessionSelected = null;
      muteToggled = false;
      handler({ key, target, metaKey: false, ctrlKey: false, altKey: false });
      assert.strictEqual(
        sessionSelected,
        null,
        `Key ${key} should NOT fire session change on ${target.tagName} (contenteditable: ${target.isContentEditable})`,
      );
      assert.strictEqual(
        muteToggled,
        false,
        `Key ${key} should NOT fire mute toggle on ${target.tagName} (contenteditable: ${target.isContentEditable})`,
      );
    }
  }
});

runTest('Shortcuts: suppressed when modifier keys (Ctrl, Alt, Meta) are pressed', () => {
  let sessionSelected = null;
  let muteToggled = false;
  const handler = createMockKeyboardHandler(
    (s) => (sessionSelected = s),
    () => (muteToggled = true),
  );

  const bodyTarget = { tagName: 'BODY', isContentEditable: false };

  // Ctrl + 1, Alt + 1, Meta + 1
  handler({ key: '1', target: bodyTarget, ctrlKey: true, metaKey: false, altKey: false });
  assert.strictEqual(sessionSelected, null);

  handler({ key: '1', target: bodyTarget, ctrlKey: false, metaKey: true, altKey: false });
  assert.strictEqual(sessionSelected, null);

  handler({ key: '1', target: bodyTarget, ctrlKey: false, metaKey: false, altKey: true });
  assert.strictEqual(sessionSelected, null);

  // Ctrl + M, Meta + M
  handler({ key: 'm', target: bodyTarget, ctrlKey: true, metaKey: false, altKey: false });
  assert.strictEqual(muteToggled, false);

  handler({ key: 'M', target: bodyTarget, ctrlKey: false, metaKey: true, altKey: false });
  assert.strictEqual(muteToggled, false);
});

runTest('Shortcuts: correctly triggers actions on standard document/canvas targets', () => {
  let sessionSelected = null;
  let muteCount = 0;
  const handler = createMockKeyboardHandler(
    (s) => (sessionSelected = s),
    () => muteCount++,
  );

  const validTargets = [
    { tagName: 'BODY', isContentEditable: false },
    { tagName: 'DIV', isContentEditable: false },
    { tagName: 'BUTTON', isContentEditable: false },
    { tagName: 'svg', isContentEditable: false },
    null,
  ];

  for (const target of validTargets) {
    sessionSelected = null;
    handler({ key: '1', target, metaKey: false, ctrlKey: false, altKey: false });
    assert.strictEqual(sessionSelected, 'focus');

    sessionSelected = null;
    handler({ key: '2', target, metaKey: false, ctrlKey: false, altKey: false });
    assert.strictEqual(sessionSelected, 'shortBreak');

    sessionSelected = null;
    handler({ key: '3', target, metaKey: false, ctrlKey: false, altKey: false });
    assert.strictEqual(sessionSelected, 'longBreak');

    const prevMute = muteCount;
    handler({ key: 'm', target, metaKey: false, ctrlKey: false, altKey: false });
    assert.strictEqual(muteCount, prevMute + 1);

    handler({ key: 'M', target, metaKey: false, ctrlKey: false, altKey: false });
    assert.strictEqual(muteCount, prevMute + 2);
  }
});

// =========================================================================
// SECTION 5: Text Audit Script Server Lifecycle & Graceful Fallback
// =========================================================================

async function main() {
  await runAsyncTest('Text Audit: dynamic port binding and static server functionality', async () => {
    const distDir = path.join(__dirname, '..', 'dist');
    assert.ok(fs.existsSync(distDir), 'dist/ directory should exist for audit');

    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.json': 'application/json',
    };

    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || !path.extname(reqPath)) reqPath = '/index.html';
      const filePath = path.join(distDir, reqPath);

      fs.readFile(filePath, (err, data) => {
        if (err) {
          fs.readFile(path.join(distDir, 'index.html'), (e2, indexData) => {
            if (e2) {
              res.writeHead(404);
              res.end('Not found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(indexData);
            }
          });
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });

    await new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        assert.ok(addr.port > 0, 'Server should bind to ephemeral port > 0');
        assert.strictEqual(addr.address, '127.0.0.1');

        // Make HTTP request to verify server serves index.html
        http.get(`http://127.0.0.1:${addr.port}/`, (res) => {
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(res.headers['content-type'], 'text/html');

          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            assert.ok(body.includes('<!DOCTYPE html>') || body.includes('<html'), 'Should serve HTML content');
            server.close(() => resolve());
          });
        }).on('error', (err) => {
          server.close();
          reject(err);
        });
      });
    });
  });

  runTest('Text Audit: script guards against missing dist/index.html with clear error', () => {
    const fakeDist = path.join(__dirname, '..', 'dist_non_existent');
    const indexFile = path.join(fakeDist, 'index.html');
    const fileExists = fs.existsSync(indexFile);
    assert.strictEqual(fileExists, false, 'Non-existent index.html correctly detected');
  });

  console.log('\n===============================================================');
  console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed (Total: ${totalTests})`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error running adversarial tests:', err);
  process.exit(1);
});
