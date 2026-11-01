import type { TransactionDraft } from '../../types/finance.ts';

export function resolveTransactionTitle(
  draft: Pick<TransactionDraft, 'title'>,
): string {
  return draft.title.trim() || 'Trống';
}
