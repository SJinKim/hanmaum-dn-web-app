import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { MemberSummary } from '../../../../core/models/member.model';

export interface MemberActionsContext {
  onApprove: (member: MemberSummary, event: Event) => void;
  onEdit: (member: MemberSummary, event: Event) => void;
}

interface ActionsCellParams extends ICellRendererParams<MemberSummary> {
  action: 'approve' | 'edit';
  context: MemberActionsContext;
}

@Component({
  selector: 'app-member-actions-cell',
  standalone: true,
  template: `
    @if (action === 'approve') {
      @if (member.memberStatus === 'PENDING') {
        <button
          (click)="approve($event)"
          class="flex items-center gap-1 h-7 px-3 bg-primary text-white rounded-md text-[11px] font-bold hover:bg-primary-hover transition-colors tracking-tight"
        >
          <i class="pi pi-check text-[9px]"></i>
          Approve
        </button>
      } @else {
        <span class="text-tertiary text-[12px]">—</span>
      }
    } @else {
      <button
        (click)="edit($event)"
        class="w-8 h-8 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg text-secondary hover:text-primary hover:border-primary transition-colors"
        aria-label="Edit member"
      >
        <i class="pi pi-pencil text-[11px]"></i>
      </button>
    }
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      height: 100%;
    }
  `],
})
export class MemberActionsCellComponent implements ICellRendererAngularComp {
  member!: MemberSummary;
  action!: 'approve' | 'edit';
  private ctx!: MemberActionsContext;

  agInit(params: ActionsCellParams): void {
    this.member = params.data!;
    this.action = params.action;
    this.ctx = params.context;
  }

  refresh(params: ActionsCellParams): boolean {
    this.member = params.data!;
    return true;
  }

  approve(event: Event): void {
    event.stopPropagation();
    this.ctx.onApprove(this.member, event);
  }

  edit(event: Event): void {
    event.stopPropagation();
    this.ctx.onEdit(this.member, event);
  }
}
