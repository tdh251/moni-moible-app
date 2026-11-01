import type { Ledger, Loan, LoanCost, LoanPayment } from '../types/finance.ts';
import { ensure, FinanceError, money, safeAdd } from './accounting/money.ts';

const validId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9_-]{1,100}$/.test(value) &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const validDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

export function parseLoanCosts(loan: Pick<Loan, 'costs_json'>): LoanCost[] {
  const raw = loan.costs_json ?? '[]';
  ensure(
    typeof raw === 'string' && raw.length <= 20000,
    'Chi phí vay không hợp lệ hoặc quá lớn.',
  );
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new FinanceError('Danh sách chi phí vay không hợp lệ.');
  }
  ensure(
    Array.isArray(value) && value.length <= 50,
    'Mỗi khoản vay có tối đa 50 chi phí.',
  );
  const ids = new Set<string>();
  for (const cost of value) {
    ensure(
      cost &&
        typeof cost === 'object' &&
        !Array.isArray(cost) &&
        validId(cost.id) &&
        !ids.has(cost.id),
      'ID chi phí vay không hợp lệ hoặc bị trùng.',
    );
    ids.add(cost.id);
    ensure(
      typeof cost.name === 'string' &&
        cost.name.trim().length > 0 &&
        cost.name.length <= 100,
      'Tên chi phí từ 1 đến 100 ký tự.',
    );
    money(cost.amount);
  }
  value.reduce((sum, cost) => safeAdd(sum, cost.amount), 0);
  return value as LoanCost[];
}

export function totalLoanCosts(loan: Pick<Loan, 'costs_json'>): number {
  return parseLoanCosts(loan).reduce(
    (sum, cost) => safeAdd(sum, cost.amount),
    0,
  );
}

export function loanTotalAmount(
  loan: Pick<Loan, 'amount' | 'costs_json'>,
): number {
  return safeAdd(loan.amount, totalLoanCosts(loan));
}

export function loanPaymentTotal(
  payment: Pick<LoanPayment, 'amount' | 'fee_amount'>,
): number {
  money(payment.amount);
  const fee = payment.fee_amount === undefined ? 0 : payment.fee_amount;
  money(fee, true);
  return safeAdd(payment.amount, fee);
}

// Estimate a uniform payment over the original term; count a partial month as one.
export function loanMonthlyPayment(
  loan: Pick<Loan, 'amount' | 'costs_json' | 'occurred_at' | 'due_at'>,
): { months: number; amount: number } | null {
  if (!loan.due_at) return null;
  const start = new Date(loan.occurred_at);
  const end = new Date(loan.due_at);
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    end.getMonth() -
    start.getMonth();
  const anniversaryDay = Math.min(
    start.getDate(),
    new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate(),
  );
  if (end.getDate() > anniversaryDay) months++;
  months = Math.max(1, months);
  return { months, amount: Math.ceil(loanTotalAmount(loan) / months) };
}

export function loanOutstanding(loan: Loan, payments: LoanPayment[]): number {
  return payments
    .filter((p) => p.loan_id === loan.id)
    .reduce((amount, p) => safeAdd(amount, -p.amount), loanTotalAmount(loan));
}

export function loanBalances(ledger: Ledger): Map<string, number> {
  const balances = new Map(
    (ledger.loans ?? []).map((loan) => [loan.id, loanTotalAmount(loan)]),
  );
  for (const p of ledger.loanPayments ?? [])
    balances.set(p.loan_id, safeAdd(balances.get(p.loan_id) ?? 0, -p.amount));
  return balances;
}

export function totalLoanOutstanding(ledger: Ledger): number {
  const paid = (ledger.loanPayments ?? []).reduce(
    (sum, p) => safeAdd(sum, p.amount),
    0,
  );
  return safeAdd(
    (ledger.loans ?? []).reduce(
      (sum, loan) => safeAdd(sum, loanTotalAmount(loan)),
      0,
    ),
    -paid,
  );
}

export function validateLoans(ledger: Ledger): void {
  const accounts = new Set(ledger.accounts.map((a) => a.id));
  const loans = new Map<string, Loan>();
  for (const loan of ledger.loans ?? []) {
    ensure(
      validId(loan.id) && !loans.has(loan.id),
      'ID khoản vay không hợp lệ hoặc bị trùng.',
    );
    ensure(
      typeof loan.lender === 'string' &&
        loan.lender.trim().length > 0 &&
        loan.lender.length <= 100,
      'Nhập người cho vay từ 1 đến 100 ký tự.',
    );
    ensure(
      typeof loan.note === 'string' && loan.note.length <= 4000,
      'Ghi chú tối đa 4.000 ký tự.',
    );
    ensure(
      accounts.has(loan.account_id),
      'Tài khoản nhận khoản vay không tồn tại.',
    );
    ensure(
      validDate(loan.occurred_at) && validDate(loan.created_at),
      'Ngày khoản vay không hợp lệ.',
    );
    money(loan.amount);
    ensure(
      loan.exclude_from_balance === undefined ||
        loan.exclude_from_balance === 0 ||
        loan.exclude_from_balance === 1,
      'Trạng thái không cộng tiền vay phải là 0 hoặc 1.',
    );
    ensure(
      loan.due_at === undefined ||
        loan.due_at === null ||
        (validDate(loan.due_at) && loan.due_at >= loan.occurred_at),
      'Ngày đến hạn phải từ ngày nhận tiền vay trở đi.',
    );
    parseLoanCosts(loan);
    loans.set(loan.id, loan);
  }
  const ids = new Set<string>();
  const paid = new Map<string, number>();
  for (const payment of ledger.loanPayments ?? []) {
    ensure(
      validId(payment.id) && !ids.has(payment.id),
      'ID lần trả nợ không hợp lệ hoặc bị trùng.',
    );
    ids.add(payment.id);
    const loan = loans.get(payment.loan_id);
    ensure(loan, 'Khoản vay cần trả không tồn tại.');
    ensure(accounts.has(payment.account_id), 'Tài khoản trả nợ không tồn tại.');
    ensure(
      validDate(payment.occurred_at) &&
        validDate(payment.created_at) &&
        payment.occurred_at >= loan.occurred_at,
      'Ngày trả nợ phải từ ngày nhận tiền vay trở đi.',
    );
    money(payment.amount);
    loanPaymentTotal(payment);
    const total = safeAdd(paid.get(loan.id) ?? 0, payment.amount);
    ensure(
      total <= loanTotalAmount(loan),
      'Số tiền trả vượt quá khoản nợ còn lại.',
    );
    paid.set(loan.id, total);
  }
  totalLoanOutstanding(ledger);
}

// These cash movements affect account balances only, never income/expense reports.
export function loanCashFlows(ledger: Ledger) {
  return [
    ...(ledger.loans ?? []).map((loan) => ({
      ...loan,
      id: `loan:${loan.id}`,
      loan_id: loan.id,
      title: `Vay/mượn · ${loan.lender}`,
      source_account_id: null as string | null,
      destination_account_id: loan.account_id,
      exclude_from_balance: loan.exclude_from_balance ?? 0,
    })),
    ...(ledger.loanPayments ?? []).map((p) => ({
      ...p,
      amount: loanPaymentTotal(p),
      id: `payment:${p.id}`,
      title: 'Trả nợ',
      source_account_id: p.account_id,
      destination_account_id: null as string | null,
      exclude_from_balance: 0,
    })),
  ];
}
