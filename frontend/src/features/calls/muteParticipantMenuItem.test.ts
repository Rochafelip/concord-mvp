import { describe, expect, it, vi } from 'vitest';
import { voiceClient } from '../../services/voiceClient';
import { muteParticipantMenuItem } from './muteParticipantMenuItem';

vi.mock('../../services/voiceClient', () => ({
  voiceClient: { setParticipantVolume: vi.fn() },
}));

describe('muteParticipantMenuItem', () => {
  it('mutes the participant locally when selected', () => {
    const item = muteParticipantMenuItem('u2');

    expect(item.label).toBe('Silenciar');
    item.onSelect();

    expect(voiceClient.setParticipantVolume).toHaveBeenCalledWith('u2', 0);
  });
});
