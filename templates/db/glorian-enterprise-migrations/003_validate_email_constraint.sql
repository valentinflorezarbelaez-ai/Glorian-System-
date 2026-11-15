-- Glorian Enterprise Zero-Downtime Migration
-- 003_validate_email_constraint.sql
-- Governed by SPEC-277 / CHANGE-139

SET lock_timeout = '2s';
SET statement_timeout = '5s';

-- Step 3: Add constraint with NOT VALID to prevent ACCESS EXCLUSIVE scan
ALTER TABLE users ADD CONSTRAINT check_email_format CHECK (email LIKE '%@%') NOT VALID;

-- Step 4: Validate constraint separately with SHARE UPDATE EXCLUSIVE lock
ALTER TABLE users VALIDATE CONSTRAINT check_email_format;
