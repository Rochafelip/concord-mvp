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

// jsdom has no MediaStream. audioPipeline.ts's buildAudioProcessor() constructs one directly when
// chaining a plain source into the mic-sensitivity gate (no noise-suppression node to source from
// instead) — its own tests build that chain against a fake AudioContext, so the real browser
// constructor needs to exist even though nothing reads its contents.
if (typeof MediaStream === 'undefined') {
  globalThis.MediaStream = class MediaStream {
    tracks: unknown[]
    constructor(tracks: unknown[] = []) {
      this.tracks = tracks
    }
  } as unknown as typeof MediaStream
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

// jsdom has no IntersectionObserver. emoji-picker-react (used by
// components/EmojiPickerButton.tsx) uses it to only render each emoji row once it scrolls into
// view — reporting every observed element as immediately intersecting (rather than a no-op) is
// what makes its emoji buttons actually appear in tests, since nothing in a jsdom test ever
// scrolls the picker to trigger a real intersection.
if (typeof IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    private callback: IntersectionObserverCallback
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
    }
    observe(target: Element) {
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as globalThis.IntersectionObserver,
      )
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver
}

// jsdom has no window.matchMedia. @formkit/auto-animate (used by useAutoAnimate() in
// FriendsPage.tsx and ChannelSidebar.tsx) checks prefers-reduced-motion through it on every
// animated element, so it needs to exist even though no test asserts on reduced-motion behavior.
if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

// jsdom implements neither half of the object-URL API. The chat composer creates one per staged
// attachment to render its thumbnail and revokes it when the attachment is dropped, so both need
// to exist; the counter keeps the returned URLs distinct so a test can tell two previews apart.
if (typeof URL.createObjectURL === 'undefined') {
  let objectUrlCount = 0
  URL.createObjectURL = () => `blob:mock-${++objectUrlCount}`
  URL.revokeObjectURL = () => {}
}
