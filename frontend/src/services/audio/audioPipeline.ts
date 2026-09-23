import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client';
import { createGateNode } from './micGate';
import { createNoiseSuppressionNode } from './noiseSuppression';

export interface AudioPipelineConfig {
  noiseSuppression: boolean;
  gate: { enabled: boolean; thresholdDb: number };
}

export type AudioPipelineProcessor = TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> & {
  setGateThreshold: (thresholdDb: number) => void;
};

/**
 * Builds the single combined TrackProcessor LiveKit allows per track, wiring in noise suppression
 * and/or the mic-sensitivity gate per `config`. Order is fixed: suppression cleans the signal
 * first, then the gate decides on the already-denoised signal — avoids the gate misreading
 * residual hiss as speech. Only meant to be called when at least one of the two is enabled;
 * callers remove the processor entirely (track.stopProcessor()) when neither is, so a bare
 * passthrough chain never needs to exist here.
 */
export function buildAudioProcessor(config: AudioPipelineConfig): AudioPipelineProcessor {
  let suppression: Awaited<ReturnType<typeof createNoiseSuppressionNode>> | null = null;
  let gateNode: AudioWorkletNode | null = null;
  let plainSource: MediaStreamAudioSourceNode | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;

  return {
    name: 'audio-pipeline',
    async init(opts) {
      const { track, audioContext } = opts;
      destination = audioContext.createMediaStreamDestination();

      let head: AudioNode;
      if (config.noiseSuppression) {
        suppression = await createNoiseSuppressionNode(audioContext, track);
        head = suppression.node;
      } else {
        plainSource = audioContext.createMediaStreamSource(new MediaStream([track]));
        head = plainSource;
      }

      if (config.gate.enabled) {
        gateNode = await createGateNode(audioContext, config.gate.thresholdDb);
        head.connect(gateNode);
        head = gateNode;
      }

      head.connect(destination);
      this.processedTrack = destination.stream.getAudioTracks()[0];
    },
    async restart(opts) {
      await this.destroy();
      await this.init(opts);
    },
    async destroy() {
      gateNode?.disconnect();
      suppression?.destroy();
      plainSource?.disconnect();
      gateNode = null;
      suppression = null;
      plainSource = null;
      destination = null;
    },
    setGateThreshold(thresholdDb: number) {
      const param = gateNode?.parameters.get('thresholdDb');
      if (!param || !gateNode) return;
      param.setValueAtTime(thresholdDb, gateNode.context.currentTime);
    },
  };
}
