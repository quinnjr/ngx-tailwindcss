import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MusicAccessibilityService } from './accessibility.service';

/** Access to the service's private announcement internals for queue tests */
interface AnnouncementInternals {
  politeRegion: HTMLElement | null;
  assertiveRegion: HTMLElement | null;
  announcementQueue: Array<{ message: string; priority: string; timestamp: number }>;
  isProcessingQueue: boolean;
  processAnnouncementQueue(): void;
}

describe('MusicAccessibilityService', () => {
  let service: MusicAccessibilityService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MusicAccessibilityService],
    });

    service = TestBed.inject(MusicAccessibilityService);
  });

  describe('initialization', () => {
    it('should create the service', () => {
      expect(service).toBeTruthy();
    });

    it('should have preference signals', () => {
      expect(typeof service.prefersReducedMotion()).toBe('boolean');
      expect(typeof service.prefersHighContrast()).toBe('boolean');
    });

    it('should provide combined preferences object', () => {
      const prefs = service.preferences();
      expect(prefs).toBeDefined();
      expect(typeof prefs.reducedMotion).toBe('boolean');
      expect(typeof prefs.highContrast).toBe('boolean');
    });
  });

  describe('announcement methods', () => {
    it('should have announce method', () => {
      expect(typeof service.announce).toBe('function');
    });

    it('should have announceValueChange method', () => {
      expect(typeof service.announceValueChange).toBe('function');
    });

    it('should have announceStateChange method', () => {
      expect(typeof service.announceStateChange).toBe('function');
    });

    it('should have announcePlaybackStatus method', () => {
      expect(typeof service.announcePlaybackStatus).toBe('function');
    });

    it('should have announcePosition method', () => {
      expect(typeof service.announcePosition).toBe('function');
    });

    it('should have announceError method', () => {
      expect(typeof service.announceError).toBe('function');
    });
  });

  describe('announcement queue', () => {
    it('should not wedge the queue pump when live regions are missing', () => {
      const internals = service as unknown as AnnouncementInternals;

      internals.politeRegion = null;
      internals.assertiveRegion = null;
      internals.announcementQueue.push({
        message: 'dropped',
        priority: 'polite',
        timestamp: Date.now(),
      });

      internals.processAnnouncementQueue();

      expect(internals.isProcessingQueue).toBe(false);
      expect(internals.announcementQueue.length).toBe(0);
    });

    it('should re-create missing live regions on announce', () => {
      const internals = service as unknown as AnnouncementInternals;

      internals.politeRegion = null;
      internals.assertiveRegion = null;

      service.announce('hello');

      expect(internals.politeRegion).not.toBeNull();
      expect(internals.assertiveRegion).not.toBeNull();
    });

    it('should coalesce queued value announcements with the same label', () => {
      const internals = service as unknown as AnnouncementInternals;

      // The first announcement is consumed immediately by the queue pump;
      // the following ones queue up while the pump is busy.
      service.announceValueChange('Volume', 10, '%');
      service.announceValueChange('Volume', 20, '%');
      service.announceValueChange('Volume', 30, '%');

      expect(internals.announcementQueue.length).toBe(1);
      expect(internals.announcementQueue[0].message).toBe('Volume: 30 %');
    });

    it('should keep announcements with different labels separate', () => {
      const internals = service as unknown as AnnouncementInternals;

      service.announceValueChange('Volume', 10, '%');
      service.announceValueChange('Volume', 20, '%');
      service.announceValueChange('Pan', -5);

      expect(internals.announcementQueue.length).toBe(2);
      expect(internals.announcementQueue.map(a => a.message)).toEqual(['Volume: 20 %', 'Pan: -5']);
    });
  });

  describe('motion helpers', () => {
    it('should have getAnimationDuration method', () => {
      expect(typeof service.getAnimationDuration).toBe('function');
    });

    it('should return a number from getAnimationDuration', () => {
      const duration = service.getAnimationDuration(300, 0);
      expect(typeof duration).toBe('number');
    });

    it('should have getTransitionClass method', () => {
      expect(typeof service.getTransitionClass).toBe('function');
    });

    it('should return a string from getTransitionClass', () => {
      const cls = service.getTransitionClass('transition-all', 'transition-none');
      expect(typeof cls).toBe('string');
    });
  });

  describe('high contrast helpers', () => {
    it('should have checkHighContrast method', () => {
      expect(typeof service.checkHighContrast).toBe('function');
    });

    it('should have getVariant method', () => {
      expect(typeof service.getVariant).toBe('function');
    });

    it('should stay in high contrast while forced-colors is active when prefers-contrast changes', () => {
      const state: Record<string, boolean> = {
        '(forced-colors: active)': true,
        '(prefers-contrast: more)': false,
      };
      const listeners = new Map<string, () => void>();
      const original = window.matchMedia;
      window.matchMedia = vi.fn((query: string) => ({
        get matches() {
          return state[query] ?? false;
        },
        media: query,
        addEventListener: (_: string, fn: () => void) => listeners.set(query, fn),
        removeEventListener: vi.fn(),
      })) as unknown as typeof window.matchMedia;

      try {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [MusicAccessibilityService] });
        const svc = TestBed.inject(MusicAccessibilityService);
        expect(svc.prefersHighContrast()).toBe(true);

        // prefers-contrast toggles on and back off; forced-colors still active
        state['(prefers-contrast: more)'] = true;
        listeners.get('(prefers-contrast: more)')!();
        state['(prefers-contrast: more)'] = false;
        listeners.get('(prefers-contrast: more)')!();
        expect(svc.prefersHighContrast()).toBe(true);

        // forced-colors turning off is now observed too
        state['(forced-colors: active)'] = false;
        listeners.get('(forced-colors: active)')!();
        expect(svc.prefersHighContrast()).toBe(false);
      } finally {
        window.matchMedia = original;
      }
    });
  });

  describe('environments without full matchMedia support', () => {
    it('should construct and report defaults when window.matchMedia is unavailable', () => {
      const original = window.matchMedia;
      // Simulate jsdom / older webviews that do not implement matchMedia
      (window as unknown as { matchMedia: undefined }).matchMedia = undefined;

      try {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [MusicAccessibilityService] });
        const svc = TestBed.inject(MusicAccessibilityService);

        expect(svc.prefersReducedMotion()).toBe(false);
        expect(svc.prefersHighContrast()).toBe(false);
        expect(svc.checkReducedMotion()).toBe(false);
        expect(svc.checkHighContrast()).toBe(false);
        expect(() => TestBed.resetTestingModule()).not.toThrow();
      } finally {
        window.matchMedia = original;
      }
    });

    it('should fall back to addListener/removeListener on legacy MediaQueryList', () => {
      const original = window.matchMedia;
      const addListener = vi.fn();
      const removeListener = vi.fn();
      window.matchMedia = vi.fn((query: string) => ({
        matches: false,
        media: query,
        addListener,
        removeListener,
      })) as unknown as typeof window.matchMedia;

      try {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [MusicAccessibilityService] });
        TestBed.inject(MusicAccessibilityService);
        expect(addListener).toHaveBeenCalledTimes(3);

        TestBed.resetTestingModule();
        expect(removeListener).toHaveBeenCalledTimes(3);
      } finally {
        window.matchMedia = original;
      }
    });
  });

  describe('formatting helpers', () => {
    it('should have formatTime method', () => {
      expect(typeof service.formatTime).toBe('function');
    });

    it('should format time correctly', () => {
      const result = service.formatTime(0);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have formatPercentage method', () => {
      expect(typeof service.formatPercentage).toBe('function');
    });

    it('should have formatFrequency method', () => {
      expect(typeof service.formatFrequency).toBe('function');
    });

    it('should have formatDecibels method', () => {
      expect(typeof service.formatDecibels).toBe('function');
    });
  });

  describe('ARIA helpers', () => {
    it('should have generateId method', () => {
      expect(typeof service.generateId).toBe('function');
    });

    it('should generate unique IDs', () => {
      const id1 = service.generateId('test');
      const id2 = service.generateId('test');

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });

  describe('screen reader detection', () => {
    it('should have isScreenReaderLikely method', () => {
      expect(typeof service.isScreenReaderLikely).toBe('function');
    });

    it('should return a boolean from isScreenReaderLikely', () => {
      expect(typeof service.isScreenReaderLikely()).toBe('boolean');
    });

    it('should not count its own live regions as screen reader indicators', () => {
      // The service injects aria-live regions itself; they must be excluded
      expect(service.isScreenReaderLikely()).toBe(false);

      const external = document.createElement('div');
      external.setAttribute('aria-live', 'polite');
      document.body.append(external);

      expect(service.isScreenReaderLikely()).toBe(true);

      external.remove();
    });
  });
});
