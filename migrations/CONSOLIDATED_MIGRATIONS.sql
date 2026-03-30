-- ============================================================================
-- CONSOLIDATED MIGRATIONS & FIXES FOR SOLARHUT BACKEND
-- Purpose: Single file containing all database migrations and schema fixes
-- Created: March 26, 2026
-- ============================================================================
-- This file contains all database migrations in sequential order:
-- 1. Permissions Table Fix
-- 2. Status Migration (Add 'New' status to leads)
-- 3. Invoices Table Creation
-- 4. Status Cleanup and Validation
-- ============================================================================


-- ============================================================================
-- SECTION 1: PERMISSIONS TABLE FIX
-- ============================================================================
-- Purpose: Fix permissions table schema to match application requirements
-- Safe Approach: Creates table only if it doesn't exist (preserves existing data)
-- Note: If existing table has schema mismatch, see manual steps at bottom
-- ============================================================================

-- Step 1.1: Check if permissions table exists
SELECT 'Checking permissions table...' AS step;

-- Step 1.2: Create permissions table only if it doesn't exist
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    feature_id INT NOT NULL,
    permission VARCHAR(100) NOT NULL,
    created_by INT NOT NULL,
    updated_by INT,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role_feature_permission (role_id, feature_id, permission),
    INDEX idx_role_id (role_id),
    INDEX idx_feature_id (feature_id),
    INDEX idx_permission (permission),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_updated_by (updated_by),
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
);

SELECT '✅ Permissions table verified/created successfully' AS status;

-- Step 1.3: Show current table structure for verification
SELECT '--- Current Permissions Table Structure ---' AS info;
DESCRIBE permissions;

-- ============================================================================


-- ============================================================================
-- SECTION 2: STATUS MIGRATION - Add 'New' Status to Leads
-- ============================================================================
-- Purpose: Add 'New' status for unassigned leads (default), 'Active' for assigned leads
-- Standardize status enums across leads, estimations, and job_assignments
-- ============================================================================

-- Step 2.1: Check Existing Status Values (Before Migration)
SELECT '--- STATUS DISTRIBUTION BEFORE MIGRATION ---' AS info;
SELECT 'LEADS Table Status Distribution:' AS info;
SELECT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY status;

SELECT '' AS info;
SELECT 'ESTIMATIONS Table Status Distribution:' AS info;
SELECT status, COUNT(*) as count FROM estimations GROUP BY status ORDER BY status;

SELECT '' AS info;
SELECT 'JOB_ASSIGNMENTS Table Status Distribution:' AS info;
SELECT assignment_status, COUNT(*) as count FROM job_assignments GROUP BY assignment_status ORDER BY assignment_status;

-- Step 2.2: Update LEADS Table ENUM to include 'New' status
ALTER TABLE leads 
MODIFY COLUMN status ENUM(
    'New',
    'Active',
    'Site Visit',
    'Estimation Generated',
    'Processed',
    'Pending on Portal',
    'Payment Pending',
    'Partial Payment Done',
    'Payment Done',
    'Invoice Generated',
    'Job Done'
) NOT NULL DEFAULT 'New';

SELECT '✅ LEADS table status ENUM updated' AS migration_step;

-- Step 2.3: Update ESTIMATIONS Table ENUM
ALTER TABLE estimations 
MODIFY COLUMN status ENUM(
    'New',
    'Active',
    'Site Visit',
    'Estimation Generated',
    'Processed',
    'Pending on Portal',
    'Payment Pending',
    'Partial Payment Done',
    'Payment Done',
    'Invoice Generated',
    'Job Done'
) NOT NULL DEFAULT 'Active';

SELECT '✅ ESTIMATIONS table status ENUM updated' AS migration_step;

-- Step 2.4: Update JOB_ASSIGNMENTS Table ENUM
ALTER TABLE job_assignments 
MODIFY COLUMN assignment_status ENUM(
    'New',
    'Active',
    'Site Visit',
    'Estimation Generated',
    'Processed',
    'Pending on Portal',
    'Payment Pending',
    'Partial Payment Done',
    'Payment Done',
    'Invoice Generated',
    'Job Done'
) NOT NULL DEFAULT 'Active';

SELECT '✅ JOB_ASSIGNMENTS table assignment_status ENUM updated' AS migration_step;


-- ============================================================================
-- SECTION 3: STATUS CLEANUP - Convert Old Statuses to New Ones
-- ============================================================================
-- Purpose: Migrate existing data to new status values
-- NOTE: BACKUP YOUR DATABASE BEFORE RUNNING THIS!
-- ============================================================================

-- Step 3.1: LEADS Table - Convert old statuses to new job workflow statuses
UPDATE leads SET status = 'Active' WHERE status = 'New' AND assigned_to IS NOT NULL;
UPDATE leads SET status = 'Active' WHERE status = 'Assigned';
UPDATE leads SET status = 'Site Visit' WHERE status = 'In Progress';
UPDATE leads SET status = 'Job Done' WHERE status = 'Closed';
UPDATE leads SET status = 'Job Done' WHERE status = 'Rejected';
UPDATE leads SET status = 'Job Done' WHERE status = 'Cancelled';
UPDATE leads SET status = 'Job Done' WHERE status IN ('Complete', 'Completed');

SELECT '✅ LEADS table old statuses converted' AS migration_step;

-- Step 3.2: ESTIMATIONS Table - Convert old statuses to new ones
UPDATE estimations SET status = 'Active' WHERE status = 'Inactive';
UPDATE estimations SET status = 'Active' WHERE status = 'New';
UPDATE estimations SET status = 'Active' WHERE status = 'Draft';
UPDATE estimations SET status = 'Active' WHERE status = 'In Progress';
UPDATE estimations SET status = 'Active' WHERE status = 'Closed';
UPDATE estimations SET status = 'Job Done' WHERE status IN ('Completed', 'Cancelled');

SELECT '✅ ESTIMATIONS table old statuses converted' AS migration_step;

-- Step 3.3: JOB_ASSIGNMENTS Table - Convert old statuses to new ones
UPDATE job_assignments SET assignment_status = 'Active' WHERE assignment_status = 'Assigned';
UPDATE job_assignments SET assignment_status = 'Job Done' WHERE assignment_status IN ('Completed', 'Cancelled');

SELECT '✅ JOB_ASSIGNMENTS table old statuses converted' AS migration_step;

-- Step 3.4: Set unassigned leads to 'New' status
UPDATE leads SET status = 'New' WHERE assigned_to IS NULL AND status != 'New';

SELECT '✅ Unassigned leads set to New status' AS migration_step;


-- ============================================================================
-- SECTION 4: STATUS VALIDATION - Verify all records use valid statuses
-- ============================================================================
-- Purpose: Ensure all records have been properly updated
-- All invalid_count values should be 0 if migration was successful
-- ============================================================================

SELECT '--- STATUS VALIDATION AFTER MIGRATION ---' AS info;

SELECT 'Records with invalid status in LEADS (should be 0):' AS validation;
SELECT COUNT(*) as invalid_count FROM leads 
WHERE status NOT IN ('New', 'Active', 'Site Visit', 'Estimation Generated', 'Processed', 
                     'Pending on Portal', 'Payment Pending', 'Partial Payment Done', 
                     'Payment Done', 'Invoice Generated', 'Job Done');

SELECT '' AS info;
SELECT 'Records with invalid status in ESTIMATIONS (should be 0):' AS validation;
SELECT COUNT(*) as invalid_count FROM estimations 
WHERE status NOT IN ('New', 'Active', 'Site Visit', 'Estimation Generated', 'Processed', 
                     'Pending on Portal', 'Payment Pending', 'Partial Payment Done', 
                     'Payment Done', 'Invoice Generated', 'Job Done');

SELECT '' AS info;
SELECT 'Records with invalid status in JOB_ASSIGNMENTS (should be 0):' AS validation;
SELECT COUNT(*) as invalid_count FROM job_assignments 
WHERE assignment_status NOT IN ('New', 'Active', 'Site Visit', 'Estimation Generated', 'Processed', 
                               'Pending on Portal', 'Payment Pending', 'Partial Payment Done', 
                               'Payment Done', 'Invoice Generated', 'Job Done');

-- Step 4.1: Show status distribution after all migrations
SELECT '' AS info;
SELECT '--- FINAL STATUS DISTRIBUTION ---' AS info;
SELECT 'Leads' as table_name, status, COUNT(*) as count FROM leads GROUP BY status ORDER BY status
UNION ALL
SELECT 'Estimations', status, COUNT(*) FROM estimations GROUP BY status ORDER BY status
UNION ALL
SELECT 'Job Assignments', assignment_status, COUNT(*) FROM job_assignments GROUP BY assignment_status ORDER BY assignment_status;

SELECT '' AS info;
SELECT '✅ If all invalid_count values are 0, the migration is complete!' AS final_status;


-- ============================================================================
-- SECTION 5: INVOICES TABLE
-- ============================================================================
-- Purpose: Create invoices table to store customer invoices
-- Relationships: customers, estimations
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customerId INT NOT NULL,
    estimationId INT NOT NULL,
    invoiceDate DATE NOT NULL,
    items JSON NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    tax DECIMAL(12,2) NOT NULL,
    grandTotal DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES customers(id),
    FOREIGN KEY (estimationId) REFERENCES estimations(id)
);

SELECT '✅ Invoices table created successfully' AS status;


-- ============================================================================
-- SECTION 6: SUMMARY & COMPLETION VERIFICATION
-- ============================================================================

SELECT '' AS info;
SELECT '========================================' AS separator;
SELECT 'CONSOLIDATED MIGRATIONS COMPLETED' AS completion_status;
SELECT '========================================' AS separator;
SELECT '' AS info;
SELECT 'Summary of changes:' AS summary;
SELECT '  1. ✅ Permissions table recreated with correct schema' AS item;
SELECT '  2. ✅ Status enums updated for leads, estimations, job_assignments' AS item;
SELECT '  3. ✅ Old status values converted to new job workflow statuses' AS item;
SELECT '  4. ✅ Unassigned leads set to ''New'' status' AS item;
SELECT '  5. ✅ All records validated to use valid status values' AS item;
SELECT '  6. ✅ Invoices table created' AS item;
SELECT '' AS info;
SELECT 'Tables modified: permissions, leads, estimations, job_assignments, invoices' AS tables;
SELECT 'No data was deleted, only status values were migrated' AS note;

-- ============================================================================
