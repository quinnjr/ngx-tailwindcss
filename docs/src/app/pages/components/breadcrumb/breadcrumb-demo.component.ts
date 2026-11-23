import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { BreadcrumbItem, TwBreadcrumbComponent } from 'ngx-tailwindcss';
import { DemoSectionComponent, PageHeaderComponent } from '../../../shared/demo-section.component';

@Component({
  selector: 'app-breadcrumb-demo',
  standalone: true,
  imports: [
    CommonModule,
    TwBreadcrumbComponent,
    DemoSectionComponent,
    PageHeaderComponent,
  ],
  templateUrl: './breadcrumb-demo.component.html',
})
export class BreadcrumbDemoComponent {
  private readonly sanitizer = inject(DomSanitizer);

  items: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Components', href: '/components' },
    { label: 'Breadcrumb' },
  ];

  // Inline SVG passed as a string must be explicitly trusted; Angular's sanitizer strips <svg>
  safeHtmlItems: BreadcrumbItem[] = [
    {
      label: 'Home',
      href: '/',
      icon: this.sanitizer.bypassSecurityTrustHtml(
        '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>'
      ),
    },
    { label: 'Components', href: '/components' },
    { label: 'Breadcrumb' },
  ];

  basicCode = `<tw-breadcrumb [items]="items"></tw-breadcrumb>

// Component
items: BreadcrumbItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Components', href: '/components' },
  { label: 'Breadcrumb' },
];`;

  iconsCode = `<!-- 1. TemplateRef (recommended for inline SVG) -->
<ng-template #homeIcon>
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" />
  </svg>
</ng-template>
<tw-breadcrumb
  [items]="[{ label: 'Home', href: '/', icon: homeIcon }, { label: 'Breadcrumb' }]"
></tw-breadcrumb>

// 2. SafeHtml: markup you trust, explicitly marked with DomSanitizer
private readonly sanitizer = inject(DomSanitizer);
items: BreadcrumbItem[] = [
  { label: 'Home', href: '/', icon: this.sanitizer.bypassSecurityTrustHtml('<svg>...</svg>') },
  { label: 'Breadcrumb' },
];

// 3. Plain string: rendered via [innerHTML] and sanitized by Angular,
//    so <svg> and other unsafe markup is stripped. Use it only for simple HTML/text.
items: BreadcrumbItem[] = [{ label: 'Home', href: '/', icon: '&#8962;' }, { label: 'Breadcrumb' }];`;

  separatorsCode = `<tw-breadcrumb [items]="items" separator="slash"></tw-breadcrumb>
<tw-breadcrumb [items]="items" separator="chevron"></tw-breadcrumb>
<tw-breadcrumb [items]="items" separator="arrow"></tw-breadcrumb>
<tw-breadcrumb [items]="items" separator="dot"></tw-breadcrumb>`;

  sizesCode = `<tw-breadcrumb [items]="items" size="sm"></tw-breadcrumb>
<tw-breadcrumb [items]="items" size="md"></tw-breadcrumb>
<tw-breadcrumb [items]="items" size="lg"></tw-breadcrumb>`;
}

