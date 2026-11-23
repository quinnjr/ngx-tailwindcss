import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeIpcService } from './ipc.service';
import { setElectronIpcBridge } from './electron-bridge.util';

describe('NativeIpcService', () => {
  let service: NativeIpcService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NativeIpcService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('on()', () => {
    it('registers a window event listener for the channel (web fallback)', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      await service.on('spy-add-channel', vi.fn());
      expect(addSpy).toHaveBeenCalledWith('spy-add-channel', expect.any(Function));
    });

    it('delivers payloads dispatched on the channel', async () => {
      const callback = vi.fn();
      await service.on('deliver-channel', callback);

      service.emit('deliver-channel', { value: 42 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ value: 42 });
    });
  });

  describe('off()', () => {
    it('removes the underlying window listener for the callback', async () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const callback = vi.fn();
      await service.on('spy-remove-channel', callback);

      service.off('spy-remove-channel', callback);

      expect(removeSpy).toHaveBeenCalledWith('spy-remove-channel', expect.any(Function));
    });

    it('stops delivery after off(channel, callback)', async () => {
      const callback = vi.fn();
      await service.on('stop-channel', callback);

      service.off('stop-channel', callback);
      service.emit('stop-channel', 'after-off');

      expect(callback).not.toHaveBeenCalled();
    });

    it('keeps other callbacks on the channel alive', async () => {
      const removed = vi.fn();
      const kept = vi.fn();
      await service.on('multi-channel', removed);
      await service.on('multi-channel', kept);

      service.off('multi-channel', removed);
      service.emit('multi-channel', 'payload');

      expect(removed).not.toHaveBeenCalled();
      expect(kept).toHaveBeenCalledWith('payload');
    });

    it('tears down every callback on the channel when no callback is given', async () => {
      const first = vi.fn();
      const second = vi.fn();
      await service.on('teardown-channel', first);
      await service.on('teardown-channel', second);

      service.off('teardown-channel');
      service.emit('teardown-channel', 'payload');

      expect(first).not.toHaveBeenCalled();
      expect(second).not.toHaveBeenCalled();
    });
  });

  describe('unlisten function returned by on()', () => {
    it('stops delivery when invoked', async () => {
      const callback = vi.fn();
      const unlisten = await service.on('unlisten-channel', callback);

      unlisten();
      service.emit('unlisten-channel', 'payload');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('destroy()', () => {
    it('removes all listeners across channels', async () => {
      const a = vi.fn();
      const b = vi.fn();
      await service.on('destroy-a', a);
      await service.on('destroy-b', b);

      service.destroy();
      service.emit('destroy-a', 1);
      service.emit('destroy-b', 2);

      expect(a).not.toHaveBeenCalled();
      expect(b).not.toHaveBeenCalled();
    });
  });

  describe('Electron preload bridge', () => {
    afterEach(() => {
      setElectronIpcBridge(null);
    });

    it('invokes through the bridge and unsubscribes via the function on() returns', async () => {
      const unsubscribe = vi.fn();
      let listener: ((event: unknown, data: unknown) => void) | undefined;
      const bridge = {
        send: vi.fn(),
        invoke: vi.fn(() => Promise.resolve('pong')),
        on: vi.fn((_channel: string, fn: (event: unknown, data: unknown) => void) => {
          listener = fn;
          return unsubscribe;
        }),
        once: vi.fn(),
      };
      setElectronIpcBridge(bridge);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const electronService = TestBed.inject(NativeIpcService);

      await expect(electronService.invoke('ping', { a: 1 })).resolves.toEqual({
        success: true,
        data: 'pong',
      });
      expect(bridge.invoke).toHaveBeenCalledWith('ping', { a: 1 });

      const callback = vi.fn();
      const off = await electronService.on('bridge-channel', callback);
      listener?.({}, 'payload');
      expect(callback).toHaveBeenCalledWith('payload');

      off();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
