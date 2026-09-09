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

// jsdom has no ResizeObserver. react-resizable-panels (used by ServerLayout's resizable
// channel sidebar) observes its Group element's size on mount, so it needs the constructor to
// exist even though no test asserts on resize callbacks.
if (typeof ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
