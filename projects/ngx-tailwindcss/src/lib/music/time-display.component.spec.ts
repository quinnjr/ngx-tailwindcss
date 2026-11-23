import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwTimeDisplayComponent } from './time-display.component';

describe('TwTimeDisplayComponent', () => {
  let fixture: ComponentFixture<TwTimeDisplayComponent>;
  let component: TwTimeDisplayComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwTimeDisplayComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwTimeDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should format minutes and seconds', () => {
    expect(component.formatTime(65)).toBe('1:05');
  });

  it('should show hours automatically past one hour', () => {
    expect(component.formatTime(3725)).toBe('1:02:05');
  });

  it('should carry the full duration in minutes when hours are hidden', () => {
    fixture.componentRef.setInput('showHours', 'never');
    fixture.detectChanges();

    expect(component.formatTime(3900)).toBe('65:00');
  });

  it('should not lose a millisecond to floating-point noise', () => {
    fixture.componentRef.setInput('showMilliseconds', true);
    fixture.detectChanges();

    expect(component.formatTime(1.005)).toBe('0:01.005');
  });

  it('should render full minutes in the flip variant when hours are hidden', () => {
    fixture.componentRef.setInput('variant', 'flip');
    fixture.componentRef.setInput('showHours', 'never');
    fixture.componentRef.setInput('value', 3900);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.replaceAll(/\s/g, '')).toContain(
      '65:00'
    );
  });
});
