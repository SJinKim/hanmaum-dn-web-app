import { BULLETIN_LIMITS, BulletinSharingBlock } from '../bulletins.model';

/** Editor-only identity keeps focus and validation with a block when it moves. */
export interface BulletinSharingDraftBlock extends BulletinSharingBlock {
  editorId: number;
}

export type SharingError = 'required' | 'textTooLong' | 'referenceTooLong';

export function sharingErrors(block: BulletinSharingBlock): { text?: SharingError; reference?: SharingError } {
  return {
    text: !block.text.trim() ? 'required' : block.text.trim().length > BULLETIN_LIMITS.sharingText ? 'textTooLong' : undefined,
    reference: block.type === 'SCRIPTURE' && (block.reference?.trim().length ?? 0) > BULLETIN_LIMITS.sharingReference
      ? 'referenceTooLong' : undefined,
  };
}

export function sharingIsValid(blocks: readonly BulletinSharingBlock[]): boolean {
  return blocks.length <= BULLETIN_LIMITS.sharingBlocks && blocks.every(b => {
    const errors = sharingErrors(b);
    return !errors.text && !errors.reference;
  });
}

export function numberedSharing<T extends BulletinSharingBlock>(blocks: readonly T[]): { block: T; question: number | null }[] {
  let question = 0;
  return blocks.map(block => ({ block, question: block.type === 'QUESTION' ? ++question : null }));
}

/** PUT carries content only; editor IDs never leave the browser. */
export function sharingRequest(blocks: readonly BulletinSharingBlock[]): BulletinSharingBlock[] {
  return blocks.map(b => ({
    type: b.type,
    text: b.text.trim(),
    ...(b.type === 'SCRIPTURE' ? { reference: b.reference?.trim() || null } : {}),
  }));
}
