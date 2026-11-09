import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** <az-alert tone="warning" title="Back pain above 3/10">Make tomorrow's session lighter.</az-alert> */
@Component({
  selector: 'az-alert',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()', '[attr.role]': "tone() === 'danger' ? 'alert' : 'status'" },
  template: `@if (title()) { <span class="az-alert__title">{{ title() }}</span> }<div><ng-content /></div>`,
})
export class AzAlertComponent {
  readonly tone = input<'info' | 'success' | 'warning' | 'danger'>('info');
  readonly title = input<string>();
  protected readonly classes = computed(() => `az-alert az-alert--${this.tone()}`);
}
