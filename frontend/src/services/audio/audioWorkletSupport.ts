/** Shared feature check backing both noiseSuppression.ts's and micGate.ts's support checks, since both are AudioWorklet-based. */
export function isAudioWorkletSupported(): boolean {
  return typeof AudioWorklet !== 'undefined';
}
