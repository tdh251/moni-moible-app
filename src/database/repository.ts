import type {
  Account,
  Category,
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
import { defaultCategories } from './defaults.ts';
import { resolveTransactionTitle } from '../services/accounting/title.ts';
import {
  migration1,
  migration2,
  migration3,
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
}
export async function readSnapshot(db: Connection): Promise<Snapshot> {
  // Sequential reads stay on the same connection, including inside exclusive transactions.
  const accounts = await db.getAllAsync<Account>(
    "SELECT * FROM accounts ORDER BY CASE WHEN type='cash' THEN 0 ELSE 1 END,created_at,id",
  );
  const categories = await db.getAllAsync<Category>(
    'SELECT * FROM categories ORDER BY sort_order,name',
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
    'INSERT INTO categories VALUES (?,?,?,?,?,?,?)',
    c.id,
    c.name,
    c.type,
    c.icon,
    c.color,
    c.sort_order,
    c.is_archived,
  );
}
async function insertTransaction(db: Connection, t: Transaction) {
  await db.runAsync(
    'INSERT INTO transactions (id,type,title,amount,source_account_id,destination_account_id,category_id,note,occurred_at,created_at,updated_at,adjustments_json,exclude_from_balance) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
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
  );
}
async function insertItem(db: Connection, i: TransactionItem) {
  await db.runAsync(
    'INSERT INTO transaction_items VALUES (?,?,?,?,?,?)',
    i.id,
    i.transaction_id,
    i.name,
    i.amount,
    i.category_id,
    i.sort_order,
  );
}
async function clear(db: Connection) {
  await db.execAsync(
    'DELETE FROM transaction_items; DELETE FROM transactions; DELETE FROM accounts; DELETE FROM categories; DELETE FROM settings;',
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
  saveCategory(c: Category) {
    return this.write(async (db) => {
      ensure(
        c.name.trim().length > 0 &&
          c.name.length <= 100 &&
          ['income', 'expense'].includes(c.type),
        'Tên danh mục từ 1 đến 100 ký tự.',
      );
      const old = (await readSnapshot(db)).categories.find(
        (x) => x.id === c.id,
      );
      ensure(!old || old.type === c.type, 'Không thể đổi loại danh mục.');
      if (old)
        await db.runAsync(
          'UPDATE categories SET name=?,icon=?,color=?,is_archived=? WHERE id=?',
          c.name.trim(),
          c.icon,
          c.color,
          c.is_archived,
          c.id,
        );
      else await insertCategory(db, { ...c, name: c.name.trim() });
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
        title: resolveTransactionTitle(draft, data.categories),
        created_at: old?.created_at ?? draft.created_at,
        updated_at: new Date().toISOString(),
      };
      replaceTransaction(data, saved);
      if (editing)
        await db.runAsync('DELETE FROM transactions WHERE id=?', saved.id);
      await insertTransaction(db, saved);
      for (const i of saved.items) await insertItem(db, i);
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
  restoreDefaults() {
    return this.write(async (db) => {
      for (const c of defaultCategories) {
        const existing = await db.getAllAsync(
          'SELECT id FROM categories WHERE id=?',
          c.id,
        );
        if (existing.length)
          await db.runAsync(
            'UPDATE categories SET name=?,icon=?,color=?,is_archived=0 WHERE id=?',
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
      version: 4,
      exported_at: new Date().toISOString(),
      data: await readSnapshot(db),
    }));
  }
  restore(value: unknown) {
    const backup = validateBackup(value);
    return this.write(async (db) => {
      await clear(db);
      for (const a of backup.data.accounts) await insertAccount(db, a);
      for (const c of backup.data.categories) await insertCategory(db, c);
      for (const t of backup.data.transactions) await insertTransaction(db, t);
      for (const i of backup.data.items) await insertItem(db, i);
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
  return { accounts: [], categories: [], transactions: [], items: [] };
}
