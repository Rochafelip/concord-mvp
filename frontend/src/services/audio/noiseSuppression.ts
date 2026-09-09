import { loadRnnoise, RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseWasmSimdPath from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client';

// RnnoiseWorkletNode assumes a 48kHz input; LiveKit's shared AudioContext (see
// voiceClient.ts's applyNoiseSuppressionPreference) has no fixed sample rate, so
// init() below verifies it before wiring anything up.
const RNNOISE_SAMPLE_RATE = 48000;

let wasmBinaryPromise: Promise<ArrayBuffer> | null = null;
// Keyed by AudioContext because voiceClient reuses one AudioContext for the whole
// call; addModule()-ing the same worklet module into it twice must be avoided.
const workletModulePromises = new WeakMap<AudioContext, Promise<void>>();

function getWasmBinary(): Promise<ArrayBuffer> {
  wasmBinaryPromise ??= loadRnnoise({ url: rnnoiseWasmPath, simdUrl: rnnoiseWasmSimdPath });
  return wasmBinaryPromise;
}

function addWorkletModule(audioContext: AudioContext): Promise<void> {
  let promise = workletModulePromises.get(audioContext);
  if (!promise) {
    promise = audioContext.audioWorklet.addModule(rnnoiseWorkletPath);
    workletModulePromises.set(audioContext, promise);
  }
  return promise;
}

export function isNoiseSuppressionSupported(): boolean {
  return typeof AudioWorklet !== 'undefined';
}

export function createNoiseSuppressionProcessor(): TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  let node: RnnoiseWorkletNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;

  return {
    name: 'noise-suppression',
    async init(opts) {
      const { track, audioContext } = opts;
      if (audioContext.sampleRate !== RNNOISE_SAMPLE_RATE) {
        throw new Error(`RNNoise requires a ${RNNOISE_SAMPLE_RATE}Hz AudioContext, got ${audioContext.sampleRate}Hz`);
      }
      const [wasmBinary] = await Promise.all([getWasmBinary(), addWorkletModule(audioContext)]);
      node = new RnnoiseWorkletNode(audioContext, { wasmBinary, maxChannels: 2 });
      source = audioContext.createMediaStreamSource(new MediaStream([track]));
      destination = audioContext.createMediaStreamDestination();
      source.connect(node).connect(destination);
      this.processedTrack = destination.stream.getAudioTracks()[0];
    },
    async restart(opts) {
      await this.destroy();
      await this.init(opts);
    },
    async destroy() {
      node?.destroy();
      node?.disconnect();
      source?.disconnect();
      node = null;
      source = null;
      destination = null;
    },
  };
}
