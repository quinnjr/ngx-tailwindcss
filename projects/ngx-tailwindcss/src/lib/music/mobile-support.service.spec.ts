import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileSupportService } from './mobile-support.service';

describe('MobileSupportService', () => {
  let service: MobileSupportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MobileSupportService],
    });

    service = TestBed.inject(MobileSupportService);
  });

  describe('initialization', () => {
    it('should create the service', () => {
      expect(service).toBeTruthy();
    });

    it('should have hapticEnabled signal', () => {
      expect(service.hapticEnabled()).toBe(true);
    });

    it('should have touchGuardEnabled signal', () => {
      expect(service.touchGuardEnabled()).toBe(true);
    });

    it('should have isTouchDevice signal', () => {
      expect(typeof service.isTouchDevice()).toBe('boolean');
    });

    it('should have orientation signal', () => {
      expect(['portrait', 'landscape']).toContain(service.orientation());
    });

    it('should have supportsHaptic signal', () => {
      expect(typeof service.supportsHaptic()).toBe('boolean');
    });
  });

  describe('haptic enable/disable', () => {
    it('should toggle haptic enabled state', () => {
      expect(service.hapticEnabled()).toBe(true);

      service.setHapticEnabled(false);
      expect(service.hapticEnabled()).toBe(false);

      service.setHapticEnabled(true);
      expect(service.hapticEnabled()).toBe(true);
    });

    it('should use the iOS webkit haptic bridge when the Vibration API is unavailable', () => {
      const postMessage = vi.fn();
      const win = window as unknown as Record<string, unknown>;
      win['webkit'] = { messageHandlers: { haptic: { postMessage } } };
      service.supportsHaptic.set(false);

      try {
        service.triggerHaptic('success');
        expect(postMessage).toHaveBeenCalledWith({ type: 'notification-success' });
      } finally {
        delete win['webkit'];
      }
    });

    it('should remove window listeners on destroy', () => {
      const spy = vi.spyOn(window, 'removeEventListener');
      service.ngOnDestroy();
      expect(spy).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
      spy.mockRestore();
    });
  });

  describe('touch tracking', () => {
    it('should start touch tracking with touch event', () => {
      const touchEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as TouchEvent;

      // Should not throw
      expect(() => {
        service.startTouchTracking(touchEvent);
      }).not.toThrow();
    });

    it('should start touch tracking with mouse event', () => {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 200,
      });

      // Should not throw
      expect(() => {
        service.startTouchTracking(mouseEvent);
      }).not.toThrow();
    });

    it('should validate touch duration', () => {
      const touchEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as TouchEvent;

      service.startTouchTracking(touchEvent);

      // Immediate check should pass with 0 duration requirement
      expect(service.validateTouchDuration(0)).toBe(true);
    });

    it('should validate drag distance', () => {
      const startEvent = {
        touches: [{ clientX: 0, clientY: 0 }],
      } as unknown as TouchEvent;

      service.startTouchTracking(startEvent);

      const moveEvent = {
        touches: [{ clientX: 100, clientY: 0 }],
      } as unknown as TouchEvent;

      // 100px is more than 10px minimum
      expect(service.validateDragDistance(moveEvent, 10)).toBe(true);
    });

    it('should fail drag distance validation for small movements', () => {
      const startEvent = {
        touches: [{ clientX: 0, clientY: 0 }],
      } as unknown as TouchEvent;

      service.startTouchTracking(startEvent);

      const moveEvent = {
        touches: [{ clientX: 5, clientY: 0 }],
      } as unknown as TouchEvent;

      // 5px is less than 10px minimum
      expect(service.validateDragDistance(moveEvent, 10)).toBe(false);
    });
  });

  describe('touch guard', () => {
    it('should allow action by default', () => {
      const result = service.shouldAllowAction({});
      expect(result).toBe(true);
    });

    it('should enable/disable touch guard', () => {
      service.setTouchGuardEnabled(false);
      expect(service.touchGuardEnabled()).toBe(false);

      // Should still allow action when disabled
      const result = service.shouldAllowAction({ cooldownMs: 10_000 });
      expect(result).toBe(true);
    });

    it('should not mutate state on check (pure shouldAllowAction)', () => {
      // Repeated checks without consuming must all pass
      expect(service.shouldAllowAction({ cooldownMs: 1000 })).toBe(true);
      expect(service.shouldAllowAction({ cooldownMs: 1000 })).toBe(true);
      expect(service.shouldAllowAction({ cooldownMs: 1000 })).toBe(true);
    });

    it('should enforce cooldown after an action is consumed', () => {
      // First action should be allowed
      expect(service.shouldAllowAction({ cooldownMs: 1000 })).toBe(true);
      service.consumeAction();

      // Immediate second action should be blocked
      expect(service.shouldAllowAction({ cooldownMs: 1000 })).toBe(false);
    });

    it('should honor minDuration', () => {
      const touchEvent = {
        touches: [{ clientX: 0, clientY: 0 }],
      } as unknown as TouchEvent;

      service.startTouchTracking(touchEvent);

      // Immediately after touch start, a long minimum duration is not met
      expect(service.shouldAllowAction({ minDuration: 10_000 })).toBe(false);

      // A zero minimum duration passes
      expect(service.shouldAllowAction({ minDuration: 0 })).toBe(true);
    });
  });

  describe('pinch gesture', () => {
    it('should calculate pinch state for two-finger touch', () => {
      const event = {
        touches: [
          { clientX: 0, clientY: 0 },
          { clientX: 100, clientY: 0 },
        ],
      } as unknown as TouchEvent;

      const state = service.calculatePinchState(event);

      expect(state).toBeDefined();
      expect(state?.initialDistance).toBe(100);
    });

    it('should return null for single touch', () => {
      const event = {
        touches: [{ clientX: 0, clientY: 0 }],
      } as unknown as TouchEvent;

      const state = service.calculatePinchState(event);

      expect(state).toBeNull();
    });
  });

  describe('swipe detection', () => {
    it('should report a finite velocity when the clock reads 0 ms elapsed', () => {
      // Coarsened clocks (e.g. Firefox fingerprinting resistance) can report
      // the same Date.now() at touchstart and touchend for a quick flick
      vi.spyOn(Date, 'now').mockReturnValue(1000);
      service.startTouchTracking(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
      const swipe = service.detectSwipe(new MouseEvent('mouseup', { clientX: 120, clientY: 0 }));
      vi.restoreAllMocks();

      expect(swipe?.direction).toBe('right');
      expect(swipe?.duration).toBe(0);
      expect(Number.isFinite(swipe?.velocity)).toBe(true);
      expect(swipe?.velocity).toBe(120);
    });
  });

  describe('drag delta', () => {
    it('should calculate drag delta with touch event', () => {
      const startEvent = {
        touches: [{ clientX: 0, clientY: 100 }],
      } as unknown as TouchEvent;

      service.startTouchTracking(startEvent);

      // Use touches array for move event
      const moveEvent = {
        touches: [{ clientX: 200, clientY: 100 }],
      } as unknown as TouchEvent;

      const dragDelta = service.getDragDelta(moveEvent);
      expect(dragDelta.dx).toBe(200);
      expect(dragDelta.dy).toBe(0);
    });

    it('should calculate drag delta from a touchend event (lifted finger)', () => {
      service.startTouchTracking({
        targetTouches: [{ clientX: 0, clientY: 100 }],
        touches: [{ clientX: 0, clientY: 100 }],
      } as unknown as TouchEvent);

      // On touchend the lifted finger is only in changedTouches
      const endEvent = {
        targetTouches: [],
        touches: [],
        changedTouches: [{ clientX: 150, clientY: 100 }],
      } as unknown as TouchEvent;

      expect(service.getDragDelta(endEvent)).toEqual({ dx: 150, dy: 0 });
      expect(service.validateDragDistance(endEvent, 10)).toBe(true);
    });

    it('should calculate drag delta with mouse event', () => {
      const startEvent = new MouseEvent('mousedown', {
        clientX: 0,
        clientY: 100,
      });

      service.startTouchTracking(startEvent);

      const moveEvent = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 100,
      });

      const dragDelta = service.getDragDelta(moveEvent);
      expect(dragDelta.dx).toBe(200);
      expect(dragDelta.dy).toBe(0);
    });
  });
});
