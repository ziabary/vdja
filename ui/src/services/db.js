const knex = require("knex");

const dbType = process.env.DB_TYPE || "sqlite3";
let config;

if (dbType === "sqlite3") {
  const filename = process.env.DB_CONNECTION || "./db/vdja.db";
  config = {
    client: "sqlite3",
    connection: { filename },
    useNullAsDefault: true,
  };
} else if (dbType === "mysql") {
  config = {
    client: "mysql2",
    connection: process.env.DB_CONNECTION,
  };
} else if (dbType === "pg") {
  config = {
    client: "pg",
    connection: process.env.DB_CONNECTION,
  };
} else if (dbType === "mssql") {
  config = {
    client: "mssql",
    connection: process.env.DB_CONNECTION,
  };
} else {
  throw new Error("Unsupported DB_TYPE: " + dbType);
}

const dbInstance = knex(config);

// Retry wrapper
async function queryWithRetry(fn, retries = 3) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      console.error(`DB query failed (attempt ${attempt}):`, err.message);
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Initialize schema
async function initSchema() {
  await queryWithRetry(async () => {
    if (dbType === "sqlite3") {
      await dbInstance.raw("PRAGMA journal_mode = WAL");
      await dbInstance.raw("PRAGMA busy_timeout = 5000");
      await dbInstance.raw('PRAGMA encoding = "UTF-8"');
      await dbInstance.raw("PRAGMA synchronous = NORMAL");
      await dbInstance.raw("PRAGMA cache_size = -64000");
      await dbInstance.raw("PRAGMA temp_store = MEMORY");
      await dbInstance.raw("PRAGMA auto_vacuum = FULL");
    }
    if (dbType === "mssql") {
      // users
      await dbInstance.raw(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
        CREATE TABLE users (
          user_key NVARCHAR(255) PRIMARY KEY,
          total_storage BIGINT DEFAULT 0,
          file_count INT DEFAULT 0,
          total_chats INT DEFAULT 0,
          total_files_uploaded INT DEFAULT 0,
          created_at DATETIME DEFAULT GETDATE(),
          last_login_at DATETIME DEFAULT GETDATE(),
          openid_sub NVARCHAR(255) UNIQUE
        )
      `);

      // files
      await dbInstance.raw(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='files' AND xtype='U')
        CREATE TABLE files (
          id INT IDENTITY(1,1) PRIMARY KEY,
          user_key NVARCHAR(255) NOT NULL,
          file_id NVARCHAR(255) NOT NULL,
          file_name NVARCHAR(500) NOT NULL,
          file_size BIGINT NOT NULL,
          chunk_count INT NOT NULL,
          uploaded_at DATETIME DEFAULT GETDATE()
        )
      `);

      // chats
      await dbInstance.raw(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='chats' AND xtype='U')
        CREATE TABLE chats (
          chat_id NVARCHAR(255) PRIMARY KEY,
          user_key NVARCHAR(255) NOT NULL,
          title NVARCHAR(255) DEFAULT 'چت جدید',
          created_at DATETIME DEFAULT GETDATE(),
          last_login_at DATETIME DEFAULT GETDATE()
        )
      `);

      // messages
      await dbInstance.raw(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='messages' AND xtype='U')
        CREATE TABLE messages (
          id INT IDENTITY(1,1) PRIMARY KEY,
          chat_id NVARCHAR(255) NOT NULL,
          role NVARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT GETDATE()
        )
      `);

      // logs
      await dbInstance.raw(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='logs' AND xtype='U')
        CREATE TABLE logs (
          id INT IDENTITY(1,1) PRIMARY KEY,
          user_key NVARCHAR(255) NOT NULL,
          action NVARCHAR(100) NOT NULL,
          details TEXT,
          timestamp DATETIME DEFAULT GETDATE()
        )
      `);

      // Indexes (با چک وجود)
      await dbInstance.raw(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_chats_user' AND object_id = OBJECT_ID('chats'))
        CREATE INDEX idx_chats_user ON chats(user_key)
      `);

      await dbInstance.raw(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_messages_chat' AND object_id = OBJECT_ID('messages'))
        CREATE INDEX idx_messages_chat ON messages(chat_id)
      `);

      await dbInstance.raw(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_files_user' AND object_id = OBJECT_ID('files'))
        CREATE INDEX idx_files_user ON files(user_key)
      `);

      await dbInstance.raw(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_logs_user' AND object_id = OBJECT_ID('logs'))
        CREATE INDEX idx_logs_user ON logs(user_key)
      `);
    } else {
      await dbInstance.raw(`
      CREATE TABLE IF NOT EXISTS users (
        user_key TEXT PRIMARY KEY,
        total_storage INTEGER DEFAULT 0,
        file_count INTEGER DEFAULT 0,
        total_chats INTEGER DEFAULT 0,
        total_files_uploaded INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        openid_sub TEXT UNIQUE
      );

      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        file_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chats (
        chat_id TEXT PRIMARY KEY,
        user_key TEXT NOT NULL,
        title TEXT DEFAULT 'چت جدید',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

      // Indexes
      try {
        await dbInstance.raw(
          "CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_key)"
        );
      } catch (e) {
        console.warn(
          "Index idx_chats_user already exists or failed (safe to ignore)"
        );
      }
      try {
        await dbInstance.raw(
          "CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)"
        );
      } catch (e) {
        console.warn(
          "Index idx_messages_chat already exists or failed (safe to ignore)"
        );
      }
      try {
        await dbInstance.raw(
          "CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_key)"
        );
      } catch (e) {
        console.warn(
          "Index idx_files_user already exists or failed (safe to ignore)"
        );
      }
      try {
        await dbInstance.raw(
          "CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_key)"
        );
      } catch (e) {
        console.warn(
          "Index idx_logs_user already exists or failed (safe to ignore)"
        );
      }
    }
  });

  console.log("Database schema initialized successfully");
}

// User functions
async function getUser(user_key) {
  return await queryWithRetry(async () => {
    return await dbInstance
      .raw("SELECT * FROM users WHERE user_key = ?", [user_key])
      .then((rows) => rows[0]);
  });
}

async function insertUser(user_key) {
  await queryWithRetry(async () => {
    await dbInstance.transaction(async (trx) => {
      await trx.raw(
        `
        INSERT INTO users (user_key, created_at, last_login_at)
        VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
        [user_key]
      );
      await logAction(user_key, "login", "New user");
    });
  });
}

async function updateUserLogin(user_key) {
  await queryWithRetry(async () => {
    await dbInstance.raw(
      "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_key = ?",
      [user_key]
    );
    await logAction(user_key, "login", "Existing user");
  });
}

async function updateUserStats(user_key, updates) {
  // updates: { total_storage: value, file_count: value, etc. }
  const setClauses = Object.keys(updates)
    .map((key) => `${key} = ${key} + ?`)
    .join(", ");
  const params = [...Object.values(updates), user_key];
  await queryWithRetry(async () => {
    await dbInstance.raw(
      `
        UPDATE users 
           SET ${setClauses}, 
               last_login_at = CURRENT_TIMESTAMP 
         WHERE user_key = ?
      `,
      params
    );
  });
}

// File functions
async function insertFile(
  user_key,
  file_id,
  file_name,
  file_size,
  chunk_count
) {
  await queryWithRetry(async () => {
    await dbInstance.transaction(async (trx) => {
      await trx.raw(
        `
        INSERT INTO files (user_key, file_id, file_name, file_size, chunk_count)
        VALUES (?, ?, ?, ?, ?)
      `,
        [user_key, file_id, file_name, file_size, chunk_count]
      );

      // Update user stats atomically
      await trx.raw(
        `
        UPDATE users SET 
          total_storage = total_storage + ?,
          file_count = file_count + 1,
          total_files_uploaded = total_files_uploaded + 1
        WHERE user_key = ?
      `,
        [file_size, user_key]
      );
      await logAction(
        user_key,
        "insert_file",
        `File: ${file_name}, Size: ${file_size}`
      );
    });
  });
}

async function getFiles(user_key) {
  return await queryWithRetry(async () => {
    return await dbInstance.raw(
      `
      SELECT file_id, file_name, file_size, chunk_count, uploaded_at
      FROM files WHERE user_key = ? ORDER BY uploaded_at DESC
    `,
      [user_key]
    );
  });
}

async function getFile(user_key, file_id) {
  return await queryWithRetry(async () => {
    return await dbInstance
      .raw("SELECT * FROM files WHERE file_id = ? AND user_key = ?", [
        file_id,
        user_key,
      ])
      .then((rows) => rows[0]);
  });
}

async function deleteFile(user_key, file_id) {
  const file = await getFile(user_key, file_id);
  if (!file) throw new Error("File not found");
  await queryWithRetry(async () => {
    await dbInstance.transaction(async (trx) => {
      await trx.raw("DELETE FROM files WHERE file_id = ? AND user_key = ?", [
        file_id,
        user_key,
      ]);
      await trx.raw(
        `
        UPDATE users SET
          total_storage = total_storage - ?,
          file_count = file_count - 1
        WHERE user_key = ?
      `,
        [file.file_size, user_key]
      );
      await logAction(
        user_key,
        "delete_file",
        `FileID: ${file.file_name}, Size: ${file_size}`
      );
    });
  });
}

async function deleteAllFiles(user_key) {
  await queryWithRetry(async () => {
    await dbInstance.transaction(async (trx) => {
      await trx.raw("DELETE FROM files WHERE user_key = ?", [user_key]);

      await trx.raw(
        `
        UPDATE users SET 
          total_storage = 0,
          file_count = 0
        WHERE user_key = ?
      `,
        [user_key]
      );
      await logAction(user_key, "delete_all_files");
    });
  });
}

// Chat functions
async function getChats(user_key) {
  return await queryWithRetry(async () => {
    return await dbInstance.raw(
      `
      SELECT chat_id, title, created_at, last_message_at
      FROM chats WHERE user_key = ? ORDER BY last_message_at DESC LIMIT 50
    `,
      [user_key]
    );
  });
}

async function insertChat(user_key, chat_id, title) {
  await queryWithRetry(async () => {
    await dbInstance.transaction(async (trx) => {
      await trx.raw(
        `
        INSERT INTO chats (chat_id, user_key, title, last_message_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `,
        [chat_id, user_key, title]
      );

      await trx.raw(
        `
        UPDATE users SET total_chats = total_chats + 1 WHERE user_key = ?
      `,
        [user_key]
      );
    });
  });
}

async function getChat(user_key, chat_id) {
  return await queryWithRetry(async () => {
    return await dbInstance
      .raw(
        `
        SELECT * FROM chats WHERE chat_id = ? AND user_key = ?
        `,
        [chat_id, user_key]
      )
      .then((rows) => rows[0]);
  });
}

async function deleteChat(user_key, chat_id) {
  await queryWithRetry(async () => {
    await dbInstance.transaction(async (trx) => {
      await trx.raw("DELETE FROM messages WHERE chat_id = ?", [chat_id]);
      await trx.raw("DELETE FROM chats WHERE user_key = ? AND chat_id = ?", [
        user_key,
        chat_id,
      ]);
      await trx.raw(
        "UPDATE users SET total_chats = total_chats - 1 WHERE user_key = ?",
        [user_key]
      );
    });
  });
}

async function deleteChats(user_key) {
  await queryWithRetry(async () => {
    await dbInstance.transaction(async (trx) => {
      await trx.raw(
        "DELETE FROM messages WHERE chat_id IN (SELECT chat_id FROM chats WHERE user_key = ?)",
        [user_key]
      );
      await trx.raw("DELETE FROM chats WHERE user_key = ?", [user_key]);
      await trx.raw("UPDATE users SET total_chats = 0 WHERE user_key = ?", [
        user_key,
      ]);
    });
  });
}

async function updateChatTitle(user_key, chat_id, title) {
  await queryWithRetry(async () => {
    await dbInstance.raw(
      "UPDATE chats SET title = ? WHERE user_key = ? AND chat_id = ?",
      [title, user_key, chat_id]
    );
  });
}

async function updateChatLastMessage(chat_id) {
  await queryWithRetry(async () => {
    await dbInstance.raw(
      "UPDATE chats SET last_message_at = CURRENT_TIMESTAMP WHERE chat_id = ?",
      [chat_id]
    );
  });
}

// Message functions
async function insertMessage(chat_id, role, content) {
  await queryWithRetry(async () => {
    await dbInstance.raw(
      "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)",
      [chat_id, role, content]
    );
  });
}

async function getMessages(chat_id) {
  return await queryWithRetry(async () => {
    return await dbInstance.raw(
      `
      SELECT role, content, created_at 
        FROM messages 
        WHERE chat_id = ? 
        ORDER BY created_at ASC 
        LIMIT 50
      `,
      [chat_id]
    );
  });
}

// Stats functions
async function getAdminStats() {
  const users = await queryWithRetry(async () => {
    return await dbInstance.raw(`
      SELECT 
        CONCAT(SUBSTR(user_key, 1, 12), '...') AS short_user_key,
        created_at,
        last_login_at,
        total_chats,
        total_files_uploaded,
        file_count,
        total_storage
      FROM users 
      ORDER BY last_login_at DESC
    `);
  });

  const totals = await queryWithRetry(async () => {
    return await dbInstance
      .raw(
        `
      SELECT 
        SUM(total_chats) AS total_chats,
        SUM(total_files_uploaded) AS total_files_uploaded,
        SUM(file_count) AS total_active_files,
        SUM(total_storage) AS total_storage
      FROM users
    `
      )
      .then((rows) => rows[0]);
  });

  const totalUsers = await queryWithRetry(async () => {
    return await dbInstance
      .raw("SELECT COUNT(*) AS count FROM users")
      .then((rows) => rows[0].count);
  });

  return { users, totals, totalUsers };
}

// Log functions
async function logAction(user_key, action, details = null) {
  await queryWithRetry(async () => {
    await dbInstance.raw(
      "INSERT INTO logs (user_key, action, details) VALUES (?, ?, ?)",
      [user_key, action, details]
    );
  });
}

// Cleanup functions (for inactive users)
async function getInactiveUsers(days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffISO = cutoffDate.toISOString();
  return await queryWithRetry(async () => {
    return await dbInstance.raw(
      `
      SELECT user_key FROM users 
      WHERE last_login_at < ?
    `,
      [cutoffISO]
    );
  });
}

async function deleteUserData(user_key) {
  await queryWithRetry(async () => {
    await dbInstance.transaction(async (trx) => {
      await trx.raw("DELETE FROM files WHERE user_key = ?", [user_key]);
      await trx.raw("DELETE FROM chats WHERE user_key = ?", [user_key]);
      await trx.raw(
        "DELETE FROM messages WHERE chat_id IN (SELECT chat_id FROM chats WHERE user_key = ?)",
        [user_key]
      );
      await trx.raw("DELETE FROM logs WHERE user_key = ?", [user_key]);
      await trx.raw("DELETE FROM users WHERE user_key = ?", [user_key]);
    });
  });
}

async function getUserByOpenID(openid_sub) {
  return await queryWithRetry(async () => {
    return await dbInstance("users").where("openid_sub", openid_sub).first();
  });
}

async function insertUserWithOpenID(user_key, openid_sub) {
  await queryWithRetry(async () => {
    await dbInstance("users").insert({
      user_key,
      openid_sub,
      created_at: new Date(),
      last_login_at: new Date(),
    });
  });
}

module.exports = {
  knex: dbInstance,
  initSchema,
  getUser,
  insertUser,
  updateUserLogin,
  updateUserStats,
  insertFile,
  getFiles,
  getFile,
  deleteFile,
  deleteAllFiles,
  getChats,
  insertChat,
  getChat,
  updateChatTitle,
  updateChatLastMessage,
  insertMessage,
  getMessages,
  getAdminStats,
  logAction,
  getInactiveUsers,
  deleteUserData,
  deleteChat,
  deleteChats,
  getUserByOpenID,
  insertUserWithOpenID,
};
