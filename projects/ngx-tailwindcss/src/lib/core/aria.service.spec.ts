import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AriaUtils, TwAriaService } from './aria.service';

describe('TwAriaService', () => {
  let service: TwAriaService;

  beforeEach(() => {
    for (const region of document.body.querySelectorAll('[aria-live]')) {
      region.remove();
    }
    TestBed.configureTestingModule({});
    service = TestBed.inject(TwAriaService);
  });

  it('should create a polite live region when announcing', () => {
    service.announce('Saved');

    const region = document.body.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
  });

  it('should create an assertive live region when announcing assertively', () => {
    service.announceAssertive('Error occurred');

    const region = document.body.querySelector('[aria-live="assertive"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('role')).toBe('alert');
  });

  it('should clear announcements from live regions', () => {
    service.announce('Saved');
    service.announceAssertive('Error occurred');
    service.clearAnnouncements();

    const polite = document.body.querySelector('[aria-live="polite"]');
    const assertive = document.body.querySelector('[aria-live="assertive"]');
    expect(polite?.textContent).toBe('');
    expect(assertive?.textContent).toBe('');
  });

  it('should remove its live regions and pending timers when its injector is destroyed', () => {
    vi.useFakeTimers();
    try {
      service.announce('Saved');
      service.announceAssertive('Error occurred');
      expect(document.body.querySelectorAll('[aria-live]')).toHaveLength(2);

      TestBed.resetTestingModule();

      expect(document.body.querySelectorAll('[aria-live]')).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should not create live regions on the server', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const serverService = TestBed.inject(TwAriaService);

    serverService.announce('Saved');
    serverService.announceAssertive('Error occurred');

    expect(document.body.querySelectorAll('[aria-live]')).toHaveLength(0);
  });
});

describe('AriaUtils', () => {
  describe('generateId()', () => {
    it('should generate unique ids', () => {
      const ids = new Set<string>();
      for (let index = 0; index < 100; index++) {
        ids.add(AriaUtils.generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('should use the tw prefix by default', () => {
      expect(AriaUtils.generateId()).toMatch(/^tw-/);
    });

    it('should use a custom prefix', () => {
      expect(AriaUtils.generateId('modal')).toMatch(/^modal-/);
    });
  });

  describe('describedBy()', () => {
    it('should join valid ids', () => {
      expect(AriaUtils.describedBy('a', 'b')).toBe('a b');
    });

    it('should filter falsy ids', () => {
      expect(AriaUtils.describedBy('a', null, undefined, 'b')).toBe('a b');
    });

    it('should return null when no valid ids', () => {
      expect(AriaUtils.describedBy(null, undefined)).toBeNull();
    });
  });

  describe('labelledBy()', () => {
    it('should join valid ids', () => {
      expect(AriaUtils.labelledBy('title', 'subtitle')).toBe('title subtitle');
    });

    it('should return null when no valid ids', () => {
      expect(AriaUtils.labelledBy(undefined)).toBeNull();
    });
  });

  describe('getRole()', () => {
    it('should return the default role for a component', () => {
      expect(AriaUtils.getRole('button')).toBe('button');
      expect(AriaUtils.getRole('dialog')).toBe('dialog');
      expect(AriaUtils.getRole('listbox')).toBe('listbox');
    });

    it('should return context-specific roles', () => {
      expect(AriaUtils.getRole('button', 'menu')).toBe('menuitem');
      expect(AriaUtils.getRole('dialog', 'alert')).toBe('alertdialog');
      expect(AriaUtils.getRole('menuitem', 'checkbox')).toBe('menuitemcheckbox');
      expect(AriaUtils.getRole('cell', 'columnheader')).toBe('columnheader');
    });

    it('should fall back to the default role for unknown contexts', () => {
      expect(AriaUtils.getRole('button', 'unknown-context')).toBe('button');
      expect(AriaUtils.getRole('grid', 'unknown-context')).toBe('grid');
    });

    it('should return the component name for unknown components', () => {
      expect(AriaUtils.getRole('carousel')).toBe('carousel');
    });
  });
});
