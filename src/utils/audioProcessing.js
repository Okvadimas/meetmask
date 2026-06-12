/**
 * Generate a SMOOTH distortion curve for WaveShaperNode
 * Uses soft-clipping (tanh-based) instead of harsh algebraic clipping
 * @param {number} amount - Distortion amount (0-100)
 * @returns {Float32Array}
 */
export function createDistortionCurve(amount) {
  if (amount === 0) {
    // Identity curve — no distortion
    const curve = new Float32Array(8192);
    for (let i = 0; i < 8192; i++) {
      curve[i] = (i * 2) / 8192 - 1;
    }
    return curve;
  }

  const samples = 8192;
  const curve = new Float32Array(samples);
  // Map 0-100 to a gentle drive range
  const drive = 1 + (amount / 100) * 8; // 1x to 9x drive

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Soft-clipping using tanh — much smoother than algebraic clipping
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}

/**
 * Get normalized audio level from AnalyserNode
 * @param {AnalyserNode} analyser
 * @returns {number} 0-1 normalized audio level
 */
export function getAudioLevel(analyser) {
  if (!analyser) return 0;

  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);

  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const val = (data[i] - 128) / 128;
    sum += val * val;
  }
  return Math.sqrt(sum / data.length);
}

/**
 * AudioWorklet processor code for real-time granular pitch shifting.
 *
 * Technique: Splits audio into small overlapping grains, plays them back
 * at a different rate, and crossfades between two grain readers to avoid
 * clicks and gaps. This is the standard technique used in professional
 * pitch shifters (Eventide, Soundtoys, etc.)
 *
 * @returns {string} - AudioWorklet processor code as a string (to be used with Blob URL)
 */
export function getGranularPitchShifterCode() {
  return `
class GranularPitchProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    // Grain size in samples (default ~50ms at 48kHz = 2400 samples)
    this.grainSize = Math.round(sampleRate * 0.05);
    this.buffer = new Float32Array(this.grainSize * 4);
    this.bufferLength = this.buffer.length;
    this.writePos = 0;
    this.readPos1 = 0;
    this.readPos2 = this.grainSize; // offset by half a grain
    this.pitchRatio = 1.0;
    this.crossfadePos = 0;

    // DSP Noise Gate state variables
    this.envelope = 0;
    this.gateThreshold = 0.015; // default threshold (approx -36dB)
    this.attackCoef = Math.exp(-1 / (sampleRate * 0.005)); // 5ms attack time
    this.releaseCoef = Math.exp(-1 / (sampleRate * 0.15)); // 150ms release time

    this.port.onmessage = (e) => {
      if (e.data.pitchRatio !== undefined) {
        this.pitchRatio = e.data.pitchRatio;
      }
      if (e.data.gateThreshold !== undefined) {
        this.gateThreshold = e.data.gateThreshold;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const inputChannel = input[0];
    const outputChannel = output[0];
    const blockSize = inputChannel.length;

    for (let i = 0; i < blockSize; i++) {
      const inputSample = inputChannel[i];

      // Envelope follower on raw input amplitude
      const inputAbs = Math.abs(inputSample);
      if (inputAbs > this.envelope) {
        this.envelope = inputAbs * (1 - this.attackCoef) + this.envelope * this.attackCoef;
      } else {
        this.envelope = inputAbs * (1 - this.releaseCoef) + this.envelope * this.releaseCoef;
      }

      // Calculate gate gain (0.0 to 1.0)
      let gateGain = 1.0;
      if (this.envelope < this.gateThreshold) {
        // Smooth quadratic attenuation curve for natural gating (no harsh clicks)
        const ratio = this.envelope / this.gateThreshold;
        gateGain = ratio * ratio;
        if (gateGain < 0.01) gateGain = 0.0;
      }

      // Write raw input into circular buffer
      this.buffer[this.writePos] = inputSample;
      this.writePos = (this.writePos + 1) % this.bufferLength;

      // Read from two positions at the pitch-shifted rate
      const idx1 = Math.floor(this.readPos1) % this.bufferLength;
      const idx2 = Math.floor(this.readPos2) % this.bufferLength;

      // Fractional interpolation for smoother output
      const frac1 = this.readPos1 - Math.floor(this.readPos1);
      const next1 = (idx1 + 1) % this.bufferLength;
      const sample1 = this.buffer[idx1] * (1 - frac1) + this.buffer[next1] * frac1;

      const frac2 = this.readPos2 - Math.floor(this.readPos2);
      const next2 = (idx2 + 1) % this.bufferLength;
      const sample2 = this.buffer[idx2] * (1 - frac2) + this.buffer[next2] * frac2;

      // Crossfade between the two grain readers using a smooth Hann window
      const fadePhase = (this.crossfadePos / this.grainSize) * Math.PI;
      const fade1 = Math.cos(fadePhase) * 0.5 + 0.5;
      const fade2 = 1.0 - fade1;

      // Combine pitch-shifted grains and apply the noise gate gain
      outputChannel[i] = (sample1 * fade1 + sample2 * fade2) * gateGain;

      // Advance read positions by the pitch ratio
      this.readPos1 = (this.readPos1 + this.pitchRatio) % this.bufferLength;
      this.readPos2 = (this.readPos2 + this.pitchRatio) % this.bufferLength;

      // Advance crossfade and reset grain positions when a grain completes
      this.crossfadePos++;
      if (this.crossfadePos >= this.grainSize) {
        this.crossfadePos = 0;
        // Resync the fading-out reader to near the write position
        this.readPos1 = (this.writePos - this.grainSize + this.bufferLength) % this.bufferLength;
        // Swap: on next grain, the other reader resyncs
        const temp = this.readPos1;
        this.readPos1 = this.readPos2;
        this.readPos2 = temp;
      }
    }

    return true;
  }
}

registerProcessor('granular-pitch-processor', GranularPitchProcessor);
`;
}

/**
 * Create and register the granular pitch shifter AudioWorklet
 * @param {AudioContext} ctx
 * @returns {Promise<AudioWorkletNode>}
 */
export async function createGranularPitchShifter(ctx) {
  const code = getGranularPitchShifterCode();
  const blob = new Blob([code], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);

  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }

  const node = new AudioWorkletNode(ctx, 'granular-pitch-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });

  return node;
}
