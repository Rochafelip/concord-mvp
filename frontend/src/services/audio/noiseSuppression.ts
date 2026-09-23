import { loadRnnoise, RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseWasmSimdPath from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';

// RnnoiseWorkletNode assumes a 48kHz input; LiveKit's shared AudioContext (see
// voiceClient.ts's applyNoiseSuppressionPreference) has no fixed sample rate, so
// init() below verifies it before wiring anything up.
const RNNOISE_SAMPLE_RATE = 48000;

let wasmBinaryPromise: Promise<ArrayBuffer> | null = null;
// Keyed by AudioContext because voiceClient reuses one AudioContext for the whole
// call; addModule()-ing the same worklet module into it twice must be avoided.
const workletModulePromises = new WeakMap<AudioContext, Promise<void>>();

function getWasmBinary(): Promise<ArrayBuffer> {
  if (!wasmBinaryPromise) {
    wasmBinaryPromise = loadRnnoise({ url: rnnoiseWasmPath, simdUrl: rnnoiseWasmSimdPath }).catch((error: unknown) => {
      // Clear the cache so a transient failure (e.g. a network blip) doesn't permanently poison
      // every future attempt for the rest of the page session — the next call retries from scratch.
      wasmBinaryPromise = null;
      throw error;
    });
  }
  return wasmBinaryPromise;
}

function addWorkletModule(audioContext: AudioContext): Promise<void> {
  let promise = workletModulePromises.get(audioContext);
  if (!promise) {
    promise = audioContext.audioWorklet.addModule(rnnoiseWorkletPath).catch((error: unknown) => {
      workletModulePromises.delete(audioContext);
      throw error;
    });
    workletModulePromises.set(audioContext, promise);
  }
  return promise;
}

export function isNoiseSuppressionSupported(): boolean {
  return typeof AudioWorklet !== 'undefined';
}

export interface NoiseSuppressionNode {
  node: RnnoiseWorkletNode;
  destroy: () => void;
}

/**
 * Builds a connected `source -> RnnoiseWorkletNode` pair for `track` and returns the node as the
 * chain's output, so callers (audioPipeline.ts) can connect further stages after it or straight to
 * a destination. Split out from the old standalone TrackProcessor so noise suppression can be
 * chained with the mic-sensitivity gate on the single processor slot LiveKit allows per track.
 */
export async function createNoiseSuppressionNode(
  audioContext: AudioContext,
  track: MediaStreamTrack,
): Promise<NoiseSuppressionNode> {
  if (audioContext.sampleRate !== RNNOISE_SAMPLE_RATE) {
    throw new Error(`RNNoise requires a ${RNNOISE_SAMPLE_RATE}Hz AudioContext, got ${audioContext.sampleRate}Hz`);
  }
  const [wasmBinary] = await Promise.all([getWasmBinary(), addWorkletModule(audioContext)]);
  const node = new RnnoiseWorkletNode(audioContext, { wasmBinary, maxChannels: 2 });
  const source = audioContext.createMediaStreamSource(new MediaStream([track]));
  source.connect(node);
  return {
    node,
    destroy: () => {
      node.destroy();
      node.disconnect();
      source.disconnect();
    },
  };
}
