import type { Ledger, Transaction } from '../types/finance.ts';
import type {
  ThirdPartyCase,
  ThirdPartyEntry,
  ThirdPartyEntryInput,
  ThirdPartyEntryKind,
  ThirdPartyFinancialStatus,
  ThirdPartySettlement,
  ThirdPartySettlementRequest,
  ThirdPartyStatus,
} from '../types/third-party.ts';
import { ensure, FinanceError, money, safeAdd } from './accounting/money.ts';
import { transactionTagIds } from './tags.ts';

export const thirdPartyStatusLabels: Record<ThirdPartyStatus, string> = {
  pending: 'Mới tạo',
  in_progress: 'Đang thực hiện',
  fulfilled: 'Đã thực hiện',
  completed: 'Đã hoàn tất',
  cancelled: 'Đã hủy',
};
export const thirdPartyFinancialLabels: Record<
  ThirdPartyFinancialStatus,
  string
> = {
  holding: 'Đang giữ hộ',
  receivable: 'Cần thu lại',
  balanced: 'Đã cân bằng',
};
export const thirdPartyEntryLabels: Record<ThirdPartyEntryKind, string> = {
  receive: 'Nhận tiền trước',
  payment: 'Thanh toán hộ',
  refund: 'Trả lại tiền thừa',
  reimbursement: 'Nhận lại tiền ứng',
  payment_refund: 'Nhà bán hoàn tiền',
  settlement_income: 'Giữ lại tiền thừa',
  settlement_expense: 'Tự chịu tiền thiếu',
};
const effects: Record<ThirdPartyEntryKind, number> = {
  receive: 1,
  payment: -1,
  refund: -1,
  reimbursement: 1,
  payment_refund: 1,
  settlement_income: -1,
  settlement_expense: 1,
};
export function isThirdPartyPersonal(kind: ThirdPartyEntryKind) {
  return kind === 'settlement_income' || kind === 'settlement_expense';
}
export const validThirdPartyId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9_-]{1,100}$/.test(value) &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const validDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const text = (value: unknown, max: number, required = false): value is string =>
  typeof value === 'string' &&
  value.length <= max &&
  (!required || value.trim().length > 0);

export function thirdPartyEntryOrder(a: ThirdPartyEntry, b: ThirdPartyEntry) {
  return (
    a.occurred_at.localeCompare(b.occurred_at) ||
    a.created_at.localeCompare(b.created_at) ||
    a.sequence - b.sequence ||
    a.id.localeCompare(b.id)
  );
}
export function thirdPartyBalance(entries: readonly ThirdPartyEntry[]) {
  const totals: Record<ThirdPartyEntryKind, number> = {
    receive: 0,
    payment: 0,
    refund: 0,
    reimbursement: 0,
    payment_refund: 0,
    settlement_income: 0,
    settlement_expense: 0,
  };
  let difference = 0;
  let cashFlowImpact = 0;
  for (const entry of entries) {
    totals[entry.kind] = safeAdd(totals[entry.kind], entry.amount);
    difference = safeAdd(difference, effects[entry.kind] * entry.amount);
    if (!isThirdPartyPersonal(entry.kind))
      cashFlowImpact = safeAdd(
        cashFlowImpact,
        effects[entry.kind] * entry.amount,
      );
  }
  const personalIncome = totals.settlement_income;
  const personalExpense = totals.settlement_expense;
  ensure(
    cashFlowImpact ===
      safeAdd(safeAdd(difference, personalIncome), -personalExpense),
    'Chênh lệch thu chi hộ không nhất quán.',
  );
  return {
    ...totals,
    difference,
    cashFlowImpact,
    personalIncome,
    personalExpense,
    holdingAmount: Math.max(difference, 0),
    receivableAmount: Math.max(-difference, 0),
    financialStatus: (difference > 0
      ? 'holding'
      : difference < 0
        ? 'receivable'
        : 'balanced') as ThirdPartyFinancialStatus,
  };
}
export function thirdPartyBalances(ledger: Ledger) {
  const entries = new Map<string, ThirdPartyEntry[]>();
  for (const entry of ledger.thirdPartyEntries ?? []) {
    const group = entries.get(entry.case_id) ?? [];
    group.push(entry);
    entries.set(entry.case_id, group);
  }
  return new Map(
    (ledger.thirdPartyCases ?? []).map((item) => [
      item.id,
      thirdPartyBalance(entries.get(item.id) ?? []),
    ]),
  );
}
export function thirdPartyTotals(ledger: Ledger) {
  const balances = thirdPartyBalances(ledger);
  let holding = 0,
    receivable = 0,
    open = 0,
    completed = 0;
  for (const item of ledger.thirdPartyCases ?? []) {
    const balance = balances.get(item.id)!;
    holding = safeAdd(holding, balance.holdingAmount);
    receivable = safeAdd(receivable, balance.receivableAmount);
    if (item.status === 'completed') completed++;
    else if (item.status !== 'cancelled' || balance.difference !== 0) open++;
  }
  return { holding, receivable, open, completed };
}

export function previewThirdPartySettlement(
  difference: number,
  cash: number,
  personal: number,
) {
  money(cash, true);
  money(personal, true);
  const total = safeAdd(cash, personal);
  ensure(
    total <= Math.abs(difference),
    'Số tiền quyết toán vượt quá chênh lệch hiện tại.',
  );
  const holding = difference > 0;
  return {
    difference: safeAdd(difference, (holding ? -1 : 1) * total),
    balanceImpact: (holding ? -1 : 1) * cash,
    income: holding ? personal : 0,
    expense: holding ? 0 : personal,
  };
}

export function validateThirdPartyRequest(value: ThirdPartySettlementRequest) {
  ensure(
    value &&
      validThirdPartyId(value.id) &&
      value.id.length <= 80 &&
      validThirdPartyId(value.case_id),
    'ID quyết toán không hợp lệ.',
  );
  money(value.cash_amount, true);
  money(value.personal_amount, true);
  safeAdd(value.cash_amount, value.personal_amount);
  ensure(
    typeof value.complete_case === 'boolean' &&
      validDate(value.occurred_at) &&
      text(value.note, 4000),
    'Thông tin quyết toán không hợp lệ.',
  );
  ensure(
    value.cash_amount
      ? validThirdPartyId(value.account_id)
      : value.account_id === null,
    'Chọn tài khoản cho phần nhận / trả tiền thực tế.',
  );
  ensure(
    value.personal_amount
      ? validThirdPartyId(value.category_id)
      : value.category_id === null,
    'Chọn danh mục cho phần thu chi cá nhân.',
  );
  const tags = transactionTagIds(value);
  ensure(
    value.personal_amount > 0 || tags.length === 0,
    'Tag quyết toán chỉ áp dụng cho phần thu chi cá nhân.',
  );
  ensure(
    value.cash_amount + value.personal_amount > 0 || value.complete_case,
    'Nhập số tiền quyết toán hoặc chọn hoàn tất hồ sơ đã cân bằng.',
  );
}
export function settlementRequestKey(value: ThirdPartySettlementRequest) {
  // Explicit fields: object key order and unknown imported fields have no effect.
  return JSON.stringify({
    id: value.id,
    case_id: value.case_id,
    cash_amount: value.cash_amount,
    personal_amount: value.personal_amount,
    account_id: value.account_id,
    category_id: value.category_id,
    tag_ids_json: JSON.stringify(transactionTagIds(value)),
    note: value.note,
    occurred_at: value.occurred_at,
    complete_case: value.complete_case,
  });
}
export function readThirdPartySettlement(
  record: ThirdPartySettlement,
): ThirdPartySettlementRequest & { direction: ThirdPartyFinancialStatus } {
  let value;
  try {
    value = JSON.parse(record.request_json);
  } catch {
    throw new FinanceError('Nhật ký quyết toán không hợp lệ.');
  }
  validateThirdPartyRequest(value);
  ensure(
    ['holding', 'receivable', 'balanced'].includes(value.direction) &&
      value.id === record.id &&
      value.case_id === record.case_id,
    'Nhật ký quyết toán không khớp hồ sơ.',
  );
  ensure(
    value.direction !== 'balanced' ||
      value.cash_amount + value.personal_amount === 0,
    'Quyết toán cân bằng không phát sinh tiền.',
  );
  return value;
}
export function thirdPartySettlementEntries(
  record: ThirdPartySettlement,
): ThirdPartyEntryInput[] {
  const value = readThirdPartySettlement(record);
  const base = {
    case_id: record.case_id,
    related_entry_id: null,
    settlement_id: record.id,
    note: value.note,
    occurred_at: value.occurred_at,
    created_at: record.created_at,
    updated_at: record.created_at,
  };
  const result: ThirdPartyEntryInput[] = [];
  if (value.cash_amount)
    result.push({
      ...base,
      id: `${record.id}_cash`,
      kind: value.direction === 'holding' ? 'refund' : 'reimbursement',
      amount: value.cash_amount,
      account_id: value.account_id,
      category_id: null,
      tag_ids_json: '[]',
    });
  if (value.personal_amount)
    result.push({
      ...base,
      id: `${record.id}_personal`,
      kind:
        value.direction === 'holding'
          ? 'settlement_income'
          : 'settlement_expense',
      amount: value.personal_amount,
      account_id: null,
      category_id: value.category_id,
      tag_ids_json: value.tag_ids_json,
    });
  return result;
}

export function validateThirdPartyLedger(ledger: Ledger) {
  const cases = new Map<string, ThirdPartyCase>();
  const accounts = new Set(ledger.accounts.map((a) => a.id));
  const categories = new Map(ledger.categories.map((c) => [c.id, c]));
  const tags = new Set((ledger.tags ?? []).map((t) => t.id));
  const validateTagRefs = (value: { tag_ids_json: string }) => {
    ensure(
      transactionTagIds(value).every((id) => tags.has(id)),
      'Tag thu chi hộ không tồn tại.',
    );
  };
  for (const item of ledger.thirdPartyCases ?? []) {
    ensure(
      validThirdPartyId(item.id) && !cases.has(item.id),
      'ID hồ sơ thu chi hộ không hợp lệ hoặc trùng.',
    );
    ensure(
      text(item.title, 200, true) &&
        text(item.person, 100, true) &&
        text(item.description, 4000) &&
        text(item.note, 4000),
      'Tên, người liên quan hoặc ghi chú thu chi hộ không hợp lệ.',
    );
    ensure(
      Object.hasOwn(thirdPartyStatusLabels, item.status) &&
        Number.isSafeInteger(item.revision) &&
        item.revision >= 0,
      'Trạng thái hoặc phiên bản hồ sơ không hợp lệ.',
    );
    if (item.expected_amount !== null) money(item.expected_amount, true);
    ensure(
      validDate(item.started_at) &&
        validDate(item.created_at) &&
        validDate(item.updated_at) &&
        (item.due_at === null ||
          (validDate(item.due_at) && item.due_at >= item.started_at)),
      'Ngày hồ sơ thu chi hộ không hợp lệ.',
    );
    ensure(
      item.status === 'completed'
        ? validDate(item.completed_at) && item.completed_at >= item.started_at
        : item.completed_at === null,
      'Ngày hoàn tất không khớp trạng thái hồ sơ.',
    );
    validateTagRefs(item);
    cases.set(item.id, item);
  }
  const ids = new Set<string>();
  const sequences = new Set<number>();
  const grouped = new Map<string, ThirdPartyEntry[]>();
  const byId = new Map((ledger.thirdPartyEntries ?? []).map((e) => [e.id, e]));
  const settlements = new Map<string, ThirdPartySettlement>();
  for (const record of ledger.thirdPartySettlements ?? []) {
    ensure(
      validThirdPartyId(record.id) &&
        !settlements.has(record.id) &&
        cases.has(record.case_id),
      'Nhật ký quyết toán bị trùng hoặc thiếu hồ sơ.',
    );
    ensure(
      text(record.request_json, 30000) &&
        validDate(record.created_at) &&
        (record.undone_at === null ||
          (validDate(record.undone_at) &&
            record.undone_at >= record.created_at)),
      'Nhật ký quyết toán không hợp lệ.',
    );
    const request = readThirdPartySettlement(record);
    const item = cases.get(record.case_id)!;
    ensure(
      request.occurred_at >= item.started_at &&
        (item.status !== 'completed' ||
          record.undone_at !== null ||
          request.occurred_at <= item.completed_at!),
      'Ngày quyết toán nằm ngoài thời gian của hồ sơ.',
    );
    if (request.cash_amount)
      ensure(
        accounts.has(request.account_id!),
        'Tài khoản trong nhật ký quyết toán không tồn tại.',
      );
    if (request.personal_amount) {
      const category = categories.get(request.category_id!);
      ensure(
        category &&
          category.type ===
            (request.direction === 'holding' ? 'income' : 'expense'),
        'Danh mục trong nhật ký quyết toán không hợp lệ.',
      );
    }
    validateTagRefs(request);
    settlements.set(record.id, record);
  }
  const entriesBySettlement = new Map<string, ThirdPartyEntry[]>();
  for (const entry of ledger.thirdPartyEntries ?? []) {
    const item = cases.get(entry.case_id);
    ensure(
      validThirdPartyId(entry.id) && !ids.has(entry.id) && item,
      'Bút toán thu chi hộ bị trùng hoặc thiếu hồ sơ.',
    );
    ids.add(entry.id);
    ensure(
      Object.hasOwn(thirdPartyEntryLabels, entry.kind),
      'Loại bút toán thu chi hộ không hợp lệ.',
    );
    money(entry.amount);
    ensure(
      Number.isSafeInteger(entry.sequence) &&
        entry.sequence > 0 &&
        !sequences.has(entry.sequence),
      'Thứ tự bút toán không hợp lệ hoặc trùng.',
    );
    sequences.add(entry.sequence);
    ensure(
      text(entry.note, 4000) &&
        validDate(entry.occurred_at) &&
        validDate(entry.created_at) &&
        validDate(entry.updated_at) &&
        entry.occurred_at >= item.started_at,
      'Ngày hoặc ghi chú bút toán không hợp lệ.',
    );
    ensure(
      item.status !== 'completed' || entry.occurred_at <= item.completed_at!,
      'Bút toán nằm sau ngày hoàn tất.',
    );
    if (isThirdPartyPersonal(entry.kind)) {
      ensure(
        entry.account_id === null,
        'Quyết toán thu chi cá nhân không phát sinh dòng tiền.',
      );
      const category = categories.get(entry.category_id ?? '');
      ensure(
        category &&
          category.type ===
            (entry.kind === 'settlement_income' ? 'income' : 'expense'),
        'Danh mục quyết toán không đúng loại.',
      );
    } else {
      ensure(
        accounts.has(entry.account_id ?? '') && entry.category_id === null,
        'Tài khoản dòng tiền hoặc danh mục thu chi hộ không hợp lệ.',
      );
    }
    validateTagRefs(entry);
    if (entry.kind === 'payment_refund') {
      const original = byId.get(entry.related_entry_id ?? '');
      ensure(
        original &&
          original.kind === 'payment' &&
          original.case_id === entry.case_id &&
          thirdPartyEntryOrder(original, entry) < 0,
        'Chọn khoản thanh toán gốc trong cùng hồ sơ, trước ngày hoàn tiền.',
      );
    } else
      ensure(
        entry.related_entry_id === null,
        'Chỉ tiền hoàn từ nhà bán mới liên kết thanh toán gốc.',
      );
    if (entry.settlement_id !== null) {
      const record = settlements.get(entry.settlement_id);
      ensure(
        record && record.case_id === entry.case_id && record.undone_at === null,
        'Bút toán thiếu quyết toán hoặc quyết toán đã hoàn tác.',
      );
      const group = entriesBySettlement.get(record.id) ?? [];
      group.push(entry);
      entriesBySettlement.set(record.id, group);
    }
    const group = grouped.get(entry.case_id) ?? [];
    group.push(entry);
    grouped.set(entry.case_id, group);
  }
  for (const record of settlements.values()) {
    const expected =
      record.undone_at === null ? thirdPartySettlementEntries(record) : [];
    const actual = entriesBySettlement.get(record.id) ?? [];
    ensure(
      expected.length === actual.length &&
        expected.every((row) => {
          const found = actual.find((entry) => entry.id === row.id);
          return (
            found &&
            Object.entries(row).every(
              ([key, value]) => found[key as keyof ThirdPartyEntry] === value,
            )
          );
        }),
      'Các bút toán của lần quyết toán không đầy đủ hoặc đã bị sửa riêng.',
    );
  }
  for (const item of cases.values()) {
    const entries = (grouped.get(item.id) ?? []).sort(thirdPartyEntryOrder);
    let difference = 0;
    const refunded = new Map<string, number>();
    for (const entry of entries) {
      if (entry.kind === 'refund' || entry.kind === 'settlement_income')
        ensure(
          difference >= entry.amount,
          'Tiền trả lại / giữ lại vượt tiền đang giữ hộ. Hãy mở lại và hoàn tác quyết toán phụ thuộc trước khi sửa lịch sử.',
        );
      if (entry.kind === 'reimbursement' || entry.kind === 'settlement_expense')
        ensure(
          -difference >= entry.amount,
          'Tiền thu lại / tự chịu vượt tiền cần thu. Hãy mở lại và hoàn tác quyết toán phụ thuộc trước khi sửa lịch sử.',
        );
      if (entry.kind === 'payment_refund') {
        const id = entry.related_entry_id!;
        const amount = safeAdd(refunded.get(id) ?? 0, entry.amount);
        ensure(
          amount <= byId.get(id)!.amount,
          'Tiền nhà bán hoàn vượt số tiền đã thanh toán.',
        );
        refunded.set(id, amount);
      }
      difference = safeAdd(difference, effects[entry.kind] * entry.amount);
    }
    if (item.status === 'completed')
      ensure(difference === 0, 'Chỉ hoàn tất hồ sơ đã cân bằng tài chính.');
    thirdPartyBalance(entries);
  }
  thirdPartyTotals(ledger);
}

// Cash projections join the existing account replay; nothing maintains a second balance.
export function thirdPartyCashFlows(ledger: Ledger) {
  const cases = new Map((ledger.thirdPartyCases ?? []).map((c) => [c.id, c]));
  return (ledger.thirdPartyEntries ?? [])
    .filter((e) => !isThirdPartyPersonal(e.kind))
    .map((entry) => ({
      id: `third-party:${String(entry.sequence).padStart(16, '0')}:${entry.id}`,
      entry_id: entry.id,
      case_id: entry.case_id,
      account_id: entry.account_id!,
      amount: entry.amount,
      title: `${thirdPartyEntryLabels[entry.kind]} · ${cases.get(entry.case_id)?.title ?? ''}`,
      note: entry.note,
      occurred_at: entry.occurred_at,
      created_at: entry.created_at,
      source_account_id: effects[entry.kind] < 0 ? entry.account_id : null,
      destination_account_id: effects[entry.kind] > 0 ? entry.account_id : null,
      exclude_from_balance: 0 as const,
    }));
}
export function thirdPartyReportTransactions(ledger: Ledger): Transaction[] {
  const cases = new Map((ledger.thirdPartyCases ?? []).map((c) => [c.id, c]));
  return (ledger.thirdPartyEntries ?? [])
    .filter((e) => isThirdPartyPersonal(e.kind))
    .map((entry) => ({
      id: `third-party-report:${entry.id}`,
      type: entry.kind === 'settlement_income' ? 'income' : 'expense',
      title: `${thirdPartyEntryLabels[entry.kind]} · ${cases.get(entry.case_id)?.title ?? ''}`,
      amount: entry.amount,
      source_account_id: null,
      destination_account_id: null,
      category_id: entry.category_id,
      tag_ids_json: entry.tag_ids_json,
      note: entry.note,
      occurred_at: entry.occurred_at,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      exclude_from_balance: 1,
    }));
}
export function personalReportTransactions(ledger: Ledger): Transaction[] {
  return [...ledger.transactions, ...thirdPartyReportTransactions(ledger)];
}
