import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { MinistryListComponent } from './ministry-list.component';
import { MinistryService } from '../ministry.service';
import { ActiveMinistryMemberDto, MinistrySummary } from '../ministry.model';

const KO = {
  ministry: {
    subtitle: '사역 {{total}}개 · 운영 중 {{active}}개',
    addButton: '사역 추가',
    active: '운영 중',
    memberCount: '팀원 {{count}}명',
    noResults: { heading: '검색 결과가 없습니다' },
    error: { heading: '사역 목록을 불러올 수 없습니다' },
  },
};

function ministry(publicId: string, title: string, isActive = true): MinistrySummary {
  return { publicId, title, subtitle: '', imageUrl: null, contacts: [], isActive } as unknown as MinistrySummary;
}

function members(names: string[]): ActiveMinistryMemberDto[] {
  return names.map((fullName, i) => ({ publicId: `m${i}`, fullName, startDate: null, note: null, gender: null }) as unknown as ActiveMinistryMemberDto);
}

describe('MinistryListComponent', () => {
  let service: jasmine.SpyObj<MinistryService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<MinistryService>('MinistryService', ['getMinistries', 'getActiveMembers']);
    service.getMinistries.and.returnValue(of([
      ministry('a', '찬양팀'),
      ministry('b', '예배준비'),
      ministry('c', '중보기도', false),
    ]));
    service.getActiveMembers.and.callFake((id: string) => {
      if (id === 'a') return of(members(['김철수', '이영희', '박민수', '최지은', '정하늘', '한별']));
      if (id === 'b') return of(members(['문', '양']));
      return throwError(() => new Error('boom'));
    });

    TestBed.configureTestingModule({
      imports: [MinistryListComponent],
      providers: [
        { provide: MinistryService, useValue: service },
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', KO);
    translate.use('ko');
  });

  function render() {
    const fixture = TestBed.createComponent(MinistryListComponent);
    fixture.detectChanges();
    return fixture;
  }

  function cards(el: HTMLElement): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>('[data-testid="ministry-card"]'));
  }

  it('counts all and active ministries in the subtitle', () => {
    const el = render().nativeElement as HTMLElement;
    expect(el.textContent).toContain('사역 3개 · 운영 중 2개');
  });

  it('renders one linked card per ministry with the 운영 중 badge only when active', () => {
    const el = render().nativeElement as HTMLElement;
    const [first, , third] = cards(el);
    expect(cards(el).length).toBe(3);
    expect(first.getAttribute('href')).toBe('/ministry/a');
    expect(first.textContent).toContain('운영 중');
    expect(third.textContent).not.toContain('운영 중');
  });

  it('shows the member count, four avatars and the overflow', () => {
    const el = render().nativeElement as HTMLElement;
    const first = cards(el)[0];
    expect(first.querySelector('[data-testid="member-count"]')?.textContent).toContain('팀원 6명');
    expect(first.querySelectorAll('app-avatar').length).toBe(4);
    expect(first.textContent).toContain('+2');
  });

  it('hides the member row of a card whose members failed to load', () => {
    const el = render().nativeElement as HTMLElement;
    expect(cards(el)[2].querySelector('[data-testid="member-count"]')).toBeNull();
  });

  it('filters cards by name', () => {
    const fixture = render();
    fixture.componentInstance.searchText.set('찬양');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(cards(el).map(c => c.textContent)).toEqual([jasmine.stringContaining('찬양팀')]);

    fixture.componentInstance.searchText.set('없음');
    fixture.detectChanges();
    expect(cards(el).length).toBe(0);
    expect(el.textContent).toContain('검색 결과가 없습니다');
  });

  it('shows the error state when the list fails', () => {
    service.getMinistries.and.returnValue(throwError(() => new Error('down')));
    const el = render().nativeElement as HTMLElement;
    expect(el.textContent).toContain('사역 목록을 불러올 수 없습니다');
  });
});
