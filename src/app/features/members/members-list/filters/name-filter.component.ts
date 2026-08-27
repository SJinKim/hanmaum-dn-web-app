import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import { MemberSummary } from '../../../../core/models/member.model';

/** Filter model persisted by the grid (`getModel`/`setModel`). */
export interface NameFilterModel {
  text?: string;
  groupLeaderOnly?: boolean;
}

/**
 * Name-column filter: text search on last+first name, plus a 순장 checkbox that
 * keeps only current church group leaders. An empty text + unchecked box means
 * "no filter". AG-Grid Community allows one filter per column, so both live here.
 */
@Component({
  selector: 'app-name-filter',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="w-56 p-2 text-[12px] text-primary">
      <input
        type="text"
        class="w-full mb-2 h-8 px-2 outline-none border border-gray-200 rounded-md
               text-[12px] placeholder:text-tertiary"
        [placeholder]="'members.filter.searchPlaceholder' | translate"
        [attr.aria-label]="'members.filter.searchAria' | translate"
        [(ngModel)]="searchText"
        (ngModelChange)="onChange()"
      />

      <label class="flex items-center gap-2 h-8 px-1 rounded-md hover:bg-gray-50 cursor-pointer">
        <input
          type="checkbox"
          [checked]="groupLeaderOnly"
          (change)="toggleGroupLeader()"
        />
        <span class="font-bold">{{ 'members.filter.groupLeader' | translate }}</span>
      </label>

      <div class="flex items-center justify-end mt-1 px-1">
        <button
          type="button"
          class="text-[11px] font-bold text-tertiary hover:underline"
          (click)="clear()"
        >{{ 'members.filter.reset' | translate }}</button>
      </div>
    </div>
  `,
})
export class NameFilterComponent implements IFilterAngularComp {
  searchText = '';
  groupLeaderOnly = false;

  private params!: IFilterParams;

  agInit(params: IFilterParams): void {
    this.params = params;
  }

  isFilterActive(): boolean {
    return this.searchText.trim().length > 0 || this.groupLeaderOnly;
  }

  doesFilterPass(params: IDoesFilterPassParams<MemberSummary>): boolean {
    const data = params.data;
    if (!data) return false;
    const q = this.searchText.trim().toLowerCase();
    if (q) {
      const name = `${data.lastName ?? ''}${data.firstName ?? ''}`.toLowerCase();
      if (!name.includes(q)) return false;
    }
    if (this.groupLeaderOnly && !data.isGroupLeader) return false;
    return true;
  }

  getModel(): NameFilterModel | null {
    if (!this.isFilterActive()) return null;
    return {
      text: this.searchText.trim() || undefined,
      groupLeaderOnly: this.groupLeaderOnly || undefined,
    };
  }

  setModel(model: NameFilterModel | null): void {
    this.searchText = model?.text ?? '';
    this.groupLeaderOnly = !!model?.groupLeaderOnly;
  }

  onChange(): void {
    this.params.filterChangedCallback();
  }

  toggleGroupLeader(): void {
    this.groupLeaderOnly = !this.groupLeaderOnly;
    this.params.filterChangedCallback();
  }

  clear(): void {
    this.searchText = '';
    this.groupLeaderOnly = false;
    this.params.filterChangedCallback();
  }
}
