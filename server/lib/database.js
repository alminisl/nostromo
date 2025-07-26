const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');

class Database {
  constructor(type, connectionString) {
    this.type = type;
    this.connectionString = connectionString;
    this.db = null;
  }

  async connect() {
    if (this.type === 'sqlite') {
      const dbPath = this.connectionString || path.join('./data', 'database.sqlite');
      this.db = new sqlite3.Database(dbPath);
      
      return new Promise((resolve, reject) => {
        this.db.serialize(() => {
          this.createTables()
            .then(resolve)
            .catch(reject);
        });
      });
    } else if (this.type === 'postgresql') {
      this.db = new Client({ connectionString: this.connectionString });
      await this.db.connect();
      await this.createTables();
    }
  }

  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ip_address TEXT,
        fingerprint TEXT,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_trusted BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        size INTEGER NOT NULL,
        mime_type TEXT,
        device_id TEXT,
        encryption_key TEXT NOT NULL,
        upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        download_count INTEGER DEFAULT 0,
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY (device_id) REFERENCES devices (id)
      )`,
      `CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        key_hash TEXT NOT NULL,
        device_id TEXT,
        permissions TEXT DEFAULT 'read,write',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (device_id) REFERENCES devices (id)
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indices for better performance
    const indices = [
      'CREATE INDEX IF NOT EXISTS idx_files_device_id ON files (device_id)',
      'CREATE INDEX IF NOT EXISTS idx_files_upload_time ON files (upload_time)',
      'CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files (expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_devices_ip_address ON devices (ip_address)',
      'CREATE INDEX IF NOT EXISTS idx_api_keys_device_id ON api_keys (device_id)'
    ];

    for (const index of indices) {
      await this.run(index);
    }
  }

  async run(sql, params = []) {
    if (this.type === 'sqlite') {
      return new Promise((resolve, reject) => {
        this.db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    } else {
      const result = await this.db.query(sql, params);
      return result;
    }
  }

  async get(sql, params = []) {
    if (this.type === 'sqlite') {
      return new Promise((resolve, reject) => {
        this.db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    } else {
      const result = await this.db.query(sql, params);
      return result.rows[0];
    }
  }

  async all(sql, params = []) {
    if (this.type === 'sqlite') {
      return new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    } else {
      const result = await this.db.query(sql, params);
      return result.rows;
    }
  }

  async close() {
    if (this.db) {
      if (this.type === 'sqlite') {
        return new Promise((resolve) => {
          this.db.close((err) => {
            if (err) console.error('Error closing database:', err);
            resolve();
          });
        });
      } else {
        await this.db.end();
      }
    }
  }
}

async function setupDatabase() {
  const dbType = process.env.DB_TYPE || 'sqlite';
  let connectionString;

  if (dbType === 'postgresql') {
    connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('POSTGRES_URL environment variable is required for PostgreSQL');
    }
  } else {
    connectionString = process.env.DB_PATH || './data/database.sqlite';
  }

  const db = new Database(dbType, connectionString);
  await db.connect();
  
  console.log(`Database connected (${dbType})`);
  return db;
}

module.exports = { Database, setupDatabase };