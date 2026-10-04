import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Observable, of, throwError } from 'rxjs';

import { MemberDetailComponent } from './member-detail.component';
import { MemberService } from '../member.service';
import { Member } from '../../../core/models/member.model';
import { RoleService } from '../../../core/services/role.service';

describe('MemberDetailComponent — 교회 정보', () => {
  const base = {
    publicId: 'm1', lastName: '김', firstName: '철수', discriminator: null, gender: null,
    baptism: null, birthDate: null, phoneNumber: null, email: null, street: null, houseNumber: null, zipCode: null,
    city: null, registrationDate: '2023-02-01', memberStatus: 'ACTIVE', churchRole: null,
    groupPublicId: 'grp-1', groupName: '믿음',
    profileImageUrl: null, trainings: [], ministries: [],
    isGroupLeader: false,
  } as unknown as Member;

  function render(member: Partial<Member>, getMember: () => Observable<Member> = () => of({ ...base, ...member })) {
    TestBed.configureTestingModule({
      imports: [MemberDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'm1' }) } } },
        { provide: MemberService, useValue: { getMember } },
      ],
    });
    const fixture = TestBed.createComponent(MemberDetailComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      component: fixture.componentInstance,
      leaderRow: () => {
        const row = el.querySelector('[data-testid="leader-row"]');
        return row ? Array.from(row.querySelectorAll('dt, dd'), c => c.textContent?.trim()).join(' | ') : null;
      },
      churchCard: () => el.querySelector('[data-testid="church-card"]')?.textContent ?? '',
      basicCard: () => el.querySelector('[data-testid="basic-card"]')?.textContent ?? '',
      el,
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

  it('joins the address into one line and leaves out missing parts', () => {
    const { component } = render({ street: 'Hauptstraße', houseNumber: '12a', zipCode: '10115', city: 'Berlin' });
    expect(component.address()).toBe('Hauptstraße 12a, 10115 Berlin');
  });

  it('shows — for an address with nothing in it, and only the city when that is all there is', () => {
    expect(render({}).component.address()).toBe('—');
    TestBed.resetTestingModule();
    expect(render({ city: 'Berlin' }).component.address()).toBe('Berlin');
  });

  it('shows the occupation in 기본 정보', () => {
    const { basicCard } = render({ occupation: '개발자' });
    expect(basicCard()).toContain('개발자');
  });

  it('colors a 양육 badge by 상태: 신청/등록 grey, 진행 중 orange, 수료 green, 중단/미확인 red', () => {
    const { component } = render({});
    const t = (status: string) =>
      component.trainingBadge({ trainingPublicId: 't', name: 'x', status, completedAt: null } as never).variant;
    expect(t('APPLIED')).toBe('neutral');
    expect(t('ENROLLED')).toBe('neutral');
    expect(t('IN_PROGRESS')).toBe('training-progress');
    expect(t('COMPLETED')).toBe('training-completed');
    expect(t('DROPPED')).toBe('deleted');
    expect(t('UNKNOWN')).toBe('deleted');
  });

  it('shows the error state instead of the cards when the member cannot be loaded', () => {
    const { el, churchCard } = render({}, () => throwError(() => new Error('404')));
    expect(churchCard()).toBe('');
    expect(el.querySelector('app-empty-state')).not.toBeNull();
  });
});

describe('MemberDetailComponent — 삭제됨 (#144)', () => {
  const deleted = {
    publicId: 'm1', lastName: '홍', firstName: '길동', discriminator: null, gender: null,
    baptism: null, birthDate: null, phoneNumber: null, email: 'gildong.hong@example.com', street: null,
    houseNumber: null, zipCode: null, city: null, registrationDate: '2023-02-01', memberStatus: 'DELETED',
    churchRole: null, groupPublicId: null, groupName: null, profileImageUrl: null, trainings: [], ministries: [],
    isGroupLeader: false,
  } as unknown as Member;

  function render(opts: { member?: Partial<Member>; admin?: boolean; restore?: () => Observable<Member> } = {}) {
    const memberService = {
      getMember: () => of({ ...deleted, ...opts.member }),
      restoreMember: jasmine.createSpy('restoreMember').and.callFake(opts.restore ?? (() => of({ ...deleted, memberStatus: 'ACTIVE' } as Member))),
      purgeMember: jasmine.createSpy('purgeMember').and.returnValue(of(undefined)),
    };
    const admin = opts.admin ?? true;
    TestBed.configureTestingModule({
      imports: [MemberDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'm1' }) } } },
        { provide: MemberService, useValue: memberService },
        { provide: RoleService, useValue: { canWrite: () => true, hasAnyRole: () => admin, isAdmin: () => admin } },
      ],
    });
    const fixture = TestBed.createComponent(MemberDetailComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const messages = fixture.debugElement.injector.get(MessageService);
    return { fixture, el, memberService, messages, component: fixture.componentInstance };
  }

  it('shows 복원 and 영구 삭제 instead of edit for an admin', () => {
    const { el } = render();
    expect(el.querySelector('[data-testid="restore-button"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="purge-button"]')).not.toBeNull();
    expect(el.querySelector('p-button[icon="pi pi-pencil"]')).toBeNull();
  });

  it('hides 영구 삭제 for a writer who is not admin', () => {
    const { el } = render({ admin: false });
    expect(el.querySelector('[data-testid="restore-button"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="purge-button"]')).toBeNull();
  });

  it('keeps edit and the more-menu for a member that is not deleted', () => {
    const { el } = render({ member: { memberStatus: 'ACTIVE' } });
    expect(el.querySelector('[data-testid="restore-button"]')).toBeNull();
    expect(el.querySelector('p-button[icon="pi pi-pencil"]')).not.toBeNull();
  });

  it('restores the member and shows it as active again', () => {
    const { component, memberService } = render();
    component.restore();
    expect(memberService.restoreMember).toHaveBeenCalledWith('m1');
    expect(component.isDeleted()).toBe(false);
  });

  it('names the email conflict when restore answers 409', () => {
    const { component, messages } = render({
      restore: () => throwError(() => new HttpErrorResponse({ status: 409 })),
    });
    const add = spyOn(messages, 'add');
    component.restore();
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ detail: 'members.detail.toast.restoreConflict' }));
    expect(component.isDeleted()).toBe(true);
  });
});
