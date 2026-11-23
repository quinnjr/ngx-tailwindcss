import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FileInfo,
  MUSIC_FILE_FILTERS,
  NativePlatformService,
  UnsupportedOnPlatformError,
} from './native-platform.service';

describe('NativePlatformService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('downloadBlob', () => {
    it('should not revoke the object URL until after the download has started', () => {
      vi.useFakeTimers();
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);

      const service = TestBed.inject(NativePlatformService);
      service.downloadBlob('file.txt', new Blob(['x']));

      expect(click).toHaveBeenCalledOnce();
      expect(revoke).not.toHaveBeenCalled();
      expect(document.querySelector('a[download]')).toBeNull();

      vi.runAllTimers();
      expect(revoke).toHaveBeenCalledWith('blob:test');
    });
  });

  describe('Tauri', () => {
    afterEach(() => {
      delete (window as unknown as Record<string, unknown>)['__TAURI__'];
    });

    it('should open extension-less paths (e.g. directories) instead of rejecting', async () => {
      (window as unknown as Record<string, unknown>)['__TAURI__'] = {
        dialog: { open: vi.fn().mockResolvedValue('/home/user/Scores') },
        path: {
          basename: vi.fn((p: string) => Promise.resolve(p.split('/').pop())),
          // Tauri rejects when the path has no extension
          extname: vi.fn((p: string) => {
            const match = /\.([^./]+)$/.exec(p);
            return match
              ? Promise.resolve(match[1])
              : Promise.reject(new Error("Couldn't get the extension of the file"));
          }),
        },
      };
      const service = TestBed.inject(NativePlatformService);
      expect(service.isTauri()).toBe(true);

      await expect(service.openFile({ directory: true })).resolves.toEqual({
        path: '/home/user/Scores',
        name: 'Scores',
        extension: '',
      });
      await expect(service.getFileInfo('/home/user/song.mid')).resolves.toEqual({
        path: '/home/user/song.mid',
        name: 'song.mid',
        extension: 'mid',
      });
    });
  });

  describe('Tauri 2 API shape', () => {
    afterEach(() => {
      delete (window as unknown as Record<string, unknown>)['__TAURI__'];
    });

    it('should call window methods on the current window and use the renamed v2 APIs', async () => {
      const currentWindow = {
        setTitle: vi.fn().mockResolvedValue(undefined),
        minimize: vi.fn().mockResolvedValue(undefined),
        isMaximized: vi.fn().mockResolvedValue(false),
        maximize: vi.fn().mockResolvedValue(undefined),
        unmaximize: vi.fn().mockResolvedValue(undefined),
        isFullscreen: vi.fn().mockResolvedValue(false),
        setFullscreen: vi.fn().mockResolvedValue(undefined),
      };
      const fs = {
        readFile: vi.fn().mockResolvedValue(new Uint8Array([1])),
        writeFile: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      };
      const clipboardManager = { readText: vi.fn().mockResolvedValue('clip') };
      const dialog = { message: vi.fn().mockResolvedValue(undefined) };
      (window as unknown as Record<string, unknown>)['__TAURI__'] = {
        // v2: no free setTitle()/minimize() on the module
        window: { getCurrentWindow: () => currentWindow },
        fs,
        clipboardManager,
        dialog,
      };
      const service = TestBed.inject(NativePlatformService);

      await service.setWindowTitle('Score');
      await service.minimizeWindow();
      await service.toggleMaximize();
      await service.toggleFullscreen();
      expect(currentWindow.setTitle).toHaveBeenCalledWith('Score');
      expect(currentWindow.minimize).toHaveBeenCalled();
      expect(currentWindow.maximize).toHaveBeenCalled();
      expect(currentWindow.setFullscreen).toHaveBeenCalledWith(true);

      await expect(service.readBinaryFile('/a.mid')).resolves.toEqual(new Uint8Array([1]));
      await service.writeBinaryFile('/b.mid', new Uint8Array([2]));
      await service.deleteFile('/c.mid');
      expect(fs.writeFile).toHaveBeenCalledWith('/b.mid', new Uint8Array([2]));
      expect(fs.remove).toHaveBeenCalledWith('/c.mid');

      await expect(service.readClipboardText()).resolves.toBe('clip');

      await service.showError('Boom');
      expect(dialog.message).toHaveBeenCalledWith(
        'Boom',
        expect.objectContaining({ kind: 'error' })
      );
    });
  });

  describe('openFile (browser)', () => {
    it('should report no extension for a file name without a dot', async () => {
      const click = vi
        .spyOn(HTMLInputElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const service = TestBed.inject(NativePlatformService);
      const result = service.openFile({ multiple: true });

      const input = click.mock.contexts[0] as HTMLInputElement;
      const files = [new File(['a'], 'Makefile'), new File(['b'], 'song.mid')];
      Object.defineProperty(input, 'files', { value: files });
      input.dispatchEvent(new Event('change'));

      const infos = (await result) as Array<{ name: string; extension: string }>;
      expect(infos.map(f => f.extension)).toEqual(['', 'mid']);
    });

    it('should expose the picked File so its contents can be read', async () => {
      const click = vi
        .spyOn(HTMLInputElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const service = TestBed.inject(NativePlatformService);
      const result = service.openFile();

      const input = click.mock.contexts[0] as HTMLInputElement;
      const picked = new File(['X:1\nK:C'], 'tune.abc');
      Object.defineProperty(input, 'files', { value: [picked] });
      input.dispatchEvent(new Event('change'));

      const info = (await result) as FileInfo;
      expect(info.file).toBe(picked);
      await expect(service.readFileObject(info.file!)).resolves.toBe('X:1\nK:C');
    });

    it('should not restrict the picker when an "All Files" filter is included', () => {
      const click = vi
        .spyOn(HTMLInputElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const service = TestBed.inject(NativePlatformService);

      void service.openFile({ filters: [MUSIC_FILE_FILTERS.midi] });
      expect((click.mock.contexts[0] as HTMLInputElement).accept).toBe('.mid,.midi');

      void service.openFile({ filters: [MUSIC_FILE_FILTERS.midi, MUSIC_FILE_FILTERS.all] });
      expect((click.mock.contexts[1] as HTMLInputElement).accept).toBe('');
    });

    it('should reject directory picking instead of silently opening a file picker', async () => {
      const click = vi
        .spyOn(HTMLInputElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const service = TestBed.inject(NativePlatformService);

      await expect(service.openFile({ directory: true })).rejects.toBeInstanceOf(
        UnsupportedOnPlatformError
      );
      expect(click).not.toHaveBeenCalled();
    });
  });

  describe('openExternal (browser)', () => {
    it('should open http(s) URLs in a new window without an opener', async () => {
      const open = vi.spyOn(window, 'open').mockImplementation(() => null);
      const service = TestBed.inject(NativePlatformService);

      await service.openExternal('https://example.com/docs');

      expect(open).toHaveBeenCalledWith(
        'https://example.com/docs',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should refuse script-bearing URL schemes', async () => {
      const open = vi.spyOn(window, 'open').mockImplementation(() => null);
      const service = TestBed.inject(NativePlatformService);

      // eslint-disable-next-line no-script-url -- verifying such URLs are rejected
      await expect(service.openExternal('javascript:alert(1)')).rejects.toThrow(/not supported/);
      await expect(service.openExternal('data:text/html,<script>1</script>')).rejects.toThrow(
        /not supported/
      );
      expect(open).not.toHaveBeenCalled();
    });

    it('should open relative paths when the app is served from a non-http scheme', async () => {
      const open = vi.spyOn(window, 'open').mockImplementation(() => null);
      const base = document.createElement('base');
      base.href = 'tauri://localhost/app/';
      document.head.append(base);
      try {
        const service = TestBed.inject(NativePlatformService);

        await service.openExternal('docs/help.html');

        expect(open).toHaveBeenCalledWith(
          'tauri://localhost/app/docs/help.html',
          '_blank',
          'noopener,noreferrer'
        );
        // eslint-disable-next-line no-script-url -- verifying such URLs are still rejected
        await expect(service.openExternal('javascript:alert(1)')).rejects.toThrow(/not supported/);
      } finally {
        base.remove();
      }
    });

    it('should refuse blob: URLs even when the app itself is served from blob:', async () => {
      const open = vi.spyOn(window, 'open').mockImplementation(() => null);
      const baseURI = vi
        .spyOn(document, 'baseURI', 'get')
        .mockReturnValue('blob:https://example.com/0b5e4c1a-0000-4000-8000-000000000000');
      try {
        const service = TestBed.inject(NativePlatformService);

        await expect(
          service.openExternal('blob:https://example.com/11111111-0000-4000-8000-000000000000')
        ).rejects.toThrow(/not supported/);
        expect(open).not.toHaveBeenCalled();
      } finally {
        baseURI.mockRestore();
      }
    });
  });
});
