import { transactionCategoryTags } from '../categories/tags.ts';
import type { Category, TransactionDraft } from '../../types/finance.ts';
import { safeAdd } from './money.ts';
import { calculateReceipt, parseAdjustments } from './receipt.ts';

export function resolveTransactionTitle(
  draft: TransactionDraft,
  categories: Category[],
): string {
  if (draft.title.trim()) return draft.title.trim();
  if (draft.type === 'transfer') return 'Chuyển nội bộ';
  const tags = transactionCategoryTags(draft);
  if (tags.length)
    return (
      categories.find((c) => c.id === tags[0] && c.type === draft.type)?.name ??
      ''
    );
  let categoryId = draft.category_id;
  if (draft.items.length) {
    const receipt = calculateReceipt(
      draft.items,
      parseAdjustments(draft.adjustments_json),
    );
    const totals = new Map<string, number>();
    draft.items.forEach((item, index) =>
      totals.set(
        item.category_id,
        safeAdd(totals.get(item.category_id) ?? 0, receipt.itemAmounts[index]),
      ),
    );
    // Ties use the first category encountered in receipt order.
    categoryId = [...totals].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  return (
    categories.find((c) => c.id === categoryId && c.type === draft.type)
      ?.name ?? ''
  );
}
