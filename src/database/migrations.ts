export const SCHEMA_VERSION = 6;
export const migration1 = `
CREATE TABLE accounts (
 id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 type TEXT NOT NULL CHECK(type IN ('cash','bank')),
 opening_balance INTEGER NOT NULL CHECK(typeof(opening_balance)='integer' AND opening_balance BETWEEN 0 AND 9007199254740991),
 is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX one_cash ON accounts(type) WHERE type='cash';
CREATE TABLE categories (
 id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 type TEXT NOT NULL CHECK(type IN ('income','expense')), icon TEXT NOT NULL, color TEXT NOT NULL,
 sort_order INTEGER NOT NULL, is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0,1))
);
CREATE TABLE transactions (
 id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount BETWEEN 1 AND 9007199254740991),
 source_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
 destination_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
 category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
 note TEXT NOT NULL DEFAULT '', occurred_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK((type='income' AND source_account_id IS NULL AND destination_account_id IS NOT NULL AND category_id IS NOT NULL)
 OR (type='expense' AND source_account_id IS NOT NULL AND destination_account_id IS NULL)
 OR (type='transfer' AND source_account_id IS NOT NULL AND destination_account_id IS NOT NULL AND source_account_id<>destination_account_id AND category_id IS NULL))
);
CREATE TABLE transaction_items (
 id TEXT PRIMARY KEY NOT NULL, transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount BETWEEN 1 AND 9007199254740991),
 category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT, sort_order INTEGER NOT NULL
);
CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE INDEX transactions_date ON transactions(occurred_at,created_at,id);
CREATE INDEX transactions_source ON transactions(source_account_id,occurred_at);
CREATE INDEX transactions_destination ON transactions(destination_account_id,occurred_at);
CREATE INDEX transactions_category ON transactions(category_id);
CREATE INDEX items_transaction ON transaction_items(transaction_id,sort_order);
CREATE INDEX items_category ON transaction_items(category_id);
PRAGMA user_version=1;
`;
export const migration2 = `
ALTER TABLE transactions ADD COLUMN adjustments_json TEXT NOT NULL DEFAULT '[]';
PRAGMA user_version=2;
`;

export const migration3 = `
ALTER TABLE transactions ADD COLUMN exclude_from_balance INTEGER NOT NULL DEFAULT 0 CHECK(exclude_from_balance IN (0,1));
PRAGMA user_version=3;
`;

export const migration4 = `
ALTER TABLE categories ADD COLUMN parent_id TEXT REFERENCES categories(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX categories_parent ON categories(parent_id,sort_order);
PRAGMA user_version=4;
`;

export const migration5 = `
ALTER TABLE transactions ADD COLUMN category_split INTEGER NOT NULL DEFAULT 0 CHECK(category_split IN (0,1));
PRAGMA user_version=5;
`;

export const migration6 = `
ALTER TABLE transactions ADD COLUMN category_ids_json TEXT NOT NULL DEFAULT '[]';
UPDATE transactions SET category_ids_json=(
 SELECT json_group_array(category_id) FROM (
   SELECT category_id FROM transaction_items WHERE transaction_id=transactions.id ORDER BY sort_order,id
 )
) WHERE category_split=1;
PRAGMA user_version=6;
`;
