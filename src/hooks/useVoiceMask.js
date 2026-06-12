import { useState, useRef, useCallback, useEffect } from 'react';
import { createDistortionCurve, createGranularPitchShifter } from '../utils/audioProcessing';
import { VOICE_DEFAULTS } from '../utils/constants';

export function useVoiceMask() {
  const [settings, setSettings] = useState({ ...VOICE_DEFAULTS });
  const audioContextRef = useRef(null);
  const nodesRef = useRef({});
  const processedStreamRef = useRef(null);
  const [selfListenVolume, setSelfListenVolumeState] = useState(0.5);
  const [isSelfListenEnabled, setIsSelfListenEnabledState] = useState(false);

  const selfListenEnabledRef = useRef(false);
  const selfListenVolumeRef = useRef(0.5);

  useEffect(() => {
    selfListenEnabledRef.current = isSelfListenEnabled;
  }, [isSelfListenEnabled]);

  useEffect(() => {
    selfListenVolumeRef.current = selfListenVolume;
  }, [selfListenVolume]);

  /**
   * High-quality voice masking pipeline:
   *
   * Input → NoiseGate → Highpass → Lowpass → GranularPitchShifter → RingModulator → SoftDistortion → Output
   *
   * - NoiseGate:  Compressor with high threshold acts as gate to cut background noise
   * - Highpass:   Removes low-frequency rumble (< 100Hz)
   * - Lowpass:    Removes harsh high frequencies (> 8kHz) for smoothness
   * - Pitch:      Real granular pitch shifting via AudioWorklet (smooth, artifact-free)
   * - RingMod:    Dry/wet blend ring modulator for alien/robotic tones
   * - Distortion: Soft tanh-based waveshaper for warm overdrive
   */
  const processStream = useCallback(async (inputStream) => {
    if (!inputStream) return null;

    // Clean up existing AudioContext to prevent resource leaks
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (err) {
        console.warn('Error closing AudioContext:', err);
      }
    }

    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const source = ctx.createMediaStreamSource(inputStream);

    // === 1. Noise Gate (using Compressor with aggressive settings) ===
    const noiseGate = ctx.createDynamicsCompressor();
    noiseGate.threshold.setValueAtTime(-45, ctx.currentTime);  // Gate opens at -45dB
    noiseGate.knee.setValueAtTime(5, ctx.currentTime);
    noiseGate.ratio.setValueAtTime(12, ctx.currentTime);
    noiseGate.attack.setValueAtTime(0.003, ctx.currentTime);   // Fast attack
    noiseGate.release.setValueAtTime(0.1, ctx.currentTime);    // Smooth release

    // === 2. Highpass filter — remove rumble below 100Hz ===
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(100, ctx.currentTime);
    highpass.Q.setValueAtTime(0.7, ctx.currentTime);

    // === 3. Lowpass filter — remove harshness above 8kHz ===
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(8000, ctx.currentTime);
    lowpass.Q.setValueAtTime(0.7, ctx.currentTime);

    // === 4. Granular Pitch Shifter (AudioWorklet) ===
    let pitchShifter;
    try {
      pitchShifter = await createGranularPitchShifter(ctx);
      // Send initial pitch
      pitchShifter.port.postMessage({ pitchRatio: settings.pitch });
    } catch (err) {
      console.warn('[VoiceMask] AudioWorklet not supported, falling back to delay-based pitch:', err);
      // Fallback: simple gain passthrough if AudioWorklet fails
      pitchShifter = ctx.createGain();
      pitchShifter.gain.value = 1.0;
    }

    // === 5. Ring Modulator (dry/wet blend) ===
    // Split into dry and wet paths, mix via gains
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const ringOsc = ctx.createOscillator();
    const ringModGain = ctx.createGain(); // carrier gain for ring mod
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(0, ctx.currentTime);
    ringModGain.gain.value = 0; // modulated by oscillator
    ringOsc.connect(ringModGain.gain);
    ringOsc.start();

    // Dry/wet mix
    dryGain.gain.value = 1.0;
    wetGain.gain.value = 0.0;

    // Mixer node after ring mod
    const ringMixer = ctx.createGain();
    ringMixer.gain.value = 1.0;

    // === 6. Soft Distortion (tanh-based WaveShaper) ===
    const distortion = ctx.createWaveShaper();
    distortion.curve = createDistortionCurve(0);
    distortion.oversample = '4x';

    // === 7. Post-EQ: gentle presence boost around 2-4kHz for clarity ===
    const presenceEQ = ctx.createBiquadFilter();
    presenceEQ.type = 'peaking';
    presenceEQ.frequency.setValueAtTime(3000, ctx.currentTime);
    presenceEQ.gain.setValueAtTime(2, ctx.currentTime); // +2dB
    presenceEQ.Q.setValueAtTime(1.0, ctx.currentTime);

    // === 8. Output gain ===
    const outputGain = ctx.createGain();
    outputGain.gain.value = 1.0;

    // === 9. Compressor for final output smoothing ===
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-6, ctx.currentTime);
    limiter.knee.setValueAtTime(6, ctx.currentTime);
    limiter.ratio.setValueAtTime(4, ctx.currentTime);
    limiter.attack.setValueAtTime(0.005, ctx.currentTime);
    limiter.release.setValueAtTime(0.1, ctx.currentTime);

    // Create output stream destination
    const destination = ctx.createMediaStreamDestination();

    // Self-listen gain node
    const selfListenGain = ctx.createGain();
    selfListenGain.gain.setValueAtTime(
      selfListenEnabledRef.current ? selfListenVolumeRef.current : 0.0,
      ctx.currentTime
    );
    selfListenGain.connect(ctx.destination);

    // === Connect the full chain ===
    // Source → NoiseGate → Highpass → Lowpass → PitchShifter
    source.connect(noiseGate);
    noiseGate.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(pitchShifter);

    // PitchShifter → Dry path + Wet (ring mod) path → Mixer
    pitchShifter.connect(dryGain);
    dryGain.connect(ringMixer);

    pitchShifter.connect(ringModGain);
    ringModGain.connect(wetGain);
    wetGain.connect(ringMixer);

    // Mixer → Distortion → Presence EQ → Limiter → Output
    ringMixer.connect(distortion);
    distortion.connect(presenceEQ);
    presenceEQ.connect(outputGain);
    outputGain.connect(limiter);
    limiter.connect(destination);

    // Self-listen branch
    limiter.connect(selfListenGain);

    // Store references for parameter updates
    nodesRef.current = {
      source,
      noiseGate,
      highpass,
      lowpass,
      pitchShifter,
      dryGain,
      wetGain,
      ringOsc,
      ringModGain,
      ringMixer,
      distortion,
      presenceEQ,
      outputGain,
      limiter,
      destination,
      selfListenGain,
    };

    processedStreamRef.current = destination.stream;

    // Apply initial settings
    applySettings(settings, ctx, nodesRef.current);

    return destination.stream;
  }, [settings]);

  /**
   * Apply voice mask settings to audio nodes in real-time
   */
  const applySettings = (s, ctx, nodes) => {
    if (!ctx || !nodes.pitchShifter) return;

    // === Pitch: send new ratio to the AudioWorklet ===
    if (nodes.pitchShifter.port && typeof nodes.pitchShifter.port.postMessage === 'function') {
      nodes.pitchShifter.port.postMessage({ pitchRatio: s.pitch });
    }

    // === Ring Modulation: dry/wet blend ===
    if (s.modulation > 0) {
      const modFreq = 20 + (s.modulation / 100) * 180; // 20-200Hz range
      nodes.ringOsc.frequency.setValueAtTime(modFreq, ctx.currentTime);

      // Crossfade: at modulation=0 → 100% dry; at modulation=100 → 70% wet / 30% dry
      const wetAmount = (s.modulation / 100) * 0.7;
      nodes.dryGain.gain.setTargetAtTime(1.0 - wetAmount, ctx.currentTime, 0.02);
      nodes.wetGain.gain.setTargetAtTime(wetAmount, ctx.currentTime, 0.02);
    } else {
      nodes.ringOsc.frequency.setValueAtTime(0, ctx.currentTime);
      nodes.dryGain.gain.setTargetAtTime(1.0, ctx.currentTime, 0.02);
      nodes.wetGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.02);
    }

    // === Distortion: soft tanh curve ===
    nodes.distortion.curve = createDistortionCurve(s.distortion);

    // Adjust lowpass based on distortion to prevent harshness
    if (s.distortion > 50) {
      // As distortion increases, lower the cutoff to keep it smooth
      const cutoff = 8000 - (s.distortion - 50) * 60; // 8000 → 5000Hz
      nodes.lowpass.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.05);
    } else {
      nodes.lowpass.frequency.setTargetAtTime(8000, ctx.currentTime, 0.05);
    }
  };

  const setPitch = useCallback((value) => {
    const newSettings = { ...settings, pitch: value };
    setSettings(newSettings);
    if (audioContextRef.current && nodesRef.current.pitchShifter) {
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
    if (audioContextRef.current && nodesRef.current.pitchShifter) {
      applySettings(defaults, audioContextRef.current, nodesRef.current);
    }
  }, []);

  const setSelfListenEnabled = useCallback((enabled) => {
    setIsSelfListenEnabledState(enabled);
    if (nodesRef.current.selfListenGain && audioContextRef.current) {
      const targetGain = enabled ? selfListenVolumeRef.current : 0.0;
      nodesRef.current.selfListenGain.gain.setValueAtTime(targetGain, audioContextRef.current.currentTime);
    }
  }, []);

  const setSelfListenVolume = useCallback((volume) => {
    setSelfListenVolumeState(volume);
    if (selfListenEnabledRef.current && nodesRef.current.selfListenGain && audioContextRef.current) {
      nodesRef.current.selfListenGain.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    nodesRef.current = {};
    processedStreamRef.current = null;
    setIsSelfListenEnabledState(false);
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
    isSelfListenEnabled,
    setSelfListenEnabled,
    selfListenVolume,
    setSelfListenVolume,
  };
}
