import {
  tagNameKey,
  transactionTagIds,
  validateTags,
} from '../services/tags.ts';
import type {
  Loan,
  LoanPayment,
  Account,
  Category,
  CategoryType,
  Tag,
  Ledger,
  Snapshot,
  Transaction,
  TransactionDraft,
  TransactionItem,
} from '../types/finance.ts';
import {
  accountBalances,
  changeOpening,
  ensure,
  money,
  removeTransaction,
  replaceTransaction,
  validateLedger,
} from '../services/accounting/ledger.ts';
import { validateBackup, type Backup } from '../services/backup/validation.ts';
import {
  itemCategoryIds,
  transactionCategoryTags,
} from '../services/categories/tags.ts';
import { defaultCategories } from './defaults.ts';
import { resolveTransactionTitle } from '../services/accounting/title.ts';
import {
  migration1,
  migration2,
  migration3,
  migration4,
  migration5,
  migration6,
  migration7,
  migration8,
  migration9,
  migration10,
  migration11,
  migration12,
  migration13,
  migration14,
  migration15,
  migration16,
  SCHEMA_VERSION,
} from './migrations.ts';

export type Param = string | number | null;
export interface Connection {
  getAllAsync<T>(sql: string, ...params: Param[]): Promise<T[]>;
  runAsync(sql: string, ...params: Param[]): Promise<unknown>;
  execAsync(sql: string): Promise<void>;
}
export type Atomic = <T>(job: (db: Connection) => Promise<T>) => Promise<T>;
export async function migrate(db: Connection): Promise<void> {
  const [row] = await db.getAllAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  ensure(
    row.user_version <= SCHEMA_VERSION,
    'Dữ liệu thuộc phiên bản mới hơn. Vui lòng cập nhật Moni.',
  );
  if (row.user_version === 0) await db.execAsync(migration1);
  if (row.user_version < 2) await db.execAsync(migration2);
  if (row.user_version < 3) await db.execAsync(migration3);
  if (row.user_version < 4) await db.execAsync(migration4);
  if (row.user_version < 5) await db.execAsync(migration5);
  if (row.user_version < 6) await db.execAsync(migration6);
  if (row.user_version < 7) await db.execAsync(migration7);
  if (row.user_version < 8) await db.execAsync(migration8);
  if (row.user_version < 9) await db.execAsync(migration9);
  if (row.user_version < 10) await db.execAsync(migration10);
  if (row.user_version < 11) await db.execAsync(migration11);
  if (row.user_version < 12) await db.execAsync(migration12);
  if (row.user_version < 13) await db.execAsync(migration13);
  if (row.user_version < 14) await db.execAsync(migration14);
  if (row.user_version < 15) await db.execAsync(migration15);
  if (row.user_version < 16) await db.execAsync(migration16);
}
export async function readSnapshot(db: Connection): Promise<Snapshot> {
  // Sequential reads stay on the same connection, including inside exclusive transactions.
  const loans = await db.getAllAsync<Loan>(
    'SELECT * FROM loans ORDER BY occurred_at DESC,created_at DESC,id DESC',
  );
  const loanPayments = await db.getAllAsync<LoanPayment>(
    'SELECT * FROM loan_payments ORDER BY occurred_at DESC,created_at DESC,id DESC',
  );
  const accounts = await db.getAllAsync<Account>(
    "SELECT * FROM accounts ORDER BY CASE WHEN type='cash' THEN 0 ELSE 1 END,created_at,id",
  );
  const categories = await db.getAllAsync<Category>(
    'SELECT * FROM categories ORDER BY sort_order,name',
  );
  const tags = await db.getAllAsync<Tag>(
    'SELECT id,name,color,is_archived FROM tags ORDER BY name',
  );
  const transactions = await db.getAllAsync<Transaction>(
    'SELECT * FROM transactions ORDER BY occurred_at DESC,created_at DESC,id DESC',
  );
  const items = await db.getAllAsync<TransactionItem>(
    'SELECT * FROM transaction_items ORDER BY sort_order,id',
  );
  const [setting] = await db.getAllAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key='onboarded'",
  );
  return {
    accounts,
    loans,
    loanPayments,
    tags,
    categories,
    transactions,
    items,
    onboarded: setting?.value === 'true',
  };
}
async function insertAccount(db: Connection, a: Account) {
  await db.runAsync(
    'INSERT INTO accounts (id,name,type,opening_balance,is_archived,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    a.id,
    a.name,
    a.type,
    a.opening_balance,
    a.is_archived,
    a.created_at,
    a.updated_at,
  );
}
async function insertCategory(db: Connection, c: Category) {
  await db.runAsync(
    'INSERT INTO categories (id,name,type,icon,color,sort_order,is_archived,parent_id) VALUES (?,?,?,?,?,?,?,?)',
    c.id,
    c.name,
    c.type,
    c.icon,
    c.color,
    c.sort_order,
    c.is_archived,
    c.parent_id ?? null,
  );
}
async function insertTransaction(db: Connection, t: Transaction) {
  await db.runAsync(
    'INSERT INTO transactions (id,type,title,amount,source_account_id,destination_account_id,category_id,note,occurred_at,created_at,updated_at,adjustments_json,exclude_from_balance,category_split,category_ids_json,tag_ids_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    t.id,
    t.type,
    t.title,
    t.amount,
    t.source_account_id,
    t.destination_account_id,
    t.category_id,
    t.note,
    t.occurred_at,
    t.created_at,
    t.updated_at,
    t.adjustments_json ?? '[]',
    t.exclude_from_balance ?? 0,
    t.category_split ?? 0,
    t.category_ids_json ?? '[]',
    t.tag_ids_json ?? '[]',
  );
}
async function insertItem(db: Connection, i: TransactionItem) {
  await db.runAsync(
    'INSERT INTO transaction_items (id,transaction_id,name,amount,category_id,sort_order,tag_ids_json,category_ids_json) VALUES (?,?,?,?,?,?,?,?)',
    i.id,
    i.transaction_id,
    i.name,
    i.amount,
    i.category_id,
    i.sort_order,
    i.tag_ids_json ?? '[]',
    i.category_ids_json ?? '[]',
  );
}
async function insertLoan(db: Connection, loan: Loan) {
  await db.runAsync(
    'INSERT INTO loans (id,lender,amount,account_id,note,occurred_at,created_at,due_at,costs_json,exclude_from_balance) VALUES (?,?,?,?,?,?,?,?,?,?)',
    loan.id,
    loan.lender,
    loan.amount,
    loan.account_id,
    loan.note,
    loan.occurred_at,
    loan.created_at,
    loan.due_at ?? null,
    loan.costs_json ?? '[]',
    loan.exclude_from_balance ?? 0,
  );
}
async function insertLoanPayment(db: Connection, p: LoanPayment) {
  await db.runAsync(
    'INSERT INTO loan_payments (id,loan_id,amount,account_id,occurred_at,created_at,fee_amount) VALUES (?,?,?,?,?,?,?)',
    p.id,
    p.loan_id,
    p.amount,
    p.account_id,
    p.occurred_at,
    p.created_at,
    p.fee_amount ?? 0,
  );
}
async function clear(db: Connection) {
  await db.execAsync(
    'DELETE FROM loan_payments; DELETE FROM loans; DELETE FROM transaction_items; DELETE FROM transactions; DELETE FROM accounts; DELETE FROM categories; DELETE FROM tags; DELETE FROM settings;',
  );
}
export class FinanceRepository {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private atomic: Atomic) {}
  private write<T>(job: (db: Connection) => Promise<T>): Promise<T> {
    const task = this.pending.then(() => this.atomic(job));
    this.pending = task.catch(() => undefined);
    return task;
  }
  async initialize() {
    return this.write(async (db) => {
      await migrate(db);
      const existing = await db.getAllAsync(
        'SELECT id FROM categories LIMIT 1',
      );
      if (!existing.length)
        for (const c of defaultCategories) await insertCategory(db, c);
    });
  }
  snapshot() {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      validateLedger(data);
      ensure(
        data.accounts.filter((a) => a.type === 'cash').length ===
          (data.onboarded ? 1 : 0),
        'Trạng thái thiết lập không khớp dữ liệu tài khoản.',
      );
      return data;
    });
  }
  onboard(accounts: Account[]) {
    return this.write(async (db) => {
      const old = await readSnapshot(db);
      ensure(
        !old.onboarded && !old.accounts.length,
        'Ứng dụng đã được thiết lập.',
      );
      ensure(
        accounts.filter((a) => a.type === 'cash').length === 1 &&
          accounts.every((a) => !a.is_archived),
        'Cần đúng một tài khoản tiền mặt.',
      );
      validateLedger({ ...old, accounts });
      for (const a of accounts) await insertAccount(db, a);
      await db.runAsync(
        "INSERT OR REPLACE INTO settings VALUES ('onboarded','true')",
      );
    });
  }
  addAccount(a: Account) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      ensure(
        data.onboarded && a.type === 'bank' && !a.is_archived,
        'Chỉ thêm tài khoản ngân hàng sau thiết lập.',
      );
      validateLedger({ ...data, accounts: [...data.accounts, a] });
      await insertAccount(db, a);
    });
  }
  renameAccount(id: string, name: string) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      ensure(
        data.accounts.some((a) => a.id === id && !a.is_archived),
        'Tài khoản không khả dụng.',
      );
      const next = {
        ...data,
        accounts: data.accounts.map((a) =>
          a.id === id ? { ...a, name: name.trim() } : a,
        ),
      };
      validateLedger(next);
      await db.runAsync(
        'UPDATE accounts SET name=?,updated_at=? WHERE id=?',
        name.trim(),
        new Date().toISOString(),
        id,
      );
    });
  }
  adjustOpening(id: string, amount: number) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      changeOpening(data, id, amount);
      await db.runAsync(
        'UPDATE accounts SET opening_balance=?,updated_at=? WHERE id=?',
        amount,
        new Date().toISOString(),
        id,
      );
    });
  }
  archiveAccount(id: string, archived: boolean) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      const a = data.accounts.find((x) => x.id === id);
      ensure(a?.type === 'bank', 'Chỉ lưu trữ tài khoản ngân hàng.');
      ensure(
        !archived || accountBalances(data)[id] === 0,
        'Chuyển hết tiền khỏi tài khoản trước khi lưu trữ.',
      );
      await db.runAsync(
        'UPDATE accounts SET is_archived=?,updated_at=? WHERE id=?',
        archived ? 1 : 0,
        new Date().toISOString(),
        id,
      );
    });
  }
  saveTag(tag: Tag) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      const saved = {
        ...tag,
        name: tag.name.normalize('NFC').trim().replace(/\s+/g, ' '),
      };
      validateTags([
        ...(data.tags ?? []).filter((t) => t.id !== tag.id),
        saved,
      ]);
      await db.runAsync(
        'INSERT INTO tags (id,name,name_key,color,is_archived) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_key=excluded.name_key,color=excluded.color,is_archived=excluded.is_archived',
        saved.id,
        saved.name,
        tagNameKey(saved.name),
        saved.color,
        saved.is_archived,
      );
    });
  }
  deleteTag(id: string) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      ensure(
        (data.tags ?? []).some((t) => t.id === id),
        'Tag không còn tồn tại.',
      );
      const used = [...data.transactions, ...data.items].some((row) =>
        transactionTagIds(row).includes(id),
      );
      await db.runAsync(
        used
          ? 'UPDATE tags SET is_archived=1 WHERE id=?'
          : 'DELETE FROM tags WHERE id=?',
        id,
      );
    });
  }
  saveCategory(c: Category) {
    return this.write(async (db) => {
      ensure(
        c.name.trim().length > 0 &&
          c.name.length <= 100 &&
          ['income', 'expense'].includes(c.type),
        'Tên danh mục từ 1 đến 100 ký tự.',
      );
      const categories = (await readSnapshot(db)).categories;
      const old = categories.find((x) => x.id === c.id);
      ensure(c.parent_id == null, 'Danh mục chỉ hỗ trợ một cấp.');
      ensure(!old || old.type === c.type, 'Không thể đổi loại danh mục.');
      if (old)
        await db.runAsync(
          'UPDATE categories SET name=?,icon=?,color=?,is_archived=?,parent_id=? WHERE id=?',
          c.name.trim(),
          c.icon,
          c.color,
          c.is_archived,
          c.parent_id ?? null,
          c.id,
        );
      else {
        const [last] = await db.getAllAsync<{ position: number }>(
          'SELECT COALESCE(MAX(sort_order),-1)+1 AS position FROM categories WHERE type=?',
          c.type,
        );
        await insertCategory(db, {
          ...c,
          name: c.name.trim(),
          sort_order: last.position,
        });
      }
    });
  }
  reorderCategories(type: CategoryType, ids: string[]) {
    return this.write(async (db) => {
      const list = (await readSnapshot(db)).categories.filter(
        (c) => c.type === type,
      );
      const expected = new Set(list.map((c) => c.id));
      ensure(
        ids.length === expected.size &&
          new Set(ids).size === expected.size &&
          ids.every((id) => expected.has(id)),
        'Danh sách danh mục đã thay đổi. Vui lòng thử lại.',
      );
      for (const [index, id] of ids.entries())
        await db.runAsync(
          'UPDATE categories SET sort_order=? WHERE id=?',
          index,
          id,
        );
    });
  }
  deleteCategory(id: string) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      ensure(
        data.categories.some((c) => c.id === id),
        'Danh mục không còn tồn tại.',
      );
      const used =
        data.transactions.some(
          (t) =>
            t.category_id === id || transactionCategoryTags(t).includes(id),
        ) || data.items.some((i) => itemCategoryIds(i).includes(id));
      await db.runAsync(
        used
          ? 'UPDATE categories SET is_archived=1 WHERE id=?'
          : 'DELETE FROM categories WHERE id=?',
        id,
      );
    });
  }
  saveTransaction(draft: TransactionDraft, editing: boolean) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      ensure(data.onboarded, 'Vui lòng thiết lập tài khoản.');
      const old = data.transactions.find((t) => t.id === draft.id);
      ensure(editing === !!old, 'Giao dịch đã thay đổi. Hãy mở lại màn hình.');
      const saved = {
        ...draft,
        title: resolveTransactionTitle(draft),
        created_at: old?.created_at ?? draft.created_at,
        updated_at: new Date().toISOString(),
      };
      replaceTransaction(data, saved);
      if (editing)
        await db.runAsync('DELETE FROM transactions WHERE id=?', saved.id);
      await insertTransaction(db, { ...saved, category_ids_json: '[]' });
      for (const i of saved.items)
        await insertItem(db, { ...i, category_ids_json: '[]' });
    });
  }
  deleteTransaction(id: string) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      ensure(
        data.transactions.some((t) => t.id === id),
        'Giao dịch không còn tồn tại.',
      );
      removeTransaction(data, id);
      await db.runAsync('DELETE FROM transactions WHERE id=?', id);
    });
  }
  addLoan(loan: Loan) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      ensure(data.onboarded, 'Vui lòng thiết lập tài khoản.');
      ensure(
        data.accounts.some((a) => a.id === loan.account_id && !a.is_archived),
        'Chọn tài khoản nhận tiền đang hoạt động.',
      );
      const saved = { ...loan, lender: loan.lender.trim() };
      validateLedger({ ...data, loans: [...(data.loans ?? []), saved] });
      await insertLoan(db, saved);
    });
  }
  repayLoan(payment: LoanPayment) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      ensure(data.onboarded, 'Vui lòng thiết lập tài khoản.');
      ensure(
        data.accounts.some(
          (a) => a.id === payment.account_id && !a.is_archived,
        ),
        'Chọn tài khoản trả nợ đang hoạt động.',
      );
      validateLedger({
        ...data,
        loanPayments: [...(data.loanPayments ?? []), payment],
      });
      await insertLoanPayment(db, payment);
    });
  }
  deleteLoan(id: string) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      ensure(
        data.loans?.some((loan) => loan.id === id),
        'Khoản vay không tồn tại.',
      );
      validateLedger({
        ...data,
        loans: data.loans?.filter((loan) => loan.id !== id),
        loanPayments: data.loanPayments?.filter((p) => p.loan_id !== id),
      });
      await db.runAsync('DELETE FROM loans WHERE id=?', id);
    });
  }
  deleteLoanPayment(id: string) {
    return this.write(async (db) => {
      const data = await readSnapshot(db);
      ensure(
        data.loanPayments?.some((p) => p.id === id),
        'Lần trả nợ không tồn tại.',
      );
      validateLedger({
        ...data,
        loanPayments: data.loanPayments?.filter((p) => p.id !== id),
      });
      await db.runAsync('DELETE FROM loan_payments WHERE id=?', id);
    });
  }
  restoreDefaults() {
    return this.write(async (db) => {
      for (const c of defaultCategories) {
        const existing = await db.getAllAsync(
          'SELECT id FROM categories WHERE id=?',
          c.id,
        );
        if (existing.length)
          await db.runAsync(
            'UPDATE categories SET name=?,icon=?,color=?,is_archived=0,parent_id=NULL WHERE id=?',
            c.name,
            c.icon,
            c.color,
            c.id,
          );
        else await insertCategory(db, c);
      }
    });
  }
  backup(): Promise<Backup> {
    return this.write(async (db) => ({
      format: 'monomoney',
      version: 16,
      exported_at: new Date().toISOString(),
      data: await readSnapshot(db),
    }));
  }
  restore(value: unknown) {
    const backup = validateBackup(value);
    return this.write(async (db) => {
      await clear(db);
      for (const tag of backup.data.tags ?? [])
        await db.runAsync(
          'INSERT INTO tags (id,name,name_key,color,is_archived) VALUES (?,?,?,?,?)',
          tag.id,
          tag.name,
          tagNameKey(tag.name),
          tag.color,
          tag.is_archived,
        );
      for (const a of backup.data.accounts) await insertAccount(db, a);
      for (const c of backup.data.categories) await insertCategory(db, c);
      for (const t of backup.data.transactions) await insertTransaction(db, t);
      for (const i of backup.data.items) await insertItem(db, i);
      for (const loan of backup.data.loans ?? []) await insertLoan(db, loan);
      for (const payment of backup.data.loanPayments ?? [])
        await insertLoanPayment(db, payment);
      await db.runAsync(
        "INSERT INTO settings VALUES ('onboarded',?)",
        String(backup.data.onboarded),
      );
    });
  }
  reset() {
    return this.write(async (db) => {
      await clear(db);
      for (const c of defaultCategories) await insertCategory(db, c);
    });
  }
}
export function makeAccount(
  id: string,
  name: string,
  type: Account['type'],
  opening_balance: number,
): Account {
  money(opening_balance, true);
  const now = new Date().toISOString();
  return {
    id,
    name: name.trim(),
    type,
    opening_balance,
    is_archived: 0,
    created_at: now,
    updated_at: now,
  };
}
export function emptyLedger(): Ledger {
  return {
    accounts: [],
    loans: [],
    loanPayments: [],
    tags: [],
    categories: [],
    transactions: [],
    items: [],
  };
}
