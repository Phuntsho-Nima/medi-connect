-- Migration v2 — run once against Hospital_OPD before starting the server
-- Adds created_at to users and doctors for the admin activity feed,
-- and a config table for hospital-level settings.

ALTER TABLE users   ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS config (
    key   VARCHAR(100) PRIMARY KEY,
    value TEXT         NOT NULL DEFAULT ''
);
INSERT INTO config (key, value)
    VALUES ('hospital_name', 'MediConnect Hospital')
    ON CONFLICT DO NOTHING;
