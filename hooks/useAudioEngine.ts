import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioSettings } from '../types';

type AudioGraph = {
  sources: AudioScheduledSourceNode[];
  gains: GainNode[];
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

const stopGraph = (graph: AudioGraph | null) => {
  graph?.gains.forEach(node => node.gain.cancelScheduledValues(0));
  graph?.sources.forEach(source => {
    try {
      source.stop();
    } catch {
      // A source can already be stopped during fast preset changes.
    }
    source.disconnect();
  });
  graph?.gains.forEach(node => node.disconnect());
};

export const useAudioEngine = (settings: AudioSettings) => {
  const contextRef = useRef<AudioContext | null>(null);
  const graphRef = useRef<AudioGraph | null>(null);
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
    const context = await ensureContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
  }, [ensureContext]);

  useEffect(() => {
    let cancelled = false;

    const rebuild = async () => {
      if (!settings.isPlaying || !settings.engineEnabled) {
        const context = contextRef.current;
        const master = masterRef.current;
        if (context && master) {
          master.gain.cancelScheduledValues(context.currentTime);
          master.gain.setTargetAtTime(0, context.currentTime, 0.04);
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

      stopGraph(graphRef.current);
      const graph: AudioGraph = { sources: [], gains: [] };
      graphRef.current = graph;

      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0, context.currentTime);
      master.gain.linearRampToValueAtTime(
        Math.min(1, Math.max(0, settings.masterVolume)),
        context.currentTime + 0.35,
      );

      if (settings.mode === 'binaural') {
        const createEar = (frequency: number, pan: number) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const panner = context.createStereoPanner();
          oscillator.type = settings.waveType;
          oscillator.frequency.value = frequency;
          gain.gain.value = Math.min(0.3, Math.max(0, settings.binauralVolume));
          panner.pan.value = pan;
          oscillator.connect(gain).connect(panner).connect(master);
          oscillator.start();
          graph.sources.push(oscillator);
          graph.gains.push(gain);
        };
        createEar(settings.baseFrequency, -1);
        createEar(settings.baseFrequency + settings.beatFrequency, 1);
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
        toneGain.gain.value = safeToneVolume * 0.55;
        pulseDepth.gain.value = safeToneVolume * 0.45;

        pulse.connect(pulseDepth).connect(toneGain.gain);
        carrier.connect(toneGain).connect(master);
        carrier.start();
        pulse.start();
        graph.sources.push(carrier, pulse);
        graph.gains.push(toneGain, pulseDepth);
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
        gain.gain.value = Math.min(0.35, Math.max(
          0,
          settings.mode === 'noise' ? Math.max(settings.noiseVolume, 0.18) : settings.noiseVolume,
        ));

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

    void rebuild();
    return () => {
      cancelled = true;
      stopGraph(graphRef.current);
      graphRef.current = null;
    };
  }, [ensureContext, settings]);

  useEffect(() => () => {
    stopGraph(graphRef.current);
    contextRef.current?.close();
  }, []);

  return { resume, playCue, error };
};
