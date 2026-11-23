import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { ContainerSize, TwContainerComponent } from './container.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-container
      [size]="size()"
      [centered]="centered()"
      [padding]="padding()"
      [class]="customClass()"
    >
      <p>Container content</p>
    </tw-container>
  `,
  standalone: true,
  imports: [TwContainerComponent],
})
class TestHostComponent {
  @ViewChild(TwContainerComponent) container!: TwContainerComponent;
  size = signal<ContainerSize>('xl');
  centered = signal(true);
  padding = signal<'none' | 'sm' | 'md' | 'lg'>('md');
  customClass = signal('');
}

describe('TwContainerComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let containerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    containerEl = fixture.debugElement.query(By.directive(TwContainerComponent)).nativeElement;
  });

  it('should create the container', () => {
    expect(containerEl).toBeTruthy();
    expect(component.container).toBeTruthy();
  });

  it('should render content', () => {
    expect(containerEl.textContent).toContain('Container content');
  });

  describe('sizes', () => {
    it('should apply sm size', () => {
      component.size.set('sm');
      fixture.detectChanges();
      const inner = containerEl.querySelector('div');
      expect(inner?.className).toContain('max-w-(--breakpoint-sm)');
    });

    it('should apply md size', () => {
      component.size.set('md');
      fixture.detectChanges();
      const inner = containerEl.querySelector('div');
      expect(inner?.className).toContain('max-w-(--breakpoint-md)');
    });

    it('should apply lg size', () => {
      component.size.set('lg');
      fixture.detectChanges();
      const inner = containerEl.querySelector('div');
      expect(inner?.className).toContain('max-w-(--breakpoint-lg)');
    });

    it('should apply xl size by default', () => {
      const inner = containerEl.querySelector('div');
      expect(inner?.className).toContain('max-w-(--breakpoint-xl)');
    });

    it('should apply 2xl size', () => {
      component.size.set('2xl');
      fixture.detectChanges();
      const inner = containerEl.querySelector('div');
      expect(inner?.className).toContain('max-w-(--breakpoint-2xl)');
    });

    it('should apply full size', () => {
      component.size.set('full');
      fixture.detectChanges();
      const inner = containerEl.querySelector('div');
      expect(inner?.className).toContain('max-w-full');
    });

    it('should apply prose size', () => {
      component.size.set('prose');
      fixture.detectChanges();
      const inner = containerEl.querySelector('div');
      expect(inner?.className).toContain('max-w-prose');
    });
  });

  describe('centered', () => {
    it('should center by default', () => {
      const inner = containerEl.querySelector('div');
      expect(inner?.className).toContain('mx-auto');
    });

    it('should not center when false', () => {
      component.centered.set(false);
      fixture.detectChanges();
      const inner = containerEl.querySelector('div');
      expect(inner?.className).not.toContain('mx-auto');
    });
  });

  describe('padding', () => {
    it('should apply md padding by default', () => {
      const inner = containerEl.querySelector('div');
      expect(inner?.className).toContain('px-4');
    });

    it('should apply sm padding', () => {
      component.padding.set('sm');
      fixture.detectChanges();
      const inner = containerEl.querySelector('div');
      expect(inner?.className).toContain('px-2');
    });

    it('should apply lg padding', () => {
      component.padding.set('lg');
      fixture.detectChanges();
      const inner = containerEl.querySelector('div');
      expect(inner?.className).toContain('px-6');
    });

    it('should apply no padding', () => {
      component.padding.set('none');
      fixture.detectChanges();
      const inner = containerEl.querySelector('div');
      expect(inner?.className).not.toContain('px-');
    });
  });

  describe('custom class', () => {
    it('should apply custom class', () => {
      component.customClass.set('custom-class');
      fixture.detectChanges();
      const inner = containerEl.querySelector('div');
      expect(inner?.className).toContain('custom-class');
    });
  });

  it('should have w-full class', () => {
    const inner = containerEl.querySelector('div');
    expect(inner?.className).toContain('w-full');
  });
});

describe('Container host sizing', () => {
  it('fills a host that is sized by its parent (flex/grid stretch or flex-grow)', async () => {
    @Component({
      template: `<tw-container><span>x</span></tw-container>`,
      standalone: true,
      imports: [TwContainerComponent],
    })
    class FillHostComponent {}

    await TestBed.configureTestingModule({
      imports: [FillHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    const fixture = TestBed.createComponent(FillHostComponent);
    fixture.detectChanges();

    {
      const host = fixture.debugElement.query(By.css('tw-container')).nativeElement as HTMLElement;
      expect(getComputedStyle(host.querySelector('div') as HTMLElement).height).toBe('100%');
    }
    // The size cap lives on the inner element, so a forwarded max-w-* still centers
    const host = fixture.debugElement.query(By.css('tw-container')).nativeElement as HTMLElement;
    expect(getComputedStyle(host).maxWidth).toBe('none');
  });
});

describe('Container forwarded margins', () => {
  it('applies a static margin class once, on the inner element', async () => {
    @Component({
      template: `<tw-container class="tw-test-geom"><span>x</span></tw-container>`,
      standalone: true,
      imports: [TwContainerComponent],
    })
    class GeometryHostComponent {}

    // Stand-in for a utility class such as `my-4`
    const style = document.createElement('style');
    style.textContent = '.tw-test-geom { margin: 16px; }';
    document.head.append(style);

    try {
      await TestBed.configureTestingModule({
        imports: [GeometryHostComponent],
        providers: [TwClassService],
      }).compileComponents();

      const fixture = TestBed.createComponent(GeometryHostComponent);
      fixture.detectChanges();

      const host = fixture.debugElement.query(By.css('tw-container')).nativeElement as HTMLElement;
      const inner = host.querySelector('div') as HTMLElement;
      expect(inner.className).toContain('tw-test-geom');

      // The full-width host doesn't add a second margin (or overflow its parent with one)
      expect(getComputedStyle(host).marginTop).toBe('0px');
      expect(getComputedStyle(inner).marginTop).toBe('16px');
    } finally {
      style.remove();
    }
  });
});
