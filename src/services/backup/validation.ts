import { singleCategoryLedger } from '../categories/single.ts';
import { parseLoanCosts } from '../loans.ts';
import { transactionTagIds } from '../tags.ts';
import { transactionCategoryTags } from '../categories/tags.ts';
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
  version:
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18;
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
        value.version === 4 ||
        value.version === 5 ||
        value.version === 6 ||
        value.version === 7 ||
        value.version === 8 ||
        value.version === 9 ||
        value.version === 10 ||
        value.version === 11 ||
        value.version === 12 ||
        value.version === 13 ||
        value.version === 14 ||
        value.version === 15 ||
        value.version === 16 ||
        value.version === 17 ||
        value.version === 18) &&
      typeof value.exported_at === 'string' &&
      validDate(value.exported_at),
    'Không đúng định dạng bản sao lưu phiên bản 1 đến 18.',
  );
  const backupVersion = value.version;
  const data = value.data;
  ensure(
    object(data) && typeof data.onboarded === 'boolean',
    'Thiếu trạng thái thiết lập.',
  );
  const accounts = rows(data.accounts),
    categories = rows(data.categories),
    transactions = rows(data.transactions),
    items = rows(data.items);
  const tags = rows(data.tags ?? []);
  const loans = rows(data.loans ?? []);
  const loanPayments = rows(data.loanPayments ?? []);
  for (const payment of loanPayments) {
    ensure(
      payment.fee_amount === undefined ||
        (Number.isSafeInteger(payment.fee_amount) &&
          Number(payment.fee_amount) >= 0),
      'Phụ phí trả nợ phải là số nguyên VND từ 0 trở lên.',
    );
    ensure(
      backupVersion >= 12 || !payment.fee_amount,
      'Bản sao lưu có phụ phí trả nợ phải dùng phiên bản 12.',
    );
  }
  for (const loan of loans) {
    ensure(
      backupVersion >= 18 ||
        loan.payment_day === undefined ||
        loan.payment_day === null,
      'Bản sao lưu có ngày nhắc hằng tháng phải dùng phiên bản 18.',
    );
    ensure(
      backupVersion >= 17 ||
        loan.direction === undefined ||
        loan.direction === 'borrow',
      'Bản sao lưu có cho vay phải dùng phiên bản 17.',
    );
    ensure(
      loan.exclude_from_balance === undefined ||
        flag(loan.exclude_from_balance),
      'Trạng thái không cộng tiền vay không hợp lệ.',
    );
    ensure(
      backupVersion >= 11 || loan.exclude_from_balance !== 1,
      'Bản sao lưu có khoản vay không cộng tiền phải dùng phiên bản 11.',
    );
  }
  for (const loan of loans)
    ensure(
      backupVersion >= 10 ||
        ((loan.due_at === undefined || loan.due_at === null) &&
          parseLoanCosts(
            loan as unknown as import('../../types/finance.ts').Loan,
          ).length === 0),
      'Bản sao lưu có kỳ hạn hoặc chi phí vay phải dùng phiên bản 10.',
    );
  ensure(
    backupVersion >= 9 || (loans.length === 0 && loanPayments.length === 0),
    'Bản sao lưu có vay phải dùng phiên bản 9.',
  );
  ensure(
    backupVersion >= 8 || tags.length === 0,
    'Bản sao lưu có tag phải dùng phiên bản 8.',
  );
  for (const tag of tags)
    ensure(
      text(tag.name, 50) &&
        typeof tag.color === 'string' &&
        /^#[0-9a-fA-F]{6}$/.test(tag.color) &&
        flag(tag.is_archived),
      'Tag trong bản sao lưu không hợp lệ.',
    );
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
        flag(c.is_archived) &&
        (c.parent_id === undefined ||
          c.parent_id === null ||
          id(c.parent_id)) &&
        (value.version >= 5 || c.parent_id == null),
      'Danh mục trong bản sao lưu không hợp lệ.',
    );
  for (const t of transactions)
    ensure(
      text(t.title) &&
        (t.tag_ids_json === undefined || text(t.tag_ids_json, 20000)) &&
        (t.category_ids_json === undefined ||
          text(t.category_ids_json, 1000000)) &&
        (t.category_split === undefined || flag(t.category_split)) &&
        (value.version >= 6 || t.category_split !== 1) &&
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
      backupVersion >= 14 ||
        transactionTagIds(
          i as unknown as import('../../types/finance.ts').TransactionItem,
        ).length === 0,
      'Bản sao lưu có tag mục chi phải dùng phiên bản 14.',
    );
  for (const i of items)
    ensure(
      backupVersion >= 15 ||
        transactionCategoryTags(
          i as unknown as import('../../types/finance.ts').TransactionItem,
        ).length === 0,
      'Bản sao lưu có nhiều danh mục cho mục chi phải dùng phiên bản 15.',
    );
  for (const i of items)
    ensure(
      text(i.name) &&
        (i.category_ids_json === undefined ||
          text(i.category_ids_json, 1000000)) &&
        (i.tag_ids_json === undefined || text(i.tag_ids_json, 20000)) &&
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
  const receiptIds = new Set(items.map((item) => item.transaction_id));
  for (const t of transactions) {
    ensure(
      backupVersion >= 13 ||
        t.category_split === 1 ||
        !receiptIds.has(t.id) ||
        transactionCategoryTags(
          t as unknown as import('../../types/finance.ts').Transaction,
        ).length === 0,
      'Bản sao lưu có danh mục chung cho hóa đơn phải dùng phiên bản 13.',
    );
    const tagIds = transactionTagIds(
      t as unknown as import('../../types/finance.ts').Transaction,
    );
    ensure(
      backupVersion >= 8 || tagIds.length === 0,
      'Bản sao lưu có tag phải dùng phiên bản 8.',
    );
    const tags = transactionCategoryTags(
      t as unknown as import('../../types/finance.ts').Transaction,
    );
    ensure(
      value.version >= 7 || tags.length === 0,
      'Bản sao lưu có nhãn danh mục phải dùng phiên bản 7.',
    );
  }
  const legacyItems = new Map<unknown, Record<string, unknown>[]>();
  if (backupVersion < 7)
    for (const item of items) {
      const group = legacyItems.get(item.transaction_id);
      if (group) group.push(item);
      else legacyItems.set(item.transaction_id, [item]);
    }
  // Shape guards above plus the domain validator check money, references, types, totals and historical balances.
  const ledger = {
    accounts,
    loans: loans.map((loan) => ({
      ...loan,
      direction: loan.direction === undefined ? 'borrow' : loan.direction,
      payment_day: loan.payment_day === undefined ? null : loan.payment_day,
      due_at: loan.due_at ?? null,
      costs_json: loan.costs_json ?? '[]',
      exclude_from_balance: loan.exclude_from_balance ?? 0,
    })),
    loanPayments: loanPayments.map((payment) => ({
      ...payment,
      fee_amount: payment.fee_amount ?? 0,
    })),
    tags,
    categories: categories.map((c) => ({
      ...c,
      parent_id: c.parent_id ?? null,
    })),
    transactions: transactions.map((t) => ({
      ...t,
      tag_ids_json: t.tag_ids_json ?? '[]',
      category_ids_json:
        backupVersion < 7 && t.category_split === 1
          ? JSON.stringify(
              (legacyItems.get(t.id) ?? [])
                .sort(
                  (a, b) =>
                    Number(a.sort_order) - Number(b.sort_order) ||
                    String(a.id).localeCompare(String(b.id)),
                )
                .map((i) => i.category_id),
            )
          : (t.category_ids_json ?? '[]'),
    })),
    items: items.map((item) => ({
      ...item,
      tag_ids_json: item.tag_ids_json ?? '[]',
      category_ids_json: item.category_ids_json ?? '[]',
    })),
  } as unknown as Ledger;
  validateLedger(ledger);
  if (backupVersion >= 16) {
    ensure(
      ledger.transactions.every(
        (t) =>
          t.category_split !== 1 &&
          transactionCategoryTags(t).length <= (t.category_id ? 1 : 0),
      ) &&
        ledger.items.every((item) => transactionCategoryTags(item).length <= 1),
      'Mỗi giao dịch và mục chi chỉ có một danh mục; danh mục chỉ có một cấp.',
    );
  }
  const normalized = singleCategoryLedger(ledger);
  validateLedger(normalized);
  return {
    format: 'monomoney',
    version: 18,
    exported_at: value.exported_at,
    data: {
      ...normalized,
      onboarded: data.onboarded,
    },
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
