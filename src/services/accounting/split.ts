import type {
  Category,
  CategoryType,
  TransactionItem,
} from '../../types/finance.ts';
import { ensure, money, parseAmount, safeAdd } from './money.ts';

export interface CategoryAllocationDraft {
  id: string;
  category: string;
  amount: string;
}

export function splitEvenly(total: number, count: number): number[] {
  money(total);
  ensure(
    Number.isSafeInteger(count) && count >= 2,
    'Chọn ít nhất hai danh mục để chia đều.',
  );
  ensure(total >= count, 'Tổng tiền phải đủ để mỗi danh mục nhận ít nhất 1 ₫.');
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

export function parseCategoryAllocations(
  transactionId: string,
  type: CategoryType,
  total: string,
  drafts: CategoryAllocationDraft[],
  categories: Category[],
): TransactionItem[] {
  ensure(drafts.length >= 2, 'Chọn ít nhất hai danh mục.');
  ensure(
    new Set(drafts.map((d) => d.category)).size === drafts.length,
    'Mỗi danh mục chỉ được phân bổ một lần.',
  );
  const items = drafts.map((d, index) => {
    const category = categories.find(
      (c) => c.id === d.category && c.type === type && !c.is_archived,
    );
    ensure(
      category,
      'Danh mục không đúng loại hoặc đã lưu trữ. Hãy chọn lại danh mục.',
    );
    return {
      id: d.id,
      transaction_id: transactionId,
      name: category.name,
      amount: parseAmount(d.amount),
      category_id: category.id,
      sort_order: index,
    };
  });
  ensure(
    items.reduce((sum, item) => safeAdd(sum, item.amount), 0) ===
      parseAmount(total),
    'Tổng tiền các danh mục phải bằng số tiền giao dịch.',
  );
  return items;
}

// Categories are overlapping labels for the whole transaction, never allocations.
export function prepareTransactionCategories(
  transactionId: string,
  type: CategoryType,
  total: string,
  drafts: CategoryAllocationDraft[],
  categories: Category[],
) {
  ensure(transactionId.length > 0, 'Thiếu ID giao dịch.');
  ensure(drafts.length > 0, 'Chọn ít nhất một danh mục.');
  ensure(
    new Set(drafts.map((d) => d.category)).size === drafts.length,
    'Danh mục bị trùng.',
  );
  for (const draft of drafts)
    ensure(
      categories.some(
        (c) => c.id === draft.category && c.type === type && !c.is_archived,
      ),
      'Danh mục không đúng loại hoặc đã lưu trữ. Hãy chọn lại danh mục.',
    );
  parseAmount(total);
  return {
    category_split: 0 as const,
    category_id: drafts[0].category,
    category_ids_json: JSON.stringify(drafts.map((d) => d.category)),
    items: [] as TransactionItem[],
  };
}
