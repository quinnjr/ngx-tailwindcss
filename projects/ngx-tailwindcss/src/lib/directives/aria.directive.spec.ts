import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TwAriaService } from '../core/aria.service';
import { TwAnnounceDirective } from './aria.directive';

@Component({
  // `announceAssertive` deliberately bound after `twAnnounce`
  template: `<div [twAnnounce]="message()" [announceAssertive]="assertive()"></div>`,
  standalone: true,
  imports: [TwAnnounceDirective],
})
class TestHostComponent {
  message = signal('Upload failed');
  assertive = signal(true);
}

describe('TwAnnounceDirective', () => {
  let ariaService: {
    announce: ReturnType<typeof vi.fn>;
    announceAssertive: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    ariaService = { announce: vi.fn(), announceAssertive: vi.fn() };
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: TwAriaService, useValue: ariaService }],
    });
  });

  it('should announce the first message assertively regardless of input binding order', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    expect(ariaService.announceAssertive).toHaveBeenCalledWith('Upload failed');
    expect(ariaService.announce).not.toHaveBeenCalled();
  });

  it('should announce politely and skip unchanged messages', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.assertive.set(false);
    fixture.detectChanges();
    fixture.componentInstance.assertive.set(true);
    fixture.detectChanges();

    expect(ariaService.announce).toHaveBeenCalledTimes(1);
    expect(ariaService.announceAssertive).not.toHaveBeenCalled();
  });
});
