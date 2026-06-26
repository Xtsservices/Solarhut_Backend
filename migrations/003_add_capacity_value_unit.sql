-- Migration: add numeric capacity columns
ALTER TABLE jobs
  ADD COLUMN capacity_value DECIMAL(8,3) NULL AFTER capacity_raw,
  ADD COLUMN capacity_unit VARCHAR(10) NULL AFTER capacity_value;

-- Optional index to speed range queries / sorting by capacity_value
CREATE INDEX IF NOT EXISTS idx_jobs_capacity_value ON jobs (capacity_value);
