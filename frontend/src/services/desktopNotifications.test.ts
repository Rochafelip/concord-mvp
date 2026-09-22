import { afterEach, describe, expect, it, vi } from 'vitest';
import { notify, playChime, requestPermission } from './desktopNotifications';

describe('desktopNotifications', () => {
  afterEach(() => {
    delete (globalThis as unknown as { Notification?: unknown }).Notification;
    delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
  });

  describe('requestPermission', () => {
    it('requests permission when it has not been decided yet', () => {
      const requestPermissionMock = vi.fn();
      (globalThis as unknown as { Notification: unknown }).Notification = {
        permission: 'default',
        requestPermission: requestPermissionMock,
      };

      requestPermission();

      expect(requestPermissionMock).toHaveBeenCalled();
    });

    it('does not re-request permission once already granted', () => {
      const requestPermissionMock = vi.fn();
      (globalThis as unknown as { Notification: unknown }).Notification = {
        permission: 'granted',
        requestPermission: requestPermissionMock,
      };

      requestPermission();

      expect(requestPermissionMock).not.toHaveBeenCalled();
    });

    it('does nothing when the browser has no Notification API', () => {
      expect(() => requestPermission()).not.toThrow();
    });
  });

  describe('notify', () => {
    function mockNotificationCtor(permission: string) {
      const instances: Array<{ onclick: (() => void) | null; close: () => void }> = [];
      const ctor = vi.fn().mockImplementation(function (this: { onclick: (() => void) | null; close: () => void }) {
        this.onclick = null;
        this.close = vi.fn();
        instances.push(this);
      });
      (ctor as unknown as { permission: string }).permission = permission;
      (globalThis as unknown as { Notification: unknown }).Notification = ctor;
      return { ctor, instances };
    }

    it('creates a Notification with the sender as title and the channel/server/content as body', () => {
      const { ctor } = mockNotificationCtor('granted');

      notify({ title: 'Alice', body: '#geral · Meu Servidor\nOi!', onClick: vi.fn() });

      expect(ctor).toHaveBeenCalledWith('Alice', expect.objectContaining({ body: '#geral · Meu Servidor\nOi!' }));
    });

    it('does not create a Notification when permission has not been granted', () => {
      const { ctor } = mockNotificationCtor('denied');

      notify({ title: 'Alice', body: 'Oi!', onClick: vi.fn() });

      expect(ctor).not.toHaveBeenCalled();
    });

    it('does nothing when the browser has no Notification API', () => {
      expect(() => notify({ title: 'Alice', body: 'Oi!', onClick: vi.fn() })).not.toThrow();
    });

    it('focuses the window and runs onClick when the notification is clicked', () => {
      const { instances } = mockNotificationCtor('granted');
      const focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => {});
      const onClick = vi.fn();

      notify({ title: 'Alice', body: 'Oi!', onClick });
      instances[0].onclick?.();

      expect(focusSpy).toHaveBeenCalled();
      expect(onClick).toHaveBeenCalled();
      focusSpy.mockRestore();
    });
  });

  describe('playChime', () => {
    it('does not throw when the browser has no AudioContext', () => {
      expect(() => playChime()).not.toThrow();
    });

    it('starts an oscillator through AudioContext when it is available', () => {
      const oscillator = { frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      const gain = {
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      };
      const audioContextCtor = vi.fn().mockImplementation(function AudioContextMock() {
        return {
          currentTime: 0,
          createOscillator: () => oscillator,
          createGain: () => gain,
          destination: {},
          close: vi.fn(),
        };
      });
      (globalThis as unknown as { AudioContext: unknown }).AudioContext = audioContextCtor;

      playChime();

      expect(audioContextCtor).toHaveBeenCalled();
      expect(oscillator.start).toHaveBeenCalled();
    });
  });
});
