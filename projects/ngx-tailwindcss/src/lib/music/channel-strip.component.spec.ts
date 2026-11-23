import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwChannelStripComponent } from './channel-strip.component';

describe('TwChannelStripComponent', () => {
  let fixture: ComponentFixture<TwChannelStripComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwChannelStripComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TwChannelStripComponent);
    fixture.detectChanges();
  });

  it('should disable its controls via setDisabledState (forms API)', () => {
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();

    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every(b => b.disabled)).toBe(true);
  });
});
