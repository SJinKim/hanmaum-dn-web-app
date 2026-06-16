import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { MemberStatus } from '../../../../core/models/member.model';

@Component({
  selector: 'app-badge-cell',
  standalone: true,
  template: `
    <span [class]="'status-badge ' + cssClass">{{ display }}</span>
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
  display = '';
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
    this.display = value ?? '';
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
