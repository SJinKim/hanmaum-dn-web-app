import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap } from 'rxjs';

import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';

import { injectAppLang } from '../../../core/i18n/language';
import { RoleService } from '../../../core/services/role.service';
import { BadgeComponent } from '../../../core/ui/badge/badge.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import {
  BULLETIN_LIMITS,
  BULLETIN_STATUS_BADGE,
  BulletinAnnouncement,
  BulletinContent,
  BulletinEdition,
  BulletinRequiredField,
  BulletinSectionKey,
  UpdateBulletinRequest,
  formatServiceDate,
} from '../bulletins.model';
import { BulletinsService } from '../bulletins.service';
import { BulletinSharingEditorComponent } from '../bulletin-sharing/bulletin-sharing-editor.component';
import { BulletinSharingPreviewComponent } from '../bulletin-sharing/bulletin-sharing-preview.component';
import { BulletinSharingDraftBlock, sharingIsValid, sharingRequest } from '../bulletin-sharing/bulletin-sharing.model';

/** The single-line text fields of an edition, in form order. */
export type BulletinTextField =
  | 'openingPrayerBy' | 'offeringSongBy' | 'scriptureReference' | 'sermonTitle'
  | 'sermonPreacher' | 'responsePrayerBy' | 'responseSong';

/** What the form holds: every text as a string, lists as they are typed. */
export type BulletinDraft = Record<BulletinTextField, string> & {
  songs: string[];
  announcements: { title: string; body: string }[];
  sharingBlocks: BulletinSharingDraftBlock[];
};

const LONG_FIELDS: readonly BulletinTextField[] = ['sermonTitle', 'responseSong'];

function toDraft(e: BulletinContent): BulletinDraft {
  return {
    openingPrayerBy: e.openingPrayerBy ?? '',
    offeringSongBy: e.offeringSongBy ?? '',
    scriptureReference: e.scriptureReference ?? '',
    sermonTitle: e.sermonTitle ?? '',
    sermonPreacher: e.sermonPreacher ?? '',
    responsePrayerBy: e.responsePrayerBy ?? '',
    responseSong: e.responseSong ?? '',
    songs: [...e.songs],
    announcements: e.announcements.map(a => ({ title: a.title, body: a.body ?? '' })),
    sharingBlocks: e.sharingBlocks.map((block, editorId) => ({ ...block, editorId })),
  };
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * 주보 편집 (#36) — Figma: 주보 · 편집. One card per section of the order of
 * worship, the 앱 미리보기 on the right follows every keystroke.
 *
 * PUT replaces the whole content, including the 설교 나눔 block editor (#193).
 * A published edition is read-only until it is withdrawn.
 */
@Component({
  selector: 'app-bulletin-editor',
  standalone: true,
  imports: [
    NgTemplateOutlet, TranslatePipe, ButtonModule, ConfirmDialogModule, InputTextModule, TabsModule, TextareaModule,
    ToastModule, BadgeComponent, EmptyStateComponent, PageHeaderComponent, SectionHeaderComponent,
    SkeletonComponent, BulletinSharingEditorComponent, BulletinSharingPreviewComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './bulletin-editor.component.html',
})
export class BulletinEditorComponent implements OnInit {
  private readonly service    = inject(BulletinsService);
  private readonly messages   = inject(MessageService);
  private readonly confirm    = inject(ConfirmationService);
  private readonly translate  = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly roles      = inject(RoleService);
  private readonly lang       = injectAppLang();

  protected readonly limits = BULLETIN_LIMITS;

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly edition = signal<BulletinEdition | null>(null);
  readonly draft = signal<BulletinDraft | null>(null);
  readonly dirty = signal(false);
  readonly busy = signal(false);
  readonly conflict = signal(false);
  readonly missing = signal<ReadonlySet<BulletinRequiredField>>(new Set());
  readonly activeTab = signal(0);
  readonly sharingValidationShown = signal(false);
  readonly sharingResetVersion = signal(0);
  readonly sharingInvalid = computed(() => this.sharingValidationShown() && !sharingIsValid(this.draft()?.sharingBlocks ?? []));

  readonly canWrite = computed(() => this.roles.canWrite('bulletin'));
  readonly published = computed(() => this.edition()?.status === 'PUBLISHED');
  readonly readOnly = computed(() => !this.canWrite() || this.published());

  readonly dateLabel = computed(() => {
    this.lang();
    const e = this.edition();
    return e ? formatServiceDate(e.serviceDate, this.translate.instant('bulletins.sunday')) : '';
  });

  readonly heading = computed(() => {
    this.lang();
    const e = this.edition();
    return e ? this.translate.instant('bulletins.editor.heading', { date: e.serviceDate }) as string : '';
  });

  readonly volumeLabel = computed(() => {
    this.lang();
    const e = this.edition();
    if (!e) return '';
    return e.volume === null
      ? this.translate.instant('bulletins.editor.volumeNone') as string
      : this.translate.instant('bulletins.volume', { volume: e.volume }) as string;
  });

  readonly breadcrumb = computed<string[]>(() => {
    this.lang();
    const e = this.edition();
    const middle = e?.volume != null
      ? this.translate.instant('bulletins.volume', { volume: e.volume })
      : this.translate.instant('bulletins.editor.crumbDraft');
    return [
      this.translate.instant('bulletins.title'),
      middle,
      this.translate.instant('bulletins.editor.crumbEdit'),
    ];
  });

  readonly statusBadge = computed(() => {
    this.lang();
    const e = this.edition();
    return e
      ? { variant: BULLETIN_STATUS_BADGE[e.status], label: this.translate.instant(`bulletins.status.${e.status}`) as string }
      : null;
  });

  readonly serviceLabel = computed(() => {
    const e = this.edition();
    if (!e) return '';
    const start = e.serviceStartTime ? ` · ${e.serviceStartTime.slice(0, 5)}` : '';
    return `${e.serviceName ?? '—'}${start}`;
  });

  /** Section titles as the admin renamed them; the server always sends all four. */
  readonly sectionTitle = computed(() => {
    const titles = new Map(this.edition()?.sectionTitles.map(t => [t.key, t.title]) ?? []);
    return (key: BulletinSectionKey) => titles.get(key) ?? '';
  });

  /** The filled songs, as the app lists them. */
  readonly previewSongs = computed(() => (this.draft()?.songs ?? []).map(s => s.trim()).filter(s => s !== ''));

  readonly previewAnnouncements = computed(() =>
    (this.draft()?.announcements ?? []).filter(a => a.title.trim() !== ''));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('publicId');
    if (!id) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }
    this.loading.set(true);
    this.notFound.set(false);
    this.service.get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: e => {
          this.apply(e);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notFound.set(true);
        },
      });
  }

  /** Discards the input and loads the version that won (after a 409). */
  reload(): void {
    this.conflict.set(false);
    this.load();
  }

  goBack(): void {
    void this.router.navigate(['/bulletins']);
  }

  fieldValue(field: BulletinTextField): string {
    return this.draft()?.[field] ?? '';
  }

  maxLength(field: BulletinTextField): number {
    return LONG_FIELDS.includes(field) ? BULLETIN_LIMITS.longText : BULLETIN_LIMITS.shortText;
  }

  isMissing(field: BulletinRequiredField): boolean {
    return this.missing().has(field);
  }

  // ─── Editing ────────────────────────────────────────────────────────────────

  setField(field: BulletinTextField, value: string): void {
    this.patch(d => ({ ...d, [field]: value }));
    this.clearMissing(field);
  }

  setSong(index: number, value: string): void {
    this.patch(d => ({ ...d, songs: d.songs.map((s, i) => (i === index ? value : s)) }));
    this.clearMissing('songs');
  }

  addSong(): void {
    this.patch(d => (d.songs.length >= BULLETIN_LIMITS.songs ? d : { ...d, songs: [...d.songs, ''] }));
  }

  removeSong(index: number): void {
    this.patch(d => ({ ...d, songs: d.songs.filter((_, i) => i !== index) }));
  }

  moveSong(index: number, delta: -1 | 1): void {
    this.patch(d => {
      const to = index + delta;
      return to < 0 || to >= d.songs.length ? d : { ...d, songs: move(d.songs, index, to) };
    });
  }

  setAnnouncement(index: number, key: 'title' | 'body', value: string): void {
    this.patch(d => ({
      ...d,
      announcements: d.announcements.map((a, i) => (i === index ? { ...a, [key]: value } : a)),
    }));
  }

  addAnnouncement(): void {
    this.patch(d => (d.announcements.length >= BULLETIN_LIMITS.announcements
      ? d
      : { ...d, announcements: [...d.announcements, { title: '', body: '' }] }));
  }

  removeAnnouncement(index: number): void {
    this.patch(d => ({ ...d, announcements: d.announcements.filter((_, i) => i !== index) }));
  }

  moveAnnouncement(index: number, delta: -1 | 1): void {
    this.patch(d => {
      const to = index + delta;
      return to < 0 || to >= d.announcements.length ? d : { ...d, announcements: move(d.announcements, index, to) };
    });
  }

  setSharingBlocks(sharingBlocks: BulletinSharingDraftBlock[]): void {
    if (this.busy()) return;
    this.patch(d => ({ ...d, sharingBlocks }));
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  save(): void {
    if (this.readOnly() || this.busy()) return;
    if (!this.validateSharing()) return;
    this.busy.set(true);
    this.saveIfDirty(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toast('success', 'bulletins.toast.saved');
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.handleSaveError(err);
        },
      });
  }

  confirmPublish(): void {
    const e = this.edition();
    if (!e || this.readOnly() || this.busy()) return;
    if (!this.validateSharing()) return;
    this.confirm.confirm({
      header: this.translate.instant('bulletins.publish.header'),
      message: e.volume === null
        ? this.translate.instant('bulletins.publish.messageNew', { date: e.serviceDate })
        : this.translate.instant('bulletins.publish.message', { date: e.serviceDate, volume: e.volume }),
      icon: 'pi pi-send',
      acceptLabel: this.translate.instant('bulletins.publish.action'),
      rejectLabel: this.translate.instant('bulletins.cancel'),
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => this.publish(),
    });
  }

  confirmWithdraw(): void {
    const e = this.edition();
    if (!e || !this.canWrite() || !this.published() || this.busy()) return;
    this.confirm.confirm({
      header: this.translate.instant('bulletins.withdraw.header'),
      message: this.translate.instant('bulletins.withdraw.message', { date: e.serviceDate }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('bulletins.withdraw.action'),
      rejectLabel: this.translate.instant('bulletins.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => this.withdraw(),
    });
  }

  /** The request a save sends: trimmed, blanks as null, empty rows dropped. */
  buildRequest(): UpdateBulletinRequest | null {
    const e = this.edition();
    const d = this.draft();
    if (!e || !d) return null;
    const announcements: BulletinAnnouncement[] = d.announcements
      .filter(a => a.title.trim() !== '')
      .map(a => ({ title: a.title.trim(), body: blankToNull(a.body) }));
    return {
      version: e.version,
      openingPrayerBy: blankToNull(d.openingPrayerBy),
      offeringSongBy: blankToNull(d.offeringSongBy),
      scriptureReference: blankToNull(d.scriptureReference),
      sermonTitle: blankToNull(d.sermonTitle),
      sermonPreacher: blankToNull(d.sermonPreacher),
      responsePrayerBy: blankToNull(d.responsePrayerBy),
      responseSong: blankToNull(d.responseSong),
      songs: d.songs.map(s => s.trim()).filter(s => s !== ''),
      announcements,
      sharingBlocks: sharingRequest(d.sharingBlocks),
    };
  }

  private publish(): void {
    const e = this.edition();
    if (!e) return;
    this.busy.set(true);
    // Publishing checks what the server has, so unsaved input goes first.
    this.saveIfDirty(false)
      .pipe(
        switchMap(() => this.service.publish(e.publicId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: published => {
          this.busy.set(false);
          this.apply(published);
          this.toast('success', 'bulletins.toast.published');
        },
        error: (err: unknown) => {
          this.busy.set(false);
          if (this.incompleteFields(err)) return;
          this.handleSaveError(err, 'bulletins.toast.publishFailed');
        },
      });
  }

  private withdraw(): void {
    const e = this.edition();
    if (!e) return;
    this.busy.set(true);
    this.service.withdraw(e.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: withdrawn => {
          this.busy.set(false);
          this.apply(withdrawn);
          this.toast('success', 'bulletins.toast.withdrawn');
        },
        error: () => {
          this.busy.set(false);
          this.toast('error', 'bulletins.toast.withdrawFailed');
        },
      });
  }

  /** PUTs the draft when it changed (or always, if [force]); emits once either way. */
  private saveIfDirty(force: boolean): Observable<unknown> {
    const e = this.edition();
    const req = this.buildRequest();
    if (!e || !req || (!force && !this.dirty())) return of(null);
    return new Observable(subscriber =>
      this.service.update(e.publicId, req).subscribe({
        next: saved => {
          this.apply(saved);
          subscriber.next(saved);
          subscriber.complete();
        },
        error: err => subscriber.error(err),
      }));
  }

  /** A 422 `BULLETIN_INCOMPLETE` marks the named fields; returns whether it was one. */
  private incompleteFields(err: unknown): boolean {
    if (!(err instanceof HttpErrorResponse) || err.status !== 422) return false;
    const body = err.error as { code?: string; fieldErrors?: Record<string, string> } | null;
    if (body?.code !== 'BULLETIN_INCOMPLETE') return false;
    const required: BulletinRequiredField[] = ['sermonTitle', 'sermonPreacher', 'songs'];
    this.missing.set(new Set(required.filter(f => body.fieldErrors?.[f] !== undefined)));
    this.toast('error', 'bulletins.toast.incomplete');
    return true;
  }

  /** A 409 on PUT means someone saved first: keep the input, offer a reload. */
  private handleSaveError(err: unknown, fallbackKey = 'bulletins.toast.saveFailed'): void {
    if (err instanceof HttpErrorResponse && err.status === 409 && !this.published()) {
      this.conflict.set(true);
      return;
    }
    this.toast('error', fallbackKey);
  }

  private apply(e: BulletinEdition): void {
    this.sharingResetVersion.update(v => v + 1);
    this.edition.set(e);
    this.draft.set(toDraft(e));
    this.dirty.set(false);
    this.conflict.set(false);
    this.missing.set(new Set());
    this.sharingValidationShown.set(false);
  }

  private validateSharing(): boolean {
    if (sharingIsValid(this.draft()?.sharingBlocks ?? [])) return true;
    this.sharingValidationShown.set(true);
    this.toast('error', 'bulletins.sharing.errors.invalid');
    return false;
  }

  private patch(change: (d: BulletinDraft) => BulletinDraft): void {
    const d = this.draft();
    if (!d || this.readOnly()) return;
    const next = change(d);
    if (next === d) return;
    this.draft.set(next);
    this.dirty.set(true);
  }

  private clearMissing(field: string): void {
    if (!this.missing().has(field as BulletinRequiredField)) return;
    const next = new Set(this.missing());
    next.delete(field as BulletinRequiredField);
    this.missing.set(next);
  }

  private toast(severity: 'success' | 'error', key: string): void {
    this.messages.add({ severity, summary: this.translate.instant(key) });
  }
}
