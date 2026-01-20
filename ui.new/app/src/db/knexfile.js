module.exports = {
  development: {
    client: 'pg', // or 'mysql2' for MySQL, 'sqlite3' for SQLite, etc.
    connection: {
      host: '127.0.0.1',
      user: 'your_user',
      password: 'your_password',
      database: 'TargomanLLM',
      port: 5432
    },
    migrations: {
      directory: './schema/migrations', // your migration files
    },
    seeds: {
      directory: './schema/seeds', // if you have seed files
    }
  },

  // You can add more environments like 'test' and 'production' if needed
  // test: { ... },
  // production: { ... }
};