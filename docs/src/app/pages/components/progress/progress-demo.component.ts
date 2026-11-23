import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwProgressComponent, TwProgressCircularComponent } from 'ngx-tailwindcss';
import { DemoSectionComponent, PageHeaderComponent } from '../../../shared/demo-section.component';

@Component({
  selector: 'app-progress-demo',
  standalone: true,
  imports: [
    CommonModule,
    TwProgressComponent,
    TwProgressCircularComponent,
    DemoSectionComponent,
    PageHeaderComponent,
  ],
  templateUrl: './progress-demo.component.html',
})
export class ProgressDemoComponent {
  progress = 65;

  basicCode = `<tw-progress label="Upload progress" [value]="65"></tw-progress>`;

  variantsCode = `<tw-progress label="Primary (75%)" variant="primary" [value]="75"></tw-progress>
<tw-progress label="Success (100%)" variant="success" [value]="100"></tw-progress>
<tw-progress label="Warning (50%)" variant="warning" [value]="50"></tw-progress>
<tw-progress label="Danger (25%)" variant="danger" [value]="25"></tw-progress>`;

  sizesCode = `<tw-progress label="Small" size="sm" [value]="60"></tw-progress>
<tw-progress label="Medium" size="md" [value]="60"></tw-progress>
<tw-progress label="Large" size="lg" [value]="60"></tw-progress>`;

  stripedCode = `<tw-progress label="Striped" [value]="70" [striped]="true"></tw-progress>
<tw-progress label="Striped Animated" [value]="70" [striped]="true" [animated]="true"></tw-progress>`;

  labelCode = `<tw-progress label="Profile completion" [value]="75" [showValue]="true"></tw-progress>`;

  indeterminateCode = `<tw-progress label="Loading" [indeterminate]="true"></tw-progress>`;

  circularCode = `<tw-progress-circular [value]="25" [size]="48" label="Upload progress"></tw-progress-circular>
<tw-progress-circular [value]="50" [size]="64" label="Sync progress"></tw-progress-circular>
<tw-progress-circular [value]="75" [size]="80" [showValue]="true" label="Download progress"></tw-progress-circular>
<tw-progress-circular [indeterminate]="true" [size]="64" label="Loading"></tw-progress-circular>`;
}
