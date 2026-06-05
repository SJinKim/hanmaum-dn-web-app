import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

/** Renders a member's currently-active ministry names as chips; '—' when none. */
@Component({
  selector: 'app-ministry-chips-cell',
  standalone: true,
  template: `
    @if (names.length === 0) {
      <span class="text-tertiary">—</span>
    } @else {
      <div class="chips">
        @for (n of names; track $index) {
          <span class="status-badge badge-ministry-active">{{ n }}</span>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: flex; align-items: center; height: 100%; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  `],
})
export class MinistryChipsCellComponent implements ICellRendererAngularComp {
  names: string[] = [];
  agInit(params: ICellRendererParams): void { this.update(params); }
  refresh(params: ICellRendererParams): boolean { this.update(params); return true; }
  private update(params: ICellRendererParams): void {
    this.names = (params.value as string[] | undefined) ?? [];
  }
}
