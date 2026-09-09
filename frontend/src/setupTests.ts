import '@testing-library/jest-dom'

// jsdom has no Web Audio API. @sapphi-red/web-noise-suppressor (used by
// src/services/audio/noiseSuppression.ts) declares its worklet-node classes as
// `class X extends AudioWorkletNode` at module scope, so merely importing that
// package throws `ReferenceError: AudioWorkletNode is not defined` under jsdom.
// No test instantiates this class; it only needs to exist for that
// class-definition check to succeed.
if (typeof AudioWorkletNode === 'undefined') {
  globalThis.AudioWorkletNode = class AudioWorkletNode {} as unknown as typeof AudioWorkletNode
}
