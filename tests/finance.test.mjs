import { transactionCategoryTags } from '../src/services/categories/tags.ts';
import {
  parseCategoryAllocations,
  prepareTransactionCategories,
  splitEvenly,
} from '../src/services/accounting/split.ts';
import { categoryReportRows } from '../src/services/accounting/category-report.ts';
import {
  categoryPath,
  categoryTree,
  categoryDescendants,
} from '../src/services/categories/hierarchy.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FinanceRepository, makeAccount } from '../src/database/repository.ts';
import {
  accountBalances,
  filterTransactions,
  parseAmount,
  periodRange,
  statistics,
  totalBalance,
} from '../src/services/accounting/ledger.ts';
import {
  parseBackup,
  validateBackup,
} from '../src/services/backup/validation.ts';
import { csvCell, transactionsCsv } from '../src/services/export/csv.ts';
import { migration1 } from '../src/database/migrations.ts';
import {
  calculateReceipt,
  parseAdjustments,
  parsePercent,
  parseAdjustmentAmount,
} from '../src/services/accounting/receipt.ts';

const instant = '2026-10-10T05:00:00.000Z';
const filters = {
  period: 'month',
  date: instant,
  account: '',
  category: '',
  type: '',
  search: '',
};
let sequence = 0;
function draft(type, patch = {}) {
  const id = `tx-${++sequence}`;
  return {
    id,
    type,
    title: `Giao dịch ${id}`,
    amount: 100,
    source_account_id: type === 'income' ? null : 'cash',
    destination_account_id: type === 'expense' ? null : 'bank',
    category_id:
      type === 'transfer'
        ? null
        : type === 'income'
          ? 'default-income-0'
          : 'default-expense-0',
    note: '',
    occurred_at: instant,
    created_at: instant,
    updated_at: instant,
    items: [],
    ...patch,
  };
}
function connect(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const connection = {
    getAllAsync: async (sql, ...params) =>
      db
        .prepare(sql)
        .all(...params)
        .map((row) => ({ ...row })),
    runAsync: async (sql, ...params) => db.prepare(sql).run(...params),
    execAsync: async (sql) => {
      db.exec(sql);
    },
  };
  const atomic = async (job) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const value = await job(connection);
      db.exec('COMMIT');
      return value;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  return { db, connection, repo: new FinanceRepository(atomic) };
}
async function fixture(t, amount = 1000) {
  const f = connect();
  t.after(() => f.db.close());
  await f.repo.initialize();
  await f.repo.onboard([
    makeAccount('cash', 'Tiền mặt', 'cash', amount),
    makeAccount('bank', 'Ngân hàng', 'bank', 100),
  ]);
  return f;
}
test('category order persists, stays within its type and rejects stale or duplicate lists atomically', async (t) => {
  const { repo } = await fixture(t);
  const before = await repo.snapshot();
  const expense = before.categories.filter((c) => c.type === 'expense');
  const income = before.categories.filter((c) => c.type === 'income');
  const ids = expense.map((c) => c.id).reverse();
  await repo.reorderCategories('expense', ids);
  const after = await repo.snapshot();
  assert.deepEqual(
    after.categories.filter((c) => c.type === 'expense').map((c) => c.id),
    ids,
  );
  assert.deepEqual(
    after.categories.filter((c) => c.type === 'income'),
    income,
  );
  await assert.rejects(repo.reorderCategories('expense', ids.slice(1)));
  await assert.rejects(
    repo.reorderCategories(
      'expense',
      ids.map(() => ids[0]),
    ),
  );
  await assert.rejects(
    repo.reorderCategories('expense', [...ids.slice(1), income[0].id]),
  );
  assert.deepEqual((await repo.snapshot()).categories, after.categories);
  await repo.saveCategory({
    ...expense[0],
    id: 'new-category',
    name: 'Mới',
    sort_order: 0,
  });
  assert.equal(
    (await repo.snapshot()).categories
      .filter((c) => c.type === 'expense')
      .at(-1).id,
    'new-category',
  );
});

test('deleting categories removes unused ones and archives transaction or receipt categories without changing history', async (t) => {
  const { repo } = await fixture(t);
  const category = (await repo.snapshot()).categories[0];
  await repo.saveCategory({ ...category, id: 'unused' });
  await repo.deleteCategory('unused');
  assert.equal(
    (await repo.snapshot()).categories.some((c) => c.id === 'unused'),
    false,
  );
  await repo.saveTransaction(draft('expense'), false);
  const receipt = draft('expense', { category_id: null });
  receipt.items = [
    {
      id: 'receipt-item',
      transaction_id: receipt.id,
      name: 'Mục chi',
      amount: 100,
      category_id: 'default-expense-1',
      sort_order: 0,
    },
  ];
  await repo.saveTransaction(receipt, false);
  const before = await repo.snapshot();
  await repo.deleteCategory('default-expense-0');
  await repo.deleteCategory('default-expense-1');
  const after = await repo.snapshot();
  assert.equal(
    after.categories.find((c) => c.id === 'default-expense-0').is_archived,
    1,
  );
  assert.equal(
    after.categories.find((c) => c.id === 'default-expense-1').is_archived,
    1,
  );
  assert.deepEqual(after.transactions, before.transactions);
  assert.deepEqual(after.items, before.items);
  assert.deepEqual(accountBalances(after), accountBalances(before));
  await assert.rejects(repo.deleteCategory('missing'));
});

test('fresh migrations are repeatable, FK enabled, cash uniqueness and constraints work', async (t) => {
  const { repo, db } = await fixture(t);
  await repo.initialize();
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 6);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  assert.throws(() =>
    db
      .prepare(
        'INSERT INTO accounts SELECT ?,name,type,opening_balance,is_archived,created_at,updated_at FROM accounts WHERE id=?',
      )
      .run('second', 'cash'),
  );
  assert.throws(() =>
    db.prepare('UPDATE accounts SET opening_balance=-1 WHERE id=?').run('cash'),
  );
  assert.throws(() =>
    db
      .prepare('UPDATE accounts SET opening_balance=1.5 WHERE id=?')
      .run('cash'),
  );
  assert.equal((await repo.snapshot()).categories.length, 12);
});
test('opening balances are excluded from income', async (t) => {
  const { repo } = await fixture(t);
  const data = await repo.snapshot();
  assert.equal(statistics(data, filters).income, 0);
  assert.equal(totalBalance(data.accounts, accountBalances(data)), 1100);
});
test('income credits destination only', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTransaction(draft('income'), false);
  assert.deepEqual(accountBalances(await repo.snapshot()), {
    cash: 1000,
    bank: 200,
  });
});
test('expense debits source only', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTransaction(draft('expense'), false);
  assert.deepEqual(accountBalances(await repo.snapshot()), {
    cash: 900,
    bank: 100,
  });
});
test('transfer preserves wealth and is excluded from all reports', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTransaction(draft('transfer'), false);
  const data = await repo.snapshot();
  assert.deepEqual(accountBalances(data), { cash: 900, bank: 200 });
  assert.equal(totalBalance(data.accounts, accountBalances(data)), 1100);
  const report = statistics(data, filters);
  assert.equal(report.income, 0);
  assert.equal(report.expense, 0);
  assert.deepEqual(report.categories, {});
});
test('itemized expense debits once and item categories sum to receipt total', async (t) => {
  const { repo } = await fixture(t);
  const d = draft('expense', { amount: 350, category_id: null });
  d.items = [
    {
      id: 'i-1',
      transaction_id: d.id,
      name: 'Rau',
      amount: 180,
      category_id: 'default-expense-0',
      sort_order: 0,
    },
    {
      id: 'i-2',
      transaction_id: d.id,
      name: 'Nhà',
      amount: 120,
      category_id: 'default-expense-2',
      sort_order: 1,
    },
    {
      id: 'i-3',
      transaction_id: d.id,
      name: 'Nước',
      amount: 50,
      category_id: 'default-expense-0',
      sort_order: 2,
    },
  ];
  await repo.saveTransaction(d, false);
  const data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 650);
  const report = statistics(data, filters);
  assert.equal(report.expense, 350);
  assert.equal(
    Object.values(report.categories).reduce((a, b) => a + b, 0),
    350,
  );
  assert.equal(report.categories['default-expense-0'], 230);
  const food = statistics(data, { ...filters, category: 'default-expense-0' });
  assert.equal(food.expense, 230);
  assert.deepEqual(food.categories, { 'default-expense-0': 230 });
});
test('editing income replaces previous credit', async (t) => {
  const { repo } = await fixture(t);
  const d = draft('income');
  await repo.saveTransaction(d, false);
  await repo.saveTransaction(
    { ...d, amount: 250, destination_account_id: 'cash' },
    true,
  );
  assert.deepEqual(accountBalances(await repo.snapshot()), {
    cash: 1250,
    bank: 100,
  });
});
test('editing expense replaces previous debit', async (t) => {
  const { repo } = await fixture(t);
  const d = draft('expense');
  await repo.saveTransaction(d, false);
  await repo.saveTransaction(
    { ...d, amount: 50, source_account_id: 'bank' },
    true,
  );
  assert.deepEqual(accountBalances(await repo.snapshot()), {
    cash: 1000,
    bank: 50,
  });
});
test('editing transfer recalculates both accounts', async (t) => {
  const { repo } = await fixture(t);
  const d = draft('transfer');
  await repo.saveTransaction(d, false);
  await repo.saveTransaction(
    {
      ...d,
      amount: 50,
      source_account_id: 'bank',
      destination_account_id: 'cash',
    },
    true,
  );
  assert.deepEqual(accountBalances(await repo.snapshot()), {
    cash: 1050,
    bank: 50,
  });
});
test('deleting each transaction type removes its effects and cascades items', async (t) => {
  const { repo, db } = await fixture(t);
  for (const type of ['income', 'expense', 'transfer']) {
    const d = draft(type);
    await repo.saveTransaction(d, false);
    await repo.deleteTransaction(d.id);
    assert.deepEqual(accountBalances(await repo.snapshot()), {
      cash: 1000,
      bank: 100,
    });
  }
  const d = draft('expense', { category_id: null });
  d.items = [
    {
      id: 'i-del',
      transaction_id: d.id,
      name: 'Mục',
      amount: 100,
      category_id: 'default-expense-0',
      sort_order: 0,
    },
  ];
  await repo.saveTransaction(d, false);
  await repo.deleteTransaction(d.id);
  assert.equal(
    db.prepare('SELECT count(*) n FROM transaction_items').get().n,
    0,
  );
});
test('insufficient expense and transfer rejected without partial writes', async (t) => {
  const { repo } = await fixture(t);
  for (const type of ['expense', 'transfer'])
    await assert.rejects(
      repo.saveTransaction(draft(type, { amount: 1001 }), false),
      /Không đủ/,
    );
  assert.equal((await repo.snapshot()).transactions.length, 0);
});
test('same-account transfer rejected', async (t) => {
  const { repo } = await fixture(t);
  await assert.rejects(
    repo.saveTransaction(
      draft('transfer', { destination_account_id: 'cash' }),
      false,
    ),
    /khác nhau/,
  );
});
test('wrong category type, missing references, itemized income and mismatched receipt rejected', async (t) => {
  const { repo } = await fixture(t);
  await assert.rejects(
    repo.saveTransaction(
      draft('expense', { category_id: 'default-income-0' }),
      false,
    ),
    /Danh mục/,
  );
  await assert.rejects(
    repo.saveTransaction(
      draft('income', { destination_account_id: 'missing' }),
      false,
    ),
    /Tài khoản/,
  );
  const d = draft('income');
  d.items = [
    {
      id: 'x',
      transaction_id: d.id,
      name: 'x',
      amount: 100,
      category_id: 'default-expense-0',
      sort_order: 0,
    },
  ];
  await assert.rejects(repo.saveTransaction(d, false), /chế độ phân bổ/);
  d.type = 'expense';
  d.source_account_id = 'cash';
  d.destination_account_id = null;
  d.category_id = null;
  d.amount = 101;
  await assert.rejects(repo.saveTransaction(d, false), /Tổng các mục/);
  d.amount = 100;
  d.items[0].category_id = 'default-income-0';
  await assert.rejects(repo.saveTransaction(d, false), /Danh mục/);
});
test('archived accounts cannot receive or send new transactions; history survives archive', async (t) => {
  const { repo } = await fixture(t);
  const transfer = draft('transfer', {
    source_account_id: 'bank',
    destination_account_id: 'cash',
  });
  await repo.saveTransaction(transfer, false);
  await repo.archiveAccount('bank', true);
  assert.equal((await repo.snapshot()).transactions.length, 1);
  await assert.rejects(repo.saveTransaction(draft('income'), false), /lưu trữ/);
  await assert.rejects(
    repo.saveTransaction(
      draft('transfer', {
        source_account_id: 'bank',
        destination_account_id: 'cash',
        amount: 1,
      }),
      false,
    ),
    /lưu trữ/,
  );
  await repo.archiveAccount('bank', false);
  await repo.saveTransaction(draft('income'), false);
});
test('archived categories remain in reports but cannot be used on new transactions', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTransaction(draft('expense'), false);
  const c = (await repo.snapshot()).categories.find(
    (c) => c.id === 'default-expense-0',
  );
  await repo.saveCategory({ ...c, is_archived: 1 });
  assert.equal(
    statistics(await repo.snapshot(), filters).categories[c.id],
    100,
  );
  await assert.rejects(
    repo.saveTransaction(draft('expense'), false),
    /lưu trữ/,
  );
});
test('backdated expenses rejected even if current balance would cover them', async (t) => {
  const { repo } = await fixture(t, 0);
  await repo.saveTransaction(
    draft('income', {
      destination_account_id: 'cash',
      amount: 500,
      occurred_at: '2026-10-12T05:00:00.000Z',
    }),
    false,
  );
  await assert.rejects(
    repo.saveTransaction(
      draft('expense', { occurred_at: '2026-10-11T05:00:00.000Z' }),
      false,
    ),
    /Không đủ/,
  );
});
test('deleting or reducing earlier income cannot invalidate later expenses', async (t) => {
  const { repo } = await fixture(t, 0);
  const income = draft('income', {
    destination_account_id: 'cash',
    amount: 500,
  });
  await repo.saveTransaction(income, false);
  await repo.saveTransaction(
    draft('expense', { amount: 400, occurred_at: '2026-10-11T05:00:00.000Z' }),
    false,
  );
  await assert.rejects(repo.deleteTransaction(income.id), /Không đủ/);
  await assert.rejects(
    repo.saveTransaction({ ...income, amount: 300 }, true),
    /Không đủ/,
  );
  assert.equal(accountBalances(await repo.snapshot()).cash, 100);
});
test('opening adjustments validate history and never count as income', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTransaction(draft('expense', { amount: 900 }), false);
  await assert.rejects(repo.adjustOpening('cash', 800), /Không đủ/);
  await repo.adjustOpening('cash', 1200);
  const data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 300);
  assert.equal(statistics(data, filters).income, 0);
});
test('account, type, search, category and period filters use stored transactions', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTransaction(
    draft('income', { amount: 200, title: 'Lương', note: 'Công ty' }),
    false,
  );
  await repo.saveTransaction(draft('expense', { amount: 40 }), false);
  await repo.saveTransaction(draft('transfer', { amount: 50 }), false);
  await repo.saveTransaction(
    draft('income', { occurred_at: '2026-11-01T05:00:00.000Z' }),
    false,
  );
  const data = await repo.snapshot();
  assert.equal(statistics(data, filters).income, 200);
  assert.equal(statistics(data, { ...filters, account: 'cash' }).income, 0);
  assert.equal(statistics(data, { ...filters, account: 'bank' }).expense, 0);
  assert.equal(
    filterTransactions(data, { ...filters, account: 'bank', type: 'transfer' })
      .length,
    1,
  );
  assert.equal(
    filterTransactions(data, { ...filters, account: 'cash', type: 'transfer' })
      .length,
    1,
  );
  assert.equal(
    filterTransactions(data, { ...filters, search: 'cÔng TY' }).length,
    1,
  );
  assert.equal(
    filterTransactions(data, { ...filters, category: 'default-expense-0' })
      .length,
    1,
  );
  for (const period of ['day', 'month', 'quarter', 'year']) {
    const [start, end] = periodRange(instant, period);
    assert.ok(start <= new Date(instant) && end > new Date(instant));
  }
  assert.equal(statistics(data, { ...filters, period: 'year' }).income, 300);
});
test('file SQLite persists across close/reopen and does not repeat onboarding', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'monomoney-test-'));
  const path = join(dir, 'ledger.db');
  let f = connect(path);
  try {
    await f.repo.initialize();
    await f.repo.onboard([makeAccount('cash', 'Tiền mặt', 'cash', 10)]);
    await f.repo.saveTransaction(
      draft('income', { destination_account_id: 'cash' }),
      false,
    );
    f.db.close();
    f = connect(path);
    await f.repo.initialize();
    const data = await f.repo.snapshot();
    assert.equal(data.onboarded, true);
    assert.equal(accountBalances(data).cash, 110);
    assert.equal(data.transactions.length, 1);
  } finally {
    f.db.close();
    unlinkSync(path);
    rmdirSync(dir);
  }
});
test('backup roundtrip restores every financial row and onboarding', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTransaction(draft('expense'), false);
  const backup = await repo.backup();
  assert.deepEqual(parseBackup(JSON.stringify(backup)), backup);
  await repo.reset();
  assert.equal((await repo.snapshot()).onboarded, false);
  await repo.restore(backup);
  assert.deepEqual(await repo.snapshot(), backup.data);
});
test('malformed backups rejected before existing data is changed', async (t) => {
  const { repo } = await fixture(t);
  const backup = await repo.backup();
  for (const mutate of [
    (b) => {
      b.version = 99;
    },
    (b) => {
      b.data.accounts[0].opening_balance = -1;
    },
    (b) => {
      b.data.accounts.push(b.data.accounts[0]);
    },
    (b) => {
      b.data.categories[0].type = 'transfer';
    },
    (b) => {
      b.data.accounts = [];
    },
    (b) => {
      b.data.items = [
        {
          id: 'orphan',
          transaction_id: 'missing',
          name: 'x',
          amount: 1,
          category_id: 'default-expense-0',
          sort_order: 0,
        },
      ];
    },
  ]) {
    const bad = structuredClone(backup);
    mutate(bad);
    assert.throws(() => validateBackup(bad));
  }
  assert.throws(() => parseBackup('{bad'));
  assert.throws(() => parseBackup('{}'));
  assert.equal((await repo.snapshot()).accounts.length, 2);
});
test('mid-restore SQL failure rolls back complete restore', async (t) => {
  const { repo, db } = await fixture(t);
  const before = await repo.backup();
  db.exec(
    "CREATE TRIGGER reject_restore BEFORE INSERT ON accounts BEGIN SELECT RAISE(ABORT,'injected failure'); END;",
  );
  await assert.rejects(repo.restore(before), /injected failure/);
  assert.deepEqual(await repo.snapshot(), before.data);
});
test('concurrent overspending is serialized and cannot race', async (t) => {
  const { repo } = await fixture(t);
  const results = await Promise.allSettled([
    repo.saveTransaction(draft('expense', { amount: 800 }), false),
    repo.saveTransaction(draft('expense', { amount: 800 }), false),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(accountBalances(await repo.snapshot()).cash, 200);
});
test('amount parsing rejects fractions, signs, unsafe integers and empty input', () => {
  for (const input of [
    '',
    '-1',
    '1.5',
    '1,000',
    '1.000',
    '1e3',
    '9007199254740992',
    'Infinity',
    '0',
  ])
    assert.throws(() => parseAmount(input));
  assert.equal(parseAmount('0', true), 0);
  assert.equal(parseAmount('100000'), 100000);
});
test('CSV preserves Vietnamese, escapes quotes and prevents spreadsheet formulas', async (t) => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('  @SUM(A1)'), '"\'  @SUM(A1)"');
  assert.equal(csvCell('a"b'), '"a""b"');
  const { repo } = await fixture(t);
  await repo.saveTransaction(draft('expense', { title: 'Ăn uống' }), false);
  assert.match(transactionsCsv(await repo.snapshot()), /Ăn uống/);
});

test('itemized edit replaces rows, switching to simple removes all item effects', async (t) => {
  const { repo } = await fixture(t);
  const d = draft('expense', { amount: 300, category_id: null });
  d.items = [
    {
      id: 'edit-item-1',
      transaction_id: d.id,
      name: 'Một',
      amount: 100,
      category_id: 'default-expense-0',
      sort_order: 0,
    },
    {
      id: 'edit-item-2',
      transaction_id: d.id,
      name: 'Hai',
      amount: 200,
      category_id: 'default-expense-2',
      sort_order: 1,
    },
  ];
  await repo.saveTransaction(d, false);
  await repo.saveTransaction(
    { ...d, amount: 150, items: [{ ...d.items[0], amount: 150 }] },
    true,
  );
  let data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 850);
  assert.equal(data.items.length, 1);
  assert.equal(
    statistics(data, filters).categories['default-expense-2'],
    undefined,
  );
  await repo.saveTransaction(
    { ...d, amount: 50, category_id: 'default-expense-1', items: [] },
    true,
  );
  data = await repo.snapshot();
  assert.equal(data.items.length, 0);
  assert.equal(accountBalances(data).cash, 950);
  assert.deepEqual(statistics(data, filters).categories, {
    'default-expense-1': 50,
  });
});

test('all time filters include start and exclude next boundary in local timezone', async (t) => {
  const { repo } = await fixture(t);
  for (const period of ['day', 'month', 'quarter', 'year']) {
    const [start, end] = periodRange(instant, period);
    const a = draft('income', { occurred_at: start.toISOString(), amount: 1 });
    const b = draft('income', {
      occurred_at: new Date(end.getTime() - 1).toISOString(),
      amount: 2,
    });
    const c = draft('income', { occurred_at: end.toISOString(), amount: 4 });
    await repo.saveTransaction(a, false);
    await repo.saveTransaction(b, false);
    await repo.saveTransaction(c, false);
    const report = statistics(await repo.snapshot(), { ...filters, period });
    assert.equal(report.income, 3);
    await repo.deleteTransaction(a.id);
    await repo.deleteTransaction(b.id);
    await repo.deleteTransaction(c.id);
  }
});

test('invalid edit rolls back old parent and all receipt items; reset is complete', async (t) => {
  const { repo } = await fixture(t);
  const d = draft('expense', { category_id: null });
  d.items = [
    {
      id: 'kept-item',
      transaction_id: d.id,
      name: 'Cũ',
      amount: 100,
      category_id: 'default-expense-0',
      sort_order: 0,
    },
  ];
  await repo.saveTransaction(d, false);
  const before = await repo.snapshot();
  await assert.rejects(
    repo.saveTransaction(
      { ...d, amount: 2000, items: [{ ...d.items[0], amount: 2000 }] },
      true,
    ),
    /Không đủ/,
  );
  assert.deepEqual(await repo.snapshot(), before);
  await repo.reset();
  const data = await repo.snapshot();
  assert.equal(data.onboarded, false);
  assert.equal(data.accounts.length, 0);
  assert.equal(data.transactions.length, 0);
  assert.equal(data.items.length, 0);
  assert.equal(data.categories.length, 12);
});

test('future schema versions and unsafe aggregate balances are rejected', async (t) => {
  const { repo, db } = await fixture(t);
  db.exec('PRAGMA user_version=99');
  await assert.rejects(repo.initialize(), /mới hơn/);
  db.exec('PRAGMA user_version=6');
  const backup = await repo.backup();
  backup.data.accounts[0].opening_balance = Number.MAX_SAFE_INTEGER;
  assert.throws(() => validateBackup(backup), /an toàn/);
  backup.data.accounts[0].opening_balance = 1000;
  backup.data.accounts[0].id = '__proto__';
  assert.throws(() => validateBackup(backup), /ID/);
});

test('custom percentages use original subtotal and respect both signs', () => {
  const a = { id: 'discount', name: 'Chiết khấu', rate_bps: -500 };
  const b = { id: 'tax', name: 'Thuế', rate_bps: -500 };
  const bill = calculateReceipt(
    [{ amount: 600000 }, { amount: 400000 }],
    [a, b],
  );
  assert.equal(bill.subtotal, 1000000);
  assert.equal(bill.total, 900000);
  assert.deepEqual(
    bill.lines.map((l) => l.amount),
    [-50000, -50000],
  );
  assert.deepEqual(bill.itemAmounts, [540000, 360000]);
  assert.equal(
    calculateReceipt([{ amount: 1000000 }], [a, { ...b, rate_bps: 500 }]).total,
    1000000,
  );
});

test('percentage parser is exact and validates decimals, signs and bounds', () => {
  assert.equal(parsePercent('-5'), -500);
  assert.equal(parsePercent('+5'), 500);
  assert.equal(parsePercent('1.01'), 101);
  assert.equal(parsePercent('-0,05'), -5);
  for (const raw of [
    '',
    '--5',
    '5%',
    '1.001',
    '100.01',
    '-101',
    'Infinity',
    '1e2',
  ])
    assert.throws(() => parsePercent(raw));
});

test('VND rounding and proportional remainder allocation preserve every dong', () => {
  const a = { id: 'half', name: 'Giảm giá', rate_bps: -5000 };
  const bill = calculateReceipt([{ amount: 1 }, { amount: 2 }], [a]);
  assert.equal(bill.lines[0].amount, -2);
  assert.equal(bill.total, 1);
  assert.deepEqual(bill.itemAmounts, [0, 1]);
  assert.equal(
    calculateReceipt([{ amount: 1 }], [{ ...a, rate_bps: 5000 }]).total,
    2,
  );
  const max = calculateReceipt(
    [{ amount: Number.MAX_SAFE_INTEGER - 1 }, { amount: 1 }],
    [{ ...a, rate_bps: -1 }],
  );
  assert.equal(
    max.itemAmounts.reduce((a, b) => a + b, 0),
    max.total,
  );
  assert.throws(() => calculateReceipt([{ amount: 1 }], [a]), /Số tiền/);
  assert.throws(
    () =>
      calculateReceipt(
        [{ amount: Number.MAX_SAFE_INTEGER }],
        [{ ...a, rate_bps: 1 }],
      ),
    /an toàn/,
  );
});

function adjustedDraft() {
  const d = draft('expense', {
    amount: 900,
    category_id: null,
    adjustments_json: JSON.stringify([
      { id: 'custom-discount', name: 'Chiết khấu', rate_bps: -500 },
      { id: 'custom-tax', name: 'Thuế', rate_bps: -500 },
    ]),
  });
  d.items = [
    {
      id: 'adj-food',
      transaction_id: d.id,
      name: 'Ăn uống',
      amount: 600,
      category_id: 'default-expense-0',
      sort_order: 0,
    },
    {
      id: 'adj-home',
      transaction_id: d.id,
      name: 'Gia dụng',
      amount: 400,
      category_id: 'default-expense-2',
      sort_order: 1,
    },
  ];
  return d;
}

test('adjusted receipts debit final amount once and keep reports and filters consistent', async (t) => {
  const { repo } = await fixture(t);
  const d = adjustedDraft();
  await repo.saveTransaction(d, false);
  const data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 100);
  const report = statistics(data, filters);
  assert.equal(report.expense, 900);
  assert.deepEqual(report.categories, {
    'default-expense-0': 540,
    'default-expense-2': 360,
  });
  assert.equal(
    statistics(data, {
      ...filters,
      category: 'default-expense-0',
      account: 'cash',
    }).expense,
    540,
  );
  assert.equal(statistics(data, { ...filters, account: 'bank' }).expense, 0);
});

test('editing adjustments, switching to simple and deleting replace all financial effects', async (t) => {
  const { repo } = await fixture(t);
  const d = adjustedDraft();
  await repo.saveTransaction(d, false);
  const edits = {
    ...d,
    amount: 950,
    adjustments_json: JSON.stringify([
      { id: 'discount', name: 'Chiết khấu', rate_bps: -500 },
    ]),
  };
  await repo.saveTransaction(edits, true);
  assert.equal(accountBalances(await repo.snapshot()).cash, 50);
  await repo.saveTransaction(
    {
      ...d,
      amount: 900,
      adjustments_json: '[]',
      category_id: 'default-expense-0',
      items: [],
    },
    true,
  );
  const data = await repo.snapshot();
  assert.equal(data.items.length, 0);
  assert.deepEqual(statistics(data, filters).categories, {
    'default-expense-0': 900,
  });
  await repo.deleteTransaction(d.id);
  assert.equal(accountBalances(await repo.snapshot()).cash, 1000);
});

test('invalid, over-discounted, incorrect and unaffordable adjusted receipts reject atomically', async (t) => {
  const { repo } = await fixture(t);
  const d = adjustedDraft();
  await assert.rejects(
    repo.saveTransaction({ ...d, amount: 1000 }, false),
    /Tổng các mục/,
  );
  await assert.rejects(
    repo.saveTransaction(
      {
        ...d,
        amount: 1100,
        adjustments_json: JSON.stringify([
          { id: 'tax', name: 'Thuế', rate_bps: 1000 },
        ]),
      },
      false,
    ),
    /Không đủ/,
  );
  await assert.rejects(
    repo.saveTransaction(
      {
        ...d,
        adjustments_json: JSON.stringify([
          { id: 'discount', name: 'Giảm giá', rate_bps: -10000 },
        ]),
      },
      false,
    ),
    /Số tiền/,
  );
  await assert.rejects(
    repo.saveTransaction({ ...d, adjustments_json: '{bad' }, false),
    /JSON/,
  );
  await assert.rejects(
    repo.saveTransaction(
      draft('income', { adjustments_json: d.adjustments_json }),
      false,
    ),
    /Chỉ hóa đơn/,
  );
  await assert.rejects(
    repo.saveTransaction(
      draft('expense', { adjustments_json: d.adjustments_json }),
      false,
    ),
    /Chỉ hóa đơn/,
  );
  assert.equal((await repo.snapshot()).transactions.length, 0);
  const duplicate = { id: 'same', name: 'Thuế', rate_bps: 500 };
  assert.throws(
    () => parseAdjustments(JSON.stringify([duplicate, duplicate])),
    /ID/,
  );
});

test('current backup and CSV retain custom fields, and malformed adjustments cannot replace data', async (t) => {
  const { repo } = await fixture(t);
  const d = adjustedDraft();
  await repo.saveTransaction(d, false);
  const backup = await repo.backup();
  assert.equal(backup.version, 7);
  const parsed = parseBackup(JSON.stringify(backup));
  await repo.reset();
  await repo.restore(parsed);
  assert.deepEqual(await repo.snapshot(), backup.data);
  const csv = transactionsCsv(backup.data);
  assert.match(csv, /Chiết khấu/);
  assert.match(csv, /"540"/);
  assert.match(csv, /Điều chỉnh/);
  const bad = structuredClone(backup);
  bad.data.transactions[0].adjustments_json = JSON.stringify([
    { id: 'bad', name: '', rate_bps: -500 },
  ]);
  assert.throws(() => repo.restore(bad));
  assert.deepEqual(await repo.snapshot(), backup.data);
});

test('legacy v1 backups import into schema v2 without changing balances', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTransaction(draft('expense'), false);
  const legacy = await repo.backup();
  legacy.version = 1;
  for (const tx of legacy.data.transactions) delete tx.adjustments_json;
  await repo.reset();
  await repo.restore(parseBackup(JSON.stringify(legacy)));
  const data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 900);
  assert.equal(data.transactions[0].adjustments_json, '[]');
});

test('migration v1 to v2 preserves existing accounts, transactions and onboarding', async (t) => {
  const f = connect();
  t.after(() => f.db.close());
  f.db.exec(migration1);
  f.db
    .prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?)')
    .run('cash', 'Tiền mặt', 'cash', 1000, 0, instant, instant);
  f.db
    .prepare('INSERT INTO categories VALUES (?,?,?,?,?,?,?)')
    .run(
      'old-category',
      'Ăn uống',
      'expense',
      'restaurant-outline',
      '#287D68',
      0,
      0,
    );
  f.db
    .prepare('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(
      'old-tx',
      'expense',
      'Bữa trưa',
      100,
      'cash',
      null,
      'old-category',
      '',
      instant,
      instant,
      instant,
    );
  f.db.exec("INSERT INTO settings VALUES ('onboarded','true')");
  await f.repo.initialize();
  await f.repo.initialize();
  const data = await f.repo.snapshot();
  assert.equal(data.onboarded, true);
  assert.equal(data.transactions[0].id, 'old-tx');
  assert.equal(data.transactions[0].adjustments_json, '[]');
  assert.equal(accountBalances(data).cash, 900);
  assert.equal(f.db.prepare('PRAGMA user_version').get().user_version, 6);
});

test('fixed VND parser accepts signed integers and rejects unsafe or fractional input', () => {
  assert.equal(parseAdjustmentAmount('-20000'), -20000);
  assert.equal(parseAdjustmentAmount('+15000'), 15000);
  assert.equal(parseAdjustmentAmount('0'), 0);
  assert.equal(
    parseAdjustmentAmount(String(Number.MAX_SAFE_INTEGER)),
    Number.MAX_SAFE_INTEGER,
  );
  for (const value of [
    '',
    '1.5',
    '20,000',
    '20.000',
    '1e3',
    '--10',
    '9007199254740992',
    'Infinity',
  ])
    assert.throws(() => parseAdjustmentAmount(value));
});

test('mixed fixed and percentage adjustments use original subtotal and allocate exact VND', () => {
  const bill = calculateReceipt(
    [{ amount: 600 }, { amount: 400 }],
    [
      { id: 'rate', name: 'Chiết khấu', rate_bps: -1000 },
      { id: 'voucher', name: 'Voucher', kind: 'fixed', amount_vnd: -125 },
      { id: 'fee', name: 'Phí', kind: 'fixed', amount_vnd: 25 },
    ],
  );
  assert.equal(bill.total, 800);
  assert.deepEqual(
    bill.lines.map((l) => l.amount),
    [-100, -125, 25],
  );
  assert.deepEqual(bill.itemAmounts, [480, 320]);
  assert.equal(
    calculateReceipt(
      [{ amount: 2 }, { amount: 1 }],
      [{ id: 'coupon', name: 'Giảm', kind: 'fixed', amount_vnd: -1 }],
    ).itemAmounts.reduce((a, b) => a + b, 0),
    2,
  );
});

test('fixed adjustment edits, mode changes and deletion recalculate balances and categories', async (t) => {
  const { repo } = await fixture(t);
  const d = adjustedDraft();
  const lines = [
    { id: 'discount', name: 'Giảm', kind: 'percent', rate_bps: -500 },
    { id: 'coupon', name: 'Voucher', kind: 'fixed', amount_vnd: -125 },
    { id: 'fee', name: 'Phí', kind: 'fixed', amount_vnd: 25 },
  ];
  d.adjustments_json = JSON.stringify(lines);
  d.amount = 850;
  await repo.saveTransaction(d, false);
  let data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 150);
  assert.deepEqual(statistics(data, filters).categories, {
    'default-expense-0': 510,
    'default-expense-2': 340,
  });
  lines[1].amount_vnd = -225;
  await repo.saveTransaction(
    { ...d, amount: 750, adjustments_json: JSON.stringify(lines) },
    true,
  );
  data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 250);
  assert.equal(
    statistics(data, { ...filters, category: 'default-expense-0' }).expense,
    450,
  );
  await repo.saveTransaction(
    {
      ...d,
      amount: 900,
      adjustments_json: JSON.stringify([
        { id: 'coupon', name: 'Voucher', kind: 'percent', rate_bps: -1000 },
      ]),
    },
    true,
  );
  assert.equal(accountBalances(await repo.snapshot()).cash, 100);
  await repo.deleteTransaction(d.id);
  assert.equal(accountBalances(await repo.snapshot()).cash, 1000);
});

test('invalid fixed adjustments and unaffordable mixed receipts are rejected without writes', async (t) => {
  const { repo } = await fixture(t);
  const d = adjustedDraft();
  for (const row of [
    { kind: 'fixed', amount_vnd: 0.5 },
    { kind: 'fixed', amount_vnd: Number.MAX_SAFE_INTEGER + 1 },
    { kind: 'fixed', amount_vnd: 10, rate_bps: 100 },
    { kind: 'percent', amount_vnd: 10, rate_bps: 100 },
    { kind: 'unknown', amount_vnd: 10 },
    { kind: 'fixed' },
  ])
    assert.throws(() =>
      parseAdjustments(JSON.stringify([{ id: 'bad', name: 'Sai', ...row }])),
    );
  await assert.rejects(
    repo.saveTransaction(
      {
        ...d,
        amount: 1,
        adjustments_json: JSON.stringify([
          { id: 'discount', name: 'Giảm', kind: 'fixed', amount_vnd: -1000 },
        ]),
      },
      false,
    ),
    /Số tiền/,
  );
  await assert.rejects(
    repo.saveTransaction(
      {
        ...d,
        amount: 1100,
        adjustments_json: JSON.stringify([
          { id: 'fee', name: 'Phí', kind: 'fixed', amount_vnd: 100 },
        ]),
      },
      false,
    ),
    /Không đủ/,
  );
  await assert.rejects(
    repo.saveTransaction(
      {
        ...d,
        amount: 999,
        adjustments_json: JSON.stringify([
          { id: 'coupon', name: 'Giảm', kind: 'fixed', amount_vnd: -100 },
        ]),
      },
      false,
    ),
    /Tổng các mục/,
  );
  assert.equal((await repo.snapshot()).transactions.length, 0);
});

test('v3 backup preserves mixed adjustments, reads v2, and rejects fixed lines mislabeled v2', async (t) => {
  const { repo } = await fixture(t);
  const d = adjustedDraft();
  d.amount = 850;
  d.adjustments_json = JSON.stringify([
    { id: 'coupon', name: 'Voucher', kind: 'fixed', amount_vnd: -100 },
    { id: 'discount', name: 'Giảm', rate_bps: -500 },
  ]);
  await repo.saveTransaction(d, false);
  const backup = await repo.backup();
  assert.equal(backup.version, 7);
  const parsed = parseBackup(JSON.stringify(backup));
  await repo.reset();
  await repo.restore(parsed);
  assert.deepEqual(await repo.snapshot(), backup.data);
  const csv = transactionsCsv(backup.data);
  assert.match(csv, /"-100"/);
  assert.doesNotMatch(csv, /NaN|undefined/);
  const bad = structuredClone(backup);
  bad.version = 2;
  assert.throws(() => repo.restore(bad), /phiên bản 3/);
  assert.deepEqual(await repo.snapshot(), backup.data);
  await repo.reset();
  const old = adjustedDraft();
  await repo.onboard([
    makeAccount('cash', 'Tiền mặt', 'cash', 1000),
    makeAccount('bank', 'Ngân hàng', 'bank', 100),
  ]);
  await repo.saveTransaction(old, false);
  const v2 = await repo.backup();
  v2.version = 2;
  await repo.reset();
  await repo.restore(parseBackup(JSON.stringify(v2)));
  assert.equal(accountBalances(await repo.snapshot()).cash, 100);
});

test('multi-account and category filters combine with inclusive transaction amount bounds', async (t) => {
  const { repo } = await fixture(t);
  const receipt = adjustedDraft();
  await repo.saveTransaction(receipt, false);
  const income = draft('income', { amount: 200 });
  await repo.saveTransaction(income, false);
  const transfer = draft('transfer', { amount: 50 });
  await repo.saveTransaction(transfer, false);
  const data = await repo.snapshot();
  assert.equal(
    filterTransactions(data, { ...filters, accounts: ['cash', 'bank'] }).length,
    3,
  );
  assert.equal(
    filterTransactions(data, {
      ...filters,
      accounts: ['cash', 'bank'],
      type: 'transfer',
    }).length,
    1,
  );
  assert.equal(
    filterTransactions(data, {
      ...filters,
      accounts: ['bank'],
      categories: ['default-expense-0'],
    }).length,
    0,
  );
  assert.equal(
    filterTransactions(data, {
      ...filters,
      categories: ['default-expense-0', 'default-expense-2'],
      minAmount: 900,
      maxAmount: 900,
    }).length,
    1,
  );
  assert.equal(
    filterTransactions(data, { ...filters, minAmount: 51, maxAmount: 899 })
      .length,
    1,
  );
  assert.equal(
    filterTransactions(data, {
      ...filters,
      accounts: ['cash'],
      categories: ['default-income-0'],
      minAmount: 0,
    }).length,
    0,
  );
  const report = statistics(data, {
    ...filters,
    accounts: ['cash', 'bank'],
    categories: ['default-expense-0', 'default-expense-2'],
    minAmount: 900,
    maxAmount: 900,
  });
  assert.equal(report.expense, 900);
  assert.deepEqual(report.categories, {
    'default-expense-0': 540,
    'default-expense-2': 360,
  });
  assert.equal(
    statistics(data, {
      ...filters,
      categories: ['default-expense-0'],
      minAmount: 900,
      maxAmount: 900,
    }).expense,
    540,
  );
  for (const range of [
    { minAmount: -1 },
    { maxAmount: 1.5 },
    { minAmount: 100, maxAmount: 10 },
  ])
    assert.throws(() => filterTransactions(data, { ...filters, ...range }));
});
test('blank transaction titles persist selected category names or largest receipt category', async (t) => {
  const { repo } = await fixture(t);
  const income = draft('income', { title: '  ' });
  await repo.saveTransaction(income, false);
  const expense = draft('expense', { title: '' });
  await repo.saveTransaction(expense, false);
  const receipt = adjustedDraft();
  receipt.title = '';
  receipt.amount = 90;
  receipt.items[0].amount = 20;
  receipt.items[1].amount = 80;
  await repo.saveTransaction(receipt, false);
  const transfer = draft('transfer', { title: '' });
  await repo.saveTransaction(transfer, false);
  let data = await repo.snapshot();
  const title = (id) => data.transactions.find((tx) => tx.id === id).title;
  assert.equal(title(income.id), 'Lương');
  assert.equal(title(expense.id), 'Ăn uống');
  assert.equal(title(receipt.id), 'Gia dụng');
  assert.equal(title(transfer.id), 'Chuyển nội bộ');
  await repo.saveTransaction(
    { ...expense, title: '', category_id: 'default-expense-2' },
    true,
  );
  data = await repo.snapshot();
  assert.equal(title(expense.id), 'Gia dụng');
  await repo.saveTransaction({ ...income, title: '  Tự đặt tên  ' }, true);
  data = await repo.snapshot();
  assert.equal(title(income.id), 'Tự đặt tên');
});

test('excluded income expense transfer and receipts do not change balances but remain reportable', async (t) => {
  const { repo } = await fixture(t, 0);
  const income = draft('income', {
    exclude_from_balance: 1,
    destination_account_id: 'cash',
    amount: 1000,
  });
  const expense = draft('expense', { exclude_from_balance: 1, amount: 2000 });
  const transfer = draft('transfer', { exclude_from_balance: 1, amount: 5000 });
  const receipt = adjustedDraft();
  receipt.exclude_from_balance = 1;
  for (const d of [income, expense, transfer, receipt])
    await repo.saveTransaction(d, false);
  const data = await repo.snapshot();
  assert.deepEqual(accountBalances(data), { cash: 0, bank: 100 });
  const report = statistics(data, filters);
  assert.equal(report.income, 1000);
  assert.equal(report.expense, 2900);
  assert.equal(report.transactions.length, 4);
  assert.equal(
    Object.values(report.categories).reduce((a, b) => a + b, 0),
    3900,
  );
  await repo.deleteTransaction(income.id);
  assert.deepEqual(accountBalances(await repo.snapshot()), {
    cash: 0,
    bank: 100,
  });
  await assert.rejects(
    repo.saveTransaction(draft('expense', { amount: 1 }), false),
    /Không đủ/,
  );
});
test('editing checkbox replaces financial effect and rejects historical underfunding', async (t) => {
  const { repo } = await fixture(t);
  const expense = draft('expense', { exclude_from_balance: 1, amount: 500 });
  await repo.saveTransaction(expense, false);
  await repo.saveTransaction({ ...expense, exclude_from_balance: 0 }, true);
  assert.equal(accountBalances(await repo.snapshot()).cash, 500);
  await repo.saveTransaction({ ...expense, exclude_from_balance: 1 }, true);
  assert.equal(accountBalances(await repo.snapshot()).cash, 1000);
  await repo.deleteTransaction(expense.id);
  assert.equal(accountBalances(await repo.snapshot()).cash, 1000);
  await repo.adjustOpening('cash', 0);
  const income = draft('income', {
    destination_account_id: 'cash',
    amount: 500,
    occurred_at: '2026-10-10T05:00:00.000Z',
  });
  await repo.saveTransaction(income, false);
  await repo.saveTransaction(
    draft('expense', { amount: 400, occurred_at: '2026-10-11T05:00:00.000Z' }),
    false,
  );
  const before = await repo.snapshot();
  await assert.rejects(
    repo.saveTransaction({ ...income, exclude_from_balance: 1 }, true),
    /Không đủ/,
  );
  assert.deepEqual(await repo.snapshot(), before);
  await assert.rejects(
    repo.saveTransaction(
      draft('transfer', {
        exclude_from_balance: 1,
        destination_account_id: 'cash',
      }),
      false,
    ),
    /khác nhau/,
  );
});
test('exclusion persists in backups and CSV; invalid flags and old versions cannot silently count excluded money', async (t) => {
  const { repo } = await fixture(t);
  const d = draft('expense', { exclude_from_balance: 1, amount: 5000 });
  await repo.saveTransaction(d, false);
  const backup = await repo.backup();
  assert.equal(backup.version, 7);
  await repo.reset();
  await repo.restore(parseBackup(JSON.stringify(backup)));
  assert.deepEqual(await repo.snapshot(), backup.data);
  assert.equal(accountBalances(await repo.snapshot()).cash, 1000);
  const csv = transactionsCsv(backup.data);
  assert.match(csv, /Không tính vào số dư/);
  assert.match(csv, /"Có"/);
  const bad = structuredClone(backup);
  bad.version = 3;
  assert.throws(() => repo.restore(bad), /phiên bản 4/);
  for (const value of [true, 2, -1, '1']) {
    const malformed = structuredClone(backup);
    malformed.data.transactions[0].exclude_from_balance = value;
    assert.throws(() => repo.restore(malformed));
  }
  const legacy = structuredClone(backup);
  legacy.version = 3;
  delete legacy.data.transactions[0].exclude_from_balance;
  legacy.data.transactions[0].amount = 100;
  await repo.restore(legacy);
  const data = await repo.snapshot();
  assert.equal(data.transactions[0].exclude_from_balance, 0);
  assert.equal(accountBalances(data).cash, 900);
});
test('schema v2 upgrades safely with a constrained default inclusion flag', async (t) => {
  const { migration1, migration2 } =
    await import('../src/database/migrations.ts');
  const f = connect();
  t.after(() => f.db.close());
  f.db.exec(migration1);
  f.db.exec(migration2);
  f.db
    .prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?)')
    .run('cash', 'Tiền mặt', 'cash', 1000, 0, instant, instant);
  f.db
    .prepare('INSERT INTO categories VALUES (?,?,?,?,?,?,?)')
    .run(
      'old-cat',
      'Ăn uống',
      'expense',
      'restaurant-outline',
      '#287D68',
      0,
      0,
    );
  f.db
    .prepare(
      'INSERT INTO transactions (id,type,title,amount,source_account_id,destination_account_id,category_id,note,occurred_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      'old-tx',
      'expense',
      'Cũ',
      100,
      'cash',
      null,
      'old-cat',
      '',
      instant,
      instant,
      instant,
    );
  f.db.exec("INSERT INTO settings VALUES ('onboarded','true')");
  await f.repo.initialize();
  await f.repo.initialize();
  const data = await f.repo.snapshot();
  assert.equal(data.transactions[0].exclude_from_balance, 0);
  assert.equal(accountBalances(data).cash, 900);
  assert.equal(f.db.prepare('PRAGMA user_version').get().user_version, 6);
  assert.throws(() =>
    f.db.prepare('UPDATE transactions SET exclude_from_balance=2').run(),
  );
});

test('nested categories persist, reparent safely and reject cycles, missing or mixed-type parents atomically', async (t) => {
  const { repo } = await fixture(t);
  const root = (await repo.snapshot()).categories.find(
    (c) => c.id === 'default-expense-0',
  );
  await repo.saveCategory({
    ...root,
    id: 'child',
    name: 'Ăn ngoài',
    parent_id: root.id,
  });
  await repo.saveCategory({
    ...root,
    id: 'leaf',
    name: 'Cà phê',
    parent_id: 'child',
  });
  let before = await repo.snapshot();
  assert.equal(
    categoryPath(before.categories, 'leaf'),
    `${root.name} › Ăn ngoài › Cà phê`,
  );
  assert.deepEqual(
    [...categoryDescendants(before.categories, [root.id])].sort(),
    [root.id, 'child', 'leaf'].sort(),
  );
  assert.equal(
    categoryTree(before.categories).find((r) => r.category.id === 'leaf').depth,
    2,
  );
  for (const parent_id of ['leaf', root.id, 'missing', 'default-income-0']) {
    await assert.rejects(repo.saveCategory({ ...root, parent_id }));
    assert.deepEqual(await repo.snapshot(), before);
  }
  await repo.saveCategory({
    ...before.categories.find((c) => c.id === 'child'),
    parent_id: null,
  });
  before = await repo.snapshot();
  assert.equal(categoryPath(before.categories, 'leaf'), 'Ăn ngoài › Cà phê');
  await assert.rejects(repo.deleteCategory('child'));
  await repo.saveCategory({
    ...before.categories.find((c) => c.id === 'child'),
    is_archived: 1,
  });
  let after = await repo.snapshot();
  assert.equal(after.categories.find((c) => c.id === 'leaf').is_archived, 1);
  await assert.rejects(
    repo.saveCategory({
      ...after.categories.find((c) => c.id === 'leaf'),
      is_archived: 0,
    }),
  );
  await repo.saveCategory({
    ...after.categories.find((c) => c.id === 'child'),
    is_archived: 0,
  });
  after = await repo.snapshot();
  assert.equal(after.categories.find((c) => c.id === 'child').is_archived, 0);
  assert.equal(after.categories.find((c) => c.id === 'leaf').is_archived, 1);
});

test('parent filters include all descendants and overlapping selections count receipt allocations once', async (t) => {
  const { repo } = await fixture(t);
  const root = (await repo.snapshot()).categories.find(
    (c) => c.id === 'default-expense-0',
  );
  await repo.saveCategory({ ...root, id: 'child', parent_id: root.id });
  await repo.saveCategory({ ...root, id: 'leaf', parent_id: 'child' });
  const simple = draft('expense', { category_id: 'leaf', amount: 100 });
  await repo.saveTransaction(simple, false);
  const receipt = draft('expense', { category_id: null, amount: 300 });
  receipt.items = [
    {
      id: 'nested-item',
      transaction_id: receipt.id,
      name: 'Coffee',
      amount: 200,
      category_id: 'leaf',
      sort_order: 0,
    },
    {
      id: 'other-item',
      transaction_id: receipt.id,
      name: 'Other',
      amount: 100,
      category_id: 'default-expense-2',
      sort_order: 1,
    },
  ];
  await repo.saveTransaction(receipt, false);
  const data = await repo.snapshot();
  const selected = { ...filters, categories: [root.id, 'child', 'leaf'] };
  assert.equal(filterTransactions(data, selected).length, 2);
  const report = statistics(data, selected);
  assert.equal(report.expense, 300);
  assert.deepEqual(report.categories, { leaf: 300 });
  assert.equal(statistics(data, filters).expense, 400);
  const before = accountBalances(data);
  await repo.saveCategory({
    ...data.categories.find((c) => c.id === 'child'),
    parent_id: 'default-expense-2',
  });
  const after = await repo.snapshot();
  assert.deepEqual(accountBalances(after), before);
  assert.equal(statistics(after, { ...filters, category: root.id }).expense, 0);
  assert.equal(
    statistics(after, { ...filters, category: 'default-expense-2' }).expense,
    400,
  );
});

test('v5 backup restores unordered hierarchy, rejects invalid trees before writes, and reads flat legacy backups', async (t) => {
  const { repo } = await fixture(t);
  const root = (await repo.snapshot()).categories.find(
    (c) => c.id === 'default-expense-0',
  );
  await repo.saveCategory({ ...root, id: 'child', parent_id: root.id });
  await repo.saveCategory({ ...root, id: 'leaf', parent_id: 'child' });
  await repo.saveTransaction(draft('expense', { category_id: 'leaf' }), false);
  const original = await repo.snapshot();
  const backup = await repo.backup();
  backup.data.categories.reverse();
  await repo.restore(backup);
  assert.deepEqual(await repo.snapshot(), original);
  assert.ok(
    transactionsCsv(original).includes(
      categoryPath(original.categories, 'leaf'),
    ),
  );
  for (const parent_id of ['leaf', 'missing', 'default-income-0']) {
    const bad = structuredClone(backup);
    bad.data.categories.find((c) => c.id === root.id).parent_id = parent_id;
    await assert.rejects(async () => repo.restore(bad));
    assert.deepEqual(await repo.snapshot(), original);
  }
  const old = structuredClone(backup);
  old.version = 4;
  await assert.rejects(async () => repo.restore(old));
  for (const c of old.data.categories) delete c.parent_id;
  await repo.restore(old);
  assert.ok(
    (await repo.snapshot()).categories.every((c) => c.parent_id === null),
  );
});

test('schema v3 migrates flat categories without changing stored transactions', async (t) => {
  const { migration2, migration3 } =
    await import('../src/database/migrations.ts');
  const f = connect();
  t.after(() => f.db.close());
  f.db.exec(migration1 + migration2 + migration3);
  f.db
    .prepare('INSERT INTO categories VALUES (?,?,?,?,?,?,?)')
    .run('legacy', 'Cũ', 'expense', 'basket-outline', '#287D68', 0, 0);
  await f.repo.initialize();
  const data = await f.repo.snapshot();
  assert.equal(data.categories.length, 1);
  assert.equal(data.categories[0].id, 'legacy');
  assert.equal(data.categories[0].parent_id, null);
  assert.equal(f.db.prepare('PRAGMA user_version').get().user_version, 6);
  await f.repo.initialize();
  assert.deepEqual(await f.repo.snapshot(), data);
});

test('hierarchical reports drill down without double counting direct parent entries', async (t) => {
  const { repo } = await fixture(t);
  const root = (await repo.snapshot()).categories.find(
    (c) => c.id === 'default-expense-0',
  );
  await repo.saveCategory({ ...root, id: 'child', parent_id: root.id });
  await repo.saveCategory({ ...root, id: 'leaf', parent_id: 'child' });
  const data = await repo.snapshot();
  const amounts = {
    [root.id]: 50,
    child: 100,
    leaf: 200,
    'default-expense-2': 25,
  };
  const top = categoryReportRows(data.categories, amounts, null);
  assert.equal(top.find((r) => r.id === root.id).amount, 350);
  assert.equal(
    top.reduce((sum, r) => sum + r.amount, 0),
    375,
  );
  const level = categoryReportRows(data.categories, amounts, root.id);
  assert.equal(level.find((r) => r.id === 'child').amount, 300);
  assert.equal(level.find((r) => r.id === root.id).amount, 50);
  assert.equal(
    level.reduce((sum, r) => sum + r.amount, 0),
    350,
  );
  assert.equal(
    categoryReportRows(data.categories, amounts, 'child').reduce(
      (sum, r) => sum + r.amount,
      0,
    ),
    300,
  );
  const collapsed = categoryTree(data.categories, new Set([root.id]));
  assert.ok(collapsed.some((r) => r.category.id === root.id));
  assert.ok(
    !collapsed.some(
      (r) => r.category.id === 'child' || r.category.id === 'leaf',
    ),
  );
});

test('nested categories survive reset and restoring default categories with archived custom ancestors', async (t) => {
  const { repo } = await fixture(t);
  const root = (await repo.snapshot()).categories.find(
    (c) => c.id === 'default-expense-0',
  );
  await repo.saveCategory({ ...root, id: 'custom-root', parent_id: null });
  await repo.saveCategory({ ...root, parent_id: 'custom-root' });
  await repo.saveCategory({ ...root, id: 'child', parent_id: root.id });
  await repo.saveCategory({
    ...root,
    id: 'custom-root',
    parent_id: null,
    is_archived: 1,
  });
  await repo.restoreDefaults();
  const restored = await repo.snapshot();
  assert.equal(
    restored.categories.find((c) => c.id === root.id).parent_id,
    null,
  );
  assert.equal(
    restored.categories.find((c) => c.id === root.id).is_archived,
    0,
  );
  assert.equal(
    restored.categories.find((c) => c.id === 'child').parent_id,
    root.id,
  );
  await repo.reset();
  const cleared = await repo.snapshot();
  assert.equal(cleared.categories.length, 12);
  assert.ok(cleared.categories.every((c) => c.parent_id === null));
});

function splitDraft(type, patch = {}) {
  const tx = draft(type, {
    amount: 301,
    title: '',
    category_split: 1,
    category_id: type === 'income' ? 'default-income-0' : null,
    ...patch,
  });
  tx.items = [
    {
      id: `${tx.id}-part-0`,
      transaction_id: tx.id,
      name: 'Phần 1',
      amount: 101,
      category_id: `default-${type}-0`,
      sort_order: 0,
    },
    {
      id: `${tx.id}-part-1`,
      transaction_id: tx.id,
      name: 'Phần 2',
      amount: 200,
      category_id: `default-${type}-1`,
      sort_order: 1,
    },
  ];
  return tx;
}

test('multi-category expense and income affect balances once and report their exact allocations', async (t) => {
  const { repo } = await fixture(t);
  const expense = splitDraft('expense');
  const income = splitDraft('income');
  await repo.saveTransaction(expense, false);
  await repo.saveTransaction(income, false);
  const data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 699);
  assert.equal(accountBalances(data).bank, 401);
  assert.equal(
    data.transactions.find((tx) => tx.id === expense.id).category_split,
    1,
  );
  assert.equal(
    data.transactions.find((tx) => tx.id === income.id).title,
    data.categories.find((c) => c.id === 'default-income-1').name,
  );
  const report = statistics(data, filters);
  assert.equal(report.income, 301);
  assert.equal(report.expense, 301);
  assert.deepEqual(report.categories, {
    'default-expense-0': 101,
    'default-expense-1': 200,
    'default-income-0': 101,
    'default-income-1': 200,
  });
  assert.equal(
    statistics(data, { ...filters, category: 'default-income-1' }).income,
    200,
  );
  assert.equal(
    statistics(data, {
      ...filters,
      categories: ['default-expense-0', 'default-expense-1'],
    }).expense,
    301,
  );
  assert.equal(
    filterTransactions(data, { ...filters, category: 'default-income-1' })
      .length,
    1,
  );
  assert.ok(transactionsCsv(data).includes('Phân bổ danh mục'));
});

test('split amount edits, changing to one category and deletion replace all old financial effects', async (t) => {
  const { repo } = await fixture(t);
  const expense = splitDraft('expense');
  await repo.saveTransaction(expense, false);
  const income = splitDraft('income');
  await repo.saveTransaction(income, false);
  income.amount = 400;
  income.items[0].amount = 200;
  await repo.saveTransaction(income, true);
  assert.equal(accountBalances(await repo.snapshot()).bank, 500);
  const single = {
    ...income,
    category_split: 0,
    items: [],
    amount: 150,
    category_id: 'default-income-2',
  };
  await repo.saveTransaction(single, true);
  let data = await repo.snapshot();
  assert.equal(accountBalances(data).bank, 250);
  assert.ok(!data.items.some((i) => i.transaction_id === income.id));
  assert.deepEqual(
    statistics(data, { ...filters, type: 'income' }).categories,
    { 'default-income-2': 150 },
  );
  await repo.deleteTransaction(expense.id);
  data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 1000);
  assert.ok(!data.items.some((i) => i.transaction_id === expense.id));
});

test('invalid category splits roll back: wrong totals, duplicates, types, flags, adjustments and missing allocations', async (t) => {
  const { repo } = await fixture(t);
  const original = await repo.snapshot();
  const mutations = [
    (d) => {
      d.amount = 300;
    },
    (d) => {
      d.items[1].category_id = d.items[0].category_id;
    },
    (d) => {
      d.items[1].category_id = 'default-income-0';
    },
    (d) => {
      d.items[1].category_id = 'missing';
    },
    (d) => {
      d.items[0].amount = 0;
    },
    (d) => {
      d.items[0].amount = -1;
    },
    (d) => {
      d.items[0].amount = 1.5;
    },
    (d) => {
      d.category_split = true;
    },
    (d) => {
      d.items.pop();
    },
    (d) => {
      d.items = [];
    },
    (d) => {
      d.type = 'transfer';
    },
    (d) => {
      d.adjustments_json =
        '[{"id":"fee","name":"Fee","kind":"fixed","amount_vnd":10}]';
      d.amount += 10;
    },
  ];
  for (const mutate of mutations) {
    const bad = splitDraft('expense');
    mutate(bad);
    await assert.rejects(repo.saveTransaction(bad, false));
    assert.deepEqual(await repo.snapshot(), original);
  }
  const income = splitDraft('income');
  income.category_id = 'default-income-1';
  await assert.rejects(repo.saveTransaction(income, false));
  assert.deepEqual(await repo.snapshot(), original);
});

test('category split prevents overspending and preserves excluded transactions and archived history', async (t) => {
  const { repo } = await fixture(t, 100);
  const tx = splitDraft('expense');
  await assert.rejects(repo.saveTransaction(tx, false), /Không đủ/);
  tx.exclude_from_balance = 1;
  await repo.saveTransaction(tx, false);
  let data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 100);
  assert.equal(statistics(data, filters).expense, 301);
  const category = data.categories.find((c) => c.id === 'default-expense-1');
  await repo.saveCategory({ ...category, is_archived: 1 });
  data = await repo.snapshot();
  assert.equal(statistics(data, filters).categories[category.id], 200);
  await assert.rejects(
    repo.saveTransaction(
      splitDraft('expense', { exclude_from_balance: 1 }),
      false,
    ),
    /lưu trữ/,
  );
  await assert.rejects(
    repo.saveTransaction({ ...tx, exclude_from_balance: 0 }, true),
  );
  assert.deepEqual(await repo.snapshot(), data);
});

test('split draft parsing validates totals and active categories; equal division retains every dong', async (t) => {
  const { repo } = await fixture(t);
  const { categories } = await repo.snapshot();
  assert.deepEqual(splitEvenly(100, 3), [34, 33, 33]);
  assert.deepEqual(splitEvenly(2, 2), [1, 1]);
  const large = splitEvenly(Number.MAX_SAFE_INTEGER, 3);
  assert.equal(
    large.reduce((sum, n) => sum + n, 0),
    Number.MAX_SAFE_INTEGER,
  );
  for (const args of [
    [1, 2],
    [0, 2],
    [100, 1],
    [100, 0],
    [100, 2.5],
  ])
    assert.throws(() => splitEvenly(...args));
  const rows = [
    { id: 'a', category: 'default-expense-0', amount: '40' },
    { id: 'b', category: 'default-expense-1', amount: '60' },
  ];
  const parsed = parseCategoryAllocations(
    'tx',
    'expense',
    '100',
    rows,
    categories,
  );
  assert.equal(
    parsed[0].name,
    categories.find((c) => c.id === rows[0].category).name,
  );
  assert.equal(parsed[1].sort_order, 1);
  assert.throws(() =>
    parseCategoryAllocations('tx', 'expense', '99', rows, categories),
  );
  assert.throws(() =>
    parseCategoryAllocations('tx', 'income', '100', rows, categories),
  );
  assert.throws(() =>
    parseCategoryAllocations('tx', 'expense', '100', [rows[0]], categories),
  );
  assert.throws(() =>
    parseCategoryAllocations(
      'tx',
      'expense',
      '100',
      [rows[0], rows[0]],
      categories,
    ),
  );
  assert.throws(() =>
    parseCategoryAllocations(
      'tx',
      'expense',
      '100',
      rows.map((r) => ({ ...r, amount: '' })),
      categories,
    ),
  );
});

test('split backup roundtrip retains allocations and rejects misleading legacy versions before replacing data', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTransaction(splitDraft('income'), false);
  await repo.saveTransaction(splitDraft('expense'), false);
  const original = await repo.snapshot();
  const backup = await repo.backup();
  assert.equal(backup.version, 7);
  await repo.restore(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(await repo.snapshot(), original);
  const old = structuredClone(backup);
  old.version = 5;
  await assert.rejects(async () => repo.restore(old));
  assert.deepEqual(await repo.snapshot(), original);
  const legacy = structuredClone(backup);
  legacy.data.transactions = [];
  legacy.data.items = [];
  legacy.version = 5;
  await repo.restore(legacy);
  assert.equal((await repo.snapshot()).transactions.length, 0);
});

test('migration v4 preserves old transactions with a default single-category flag', async (t) => {
  const { migration2, migration3, migration4 } =
    await import('../src/database/migrations.ts');
  const f = connect();
  t.after(() => f.db.close());
  f.db.exec(migration1 + migration2 + migration3 + migration4);
  f.db
    .prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?)')
    .run('cash', 'Cash', 'cash', 1000, 0, instant, instant);
  f.db
    .prepare(
      'INSERT INTO categories (id,name,type,icon,color,sort_order,is_archived) VALUES (?,?,?,?,?,?,?)',
    )
    .run('legacy', 'Old', 'expense', 'basket-outline', '#287D68', 0, 0);
  f.db
    .prepare(
      'INSERT INTO transactions (id,type,title,amount,source_account_id,destination_account_id,category_id,note,occurred_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      'old-tx',
      'expense',
      'Old expense',
      25,
      'cash',
      null,
      'legacy',
      '',
      instant,
      instant,
      instant,
    );
  f.db.prepare("INSERT INTO settings VALUES ('onboarded','true')").run();
  await f.repo.initialize();
  const data = await f.repo.snapshot();
  assert.equal(data.transactions[0].category_split, 0);
  assert.equal(data.transactions[0].amount, 25);
  assert.equal(accountBalances(data).cash, 975);
  await f.repo.initialize();
  assert.deepEqual(await f.repo.snapshot(), data);
});

test('default category selection saves whole-transaction labels without creating amount allocations', async (t) => {
  const { repo } = await fixture(t);
  const categories = (await repo.snapshot()).categories;
  const selections = [
    { id: 'default-pick-1', category: 'default-expense-0', amount: '' },
    { id: 'default-pick-2', category: 'default-expense-1', amount: '' },
    { id: 'default-pick-3', category: 'default-expense-2', amount: '' },
  ];
  const tx = draft('expense', { amount: 100 });
  const multiple = prepareTransactionCategories(
    tx.id,
    'expense',
    '100',
    selections,
    categories,
  );
  assert.deepEqual(multiple.items, []);
  assert.deepEqual(
    transactionCategoryTags(multiple),
    selections.map((r) => r.category),
  );
  await repo.saveTransaction({ ...tx, ...multiple }, false);
  let data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 900);
  assert.equal(statistics(data, filters).expense, 100);
  const single = prepareTransactionCategories(
    tx.id,
    'expense',
    '100',
    [selections[1]],
    categories,
  );
  assert.equal(single.category_split, 0);
  assert.equal(single.category_id, 'default-expense-1');
  assert.deepEqual(single.items, []);
  await repo.saveTransaction({ ...tx, ...single }, true);
  data = await repo.snapshot();
  assert.equal(data.items.length, 0);
  assert.equal(accountBalances(data).cash, 900);
  assert.deepEqual(statistics(data, filters).categories, {
    'default-expense-1': 100,
  });
});

test('saving a historical split as labels keeps its total and balance while attaching the full amount to each label', async (t) => {
  const { repo } = await fixture(t);
  const tx = splitDraft('income');
  await repo.saveTransaction(tx, false);
  const before = await repo.snapshot();
  const selections = before.items
    .filter((i) => i.transaction_id === tx.id)
    .map((i) => ({
      id: i.id,
      category: i.category_id,
      amount: String(i.amount),
    }));
  const labeled = prepareTransactionCategories(
    tx.id,
    'income',
    '301',
    selections,
    before.categories,
  );
  assert.deepEqual(labeled.items, []);
  await repo.saveTransaction({ ...tx, ...labeled, note: 'Labels' }, true);
  let after = await repo.snapshot();
  assert.deepEqual(accountBalances(after), accountBalances(before));
  assert.equal(statistics(after, filters).income, 301);
  assert.deepEqual(statistics(after, filters).categories, {
    'default-income-0': 301,
    'default-income-1': 301,
  });
  const changed = prepareTransactionCategories(
    tx.id,
    'income',
    '401',
    selections,
    before.categories,
  );
  await repo.saveTransaction({ ...tx, ...changed, amount: 401 }, true);
  after = await repo.snapshot();
  assert.equal(
    statistics(after, { ...filters, category: 'default-income-1' }).income,
    401,
  );
  assert.equal(accountBalances(after).bank, 501);
});

test('default category selection rejects empty, duplicate, archived or wrong-type categories without changing data', async (t) => {
  const { repo } = await fixture(t);
  const before = await repo.snapshot();
  const row = { id: 'selection', category: 'default-expense-0', amount: '' };
  assert.throws(() =>
    prepareTransactionCategories('tx', 'expense', '100', [], before.categories),
  );
  assert.throws(() =>
    prepareTransactionCategories(
      'tx',
      'expense',
      '100',
      [row, row],
      before.categories,
    ),
  );
  assert.throws(() =>
    prepareTransactionCategories(
      'tx',
      'income',
      '100',
      [row],
      before.categories,
    ),
  );
  assert.throws(() =>
    prepareTransactionCategories('tx', 'expense', '', [row], before.categories),
  );
  assert.throws(() =>
    prepareTransactionCategories(
      'tx',
      'expense',
      '100',
      [row],
      before.categories.map((c) =>
        c.id === row.category ? { ...c, is_archived: 1 } : c,
      ),
    ),
  );
  assert.deepEqual(await repo.snapshot(), before);
});

test('500k clothes on Shopee belongs fully to both labels and combined or ancestor filters count it only once', async (t) => {
  const { repo } = await fixture(t, 600000);
  const sample = (await repo.snapshot()).categories.find(
    (c) => c.id === 'default-expense-0',
  );
  for (const c of [
    { id: 'fashion', name: 'Thời trang', parent_id: null },
    { id: 'clothes', name: 'Quần áo', parent_id: 'fashion' },
    { id: 'shopping', name: 'Mua sắm', parent_id: null },
    { id: 'shopee', name: 'Shopee', parent_id: 'shopping' },
  ])
    await repo.saveCategory({ ...sample, ...c });
  const tx = draft('expense', { amount: 500000 });
  const categories = (await repo.snapshot()).categories;
  const labels = prepareTransactionCategories(
    tx.id,
    'expense',
    '500000',
    [
      { id: 'label-1', category: 'clothes', amount: '' },
      { id: 'label-2', category: 'shopee', amount: '' },
    ],
    categories,
  );
  await repo.saveTransaction({ ...tx, ...labels }, false);
  const data = await repo.snapshot();
  assert.equal(data.items.length, 0);
  assert.equal(accountBalances(data).cash, 100000);
  const report = statistics(data, filters);
  assert.equal(report.expense, 500000);
  assert.equal(report.categories.clothes, 500000);
  assert.equal(report.categories.shopee, 500000);
  for (const selected of [
    ['clothes'],
    ['shopee'],
    ['fashion'],
    ['shopping'],
    ['clothes', 'shopee'],
    ['fashion', 'clothes', 'shopping', 'shopee'],
  ]) {
    const f = { ...filters, categories: selected };
    assert.equal(filterTransactions(data, f).length, 1);
    assert.equal(statistics(data, f).expense, 500000);
  }
  const rows = categoryReportRows(
    categories,
    report.categories,
    null,
    report.categoryTotals,
  );
  assert.equal(rows.find((r) => r.id === 'fashion').amount, 500000);
  assert.equal(rows.find((r) => r.id === 'shopping').amount, 500000);
  assert.equal(report.hasCategoryTags, true);
  const csv = transactionsCsv(data);
  assert.ok(csv.includes('Thời trang › Quần áo | Mua sắm › Shopee'));
  assert.equal(csv.split('\r\n').length, 2);
});

test('multiple labels within one ancestor count that parent once and support amounts smaller than label count', async (t) => {
  const { repo } = await fixture(t);
  const categories = (await repo.snapshot()).categories;
  const root = categories.find((c) => c.id === 'default-expense-0');
  await repo.saveCategory({ ...root, id: 'leaf-one', parent_id: root.id });
  await repo.saveCategory({ ...root, id: 'leaf-two', parent_id: root.id });
  const tx = draft('expense', { amount: 1 });
  const all = (await repo.snapshot()).categories;
  const labeled = prepareTransactionCategories(
    tx.id,
    'expense',
    '1',
    [root.id, 'leaf-one', 'leaf-two'].map((category, i) => ({
      id: `label-${i}`,
      category,
      amount: '',
    })),
    all,
  );
  await repo.saveTransaction({ ...tx, ...labeled }, false);
  const data = await repo.snapshot();
  const report = statistics(data, filters);
  assert.equal(report.categoryTotals[root.id], 1);
  assert.equal(report.categories[root.id], 1);
  assert.equal(report.categories['leaf-one'], 1);
  const top = categoryReportRows(
    all,
    report.categories,
    null,
    report.categoryTotals,
  );
  assert.equal(top.find((r) => r.id === root.id).amount, 1);
  assert.equal(statistics(data, { ...filters, category: root.id }).expense, 1);
});

test('tagged category deletion archives non-primary tags, and malformed tag backups cannot overwrite data', async (t) => {
  const { repo } = await fixture(t);
  const tx = draft('expense', { amount: 100 });
  const categories = (await repo.snapshot()).categories;
  await repo.saveTransaction(
    {
      ...tx,
      ...prepareTransactionCategories(
        tx.id,
        'expense',
        '100',
        [0, 1].map((i) => ({
          id: `tag-${i}`,
          category: `default-expense-${i}`,
          amount: '',
        })),
        categories,
      ),
    },
    false,
  );
  await repo.deleteCategory('default-expense-1');
  const before = await repo.snapshot();
  assert.equal(
    before.categories.find((c) => c.id === 'default-expense-1').is_archived,
    1,
  );
  assert.equal(
    statistics(before, { ...filters, category: 'default-expense-1' }).expense,
    100,
  );
  const backup = await repo.backup();
  for (const badTags of [
    '{',
    '{}',
    '[1]',
    '["default-expense-0","default-expense-0"]',
    '["missing"]',
    '["default-income-0"]',
  ]) {
    const bad = structuredClone(backup);
    bad.data.transactions[0].category_ids_json = badTags;
    await assert.rejects(async () => repo.restore(bad));
    assert.deepEqual(await repo.snapshot(), before);
  }
  const legacy = structuredClone(backup);
  legacy.version = 6;
  await assert.rejects(async () => repo.restore(legacy));
  await repo.restore(backup);
  assert.deepEqual(await repo.snapshot(), before);
  await repo.deleteTransaction(tx.id);
  assert.equal(accountBalances(await repo.snapshot()).cash, 1000);
});

test('v5 database and v6 backups gain label semantics without deleting original split details or changing balances', async (t) => {
  const { migration2, migration3, migration4, migration5 } =
    await import('../src/database/migrations.ts');
  const f = connect();
  t.after(() => f.db.close());
  f.db.exec(migration1 + migration2 + migration3 + migration4 + migration5);
  f.db
    .prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?)')
    .run('cash', 'Cash', 'cash', 1000, 0, instant, instant);
  for (const id of ['clothes', 'shopee'])
    f.db
      .prepare(
        'INSERT INTO categories (id,name,type,icon,color,sort_order,is_archived) VALUES (?,?,?,?,?,?,?)',
      )
      .run(id, id, 'expense', 'basket-outline', '#287D68', 0, 0);
  f.db
    .prepare(
      'INSERT INTO transactions (id,type,title,amount,source_account_id,destination_account_id,category_id,note,occurred_at,created_at,updated_at,category_split) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      'old-split',
      'expense',
      'Clothes on Shopee',
      500,
      'cash',
      null,
      null,
      '',
      instant,
      instant,
      instant,
      1,
    );
  f.db
    .prepare('INSERT INTO transaction_items VALUES (?,?,?,?,?,?)')
    .run('old-a', 'old-split', 'Clothes', 200, 'clothes', 0);
  f.db
    .prepare('INSERT INTO transaction_items VALUES (?,?,?,?,?,?)')
    .run('old-b', 'old-split', 'Shopee', 300, 'shopee', 1);
  f.db.prepare("INSERT INTO settings VALUES ('onboarded','true')").run();
  await f.repo.initialize();
  const after = await f.repo.snapshot();
  assert.equal(accountBalances(after).cash, 500);
  assert.deepEqual(
    after.items.map((i) => i.amount),
    [200, 300],
  );
  assert.deepEqual(transactionCategoryTags(after.transactions[0]), [
    'clothes',
    'shopee',
  ]);
  assert.equal(
    statistics(after, { ...filters, category: 'shopee' }).expense,
    500,
  );
  const backup = await f.repo.backup();
  const old = structuredClone(backup);
  old.version = 6;
  delete old.data.transactions[0].category_ids_json;
  await f.repo.restore(parseBackup(JSON.stringify(old)));
  assert.deepEqual(await f.repo.snapshot(), after);
  await f.repo.initialize();
  assert.deepEqual(await f.repo.snapshot(), after);
});
