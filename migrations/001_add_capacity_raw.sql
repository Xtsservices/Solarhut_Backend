-- Migration: Add capacity_raw to jobs table
ALTER TABLE jobs
ADD COLUMN capacity_raw VARCHAR(255) NULL
AFTER capacity;
-- Backfill (best-effort): copy existing capacity into capacity_raw where NULL
UPDATE jobs
SET capacity_raw = capacity
WHERE capacity_raw IS NULL
    AND capacity IS NOT NULL;