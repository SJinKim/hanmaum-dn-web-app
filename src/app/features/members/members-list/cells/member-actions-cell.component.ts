import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { MemberSummary, ChurchGroupSummary } from '../../../../core/models/member.model';

export interface MemberActionsContext {
  /** Options for the inline approve select — loaded once by the list component. */
  churchGroups: ChurchGroupSummary[];
  /** Resolves when the approval PATCH succeeds; rejects on failure. */
  onApprove: (member: MemberSummary, groupPublicId: string) => Promise<void>;
  onEdit: (member: MemberSummary, event: Event) => void;
  /** Called when approve is clicked but no church groups are available. */
  onGroupsMissing: () => void;
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
        @if (saving) {
          <i class="pi pi-spinner pi-spin text-primary text-[14px]" aria-label="Approving…"></i>
        } @else if (selecting) {
          <select
            (change)="onGroupChosen($event)"
            (click)="$event.stopPropagation()"
            class="h-7 max-w-[88px] bg-white border border-primary rounded-md text-[11px] text-primary font-bold px-1 outline-none"
            aria-label="Select church group"
          >
            <option value="" selected disabled>순 선택…</option>
            @for (group of ctx.churchGroups; track group.publicId) {
              <option [value]="group.publicId">{{ group.name }}</option>
            }
          </select>
          <button
            (click)="cancel($event)"
            class="w-6 h-6 ml-1 flex items-center justify-center text-tertiary hover:text-primary transition-colors"
            aria-label="Cancel"
          >
            <i class="pi pi-times text-[10px]"></i>
          </button>
        } @else {
          <button
            (click)="approve($event)"
            class="flex items-center gap-1 h-7 px-3 bg-primary text-white rounded-md text-[11px] font-bold hover:bg-primary-hover transition-colors tracking-tight"
          >
            <i class="pi pi-check text-[9px]"></i>
            Approve
          </button>
        }
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
  /** True while the church-group select is shown in place of the approve button. */
  selecting = false;
  /** True while the approval PATCH is in flight — shows a spinner. */
  saving = false;
  ctx!: MemberActionsContext;

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
    if (this.ctx.churchGroups.length === 0) {
      this.ctx.onGroupsMissing();
      return;
    }
    this.selecting = true;
  }

  async onGroupChosen(event: Event): Promise<void> {
    event.stopPropagation();
    const groupPublicId = (event.target as HTMLSelectElement).value;
    if (!groupPublicId) return;
    this.selecting = false;
    this.saving = true;
    try {
      await this.ctx.onApprove(this.member, groupPublicId);
      // On success the grid reloads and this cell re-renders with the new status.
    } catch {
      this.saving = false;
    }
  }

  cancel(event: Event): void {
    event.stopPropagation();
    this.selecting = false;
  }

  edit(event: Event): void {
    event.stopPropagation();
    this.ctx.onEdit(this.member, event);
  }
}
