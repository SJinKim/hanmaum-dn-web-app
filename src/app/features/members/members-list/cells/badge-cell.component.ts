import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { MemberStatus } from '../../../../core/models/member.model';

@Component({
  selector: 'app-badge-cell',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <span [class]="'status-badge ' + cssClass">
      @if (statusKey) { {{ statusKey | translate }} }
    </span>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      height: 100%;
    }
  `],
})
export class BadgeCellComponent implements ICellRendererAngularComp {
  /** Translation key for the status label, or '' when there is no status. */
  statusKey = '';
  cssClass = '';

  agInit(params: ICellRendererParams): void {
    this.update(params);
  }

  refresh(params: ICellRendererParams): boolean {
    this.update(params);
    return true;
  }

  private update(params: ICellRendererParams): void {
    const value = params.value as MemberStatus | undefined;
    this.statusKey = value ? `members.status.${value}` : '';
    this.cssClass = this.statusClass(value);
  }

  private statusClass(status?: MemberStatus): string {
    const map: Record<MemberStatus, string> = {
      ACTIVE: 'badge-active',
      INACTIVE: 'badge-inactive',
      PENDING: 'badge-pending',
      DELETED: 'badge-deleted',
    };
    return status ? map[status] ?? '' : '';
  }
}
