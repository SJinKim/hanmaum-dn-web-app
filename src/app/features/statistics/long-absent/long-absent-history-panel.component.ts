import { Component, computed, inject, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { ButtonModule } from "primeng/button";
import { DrawerModule } from "primeng/drawer";
import {
  LongAbsenceChange,
  LongAbsencePhase,
  LongAbsencePhaseMeta,
} from "../../../core/models/long-absent.model";
import { BreakpointService } from "../../../core/ui/breakpoint.service";
import { EmptyStateComponent } from "../../../core/ui/empty-state/empty-state.component";
import { SkeletonComponent } from "../../../core/ui/skeleton/skeleton.component";
import {
  actorName,
  displayName,
  formatDay,
  formatInstant,
} from "./long-absent-format";
import { LongAbsentPhaseState } from "./long-absent-phase-state.service";

/**
 * 이력 panel (#279 AK 3, 4) — Figma Desktop 1991:184602 / 1991:184623 (side panel
 * on the right), Phone 1992:185670 / 1992:185691 (full screen). Shows one phase:
 * period, how it ended, the current memo and the paged contact and memo changes.
 * A memo the server no longer has is simply empty (비어 있음), never "deleted".
 */
@Component({
  selector: "app-long-absent-history-panel",
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    DrawerModule,
    EmptyStateComponent,
    SkeletonComponent,
  ],
  template: `
    <p-drawer
      [visible]="state.isOpen()"
      (visibleChange)="$event || dismiss.emit()"
      position="right"
      [fullScreen]="breakpoint.isPhone()"
      [modal]="true"
      [blockScroll]="true"
      [style]="breakpoint.isPhone() ? {} : { width: 'min(100vw, 480px)' }"
      [ariaCloseLabel]="'statistics.longAbsent.panel.close' | translate"
    >
      <ng-template #header>
        <span class="flex min-w-px flex-col gap-[var(--space-2)]">
          <h2
            class="type-h3 text-ink-strong break-words"
            data-testid="panel-title"
          >
            {{
              "statistics.longAbsent.panel.title" | translate: { name: title() }
            }}
          </h2>
        </span>
      </ng-template>

      <div
        class="flex flex-col gap-[var(--space-16)]"
        [attr.aria-busy]="loading()"
        data-testid="history-panel"
      >
        @if (loading()) {
          <div
            class="flex flex-col gap-[var(--space-12)]"
            data-testid="panel-loading"
          >
            @for (line of [0, 1, 2]; track line) {
              <app-skeleton variant="line" />
            }
          </div>
        } @else if (isEmpty()) {
          <app-empty-state
            variant="no-data"
            data-testid="panel-empty"
            [heading]="'statistics.longAbsent.panel.emptyHeading' | translate"
            [description]="'statistics.longAbsent.panel.emptyText' | translate"
          />
        } @else {
          @if (state.target()?.phasePublicId) {
            @switch (state.status()) {
              @case ("error") {
                <app-empty-state
                  variant="error"
                  data-testid="panel-error"
                  [heading]="'statistics.longAbsent.panel.error' | translate"
                  [actionLabel]="
                    'statistics.longAbsent.states.retry' | translate
                  "
                  actionIcon="pi pi-refresh"
                  (action)="state.retry()"
                />
              }
              @case ("ready") {
                @if (phase(); as p) {
                  <section
                    class="border-line-subtle flex flex-col gap-[var(--space-8)] rounded-[var(--radius-md)] border p-[var(--space-12)]"
                    data-testid="panel-current"
                  >
                    <h3 class="type-body-sm text-ink-strong font-semibold">
                      {{ "statistics.longAbsent.panel.current" | translate }} ·
                      {{ day(p.absentSince) }} ·
                      {{
                        "statistics.longAbsent.panel.monthsSince"
                          | translate: { count: monthsSince(p) }
                      }}
                    </h3>
                    <p
                      class="type-body-sm text-ink"
                      data-testid="panel-contact"
                    >
                      {{ contactLine(p) }}
                    </p>
                    @if (p.memo) {
                      <p
                        class="type-body-sm text-ink whitespace-pre-line break-words"
                        data-testid="panel-memo"
                      >
                        {{ p.memo }}
                      </p>
                    } @else {
                      <p
                        class="type-body-sm text-ink-disabled"
                        data-testid="panel-memo-empty"
                      >
                        {{ "statistics.longAbsent.panel.empty" | translate }}
                      </p>
                    }
                    <ol class="flex flex-col" data-testid="panel-changes">
                      @for (change of state.changes(); track change.publicId) {
                        <li
                          class="border-line-subtle flex flex-col gap-[var(--space-4)] border-t py-[var(--space-8)]"
                          data-testid="panel-change"
                        >
                          <span class="type-caption text-ink-muted">{{
                            changeMeta(change)
                          }}</span>
                          <span
                            class="type-body-sm text-ink-strong font-semibold"
                            >{{ changeLabel(change) }}</span
                          >
                          @if (change.kind === "MEMO_CHANGED") {
                            @if (change.memo) {
                              <span
                                class="type-body-sm text-ink whitespace-pre-line break-words"
                                >{{ change.memo }}</span
                              >
                            } @else {
                              <span class="type-body-sm text-ink-disabled">{{
                                "statistics.longAbsent.panel.empty" | translate
                              }}</span>
                            }
                          }
                        </li>
                      }
                    </ol>
                    @switch (state.changesStatus()) {
                      @case ("loading") {
                        <app-skeleton
                          variant="line"
                          data-testid="panel-changes-loading"
                        />
                      }
                      @case ("error") {
                        <div
                          class="flex flex-wrap items-center justify-between gap-[var(--space-8)]"
                          role="alert"
                          data-testid="panel-changes-error"
                        >
                          <span class="type-body-sm text-ink">{{
                            "statistics.longAbsent.panel.changesError"
                              | translate
                          }}</span>
                          <p-button
                            size="small"
                            severity="secondary"
                            [outlined]="true"
                            icon="pi pi-refresh"
                            [label]="
                              'statistics.longAbsent.states.retry' | translate
                            "
                            (onClick)="state.retryChanges()"
                          />
                        </div>
                      }
                      @default {
                        @if (state.hasMoreChanges()) {
                          <p-button
                            size="small"
                            severity="secondary"
                            [text]="true"
                            [label]="
                              'statistics.longAbsent.panel.more' | translate
                            "
                            data-testid="panel-more"
                            (onClick)="state.loadMoreChanges()"
                          />
                        }
                      }
                    }
                  </section>
                }
              }
            }
          }

          @for (item of state.closed(); track item.phasePublicId) {
            <section
              class="border-line-subtle flex flex-col gap-[var(--space-4)] rounded-[var(--radius-md)] border p-[var(--space-12)]"
              data-testid="panel-closed"
            >
              <h3 class="type-body-sm text-ink-strong font-semibold">
                {{ "statistics.longAbsent.panel.endedPeriod" | translate }} ·
                {{ day(item.absentSince) }} – {{ day(item.endedOn) }}
              </h3>
              <p class="type-body-sm text-ink" data-testid="panel-end">
                {{ "statistics.longAbsent.panel.endReason" | translate }} ·
                {{ endLine(item) }}
                @if (item.returnedAt) {
                  · {{ actor(item.returnedByMember, item.returnedBy) }} ·
                  {{ instant(item.returnedAt) }}
                }
              </p>
              <p class="type-body-sm text-ink" data-testid="panel-contact">
                {{ contactLine(item) }}
              </p>
              @let memo = state.memos()[item.phasePublicId];
              @switch (memo?.status) {
                @case ("ready") {
                  @if (memo?.memo) {
                    <p
                      class="type-body-sm text-ink whitespace-pre-line break-words"
                      data-testid="panel-memo"
                    >
                      {{ "statistics.longAbsent.panel.memo" | translate }}:
                      {{ memo?.memo }}
                    </p>
                  } @else {
                    <p
                      class="type-body-sm text-ink-disabled"
                      data-testid="panel-memo-empty"
                    >
                      {{ "statistics.longAbsent.panel.memo" | translate }}:
                      {{ "statistics.longAbsent.panel.empty" | translate }}
                    </p>
                  }
                }
                @case ("error") {
                  <div
                    class="flex flex-wrap items-center justify-between gap-[var(--space-8)]"
                    role="alert"
                    data-testid="panel-memo-error"
                  >
                    <span class="type-body-sm text-ink">{{
                      "statistics.longAbsent.panel.memoError" | translate
                    }}</span>
                    <p-button
                      size="small"
                      severity="secondary"
                      [text]="true"
                      [label]="'statistics.longAbsent.states.retry' | translate"
                      (onClick)="state.retryMemo(item.phasePublicId)"
                    />
                  </div>
                }
                @default {
                  <app-skeleton
                    variant="line"
                    data-testid="panel-memo-loading"
                  />
                }
              }
            </section>
          }
          @if (state.closedStatus() === "error") {
            <div
              class="flex flex-wrap items-center justify-between gap-[var(--space-8)]"
              role="alert"
              data-testid="panel-closed-error"
            >
              <span class="type-body-sm text-ink">{{
                "statistics.longAbsent.panel.closedError" | translate
              }}</span>
              <p-button
                size="small"
                severity="secondary"
                [outlined]="true"
                icon="pi pi-refresh"
                [label]="'statistics.longAbsent.states.retry' | translate"
                (onClick)="state.retryClosed()"
              />
            </div>
          } @else if (state.closedStatus() === "loading") {
            <app-skeleton variant="line" data-testid="panel-closed-loading" />
          } @else if (state.hasMoreClosed()) {
            <p-button
              size="small"
              severity="secondary"
              [text]="true"
              [label]="'statistics.longAbsent.panel.more' | translate"
              data-testid="panel-closed-more"
              (onClick)="state.loadMoreClosed()"
            />
          }
        }
      </div>
    </p-drawer>
  `,
})
export class LongAbsentHistoryPanelComponent {
  readonly state = inject(LongAbsentPhaseState);
  readonly breakpoint = inject(BreakpointService);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange);

  readonly dismiss = output<void>();

  readonly phase = computed(() => this.state.phase());
  readonly title = computed(() => {
    const phase = this.state.phase();
    return phase ? displayName(phase) : (this.state.target()?.fullName ?? "");
  });

  /** Nothing to show yet: the current phase or the closed list is still on its way. */
  readonly loading = computed(() => {
    const hasCurrent = !!this.state.target()?.phasePublicId;
    return (
      (hasCurrent && this.state.status() === "loading") ||
      (this.state.closedStatus() === "loading" && !this.state.closed().length)
    );
  });
  readonly isEmpty = computed(
    () =>
      !this.state.target()?.phasePublicId &&
      this.state.closedStatus() === "ready" &&
      !this.state.closed().length,
  );

  monthsSince(phase: LongAbsencePhase): number {
    const start = new Date(`${phase.absentSince}T00:00:00`);
    const now = new Date();
    return Math.max(
      1,
      (now.getFullYear() - start.getFullYear()) * 12 +
        now.getMonth() -
        start.getMonth(),
    );
  }

  endLine(phase: { endReason: string | null }): string {
    this.lang();
    if (!phase.endReason)
      return this.translate.instant("statistics.longAbsent.history.ongoing");
    return this.translate.instant(
      `statistics.longAbsent.history.endReason.${phase.endReason}`,
    );
  }

  contactLine(phase: LongAbsencePhaseMeta): string {
    this.lang();
    if (!phase.contacted)
      return this.translate.instant("statistics.longAbsent.notContacted");
    const who = this.actor(phase.contactedByMember, phase.contactedBy);
    const at = phase.contactedAt ? ` · ${this.instant(phase.contactedAt)}` : "";
    return `${this.translate.instant("statistics.longAbsent.contacted")} · ${who}${at}`;
  }

  changeLabel(change: LongAbsenceChange): string {
    this.lang();
    if (change.kind === "MEMO_CHANGED")
      return this.translate.instant("statistics.longAbsent.panel.change.memo");
    return this.translate.instant(
      change.contacted
        ? "statistics.longAbsent.panel.change.contacted"
        : "statistics.longAbsent.panel.change.notContacted",
    );
  }

  /** Who and when; a legacy snapshot with unknown values never looks like a fresh action. */
  changeMeta(change: LongAbsenceChange): string {
    this.lang();
    const who =
      actorName(change.actorMember, change.actorSubject) ??
      this.translate.instant("statistics.longAbsent.unknownActor");
    const when = change.occurredAt
      ? this.instant(change.occurredAt)
      : this.translate.instant("statistics.longAbsent.panel.unknownTime");
    return `${who} · ${when}`;
  }

  actor(member: { fullName: string } | null, subject: string | null): string {
    return (
      actorName(member, subject) ??
      this.translate.instant("statistics.longAbsent.unknownActor")
    );
  }

  instant(value: string): string {
    return formatInstant(value, this.locale());
  }

  day(value: string): string {
    return formatDay(value, this.locale());
  }

  private locale(): string {
    return this.translate.getCurrentLang() === "en" ? "en-US" : "ko-KR";
  }
}
