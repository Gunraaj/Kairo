import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioSettings } from '../types';

type ActiveNodes = {
  mode: AudioSettings['mode'];
  waveType: AudioSettings['waveType'];
  ambientPreset: AudioSettings['ambientPreset'];
  noiseType: AudioSettings['noiseType'];
  sources: AudioScheduledSourceNode[];
  gains: GainNode[];
  binauralOscs?: [OscillatorNode, OscillatorNode];
  binauralGains?: GainNode[];
  isoCarrier?: OscillatorNode;
  isoPulse?: OscillatorNode;
  isoToneGain?: GainNode;
  isoDepthGain?: GainNode;
  noiseGain?: GainNode;
};

const createNoiseBuffer = (
  context: AudioContext,
  type: AudioSettings['noiseType'],
): AudioBuffer => {
  const length = context.sampleRate * 3;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const output = buffer.getChannelData(0);
  let last = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;

    if (type === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      output[index] = last * 3.5;
      continue;
    }

    if (type === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      output[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      continue;
    }

    output[index] = white * 0.55;
  }

  return buffer;
};

const stopGraph = (graph: ActiveNodes | null) => {
  if (!graph) return;
  graph.gains.forEach(node => {
    try {
      node.gain.cancelScheduledValues(0);
    } catch {
      // Ignored
    }
  });
  graph.sources.forEach(source => {
    try {
      source.stop();
    } catch {
      // A source can already be stopped
    }
    try {
      source.disconnect();
    } catch {
      // Ignored
    }
  });
  graph.gains.forEach(node => {
    try {
      node.disconnect();
    } catch {
      // Ignored
    }
  });
};

export const useAudioEngine = (settings: AudioSettings) => {
  const contextRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<ActiveNodes | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const noiseBuffersRef = useRef(new Map<AudioSettings['noiseType'], AudioBuffer>());
  const [error, setError] = useState<string | null>(null);

  const ensureContext = useCallback(async () => {
    if (!contextRef.current) {
      const AudioContextClass = window.AudioContext || (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Generated audio is not supported by this browser.');
      }

      const context = new AudioContextClass();
      const master = context.createGain();
      const limiter = context.createDynamicsCompressor();
      master.gain.value = 0;
      limiter.threshold.value = -10;
      limiter.knee.value = 8;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      master.connect(limiter).connect(context.destination);
      contextRef.current = context;
      masterRef.current = master;
    }

    if (contextRef.current.state === 'suspended') {
      await contextRef.current.resume();
    }
    setError(null);
    return contextRef.current;
  }, []);

  const resume = useCallback(async () => {
    try {
      await ensureContext();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The audio engine could not start.';
      setError(message);
      throw reason;
    }
  }, [ensureContext]);

  const playCue = useCallback(async () => {
    try {
      const context = await ensureContext();
      const now = context.currentTime;
      // Resonant harmonic singing bowl (Solfeggio 528 Hz with warm overtones)
      const harmonics = [
        { freq: 528, gain: 0.16, decay: 2.6 },
        { freq: 528 * 1.52, gain: 0.08, decay: 1.8 },
        { freq: 528 * 2.76, gain: 0.04, decay: 1.1 },
      ];

      harmonics.forEach(({ freq, gain: peakGain, decay }) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.998, now + decay);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(peakGain, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

        osc.connect(gain).connect(context.destination);
        osc.start(now);
        osc.stop(now + decay + 0.05);
      });
    } catch {
      // Ignored if audio blocked
    }
  }, [ensureContext]);

  const playTick = useCallback(async (isMajor = false) => {
    try {
      const context = await ensureContext();
      const now = context.currentTime;

      // 1. Primary tactile mechanical click
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = isMajor ? 'sine' : 'triangle';
      const startFreq = isMajor ? 1200 : 1600;
      const endFreq = isMajor ? 320 : 500;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + (isMajor ? 0.016 : 0.009));

      const peakGain = isMajor ? 0.04 : 0.022;
      gain.gain.setValueAtTime(peakGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (isMajor ? 0.024 : 0.012));

      osc.connect(gain).connect(context.destination);
      osc.start(now);
      osc.stop(now + (isMajor ? 0.026 : 0.014));

      // 2. Secondary physical ratchet body thud on major 5-min stops (feels like a genuine watch bezel)
      if (isMajor) {
        const thud = context.createOscillator();
        const thudGain = context.createGain();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(220, now);
        thud.frequency.exponentialRampToValueAtTime(60, now + 0.026);
        thudGain.gain.setValueAtTime(0.03, now);
        thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
        thud.connect(thudGain).connect(context.destination);
        thud.start(now);
        thud.stop(now + 0.03);
      }
    } catch {
      // Audio not permitted or suspended
    }
  }, [ensureContext]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // 1. If paused or disabled, fade master out cleanly
      if (!settings.isPlaying || !settings.engineEnabled) {
        const context = contextRef.current;
        const master = masterRef.current;
        if (context && master) {
          master.gain.cancelScheduledValues(context.currentTime);
          master.gain.setTargetAtTime(0, context.currentTime, 0.05);
        }
        if (activeNodesRef.current) {
          stopGraph(activeNodesRef.current);
          activeNodesRef.current = null;
        }
        return;
      }

      let context: AudioContext;
      try {
        context = await ensureContext();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'The audio engine could not start.');
        return;
      }
      const master = masterRef.current;
      if (!master || cancelled) return;

      const currentNodes = activeNodesRef.current;

      // 2. Can we smoothly modulate the existing graph without rebuilding?
      const canUpdateInPlace = currentNodes &&
        currentNodes.mode === settings.mode &&
        currentNodes.waveType === settings.waveType &&
        currentNodes.ambientPreset === settings.ambientPreset &&
        currentNodes.noiseType === settings.noiseType;

      if (canUpdateInPlace) {
        // Continuous, click-free parameter updates via Web Audio API AudioParam
        const now = context.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setTargetAtTime(Math.min(1, Math.max(0, settings.masterVolume)), now, 0.05);

        if (settings.mode === 'binaural' && currentNodes.binauralOscs && currentNodes.binauralGains) {
          currentNodes.binauralOscs[0].frequency.setTargetAtTime(settings.baseFrequency, now, 0.05);
          currentNodes.binauralOscs[1].frequency.setTargetAtTime(settings.baseFrequency + settings.beatFrequency, now, 0.05);
          const binauralVol = Math.min(0.3, Math.max(0, settings.binauralVolume));
          currentNodes.binauralGains.forEach(g => g.gain.setTargetAtTime(binauralVol, now, 0.05));
        }

        if (settings.mode === 'isochronic' && currentNodes.isoCarrier && currentNodes.isoPulse) {
          currentNodes.isoCarrier.frequency.setTargetAtTime(settings.baseFrequency, now, 0.05);
          currentNodes.isoPulse.frequency.setTargetAtTime(settings.beatFrequency, now, 0.05);
          const safeToneVolume = Math.min(0.3, Math.max(0, settings.binauralVolume));
          currentNodes.isoToneGain?.gain.setTargetAtTime(safeToneVolume * 0.5, now, 0.05);
          currentNodes.isoDepthGain?.gain.setTargetAtTime(safeToneVolume * 0.5, now, 0.05);
        }

        if (currentNodes.noiseGain) {
          const noiseVol = Math.min(0.35, Math.max(
            0,
            settings.mode === 'noise' ? Math.max(settings.noiseVolume, 0.18) : settings.noiseVolume,
          ));
          currentNodes.noiseGain.gain.setTargetAtTime(noiseVol, now, 0.05);
        }
        return;
      }

      // 3. Structural mode change: teardown and build new graph
      stopGraph(activeNodesRef.current);
      const graph: ActiveNodes = {
        mode: settings.mode,
        waveType: settings.waveType,
        ambientPreset: settings.ambientPreset,
        noiseType: settings.noiseType,
        sources: [],
        gains: [],
      };
      activeNodesRef.current = graph;

      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0, context.currentTime);
      master.gain.linearRampToValueAtTime(
        Math.min(1, Math.max(0, settings.masterVolume)),
        context.currentTime + 0.25,
      );

      if (settings.mode === 'binaural') {
        const merger = context.createChannelMerger(2);
        const oscLeft = context.createOscillator();
        const oscRight = context.createOscillator();
        const gainLeft = context.createGain();
        const gainRight = context.createGain();

        oscLeft.type = settings.waveType;
        oscRight.type = settings.waveType;
        oscLeft.frequency.value = settings.baseFrequency;
        oscRight.frequency.value = settings.baseFrequency + settings.beatFrequency;

        const targetVol = Math.min(0.3, Math.max(0, settings.binauralVolume));
        gainLeft.gain.setValueAtTime(0.0001, context.currentTime);
        gainRight.gain.setValueAtTime(0.0001, context.currentTime);
        gainLeft.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetVol), context.currentTime + 0.06);
        gainRight.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetVol), context.currentTime + 0.06);

        // Discrete Left / Right stereo channel assignment
        oscLeft.connect(gainLeft).connect(merger, 0, 0);
        oscRight.connect(gainRight).connect(merger, 0, 1);
        merger.connect(master);

        oscLeft.start(context.currentTime);
        oscRight.start(context.currentTime);

        graph.sources.push(oscLeft, oscRight);
        graph.gains.push(gainLeft, gainRight);
        graph.binauralOscs = [oscLeft, oscRight];
        graph.binauralGains = [gainLeft, gainRight];
      }

      if (settings.mode === 'isochronic') {
        const carrier = context.createOscillator();
        const toneGain = context.createGain();
        const pulse = context.createOscillator();
        const pulseDepth = context.createGain();

        carrier.type = settings.waveType;
        carrier.frequency.value = settings.baseFrequency;
        pulse.type = 'sine';
        pulse.frequency.value = settings.beatFrequency;
        const safeToneVolume = Math.min(0.3, Math.max(0, settings.binauralVolume));

        toneGain.gain.setValueAtTime(0.0001, context.currentTime);
        toneGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, safeToneVolume * 0.5), context.currentTime + 0.06);
        pulseDepth.gain.value = safeToneVolume * 0.5;

        pulse.connect(pulseDepth).connect(toneGain.gain);
        carrier.connect(toneGain).connect(master);
        carrier.start(context.currentTime);
        pulse.start(context.currentTime);
        graph.sources.push(carrier, pulse);
        graph.gains.push(toneGain, pulseDepth);
        graph.isoCarrier = carrier;
        graph.isoPulse = pulse;
        graph.isoToneGain = toneGain;
        graph.isoDepthGain = pulseDepth;
      }

      if (settings.noiseVolume > 0 || settings.mode === 'noise') {
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        const preset = settings.ambientPreset;

        const existingBuffer = noiseBuffersRef.current.get(settings.noiseType);
        source.buffer = existingBuffer ?? createNoiseBuffer(context, settings.noiseType);
        if (!existingBuffer && source.buffer) {
          noiseBuffersRef.current.set(settings.noiseType, source.buffer);
        }
        source.loop = true;
        const noiseTarget = Math.min(0.35, Math.max(
          0,
          settings.mode === 'noise' ? Math.max(settings.noiseVolume, 0.18) : settings.noiseVolume,
        ));
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, noiseTarget), context.currentTime + 0.06);

        if (preset === 'rain') {
          filter.type = 'highpass';
          filter.frequency.value = 700;
        } else if (preset === 'cafe') {
          filter.type = 'bandpass';
          filter.frequency.value = 420;
          filter.Q.value = 0.45;
        } else if (preset === 'fireplace') {
          filter.type = 'bandpass';
          filter.frequency.value = 1200;
          filter.Q.value = 0.8;
        } else {
          filter.type = 'lowpass';
          filter.frequency.value = preset === 'ocean' ? 650 : 1200;
        }

        source.connect(filter).connect(gain).connect(master);
        source.start();
        graph.sources.push(source);
        graph.gains.push(gain);
        graph.noiseGain = gain;

        if (preset === 'ocean' || preset === 'fireplace') {
          const movement = context.createOscillator();
          const movementDepth = context.createGain();
          movement.type = preset === 'ocean' ? 'sine' : 'triangle';
          movement.frequency.value = preset === 'ocean' ? 0.09 : 2.4;
          movementDepth.gain.value = gain.gain.value * (preset === 'ocean' ? 0.55 : 0.24);
          gain.gain.value *= preset === 'ocean' ? 0.65 : 0.8;
          movement.connect(movementDepth).connect(gain.gain);
          movement.start();
          graph.sources.push(movement);
          graph.gains.push(movementDepth);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [ensureContext, settings]);

  useEffect(() => () => {
    stopGraph(activeNodesRef.current);
    contextRef.current?.close();
  }, []);

  return { resume, playCue, playTick, error };
};
