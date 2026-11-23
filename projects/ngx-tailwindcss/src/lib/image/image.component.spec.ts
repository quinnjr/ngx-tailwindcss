import { Component, DebugElement, signal, ViewChild } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageBorderRadius, ImageFit, TwImageComponent } from './image.component';
import { TwClassService } from '../core/tw-class.service';
import { pushEscapeLayer, removeEscapeLayer } from '../overlay/escape-layer-stack';

@Component({
  template: `
    <tw-image
      [src]="src()"
      [alt]="alt()"
      [width]="width()"
      [height]="height()"
      [fit]="fit()"
      [borderRadius]="borderRadius()"
      [preview]="preview()"
      [zoomable]="zoomable()"
      [rotatable]="rotatable()"
      (onShow)="onShowSpy()"
      (onHide)="onHideSpy()"
      (onLoad)="onLoadSpy()"
      (onError)="onErrorSpy()"
      data-testid="test-image"
    ></tw-image>
  `,
  standalone: true,
  imports: [TwImageComponent],
})
class TestHostComponent {
  @ViewChild(TwImageComponent) image!: TwImageComponent;
  src = signal('https://example.com/image.jpg');
  alt = signal('Test image');
  width = signal('');
  height = signal('');
  fit = signal<ImageFit>('cover');
  borderRadius = signal<ImageBorderRadius>('none');
  preview = signal(false);
  zoomable = signal(true);
  rotatable = signal(true);

  onShowSpy = vi.fn();
  onHideSpy = vi.fn();
  onLoadSpy = vi.fn();
  onErrorSpy = vi.fn();
}

/** Read the component's protected preview-state signals in tests */
function previewState(image: TwImageComponent): {
  zoomLevel: () => number;
  rotation: () => number;
} {
  return image as unknown as { zoomLevel: () => number; rotation: () => number };
}

describe('TwImageComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let imageEl: DebugElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    imageEl = fixture.debugElement.query(By.directive(TwImageComponent));
  });

  it('should create the image component', () => {
    expect(imageEl).toBeTruthy();
    expect(component.image).toBeTruthy();
  });

  it('should render image with correct src', () => {
    const img = imageEl.query(By.css('img'));
    expect(img.nativeElement.src).toBe('https://example.com/image.jpg');
  });

  it('should render image with correct alt', () => {
    const img = imageEl.query(By.css('img'));
    expect(img.nativeElement.alt).toBe('Test image');
  });

  describe('dimensions', () => {
    it('should apply width style', () => {
      component.width.set('200');
      fixture.detectChanges();
      const container = imageEl.query(By.css('div'));
      expect(container.nativeElement.style.width).toBe('200px');
    });

    it('should apply height style', () => {
      component.height.set('150');
      fixture.detectChanges();
      const container = imageEl.query(By.css('div'));
      expect(container.nativeElement.style.height).toBe('150px');
    });

    it('should apply width with px suffix', () => {
      component.width.set('200px');
      fixture.detectChanges();
      const container = imageEl.query(By.css('div'));
      expect(container.nativeElement.style.width).toBe('200px');
    });

    it('should apply width with percentage', () => {
      component.width.set('50%');
      fixture.detectChanges();
      const container = imageEl.query(By.css('div'));
      expect(container.nativeElement.style.width).toBe('50%');
    });

    it('should pass non-pixel CSS lengths through unchanged', () => {
      component.width.set('10rem');
      component.height.set('8em');
      fixture.detectChanges();
      const container = imageEl.query(By.css('div'));
      expect(container.nativeElement.style.width).toBe('10rem');
      expect(container.nativeElement.style.height).toBe('8em');
    });
  });

  describe('object fit', () => {
    it('should apply cover fit by default', () => {
      const img = imageEl.query(By.css('img'));
      expect(img.nativeElement.className).toContain('object-cover');
    });

    it('should apply contain fit', () => {
      component.fit.set('contain');
      fixture.detectChanges();
      const img = imageEl.query(By.css('img'));
      expect(img.nativeElement.className).toContain('object-contain');
    });

    it('should apply fill fit', () => {
      component.fit.set('fill');
      fixture.detectChanges();
      const img = imageEl.query(By.css('img'));
      expect(img.nativeElement.className).toContain('object-fill');
    });

    it('should apply none fit', () => {
      component.fit.set('none');
      fixture.detectChanges();
      const img = imageEl.query(By.css('img'));
      expect(img.nativeElement.className).toContain('object-none');
    });

    it('should apply scale-down fit', () => {
      component.fit.set('scale-down');
      fixture.detectChanges();
      const img = imageEl.query(By.css('img'));
      expect(img.nativeElement.className).toContain('object-scale-down');
    });
  });

  describe('border radius', () => {
    it('should apply none radius by default', () => {
      const container = imageEl.query(By.css('div'));
      expect(container.nativeElement.className).toContain('rounded-none');
    });

    it('should apply sm radius', () => {
      component.borderRadius.set('sm');
      fixture.detectChanges();
      const container = imageEl.query(By.css('div'));
      expect(container.nativeElement.className).toContain('rounded-sm');
    });

    it('should apply lg radius', () => {
      component.borderRadius.set('lg');
      fixture.detectChanges();
      const container = imageEl.query(By.css('div'));
      expect(container.nativeElement.className).toContain('rounded-lg');
    });

    it('should apply full radius', () => {
      component.borderRadius.set('full');
      fixture.detectChanges();
      const container = imageEl.query(By.css('div'));
      expect(container.nativeElement.className).toContain('rounded-full');
    });
  });

  describe('events', () => {
    it('should emit onLoad when image loads', () => {
      const img = imageEl.query(By.css('img'));
      img.nativeElement.dispatchEvent(new Event('load'));
      expect(component.onLoadSpy).toHaveBeenCalled();
    });

    it('should emit onError when image fails to load', () => {
      const img = imageEl.query(By.css('img'));
      img.nativeElement.dispatchEvent(new Event('error'));
      expect(component.onErrorSpy).toHaveBeenCalled();
    });
  });

  describe('preview', () => {
    beforeEach(() => {
      component.preview.set(true);
      fixture.detectChanges();
    });

    it('should have cursor-zoom-in when preview enabled', () => {
      const container = imageEl.query(By.css('div'));
      expect(container.nativeElement.className).toContain('cursor-zoom-in');
    });

    it('should open preview on image click', () => {
      const img = imageEl.query(By.css('img'));
      img.nativeElement.click();
      fixture.detectChanges();
      expect(component.onShowSpy).toHaveBeenCalled();
    });

    it('should close preview via closePreview method', () => {
      component.image.openPreview();
      fixture.detectChanges();
      component.image.closePreview();
      fixture.detectChanges();
      expect(component.onHideSpy).toHaveBeenCalled();
    });

    it('should close preview on escape key', () => {
      component.image.openPreview();
      fixture.detectChanges();
      component.image.onEscapePress();
      fixture.detectChanges();
      expect(component.onHideSpy).toHaveBeenCalled();
    });

    it('should close on a document Escape keydown and claim the key', () => {
      component.image.openPreview();
      fixture.detectChanges();
      const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      document.dispatchEvent(event);
      fixture.detectChanges();
      expect(component.onHideSpy).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });

    it('should leave Escape to a layer opened above the preview', () => {
      component.image.openPreview();
      fixture.detectChanges();
      const above = {};
      pushEscapeLayer(above);
      try {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
        fixture.detectChanges();
        expect(component.onHideSpy).not.toHaveBeenCalled();
      } finally {
        removeEscapeLayer(above);
      }
    });

    it('should not react to Escape already handled by an inner layer', () => {
      component.image.openPreview();
      fixture.detectChanges();
      const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      event.preventDefault();
      document.dispatchEvent(event);
      expect(component.onHideSpy).not.toHaveBeenCalled();
    });

    it('should expose the thumbnail as a keyboard-operable button', () => {
      const container = imageEl.query(By.css('div')).nativeElement;
      expect(container.getAttribute('role')).toBe('button');
      expect(container.getAttribute('tabindex')).toBe('0');
    });

    it('should open preview on Enter keydown', () => {
      const container = imageEl.query(By.css('div')).nativeElement;
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(component.onShowSpy).toHaveBeenCalled();
      const dialog = fixture.debugElement.query(By.css('[role="dialog"]'));
      expect(dialog).toBeTruthy();
      expect(dialog.nativeElement.getAttribute('aria-modal')).toBe('true');
    });

    it('should save and restore body overflow around preview', () => {
      document.body.style.overflow = 'scroll';

      component.image.openPreview();
      fixture.detectChanges();
      expect(document.body.style.overflow).toBe('hidden');

      component.image.closePreview();
      fixture.detectChanges();
      expect(document.body.style.overflow).toBe('scroll');

      document.body.style.overflow = '';
    });

    it('should restore body overflow when openPreview is called twice', () => {
      document.body.style.overflow = 'scroll';

      component.image.openPreview();
      component.image.openPreview();
      fixture.detectChanges();
      component.image.closePreview();
      fixture.detectChanges();

      expect(document.body.style.overflow).toBe('scroll');
      document.body.style.overflow = '';
    });

    it('should restore body overflow when destroyed with the preview open', () => {
      document.body.style.overflow = 'scroll';

      component.image.openPreview();
      fixture.detectChanges();
      expect(document.body.style.overflow).toBe('hidden');

      fixture.destroy();
      expect(document.body.style.overflow).toBe('scroll');

      document.body.style.overflow = '';
    });
  });

  describe('loading state', () => {
    it('should reset loading when src changes', () => {
      const img = imageEl.query(By.css('img'));
      img.nativeElement.dispatchEvent(new Event('load'));
      fixture.detectChanges();
      expect(imageEl.query(By.css('.animate-pulse'))).toBeNull();

      component.src.set('https://example.com/other.jpg');
      fixture.detectChanges();

      expect(imageEl.query(By.css('.animate-pulse'))).toBeTruthy();
    });
  });

  describe('zoom', () => {
    beforeEach(() => {
      component.preview.set(true);
      fixture.detectChanges();
      component.image.openPreview();
      fixture.detectChanges();
    });

    it('should zoom in', () => {
      const initialZoom = previewState(component.image).zoomLevel();
      component.image.zoomIn();
      expect(previewState(component.image).zoomLevel()).toBeGreaterThan(initialZoom);
    });

    it('should zoom out', () => {
      component.image.zoomIn();
      const afterZoomIn = previewState(component.image).zoomLevel();
      component.image.zoomOut();
      expect(previewState(component.image).zoomLevel()).toBeLessThan(afterZoomIn);
    });

    it('should not zoom in beyond max', () => {
      // Zoom in multiple times
      for (let i = 0; i < 20; i++) {
        component.image.zoomIn();
      }
      expect(previewState(component.image).zoomLevel()).toBeLessThanOrEqual(3);
    });

    it('should not zoom out beyond min', () => {
      // Zoom out multiple times
      for (let i = 0; i < 20; i++) {
        component.image.zoomOut();
      }
      expect(previewState(component.image).zoomLevel()).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('rotation', () => {
    beforeEach(() => {
      component.preview.set(true);
      fixture.detectChanges();
      component.image.openPreview();
      fixture.detectChanges();
    });

    it('should rotate left', () => {
      component.image.rotateLeft();
      expect(previewState(component.image).rotation()).toBe(-90);
    });

    it('should rotate right', () => {
      component.image.rotateRight();
      expect(previewState(component.image).rotation()).toBe(90);
    });

    it('should accumulate rotation', () => {
      component.image.rotateRight();
      component.image.rotateRight();
      expect(previewState(component.image).rotation()).toBe(180);
    });
  });
});
