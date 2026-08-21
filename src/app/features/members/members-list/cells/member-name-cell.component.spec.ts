import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ICellRendererParams } from 'ag-grid-community';
import { MemberSummary } from '../../../../core/models/member.model';
import { MemberNameCellComponent } from './member-name-cell.component';

function makeMember(overrides: Partial<MemberSummary> = {}): MemberSummary {
  return {
    publicId: 'p1',
    lastName: '김',
    firstName: '철수',
    email: 'kim@example.com',
    memberStatus: 'ACTIVE',
    baptism: null,
    groupName: null,
    ...overrides,
  };
}

function params(data: MemberSummary): ICellRendererParams<MemberSummary> {
  return { data } as ICellRendererParams<MemberSummary>;
}

describe('MemberNameCellComponent', () => {
  let fixture: ComponentFixture<MemberNameCellComponent>;
  let component: MemberNameCellComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberNameCellComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MemberNameCellComponent);
    component = fixture.componentInstance;
  });

  it('renders the name without a 순장 tag for ordinary members', () => {
    component.agInit(params(makeMember()));
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('김철수');
    expect(text).not.toContain('순장');
  });

  it('renders a 순장 status badge next to the name when isGroupLeader is true', () => {
    component.agInit(params(makeMember({ isGroupLeader: true })));
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('김철수');
    const tag = host.querySelector('.status-badge.badge-group-leader');
    expect(tag).withContext('순장 should use the status-badge chip').not.toBeNull();
    expect(tag!.textContent?.trim()).toBe('순장');
  });
});
