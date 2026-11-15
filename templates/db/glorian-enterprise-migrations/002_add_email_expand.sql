-- Glorian Enterprise Zero-Downtime Migration
-- 002_add_email_expand.sql
-- Governed by SPEC-277 / CHANGE-139

SET lock_timeout = '2s';
SET statement_timeout = '5s';

-- Step 1 (Expand): Add nullable column
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Step 2: Create index concurrently to avoid exclusive table lock
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
