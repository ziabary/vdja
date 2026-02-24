-- 1. Create the database (if it doesn't already exist)
--    Skip this block if TargomanLLM already exists
USE master;
GO

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'TargomanLLM')
BEGIN
    CREATE DATABASE TargomanLLM;
    PRINT 'Database TargomanLLM created.';
END
ELSE
    PRINT 'Database TargomanLLM already exists.';
GO

-- 2. Create the server login (SQL Authentication)
--    This is the account used to connect from applications/tools
USE master;
GO

IF NOT EXISTS (SELECT * FROM sys.sql_logins WHERE name = 'llmaccess')
BEGIN
    CREATE LOGIN llmaccess 
    WITH PASSWORD = 'password',           -- ← your chosen password
         DEFAULT_DATABASE = TargomanLLM,   -- connects here by default
         CHECK_EXPIRATION = OFF,           -- no expiry (common in dev)
         CHECK_POLICY = OFF;               -- skip Windows policy (dev convenience)
    
    PRINT 'Login llmaccess created.';
END
ELSE
    PRINT 'Login llmaccess already exists.';
GO

-- 3. Create the database user linked to the login
--    This maps the login to the specific database
USE TargomanLLM;
GO

IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'llmaccess')
BEGIN
    CREATE USER llmaccess FOR LOGIN llmaccess;
    PRINT 'User llmaccess created in TargomanLLM.';
END
ELSE
    PRINT 'User llmaccess already exists in TargomanLLM.';
GO

-- 4. Grant common privileges to the user
--    Adjust these based on what your LLM app needs:
--      - db_datareader: SELECT on all tables/views
--      - db_datawriter: INSERT/UPDATE/DELETE on all tables
--      - db_ddladmin: CREATE/ALTER/DROP objects (tables, procs, etc.)
--    For minimal access, remove db_ddladmin if not needed

ALTER ROLE db_datareader ADD MEMBER llmaccess;
ALTER ROLE db_datawriter ADD MEMBER llmaccess;
-- ALTER ROLE db_ddladmin ADD MEMBER llmaccess;   -- Uncomment only if needed

PRINT 'Privileges granted to llmaccess (reader + writer).';
GO