-- Glorian Enterprise Zero-Downtime Migration
-- 001_initial_schema.sql
-- Governed by SPEC-277 / CHANGE-139

SET lock_timeout = '2s';
SET statement_timeout = '5s';

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
