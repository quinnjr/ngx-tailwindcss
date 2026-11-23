import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwCenterComponent, TwCircleComponent, TwSquareComponent } from './center.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-center
      [inline]="inline()"
      [horizontal]="horizontal()"
      [vertical]="vertical()"
      [class]="customClass()"
    >
      <span>Centered content</span>
    </tw-center>
  `,
  standalone: true,
  imports: [TwCenterComponent],
})
class CenterHostComponent {
  @ViewChild(TwCenterComponent) center!: TwCenterComponent;
  inline = signal(false);
  horizontal = signal(true);
  vertical = signal(true);
  customClass = signal('');
}

describe('TwCenterComponent', () => {
  let fixture: ComponentFixture<CenterHostComponent>;
  let component: CenterHostComponent;
  let hostEl: HTMLElement;

  function getInner(): HTMLElement {
    return hostEl.querySelector('div') as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CenterHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(CenterHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    hostEl = fixture.debugElement.query(By.directive(TwCenterComponent)).nativeElement;
  });

  it('should create the component', () => {
    expect(hostEl).toBeTruthy();
    expect(hostEl.textContent).toContain('Centered content');
  });

  it('should center both axes by default', () => {
    expect(getInner().className).toContain('flex');
    expect(getInner().className).toContain('justify-center');
    expect(getInner().className).toContain('items-center');
  });

  it('should drop horizontal centering when horizontal is false', () => {
    component.horizontal.set(false);
    fixture.detectChanges();

    expect(getInner().className).not.toContain('justify-center');
    expect(getInner().className).toContain('items-center');
  });

  it('should drop vertical centering when vertical is false', () => {
    component.vertical.set(false);
    fixture.detectChanges();

    expect(getInner().className).toContain('justify-center');
    expect(getInner().className).not.toContain('items-center');
  });

  it('should use inline-flex when inline', () => {
    component.inline.set(true);
    fixture.detectChanges();

    expect(getInner().className).toContain('inline-flex');
  });

  it('should merge custom classes', () => {
    component.customClass.set('h-screen');
    fixture.detectChanges();

    expect(getInner().className).toContain('h-screen');
  });
});

@Component({
  template: `
    <tw-square [size]="size()" [centerContent]="centerContent()" [class]="customClass()">
      <span>SQ</span>
    </tw-square>
  `,
  standalone: true,
  imports: [TwSquareComponent],
})
class SquareHostComponent {
  size = signal('48px');
  centerContent = signal(true);
  customClass = signal('');
}

describe('TwSquareComponent', () => {
  let fixture: ComponentFixture<SquareHostComponent>;
  let component: SquareHostComponent;
  let hostEl: HTMLElement;

  function getInner(): HTMLElement {
    return hostEl.querySelector('div') as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SquareHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(SquareHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    hostEl = fixture.debugElement.query(By.directive(TwSquareComponent)).nativeElement;
  });

  it('should apply equal width and height', () => {
    expect(getInner().style.width).toBe('48px');
    expect(getInner().style.height).toBe('48px');
  });

  it('should update size', () => {
    component.size.set('64px');
    fixture.detectChanges();

    expect(getInner().style.width).toBe('64px');
    expect(getInner().style.height).toBe('64px');
  });

  it('should center content by default', () => {
    expect(getInner().className).toContain('flex');
    expect(getInner().className).toContain('items-center');
    expect(getInner().className).toContain('justify-center');
  });

  it('should not center content when centerContent is false', () => {
    component.centerContent.set(false);
    fixture.detectChanges();

    expect(getInner().className).not.toContain('justify-center');
  });

  it('should merge custom classes', () => {
    component.customClass.set('bg-blue-500');
    fixture.detectChanges();

    expect(getInner().className).toContain('bg-blue-500');
  });
});

@Component({
  template: `
    <tw-circle [size]="size()" [centerContent]="centerContent()" [class]="customClass()">
      <span>AB</span>
    </tw-circle>
  `,
  standalone: true,
  imports: [TwCircleComponent],
})
class CircleHostComponent {
  size = signal('48px');
  centerContent = signal(true);
  customClass = signal('');
}

describe('TwCircleComponent', () => {
  let fixture: ComponentFixture<CircleHostComponent>;
  let component: CircleHostComponent;
  let hostEl: HTMLElement;

  function getInner(): HTMLElement {
    return hostEl.querySelector('div') as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CircleHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(CircleHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    hostEl = fixture.debugElement.query(By.directive(TwCircleComponent)).nativeElement;
  });

  it('should be rounded and sized', () => {
    expect(getInner().className).toContain('rounded-full');
    expect(getInner().style.width).toBe('48px');
    expect(getInner().style.height).toBe('48px');
  });

  it('should center content by default', () => {
    expect(getInner().className).toContain('items-center');
    expect(getInner().className).toContain('justify-center');
  });

  it('should not center content when centerContent is false', () => {
    component.centerContent.set(false);
    fixture.detectChanges();

    expect(getInner().className).not.toContain('justify-center');
  });

  it('should merge custom classes', () => {
    component.customClass.set('bg-purple-500');
    fixture.detectChanges();

    expect(getInner().className).toContain('bg-purple-500');
  });
});

describe('TwCircleComponent static class attribute', () => {
  it('does not paint a static background on the square host behind the circle', async () => {
    @Component({
      template: `<tw-circle size="48px" class="tw-test-fill"></tw-circle>`,
      standalone: true,
      imports: [TwCircleComponent],
    })
    class CircleStaticClassHostComponent {}

    const style = document.createElement('style');
    style.textContent = '.tw-test-fill { background: blue; margin: 8px; overflow: hidden; }';
    document.head.append(style);

    try {
      await TestBed.configureTestingModule({
        imports: [CircleStaticClassHostComponent],
        providers: [TwClassService],
      }).compileComponents();

      const fixture = TestBed.createComponent(CircleStaticClassHostComponent);
      fixture.detectChanges();

      const host = fixture.debugElement.query(By.css('tw-circle')).nativeElement as HTMLElement;
      const inner = host.querySelector('div') as HTMLElement;

      expect(inner.className).toContain('rounded-full');
      expect(inner.className).toContain('tw-test-fill');
      const hostStyle = getComputedStyle(host);
      expect(hostStyle.backgroundColor).not.toBe('rgb(0, 0, 255)');
      expect(hostStyle.marginLeft).toBe('0px');
      // A forwarded overflow-hidden must not clip the inner circle's shadow on the host
      expect(hostStyle.overflow).toBe('visible');
      expect(getComputedStyle(inner).backgroundColor).toBe('rgb(0, 0, 255)');
    } finally {
      style.remove();
    }
  });
});

describe('Center host sizing', () => {
  it('fills a host that is sized by its parent (flex/grid stretch or flex-grow)', async () => {
    @Component({
      template: `<tw-center><span>x</span></tw-center>`,
      standalone: true,
      imports: [TwCenterComponent],
    })
    class FillHostComponent {}

    await TestBed.configureTestingModule({
      imports: [FillHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    const fixture = TestBed.createComponent(FillHostComponent);
    fixture.detectChanges();

    {
      const host = fixture.debugElement.query(By.css('tw-center')).nativeElement as HTMLElement;
      expect(getComputedStyle(host.querySelector('div') as HTMLElement).height).toBe('100%');
    }
  });
});
