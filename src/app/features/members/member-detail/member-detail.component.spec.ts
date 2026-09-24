import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MemberDetailComponent } from './member-detail.component';
import { MemberService } from '../member.service';
import { Member } from '../../../core/models/member.model';

describe('MemberDetailComponent — 교회 정보', () => {
  const base = {
    publicId: 'm1', lastName: '김', firstName: '철수', discriminator: null, gender: null,
    baptism: null, birthDate: null, phoneNumber: null, email: null, street: null, houseNumber: null, zipCode: null,
    city: null, registrationDate: '2023-02-01', memberStatus: 'ACTIVE', churchRole: null,
    groupPublicId: 'grp-1', groupName: '믿음',
    profileImageUrl: null, trainings: [], ministries: [],
    isGroupLeader: false,
  } as unknown as Member;

  function render(member: Partial<Member>) {
    TestBed.configureTestingModule({
      imports: [MemberDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'm1' }) } } },
        { provide: MemberService, useValue: { getMember: () => of({ ...base, ...member }) } },
      ],
    });
    const fixture = TestBed.createComponent(MemberDetailComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      component: fixture.componentInstance,
      leaderRow: () => {
        const row = el.querySelector('[data-testid="leader-row"]');
        return row ? Array.from(row.children, c => c.textContent?.trim()).join(' | ') : null;
      },
      churchCard: () => el.querySelector('[data-testid="church-card"]')?.textContent ?? '',
    };
  }

  it('shows a running tenure as "시작 ~ 현재"', () => {
    const { leaderRow } = render({ isGroupLeader: true, groupLeaderSince: '2024-03-01' });
    expect(leaderRow()).toBe('순장 | 2024-03-01 ~ 현재');
  });

  it('shows an ended tenure as 전 순장, naming the 순 when it was another one', () => {
    const { leaderRow } = render({
      lastGroupLeaderTenure: { groupPublicId: 'grp-2', groupName: '소망', startDate: '2024-03-01', endDate: '2026-09-10' },
    });
    expect(leaderRow()).toBe('전 순장 | 2024-03-01 ~ 2026-09-10 · 소망');
  });

  it('leaves the 순장 row out for a member who never led a group', () => {
    const { leaderRow, churchCard } = render({});
    expect(leaderRow()).toBeNull();
    expect(churchCard()).toContain('믿음');
    expect(churchCard()).toContain('2023-02-01');
  });
});
