import * as SQLite from 'expo-sqlite';
import { addDays, datesInRange } from '../utils/dateUtils';

const DB_NAME = 'tyagis_home.db';

let db = null;
// Tracks the in-flight open so concurrent callers share one connection attempt
// instead of each opening their own.
let openPromise = null;

// A closed/stale handle throws these instead of a normal SQL error. Android can
// close the native connection while the JS context survives (app backgrounded,
// OS reclaims resources), which leaves `db` pointing at a dead handle.
function isConnectionError(error) {
  const message = String(error?.message || error).toLowerCase();
  return (
    message.includes('closed resource') ||
    message.includes('database is closed') ||
    message.includes('access to closed') ||
    message.includes('null pointer') ||
    message.includes('nullpointerexception') ||
    message.includes('prepared statement') ||
    message.includes('has been finalized')
  );
}

export async function getDatabase() {
  if (db) return db;
  if (openPromise) return openPromise;

  openPromise = (async () => {
    const database = await SQLite.openDatabaseAsync(DB_NAME);
    await initializeDatabase(database);
    // Only publish the handle once it is fully initialized. Assigning earlier
    // would let a failed init leave a broken handle cached forever, which the
    // `if (db)` short-circuit above would then hand out on every later call.
    db = database;
    return database;
  })();

  try {
    return await openPromise;
  } catch (error) {
    // Never cache a failed connection - the next call gets a clean retry.
    db = null;
    throw error;
  } finally {
    openPromise = null;
  }
}

// Drops the cached handle so the next getDatabase() opens a fresh connection.
export async function resetDatabase() {
  const stale = db;
  db = null;
  openPromise = null;
  if (stale) {
    try {
      await stale.closeAsync();
    } catch {
      // Already closed or unusable - nothing to clean up.
    }
  }
}

// Runs a database operation, reopening and retrying if the connection turns out
// to be stale. Retries a few times with a short backoff rather than once: the
// handle can be closed and reopened by another caller (the background task
// finishing, or a reconnect) while this query is in flight, and a single retry
// can land inside that same window and fail again.
//
// On failure it only drops the cached handle - it does not close the connection,
// because another in-flight query may still be using it. Closing here is what
// turned a recoverable blip into a visible error.
const MAX_ATTEMPTS = 4;

async function withDatabase(operation) {
  let lastError;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const database = await getDatabase();
      return await operation(database);
    } catch (error) {
      lastError = error;
      if (!isConnectionError(error)) throw error;

      // Drop the stale handle so the next getDatabase() opens a fresh one.
      db = null;
      openPromise = null;

      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, 60 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

async function initializeDatabase(database) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS milk_defaults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buffalo_litres REAL DEFAULT 0,
      buffalo_price_per_litre REAL DEFAULT 0,
      cow_litres REAL DEFAULT 0,
      cow_price_per_litre REAL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS milk_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      buffalo_litres REAL DEFAULT 0,
      buffalo_price_per_litre REAL DEFAULT 0,
      cow_litres REAL DEFAULT 0,
      cow_price_per_litre REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'daily',
      salary REAL DEFAULT 0,
      allowed_leaves INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'full_day',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Insert default milk settings if not exists
  const defaults = await database.getFirstAsync('SELECT id FROM milk_defaults LIMIT 1');
  if (!defaults) {
    await database.runAsync(
      'INSERT INTO milk_defaults (buffalo_litres, buffalo_price_per_litre, cow_litres, cow_price_per_litre) VALUES (?, ?, ?, ?)',
      [0, 0, 0, 0]
    );
  }
}

// ---- App state ----
async function getAppState(key) {
  const row = await withDatabase((database) =>
    database.getFirstAsync('SELECT value FROM app_state WHERE key = ?', [key])
  );
  return row?.value ?? null;
}

// ---- Milk Defaults ----
export async function getMilkDefaults() {
  return await withDatabase((database) =>
    database.getFirstAsync('SELECT * FROM milk_defaults LIMIT 1')
  );
}

export async function updateMilkDefaults(buffaloLitres, buffaloPrice, cowLitres, cowPrice) {
  await withDatabase((database) =>
    database.runAsync(
      `UPDATE milk_defaults SET
        buffalo_litres = ?, buffalo_price_per_litre = ?,
        cow_litres = ?, cow_price_per_litre = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = 1`,
      [buffaloLitres, buffaloPrice, cowLitres, cowPrice]
    )
  );
}

// ---- Milk Entries ----
export async function getMilkEntry(date) {
  return await withDatabase((database) =>
    database.getFirstAsync('SELECT * FROM milk_entries WHERE date = ?', [date])
  );
}

// The most recent day with a milk record, or null if there are none. Milk is
// seeded for every day regardless of how many employees exist, so it is the
// dependable marker of how far seeding previously reached.
async function getLatestMilkEntryDate() {
  const row = await withDatabase((database) =>
    database.getFirstAsync('SELECT MAX(date) AS date FROM milk_entries')
  );
  return row?.date ?? null;
}

export async function getMilkEntriesForMonth(year, month) {
  const monthStr = String(month).padStart(2, '0');
  const pattern = `${year}-${monthStr}-%`;
  return await withDatabase((database) =>
    database.getAllAsync('SELECT * FROM milk_entries WHERE date LIKE ? ORDER BY date', [pattern])
  );
}

export async function upsertMilkEntry(date, buffaloLitres, buffaloPrice, cowLitres, cowPrice) {
  await withDatabase((database) =>
    database.runAsync(
      `INSERT INTO milk_entries (date, buffalo_litres, buffalo_price_per_litre, cow_litres, cow_price_per_litre)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         buffalo_litres = excluded.buffalo_litres,
         buffalo_price_per_litre = excluded.buffalo_price_per_litre,
         cow_litres = excluded.cow_litres,
         cow_price_per_litre = excluded.cow_price_per_litre,
         updated_at = datetime('now', 'localtime')`,
      [date, buffaloLitres, buffaloPrice, cowLitres, cowPrice]
    )
  );
}

// ---- Employees ----
export async function getEmployees(activeOnly = true) {
  return await withDatabase((database) => {
    if (activeOnly) {
      return database.getAllAsync('SELECT * FROM employees WHERE is_active = 1 ORDER BY name');
    }
    return database.getAllAsync('SELECT * FROM employees ORDER BY name');
  });
}

export async function addEmployee(name, type, salary, allowedLeaves) {
  const result = await withDatabase((database) =>
    database.runAsync(
      'INSERT INTO employees (name, type, salary, allowed_leaves) VALUES (?, ?, ?, ?)',
      [name, type, salary, allowedLeaves]
    )
  );
  return result.lastInsertRowId;
}

export async function updateEmployee(id, name, type, salary, allowedLeaves) {
  await withDatabase((database) =>
    database.runAsync(
      'UPDATE employees SET name = ?, type = ?, salary = ?, allowed_leaves = ? WHERE id = ?',
      [name, type, salary, allowedLeaves, id]
    )
  );
}

export async function deleteEmployee(id) {
  await withDatabase((database) =>
    database.runAsync('UPDATE employees SET is_active = 0 WHERE id = ?', [id])
  );
}

// ---- Attendance ----
export async function getAttendanceForMonth(employeeId, year, month) {
  const monthStr = String(month).padStart(2, '0');
  const pattern = `${year}-${monthStr}-%`;
  return await withDatabase((database) =>
    database.getAllAsync(
      'SELECT * FROM attendance WHERE employee_id = ? AND date LIKE ? ORDER BY date',
      [employeeId, pattern]
    )
  );
}

export async function upsertAttendance(employeeId, date, status) {
  await withDatabase((database) =>
    database.runAsync(
      `INSERT INTO attendance (employee_id, date, status)
       VALUES (?, ?, ?)
       ON CONFLICT(employee_id, date) DO UPDATE SET
         status = excluded.status,
         updated_at = datetime('now', 'localtime')`,
      [employeeId, date, status]
    )
  );
}

// ---- Daily defaults ----

// A day's default entries can only be written while the app is running, and the
// app routinely goes days without being opened - the phone switched off, or
// Android throttling background work for an app that has not been touched.
// Seeding getToday() alone left every one of those days empty for good, because
// nothing ever looked further back than the current date. Each run now closes
// the whole gap since the last day it seeded.
//
// The bound stops a long absence from silently manufacturing months of records.
// A gap that wide is better filled in deliberately than guessed at.
const MAX_BACKFILL_DAYS = 31;
const LAST_SEEDED_KEY = 'last_seeded_date';

export async function seedDefaultsThrough(today) {
  // The marker only exists from this version onwards. On the first run after
  // updating there is none, and treating that as a fresh install would skip
  // exactly the days the update is meant to recover - so fall back to the last
  // day that actually has a record. An install with no records at all is
  // genuinely new and correctly yields null.
  const lastSeeded = (await getAppState(LAST_SEEDED_KEY)) ?? (await getLatestMilkEntryDate());

  // Nothing recorded ever: start at today rather than backdating a month of
  // entries the user never had.
  let start = lastSeeded ? addDays(lastSeeded, 1) : today;

  const earliest = addDays(today, -(MAX_BACKFILL_DAYS - 1));
  if (start < earliest) start = earliest;

  // Today is seeded on every run, including when it has been seeded already.
  // The inserts skip rows that exist, so the only work this repeats is for an
  // employee added since the last run - who would otherwise have no entry until
  // tomorrow.
  if (start > today) start = today;

  const dates = datesInRange(start, today);

  // Read before opening the transaction: both of these go through
  // withDatabase(), and its reconnect-and-retry cannot rerun statements already
  // committed inside a transaction it is nested in.
  const defaults = await getMilkDefaults();
  const employees = await getEmployees(true);

  await withDatabase(async (database) => {
    // One transaction for the whole range. A separate write per row took the
    // write lock once per insert, and WAL allows a single writer - that is what
    // made seeding collide with the background task and the screens' queries.
    await database.withTransactionAsync(async () => {
      for (const date of dates) {
        if (defaults) {
          // Backfilled days necessarily use the defaults as they stand now; the
          // values in force on the missed day were never recorded anywhere.
          await database.runAsync(
            `INSERT OR IGNORE INTO milk_entries
               (date, buffalo_litres, buffalo_price_per_litre, cow_litres, cow_price_per_litre)
             VALUES (?, ?, ?, ?, ?)`,
            [date, defaults.buffalo_litres, defaults.buffalo_price_per_litre,
              defaults.cow_litres, defaults.cow_price_per_litre]
          );
        }

        for (const employee of employees) {
          await database.runAsync(
            `INSERT OR IGNORE INTO attendance (employee_id, date, status) VALUES (?, ?, 'full_day')`,
            [employee.id, date]
          );
        }
      }

      // Inside the transaction, so a failure rolls the marker back with the
      // rows and the next run retries the same range rather than skipping it.
      await database.runAsync(
        `INSERT INTO app_state (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = datetime('now', 'localtime')`,
        [LAST_SEEDED_KEY, today]
      );
    });
  });

  return dates;
}

export async function getAttendanceSummary(employeeId, year, month) {
  const monthStr = String(month).padStart(2, '0');
  const pattern = `${year}-${monthStr}-%`;

  return await withDatabase((database) =>
    database.getFirstAsync(
      `SELECT
        COUNT(CASE WHEN status = 'full_day' THEN 1 END) as full_days,
        COUNT(CASE WHEN status = 'first_half' THEN 1 END) as first_halves,
        COUNT(CASE WHEN status = 'second_half' THEN 1 END) as second_halves,
        COUNT(CASE WHEN status = 'leave' THEN 1 END) as leaves,
        COUNT(*) as total_entries
      FROM attendance WHERE employee_id = ? AND date LIKE ?`,
      [employeeId, pattern]
    )
  );
}
