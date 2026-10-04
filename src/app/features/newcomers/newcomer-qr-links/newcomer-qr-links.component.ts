import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import QRCode from 'qrcode';
import { interval } from 'rxjs';

import {
  FORM_LINK_DEFAULT_HOURS,
  FORM_LINK_DURATIONS,
  FormLinkStatus,
  NewcomerFormLink,
  formLinkStatus,
  formLinkUrl,
} from '../../../core/models/newcomer-form-link.model';
import { RoleService } from '../../../core/services/role.service';
import { BadgeComponent } from '../../../core/ui/badge/badge.component';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SegmentedControlComponent } from '../../../core/ui/segmented-control/segmented-control.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { BadgeVariant } from '../../../core/ui/variant-tokens';
import { NewcomerFormLinkService } from '../newcomer-form-link.service';

/** The zone every 만료 time is shown in, whatever the browser says (#44). */
export const FORM_LINK_TIME_ZONE = 'Europe/Berlin';

const HOUR_MS = 3_600_000;

/**
 * `expiresAt` for a 유효 기간 of `hours`. 24 h is pulled in by a minute so a client
 * clock slightly ahead of the server's does not run into the server's 24 h cap.
 */
export function expiresAtFor(hours: number, now: number): string {
  const ms = Math.min(hours * HOUR_MS, 24 * HOUR_MS - 60_000);
  return new Date(now + ms).toISOString();
}

/** Whole hours and minutes until `expiresAt`, never negative. */
export function remaining(expiresAt: string, now: number): { hours: number; minutes: number } {
  const minutes = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 60_000));
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

const STATUS_BADGE: Record<FormLinkStatus, BadgeVariant> = {
  active: 'active',
  expired: 'inactive',
  revoked: 'deleted',
};

interface LinkRow {
  readonly link: NewcomerFormLink;
  readonly status: FormLinkStatus;
  readonly badge: BadgeVariant;
  readonly statusLabel: string;
  readonly expires: string;
  readonly remaining: string | null;
}

/**
 * QR 등록 링크 (#44). The 새가족팀 makes a short-lived link for the reception
 * that any number of newcomers may use until it expires or is revoked. The QR
 * code holds nothing but the public form URL (#42) with the random token.
 *
 * The server hands out the token once, in the create response, and keeps only a
 * hash — so the QR code exists only in the result dialog. Closing it drops the
 * token; the list never shows it again. No form submissions are shown here.
 * Creating and revoking need `canWrite('newcomers')`.
 */
@Component({
  selector: 'app-newcomer-qr-links',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    ToastModule,
    PageHeaderComponent,
    BadgeComponent,
    EmptyStateComponent,
    SegmentedControlComponent,
    SkeletonComponent,
  ],
  providers: [ConfirmationService, MessageService],
  host: { class: 'flex flex-col' },
  templateUrl: './newcomer-qr-links.component.html',
})
export class NewcomerQrLinksComponent implements OnInit {
  private readonly linkService = inject(NewcomerFormLinkService);
  private readonly roles = inject(RoleService);
  private readonly breakpoints = inject(BreakpointService);
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  readonly isPhone = this.breakpoints.isPhone;
  readonly canWrite = computed(() => this.roles.canWrite('newcomers'));

  readonly links = signal<readonly NewcomerFormLink[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly revoking = signal<string | null>(null);

  /** Ticks every minute so 남은 시간 stays current. */
  readonly now = signal(Date.now());

  readonly createOpen = signal(false);
  readonly hours = signal(String(FORM_LINK_DEFAULT_HOURS));
  readonly creating = signal(false);
  readonly createFailed = signal(false);
  /** The link just created, with its token; null once the dialog closes. */
  readonly created = signal<NewcomerFormLink | null>(null);
  readonly qrDataUrl = signal<string | null>(null);

  readonly durationOptions = computed(() => {
    this.translate.currentLang();
    return FORM_LINK_DURATIONS.map(h => ({
      value: String(h),
      label: this.translate.instant('newcomers.qrLinks.create.hours', { hours: h }) as string,
    }));
  });

  readonly createdUrl = computed(() => {
    const token = this.created()?.token;
    return token ? formLinkUrl(this.document.location.origin, token) : null;
  });

  readonly createdExpires = computed(() => {
    const link = this.created();
    return link ? this.formatExpiry(link.expiresAt) : '';
  });

  readonly rows = computed<readonly LinkRow[]>(() => {
    this.translate.currentLang();
    const now = this.now();
    return this.links().map(link => {
      const status = formLinkStatus(link);
      const left = remaining(link.expiresAt, now);
      return {
        link,
        status,
        badge: STATUS_BADGE[status],
        statusLabel: this.translate.instant(`newcomers.qrLinks.status.${status}`) as string,
        expires: this.formatExpiry(link.expiresAt),
        remaining:
          status === 'active'
            ? (this.translate.instant('newcomers.qrLinks.remaining', left) as string)
            : null,
      };
    });
  });

  readonly activeCount = computed(() => this.rows().filter(r => r.status === 'active').length);

  ngOnInit(): void {
    this.load();
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.linkService
      .getLinks()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: links => {
          this.links.set(links);
          this.now.set(Date.now());
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  openCreate(): void {
    this.hours.set(String(FORM_LINK_DEFAULT_HOURS));
    this.created.set(null);
    this.qrDataUrl.set(null);
    this.createFailed.set(false);
    this.createOpen.set(true);
  }

  /** Closing the dialog drops the token for good — the server never returns it again. */
  onCreateVisibleChange(visible: boolean): void {
    this.createOpen.set(visible);
    if (!visible) {
      this.created.set(null);
      this.qrDataUrl.set(null);
    }
  }

  create(): void {
    if (this.creating()) return;
    this.creating.set(true);
    this.createFailed.set(false);
    this.linkService
      .createLink({ expiresAt: expiresAtFor(Number(this.hours()), Date.now()) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: link => {
          this.creating.set(false);
          this.created.set(link);
          this.links.update(list => [{ ...link, token: null }, ...list]);
          this.now.set(Date.now());
          void this.renderQr();
        },
        error: () => {
          this.creating.set(false);
          this.createFailed.set(true);
        },
      });
  }

  async copyUrl(): Promise<void> {
    const url = this.createdUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.toast('success', 'copied');
    } catch {
      this.toast('error', 'copyFailed');
    }
  }

  downloadQr(): void {
    const dataUrl = this.qrDataUrl();
    if (!dataUrl) return;
    const a = this.document.createElement('a');
    a.href = dataUrl;
    a.download = `hanmaum-newcomer-qr-${this.created()?.expiresAt.slice(0, 10) ?? 'link'}.png`;
    a.click();
  }

  /** Prints the QR code alone, with its 만료 time, from a window of its own. */
  printQr(): void {
    const dataUrl = this.qrDataUrl();
    const win = this.document.defaultView?.open('', '_blank', 'width=480,height=640');
    if (!dataUrl || !win) return;
    const title = this.translate.instant('newcomers.qrLinks.print.title') as string;
    const expires = this.translate.instant('newcomers.qrLinks.print.expires', { time: this.createdExpires() }) as string;
    const doc = win.document;
    doc.title = title;
    const style = doc.createElement('style');
    style.textContent =
      'body{font-family:sans-serif;text-align:center;margin:48px}img{width:320px;height:320px}h1{font-size:24px}';
    doc.head.appendChild(style);
    const heading = doc.createElement('h1');
    heading.textContent = title;
    const img = doc.createElement('img');
    img.src = dataUrl;
    img.alt = title;
    const note = doc.createElement('p');
    note.textContent = expires;
    doc.body.append(heading, img, note);
    img.onload = () => {
      win.focus();
      win.print();
    };
  }

  confirmRevoke(link: NewcomerFormLink): void {
    const t = (key: string, params?: object) =>
      this.translate.instant(`newcomers.qrLinks.revoke.${key}`, params) as string;
    this.confirmService.confirm({
      header: t('header'),
      message: t('message', { time: this.formatExpiry(link.expiresAt) }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: t('accept'),
      rejectLabel: t('cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => this.revoke(link),
    });
  }

  goToList(): void {
    void this.router.navigate(['/newcomers']);
  }

  private revoke(link: NewcomerFormLink): void {
    this.revoking.set(link.publicId);
    this.linkService
      .revokeLink(link.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.revoking.set(null);
          this.links.update(list =>
            list.map(l => (l.publicId === updated.publicId ? { ...updated, token: null } : l)),
          );
          this.toast('success', 'revoked');
        },
        error: () => {
          this.revoking.set(null);
          this.toast('error', 'revokeFailed');
        },
      });
  }

  private async renderQr(): Promise<void> {
    const url = this.createdUrl();
    if (!url) return;
    try {
      this.qrDataUrl.set(await QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: 'M' }));
    } catch {
      this.qrDataUrl.set(null);
      this.toast('error', 'qrFailed');
    }
  }

  private formatExpiry(iso: string): string {
    const lang = this.translate.currentLang() ?? 'ko';
    const time = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ko-KR', {
      timeZone: FORM_LINK_TIME_ZONE,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
    return `${time} (${this.translate.instant('newcomers.qrLinks.timeZone')})`;
  }

  private toast(severity: 'success' | 'error', key: string): void {
    this.messages.add({
      severity,
      summary: this.translate.instant(`newcomers.qrLinks.toast.${key}`) as string,
    });
  }
}
