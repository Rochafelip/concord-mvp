import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGateNode } from './micGate';
import { createNoiseSuppressionNode, type NoiseSuppressionNode } from './noiseSuppression';
import { buildAudioProcessor } from './audioPipeline';

vi.mock('./noiseSuppression', () => ({ createNoiseSuppressionNode: vi.fn() }));
vi.mock('./micGate', () => ({ createGateNode: vi.fn() }));

function fakeAudioContext() {
  return {
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
    createMediaStreamDestination: vi.fn(() => ({ stream: { getAudioTracks: () => ['processed-track'] } })),
  } as unknown as AudioContext;
}

function fakeTrack(): MediaStreamTrack {
  return {} as MediaStreamTrack;
}

describe('buildAudioProcessor', () => {
  beforeEach(() => {
    vi.mocked(createNoiseSuppressionNode).mockReset();
    vi.mocked(createGateNode).mockReset();
  });

  it('wires a plain source straight to the gate when noise suppression is off', async () => {
    const audioContext = fakeAudioContext();
    const plainSource = { connect: vi.fn() };
    vi.mocked(audioContext.createMediaStreamSource).mockReturnValue(plainSource as unknown as MediaStreamAudioSourceNode);
    const gateNode = { connect: vi.fn(), parameters: { get: vi.fn() }, context: { currentTime: 0 } };
    vi.mocked(createGateNode).mockResolvedValue(gateNode as unknown as AudioWorkletNode);

    const processor = buildAudioProcessor({ noiseSuppression: false, gate: { enabled: true, thresholdDb: -40 } });
    await processor.init({ track: fakeTrack(), audioContext } as any);

    expect(createNoiseSuppressionNode).not.toHaveBeenCalled();
    expect(createGateNode).toHaveBeenCalledWith(audioContext, -40);
    expect(plainSource.connect).toHaveBeenCalledWith(gateNode);
    expect(gateNode.connect).toHaveBeenCalledWith(vi.mocked(audioContext.createMediaStreamDestination).mock.results[0].value);
  });

  it('connects the noise-suppression node straight to the destination when the gate is off', async () => {
    const audioContext = fakeAudioContext();
    const suppressionNode = { connect: vi.fn() };
    vi.mocked(createNoiseSuppressionNode).mockResolvedValue({
      node: suppressionNode as unknown as NoiseSuppressionNode['node'],
      destroy: vi.fn(),
    });

    const processor = buildAudioProcessor({ noiseSuppression: true, gate: { enabled: false, thresholdDb: -50 } });
    await processor.init({ track: fakeTrack(), audioContext } as any);

    expect(createGateNode).not.toHaveBeenCalled();
    expect(suppressionNode.connect).toHaveBeenCalledWith(vi.mocked(audioContext.createMediaStreamDestination).mock.results[0].value);
  });

  it('chains noise suppression into the gate, in that order, when both are enabled', async () => {
    const audioContext = fakeAudioContext();
    const suppressionNode = { connect: vi.fn() };
    vi.mocked(createNoiseSuppressionNode).mockResolvedValue({
      node: suppressionNode as unknown as NoiseSuppressionNode['node'],
      destroy: vi.fn(),
    });
    const gateNode = { connect: vi.fn(), parameters: { get: vi.fn() }, context: { currentTime: 0 } };
    vi.mocked(createGateNode).mockResolvedValue(gateNode as unknown as AudioWorkletNode);

    const processor = buildAudioProcessor({ noiseSuppression: true, gate: { enabled: true, thresholdDb: -35 } });
    await processor.init({ track: fakeTrack(), audioContext } as any);

    expect(suppressionNode.connect).toHaveBeenCalledWith(gateNode);
    expect(gateNode.connect).toHaveBeenCalledWith(vi.mocked(audioContext.createMediaStreamDestination).mock.results[0].value);
  });

  it('sets processedTrack to the destination stream track after init', async () => {
    const audioContext = fakeAudioContext();
    vi.mocked(createNoiseSuppressionNode).mockResolvedValue({
      node: { connect: vi.fn() } as unknown as NoiseSuppressionNode['node'],
      destroy: vi.fn(),
    });

    const processor = buildAudioProcessor({ noiseSuppression: true, gate: { enabled: false, thresholdDb: -50 } });
    await processor.init({ track: fakeTrack(), audioContext } as any);

    expect(processor.processedTrack).toBe('processed-track');
  });

  it('destroy() disconnects the gate node and destroys the noise-suppression node', async () => {
    const audioContext = fakeAudioContext();
    const suppressionDestroy = vi.fn();
    vi.mocked(createNoiseSuppressionNode).mockResolvedValue({
      node: { connect: vi.fn() } as unknown as NoiseSuppressionNode['node'],
      destroy: suppressionDestroy,
    });
    const gateNode = { connect: vi.fn(), disconnect: vi.fn(), parameters: { get: vi.fn() }, context: { currentTime: 0 } };
    vi.mocked(createGateNode).mockResolvedValue(gateNode as unknown as AudioWorkletNode);

    const processor = buildAudioProcessor({ noiseSuppression: true, gate: { enabled: true, thresholdDb: -50 } });
    await processor.init({ track: fakeTrack(), audioContext } as any);
    await processor.destroy();

    expect(gateNode.disconnect).toHaveBeenCalled();
    expect(suppressionDestroy).toHaveBeenCalled();
  });

  it('setGateThreshold updates the live AudioParam without rebuilding the chain', async () => {
    const audioContext = fakeAudioContext();
    const param = { setValueAtTime: vi.fn() };
    const gateNode = { connect: vi.fn(), parameters: { get: vi.fn(() => param) }, context: { currentTime: 1.5 } };
    vi.mocked(createGateNode).mockResolvedValue(gateNode as unknown as AudioWorkletNode);

    const processor = buildAudioProcessor({ noiseSuppression: false, gate: { enabled: true, thresholdDb: -50 } });
    await processor.init({ track: fakeTrack(), audioContext } as any);
    processor.setGateThreshold(-20);

    expect(param.setValueAtTime).toHaveBeenCalledWith(-20, 1.5);
  });

  it('setGateThreshold does nothing when the gate is not part of the chain', async () => {
    const audioContext = fakeAudioContext();
    vi.mocked(createNoiseSuppressionNode).mockResolvedValue({
      node: { connect: vi.fn() } as unknown as NoiseSuppressionNode['node'],
      destroy: vi.fn(),
    });

    const processor = buildAudioProcessor({ noiseSuppression: true, gate: { enabled: false, thresholdDb: -50 } });
    await processor.init({ track: fakeTrack(), audioContext } as any);

    expect(() => processor.setGateThreshold(-20)).not.toThrow();
  });
});
