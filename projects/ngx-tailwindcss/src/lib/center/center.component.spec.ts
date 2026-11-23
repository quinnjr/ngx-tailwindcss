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

  function getBox(): HTMLElement {
    return hostEl;
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
    expect(getBox().className).toContain('flex');
    expect(getBox().className).toContain('justify-center');
    expect(getBox().className).toContain('items-center');
  });

  it('should drop horizontal centering when horizontal is false', () => {
    component.horizontal.set(false);
    fixture.detectChanges();

    expect(getBox().className).not.toContain('justify-center');
    expect(getBox().className).toContain('items-center');
  });

  it('should drop vertical centering when vertical is false', () => {
    component.vertical.set(false);
    fixture.detectChanges();

    expect(getBox().className).toContain('justify-center');
    expect(getBox().className).not.toContain('items-center');
  });

  it('should use inline-flex when inline', () => {
    component.inline.set(true);
    fixture.detectChanges();

    // The host itself is the inline-flex box, so it flows within the line
    expect(getBox().classList.contains('inline-flex')).toBe(true);
    expect(getBox().classList.contains('flex')).toBe(false);

    component.inline.set(false);
    fixture.detectChanges();
    expect(getBox().classList.contains('flex')).toBe(true);
    expect(getBox().classList.contains('inline-flex')).toBe(false);
  });

  it('should merge custom classes', () => {
    component.customClass.set('h-screen');
    fixture.detectChanges();

    expect(getBox().className).toContain('h-screen');
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

  function getBox(): HTMLElement {
    return hostEl;
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
    expect(getBox().style.width).toBe('48px');
    expect(getBox().style.height).toBe('48px');
  });

  it('should update size', () => {
    component.size.set('64px');
    fixture.detectChanges();

    expect(getBox().style.width).toBe('64px');
    expect(getBox().style.height).toBe('64px');
  });

  it('should center content by default', () => {
    expect(getBox().className).toContain('flex');
    expect(getBox().className).toContain('items-center');
    expect(getBox().className).toContain('justify-center');
  });

  it('should not center content when centerContent is false', () => {
    component.centerContent.set(false);
    fixture.detectChanges();

    expect(getBox().className).not.toContain('justify-center');
  });

  it('should merge custom classes', () => {
    component.customClass.set('bg-blue-500');
    fixture.detectChanges();

    expect(getBox().className).toContain('bg-blue-500');
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

  function getBox(): HTMLElement {
    return hostEl;
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
    expect(getBox().className).toContain('rounded-full');
    expect(getBox().style.width).toBe('48px');
    expect(getBox().style.height).toBe('48px');
  });

  it('should center content by default', () => {
    expect(getBox().className).toContain('items-center');
    expect(getBox().className).toContain('justify-center');
  });

  it('should not center content when centerContent is false', () => {
    component.centerContent.set(false);
    fixture.detectChanges();

    expect(getBox().className).not.toContain('justify-center');
  });

  it('should merge custom classes', () => {
    component.customClass.set('bg-purple-500');
    fixture.detectChanges();

    expect(getBox().className).toContain('bg-purple-500');
  });
});

describe('Center class attribute (host is the styled box)', () => {
  it('applies a static class once, on the host, with no inner wrapper', async () => {
    @Component({
      template: `<tw-center class="tw-test-box"><span>a</span></tw-center
        ><tw-square class="tw-test-box" size="40px"><span>a</span></tw-square
        ><tw-circle class="tw-test-box" size="40px"><span>a</span></tw-circle>`,
      standalone: true,
      imports: [TwCenterComponent, TwSquareComponent, TwCircleComponent],
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
        const host = fixture.debugElement.query(By.css('tw-center')).nativeElement as HTMLElement;
        // No wrapper element: projected content sits directly in the styled host
        expect(host.children.length).toBe(1);
        expect(host.querySelector('div')).toBeNull();
        expect(host.classList.contains('tw-test-box')).toBe(true);
        expect(getComputedStyle(host).paddingTop).toBe('16px');
        expect(getComputedStyle(host).borderTopWidth).toBe('2px');
      }

      {
        const host = fixture.debugElement.query(By.css('tw-square')).nativeElement as HTMLElement;
        // No wrapper element: projected content sits directly in the styled host
        expect(host.children.length).toBe(1);
        expect(host.querySelector('div')).toBeNull();
        expect(host.classList.contains('tw-test-box')).toBe(true);
        expect(getComputedStyle(host).paddingTop).toBe('16px');
        expect(getComputedStyle(host).borderTopWidth).toBe('2px');
      }

      {
        const host = fixture.debugElement.query(By.css('tw-circle')).nativeElement as HTMLElement;
        expect(host.style.width).toBe('40px');
        expect(host.style.height).toBe('40px');
        // A fixed-size box that a flex parent must not squeeze
        expect(host.classList.contains('shrink-0')).toBe(true);
        expect(host.classList.contains('inline-flex')).toBe(true);
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
