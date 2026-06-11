/**
 * Generate a distortion curve for WaveShaperNode
 * @param {number} amount - Distortion amount (0-100)
 * @returns {Float32Array}
 */
export function createDistortionCurve(amount) {
  const k = amount;
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] =
      ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
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
 * Create a pitch shifter using detune on an oscillator-based approach
 * This uses a simple granular method via buffer manipulation
 */
export class PitchShifter {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();
    this.pitchRatio = 1.0;

    // Use a delay-based pitch shifting approach
    this.delayNode1 = this.ctx.createDelay(1.0);
    this.delayNode2 = this.ctx.createDelay(1.0);
    this.gain1 = this.ctx.createGain();
    this.gain2 = this.ctx.createGain();
    this.merger = this.ctx.createChannelMerger(2);

    // Connect the cross-fade delay network
    this.input.connect(this.delayNode1);
    this.input.connect(this.delayNode2);
    this.delayNode1.connect(this.gain1);
    this.delayNode2.connect(this.gain2);
    this.gain1.connect(this.output);
    this.gain2.connect(this.output);

    this._grainSize = 0.1; // seconds
    this._running = false;
  }

  set pitch(value) {
    this.pitchRatio = Math.max(0.5, Math.min(2.0, value));
    this._updateDelay();
  }

  _updateDelay() {
    if (this.pitchRatio === 1.0) {
      this.delayNode1.delayTime.value = 0;
      this.delayNode2.delayTime.value = 0;
      this.gain1.gain.value = 1;
      this.gain2.gain.value = 0;
      return;
    }

    const now = this.ctx.currentTime;
    const rate = 1 - this.pitchRatio;
    const grainSize = this._grainSize;

    // Cross-fade between two delay taps for smooth pitch shifting
    this.gain1.gain.value = 0.5;
    this.gain2.gain.value = 0.5;

    // Modulate delay times
    const delayAmount = Math.abs(rate) * grainSize;
    this.delayNode1.delayTime.setValueAtTime(delayAmount * 0.5, now);
    this.delayNode2.delayTime.setValueAtTime(delayAmount, now);
  }

  connect(destination) {
    this.output.connect(destination);
    return destination;
  }

  disconnect() {
    this.output.disconnect();
  }
}
