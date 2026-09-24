import { Directive, TemplateRef, inject, input } from '@angular/core';
import { DataRecord } from '../data-record.model';

/** Template context of a custom cell: the row's record as `let-record`. */
export interface DataCellContext {
  $implicit: DataRecord;
}

/**
 * The cell of a `custom` column whose `key` matches, for content the kit has no
 * cell type for:
 *
 * ```html
 * <app-data-table [columns]="columns" [rows]="rows">
 *   <ng-template appDataCell="training" let-record>…</ng-template>
 * </app-data-table>
 * ```
 */
@Directive({
  selector: 'ng-template[appDataCell]',
  standalone: true,
})
export class DataCellDirective {
  /** The `key` of the column this template renders. */
  readonly key = input.required<string>({ alias: 'appDataCell' });
  readonly template = inject<TemplateRef<DataCellContext>>(TemplateRef);

  // The guard only narrows the template's `let-` type; `ctx` is never read.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static ngTemplateContextGuard(_dir: DataCellDirective, ctx: unknown): ctx is DataCellContext {
    return true;
  }
}
