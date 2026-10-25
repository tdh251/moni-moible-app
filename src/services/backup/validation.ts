import type { Ledger, Snapshot } from '../../types/finance.ts';
import { parseAdjustments } from '../accounting/receipt.ts';
import {
  ensure,
  FinanceError,
  validDate,
  validateLedger,
} from '../accounting/ledger.ts';

export interface Backup {
  format: 'monomoney';
  version: 1 | 2 | 3 | 4;
  exported_at: string;
  data: Snapshot;
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
function text(v: unknown, max = 200): v is string {
  return typeof v === 'string' && v.length <= max;
}
function id(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(v) &&
    !['__proto__', 'constructor', 'prototype'].includes(v)
  );
}
function flag(v: unknown) {
  return v === 0 || v === 1;
}
function order(v: unknown) {
  return Number.isSafeInteger(v) && Number(v) >= 0;
}
function dates(v: Record<string, unknown>, keys: string[]) {
  return keys.every((k) => typeof v[k] === 'string' && validDate(v[k]));
}
function rows(v: unknown): Record<string, unknown>[] {
  ensure(
    Array.isArray(v) && v.length <= 100000 && v.every(object),
    'Danh sách trong bản sao lưu không hợp lệ hoặc quá lớn.',
  );
  const ids = new Set<string>();
  for (const row of v) {
    ensure(
      id(row.id) && !ids.has(row.id),
      'ID trong bản sao lưu trùng hoặc không hợp lệ.',
    );
    ids.add(row.id);
  }
  return v;
}
export function validateBackup(value: unknown): Backup {
  ensure(
    object(value) &&
      value.format === 'monomoney' &&
      (value.version === 1 ||
        value.version === 2 ||
        value.version === 3 ||
        value.version === 4) &&
      typeof value.exported_at === 'string' &&
      validDate(value.exported_at),
    'Không đúng định dạng bản sao lưu phiên bản 1, 2, 3 hoặc 4.',
  );
  const data = value.data;
  ensure(
    object(data) && typeof data.onboarded === 'boolean',
    'Thiếu trạng thái thiết lập.',
  );
  const accounts = rows(data.accounts),
    categories = rows(data.categories),
    transactions = rows(data.transactions),
    items = rows(data.items);
  for (const a of accounts)
    ensure(
      text(a.name, 100) &&
        ['cash', 'bank'].includes(String(a.type)) &&
        flag(a.is_archived) &&
        dates(a, ['created_at', 'updated_at']),
      'Tài khoản trong bản sao lưu không hợp lệ.',
    );
  ensure(
    accounts.filter((a) => a.type === 'cash').length ===
      (data.onboarded ? 1 : 0),
    'Bản sao lưu phải có đúng một tài khoản tiền mặt sau thiết lập.',
  );
  ensure(
    accounts.every((a) => a.type !== 'cash' || a.is_archived === 0),
    'Tiền mặt không được lưu trữ.',
  );
  ensure(
    data.onboarded ||
      (accounts.length === 0 &&
        transactions.length === 0 &&
        items.length === 0),
    'Dữ liệu chưa thiết lập không được có giao dịch.',
  );
  for (const c of categories)
    ensure(
      text(c.name, 100) &&
        String(c.name).trim().length > 0 &&
        ['income', 'expense'].includes(String(c.type)) &&
        text(c.icon, 100) &&
        typeof c.color === 'string' &&
        /^#[0-9a-fA-F]{6}$/.test(c.color) &&
        order(c.sort_order) &&
        flag(c.is_archived),
      'Danh mục trong bản sao lưu không hợp lệ.',
    );
  for (const t of transactions)
    ensure(
      text(t.title) &&
        text(t.note, 4000) &&
        (t.exclude_from_balance === undefined ||
          flag(t.exclude_from_balance)) &&
        (t.adjustments_json === undefined || text(t.adjustments_json, 20000)) &&
        (value.version !== 1 ||
          t.adjustments_json === undefined ||
          t.adjustments_json === '[]') &&
        [t.source_account_id, t.destination_account_id, t.category_id].every(
          (x) => x === null || id(x),
        ) &&
        dates(t, ['occurred_at', 'created_at', 'updated_at']),
      'Giao dịch trong bản sao lưu không hợp lệ.',
    );
  for (const i of items)
    ensure(
      text(i.name) &&
        id(i.transaction_id) &&
        id(i.category_id) &&
        order(i.sort_order),
      'Mục chi trong bản sao lưu không hợp lệ.',
    );
  if (value.version === 2)
    ensure(
      transactions.every((t) =>
        parseAdjustments(
          typeof t.adjustments_json === 'string'
            ? t.adjustments_json
            : undefined,
        ).every((a) => a.kind !== 'fixed'),
      ),
      'Bản sao lưu có điều chỉnh VND phải dùng phiên bản 3.',
    );
  if (value.version < 4)
    ensure(
      transactions.every((t) => t.exclude_from_balance !== 1),
      'Bản sao lưu có giao dịch không tính vào số dư phải dùng phiên bản 4.',
    );
  // Shape guards above plus the domain validator check money, references, types, totals and historical balances.
  const ledger = {
    accounts,
    categories,
    transactions,
    items,
  } as unknown as Ledger;
  validateLedger(ledger);
  return {
    format: 'monomoney',
    version: value.version,
    exported_at: value.exported_at,
    data: { ...ledger, onboarded: data.onboarded },
  };
}
export function parseBackup(raw: string): Backup {
  ensure(raw.length <= 20 * 1024 * 1024, 'Bản sao lưu vượt quá 20 MB.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new FinanceError('Tệp không phải JSON hợp lệ.');
  }
  return validateBackup(value);
}
