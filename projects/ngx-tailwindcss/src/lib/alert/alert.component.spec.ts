import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AlertStyle,
  AlertVariant,
  TwAlertComponent,
  TwAlertDescriptionComponent,
  TwAlertTitleComponent,
} from './alert.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-alert
      [variant]="variant()"
      [alertStyle]="alertStyle()"
      [dismissible]="dismissible()"
      [showIcon]="showIcon()"
      [hasCustomIcon]="hasCustomIcon()"
      [ariaLive]="ariaLive()"
      [classOverride]="classOverride()"
      (dismiss)="onDismiss()"
      data-testid="test-alert"
    >
      {{ alertText() }}
    </tw-alert>
  `,
  standalone: true,
  imports: [TwAlertComponent],
})
class TestHostComponent {
  @ViewChild(TwAlertComponent) alert!: TwAlertComponent;
  variant = signal<AlertVariant>('info');
  alertStyle = signal<AlertStyle>('soft');
  dismissible = signal(false);
  showIcon = signal(true);
  hasCustomIcon = signal(false);
  ariaLive = signal<'polite' | 'assertive' | 'off'>('polite');
  classOverride = signal('');
  alertText = signal('Alert message');
  dismissCount = 0;

  onDismiss(): void {
    this.dismissCount++;
  }
}

describe('TwAlertComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let alertEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    alertEl = fixture.debugElement.query(By.directive(TwAlertComponent)).nativeElement;
  });

  it('should create the alert', () => {
    expect(alertEl).toBeTruthy();
    expect(component.alert).toBeTruthy();
  });

  it('should have role="status" by default (polite)', () => {
    expect(alertEl.getAttribute('role')).toBe('status');
  });

  it('should have role="alert" when ariaLive is assertive', () => {
    component.ariaLive.set('assertive');
    fixture.detectChanges();

    expect(alertEl.getAttribute('role')).toBe('alert');
  });

  it('should render alert text', () => {
    expect(alertEl.textContent).toContain('Alert message');
  });

  describe('variants', () => {
    it('should apply info variant classes', () => {
      const classes = alertEl.className;
      expect(classes).toContain('bg-blue-50');
    });

    it('should update classes when variant changes', () => {
      component.variant.set('danger');
      fixture.detectChanges();

      expect(alertEl.className).toContain('bg-rose-50');
      expect(alertEl.className).toContain('text-rose-800');
      expect(alertEl.className).not.toContain('bg-blue-50');
    });
  });

  describe('styles', () => {
    it('should apply soft style classes', () => {
      expect(alertEl.className).toContain('bg-blue-50');
      expect(alertEl.className).toContain('text-blue-800');
    });

    it('should update classes when alertStyle changes', () => {
      component.alertStyle.set('solid');
      fixture.detectChanges();

      expect(alertEl.className).toContain('bg-blue-600');
      expect(alertEl.className).toContain('text-white');
    });

    it('should use dark text on the solid warning alert', () => {
      component.alertStyle.set('solid');
      component.variant.set('warning');
      fixture.detectChanges();

      // white on amber-500 is ~2.2:1
      expect(alertEl.className).toContain('text-amber-950');
      expect(alertEl.className).not.toContain('text-white');
      expect(alertEl.querySelector('[aria-hidden="true"]')?.className).toContain('text-amber-950');
    });

    it('should use an AA-contrast background on the solid success alert', () => {
      component.alertStyle.set('solid');
      component.variant.set('success');
      fixture.detectChanges();
      expect(alertEl.className).toContain('bg-emerald-700');
    });

    it('should ring the solid dismiss button in the text colour (white is ~2.2:1 on amber)', () => {
      component.alertStyle.set('solid');
      component.variant.set('warning');
      component.dismissible.set(true);
      fixture.detectChanges();
      const btn = alertEl.querySelector('button[aria-label="Dismiss"]')!;
      expect(btn.className).toContain('focus-visible:ring-current');
      expect(btn.className).not.toContain('ring-white');
    });

    it('should lighten the neutral icon in dark mode (slate-600 on slate-800 is ~1.9:1)', () => {
      component.variant.set('neutral');
      for (const style of ['soft', 'outlined', 'accent'] as const) {
        component.alertStyle.set(style);
        fixture.detectChanges();
        expect(alertEl.querySelector('[aria-hidden="true"]')?.className).toContain(
          'dark:text-slate-400'
        );
      }
    });
  });

  describe('icon', () => {
    it('should show icon by default', () => {
      const icon = alertEl.querySelector('svg');
      expect(icon).toBeTruthy();
    });

    it('should hide icon when showIcon is false', () => {
      component.showIcon.set(false);
      fixture.detectChanges();

      const iconWrapper = alertEl.querySelector('[aria-hidden="true"]');
      expect(iconWrapper).toBeNull();
    });
  });

  describe('dismissible', () => {
    it('should not show dismiss button by default', () => {
      const dismissBtn = alertEl.querySelector('button[aria-label="Dismiss"]');
      expect(dismissBtn).toBeNull();
    });

    it('should show dismiss button when dismissible', () => {
      component.dismissible.set(true);
      fixture.detectChanges();

      const dismissBtn = alertEl.querySelector('button[aria-label="Dismiss"]');
      expect(dismissBtn).toBeTruthy();
    });

    it('should emit dismiss event when clicked', () => {
      component.dismissible.set(true);
      fixture.detectChanges();

      const dismissBtn = alertEl.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!;
      dismissBtn.click();
      fixture.detectChanges();

      expect(component.dismissCount).toBe(1);
    });

    it('should hide alert when dismissed', () => {
      component.dismissible.set(true);
      fixture.detectChanges();

      const dismissBtn = alertEl.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!;
      dismissBtn.click();
      fixture.detectChanges();

      expect(alertEl.className).toContain('hidden');
    });

    it('should move focus to the next control instead of losing it when dismissed', () => {
      component.dismissible.set(true);
      fixture.detectChanges();
      const after = document.createElement('button');
      after.textContent = 'After';
      fixture.nativeElement.append(after);

      const dismissBtn = alertEl.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!;
      dismissBtn.focus();
      dismissBtn.click();
      fixture.detectChanges();

      expect(document.activeElement).toBe(after);
      after.remove();
    });
  });

  describe('aria-live', () => {
    it('should omit aria-live when the role conveys it', () => {
      expect(alertEl.getAttribute('aria-live')).toBeNull();
    });

    it('should set aria-live="off" and no role when ariaLive is off', () => {
      component.ariaLive.set('off');
      fixture.detectChanges();

      expect(alertEl.getAttribute('role')).toBeNull();
      expect(alertEl.getAttribute('aria-live')).toBe('off');
    });
  });

  describe('public methods', () => {
    it('should dismiss alert programmatically', () => {
      component.alert.dismissAlert();
      fixture.detectChanges();

      expect(alertEl.className).toContain('hidden');
      expect(component.dismissCount).toBe(1);
    });

    it('should show alert again after dismissal', () => {
      component.alert.dismissAlert();
      fixture.detectChanges();

      expect(alertEl.className).toContain('hidden');

      component.alert.show();
      fixture.detectChanges();

      expect(alertEl.className).not.toContain('hidden');
    });
  });

  describe('class customization', () => {
    it('should merge classOverride into host classes', () => {
      component.classOverride.set('custom-alert-class');
      fixture.detectChanges();

      expect(alertEl.className).toContain('custom-alert-class');
    });
  });
});

@Component({
  template: `
    <tw-alert variant="info">
      <tw-alert-title>Title</tw-alert-title>
      <tw-alert-description>Description text</tw-alert-description>
    </tw-alert>
  `,
  standalone: true,
  imports: [TwAlertComponent, TwAlertTitleComponent, TwAlertDescriptionComponent],
})
class AlertWithTitleDescriptionComponent {}

describe('Alert sub-components', () => {
  let fixture: ComponentFixture<AlertWithTitleDescriptionComponent>;
  let alertEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertWithTitleDescriptionComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(AlertWithTitleDescriptionComponent);
    fixture.detectChanges();
    alertEl = fixture.debugElement.query(By.directive(TwAlertComponent)).nativeElement;
  });

  it('should render title component', () => {
    const title = fixture.debugElement.query(By.directive(TwAlertTitleComponent));
    expect(title).toBeTruthy();
    expect(title.nativeElement.textContent).toContain('Title');
  });

  it('should render description component', () => {
    const desc = fixture.debugElement.query(By.directive(TwAlertDescriptionComponent));
    expect(desc).toBeTruthy();
    expect(desc.nativeElement.textContent).toContain('Description text');
  });

  it('should apply title classes', () => {
    const title = fixture.debugElement.query(By.directive(TwAlertTitleComponent)).nativeElement;
    expect(title.className).toContain('font-semibold');
  });

  it('should apply description classes', () => {
    const desc = fixture.debugElement.query(
      By.directive(TwAlertDescriptionComponent)
    ).nativeElement;
    expect(desc.className).toContain('text-sm');
  });
});

describe('TwAlertComponent class attribute', () => {
  @Component({
    template: `<tw-alert class="bg-sky-50 text-sky-800 border-sky-200 mb-6" dismissible
      >Static</tw-alert
    >`,
    standalone: true,
    imports: [TwAlertComponent],
  })
  class ClassHostComponent {}

  it('lets a static class override the conflicting variant colours', async () => {
    await TestBed.configureTestingModule({ imports: [ClassHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ClassHostComponent);
    fixture.detectChanges();
    const alert = fixture.debugElement.query(By.css('tw-alert')).nativeElement as HTMLElement;
    expect(alert.classList).toContain('bg-sky-50');
    expect(alert.classList).toContain('text-sky-800');
    expect(alert.classList).toContain('border-sky-200');
    expect(alert.classList).toContain('mb-6');
    expect(alert.classList).not.toContain('bg-blue-50');
    expect(alert.classList).not.toContain('text-blue-800');
    expect(alert.classList).not.toContain('border-blue-200');

    fixture.debugElement.query(By.directive(TwAlertComponent)).componentInstance.dismissAlert();
    fixture.detectChanges();
    expect(alert.classList).toContain('hidden');
    expect(alert.classList).not.toContain('mb-6');
  });
});
