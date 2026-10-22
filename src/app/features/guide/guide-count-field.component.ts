import { Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TranslatePipe } from '@ngx-translate/core';
import { GuideCountInputDirective } from './guide-count-input.directive';
@Component({
  selector: 'app-guide-count-field', standalone: true,
  imports: [ReactiveFormsModule, InputTextModule, TranslatePipe, GuideCountInputDirective],
  host: { class: 'block min-w-0' },
  template: `
    <label [for]="controlId()" [class.sr-only]="!showLabel()" class="type-caption text-ink-strong block mb-[var(--space-4)]">{{ label() }}</label>
    <input pInputText appGuideCount type="text" inputmode="numeric" [id]="controlId()" [formControl]="control()"
      [attr.data-count-key]="navigationKey()" [invalid]="invalid()" [attr.aria-invalid]="invalid()"
      [attr.aria-describedby]="invalid() ? controlId() + '-error' : null" class="w-full min-w-0" placeholder="—" (input)="edited.emit()" />
    @if (invalid()) { <small [id]="controlId() + '-error'" role="alert" class="type-caption text-ink-strong">{{ 'guide.reports.invalidCount' | translate }}</small> }
  `,
})
export class GuideCountFieldComponent {
  readonly control = input.required<FormControl<string>>();
  readonly controlId = input.required<string>();
  readonly navigationKey = input.required<string>();
  readonly label = input.required<string>();
  readonly showLabel = input(false);
  readonly invalid = input(false);
  readonly edited = output<void>();
}
