-- Migration: Add estimation_id to jobs table
ALTER TABLE jobs
ADD COLUMN estimation_id INT NULL
AFTER lead_id;
-- Add index for estimation_id
ALTER TABLE jobs
ADD INDEX idx_estimation_id (estimation_id);
-- Optionally add foreign key (commented out to avoid issues in some environments)
-- ALTER TABLE jobs ADD CONSTRAINT fk_jobs_estimations FOREIGN KEY (estimation_id) REFERENCES estimations(id) ON DELETE SET NULL;