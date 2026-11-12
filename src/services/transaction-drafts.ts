import type { Ledger } from '../types/finance.ts';
import type { SavedTransactionDraft } from '../types/transaction-draft.ts';
import { ensure, validDate } from './accounting/ledger.ts';
import { parseAdjustments } from './accounting/receipt.ts';
import { itemCategoryIds, transactionCategoryTags } from './categories/tags.ts';
import { transactionTagIds } from './tags.ts';

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;
const id = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9_-]{1,100}$/.test(value) &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const ids = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 1000 &&
  value.every(id) &&
  new Set(value).size === value.length;
const date = (value: unknown): value is string =>
  typeof value === 'string' && validDate(value);
const rows = (
  value: unknown,
  max: number,
): value is Record<string, unknown>[] =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every(object) &&
  value.every((row) => id(row.id)) &&
  new Set(value.map((row) => row.id)).size === value.length;

// Drafts may be incomplete or refer to archived/deleted choices. Only posting
// validates references, receipt totals and available balances.
export function validateTransactionDraft(
  value: unknown,
): SavedTransactionDraft {
  ensure(
    object(value) &&
      id(value.id) &&
      date(value.created_at) &&
      date(value.updated_at),
    'Thông tin bản nháp không hợp lệ.',
  );
  const v = value.values;
  ensure(
    object(v) &&
      ['income', 'expense', 'transfer'].includes(String(v.type)) &&
      text(v.title, 200) &&
      text(v.amount, 32) &&
      text(v.source, 100) &&
      text(v.destination, 100) &&
      date(v.occurred_at) &&
      typeof v.excludeFromBalance === 'boolean' &&
      ids(v.tagIds) &&
      text(v.note, 4000) &&
      (v.mode === 'categories' || v.mode === 'items'),
    'Nội dung bản nháp không hợp lệ.',
  );
  ensure(
    rows(v.allocations, 1000) &&
      v.allocations.every(
        (row) => text(row.category, 100) && text(row.amount, 32),
      ),
    'Danh mục trong bản nháp không hợp lệ.',
  );
  ensure(
    rows(v.adjustments, 20) &&
      v.adjustments.every(
        (row) =>
          text(row.name, 100) &&
          (row.mode === 'percent' || row.mode === 'fixed') &&
          text(row.percent, 32) &&
          text(row.amount, 32),
      ),
    'Điều chỉnh trong bản nháp không hợp lệ.',
  );
  ensure(
    rows(v.items, 100000) &&
      v.items.every(
        (row) =>
          text(row.name, 200) &&
          text(row.amount, 32) &&
          text(row.category, 100) &&
          ids(row.categoryIds) &&
          ids(row.tagIds),
      ),
    'Các mục hóa đơn trong bản nháp không hợp lệ.',
  );
  return value as unknown as SavedTransactionDraft;
}

export function duplicateTransactionDraft(
  ledger: Ledger,
  sourceId: string,
  draftId: string,
  now: string,
): SavedTransactionDraft {
  const source = ledger.transactions.find((row) => row.id === sourceId);
  ensure(source, 'Giao dịch không còn tồn tại.');
  ensure(id(draftId) && draftId.length <= 60, 'ID bản nháp không hợp lệ.');
  const items = ledger.items
    .filter((row) => row.transaction_id === sourceId)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const categories = transactionCategoryTags(source);
  const category = categories[0] ?? source.category_id;
  return validateTransactionDraft({
    id: draftId,
    created_at: now,
    updated_at: now,
    values: {
      type: source.type,
      title: source.title,
      amount: String(source.amount),
      source: source.source_account_id ?? '',
      destination: source.destination_account_id ?? '',
      occurred_at: source.occurred_at,
      excludeFromBalance: source.exclude_from_balance === 1,
      tagIds: transactionTagIds(source),
      note: source.note,
      mode:
        items.length && source.category_split !== 1 ? 'items' : 'categories',
      allocations: category
        ? [{ id: `${draftId}-category`, category, amount: '' }]
        : [],
      adjustments: parseAdjustments(source.adjustments_json).map(
        (row, index) => ({
          id: `${draftId}-adjustment-${index}`,
          name: row.name,
          mode: row.kind === 'fixed' ? 'fixed' : 'percent',
          percent: row.kind === 'fixed' ? '' : String(row.rate_bps / 100),
          amount: row.kind === 'fixed' ? String(row.amount_vnd) : '',
        }),
      ),
      items: items.map((row, index) => ({
        id: `${draftId}-item-${index}`,
        name: row.name,
        amount: String(row.amount),
        category: row.category_id,
        categoryIds: itemCategoryIds(row),
        tagIds: transactionTagIds(row),
      })),
    },
  });
}
