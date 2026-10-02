# Target PostgreSQL persistence foundation

Database drivers and Kysely stay in this package or a future owning module's persistence implementation. Business SQL belongs to that module. Application startup never applies migrations. Production SQL is schema-qualified and never uses `SELECT *`.
