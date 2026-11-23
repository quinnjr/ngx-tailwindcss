import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { AspectRatioPreset, TwAspectRatioComponent } from './aspect-ratio.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-aspect-ratio [ratio]="ratio()" [customRatio]="customRatio()" [class]="customClass()">
      <img src="test.jpg" alt="Test" />
    </tw-aspect-ratio>
  `,
  standalone: true,
  imports: [TwAspectRatioComponent],
})
class TestHostComponent {
  @ViewChild(TwAspectRatioComponent) aspectRatio!: TwAspectRatioComponent;
  ratio = signal<AspectRatioPreset>('video');
  customRatio = signal<number | undefined>(undefined);
  customClass = signal('');
}

describe('TwAspectRatioComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let hostEl: HTMLElement;

  function getBox(): HTMLElement {
    return hostEl;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    hostEl = fixture.debugElement.query(By.directive(TwAspectRatioComponent)).nativeElement;
  });

  it('should create the component', () => {
    expect(hostEl).toBeTruthy();
    expect(component.aspectRatio).toBeTruthy();
  });

  it('should render projected content', () => {
    expect(hostEl.querySelector('img')).toBeTruthy();
  });

  describe('presets', () => {
    it('should apply the video preset by default', () => {
      expect(getBox().className).toContain('aspect-video');
    });

    it('should update classes when the preset changes', () => {
      component.ratio.set('square');
      fixture.detectChanges();
      expect(getBox().className).toContain('aspect-square');

      component.ratio.set('portrait');
      fixture.detectChanges();
      expect(getBox().className).toContain('aspect-[3/4]');

      component.ratio.set('ultrawide');
      fixture.detectChanges();
      expect(getBox().className).toContain('aspect-[21/9]');
    });

    it('should always apply the base positioning classes', () => {
      expect(getBox().className).toContain('relative');
      expect(getBox().className).toContain('overflow-hidden');
    });
  });

  describe('custom ratio', () => {
    it('should apply the custom ratio as an inline style', () => {
      component.ratio.set('custom');
      component.customRatio.set(1.5);
      fixture.detectChanges();

      expect(getBox().style.aspectRatio).toMatch(/^1\.5(\s*\/\s*1)?$/);
      expect(getBox().className).not.toContain('aspect-video');
    });

    it('should support a customRatio of 0', () => {
      component.ratio.set('custom');
      component.customRatio.set(0);
      fixture.detectChanges();

      expect(getBox().style.aspectRatio).toMatch(/^0(\s*\/\s*1)?$/);
    });

    it('should fall back to the video preset when customRatio is missing', () => {
      component.ratio.set('custom');
      fixture.detectChanges();

      expect(getBox().className).toContain('aspect-video');
    });

    it('should not set an inline ratio for presets', () => {
      expect(getBox().style.aspectRatio || '').toBe('');
    });
  });

  describe('class customization', () => {
    it('should merge custom classes', () => {
      component.customClass.set('custom-ratio-class');
      fixture.detectChanges();

      expect(getBox().className).toContain('custom-ratio-class');
    });
  });
});

describe('AspectRatio class attribute (host is the styled box)', () => {
  it('applies a static class once, on the host, with no inner wrapper', async () => {
    @Component({
      template: `<tw-aspect-ratio class="tw-test-box"><img src="x.jpg" alt="" /></tw-aspect-ratio>`,
      standalone: true,
      imports: [TwAspectRatioComponent],
    })
    class StaticClassHostComponent {}

    // Stand-in for utility classes such as `p-4 border-2`
    const style = document.createElement('style');
    style.textContent = '.tw-test-box { padding: 16px; border: 2px solid red; }';
    document.head.append(style);

    try {
      await TestBed.configureTestingModule({
        imports: [StaticClassHostComponent],
        providers: [TwClassService],
      }).compileComponents();

      const fixture = TestBed.createComponent(StaticClassHostComponent);
      fixture.detectChanges();

      {
        const host = fixture.debugElement.query(By.css('tw-aspect-ratio'))
          .nativeElement as HTMLElement;
        // No wrapper element: projected content sits directly in the styled host
        expect(host.children.length).toBe(1);
        expect(host.querySelector('div')).toBeNull();
        expect(host.classList.contains('tw-test-box')).toBe(true);
        expect(getComputedStyle(host).paddingTop).toBe('16px');
        expect(getComputedStyle(host).borderTopWidth).toBe('2px');
        // Projected children fill the ratio box
        const img = host.querySelector('img') as HTMLElement;
        expect(getComputedStyle(img).position).toBe('absolute');
        expect(getComputedStyle(img).height).toBe('100%');
      }
    } finally {
      style.remove();
    }
  });
});
