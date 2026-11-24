export const SCHEMA_VERSION = 22;
export const migration22 = `
CREATE TABLE IF NOT EXISTS third_party_cases (
 id TEXT PRIMARY KEY NOT NULL,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 person TEXT NOT NULL CHECK(length(trim(person)) BETWEEN 1 AND 100),
 description TEXT NOT NULL DEFAULT '', expected_amount INTEGER CHECK(expected_amount IS NULL OR (typeof(expected_amount)='integer' AND expected_amount BETWEEN 0 AND 9007199254740991)),
 started_at TEXT NOT NULL, due_at TEXT, note TEXT NOT NULL DEFAULT '', tag_ids_json TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL CHECK(status IN ('pending','in_progress','fulfilled','completed','cancelled')),
 completed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0 CHECK(typeof(revision)='integer' AND revision>=0),
 CHECK((status='completed' AND completed_at IS NOT NULL) OR (status<>'completed' AND completed_at IS NULL))
);
CREATE TABLE IF NOT EXISTS third_party_settlements (
 id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES third_party_cases(id) ON DELETE RESTRICT,
 request_json TEXT NOT NULL, created_at TEXT NOT NULL, undone_at TEXT
);
CREATE TABLE IF NOT EXISTS third_party_entries (
 id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES third_party_cases(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('receive','payment','refund','reimbursement','payment_refund','settlement_income','settlement_expense')),
 amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount BETWEEN 1 AND 9007199254740991),
 account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
 category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
 related_entry_id TEXT REFERENCES third_party_entries(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
 settlement_id TEXT REFERENCES third_party_settlements(id) ON DELETE RESTRICT,
 tag_ids_json TEXT NOT NULL DEFAULT '[]', note TEXT NOT NULL DEFAULT '',
 occurred_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 sequence INTEGER NOT NULL UNIQUE CHECK(typeof(sequence)='integer' AND sequence BETWEEN 1 AND 9007199254740991),
 CHECK((kind IN ('settlement_income','settlement_expense') AND account_id IS NULL AND category_id IS NOT NULL) OR (kind NOT IN ('settlement_income','settlement_expense') AND account_id IS NOT NULL AND category_id IS NULL)),
 CHECK((kind='payment_refund' AND related_entry_id IS NOT NULL) OR (kind<>'payment_refund' AND related_entry_id IS NULL))
);
CREATE INDEX IF NOT EXISTS third_party_cases_person_status ON third_party_cases(person,status,started_at);
CREATE INDEX IF NOT EXISTS third_party_entries_case_date ON third_party_entries(case_id,occurred_at,sequence);
CREATE INDEX IF NOT EXISTS third_party_entries_account_date ON third_party_entries(account_id,occurred_at);
CREATE INDEX IF NOT EXISTS third_party_entries_payment ON third_party_entries(related_entry_id);
CREATE INDEX IF NOT EXISTS third_party_entries_settlement ON third_party_entries(settlement_id);
CREATE INDEX IF NOT EXISTS third_party_entries_category ON third_party_entries(category_id,occurred_at);
CREATE INDEX IF NOT EXISTS third_party_settlements_case ON third_party_settlements(case_id);
PRAGMA user_version=22;
`;
export const migration21 = `
CREATE TABLE IF NOT EXISTS purchases (
 id TEXT PRIMARY KEY NOT NULL,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 person TEXT NOT NULL CHECK(length(trim(person)) BETWEEN 1 AND 100),
 amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount BETWEEN 1 AND 9007199254740991),
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 note TEXT NOT NULL DEFAULT '', due_at TEXT,
 occurred_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS purchase_refunds (
 id TEXT PRIMARY KEY NOT NULL,
 purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
 amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount BETWEEN 1 AND 9007199254740991),
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 note TEXT NOT NULL DEFAULT '', occurred_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS purchase_refunds_purchase ON purchase_refunds(purchase_id);
CREATE INDEX IF NOT EXISTS purchases_account ON purchases(account_id,occurred_at);
CREATE INDEX IF NOT EXISTS purchase_refunds_account ON purchase_refunds(account_id,occurred_at);
PRAGMA user_version=21;
`;
export const migration20 = `
CREATE TABLE IF NOT EXISTS transaction_drafts (
 id TEXT PRIMARY KEY NOT NULL,
 values_json TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
PRAGMA user_version=20;
`;
export const migration19 = `
ALTER TABLE loans ADD COLUMN payment_time_minutes INTEGER NOT NULL DEFAULT 540 CHECK(typeof(payment_time_minutes)='integer' AND payment_time_minutes BETWEEN 0 AND 1439);
PRAGMA user_version=19;
`;
export const migration18 = `
ALTER TABLE loans ADD COLUMN payment_day INTEGER CHECK(payment_day IS NULL OR (typeof(payment_day)='integer' AND payment_day BETWEEN 1 AND 31 AND due_at IS NOT NULL));
PRAGMA user_version=18;
`;
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

export const migration7 = `
UPDATE categories SET parent_id=NULL WHERE parent_id IS NOT NULL;
CREATE TRIGGER categories_single_level_insert BEFORE INSERT ON categories
WHEN NEW.parent_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'Categories must have a single level'); END;
CREATE TRIGGER categories_single_level_update BEFORE UPDATE OF parent_id ON categories
WHEN NEW.parent_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'Categories must have a single level'); END;
PRAGMA user_version=7;
`;

export const migration8 = `
CREATE TABLE tags (
 id TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 50),
 name_key TEXT NOT NULL UNIQUE,
 color TEXT NOT NULL,
 is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0,1))
);
ALTER TABLE transactions ADD COLUMN tag_ids_json TEXT NOT NULL DEFAULT '[]';
PRAGMA user_version=8;
`;

export const migration9 = `
CREATE TABLE loans (
 id TEXT PRIMARY KEY NOT NULL,
 lender TEXT NOT NULL CHECK(length(trim(lender)) BETWEEN 1 AND 100),
 amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount BETWEEN 1 AND 9007199254740991),
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 note TEXT NOT NULL DEFAULT '', occurred_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE loan_payments (
 id TEXT PRIMARY KEY NOT NULL,
 loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
 amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount BETWEEN 1 AND 9007199254740991),
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 occurred_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX loan_payments_loan ON loan_payments(loan_id);
PRAGMA user_version=9;
`;

export const migration10 = `
ALTER TABLE loans ADD COLUMN due_at TEXT;
ALTER TABLE loans ADD COLUMN costs_json TEXT NOT NULL DEFAULT '[]';
PRAGMA user_version=10;
`;

export const migration11 = `
ALTER TABLE loans ADD COLUMN exclude_from_balance INTEGER NOT NULL DEFAULT 0 CHECK(exclude_from_balance IN (0,1));
PRAGMA user_version=11;
`;

export const migration12 = `
ALTER TABLE loan_payments ADD COLUMN fee_amount INTEGER NOT NULL DEFAULT 0 CHECK(typeof(fee_amount)='integer' AND fee_amount BETWEEN 0 AND 9007199254740991);
PRAGMA user_version=12;
`;

// Receipt-level category labels can coexist with item-level allocations.
export const migration13 = `PRAGMA user_version=13;`;

export const migration14 = `
ALTER TABLE transaction_items ADD COLUMN tag_ids_json TEXT NOT NULL DEFAULT '[]';
PRAGMA user_version=14;
`;

export const migration15 = `
ALTER TABLE transaction_items ADD COLUMN category_ids_json TEXT NOT NULL DEFAULT '[]';
PRAGMA user_version=15;
`;

export const migration17 = `
ALTER TABLE loans ADD COLUMN direction TEXT NOT NULL DEFAULT 'borrow' CHECK(direction IN ('borrow','lend'));
PRAGMA user_version=17;
`;

export const migration16 = `
UPDATE categories SET parent_id=NULL WHERE parent_id IS NOT NULL;
UPDATE transactions SET category_id=COALESCE(json_extract(category_ids_json,'$[0]'),category_id,(SELECT category_id FROM transaction_items WHERE transaction_id=transactions.id ORDER BY sort_order,id LIMIT 1))
WHERE type<>'transfer' AND (category_split=1 OR NOT EXISTS(SELECT 1 FROM transaction_items WHERE transaction_id=transactions.id));
DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE category_split=1);
UPDATE transactions SET category_split=0,category_ids_json='[]';
UPDATE transaction_items SET category_id=COALESCE(json_extract(category_ids_json,'$[0]'),category_id),category_ids_json='[]';
CREATE TRIGGER transactions_one_category_insert BEFORE INSERT ON transactions
WHEN NEW.category_split<>0 OR json_type(NEW.category_ids_json)<>'array' OR json_array_length(NEW.category_ids_json)>1 OR (json_array_length(NEW.category_ids_json)=1 AND (NEW.category_id IS NULL OR json_extract(NEW.category_ids_json,'$[0]')<>NEW.category_id))
BEGIN SELECT RAISE(ABORT,'Only one category per transaction'); END;
CREATE TRIGGER transactions_one_category_update BEFORE UPDATE ON transactions
WHEN NEW.category_split<>0 OR json_type(NEW.category_ids_json)<>'array' OR json_array_length(NEW.category_ids_json)>1 OR (json_array_length(NEW.category_ids_json)=1 AND (NEW.category_id IS NULL OR json_extract(NEW.category_ids_json,'$[0]')<>NEW.category_id))
BEGIN SELECT RAISE(ABORT,'Only one category per transaction'); END;
CREATE TRIGGER items_one_category_insert BEFORE INSERT ON transaction_items
WHEN json_type(NEW.category_ids_json)<>'array' OR json_array_length(NEW.category_ids_json)>1 OR (json_array_length(NEW.category_ids_json)=1 AND json_extract(NEW.category_ids_json,'$[0]')<>NEW.category_id)
BEGIN SELECT RAISE(ABORT,'Only one category per receipt item'); END;
CREATE TRIGGER items_one_category_update BEFORE UPDATE ON transaction_items
WHEN json_type(NEW.category_ids_json)<>'array' OR json_array_length(NEW.category_ids_json)>1 OR (json_array_length(NEW.category_ids_json)=1 AND json_extract(NEW.category_ids_json,'$[0]')<>NEW.category_id)
BEGIN SELECT RAISE(ABORT,'Only one category per receipt item'); END;
PRAGMA user_version=16;
`;
