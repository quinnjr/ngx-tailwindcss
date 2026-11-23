import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { SpacerSize, TwSpacerComponent, TwWrapComponent } from './spacer.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: ` <tw-spacer [axis]="axis()" [size]="size()" [class]="customClass()"></tw-spacer> `,
  standalone: true,
  imports: [TwSpacerComponent],
})
class SpacerTestComponent {
  @ViewChild(TwSpacerComponent) spacer!: TwSpacerComponent;
  axis = signal<'horizontal' | 'vertical'>('vertical');
  size = signal<SpacerSize>('md');
  customClass = signal('');
}

@Component({
  template: `
    <tw-wrap [spacing]="spacing()" [align]="align()" [justify]="justify()" [class]="customClass()">
      <span>Item 1</span>
      <span>Item 2</span>
      <span>Item 3</span>
    </tw-wrap>
  `,
  standalone: true,
  imports: [TwWrapComponent],
})
class WrapTestComponent {
  @ViewChild(TwWrapComponent) wrap!: TwWrapComponent;
  spacing = signal<SpacerSize>('md');
  align = signal<'start' | 'center' | 'end'>('start');
  justify = signal<'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'>('start');
  customClass = signal('');
}

describe('TwSpacerComponent', () => {
  let fixture: ComponentFixture<SpacerTestComponent>;
  let component: SpacerTestComponent;
  let spacerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpacerTestComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(SpacerTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    spacerEl = fixture.debugElement.query(By.directive(TwSpacerComponent)).nativeElement;
  });

  it('should create the spacer', () => {
    expect(spacerEl).toBeTruthy();
    expect(component.spacer).toBeTruthy();
  });

  it('should have aria-hidden attribute', () => {
    const inner = spacerEl.querySelector('div');
    expect(inner?.getAttribute('aria-hidden')).toBe('true');
  });

  describe('vertical axis', () => {
    it('should apply vertical sizes', () => {
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('h-4'); // md size
    });

    it('should apply xs size', () => {
      component.size.set('xs');
      fixture.detectChanges();
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('h-1');
    });

    it('should apply sm size', () => {
      component.size.set('sm');
      fixture.detectChanges();
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('h-2');
    });

    it('should apply lg size', () => {
      component.size.set('lg');
      fixture.detectChanges();
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('h-6');
    });

    it('should apply xl size', () => {
      component.size.set('xl');
      fixture.detectChanges();
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('h-8');
    });

    it('should apply 2xl size', () => {
      component.size.set('2xl');
      fixture.detectChanges();
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('h-12');
    });

    it('should apply 3xl size', () => {
      component.size.set('3xl');
      fixture.detectChanges();
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('h-16');
    });

    it('should apply auto size', () => {
      component.size.set('auto');
      fixture.detectChanges();
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('flex-1');
      // The host is the flex item in the consumer's flex container
      expect(spacerEl.classList.contains('flex-1')).toBe(true);
    });
  });

  describe('horizontal axis', () => {
    beforeEach(() => {
      component.axis.set('horizontal');
      fixture.detectChanges();
    });

    it('should apply horizontal sizes', () => {
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('w-4'); // md size
    });

    it('should apply xs size', () => {
      component.size.set('xs');
      fixture.detectChanges();
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('w-1');
    });

    it('should apply sm size', () => {
      component.size.set('sm');
      fixture.detectChanges();
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('w-2');
    });

    it('should apply lg size', () => {
      component.size.set('lg');
      fixture.detectChanges();
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('w-6');
    });

    it('should reflect a bound axis onto the host attribute', () => {
      // `:host([axis='horizontal'])` keys off this attribute, so property
      // bindings must reflect it just like static attribute usage does.
      expect(spacerEl.getAttribute('axis')).toBe('horizontal');
      component.axis.set('vertical');
      fixture.detectChanges();
      expect(spacerEl.getAttribute('axis')).toBe('vertical');
    });
  });

  describe('custom class', () => {
    it('should apply custom class', () => {
      component.customClass.set('custom-spacer');
      fixture.detectChanges();
      const inner = spacerEl.querySelector('div');
      expect(inner?.className).toContain('custom-spacer');
    });
  });
});

describe('TwWrapComponent', () => {
  let fixture: ComponentFixture<WrapTestComponent>;
  let component: WrapTestComponent;
  let wrapEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WrapTestComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(WrapTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    wrapEl = fixture.debugElement.query(By.directive(TwWrapComponent)).nativeElement;
  });

  it('should create the wrap', () => {
    expect(wrapEl).toBeTruthy();
    expect(component.wrap).toBeTruthy();
  });

  it('should render content', () => {
    expect(wrapEl.textContent).toContain('Item 1');
    expect(wrapEl.textContent).toContain('Item 2');
    expect(wrapEl.textContent).toContain('Item 3');
  });

  it('should have flex and flex-wrap classes', () => {
    const inner = wrapEl.querySelector('div');
    expect(inner?.className).toContain('flex');
    expect(inner?.className).toContain('flex-wrap');
  });

  describe('spacing', () => {
    it('should apply md spacing by default', () => {
      const inner = wrapEl.querySelector('div');
      expect(inner?.className).toContain('gap-4');
    });

    it('should apply xs spacing', () => {
      component.spacing.set('xs');
      fixture.detectChanges();
      const inner = wrapEl.querySelector('div');
      expect(inner?.className).toContain('gap-1');
    });

    it('should apply lg spacing', () => {
      component.spacing.set('lg');
      fixture.detectChanges();
      const inner = wrapEl.querySelector('div');
      expect(inner?.className).toContain('gap-6');
    });
  });

  describe('alignment', () => {
    it('should apply start alignment by default', () => {
      const inner = wrapEl.querySelector('div');
      expect(inner?.className).toContain('items-start');
    });

    it('should apply center alignment', () => {
      component.align.set('center');
      fixture.detectChanges();
      const inner = wrapEl.querySelector('div');
      expect(inner?.className).toContain('items-center');
    });

    it('should apply end alignment', () => {
      component.align.set('end');
      fixture.detectChanges();
      const inner = wrapEl.querySelector('div');
      expect(inner?.className).toContain('items-end');
    });
  });

  describe('justification', () => {
    it('should apply start justification by default', () => {
      const inner = wrapEl.querySelector('div');
      expect(inner?.className).toContain('justify-start');
    });

    it('should apply center justification', () => {
      component.justify.set('center');
      fixture.detectChanges();
      const inner = wrapEl.querySelector('div');
      expect(inner?.className).toContain('justify-center');
    });

    it('should apply between justification', () => {
      component.justify.set('between');
      fixture.detectChanges();
      const inner = wrapEl.querySelector('div');
      expect(inner?.className).toContain('justify-between');
    });

    it('should apply around justification', () => {
      component.justify.set('around');
      fixture.detectChanges();
      const inner = wrapEl.querySelector('div');
      expect(inner?.className).toContain('justify-around');
    });

    it('should apply evenly justification', () => {
      component.justify.set('evenly');
      fixture.detectChanges();
      const inner = wrapEl.querySelector('div');
      expect(inner?.className).toContain('justify-evenly');
    });
  });
});

describe('Wrap host sizing', () => {
  it('fills a host that is sized by its parent (flex/grid stretch or flex-grow)', async () => {
    @Component({
      template: `<tw-wrap><span>x</span></tw-wrap>`,
      standalone: true,
      imports: [TwWrapComponent],
    })
    class FillHostComponent {}

    await TestBed.configureTestingModule({
      imports: [FillHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    const fixture = TestBed.createComponent(FillHostComponent);
    fixture.detectChanges();

    {
      const host = fixture.debugElement.query(By.css('tw-wrap')).nativeElement as HTMLElement;
      expect(getComputedStyle(host.querySelector('div') as HTMLElement).height).toBe('100%');
    }
  });
});

describe('Wrap forwarded margins and widths', () => {
  it('applies a static margin/width class once, on the host', async () => {
    @Component({
      template: `<tw-wrap class="tw-test-geom"><span>x</span></tw-wrap>`,
      standalone: true,
      imports: [TwWrapComponent],
    })
    class GeometryHostComponent {}

    // Stand-in for utility classes such as `my-4 w-1/2 max-w-[50%]`
    const style = document.createElement('style');
    style.textContent = '.tw-test-geom { margin: 16px; width: 50%; max-width: 50%; }';
    document.head.append(style);

    try {
      await TestBed.configureTestingModule({
        imports: [GeometryHostComponent],
        providers: [TwClassService],
      }).compileComponents();

      const fixture = TestBed.createComponent(GeometryHostComponent);
      fixture.detectChanges();

      const host = fixture.debugElement.query(By.css('tw-wrap')).nativeElement as HTMLElement;
      const inner = host.querySelector('div') as HTMLElement;
      expect(inner.className).toContain('tw-test-geom');

      expect(getComputedStyle(host).marginTop).toBe('16px');
      expect(getComputedStyle(host).width).toBe('50%');

      // Not doubled or compounded (25% width) by the inner element
      const innerStyle = getComputedStyle(inner);
      expect(innerStyle.marginTop).toBe('0px');
      expect(innerStyle.width).toBe('auto');
      expect(innerStyle.maxWidth).toBe('none');
    } finally {
      style.remove();
    }
  });
});
