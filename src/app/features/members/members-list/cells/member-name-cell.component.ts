import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { MemberSummary } from '../../../../core/models/member.model';

@Component({
  selector: 'app-member-name-cell',
  standalone: true,
  template: `
    <div class="leading-tight py-1">
      <div class="flex items-center gap-1.5">
        <span class="text-[13px] font-semibold text-gray-800 tracking-tight">
          {{ member.lastName }}{{ member.firstName }}
        </span>
        @if (member.isGroupLeader) {
          <span class="status-badge badge-group-leader">순장</span>
        }
      </div>
      <div class="text-[11px] text-tertiary">{{ member.email ?? '—' }}</div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      height: 100%;
    }
  `],
})
export class MemberNameCellComponent implements ICellRendererAngularComp {
  member!: MemberSummary;

  agInit(params: ICellRendererParams<MemberSummary>): void {
    this.member = params.data!;
  }

  refresh(params: ICellRendererParams<MemberSummary>): boolean {
    this.member = params.data!;
    return true;
  }
}
