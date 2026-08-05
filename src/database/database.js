import * as SQLite from 'expo-sqlite';

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
    message.includes('has been finalized') ||
    message.includes('no such table')
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

// Runs a database operation, and if it fails because the connection went stale,
// reopens once and retries. This is what stops a single backgrounding from
// leaving the app permanently blank until it is swiped out of recents.
async function withDatabase(operation) {
  let database = await getDatabase();
  try {
    return await operation(database);
  } catch (error) {
    if (!isConnectionError(error)) throw error;

    await resetDatabase();
    database = await getDatabase();
    return await operation(database);
  }
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

export async function addDefaultMilkEntryForDate(date) {
  const existing = await getMilkEntry(date);
  if (existing) return; // Already exists

  const defaults = await getMilkDefaults();
  if (!defaults) return;

  await withDatabase((database) =>
    database.runAsync(
      `INSERT OR IGNORE INTO milk_entries (date, buffalo_litres, buffalo_price_per_litre, cow_litres, cow_price_per_litre)
       VALUES (?, ?, ?, ?, ?)`,
      [date, defaults.buffalo_litres, defaults.buffalo_price_per_litre, defaults.cow_litres, defaults.cow_price_per_litre]
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

export async function markDefaultAttendanceForDate(date) {
  const employees = await getEmployees(true);
  if (employees.length === 0) return;

  await withDatabase(async (database) => {
    for (const emp of employees) {
      await database.runAsync(
        `INSERT OR IGNORE INTO attendance (employee_id, date, status) VALUES (?, ?, 'full_day')`,
        [emp.id, date]
      );
    }
  });
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
