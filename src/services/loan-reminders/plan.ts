import type { Ledger, Loan } from '../../types/finance.ts';
import { loanBalances } from '../loans.ts';

export const REMINDER_LIMIT = 60;
export interface LoanReminder {
  id: string;
  loanId: string;
  date: Date;
  title: string;
  body: string;
}

// Build each occurrence in local time so the selected wall-clock time is preserved.
export function loanReminderDates(
  loan: Loan,
  now: Date,
  limit = REMINDER_LIMIT,
): Date[] {
  if (
    !loan.due_at ||
    !Number.isInteger(loan.payment_day) ||
    !loan.payment_day ||
    loan.payment_day < 1 ||
    loan.payment_day > 31
  )
    return [];
  const start = new Date(loan.occurred_at);
  const end = new Date(loan.due_at);
  const lower = new Date(Math.max(start.getTime(), now.getTime()));
  const dates: Date[] = [];
  let year = lower.getFullYear();
  let month = lower.getMonth();
  while (dates.length < limit) {
    const day = Math.min(
      loan.payment_day,
      new Date(year, month + 1, 0).getDate(),
    );
    const minutes = loan.payment_time_minutes ?? 540;
    const date = new Date(
      year,
      month,
      day,
      Math.floor(minutes / 60),
      minutes % 60,
      0,
      0,
    );
    if (date > end || !Number.isFinite(date.getTime())) break;
    if (date > now && date >= start) dates.push(date);
    month++;
    if (month === 12) {
      month = 0;
      year++;
    }
  }
  return dates;
}

export function planLoanReminders(
  ledger: Ledger,
  now = new Date(),
  limit = REMINDER_LIMIT,
): LoanReminder[] {
  const balances = loanBalances(ledger);
  return (ledger.loans ?? [])
    .flatMap((loan) => {
      if ((balances.get(loan.id) ?? 0) <= 0) return [];
      return loanReminderDates(loan, now, limit).map((date) => ({
        id: `loan-reminder:${loan.id}:${date.getTime()}`,
        loanId: loan.id,
        date,
        title:
          loan.direction === 'lend'
            ? 'Đến ngày thu hồi khoản cho vay'
            : 'Đến ngày trả nợ',
        body: `Hôm nay là ngày ${loan.direction === 'lend' ? 'thu tiền từ' : 'trả tiền cho'} ${loan.lender}. Mở Moni để ghi nhận.`,
      }));
    })
    .sort(
      (a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}
