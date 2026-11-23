import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { BleedAmount, BleedDirection, TwBleedComponent } from './bleed.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-bleed
      [direction]="direction()"
      [amount]="amount()"
      [customAmount]="customAmount()"
      [preservePadding]="preservePadding()"
      [class]="customClass()"
    >
      <p>Bleed content</p>
    </tw-bleed>
  `,
  standalone: true,
  imports: [TwBleedComponent],
})
class TestHostComponent {
  @ViewChild(TwBleedComponent) bleed!: TwBleedComponent;
  direction = signal<BleedDirection>('horizontal');
  amount = signal<BleedAmount>('md');
  customAmount = signal<string | undefined>(undefined);
  preservePadding = signal(false);
  customClass = signal('');
}

describe('TwBleedComponent', () => {
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
    hostEl = fixture.debugElement.query(By.directive(TwBleedComponent)).nativeElement;
  });

  it('should create the component', () => {
    expect(hostEl).toBeTruthy();
    expect(component.bleed).toBeTruthy();
    expect(hostEl.textContent).toContain('Bleed content');
  });

  describe('horizontal bleed', () => {
    it('should apply negative horizontal margins for preset amounts', () => {
      expect(getBox().style.marginLeft).toBe('-2rem');
      expect(getBox().style.marginRight).toBe('-2rem');
    });

    it('should update margins when amount changes', () => {
      component.amount.set('lg');
      fixture.detectChanges();

      expect(getBox().style.marginLeft).toBe('-4rem');
      expect(getBox().style.marginRight).toBe('-4rem');
    });

    it('should apply viewport-based margins and width for amount="full"', () => {
      component.amount.set('full');
      fixture.detectChanges();

      expect(getBox().style.marginLeft).toMatch(/calc\((-50vw \+ 50%|50% - 50vw)\)/);
      expect(getBox().style.marginRight).toMatch(/calc\((-50vw \+ 50%|50% - 50vw)\)/);
      expect(getBox().style.width).toBe('100vw');
    });
  });

  describe('directions', () => {
    it('should only bleed left for direction="left"', () => {
      component.direction.set('left');
      fixture.detectChanges();

      expect(getBox().style.marginLeft).toBe('-2rem');
      expect(getBox().style.marginRight || '').toBe('');
    });

    it('should only bleed right for direction="right"', () => {
      component.direction.set('right');
      fixture.detectChanges();

      expect(getBox().style.marginRight).toBe('-2rem');
      expect(getBox().style.marginLeft || '').toBe('');
    });

    it('should bleed vertically as well for direction="all"', () => {
      component.direction.set('all');
      fixture.detectChanges();

      expect(getBox().style.marginLeft).toBe('-2rem');
      expect(getBox().style.marginRight).toBe('-2rem');
      expect(getBox().style.marginTop).toBe('-2rem');
      expect(getBox().style.marginBottom).toBe('-2rem');
    });
  });

  describe('preservePadding', () => {
    it('should mirror the bleed with padding for preset amounts', () => {
      component.preservePadding.set(true);
      fixture.detectChanges();

      expect(getBox().style.paddingLeft).toBe('2rem');
      expect(getBox().style.paddingRight).toBe('2rem');
    });

    it('should preserve padding for amount="full"', () => {
      component.amount.set('full');
      component.preservePadding.set(true);
      fixture.detectChanges();

      expect(getBox().style.paddingLeft).toMatch(/calc\((50vw - 50%|-50% \+ 50vw)\)/);
      expect(getBox().style.paddingRight).toMatch(/calc\((50vw - 50%|-50% \+ 50vw)\)/);
    });
  });

  describe('customAmount', () => {
    it('should use the custom amount for margins', () => {
      component.customAmount.set('3rem');
      fixture.detectChanges();

      expect(getBox().style.marginLeft).toBe('-3rem');
      expect(getBox().style.marginRight).toBe('-3rem');
    });

    it('should take precedence over amount="full"', () => {
      component.amount.set('full');
      component.customAmount.set('3rem');
      fixture.detectChanges();

      expect(getBox().style.marginLeft).toBe('-3rem');
      expect(getBox().style.marginRight).toBe('-3rem');
      expect(getBox().style.width || '').toBe('');
    });

    it('should negate var() custom amounts with calc() instead of a "-" prefix', () => {
      component.direction.set('all');
      component.customAmount.set('var(--gutter)');
      fixture.detectChanges();

      const styles = (
        component.bleed as unknown as { bleedStyles: () => Record<string, string> }
      ).bleedStyles();
      for (const side of ['marginLeft', 'marginRight', 'marginTop', 'marginBottom']) {
        expect(styles[side]).toBe('calc(-1 * var(--gutter))');
      }
    });

    it('should negate calc() custom amounts with calc()', () => {
      component.direction.set('left');
      component.customAmount.set('calc(1rem + 2px)');
      component.preservePadding.set(true);
      fixture.detectChanges();

      const styles = (
        component.bleed as unknown as { bleedStyles: () => Record<string, string> }
      ).bleedStyles();
      expect(styles['marginLeft']).toBe('calc(-1 * calc(1rem + 2px))');
      expect(styles['paddingLeft']).toBe('calc(1rem + 2px)');
      expect(getBox().style.marginLeft).not.toBe('');
    });
  });

  describe('class customization', () => {
    it('should merge custom classes with the base class', () => {
      component.customClass.set('custom-bleed-class');
      fixture.detectChanges();

      expect(getBox().className).toContain('relative');
      expect(getBox().className).toContain('custom-bleed-class');
    });
  });
});

describe('Bleed class attribute (host is the styled box)', () => {
  it('applies a static class once, on the host, with no inner wrapper', async () => {
    @Component({
      template: `<tw-bleed class="tw-test-box"><p>a</p></tw-bleed>`,
      standalone: true,
      imports: [TwBleedComponent],
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
        const host = fixture.debugElement.query(By.css('tw-bleed')).nativeElement as HTMLElement;
        // No wrapper element: projected content sits directly in the styled host
        expect(host.children.length).toBe(1);
        expect(host.querySelector('div')).toBeNull();
        expect(host.classList.contains('tw-test-box')).toBe(true);
        expect(getComputedStyle(host).paddingTop).toBe('16px');
        expect(getComputedStyle(host).borderTopWidth).toBe('2px');
      }
    } finally {
      style.remove();
    }
  });
});
