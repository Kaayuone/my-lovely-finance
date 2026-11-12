export type Migration = {
  version: number;
  statements: string[];
};

/**
 * The whole schema of the database, step by step: a fresh install runs every step from the first,
 * an older database runs the ones it has not seen (ADR-0002). Append-only — a step that has reached
 * a user's phone is never edited; a fix is a new step (docs/workflows/migrations.md).
 *
 * The native plugin cuts the text of a statement at every `;` that ends a line, glues back only an
 * `END` standing on a line of its own, and drops everything from `--` to the end of the line. So a
 * trigger body holds exactly one statement followed by `END` on its own line, and `--` appears
 * nowhere in the SQL, not even inside a literal.
 */
export const MIGRATIONS: Migration[] = [
  // The first data model: accounts and their cards, the two-level categories with the built-in tree
  // and operations (ADR-0005, ADR-0006). The database itself refuses a row that breaks the money and
  // category invariants, so a bug in the code above it cannot write one.
  //
  // A transfer fee is stored negative like any expense: the source account loses
  // `amount_minor + fee_minor`. A category never changes its parent or kind after it is inserted,
  // which keeps it from becoming a third level or leaving the kind of its parent. Later migrations
  // find the built-in categories by `code`, a subcategory's being `<main code>.<slug>`.
  {
    version: 1,
    statements: [
      `CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        type TEXT NOT NULL CHECK (type IN ('card', 'cash')),
        currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
        opening_balance_minor INTEGER NOT NULL DEFAULT 0 CHECK (typeof(opening_balance_minor) = 'integer'),
        bank_package TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      `CREATE TRIGGER accounts_update_updated_at
        AFTER UPDATE ON accounts
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at
        BEGIN
          UPDATE accounts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
        END`,
      `CREATE TABLE account_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        last_digits TEXT NOT NULL CHECK (last_digits GLOB '[0-9][0-9][0-9][0-9]'),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (account_id, last_digits)
      )`,
      'CREATE INDEX account_cards_last_digits ON account_cards (last_digits)',
      `CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER REFERENCES categories (id) ON DELETE RESTRICT,
        kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
        code TEXT UNIQUE,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (parent_id IS NOT NULL OR code IS NOT NULL)
      )`,
      'CREATE UNIQUE INDEX categories_main_name ON categories (kind, name) WHERE parent_id IS NULL',
      'CREATE UNIQUE INDEX categories_sub_name ON categories (parent_id, name) WHERE parent_id IS NOT NULL',
      `CREATE TRIGGER categories_update_updated_at
        AFTER UPDATE ON categories
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at
        BEGIN
          UPDATE categories SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
        END`,
      `CREATE TRIGGER categories_parent_check
        BEFORE INSERT ON categories
        FOR EACH ROW
        WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM categories WHERE id = NEW.parent_id AND parent_id IS NULL AND kind = NEW.kind
        )
        BEGIN
          SELECT RAISE(ABORT, 'category parent must be a main category of the same kind');
        END`,
      `CREATE TRIGGER categories_parent_kind_immutable
        BEFORE UPDATE OF parent_id, kind ON categories
        FOR EACH ROW
        WHEN NEW.parent_id IS NOT OLD.parent_id OR NEW.kind <> OLD.kind
        BEGIN
          SELECT RAISE(ABORT, 'category parent and kind cannot change');
        END`,
      `CREATE TABLE operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'transfer', 'adjustment')),
        account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
        amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor <> 0),
        to_account_id INTEGER REFERENCES accounts (id) ON DELETE RESTRICT,
        to_amount_minor INTEGER CHECK (to_amount_minor IS NULL OR (typeof(to_amount_minor) = 'integer' AND to_amount_minor > 0)),
        fee_minor INTEGER CHECK (fee_minor IS NULL OR (typeof(fee_minor) = 'integer' AND fee_minor < 0)),
        fee_category_id INTEGER REFERENCES categories (id) ON DELETE RESTRICT,
        category_id INTEGER REFERENCES categories (id) ON DELETE RESTRICT,
        payee TEXT,
        note TEXT,
        original_amount_minor INTEGER CHECK (original_amount_minor IS NULL OR typeof(original_amount_minor) = 'integer'),
        original_currency TEXT CHECK (original_currency IS NULL OR original_currency GLOB '[A-Z][A-Z][A-Z]'),
        occurred_at INTEGER NOT NULL CHECK (typeof(occurred_at) = 'integer'),
        utc_offset_min INTEGER NOT NULL CHECK (typeof(utc_offset_min) = 'integer' AND utc_offset_min BETWEEN -840 AND 840),
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'notification')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK ((kind = 'transfer') = (to_account_id IS NOT NULL)),
        CHECK ((kind = 'transfer') = (to_amount_minor IS NOT NULL)),
        CHECK (kind <> 'transfer' OR (amount_minor < 0 AND to_account_id <> account_id)),
        CHECK (kind <> 'income' OR amount_minor > 0),
        CHECK ((fee_minor IS NULL) = (fee_category_id IS NULL)),
        CHECK (fee_minor IS NULL OR kind = 'transfer'),
        CHECK (category_id IS NULL OR kind IN ('expense', 'income')),
        CHECK (kind IN ('expense', 'income') OR (payee IS NULL AND original_amount_minor IS NULL)),
        CHECK ((original_amount_minor IS NULL) = (original_currency IS NULL))
      )`,
      'CREATE INDEX operations_account_amount ON operations (account_id, amount_minor, fee_minor)',
      'CREATE INDEX operations_to_account_amount ON operations (to_account_id, to_amount_minor) WHERE to_account_id IS NOT NULL',
      'CREATE INDEX operations_occurred_at ON operations (occurred_at)',
      'CREATE INDEX operations_category ON operations (category_id) WHERE category_id IS NOT NULL',
      'CREATE INDEX operations_fee_category ON operations (fee_category_id) WHERE fee_category_id IS NOT NULL',
      `CREATE TRIGGER operations_update_updated_at
        AFTER UPDATE ON operations
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at
        BEGIN
          UPDATE operations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
        END`,
      `CREATE TRIGGER operations_category_kind_insert
        BEFORE INSERT ON operations
        FOR EACH ROW
        WHEN NEW.category_id IS NOT NULL
          AND (SELECT kind FROM categories WHERE id = NEW.category_id) IS NOT NEW.kind
        BEGIN
          SELECT RAISE(ABORT, 'operation category kind mismatch');
        END`,
      `CREATE TRIGGER operations_category_kind_update
        BEFORE UPDATE OF category_id, kind ON operations
        FOR EACH ROW
        WHEN NEW.category_id IS NOT NULL
          AND (SELECT kind FROM categories WHERE id = NEW.category_id) IS NOT NEW.kind
        BEGIN
          SELECT RAISE(ABORT, 'operation category kind mismatch');
        END`,
      `CREATE TRIGGER operations_fee_category_kind_insert
        BEFORE INSERT ON operations
        FOR EACH ROW
        WHEN NEW.fee_category_id IS NOT NULL
          AND (SELECT kind FROM categories WHERE id = NEW.fee_category_id) IS NOT 'expense'
        BEGIN
          SELECT RAISE(ABORT, 'fee category must be an expense category');
        END`,
      `CREATE TRIGGER operations_fee_category_kind_update
        BEFORE UPDATE OF fee_category_id ON operations
        FOR EACH ROW
        WHEN NEW.fee_category_id IS NOT NULL
          AND (SELECT kind FROM categories WHERE id = NEW.fee_category_id) IS NOT 'expense'
        BEGIN
          SELECT RAISE(ABORT, 'fee category must be an expense category');
        END`,
      `INSERT INTO categories (kind, code, name, sort_order) VALUES
        ('expense', 'food', 'Еда и напитки', 1),
        ('expense', 'transport', 'Транспорт', 2),
        ('expense', 'auto', 'Авто', 3),
        ('expense', 'housing', 'Жильё', 4),
        ('expense', 'telecom', 'Связь и интернет', 5),
        ('expense', 'digital', 'Цифровые сервисы', 6),
        ('expense', 'health', 'Здоровье', 7),
        ('expense', 'beauty', 'Красота и уход', 8),
        ('expense', 'sport', 'Спорт', 9),
        ('expense', 'shopping', 'Покупки', 10),
        ('expense', 'entertainment', 'Развлечения', 11),
        ('expense', 'travel', 'Путешествия', 12),
        ('expense', 'education', 'Образование', 13),
        ('expense', 'kids', 'Дети', 14),
        ('expense', 'pets', 'Питомцы', 15),
        ('expense', 'gifts', 'Подарки', 16),
        ('expense', 'services', 'Услуги', 17),
        ('expense', 'finance', 'Финансы', 18),
        ('expense', 'other', 'Другое', 19)`,
      `INSERT INTO categories (kind, code, name, sort_order) VALUES
        ('income', 'salary', 'Зарплата', 1),
        ('income', 'side_income', 'Подработка', 2),
        ('income', 'interest', 'Проценты', 3),
        ('income', 'cashback', 'Кешбэк', 4),
        ('income', 'gifts_received', 'Подарки', 5),
        ('income', 'sale', 'Продажа', 6),
        ('income', 'compensation', 'Компенсации', 7),
        ('income', 'other_income', 'Другое', 8)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'food'), 'expense', 'food.groceries', 'Продукты', 1),
        ((SELECT id FROM categories WHERE code = 'food'), 'expense', 'food.restaurants', 'Кафе и рестораны', 2),
        ((SELECT id FROM categories WHERE code = 'food'), 'expense', 'food.fastfood', 'Фастфуд', 3),
        ((SELECT id FROM categories WHERE code = 'food'), 'expense', 'food.delivery', 'Доставка еды', 4)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'transport'), 'expense', 'transport.fare', 'Проезд', 1),
        ((SELECT id FROM categories WHERE code = 'transport'), 'expense', 'transport.taxi', 'Такси', 2),
        ((SELECT id FROM categories WHERE code = 'transport'), 'expense', 'transport.rent', 'Аренда', 3)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'auto'), 'expense', 'auto.fuel', 'Топливо и зарядка', 1),
        ((SELECT id FROM categories WHERE code = 'auto'), 'expense', 'auto.service', 'Ремонт и ТО', 2),
        ((SELECT id FROM categories WHERE code = 'auto'), 'expense', 'auto.wash', 'Мойка', 3),
        ((SELECT id FROM categories WHERE code = 'auto'), 'expense', 'auto.goods', 'Автотовары', 4),
        ((SELECT id FROM categories WHERE code = 'auto'), 'expense', 'auto.parking', 'Парковка', 5),
        ((SELECT id FROM categories WHERE code = 'auto'), 'expense', 'auto.tolls', 'Платные дороги', 6),
        ((SELECT id FROM categories WHERE code = 'auto'), 'expense', 'auto.insurance', 'Страховка авто', 7),
        ((SELECT id FROM categories WHERE code = 'auto'), 'expense', 'auto.fines', 'Штрафы', 8),
        ((SELECT id FROM categories WHERE code = 'auto'), 'expense', 'auto.leasing', 'Лизинг и кредит', 9)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'housing'), 'expense', 'housing.rent', 'Аренда', 1),
        ((SELECT id FROM categories WHERE code = 'housing'), 'expense', 'housing.mortgage', 'Ипотека', 2),
        ((SELECT id FROM categories WHERE code = 'housing'), 'expense', 'housing.utilities', 'Коммуналка', 3),
        ((SELECT id FROM categories WHERE code = 'housing'), 'expense', 'housing.repair', 'Ремонт', 4),
        ((SELECT id FROM categories WHERE code = 'housing'), 'expense', 'housing.insurance', 'Страховка жилья', 5)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'telecom'), 'expense', 'telecom.mobile', 'Мобильная связь', 1),
        ((SELECT id FROM categories WHERE code = 'telecom'), 'expense', 'telecom.internet', 'Интернет и ТВ', 2)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'digital'), 'expense', 'digital.streaming', 'Стриминг', 1),
        ((SELECT id FROM categories WHERE code = 'digital'), 'expense', 'digital.software', 'Софт', 2),
        ((SELECT id FROM categories WHERE code = 'digital'), 'expense', 'digital.games', 'Игры', 3),
        ((SELECT id FROM categories WHERE code = 'digital'), 'expense', 'digital.ingame', 'Покупки в играх', 4)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'health'), 'expense', 'health.pharmacy', 'Аптека', 1),
        ((SELECT id FROM categories WHERE code = 'health'), 'expense', 'health.doctors', 'Врачи', 2),
        ((SELECT id FROM categories WHERE code = 'health'), 'expense', 'health.insurance', 'Медстраховка', 3)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'beauty'), 'expense', 'beauty.hair', 'Парикмахерская', 1),
        ((SELECT id FROM categories WHERE code = 'beauty'), 'expense', 'beauty.cosmetics', 'Косметика', 2),
        ((SELECT id FROM categories WHERE code = 'beauty'), 'expense', 'beauty.manicure', 'Маникюр', 3),
        ((SELECT id FROM categories WHERE code = 'beauty'), 'expense', 'beauty.cosmetologist', 'Косметолог', 4)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'sport'), 'expense', 'sport.memberships', 'Абонементы', 1),
        ((SELECT id FROM categories WHERE code = 'sport'), 'expense', 'sport.goods', 'Спорттовары', 2)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'shopping'), 'expense', 'shopping.clothes', 'Одежда и обувь', 1),
        ((SELECT id FROM categories WHERE code = 'shopping'), 'expense', 'shopping.accessories', 'Аксессуары', 2),
        ((SELECT id FROM categories WHERE code = 'shopping'), 'expense', 'shopping.electronics', 'Электроника и техника', 3),
        ((SELECT id FROM categories WHERE code = 'shopping'), 'expense', 'shopping.household', 'Дом и быт', 4),
        ((SELECT id FROM categories WHERE code = 'shopping'), 'expense', 'shopping.furniture', 'Мебель', 5),
        ((SELECT id FROM categories WHERE code = 'shopping'), 'expense', 'shopping.books', 'Книги', 6)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'entertainment'), 'expense', 'entertainment.events', 'Мероприятия', 1),
        ((SELECT id FROM categories WHERE code = 'entertainment'), 'expense', 'entertainment.hobby', 'Хобби', 2)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'travel'), 'expense', 'travel.flights', 'Авиабилеты', 1),
        ((SELECT id FROM categories WHERE code = 'travel'), 'expense', 'travel.ground', 'Поезд и автобус', 2),
        ((SELECT id FROM categories WHERE code = 'travel'), 'expense', 'travel.lodging', 'Проживание', 3),
        ((SELECT id FROM categories WHERE code = 'travel'), 'expense', 'travel.visas', 'Визы и страховка', 4),
        ((SELECT id FROM categories WHERE code = 'travel'), 'expense', 'travel.tours', 'Экскурсии', 5)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'education'), 'expense', 'education.courses', 'Курсы', 1),
        ((SELECT id FROM categories WHERE code = 'education'), 'expense', 'education.tutors', 'Репетиторы', 2)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'kids'), 'expense', 'kids.clothes', 'Детская одежда', 1),
        ((SELECT id FROM categories WHERE code = 'kids'), 'expense', 'kids.toys', 'Игрушки', 2),
        ((SELECT id FROM categories WHERE code = 'kids'), 'expense', 'kids.school', 'Сад и школа', 3),
        ((SELECT id FROM categories WHERE code = 'kids'), 'expense', 'kids.activities', 'Кружки', 4)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'pets'), 'expense', 'pets.food', 'Корм', 1),
        ((SELECT id FROM categories WHERE code = 'pets'), 'expense', 'pets.vet', 'Ветеринар', 2),
        ((SELECT id FROM categories WHERE code = 'pets'), 'expense', 'pets.goods', 'Зоотовары', 3),
        ((SELECT id FROM categories WHERE code = 'pets'), 'expense', 'pets.grooming', 'Груминг', 4)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'gifts'), 'expense', 'gifts.flowers', 'Цветы', 1),
        ((SELECT id FROM categories WHERE code = 'gifts'), 'expense', 'gifts.charity', 'Благотворительность', 2)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'services'), 'expense', 'services.post', 'Почта и доставка', 1),
        ((SELECT id FROM categories WHERE code = 'services'), 'expense', 'services.household', 'Бытовые услуги', 2),
        ((SELECT id FROM categories WHERE code = 'services'), 'expense', 'services.legal', 'Юристы', 3)`,
      `INSERT INTO categories (parent_id, kind, code, name, sort_order) VALUES
        ((SELECT id FROM categories WHERE code = 'finance'), 'expense', 'finance.fees', 'Комиссии', 1),
        ((SELECT id FROM categories WHERE code = 'finance'), 'expense', 'finance.loans', 'Кредиты', 2),
        ((SELECT id FROM categories WHERE code = 'finance'), 'expense', 'finance.taxes', 'Налоги', 3),
        ((SELECT id FROM categories WHERE code = 'finance'), 'expense', 'finance.life_insurance', 'Страховка жизни', 4),
        ((SELECT id FROM categories WHERE code = 'finance'), 'expense', 'finance.investments', 'Инвестиции', 5)`,
    ],
  },
  // Drafts: what a captured notification told, waiting for the person to confirm it as an operation
  // (ADR-0003). The raw texts stay with the draft, so a newer template can read it again and the
  // person can teach one from it.
  //
  // A draft names the queue row it came from by its fingerprint, not by its id: when `capture.db` is
  // corrupt, Android creates it anew and its ids start from 1 again, and a unique id would silently
  // drop the new notifications. The amount is positive minor units with the direction beside it, as
  // the parser reads it; an amount and its currency are both there or both missing. A declined
  // operation is dismissed from the start. 'confirmed' is in the CHECK already: SQLite cannot change
  // a CHECK without rebuilding the table. The link to the operation a draft becomes comes with the
  // inbox, as a column of its own.
  {
    version: 2,
    statements: [
      `CREATE TABLE drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        capture_fingerprint TEXT NOT NULL UNIQUE,
        package_name TEXT NOT NULL,
        posted_at INTEGER NOT NULL CHECK (typeof(posted_at) = 'integer'),
        title TEXT,
        text TEXT,
        big_text TEXT,
        lines TEXT,
        template_id TEXT,
        amount_minor INTEGER CHECK (amount_minor IS NULL OR (typeof(amount_minor) = 'integer' AND amount_minor > 0)),
        currency TEXT CHECK (currency IS NULL OR currency GLOB '[A-Z][A-Z][A-Z]'),
        direction TEXT CHECK (direction IS NULL OR direction IN ('debit', 'credit')),
        bank_status TEXT CHECK (bank_status IS NULL OR bank_status IN ('ok', 'declined')),
        payee TEXT,
        card_digits TEXT CHECK (card_digits IS NULL OR card_digits GLOB '[0-9][0-9][0-9][0-9]'),
        balance_minor INTEGER CHECK (balance_minor IS NULL OR typeof(balance_minor) = 'integer'),
        occurred_at INTEGER NOT NULL CHECK (typeof(occurred_at) = 'integer'),
        utc_offset_min INTEGER NOT NULL CHECK (typeof(utc_offset_min) = 'integer' AND utc_offset_min BETWEEN -840 AND 840),
        state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'confirmed', 'dismissed')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK ((amount_minor IS NULL) = (currency IS NULL))
      )`,
      'CREATE INDEX drafts_state_occurred_at ON drafts (state, occurred_at)',
      `CREATE TRIGGER drafts_update_updated_at
        AFTER UPDATE ON drafts
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at
        BEGIN
          UPDATE drafts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
        END`,
    ],
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.at(-1)?.version ?? 0;
