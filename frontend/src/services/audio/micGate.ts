import micGateWorkletPath from './micGateWorklet.js?url';

export { isAudioWorkletSupported as isMicGateSupported } from './audioWorkletSupport';

// Keyed by AudioContext because voiceClient reuses one AudioContext for the whole call;
// addModule()-ing the same worklet module into it twice must be avoided. Same pattern as
// noiseSuppression.ts's workletModulePromises, kept separate since it's a different module URL.
const workletModulePromises = new WeakMap<AudioContext, Promise<void>>();

function addGateWorkletModule(audioContext: AudioContext): Promise<void> {
  let promise = workletModulePromises.get(audioContext);
  if (!promise) {
    promise = audioContext.audioWorklet.addModule(micGateWorkletPath).catch((error: unknown) => {
      workletModulePromises.delete(audioContext);
      throw error;
    });
    workletModulePromises.set(audioContext, promise);
  }
  return promise;
}

/** Builds the mic-sensitivity noise-gate AudioWorkletNode, primed with the given threshold. */
export async function createGateNode(audioContext: AudioContext, thresholdDb: number): Promise<AudioWorkletNode> {
  await addGateWorkletModule(audioContext);
  return new AudioWorkletNode(audioContext, 'mic-gate', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 2,
    parameterData: { thresholdDb },
  });
}
