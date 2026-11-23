import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativePlatformService } from './native-platform.service';

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
  });
});
