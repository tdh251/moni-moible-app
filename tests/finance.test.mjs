import {
  loanOutstanding,
  totalLoanOutstanding,
  parseLoanCosts,
  totalLoanCosts,
  loanTotalAmount,
  loanBalances,
  loanPaymentTotal,
  loanMonthlyPayment,
} from '../src/services/loans.ts';
import {
  loanReminderDates,
  planLoanReminders,
} from '../src/services/loan-reminders/plan.ts';

import {
  categoryDropPosition,
  reorderCategoryIds,
} from '../src/features/categories/reorder.ts';
import { tagNameKey, transactionTagIds } from '../src/services/tags.ts';
import { transactionCategoryTags } from '../src/services/categories/tags.ts';
import {
  parseCategoryAllocations,
  prepareTransactionCategories,
  splitEvenly,
} from '../src/services/accounting/split.ts';
import { categoryReportRows } from '../src/services/accounting/category-report.ts';
import { categoryPath } from '../src/services/categories/hierarchy.ts';
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
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 19);
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
  db.exec('PRAGMA user_version=16');
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
  assert.equal(backup.version, 19);
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
  assert.equal(f.db.prepare('PRAGMA user_version').get().user_version, 19);
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
  assert.equal(backup.version, 19);
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
test('blank titles default to Trống for income, expense, receipt, transfer and edits', async (t) => {
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
  assert.equal(title(income.id), 'Trống');
  assert.equal(title(expense.id), 'Trống');
  assert.equal(title(receipt.id), 'Trống');
  assert.equal(title(transfer.id), 'Trống');
  await repo.saveTransaction(
    { ...expense, title: '', category_id: 'default-expense-2' },
    true,
  );
  data = await repo.snapshot();
  assert.equal(title(expense.id), 'Trống');
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
  assert.equal(backup.version, 19);
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
  assert.equal(f.db.prepare('PRAGMA user_version').get().user_version, 19);
  assert.throws(() =>
    f.db.prepare('UPDATE transactions SET exclude_from_balance=2').run(),
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
  assert.equal(f.db.prepare('PRAGMA user_version').get().user_version, 19);
  await f.repo.initialize();
  assert.deepEqual(await f.repo.snapshot(), data);
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

test('flat categories reject nested writes and archive independently while preserving transaction labels', async (t) => {
  const { repo, db } = await fixture(t);
  const category = (await repo.snapshot()).categories[0];
  await repo.saveCategory({ ...category, id: 'independent', parent_id: null });
  const before = await repo.snapshot();
  await assert.rejects(
    repo.saveCategory({ ...category, parent_id: 'independent' }),
    /một cấp/,
  );
  await assert.rejects(
    repo.saveCategory({ ...category, id: 'nested', parent_id: category.id }),
    /một cấp/,
  );
  assert.throws(
    () =>
      db
        .prepare('UPDATE categories SET parent_id=? WHERE id=?')
        .run(category.id, 'independent'),
    /single level/,
  );
  assert.deepEqual(await repo.snapshot(), before);
  await repo.saveCategory({ ...category, is_archived: 1 });
  const after = await repo.snapshot();
  assert.equal(
    after.categories.find((c) => c.id === 'independent').is_archived,
    0,
  );
  await repo.deleteCategory('independent');
  assert.ok(
    !(await repo.snapshot()).categories.some((c) => c.id === 'independent'),
  );
});

test('hierarchical legacy backups restore as independent categories without changing IDs, transactions or amounts', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTransaction(draft('expense'), false);
  const backup = await repo.backup();
  const parent = backup.data.categories.find(
    (c) => c.id === 'default-expense-0',
  );
  const child = backup.data.categories.find(
    (c) => c.id === 'default-expense-1',
  );
  const leaf = backup.data.categories.find((c) => c.id === 'default-expense-2');
  child.parent_id = parent.id;
  leaf.parent_id = child.id;
  leaf.name = child.name; // Preserve duplicate names as distinct categories.
  const bad = structuredClone(backup);
  bad.data.categories.find((c) => c.id === parent.id).parent_id = leaf.id;
  const before = await repo.snapshot();
  await assert.rejects(async () => repo.restore(bad));
  assert.deepEqual(await repo.snapshot(), before);
  const parsed = parseBackup(JSON.stringify(backup));
  assert.ok(parsed.data.categories.every((c) => c.parent_id === null));
  await repo.restore(parsed);
  const after = await repo.snapshot();
  assert.equal(after.categories.length, backup.data.categories.length);
  assert.deepEqual(after.transactions, backup.data.transactions);
  assert.deepEqual(accountBalances(after), accountBalances(before));
  for (const c of after.categories)
    assert.deepEqual(c, {
      ...backup.data.categories.find((old) => old.id === c.id),
      parent_id: null,
    });
  assert.equal(categoryPath(after.categories, leaf.id), leaf.name);
  await repo.restore(await repo.backup());
  assert.deepEqual(await repo.snapshot(), after);
});

test('schema v6 flattens every level without removing categories, receipt rows or tags and migration is repeatable', async (t) => {
  const { migration2, migration3, migration4, migration5, migration6 } =
    await import('../src/database/migrations.ts');
  const f = connect();
  t.after(() => f.db.close());
  f.db.exec(
    migration1 + migration2 + migration3 + migration4 + migration5 + migration6,
  );
  f.db
    .prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?)')
    .run('cash', 'Cash', 'cash', 1000, 0, instant, instant);
  for (const [id, parent, archived] of [
    ['root', null, 0],
    ['child', 'root', 0],
    ['leaf', 'child', 1],
  ]) {
    f.db
      .prepare('INSERT INTO categories VALUES (?,?,?,?,?,?,?,?)')
      .run(
        id,
        'Same name',
        'expense',
        'shirt-outline',
        '#2563EB',
        0,
        archived,
        parent,
      );
  }
  f.db
    .prepare(
      'INSERT INTO transactions (id,type,title,amount,source_account_id,destination_account_id,category_id,note,occurred_at,created_at,updated_at,category_ids_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      'tagged',
      'expense',
      'Tagged',
      100,
      'cash',
      null,
      'root',
      '',
      instant,
      instant,
      instant,
      '["root","child"]',
    );
  f.db
    .prepare(
      'INSERT INTO transactions (id,type,title,amount,source_account_id,destination_account_id,category_id,note,occurred_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      'receipt',
      'expense',
      'Receipt',
      50,
      'cash',
      null,
      null,
      '',
      instant,
      instant,
      instant,
    );
  f.db
    .prepare('INSERT INTO transaction_items VALUES (?,?,?,?,?,?)')
    .run('item', 'receipt', 'Clothes', 50, 'child', 0);
  f.db.prepare("INSERT INTO settings VALUES ('onboarded','true')").run();
  const originalTransactions = f.db
    .prepare('SELECT * FROM transactions ORDER BY id')
    .all();
  const originalItems = f.db.prepare('SELECT * FROM transaction_items').all();
  await f.repo.initialize();
  const after = await f.repo.snapshot();
  assert.equal(after.categories.length, 3);
  assert.ok(
    after.categories.every(
      (c) => c.parent_id === null && c.name === 'Same name',
    ),
  );
  assert.equal(after.categories.find((c) => c.id === 'leaf').is_archived, 1);
  assert.equal(accountBalances(after).cash, 850);
  assert.deepEqual(
    f.db
      .prepare('SELECT * FROM transactions ORDER BY id')
      .all()
      .map((row) => ({ ...row })),
    originalTransactions.map((row) => ({
      ...row,
      tag_ids_json: '[]',
      category_ids_json: '[]',
    })),
  );
  assert.deepEqual(
    f.db
      .prepare('SELECT * FROM transaction_items')
      .all()
      .map((row) => ({ ...row })),
    originalItems.map((row) => ({
      ...row,
      tag_ids_json: '[]',
      category_ids_json: '[]',
    })),
  );
  assert.equal(
    statistics(after, { ...filters, category: 'root' }).expense,
    100,
  );
  assert.equal(
    statistics(after, { ...filters, category: 'child' }).expense,
    50,
  );
  assert.equal(
    statistics(after, { ...filters, categories: ['root', 'child'] }).expense,
    150,
  );
  await f.repo.initialize();
  assert.deepEqual(await f.repo.snapshot(), after);
  await f.repo.restoreDefaults();
  assert.ok(
    (await f.repo.snapshot()).categories.every((c) => c.parent_id === null),
  );
  await f.repo.reset();
  assert.equal((await f.repo.snapshot()).categories.length, 12);
});

const makeTag = (id, name = id, patch = {}) => ({
  id,
  name,
  color: '#287D68',
  is_archived: 0,
  ...patch,
});

test('standalone tags normalize names, reject duplicates or invalid fields, and rename without changing transaction links', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTag(makeTag('sale', '  Khuyến   Mãi  '));
  let data = await repo.snapshot();
  assert.equal(data.tags[0].name, 'Khuyến Mãi');
  assert.equal(tagNameKey(' KHUYẾN MÃI '), tagNameKey('Khuyến Mãi'));
  for (const bad of [
    makeTag('duplicate', 'khuyến mãi'),
    makeTag('blank', ' '),
    makeTag('long', 'x'.repeat(51)),
    makeTag('color', 'Color', { color: 'red' }),
    makeTag('flag', 'Flag', { is_archived: 2 }),
  ])
    await assert.rejects(repo.saveTag(bad));
  const tx = draft('expense', { tag_ids_json: '["sale"]' });
  await repo.saveTransaction(tx, false);
  await repo.saveTag(makeTag('sale', 'Ưu đãi', { color: '#2563EB' }));
  data = await repo.snapshot();
  assert.equal(data.tags.length, 1);
  assert.equal(data.tags[0].name, 'Ưu đãi');
  assert.deepEqual(transactionTagIds(data.transactions[0]), ['sale']);
  assert.equal(statistics(data, filters).tags.sale.expense, 100);
});

test('500k with two independent tags counts once in balances and totals and appears fully under either tag', async (t) => {
  const { repo } = await fixture(t, 600000);
  await repo.saveTag(makeTag('shopee', 'Shopee'));
  await repo.saveTag(makeTag('sale', 'Khuyến mãi'));
  const tx = draft('expense', {
    amount: 500000,
    tag_ids_json: '["shopee","sale"]',
  });
  await repo.saveTransaction(tx, false);
  const data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 100000);
  for (const tags of [[], ['shopee'], ['sale'], ['shopee', 'sale']]) {
    const report = statistics(data, { ...filters, tags });
    assert.equal(report.expense, 500000);
    assert.equal(report.transactions.length, 1);
    assert.deepEqual(report.tags.shopee, {
      income: 0,
      expense: 500000,
      count: 1,
    });
    assert.deepEqual(report.tags.sale, {
      income: 0,
      expense: 500000,
      count: 1,
    });
  }
  assert.equal(data.items.length, 0);
  assert.equal(data.categories.length, 12);
});

test('tag filters combine with account, category, search and amount filters and tag stats handle income and excluded money', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTag(makeTag('trip', 'Du lịch'));
  await repo.saveTag(makeTag('work', 'Công việc'));
  await repo.saveTransaction(
    draft('income', {
      amount: 400,
      title: 'Trip income',
      tag_ids_json: '["trip","work"]',
    }),
    false,
  );
  await repo.saveTransaction(
    draft('expense', {
      amount: 200,
      title: 'Trip expense',
      tag_ids_json: '["trip"]',
    }),
    false,
  );
  await repo.saveTransaction(
    draft('expense', {
      amount: 300,
      title: 'Work expense',
      exclude_from_balance: 1,
      tag_ids_json: '["work"]',
    }),
    false,
  );
  await repo.saveTransaction(
    draft('transfer', { tag_ids_json: '["trip"]' }),
    false,
  );
  const data = await repo.snapshot();
  const report = statistics(data, { ...filters, tags: ['trip', 'work'] });
  assert.equal(report.income, 400);
  assert.equal(report.expense, 500);
  assert.deepEqual(report.tags.trip, { income: 400, expense: 200, count: 2 });
  assert.deepEqual(report.tags.work, { income: 400, expense: 300, count: 2 });
  assert.equal(
    filterTransactions(data, { ...filters, tags: ['trip'] }).length,
    3,
  );
  assert.equal(
    filterTransactions(data, {
      ...filters,
      tags: ['work'],
      account: 'cash',
      search: 'Work',
      minAmount: 300,
      maxAmount: 300,
      category: 'default-expense-0',
    }).length,
    1,
  );
  assert.equal(
    filterTransactions(data, { ...filters, tags: ['missing'] }).length,
    0,
  );
  assert.equal(accountBalances(data).cash, 700); // 200 expense + 100 transfer; excluded 300 is report-only.
});

test('tag archival keeps history and existing assignments editable while blocking new use; unused tags can be deleted', async (t) => {
  const { repo } = await fixture(t);
  const tag = makeTag('used', 'Used');
  await repo.saveTag(tag);
  await repo.saveTag(makeTag('unused', 'Unused'));
  await repo.deleteTag('unused');
  const tx = draft('expense', { tag_ids_json: '["used"]' });
  await repo.saveTransaction(tx, false);
  await repo.deleteTag('used');
  let data = await repo.snapshot();
  assert.equal(data.tags.length, 1);
  assert.equal(data.tags[0].is_archived, 1);
  assert.equal(statistics(data, { ...filters, tags: ['used'] }).expense, 100);
  await assert.rejects(
    repo.saveTransaction(draft('expense', { tag_ids_json: '["used"]' }), false),
    /lưu trữ/,
  );
  await repo.saveTransaction({ ...tx, title: 'Edit only title' }, true);
  data = await repo.snapshot();
  assert.deepEqual(transactionTagIds(data.transactions[0]), ['used']);
  await repo.saveTag(tag);
  await repo.saveTransaction(
    draft('expense', { tag_ids_json: '["used"]' }),
    false,
  );
  assert.equal(
    statistics(await repo.snapshot(), filters).tags.used.expense,
    200,
  );
});

test('invalid tag references and malformed tag arrays are rejected before transaction changes commit', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTag(makeTag('valid'));
  const before = await repo.snapshot();
  for (const raw of [
    '{',
    '{}',
    '[1]',
    '["missing"]',
    '["valid","valid"]',
    JSON.stringify(Array.from({ length: 101 }, (_, i) => `tag-${i}`)),
  ]) {
    await assert.rejects(
      repo.saveTransaction(draft('expense', { tag_ids_json: raw }), false),
    );
    assert.deepEqual(await repo.snapshot(), before);
  }
  const tx = draft('expense', { tag_ids_json: '["valid"]' });
  await repo.saveTransaction(tx, false);
  const tagged = await repo.snapshot();
  await assert.rejects(
    repo.saveTransaction({ ...tx, tag_ids_json: '["missing"]' }, true),
  );
  assert.deepEqual(await repo.snapshot(), tagged);
  await repo.saveTransaction({ ...tx, tag_ids_json: '[]' }, true);
  assert.deepEqual(statistics(await repo.snapshot(), filters).tags, {});
  await repo.deleteTag('valid');
  assert.equal((await repo.snapshot()).tags.length, 0);
});

test('tag backup and CSV roundtrip preserve definitions and assignments and reject mislabelled or corrupt backups atomically', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTag(makeTag('sale', 'Khuyến mãi'));
  await repo.saveTag(makeTag('shop', 'Shopee'));
  await repo.saveTransaction(
    draft('expense', { tag_ids_json: '["sale","shop"]' }),
    false,
  );
  const before = await repo.snapshot();
  const backup = await repo.backup();
  assert.equal(backup.version, 19);
  await repo.restore(parseBackup(JSON.stringify(backup)));
  assert.deepEqual(await repo.snapshot(), before);
  assert.ok(transactionsCsv(before).includes('Khuyến mãi | Shopee'));
  for (const change of [
    (b) => {
      b.version = 7;
    },
    (b) => {
      b.data.tags = [];
    },
    (b) => {
      b.data.tags[1].name = b.data.tags[0].name;
    },
    (b) => {
      b.data.tags[0].color = '#oops';
    },
    (b) => {
      b.data.transactions[0].tag_ids_json = '["sale","sale"]';
    },
  ]) {
    const bad = structuredClone(backup);
    change(bad);
    await assert.rejects(async () => repo.restore(bad));
    assert.deepEqual(await repo.snapshot(), before);
  }
  const legacy = structuredClone(backup);
  legacy.version = 7;
  delete legacy.data.tags;
  for (const tx of legacy.data.transactions) delete tx.tag_ids_json;
  await repo.restore(parseBackup(JSON.stringify(legacy)));
  assert.deepEqual((await repo.snapshot()).tags, []);
  assert.deepEqual(
    transactionTagIds((await repo.snapshot()).transactions[0]),
    [],
  );
  await repo.reset();
  assert.deepEqual((await repo.snapshot()).tags, []);
});

test('schema v7 upgrades to tag storage without changing any transaction amounts or category assignments', async (t) => {
  const migrations = await import('../src/database/migrations.ts');
  const f = connect();
  t.after(() => f.db.close());
  for (let version = 1; version <= 7; version++)
    f.db.exec(migrations[`migration${version}`]);
  f.db
    .prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?)')
    .run('cash', 'Cash', 'cash', 1000, 0, instant, instant);
  f.db
    .prepare(
      'INSERT INTO categories (id,name,type,icon,color,sort_order,is_archived) VALUES (?,?,?,?,?,?,?)',
    )
    .run('legacy', 'Category', 'expense', 'shirt-outline', '#287D68', 0, 0);
  f.db
    .prepare(
      'INSERT INTO transactions (id,type,title,amount,source_account_id,destination_account_id,category_id,note,occurred_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      'legacy-tx',
      'expense',
      'Legacy',
      150,
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
  assert.deepEqual(data.tags, []);
  assert.equal(data.transactions[0].tag_ids_json, '[]');
  assert.equal(data.transactions[0].category_id, 'legacy');
  assert.equal(data.transactions[0].amount, 150);
  assert.equal(accountBalances(data).cash, 850);
  await f.repo.initialize();
  assert.deepEqual(await f.repo.snapshot(), data);
});

test('category dragging respects measured row heights, insertion thresholds and list boundaries', () => {
  const layouts = [
    { id: 'short', top: 4, height: 60 },
    { id: 'tall', top: 72, height: 100 },
    { id: 'last', top: 180, height: 50 },
  ];
  assert.equal(categoryDropPosition(layouts, 'short', 0).target, 0);
  assert.equal(categoryDropPosition(layouts, 'short', 35).target, 0);
  assert.equal(categoryDropPosition(layouts, 'short', 40).target, 1);
  assert.equal(categoryDropPosition(layouts, 'short', 150).target, 2);
  assert.equal(categoryDropPosition(layouts, 'short', 10000).translation, 166);
  assert.equal(categoryDropPosition(layouts, 'last', -30).target, 2);
  assert.equal(categoryDropPosition(layouts, 'last', -40).target, 1);
  assert.equal(categoryDropPosition(layouts, 'last', -150).target, 0);
  assert.equal(categoryDropPosition(layouts, 'last', -10000).translation, -176);
  assert.equal(categoryDropPosition(layouts, 'tall', 0).extent, 108);
  assert.equal(categoryDropPosition(layouts, 'missing', 10), null);
  assert.equal(categoryDropPosition([], 'short', 10), null);
  assert.equal(categoryDropPosition(layouts, 'short', NaN), null);
});

test('dragging inserts rather than swaps and preserves every intermediate category without mutating input', () => {
  const ids = ['a', 'b', 'c', 'd'];
  assert.deepEqual(reorderCategoryIds(ids, 0, 3), ['b', 'c', 'd', 'a']);
  assert.deepEqual(reorderCategoryIds(ids, 3, 1), ['a', 'd', 'b', 'c']);
  assert.deepEqual(ids, ['a', 'b', 'c', 'd']);
  for (const [from, to] of [
    [0, 0],
    [-1, 1],
    [0, 4],
    [4, 0],
  ])
    assert.deepEqual(reorderCategoryIds(ids, from, to), ids);
});

test('dropped category order persists across reopening the database without changing transactions or other types', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'moni-category-drag-'));
  const path = join(dir, 'finance.db');
  const first = connect(path);
  await first.repo.initialize();
  await first.repo.onboard([
    makeAccount('cash', 'Cash', 'cash', 1000),
    makeAccount('bank', 'Bank', 'bank', 100),
  ]);
  await first.repo.saveTransaction(draft('expense'), false);
  const before = await first.repo.snapshot();
  const ids = before.categories
    .filter((c) => c.type === 'expense')
    .map((c) => c.id);
  const moved = reorderCategoryIds(ids, 0, ids.length - 1);
  await first.repo.reorderCategories('expense', moved);
  first.db.close();
  const reopened = connect(path);
  t.after(() => {
    reopened.db.close();
    unlinkSync(path);
    rmdirSync(dir);
  });
  await reopened.repo.initialize();
  const after = await reopened.repo.snapshot();
  assert.deepEqual(
    after.categories.filter((c) => c.type === 'expense').map((c) => c.id),
    moved,
  );
  assert.deepEqual(
    after.categories.filter((c) => c.type === 'income'),
    before.categories.filter((c) => c.type === 'income'),
  );
  assert.deepEqual(after.transactions, before.transactions);
  assert.deepEqual(accountBalances(after), accountBalances(before));
});

function loan(patch = {}) {
  return {
    id: `loan-${++sequence}`,
    lender: 'Anh Minh',
    amount: 500,
    account_id: 'bank',
    note: '',
    occurred_at: instant,
    created_at: instant,
    ...patch,
  };
}
function payment(loanId, patch = {}) {
  return {
    id: `payment-${++sequence}`,
    loan_id: loanId,
    amount: 100,
    account_id: 'bank',
    occurred_at: '2026-10-11T05:00:00.000Z',
    created_at: instant,
    ...patch,
  };
}

test('monthly reminder dates clamp month ends and leap years, stay at local 09:00 and stop at term end', () => {
  const scheduled = loan({
    payment_day: 31,
    occurred_at: new Date(2028, 0, 1).toISOString(),
    due_at: new Date(2028, 3, 30, 23, 59).toISOString(),
  });
  const dates = loanReminderDates(scheduled, new Date(2028, 0, 1));
  assert.deepEqual(
    dates.map((date) => [
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
    ]),
    [
      [0, 31, 9, 0],
      [1, 29, 9, 0],
      [2, 31, 9, 0],
      [3, 30, 9, 0],
    ],
  );
  assert.deepEqual(
    loanReminderDates(
      { ...scheduled, payment_day: null },
      new Date(2028, 0, 1),
    ),
    [],
  );
  assert.deepEqual(
    loanReminderDates({ ...scheduled, due_at: null }, new Date(2028, 0, 1)),
    [],
  );
  assert.deepEqual(loanReminderDates(scheduled, new Date(2028, 4, 1)), []);
  assert.equal(
    loanReminderDates(scheduled, new Date(2028, 0, 31, 8))[0].getMonth(),
    0,
  );
  assert.equal(
    loanReminderDates(scheduled, new Date(2028, 0, 31, 9))[0].getMonth(),
    1,
  );
  assert.equal(
    loanReminderDates(
      { ...scheduled, occurred_at: new Date(2028, 1, 1).toISOString() },
      new Date(2028, 0, 1),
    )[0].getMonth(),
    1,
  );
  const normalYear = {
    ...scheduled,
    occurred_at: new Date(2027, 11, 1).toISOString(),
    due_at: new Date(2029, 2, 1).toISOString(),
  };
  assert.equal(
    loanReminderDates(normalYear, new Date(2029, 1, 1))[0].getDate(),
    28,
  );
});

test('custom reminder time respects local midnight, month ends and the current-minute cutoff', () => {
  const scheduled = loan({
    payment_day: 31,
    payment_time_minutes: 23 * 60 + 45,
    occurred_at: new Date(2028, 0, 1).toISOString(),
    due_at: new Date(2028, 3, 30, 23, 59).toISOString(),
  });
  const now = new Date(2028, 1, 29, 23, 44);
  const first = loanReminderDates(scheduled, now)[0];
  assert.deepEqual(
    [first.getMonth(), first.getDate(), first.getHours(), first.getMinutes()],
    [1, 29, 23, 45],
  );
  assert.equal(
    loanReminderDates(scheduled, new Date(2028, 1, 29, 23, 45))[0].getMonth(),
    2,
  );
  const midnight = loanReminderDates(
    { ...scheduled, payment_time_minutes: 0 },
    new Date(2028, 1, 1),
  )[0];
  assert.equal(midnight.getHours(), 0);
  assert.equal(midnight.getMinutes(), 0);
  const originalId = planLoanReminders(
    {
      accounts: [],
      categories: [],
      transactions: [],
      items: [],
      loans: [scheduled],
    },
    now,
  )[0].id;
  const changedId = planLoanReminders(
    {
      accounts: [],
      categories: [],
      transactions: [],
      items: [],
      loans: [{ ...scheduled, payment_time_minutes: 1439 }],
    },
    now,
  )[0].id;
  assert.notEqual(originalId, changedId);
});

test('reminder time migrates from v18, validates atomically and roundtrips through backup', async (t) => {
  const { repo, db } = await fixture(t);
  const scheduled = loan({
    payment_day: 15,
    due_at: '2027-10-10T23:59:59.999Z',
  });
  await repo.addLoan(scheduled);
  db.exec(
    'ALTER TABLE loans DROP COLUMN payment_time_minutes; PRAGMA user_version=18;',
  );
  await repo.initialize();
  await repo.initialize();
  const before = await repo.snapshot();
  assert.equal(before.loans[0].payment_time_minutes, 540);
  for (const time of [-1, 1440, 1.5, NaN, '600', null]) {
    await assert.rejects(repo.setLoanPaymentDay(scheduled.id, 20, time));
    await assert.rejects(repo.addLoan(loan({ payment_time_minutes: time })));
  }
  assert.deepEqual(await repo.snapshot(), before);
  await repo.setLoanPaymentDay(scheduled.id, 20, 18 * 60 + 35);
  const saved = await repo.snapshot();
  assert.equal(saved.loans[0].payment_time_minutes, 1115);
  assert.deepEqual(accountBalances(saved), accountBalances(before));
  const backup = await repo.backup();
  assert.equal(backup.version, 19);
  assert.throws(() => validateBackup({ ...backup, version: 18 }));
  const malformed = structuredClone(backup);
  malformed.data.loans[0].payment_time_minutes = 1440;
  await assert.rejects(async () => repo.restore(malformed));
  assert.deepEqual(await repo.snapshot(), saved);
  await repo.restore(parseBackup(JSON.stringify(backup)));
  assert.deepEqual(await repo.snapshot(), saved);
  await repo.setLoanPaymentDay(scheduled.id, null);
  assert.equal((await repo.snapshot()).loans[0].payment_time_minutes, 1115);
  const legacy = structuredClone(backup);
  legacy.version = 18;
  delete legacy.data.loans[0].payment_time_minutes;
  await repo.restore(legacy);
  assert.equal((await repo.snapshot()).loans[0].payment_time_minutes, 540);
});

test('reminder plans distinguish borrowing and lending, remove settled or deleted loans, and cap the nearest dates globally', async (t) => {
  const { repo } = await fixture(t);
  const borrowed = loan({
    payment_day: 15,
    due_at: new Date(2036, 11, 31, 23, 59).toISOString(),
  });
  const lent = loan({
    direction: 'lend',
    account_id: 'cash',
    payment_day: 20,
    due_at: borrowed.due_at,
  });
  await repo.addLoan(borrowed);
  await repo.addLoan(lent);
  const now = new Date(2026, 10, 1);
  const plan = planLoanReminders(await repo.snapshot(), now);
  assert.equal(plan.length, 60);
  assert.equal(new Set(plan.map((item) => item.id)).size, 60);
  assert.equal(plan[0].date.getDate(), 15);
  assert.match(plan[0].title, /trả nợ/);
  assert.match(plan[1].title, /thu hồi/);
  await repo.repayLoan(payment(borrowed.id, { amount: borrowed.amount }));
  assert.ok(
    planLoanReminders(await repo.snapshot(), now).every(
      (item) => item.loanId === lent.id,
    ),
  );
  await repo.deleteLoan(lent.id);
  assert.deepEqual(planLoanReminders(await repo.snapshot(), now), []);
});

test('monthly reminder settings validate atomically, preserve balances and survive backup and v17 upgrade', async (t) => {
  const { repo, db } = await fixture(t);
  const scheduled = loan({ due_at: '2027-10-10T23:59:59.999Z' });
  await repo.addLoan(scheduled);
  const before = await repo.snapshot();
  db.exec(
    'ALTER TABLE loans DROP COLUMN payment_time_minutes; ALTER TABLE loans DROP COLUMN payment_day; PRAGMA user_version=17;',
  );
  await repo.initialize();
  assert.deepEqual(await repo.snapshot(), before);
  for (const day of [0, -1, 32, 1.5, NaN, '12'])
    await assert.rejects(repo.setLoanPaymentDay(scheduled.id, day));
  await assert.rejects(repo.setLoanPaymentDay('missing', 12));
  assert.deepEqual(await repo.snapshot(), before);
  await repo.setLoanPaymentDay(scheduled.id, 31);
  const saved = await repo.snapshot();
  assert.equal(saved.loans[0].payment_day, 31);
  assert.deepEqual(accountBalances(saved), accountBalances(before));
  const backup = await repo.backup();
  assert.equal(backup.version, 19);
  assert.throws(() => validateBackup({ ...backup, version: 17 }));
  await repo.restore(parseBackup(JSON.stringify(backup)));
  assert.deepEqual(await repo.snapshot(), saved);
  await repo.setLoanPaymentDay(scheduled.id, null);
  const legacy = await repo.backup();
  legacy.version = 17;
  delete legacy.data.loans[0].payment_day;
  await repo.restore(legacy);
  assert.deepEqual(await repo.snapshot(), before);
  const open = loan();
  await repo.addLoan(open);
  await assert.rejects(repo.setLoanPaymentDay(open.id, 12));
  await assert.rejects(repo.addLoan(loan({ payment_day: 12 })));
});

test('lending debits principal, collects partial and full repayments across accounts, and keeps reports unchanged', async (t) => {
  const { repo } = await fixture(t);
  const lent = loan({
    direction: 'lend',
    account_id: 'cash',
    costs_json: JSON.stringify([
      { id: 'interest', name: 'Interest', amount: 50 },
    ]),
  });
  await repo.addLoan(lent);
  let data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 500);
  assert.equal(totalLoanOutstanding(data), 0);
  assert.equal(totalLoanOutstanding(data, 'lend'), 550);
  await repo.repayLoan(payment(lent.id, { amount: 200 }));
  data = await repo.snapshot();
  assert.equal(accountBalances(data).bank, 300);
  assert.equal(totalLoanOutstanding(data, 'lend'), 350);
  await repo.repayLoan(
    payment(lent.id, { amount: 350, account_id: 'cash', fee_amount: 10 }),
  );
  data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 860);
  assert.equal(totalLoanOutstanding(data, 'lend'), 0);
  assert.equal(statistics(data, filters).income, 0);
  assert.equal(statistics(data, filters).expense, 0);
  await assert.rejects(repo.repayLoan(payment(lent.id)));
});

test('lending validates direction, available funds, collection dates and overpayments atomically', async (t) => {
  const { repo } = await fixture(t);
  const before = await repo.snapshot();
  await assert.rejects(repo.addLoan(loan({ direction: 'invalid' })));
  await assert.rejects(repo.addLoan(loan({ direction: 'lend', amount: 101 })));
  assert.deepEqual(await repo.snapshot(), before);
  const lent = loan({ direction: 'lend', account_id: 'cash' });
  await repo.addLoan(lent);
  const after = await repo.snapshot();
  await assert.rejects(repo.repayLoan(payment(lent.id, { amount: 501 })));
  await assert.rejects(
    repo.repayLoan(
      payment(lent.id, { occurred_at: '2026-10-09T05:00:00.000Z' }),
    ),
  );
  assert.deepEqual(await repo.snapshot(), after);
  await repo.deleteLoan(lent.id);
  assert.equal(accountBalances(await repo.snapshot()).cash, 1000);
});

test('v16 migration preserves borrowed balances and defaults existing loans to borrowing', async (t) => {
  const { repo, db } = await fixture(t);
  const borrowed = loan();
  await repo.addLoan(borrowed);
  await repo.repayLoan(payment(borrowed.id));
  const before = await repo.snapshot();
  db.exec(
    'ALTER TABLE loans DROP COLUMN payment_time_minutes; ALTER TABLE loans DROP COLUMN payment_day; ALTER TABLE loans DROP COLUMN direction; PRAGMA user_version=16;',
  );
  await repo.initialize();
  assert.deepEqual(await repo.snapshot(), before);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 19);
  const legacy = await repo.backup();
  legacy.version = 16;
  delete legacy.data.loans[0].direction;
  await repo.restore(legacy);
  assert.deepEqual(await repo.snapshot(), before);
});

test('lending supports historical records, independent debt totals, collection deletion and backup restore', async (t) => {
  const { repo } = await fixture(t);
  const lent = loan({ direction: 'lend', exclude_from_balance: 1 });
  const borrowed = loan();
  await repo.addLoan(lent);
  await repo.addLoan(borrowed);
  const collected = payment(lent.id, { amount: 200 });
  await repo.repayLoan(collected);
  let data = await repo.snapshot();
  assert.equal(accountBalances(data).bank, 800);
  assert.equal(totalLoanOutstanding(data), 500);
  assert.equal(totalLoanOutstanding(data, 'lend'), 300);
  const backup = validateBackup(await repo.backup());
  assert.equal(backup.version, 19);
  assert.throws(() => validateBackup({ ...backup, version: 16 }));
  const other = await fixture(t);
  await other.repo.restore(backup);
  assert.deepEqual(await other.repo.snapshot(), data);
  await repo.deleteLoanPayment(collected.id);
  data = await repo.snapshot();
  assert.equal(accountBalances(data).bank, 600);
  assert.equal(totalLoanOutstanding(data, 'lend'), 500);
});
test('borrowing credits only the receiving account once and never inflates income reports', async (t) => {
  const { repo } = await fixture(t);
  const before = await repo.snapshot();
  const borrowed = loan({ amount: 500000 });
  await repo.addLoan(borrowed);
  const data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 1000);
  assert.equal(accountBalances(data).bank, 500100);
  assert.equal(totalBalance(data.accounts, accountBalances(data)), 501100);
  assert.equal(totalLoanOutstanding(data), 500000);
  assert.deepEqual(data.transactions, before.transactions);
  assert.equal(statistics(data, filters).income, 0);
  assert.equal(statistics(data, filters).expense, 0);
});
test('partial and full repayments debit chosen accounts and close debt without affecting spending reports', async (t) => {
  const { repo } = await fixture(t);
  const borrowed = loan();
  await repo.addLoan(borrowed);
  await repo.repayLoan(
    payment(borrowed.id, { amount: 200, account_id: 'cash' }),
  );
  let data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 800);
  assert.equal(accountBalances(data).bank, 600);
  assert.equal(loanOutstanding(borrowed, data.loanPayments), 300);
  await repo.repayLoan(payment(borrowed.id, { amount: 300 }));
  data = await repo.snapshot();
  assert.equal(totalLoanOutstanding(data), 0);
  assert.equal(accountBalances(data).bank, 300);
  assert.equal(totalBalance(data.accounts, accountBalances(data)), 1100);
  assert.equal(statistics(data, filters).income, 0);
  assert.equal(statistics(data, filters).expense, 0);
  await assert.rejects(repo.repayLoan(payment(borrowed.id)), /vượt/);
});
test('invalid loans, duplicate IDs and invalid repayments reject atomically', async (t) => {
  const { repo } = await fixture(t);
  const borrowed = loan();
  const before = await repo.snapshot();
  for (const patch of [
    { amount: 0 },
    { amount: 1.5 },
    { amount: Number.MAX_SAFE_INTEGER + 1 },
    { lender: ' ' },
    { account_id: 'missing' },
    { occurred_at: 'invalid' },
    { note: 'x'.repeat(4001) },
  ]) {
    await assert.rejects(repo.addLoan({ ...borrowed, ...patch }));
    assert.deepEqual(await repo.snapshot(), before);
  }
  await repo.addLoan(borrowed);
  const current = await repo.snapshot();
  await assert.rejects(repo.addLoan(borrowed));
  for (const patch of [
    { amount: 501 },
    { amount: 0 },
    { amount: 1.1 },
    { loan_id: 'missing' },
    { account_id: 'missing' },
    { occurred_at: '2026-10-09T05:00:00.000Z' },
  ]) {
    await assert.rejects(repo.repayLoan(payment(borrowed.id, patch)));
    assert.deepEqual(await repo.snapshot(), current);
  }
});
test('repayments enforce historical sufficient funds and concurrent repayment cannot overpay', async (t) => {
  const { repo } = await fixture(t, 0);
  const borrowed = loan();
  await repo.addLoan(borrowed);
  await assert.rejects(
    repo.repayLoan(payment(borrowed.id, { account_id: 'cash' })),
    /Không đủ/,
  );
  const results = await Promise.allSettled([
    repo.repayLoan(payment(borrowed.id, { amount: 400 })),
    repo.repayLoan(payment(borrowed.id, { amount: 400 })),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(totalLoanOutstanding(await repo.snapshot()), 100);
});
test('spending borrowed money is valid but deleting its funding and backdated overspending are rejected', async (t) => {
  const { repo } = await fixture(t, 0);
  const borrowed = loan();
  await repo.addLoan(borrowed);
  const spent = draft('expense', {
    source_account_id: 'bank',
    amount: 550,
    occurred_at: '2026-10-12T05:00:00.000Z',
  });
  await repo.saveTransaction(spent, false);
  const before = await repo.snapshot();
  assert.equal(accountBalances(before).bank, 50);
  await assert.rejects(repo.deleteLoan(borrowed.id), /Không đủ/);
  await assert.rejects(
    repo.saveTransaction(
      draft('expense', {
        source_account_id: 'bank',
        amount: 200,
        occurred_at: '2026-10-09T05:00:00.000Z',
      }),
      false,
    ),
    /Không đủ/,
  );
  assert.deepEqual(await repo.snapshot(), before);
  await repo.deleteTransaction(spent.id);
  await repo.deleteLoan(borrowed.id);
  assert.equal(accountBalances(await repo.snapshot()).bank, 100);
});
test('deleting repayment and loan reverses exact effects and reset clears all loan data', async (t) => {
  const { repo } = await fixture(t);
  const borrowed = loan();
  await repo.addLoan(borrowed);
  const repaid = payment(borrowed.id);
  await repo.repayLoan(repaid);
  await assert.rejects(repo.repayLoan(repaid));
  await repo.deleteLoanPayment(repaid.id);
  assert.equal(totalLoanOutstanding(await repo.snapshot()), 500);
  assert.equal(accountBalances(await repo.snapshot()).bank, 600);
  await repo.repayLoan(payment(borrowed.id));
  await repo.deleteLoan(borrowed.id);
  let data = await repo.snapshot();
  assert.deepEqual(data.loans, []);
  assert.deepEqual(data.loanPayments, []);
  assert.equal(accountBalances(data).bank, 100);
  await repo.addLoan(loan());
  await repo.reset();
  data = await repo.snapshot();
  assert.deepEqual(data.loans, []);
  assert.deepEqual(data.loanPayments, []);
});
test('archived accounts reject new loan receipts and repayments while preserving historical references', async (t) => {
  const { repo } = await fixture(t);
  await repo.addAccount(makeAccount('empty-bank', 'Archived', 'bank', 0));
  const borrowed = loan({ amount: 100, account_id: 'empty-bank' });
  await repo.addLoan(borrowed);
  await repo.repayLoan(
    payment(borrowed.id, { amount: 100, account_id: 'empty-bank' }),
  );
  await repo.archiveAccount('empty-bank', true);
  const before = await repo.snapshot();
  await assert.rejects(
    repo.addLoan(loan({ account_id: 'empty-bank' })),
    /hoạt động/,
  );
  const another = loan();
  await repo.addLoan(another);
  await assert.rejects(
    repo.repayLoan(payment(another.id, { account_id: 'empty-bank' })),
    /hoạt động/,
  );
  assert.deepEqual((await repo.snapshot()).loans[1], before.loans[0]);
});
test('loan backups roundtrip, reject malformed or disguised old-version debts without losing existing data', async (t) => {
  const { repo } = await fixture(t);
  const borrowed = loan();
  await repo.addLoan(borrowed);
  await repo.repayLoan(payment(borrowed.id));
  const before = await repo.snapshot();
  const backup = await repo.backup();
  assert.equal(backup.version, 19);
  await repo.restore(parseBackup(JSON.stringify(backup)));
  assert.deepEqual(await repo.snapshot(), before);
  for (const mutate of [
    (b) => {
      b.version = 8;
    },
    (b) => {
      b.data.loans[0].account_id = 'missing';
    },
    (b) => {
      b.data.loanPayments[0].amount = 999;
    },
    (b) => {
      b.data.loanPayments[0].loan_id = 'missing';
    },
    (b) => {
      b.data.loans.push({ ...b.data.loans[0] });
    },
    (b) => {
      b.data.loans[0].created_at = null;
    },
  ]) {
    const bad = structuredClone(backup);
    mutate(bad);
    await assert.rejects(async () => repo.restore(bad));
    assert.deepEqual(await repo.snapshot(), before);
  }
  const legacy = structuredClone(backup);
  legacy.version = 8;
  delete legacy.data.loans;
  delete legacy.data.loanPayments;
  await repo.restore(legacy);
  assert.deepEqual((await repo.snapshot()).loans, []);
  assert.equal(accountBalances(await repo.snapshot()).bank, 100);
});
test('schema v8 migration adds loan tables without changing existing accounts, transactions or tags', async (t) => {
  const migrations = await import('../src/database/migrations.ts');
  const f = connect();
  t.after(() => f.db.close());
  for (let version = 1; version <= 8; version++)
    f.db.exec(migrations[`migration${version}`]);
  const account = makeAccount('cash', 'Cash', 'cash', 1000);
  f.db
    .prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?)')
    .run(
      account.id,
      account.name,
      account.type,
      account.opening_balance,
      0,
      account.created_at,
      account.updated_at,
    );
  f.db.prepare("INSERT INTO settings VALUES ('onboarded','true')").run();
  await f.repo.initialize();
  let data = await f.repo.snapshot();
  assert.equal(f.db.prepare('PRAGMA user_version').get().user_version, 19);
  assert.deepEqual(data.loans, []);
  assert.deepEqual(data.loanPayments, []);
  assert.equal(accountBalances(data).cash, 1000);
  await f.repo.initialize();
  assert.deepEqual(await f.repo.snapshot(), data);
});
test('loan receipts and repayments persist after SQLite reopen', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'moni-loans-'));
  const path = join(dir, 'ledger.sqlite');
  const f = connect(path);
  await f.repo.initialize();
  await f.repo.onboard([makeAccount('cash', 'Cash', 'cash', 0)]);
  const borrowed = loan({
    account_id: 'cash',
    payment_day: 10,
    payment_time_minutes: 1115,
    due_at: '2027-10-10T23:59:59.999Z',
  });
  await f.repo.addLoan(borrowed);
  await f.repo.repayLoan(
    payment(borrowed.id, { account_id: 'cash', amount: 125 }),
  );
  const before = await f.repo.snapshot();
  f.db.close();
  const reopened = connect(path);
  t.after(() => {
    reopened.db.close();
    unlinkSync(path);
    rmdirSync(dir);
  });
  await reopened.repo.initialize();
  const data = await reopened.repo.snapshot();
  assert.deepEqual(data, before);
  assert.equal(data.loans[0].payment_time_minutes, 1115);
  assert.equal(accountBalances(data).cash, 375);
  assert.equal(totalLoanOutstanding(data), 375);
});

test('loan terms and itemized costs persist, costs increase debt and only principal credits cash', async (t) => {
  const { repo } = await fixture(t);
  const costs = [
    { id: 'interest', name: 'Tiền lãi', amount: 100 },
    { id: 'insurance', name: 'Phí bảo hiểm', amount: 50 },
    { id: 'other', name: 'Phí hồ sơ', amount: 20 },
  ];
  const borrowed = loan({
    due_at: '2026-11-10T16:59:59.999Z',
    costs_json: JSON.stringify(costs),
  });
  await repo.addLoan(borrowed);
  let data = await repo.snapshot();
  assert.equal(data.loans[0].due_at, borrowed.due_at);
  assert.deepEqual(parseLoanCosts(data.loans[0]), costs);
  assert.equal(totalLoanCosts(data.loans[0]), 170);
  assert.equal(accountBalances(data).bank, 600);
  assert.equal(totalLoanOutstanding(data), 670);
  assert.equal(statistics(data, filters).expense, 0);
  await repo.repayLoan(payment(borrowed.id, { amount: 500 }));
  data = await repo.snapshot();
  assert.equal(totalLoanOutstanding(data), 170);
  assert.equal(accountBalances(data).bank, 100);
  assert.equal(totalLoanCosts(data.loans[0]), 170);
  await repo.repayLoan(
    payment(borrowed.id, { amount: 170, account_id: 'cash' }),
  );
  data = await repo.snapshot();
  assert.equal(totalLoanOutstanding(data), 0);
  assert.equal(accountBalances(data).cash, 830);
  assert.equal(statistics(data, filters).expense, 0);
});
test('invalid loan deadlines, malformed costs and unsafe cost totals reject without modifying data', async (t) => {
  const { repo } = await fixture(t);
  const before = await repo.snapshot();
  const cost = { id: 'cost', name: 'Tiền lãi', amount: 10 };
  const invalid = [
    { due_at: 'invalid' },
    { due_at: '2026-10-09T16:59:59.999Z' },
    { due_at: 10 },
    { costs_json: '{' },
    { costs_json: '{}' },
    ...[
      null,
      { ...cost, amount: -1 },
      { ...cost, amount: 0 },
      { ...cost, amount: 1.5 },
      { ...cost, name: ' ' },
      { ...cost, id: '__proto__' },
    ].map((c) => ({ costs_json: JSON.stringify([c]) })),
    { costs_json: JSON.stringify([cost, cost]) },
    {
      costs_json: JSON.stringify([
        { ...cost, amount: Number.MAX_SAFE_INTEGER },
        { ...cost, id: 'second', amount: 1 },
      ]),
    },
    {
      costs_json: JSON.stringify(
        Array.from({ length: 51 }, (_, i) => ({ ...cost, id: `cost-${i}` })),
      ),
    },
  ];
  for (const patch of invalid) {
    await assert.rejects(repo.addLoan(loan(patch)));
    assert.deepEqual(await repo.snapshot(), before);
  }
});
test('backup includes term and costs, rejects version downgrades and reads old principal-only loans', async (t) => {
  const { repo } = await fixture(t);
  await repo.addLoan(
    loan({
      due_at: '2026-12-10T16:59:59.999Z',
      costs_json: JSON.stringify([
        { id: 'insurance', name: 'Bảo hiểm', amount: 100 },
      ]),
    }),
  );
  const backup = await repo.backup();
  const before = await repo.snapshot();
  assert.equal(backup.version, 19);
  await repo.restore(parseBackup(JSON.stringify(backup)));
  assert.deepEqual(await repo.snapshot(), before);
  for (const change of [
    (b) => {
      b.version = 9;
    },
    (b) => {
      b.data.loans[0].due_at = 'wrong';
    },
    (b) => {
      b.data.loans[0].costs_json = 'wrong';
    },
  ]) {
    const bad = structuredClone(backup);
    change(bad);
    await assert.rejects(async () => repo.restore(bad));
    assert.deepEqual(await repo.snapshot(), before);
  }
  const legacy = structuredClone(backup);
  legacy.version = 9;
  delete legacy.data.loans[0].due_at;
  delete legacy.data.loans[0].costs_json;
  await repo.restore(legacy);
  const restored = await repo.snapshot();
  assert.equal(restored.loans[0].due_at, null);
  assert.deepEqual(parseLoanCosts(restored.loans[0]), []);
  assert.equal(totalLoanOutstanding(restored), 500);
  assert.equal(accountBalances(restored).bank, 600);
});
test('schema v9 migration preserves existing loans and repayments with no term and no costs', async (t) => {
  const migrations = await import('../src/database/migrations.ts');
  const f = connect();
  t.after(() => f.db.close());
  for (let version = 1; version <= 9; version++)
    f.db.exec(migrations[`migration${version}`]);
  f.db
    .prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?)')
    .run('cash', 'Cash', 'cash', 0, 0, instant, instant);
  f.db.prepare("INSERT INTO settings VALUES ('onboarded','true')").run();
  f.db
    .prepare('INSERT INTO loans VALUES (?,?,?,?,?,?,?)')
    .run('old-loan', 'Minh', 500, 'cash', 'Ghi chú cũ', instant, instant);
  f.db
    .prepare('INSERT INTO loan_payments VALUES (?,?,?,?,?,?)')
    .run(
      'old-payment',
      'old-loan',
      100,
      'cash',
      '2026-10-11T05:00:00.000Z',
      instant,
    );
  await f.repo.initialize();
  const data = await f.repo.snapshot();
  assert.equal(f.db.prepare('PRAGMA user_version').get().user_version, 19);
  assert.equal(data.loans[0].due_at, null);
  assert.equal(data.loans[0].costs_json, '[]');
  assert.equal(data.loans[0].note, 'Ghi chú cũ');
  assert.equal(accountBalances(data).cash, 400);
  assert.equal(totalLoanOutstanding(data), 400);
  await f.repo.initialize();
  assert.deepEqual(await f.repo.snapshot(), data);
});

test('excluded loan records principal plus costs as debt but does not fund its receiving account', async (t) => {
  const { repo } = await fixture(t);
  const borrowed = loan({
    exclude_from_balance: 1,
    costs_json: JSON.stringify([{ id: 'interest', name: 'Lãi', amount: 170 }]),
  });
  await repo.addLoan(borrowed);
  let data = await repo.snapshot();
  assert.equal(data.loans[0].exclude_from_balance, 1);
  assert.equal(loanTotalAmount(data.loans[0]), 670);
  assert.equal(loanOutstanding(data.loans[0], data.loanPayments), 670);
  assert.equal(loanBalances(data).get(borrowed.id), 670);
  assert.equal(totalLoanOutstanding(data), 670);
  assert.equal(accountBalances(data).bank, 100);
  assert.equal(totalBalance(data.accounts, accountBalances(data)), 1100);
  await assert.rejects(
    repo.saveTransaction(
      draft('expense', { source_account_id: 'bank', amount: 101 }),
      false,
    ),
    /Không đủ/,
  );
  await repo.repayLoan(
    payment(borrowed.id, { amount: 600, account_id: 'cash' }),
  );
  data = await repo.snapshot();
  assert.equal(totalLoanOutstanding(data), 70);
  assert.equal(loanBalances(data).get(borrowed.id), 70);
  assert.equal(accountBalances(data).cash, 400);
  assert.equal(statistics(data, filters).income, 0);
  assert.equal(statistics(data, filters).expense, 0);
  await repo.repayLoan(
    payment(borrowed.id, { amount: 70, account_id: 'cash' }),
  );
  assert.equal(totalLoanOutstanding(await repo.snapshot()), 0);
  await assert.rejects(
    repo.repayLoan(payment(borrowed.id, { amount: 1 })),
    /vượt/,
  );
  await repo.deleteLoan(borrowed.id);
  data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 1000);
  assert.equal(accountBalances(data).bank, 100);
  assert.deepEqual(data.loanPayments, []);
});
test('included loan credits only principal, full repayment includes fees and requires sufficient balance', async (t) => {
  const { repo } = await fixture(t);
  const borrowed = loan({
    exclude_from_balance: 0,
    costs_json: JSON.stringify([{ id: 'fee', name: 'Bảo hiểm', amount: 170 }]),
  });
  await repo.addLoan(borrowed);
  const before = await repo.snapshot();
  assert.equal(accountBalances(before).bank, 600);
  assert.equal(totalLoanOutstanding(before), 670);
  await assert.rejects(
    repo.repayLoan(payment(borrowed.id, { amount: 670 })),
    /Không đủ/,
  );
  assert.deepEqual(await repo.snapshot(), before);
  await repo.repayLoan(
    payment(borrowed.id, { amount: 670, account_id: 'cash' }),
  );
  const data = await repo.snapshot();
  assert.equal(totalLoanOutstanding(data), 0);
  assert.equal(totalBalance(data.accounts, accountBalances(data)), 930);
  assert.equal(accountBalances(data).bank, 600);
});
test('invalid exclusion flags and unsafe combined loan totals are rejected atomically', async (t) => {
  const { repo } = await fixture(t);
  const before = await repo.snapshot();
  for (const value of [null, true, '1', 2, -1]) {
    await assert.rejects(repo.addLoan(loan({ exclude_from_balance: value })));
    assert.deepEqual(await repo.snapshot(), before);
  }
  await assert.rejects(
    repo.addLoan(
      loan({
        amount: Number.MAX_SAFE_INTEGER,
        exclude_from_balance: 1,
        costs_json: JSON.stringify([{ id: 'fee', name: 'Phí', amount: 1 }]),
      }),
    ),
    /an toàn/,
  );
  assert.deepEqual(await repo.snapshot(), before);
});
test('loan exclusion and fee-inclusive debt survive backup restore and malformed legacy flags cannot change cash', async (t) => {
  const { repo } = await fixture(t);
  const borrowed = loan({
    exclude_from_balance: 1,
    costs_json: JSON.stringify([{ id: 'fee', name: 'Phí', amount: 150 }]),
  });
  await repo.addLoan(borrowed);
  await repo.repayLoan(
    payment(borrowed.id, { amount: 600, account_id: 'cash' }),
  );
  const before = await repo.snapshot();
  const backup = await repo.backup();
  await repo.restore(parseBackup(JSON.stringify(backup)));
  assert.deepEqual(await repo.snapshot(), before);
  assert.equal(totalLoanOutstanding(await repo.snapshot()), 50);
  for (const mutate of [
    (b) => {
      b.version = 10;
    },
    (b) => {
      b.data.loans[0].exclude_from_balance = null;
    },
    (b) => {
      b.data.loans[0].exclude_from_balance = '1';
    },
  ]) {
    const bad = structuredClone(backup);
    mutate(bad);
    await assert.rejects(async () => repo.restore(bad));
    assert.deepEqual(await repo.snapshot(), before);
  }
});
test('v10 loan migration keeps original cash movements, includes fees in debt and defaults exclusion to zero', async (t) => {
  const migrations = await import('../src/database/migrations.ts');
  const f = connect();
  t.after(() => f.db.close());
  for (let version = 1; version <= 10; version++)
    f.db.exec(migrations[`migration${version}`]);
  f.db
    .prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?)')
    .run('cash', 'Cash', 'cash', 1000, 0, instant, instant);
  f.db.prepare("INSERT INTO settings VALUES ('onboarded','true')").run();
  f.db
    .prepare('INSERT INTO loans VALUES (?,?,?,?,?,?,?,?,?)')
    .run(
      'old',
      'Minh',
      500,
      'cash',
      '',
      instant,
      instant,
      null,
      JSON.stringify([{ id: 'fee', name: 'Phí', amount: 170 }]),
    );
  f.db
    .prepare('INSERT INTO loan_payments VALUES (?,?,?,?,?,?)')
    .run('paid', 'old', 500, 'cash', '2026-10-11T05:00:00.000Z', instant);
  await f.repo.initialize();
  const data = await f.repo.snapshot();
  assert.equal(data.loans[0].exclude_from_balance, 0);
  assert.equal(accountBalances(data).cash, 1000);
  assert.equal(totalLoanOutstanding(data), 170);
  assert.equal(f.db.prepare('PRAGMA user_version').get().user_version, 19);
  assert.throws(() =>
    f.db.prepare('UPDATE loans SET exclude_from_balance=2').run(),
  );
  const oldBackup = await f.repo.backup();
  oldBackup.version = 10;
  delete oldBackup.data.loans[0].exclude_from_balance;
  await f.repo.restore(oldBackup);
  assert.deepEqual(await f.repo.snapshot(), data);
  await f.repo.initialize();
  assert.deepEqual(await f.repo.snapshot(), data);
});

test('full repayment debits debt plus settlement fee once while only debt reduces the outstanding amount', async (t) => {
  const { repo } = await fixture(t);
  const borrowed = loan({
    costs_json: JSON.stringify([
      { id: 'insurance', name: 'Bảo hiểm', amount: 170 },
    ]),
  });
  await repo.addLoan(borrowed);
  const repaid = payment(borrowed.id, {
    amount: 670,
    fee_amount: 30,
    account_id: 'cash',
  });
  assert.equal(loanPaymentTotal(repaid), 700);
  await repo.repayLoan(repaid);
  let data = await repo.snapshot();
  assert.equal(data.loanPayments[0].amount, 670);
  assert.equal(data.loanPayments[0].fee_amount, 30);
  assert.equal(loanOutstanding(data.loans[0], data.loanPayments), 0);
  assert.equal(totalLoanOutstanding(data), 0);
  assert.equal(accountBalances(data).cash, 300);
  assert.equal(accountBalances(data).bank, 600);
  assert.equal(totalBalance(data.accounts, accountBalances(data)), 900);
  await assert.rejects(
    repo.repayLoan(payment(borrowed.id, { amount: 1 })),
    /vượt/,
  );
  await repo.deleteLoanPayment(repaid.id);
  data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 1000);
  assert.equal(totalLoanOutstanding(data), 670);
});
test('settlement validates balance including fees, invalid fees and combined safe integer limits atomically', async (t) => {
  const { repo } = await fixture(t);
  const borrowed = loan();
  await repo.addLoan(borrowed);
  const before = await repo.snapshot();
  await assert.rejects(
    repo.repayLoan(payment(borrowed.id, { amount: 500, fee_amount: 101 })),
    /Không đủ/,
  );
  for (const fee of [null, -1, 0.5, '5', Number.MAX_SAFE_INTEGER]) {
    await assert.rejects(
      repo.repayLoan(payment(borrowed.id, { amount: 500, fee_amount: fee })),
    );
    assert.deepEqual(await repo.snapshot(), before);
  }
  await repo.repayLoan(payment(borrowed.id, { amount: 500, fee_amount: 100 }));
  assert.equal(accountBalances(await repo.snapshot()).bank, 0);
});
test('settlement fees persist in backups and invalid or legacy fee data cannot replace the ledger', async (t) => {
  const { repo } = await fixture(t);
  const borrowed = loan();
  await repo.addLoan(borrowed);
  await repo.repayLoan(payment(borrowed.id, { amount: 500, fee_amount: 50 }));
  const before = await repo.snapshot();
  const backup = await repo.backup();
  assert.equal(backup.version, 19);
  await repo.restore(parseBackup(JSON.stringify(backup)));
  assert.deepEqual(await repo.snapshot(), before);
  for (const change of [
    (b) => {
      b.version = 11;
    },
    (b) => {
      b.data.loanPayments[0].fee_amount = null;
    },
    (b) => {
      b.data.loanPayments[0].fee_amount = -1;
    },
    (b) => {
      b.data.loanPayments[0].fee_amount = 101;
    },
  ]) {
    const bad = structuredClone(backup);
    change(bad);
    await assert.rejects(async () => repo.restore(bad));
    assert.deepEqual(await repo.snapshot(), before);
  }
});
test('schema v11 migration defaults repayment fee to zero without changing debt or account balances', async (t) => {
  const migrations = await import('../src/database/migrations.ts');
  const f = connect();
  t.after(() => f.db.close());
  for (let version = 1; version <= 11; version++)
    f.db.exec(migrations[`migration${version}`]);
  f.db
    .prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?)')
    .run('cash', 'Cash', 'cash', 1000, 0, instant, instant);
  f.db.prepare("INSERT INTO settings VALUES ('onboarded','true')").run();
  f.db
    .prepare('INSERT INTO loans VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('old', 'Minh', 500, 'cash', '', instant, instant, null, '[]', 0);
  f.db
    .prepare('INSERT INTO loan_payments VALUES (?,?,?,?,?,?)')
    .run('paid', 'old', 100, 'cash', '2026-10-11T05:00:00.000Z', instant);
  await f.repo.initialize();
  const data = await f.repo.snapshot();
  assert.equal(data.loanPayments[0].fee_amount, 0);
  assert.equal(accountBalances(data).cash, 1400);
  assert.equal(totalLoanOutstanding(data), 400);
  assert.equal(f.db.prepare('PRAGMA user_version').get().user_version, 19);
  assert.throws(() =>
    f.db.prepare('UPDATE loan_payments SET fee_amount=-1').run(),
  );
  assert.throws(() =>
    f.db.prepare('UPDATE loan_payments SET fee_amount=0.5').run(),
  );
  const legacy = await f.repo.backup();
  legacy.version = 11;
  delete legacy.data.loanPayments[0].fee_amount;
  await f.repo.restore(legacy);
  assert.deepEqual(await f.repo.snapshot(), data);
  await f.repo.initialize();
  assert.deepEqual(await f.repo.snapshot(), data);
});
function localInstant(year, month, day) {
  return new Date(year, month - 1, day, 12).toISOString();
}
test('monthly estimate divides total principal plus costs across calendar months and rounds VND up', () => {
  const borrowed = loan({
    amount: 1000,
    costs_json: JSON.stringify([{ id: 'interest', name: 'Lãi', amount: 100 }]),
    occurred_at: localInstant(2026, 1, 15),
    due_at: localInstant(2026, 4, 15),
  });
  assert.deepEqual(loanMonthlyPayment(borrowed), { months: 3, amount: 367 });
  assert.deepEqual(
    loanMonthlyPayment({ ...borrowed, due_at: localInstant(2026, 4, 16) }),
    { months: 4, amount: 275 },
  );
  assert.deepEqual(
    loanMonthlyPayment({ ...borrowed, due_at: localInstant(2026, 1, 15) }),
    { months: 1, amount: 1100 },
  );
  assert.equal(loanMonthlyPayment({ ...borrowed, due_at: null }), null);
});
test('monthly estimate handles month-end clamping, leap years and terms crossing years', () => {
  const cases = [
    [2026, 1, 31, 2026, 2, 28, 1],
    [2028, 1, 31, 2028, 2, 29, 1],
    [2026, 1, 31, 2026, 3, 1, 2],
    [2026, 12, 15, 2027, 2, 15, 2],
    [2026, 12, 15, 2027, 2, 16, 3],
    [2026, 1, 15, 2026, 1, 16, 1],
  ];
  for (const [sy, sm, sd, ey, em, ed, months] of cases) {
    const borrowed = loan({
      amount: 1200,
      occurred_at: localInstant(sy, sm, sd),
      due_at: localInstant(ey, em, ed),
    });
    assert.deepEqual(loanMonthlyPayment(borrowed), {
      months,
      amount: Math.ceil(1200 / months),
    });
  }
});

async function receiptWithItemTags(repo) {
  for (const [id, name] of [
    ['whole', 'Cả hóa đơn'],
    ['food-tag', 'Ăn uống'],
    ['home-tag', 'Gia dụng'],
  ])
    await repo.saveTag({ id, name, color: '#287D68', is_archived: 0 });
  const receipt = adjustedDraft();
  receipt.tag_ids_json = JSON.stringify(['whole']);
  receipt.items[0].tag_ids_json = JSON.stringify(['food-tag', 'whole']);
  receipt.items[1].tag_ids_json = JSON.stringify(['home-tag']);
  return receipt;
}
test('receipt and item tags persist with adjusted amounts and deduplicate a shared parent tag', async (t) => {
  const { repo } = await fixture(t);
  const receipt = await receiptWithItemTags(repo);
  await repo.saveTransaction(receipt, false);
  const data = await repo.snapshot();
  assert.equal(data.transactions.length, 1);
  assert.equal(accountBalances(data).cash, 100);
  const report = statistics(data, filters);
  assert.equal(report.expense, 900);
  assert.deepEqual(report.tags.whole, { income: 0, expense: 900, count: 1 });
  assert.deepEqual(report.tags['food-tag'], {
    income: 0,
    expense: 540,
    count: 1,
  });
  assert.deepEqual(report.tags['home-tag'], {
    income: 0,
    expense: 360,
    count: 1,
  });
  assert.equal(
    filterTransactions(data, { ...filters, tags: ['food-tag'] }).length,
    1,
  );
  assert.equal(
    statistics(data, { ...filters, tags: ['food-tag'] }).expense,
    540,
  );
  assert.equal(
    statistics(data, {
      ...filters,
      tags: ['food-tag'],
      categories: ['default-expense-0'],
    }).expense,
    540,
  );
  assert.equal(
    statistics(data, { ...filters, tags: ['food-tag', 'home-tag'] }).expense,
    900,
  );
  assert.equal(
    statistics(data, { ...filters, tags: ['whole', 'food-tag'] }).expense,
    900,
  );
  await repo.saveTransaction(
    { ...receipt, category_ids_json: '[]', tag_ids_json: '[]' },
    true,
  );
  const onlyChild = await repo.snapshot();
  assert.equal(
    statistics(onlyChild, { ...filters, tags: ['home-tag'] }).expense,
    360,
  );
});
test('item tag archival preserves existing assignments but blocks new use and malformed item tags', async (t) => {
  const { repo } = await fixture(t);
  const receipt = await receiptWithItemTags(repo);
  await repo.saveTransaction(receipt, false);
  await repo.deleteTag('food-tag');
  let data = await repo.snapshot();
  assert.equal(data.tags.find((tag) => tag.id === 'food-tag').is_archived, 1);
  await repo.saveTransaction(receipt, true);
  const before = await repo.snapshot();
  for (const json of ['{', '["missing"]', '["food-tag","food-tag"]']) {
    await assert.rejects(
      repo.saveTransaction(
        {
          ...receipt,
          items: [
            { ...receipt.items[0], tag_ids_json: json },
            receipt.items[1],
          ],
        },
        true,
      ),
    );
    assert.deepEqual(await repo.snapshot(), before);
  }
  const another = {
    ...receipt,
    id: 'new-receipt',
    items: receipt.items.map((item) => ({
      ...item,
      id: `new-${item.id}`,
      transaction_id: 'new-receipt',
    })),
  };
  await assert.rejects(repo.saveTransaction(another, false), /lưu trữ/);
  await repo.saveTransaction(
    {
      ...receipt,
      amount: 360,
      items: [{ ...receipt.items[1], sort_order: 0 }],
    },
    true,
  );
  data = await repo.snapshot();
  assert.equal(statistics(data, filters).tags['food-tag'], undefined);
  assert.equal(accountBalances(data).cash, 640);
});
test('item tags survive backup and CSV, reject legacy versions and reset with their receipt', async (t) => {
  const { repo } = await fixture(t);
  const receipt = await receiptWithItemTags(repo);
  await repo.saveTransaction(receipt, false);
  const backup = await repo.backup();
  const before = await repo.snapshot();
  assert.equal(backup.version, 19);
  await repo.restore(parseBackup(JSON.stringify(backup)));
  assert.deepEqual(await repo.snapshot(), before);
  const csv = transactionsCsv(before);
  const rows = csv.split('\r\n');
  assert.ok(
    rows.some(
      (row) => row.includes('Mục chi') && row.includes('Ăn uống | Cả hóa đơn'),
    ),
  );
  assert.ok(
    rows.some((row) => row.includes('Mục chi') && row.includes('Gia dụng')),
  );
  const legacy = structuredClone(backup);
  legacy.version = 13;
  await assert.rejects(async () => repo.restore(legacy), /phiên bản 14/);
  const bad = structuredClone(backup);
  bad.data.items[0].tag_ids_json = '["missing"]';
  await assert.rejects(async () => repo.restore(bad));
  assert.deepEqual(await repo.snapshot(), before);
  await repo.deleteTransaction(receipt.id);
  assert.deepEqual((await repo.snapshot()).items, []);
});

test('v14 migration preserves receipt items and their tags while adding empty multi-category labels', async (t) => {
  const { repo, db } = await fixture(t);
  const receipt = await receiptWithItemTags(repo);
  await repo.saveTransaction(receipt, false);
  const before = await repo.snapshot();
  db.exec(
    'DROP TRIGGER items_one_category_insert; DROP TRIGGER items_one_category_update; DROP TRIGGER transactions_one_category_insert; DROP TRIGGER transactions_one_category_update; ALTER TABLE transaction_items DROP COLUMN category_ids_json; ALTER TABLE loans DROP COLUMN payment_time_minutes; ALTER TABLE loans DROP COLUMN payment_day; ALTER TABLE loans DROP COLUMN direction; PRAGMA user_version=14',
  );
  await repo.initialize();
  assert.deepEqual(await repo.snapshot(), before);
  const legacy = await repo.backup();
  legacy.version = 14;
  for (const item of legacy.data.items) delete item.category_ids_json;
  await repo.restore(legacy);
  assert.deepEqual(await repo.snapshot(), before);
  await repo.initialize();
  assert.deepEqual(await repo.snapshot(), before);
});

function insertLegacyTransaction(db, transaction) {
  db.prepare(
    'INSERT INTO transactions (id,type,title,amount,source_account_id,destination_account_id,category_id,note,occurred_at,created_at,updated_at,adjustments_json,exclude_from_balance,category_split,category_ids_json,tag_ids_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).run(
    transaction.id,
    transaction.type,
    transaction.title.trim() || 'Trống',
    transaction.amount,
    transaction.source_account_id,
    transaction.destination_account_id,
    transaction.category_id,
    transaction.note,
    transaction.occurred_at,
    transaction.created_at,
    transaction.updated_at,
    transaction.adjustments_json ?? '[]',
    transaction.exclude_from_balance ?? 0,
    transaction.category_split ?? 0,
    transaction.category_ids_json ?? '[]',
    transaction.tag_ids_json ?? '[]',
  );
  for (const item of transaction.items)
    db.prepare(
      'INSERT INTO transaction_items (id,transaction_id,name,amount,category_id,sort_order,tag_ids_json,category_ids_json) VALUES (?,?,?,?,?,?,?,?)',
    ).run(
      item.id,
      item.transaction_id,
      item.name,
      item.amount,
      item.category_id,
      item.sort_order,
      item.tag_ids_json ?? '[]',
      item.category_ids_json ?? '[]',
    );
}
function emulateV15(db) {
  db.exec(
    'DROP TRIGGER items_one_category_insert; DROP TRIGGER items_one_category_update; DROP TRIGGER transactions_one_category_insert; DROP TRIGGER transactions_one_category_update; ALTER TABLE loans DROP COLUMN payment_time_minutes; ALTER TABLE loans DROP COLUMN payment_day; ALTER TABLE loans DROP COLUMN direction; PRAGMA user_version=15;',
  );
}
test('new transactions choose exactly one category and adding a second category is rejected without financial changes', async (t) => {
  const { repo } = await fixture(t);
  const data = await repo.snapshot();
  const rows = [{ id: 'one', category: 'default-expense-0', amount: '' }];
  const selected = prepareTransactionCategories(
    'single',
    'expense',
    '100',
    rows,
    data.categories,
  );
  assert.equal(selected.category_id, 'default-expense-0');
  assert.equal(selected.category_ids_json, '[]');
  assert.throws(
    () =>
      prepareTransactionCategories(
        'single',
        'expense',
        '100',
        [],
        data.categories,
      ),
    /đúng một/,
  );
  assert.throws(
    () =>
      prepareTransactionCategories(
        'single',
        'expense',
        '100',
        [...rows, { id: 'two', category: 'default-expense-1', amount: '' }],
        data.categories,
      ),
    /đúng một/,
  );
  await repo.saveTransaction(
    draft('expense', { ...selected, items: [] }),
    false,
  );
  const before = await repo.snapshot();
  await assert.rejects(
    repo.saveTransaction(
      draft('expense', {
        category_ids_json: '["default-expense-0","default-expense-1"]',
      }),
      false,
    ),
    /một danh mục/,
  );
  await assert.rejects(
    repo.saveTransaction(splitDraft('income'), false),
    /một danh mục/,
  );
  const receipt = adjustedDraft();
  receipt.items[0].category_ids_json =
    '["default-expense-0","default-expense-1"]';
  await assert.rejects(repo.saveTransaction(receipt, false), /một danh mục/);
  assert.deepEqual(await repo.snapshot(), before);
});
test('v15 upgrade collapses multi-category labels and legacy splits to their first category without changing balances, tags or real receipt items', async (t) => {
  const { repo, db } = await fixture(t, 5000);
  await repo.saveTag({
    id: 'keep-tag',
    name: 'Giữ tag',
    color: '#287D68',
    is_archived: 0,
  });
  emulateV15(db);
  const expense = draft('expense', {
    category_ids_json: '["default-expense-0","default-expense-1"]',
  });
  const receipt = adjustedDraft();
  receipt.items[0].category_ids_json =
    '["default-expense-0","default-expense-1"]';
  receipt.items[0].tag_ids_json = '["keep-tag"]';
  const incomeSplit = splitDraft('income');
  const expenseSplit = splitDraft('expense');
  for (const transaction of [expense, receipt, incomeSplit, expenseSplit])
    insertLegacyTransaction(db, transaction);
  const before = await repo.snapshot();
  const legacy = await repo.backup();
  legacy.version = 15;
  await repo.initialize();
  const after = await repo.snapshot();
  assert.deepEqual(accountBalances(after), accountBalances(before));
  assert.deepEqual(
    after.transactions.map((tx) => [tx.id, tx.amount, tx.title, tx.note]),
    before.transactions.map((tx) => [tx.id, tx.amount, tx.title, tx.note]),
  );
  assert.ok(
    after.transactions.every(
      (tx) => tx.category_split === 0 && tx.category_ids_json === '[]',
    ),
  );
  assert.equal(
    after.transactions.find((tx) => tx.id === incomeSplit.id).category_id,
    incomeSplit.items[0].category_id,
  );
  assert.equal(
    after.transactions.find((tx) => tx.id === expenseSplit.id).category_id,
    expenseSplit.items[0].category_id,
  );
  assert.equal(after.items.length, receipt.items.length);
  assert.equal(
    after.items.find((item) => item.id === receipt.items[0].id).tag_ids_json,
    '["keep-tag"]',
  );
  assert.ok(after.items.every((item) => item.category_ids_json === '[]'));
  assert.deepEqual(after.categories, before.categories);
  assert.equal(
    statistics(after, filters).expense,
    expense.amount + receipt.amount + expenseSplit.amount,
  );
  await repo.initialize();
  assert.deepEqual(await repo.snapshot(), after);
  await repo.restore(legacy);
  assert.deepEqual(await repo.snapshot(), after);
  assert.throws(() =>
    db
      .prepare('UPDATE transactions SET category_ids_json=? WHERE id=?')
      .run('["default-expense-0","default-expense-1"]', expense.id),
  );
  assert.throws(() =>
    db
      .prepare('UPDATE transaction_items SET category_ids_json=? WHERE id=?')
      .run('["default-expense-0","default-expense-1"]', receipt.items[0].id),
  );
});
test('legacy backups flatten category levels and choose the first label, while malformed new backups cannot overwrite data', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTransaction(draft('expense'), false);
  const legacy = await repo.backup();
  legacy.version = 15;
  legacy.data.categories.find((c) => c.id === 'default-expense-1').parent_id =
    'default-expense-0';
  legacy.data.categories.find((c) => c.id === 'default-expense-2').parent_id =
    'default-expense-1';
  legacy.data.transactions[0].category_ids_json =
    '["default-expense-0","default-expense-1"]';
  const beforeBalance = accountBalances(legacy.data);
  await repo.restore(legacy);
  const data = await repo.snapshot();
  assert.deepEqual(accountBalances(data), beforeBalance);
  assert.ok(data.categories.every((c) => c.parent_id === null));
  assert.equal(data.transactions[0].category_id, 'default-expense-0');
  assert.equal(data.transactions[0].category_ids_json, '[]');
  assert.deepEqual(
    data.categories.map((c) => [c.id, c.name]),
    legacy.data.categories.map((c) => [c.id, c.name]),
  );
  const backup = await repo.backup();
  assert.equal(backup.version, 19);
  assert.deepEqual(parseBackup(JSON.stringify(backup)), backup);
  backup.data.transactions[0].category_ids_json =
    '["default-expense-0","default-expense-1"]';
  await assert.rejects(async () => repo.restore(backup), /một danh mục/);
  assert.deepEqual(await repo.snapshot(), data);
});
test('single-category receipt items retain independent tags and adjusted category totals after editing and CSV export', async (t) => {
  const { repo } = await fixture(t);
  const receipt = await receiptWithItemTags(repo);
  await repo.saveTransaction(receipt, false);
  const saved = await repo.snapshot();
  assert.equal(saved.transactions[0].category_id, null);
  assert.equal(saved.transactions[0].category_ids_json, '[]');
  assert.ok(saved.items.every((item) => item.category_ids_json === '[]'));
  assert.equal(statistics(saved, filters).expense, 900);
  assert.equal(statistics(saved, filters).categories['default-expense-0'], 540);
  assert.equal(
    statistics(saved, { ...filters, tags: ['food-tag'] }).expense,
    540,
  );
  assert.ok(transactionsCsv(saved).includes('Gia dụng'));
  const edited = {
    ...receipt,
    items: receipt.items.map((item, index) => ({
      ...item,
      category_id: index === 0 ? 'default-expense-1' : item.category_id,
    })),
  };
  await repo.saveTransaction(edited, true);
  const data = await repo.snapshot();
  assert.equal(accountBalances(data).cash, 100);
  assert.equal(statistics(data, filters).categories['default-expense-1'], 540);
  assert.equal(
    statistics(data, filters).categories['default-expense-0'],
    undefined,
  );
});
