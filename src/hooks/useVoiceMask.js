import { useState, useRef, useCallback, useEffect } from 'react';
import { createDistortionCurve } from '../utils/audioProcessing';
import { VOICE_DEFAULTS } from '../utils/constants';

export function useVoiceMask() {
  const [settings, setSettings] = useState({ ...VOICE_DEFAULTS });
  const audioContextRef = useRef(null);
  const nodesRef = useRef({});
  const processedStreamRef = useRef(null);

  /**
   * Process an audio stream through the voice masking pipeline
   * Input → Gain → PitchShift (Delay) → RingMod → Distortion → Output
   */
  const processStream = useCallback((inputStream) => {
    if (!inputStream) return null;

    // Create or reuse AudioContext
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const source = ctx.createMediaStreamSource(inputStream);

    // Input gain
    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;

    // Pitch shifting using delay modulation
    const delayNode = ctx.createDelay(1.0);
    delayNode.delayTime.value = 0;

    // LFO for pitch modulation
    const pitchLFO = ctx.createOscillator();
    const pitchLFOGain = ctx.createGain();
    pitchLFO.type = 'sawtooth';
    pitchLFO.frequency.value = 0; // Will be set based on pitch
    pitchLFOGain.gain.value = 0;
    pitchLFO.connect(pitchLFOGain);
    pitchLFOGain.connect(delayNode.delayTime);
    pitchLFO.start();

    // Ring modulator
    const ringOsc = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ringOsc.type = 'sine';
    ringOsc.frequency.value = 0;
    ringGain.gain.value = 0;
    ringOsc.connect(ringGain.gain);
    ringOsc.start();

    // Distortion (WaveShaper)
    const distortion = ctx.createWaveShaper();
    distortion.curve = createDistortionCurve(0);
    distortion.oversample = '4x';

    // Output gain
    const outputGain = ctx.createGain();
    outputGain.gain.value = 1.0;

    // Create output stream destination
    const destination = ctx.createMediaStreamDestination();

    // Connect the chain
    source.connect(inputGain);
    inputGain.connect(delayNode);
    delayNode.connect(ringGain);
    ringGain.connect(distortion);
    distortion.connect(outputGain);
    outputGain.connect(destination);

    // Store references for parameter updates
    nodesRef.current = {
      source,
      inputGain,
      delayNode,
      pitchLFO,
      pitchLFOGain,
      ringOsc,
      ringGain,
      distortion,
      outputGain,
      destination,
    };

    processedStreamRef.current = destination.stream;

    // Apply initial settings
    applySettings(settings, ctx, nodesRef.current);

    return destination.stream;
  }, [settings]);

  /**
   * Apply voice mask settings to audio nodes
   */
  const applySettings = (s, ctx, nodes) => {
    if (!ctx || !nodes.pitchLFO) return;

    // Pitch shift: use LFO-modulated delay for pitch effect
    const pitchOffset = s.pitch - 1.0; // -0.5 to 1.0
    if (Math.abs(pitchOffset) > 0.01) {
      const lfoFreq = 5 + Math.abs(pitchOffset) * 20;
      const lfoDepth = Math.abs(pitchOffset) * 0.01;
      nodes.pitchLFO.frequency.setValueAtTime(lfoFreq, ctx.currentTime);
      nodes.pitchLFOGain.gain.setValueAtTime(lfoDepth, ctx.currentTime);
    } else {
      nodes.pitchLFO.frequency.setValueAtTime(0, ctx.currentTime);
      nodes.pitchLFOGain.gain.setValueAtTime(0, ctx.currentTime);
    }

    // Ring modulation
    if (s.modulation > 0) {
      const modFreq = s.modulation * 2; // 0-200Hz range
      nodes.ringOsc.frequency.setValueAtTime(modFreq, ctx.currentTime);
      // Mix: blend between clean and modulated
      // The ringGain gain param is being modulated by the oscillator
      nodes.ringGain.gain.value = 1.0;
    } else {
      nodes.ringOsc.frequency.setValueAtTime(0, ctx.currentTime);
      nodes.ringGain.gain.value = 1.0;
    }

    // Distortion
    if (s.distortion > 0) {
      nodes.distortion.curve = createDistortionCurve(s.distortion);
    } else {
      nodes.distortion.curve = createDistortionCurve(0);
    }
  };

  const setPitch = useCallback((value) => {
    const newSettings = { ...settings, pitch: value };
    setSettings(newSettings);
    if (audioContextRef.current && nodesRef.current.pitchLFO) {
      applySettings(newSettings, audioContextRef.current, nodesRef.current);
    }
  }, [settings]);

  const setModulation = useCallback((value) => {
    const newSettings = { ...settings, modulation: value };
    setSettings(newSettings);
    if (audioContextRef.current && nodesRef.current.ringOsc) {
      applySettings(newSettings, audioContextRef.current, nodesRef.current);
    }
  }, [settings]);

  const setDistortion = useCallback((value) => {
    const newSettings = { ...settings, distortion: value };
    setSettings(newSettings);
    if (audioContextRef.current && nodesRef.current.distortion) {
      applySettings(newSettings, audioContextRef.current, nodesRef.current);
    }
  }, [settings]);

  const resetDefaults = useCallback(() => {
    const defaults = { ...VOICE_DEFAULTS };
    setSettings(defaults);
    if (audioContextRef.current && nodesRef.current.pitchLFO) {
      applySettings(defaults, audioContextRef.current, nodesRef.current);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    nodesRef.current = {};
    processedStreamRef.current = null;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    settings,
    processedStream: processedStreamRef.current,
    processStream,
    setPitch,
    setModulation,
    setDistortion,
    resetDefaults,
    cleanup,
  };
}
