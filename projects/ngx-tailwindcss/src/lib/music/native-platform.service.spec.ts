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
});
