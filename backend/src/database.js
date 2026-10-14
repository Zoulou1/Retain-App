import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const folder = path.dirname(fileURLToPath(import.meta.url));
const filename = process.env.DB_FILE || path.join(folder, '../data/retain.db');
fs.mkdirSync(path.dirname(filename), { recursive: true });
const SQL = await initSqlJs({
  locateFile: (file) => path.join(path.dirname(require.resolve('sql.js')), file),
});
const database = fs.existsSync(filename)
  ? new SQL.Database(new Uint8Array(fs.readFileSync(filename)))
  : new SQL.Database();
database.run('PRAGMA foreign_keys = ON');
let inTransaction = false;

function save() {
  if (inTransaction) return;
  fs.writeFileSync(`${filename}.tmp`, Buffer.from(database.export()));
  fs.renameSync(`${filename}.tmp`, filename);
  // Export reopens the database, so enable foreign keys again.
  database.run('PRAGMA foreign_keys = ON');
}

const db = {
  exec(sql) {
    database.exec(sql);
    save();
  },
  prepare(sql) {
    return {
      run(...values) {
        database.run(sql, values);
        const changes = database.getRowsModified();
        save();
        return { changes };
      },
      get(...values) {
        const statement = database.prepare(sql);
        try {
          statement.bind(values);
          return statement.step() ? statement.getAsObject() : undefined;
        } finally {
          statement.free();
        }
      },
      all(...values) {
        const statement = database.prepare(sql);
        const rows = [];
        try {
          statement.bind(values);
          while (statement.step()) rows.push(statement.getAsObject());
          return rows;
        } finally {
          statement.free();
        }
      },
    };
  },
  transaction(callback) {
    return () => {
      database.run('BEGIN');
      inTransaction = true;
      try {
        const result = callback();
        database.run('COMMIT');
        inTransaction = false;
        save();
        return result;
      } catch (error) {
        database.run('ROLLBACK');
        inTransaction = false;
        throw error;
      }
    };
  },
};

export default db;
