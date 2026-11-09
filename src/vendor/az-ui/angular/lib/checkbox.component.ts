import { ChangeDetectionStrategy, Component, forwardRef, input, model } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** <az-checkbox [(checked)]="done">Mobility done</az-checkbox>, also works with formControlName. */
@Component({
  selector: 'az-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AzCheckboxComponent), multi: true }],
  template: `
    <label class="az-check">
      <input type="checkbox" [checked]="checked()" [disabled]="disabled()" (change)="toggle($event)" (blur)="onTouched()" />
      <ng-content />
    </label>
  `,
})
export class AzCheckboxComponent implements ControlValueAccessor {
  readonly checked = model(false);
  readonly disabled = model(false);
  private onChange: (v: boolean) => void = () => {};
  protected onTouched: () => void = () => {};

  protected toggle(e: Event): void {
    const v = (e.target as HTMLInputElement).checked;
    this.checked.set(v);
    this.onChange(v);
  }
  writeValue(v: boolean | null): void { this.checked.set(!!v); }
  registerOnChange(fn: (v: boolean) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
