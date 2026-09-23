// Plain AudioWorkletProcessor — runs in its own AudioWorkletGlobalScope, loaded via
// audioContext.audioWorklet.addModule() (see micGate.ts's createGateNode). No imports: worklet
// modules can't reliably resolve relative ES module imports across every supported browser, so
// this stays self-contained — the same approach already used for the vendored rnnoiseWorklet.js
// this project loads the same way for noise suppression.
//
// A simple one-pole envelope follower: the shared peak level across channels drives a gain
// envelope toward 1 (open) or 0 (closed) against `thresholdDb`, with a fast attack (so speech
// onset isn't clipped) and a slower release (so brief gaps mid-sentence aren't chopped).
const ATTACK_SECONDS = 0.005;
const RELEASE_SECONDS = 0.15;
const SILENCE_FLOOR = 1e-8; // avoids log10(0) = -Infinity for a fully silent block

class MicGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'thresholdDb', defaultValue: -50, minValue: -100, maxValue: 0, automationRate: 'k-rate' }];
  }

  constructor() {
    super();
    this.envelope = 0;
    this.attackCoeff = 1 - Math.exp(-1 / (ATTACK_SECONDS * sampleRate));
    this.releaseCoeff = 1 - Math.exp(-1 / (RELEASE_SECONDS * sampleRate));
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;
    const thresholdDb = parameters.thresholdDb[0];
    const frames = input[0].length;

    for (let i = 0; i < frames; i++) {
      let peak = 0;
      for (let channel = 0; channel < input.length; channel++) {
        peak = Math.max(peak, Math.abs(input[channel][i]));
      }
      const amplitudeDb = 20 * Math.log10(Math.max(peak, SILENCE_FLOOR));
      const target = amplitudeDb > thresholdDb ? 1 : 0;
      const coeff = target > this.envelope ? this.attackCoeff : this.releaseCoeff;
      this.envelope += (target - this.envelope) * coeff;

      for (let channel = 0; channel < input.length; channel++) {
        output[channel][i] = input[channel][i] * this.envelope;
      }
    }
    return true;
  }
}

registerProcessor('mic-gate', MicGateProcessor);
