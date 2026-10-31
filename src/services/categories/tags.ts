import type { Transaction } from '../../types/finance.ts';
import { ensure, FinanceError } from '../accounting/money.ts';

export function transactionCategoryTags(
  transaction: Pick<Transaction, 'category_ids_json'>,
): string[] {
  const raw = transaction.category_ids_json;
  if (raw === undefined) return [];
  ensure(
    typeof raw === 'string' && raw.length <= 1000000,
    'Danh sách nhãn danh mục không hợp lệ.',
  );
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new FinanceError('Danh sách nhãn danh mục không phải JSON hợp lệ.');
  }
  ensure(
    Array.isArray(value) &&
      value.length <= 10000 &&
      value.every(
        (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id),
      ) &&
      new Set(value).size === value.length,
    'Danh sách nhãn danh mục bị trùng hoặc không hợp lệ.',
  );
  return value;
}
