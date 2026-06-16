import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ICellRendererParams } from 'ag-grid-community';
import { MinistryChipsCellComponent } from './ministry-chips-cell.component';

describe('MinistryChipsCellComponent', () => {
  let fixture: ComponentFixture<MinistryChipsCellComponent>;
  let component: MinistryChipsCellComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MinistryChipsCellComponent] });
    fixture = TestBed.createComponent(MinistryChipsCellComponent);
    component = fixture.componentInstance;
  });

  it('shows a dash when empty', () => {
    component.agInit({ value: [] } as unknown as ICellRendererParams);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('—');
  });

  it('renders one chip per active ministry', () => {
    component.agInit({ value: ['찬양팀', '미디어팀'] } as unknown as ICellRendererParams);
    fixture.detectChanges();
    const chips = fixture.nativeElement.querySelectorAll('.status-badge');
    expect(chips.length).toBe(2);
  });
});
