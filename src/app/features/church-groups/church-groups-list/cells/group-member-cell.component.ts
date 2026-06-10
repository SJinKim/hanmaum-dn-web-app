import { Component, ViewChild } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { FormsModule } from '@angular/forms';
import { Popover } from 'primeng/popover';
import { CheckboxModule } from 'primeng/checkbox';
import { MatrixCell, MatrixRow, MemberCategory, CATEGORY_CONFIG } from '../../church-groups.service';

interface CellContext {
  activeFilters: () => Set<MemberCategory>;
  patchFlags: (publicId: string, patch: { isNextGroupLeader?: boolean; oneOnOneSignupFilled?: boolean }) => void;
}

@Component({
  selector: 'app-group-member-cell',
  standalone: true,
  imports: [FormsModule, Popover, CheckboxModule],
  template: `
    @if (cell) {
      <div
        class="member-cell"
        [style.background-color]="bgColor"
        [style.opacity]="isVisible ? '1' : '0.15'"
        (click)="pop.toggle($event)">
        {{ cell.displayName }}
      </div>
      <p-popover #pop>
        <div class="flex flex-col gap-3 p-1 min-w-36">
          <p-checkbox
            [(ngModel)]="cell.isNextGroupLeader"
            [binary]="true"
            label="예비순장"
            (onChange)="onFlagChange('isNextGroupLeader', $event.checked)" />
          <p-checkbox
            [(ngModel)]="cell.oneOnOneSignupFilled"
            [binary]="true"
            label="일대일 신청서 제출"
            (onChange)="onFlagChange('oneOnOneSignupFilled', $event.checked)" />
        </div>
      </p-popover>
    } @else {
      <div class="empty-cell"></div>
    }
  `,
  styles: [`
    :host { display: flex; align-items: stretch; height: 100%; }
    .member-cell {
      cursor: pointer;
      padding: 2px 6px;
      font-size: 11px;
      width: 100%;
      display: flex;
      align-items: center;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      border: 1px solid #e5e7eb;
      transition: opacity 0.15s;
    }
    .empty-cell {
      width: 100%;
      background: #fafafa;
      border: 1px solid #f3f4f6;
    }
  `],
})
export class GroupMemberCellComponent implements ICellRendererAngularComp {
  @ViewChild('pop') pop!: Popover;

  cell: MatrixCell | null = null;
  bgColor = '#f9fafb';
  isVisible = true;

  private context!: CellContext;

  agInit(params: ICellRendererParams<MatrixRow, MatrixCell | null> & { context: CellContext }): void {
    this.update(params);
  }

  refresh(params: ICellRendererParams<MatrixRow, MatrixCell | null> & { context: CellContext }): boolean {
    this.update(params);
    return true;
  }

  private update(params: ICellRendererParams & { context: CellContext }): void {
    this.cell = params.value as MatrixCell | null;
    this.context = params.context;
    if (this.cell) {
      this.bgColor = CATEGORY_CONFIG[this.cell.category].color;
      const filters = this.context.activeFilters();
      this.isVisible = filters.size === 0 || filters.has(this.cell.category);
    }
  }

  onFlagChange(
    flag: 'isNextGroupLeader' | 'oneOnOneSignupFilled',
    value: boolean,
  ): void {
    if (!this.cell) return;
    this.context.patchFlags(this.cell.publicId, { [flag]: value });
    if (flag === 'isNextGroupLeader') {
      this.cell = { ...this.cell, isNextGroupLeader: value };
      this.bgColor = value
        ? CATEGORY_CONFIG['NEXT_LEADER'].color
        : CATEGORY_CONFIG[this.cell.category].color;
    }
  }
}
