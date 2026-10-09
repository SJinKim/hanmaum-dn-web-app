import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DragDropModule } from 'primeng/dragdrop';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { BadgeComponent } from '../../../core/ui/badge/badge.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { BULLETIN_LIMITS, BulletinSharingBlockType } from '../bulletins.model';
import { BulletinSharingDraftBlock, SharingError, numberedSharing, sharingErrors } from './bulletin-sharing.model';

/** Figma 1071:112948 / 1077:117782 — four typed blocks, one reorder handle. */
@Component({
  selector: 'app-bulletin-sharing-editor',
  standalone: true,
  imports: [TranslatePipe, ButtonModule, DragDropModule, InputTextModule, TextareaModule,
    BadgeComponent, EmptyStateComponent, SectionHeaderComponent],
  templateUrl: './bulletin-sharing-editor.component.html',
})
export class BulletinSharingEditorComponent {
  private readonly translate = inject(TranslateService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private nextId = 0;
  private draggedId: number | null = null;
  readonly blocks = input.required<readonly BulletinSharingDraftBlock[]>();
  readonly disabled = input(false);
  readonly showValidation = input(false);
  readonly resetVersion = input(0);
  readonly blocksChange = output<BulletinSharingDraftBlock[]>();
  readonly touched = signal<ReadonlySet<string>>(new Set());
  readonly announcement = signal('');
  readonly removed = signal<{ block: BulletinSharingDraftBlock; index: number } | null>(null);
  readonly rows = computed(() => numberedSharing(this.blocks()));
  readonly questionCount = computed(() => this.blocks().filter(b => b.type === 'QUESTION').length);
  readonly limits = BULLETIN_LIMITS;
  readonly types: readonly BulletinSharingBlockType[] = ['HEADING', 'PARAGRAPH', 'SCRIPTURE', 'QUESTION'];

  constructor() {
    effect(() => {
      this.resetVersion();
      this.touched.set(new Set());
      this.removed.set(null);
      this.announcement.set('');
      this.endDrag();
    });
  }

  add(type: BulletinSharingBlockType): void {
    if (this.disabled() || this.blocks().length >= this.limits.sharingBlocks) return;
    this.nextId = Math.max(this.nextId, ...this.blocks().map(b => b.editorId + 1));
    const editorId = this.nextId++;
    this.blocksChange.emit([...this.blocks(), { editorId, type, text: '', ...(type === 'SCRIPTURE' ? { reference: '' } : {}) }]);
    this.announce('added', { position: this.blocks().length });
    this.focusAfterRender(`#sharing-text-${editorId}`);
  }

  setField(id: number, field: 'text' | 'reference', value: string): void {
    if (this.disabled()) return;
    this.blocksChange.emit(this.blocks().map(b => b.editorId === id ? { ...b, [field]: value } : b));
  }

  remove(id: number): void {
    if (this.disabled()) return;
    const index = this.blocks().findIndex(b => b.editorId === id);
    if (index < 0) return;
    this.removed.set({ block: this.blocks()[index], index });
    const blocks = this.blocks().filter(b => b.editorId !== id);
    this.blocksChange.emit(blocks);
    this.announce('removed', { position: index + 1, count: blocks.length });
    const next = blocks[Math.min(index, blocks.length - 1)];
    this.focusAfterRender(next ? `[data-block-id="${next.editorId}"] [data-testid="sharing-handle"]` : '[data-add-type] button');
  }

  undoRemove(): void {
    const removed = this.removed();
    if (!removed || this.disabled() || this.blocks().length >= this.limits.sharingBlocks) return;
    const blocks = [...this.blocks()];
    blocks.splice(Math.min(removed.index, blocks.length), 0, removed.block);
    this.blocksChange.emit(blocks);
    this.removed.set(null);
    this.announce('restored', { position: blocks.findIndex(b => b.editorId === removed.block.editorId) + 1 });
    this.focusAfterRender(`#sharing-text-${removed.block.editorId}`);
  }

  moveBy(id: number, delta: number): void {
    this.move(id, this.blocks().findIndex(b => b.editorId === id) + delta);
  }

  touch(id: number, field: 'text' | 'reference'): void {
    this.touched.update(keys => new Set([...keys, `${id}-${field}`]));
  }

  error(block: BulletinSharingDraftBlock, field: 'text' | 'reference'): SharingError | undefined {
    return this.showValidation() || this.touched().has(`${block.editorId}-${field}`) ? sharingErrors(block)[field] : undefined;
  }

  startDrag(id: number): void {
    this.draggedId = this.disabled() ? null : id;
  }

  endDrag(): void { this.draggedId = null; }

  drop(targetId: number): void {
    const id = this.draggedId;
    this.endDrag();
    if (id !== null) this.move(id, this.blocks().findIndex(b => b.editorId === targetId));
  }

  reorderKey(event: KeyboardEvent, id: number): void {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || this.disabled()) return;
    event.preventDefault();
    const from = this.blocks().findIndex(b => b.editorId === id);
    const to = event.key === 'Home' ? 0 : event.key === 'End' ? this.blocks().length - 1
      : from + (event.key === 'ArrowUp' ? -1 : 1);
    this.move(id, to);
  }

  private move(id: number, to: number): void {
    const blocks = [...this.blocks()];
    const from = blocks.findIndex(b => b.editorId === id);
    if (this.disabled() || from < 0 || to < 0 || to >= blocks.length || from === to) return;
    const [block] = blocks.splice(from, 1);
    blocks.splice(to, 0, block);
    this.blocksChange.emit(blocks);
    this.announce('moved', { block: from + 1, position: to + 1, count: blocks.length });
    this.focusAfterRender(`[data-block-id="${id}"] [data-testid="sharing-handle"]`);
  }

  private announce(key: string, params: Record<string, number>): void {
    const version = this.resetVersion();
    this.announcement.set('');
    afterNextRender(() => {
      if (this.resetVersion() === version) this.announcement.set(this.translate.instant('bulletins.sharing.' + key, params));
    }, { injector: this.injector });
  }

  private focusAfterRender(selector: string): void {
    const version = this.resetVersion();
    afterNextRender(() => {
      if (this.resetVersion() === version) this.element.nativeElement.querySelector<HTMLElement>(selector)?.focus();
    }, { injector: this.injector });
  }
}
