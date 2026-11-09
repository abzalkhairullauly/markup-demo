import { Directive, computed, input } from '@angular/core';

export type AzButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** <button azButton variant="primary">Save</button>. Native element stays, so keyboard and forms work as usual. */
@Directive({
  selector: 'button[azButton], a[azButton]',
  standalone: true,
  host: { '[class]': 'classes()' },
})
export class AzButtonDirective {
  readonly variant = input<AzButtonVariant>('primary');
  readonly size = input<'md' | 'sm'>('md');
  protected readonly classes = computed(
    () => `az-btn az-btn--${this.variant()}${this.size() === 'sm' ? ' az-btn--sm' : ''}`,
  );
}
