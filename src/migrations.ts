import { db } from './db';

/**
 * Database Migrations
 * Handles updates to existing tables to ensure schema consistency
 */

/**
 * Migrate jobs table - Update status enum to job workflow statuses
 */
export const migrateJobsTableStatus = async () => {
  try {
    await db.execute(`
      ALTER TABLE jobs 
      MODIFY COLUMN status ENUM('Active', 'Site Visit', 'Estimation Generated', 'Processed', 'Pending on Portal', 'Payment Pending', 'Partial Payment Done', 'Payment Done', 'Invoice Generated', 'Job Done') DEFAULT 'Active'
    `);
    console.log("✅ Successfully migrated jobs table - updated status enum to job workflow statuses");
  } catch (error: any) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log("⚠️  jobs table doesn't exist yet, will be created with correct schema");
    } else {
      console.log("⚠️  Migration for jobs table:", error.message);
    }
  }
};

/**
 * Migrate leads table - Update status enum to job workflow statuses only
 */
export const migrateLeadsTableStatus = async () => {
  try {
    // Step 1: Convert old status values to the new valid ones
    console.log("🔄 Converting old status values in leads table...");
    
    const conversions = [
      { old: 'New', new: 'Active' },
      { old: 'Assigned', new: 'Active' },
      { old: 'In Progress', new: 'Site Visit' },
      { old: 'Closed', new: 'Job Done' },
      { old: 'Rejected', new: 'Job Done' },
      { old: 'Cancelled', new: 'Job Done' },
      { old: 'Complete', new: 'Job Done' },
      { old: 'Completed', new: 'Job Done' }
    ];

    for (const conversion of conversions) {
      try {
        await db.execute(`UPDATE leads SET status = ? WHERE status = ?`, [conversion.new, conversion.old]);
      } catch (err) {
        // Ignore if the old status doesn't exist in this table
      }
    }
    
    // Step 2: Alter the ENUM column with the new values
    await db.execute(`
      ALTER TABLE leads 
      MODIFY COLUMN status ENUM('Active', 'Site Visit', 'Estimation Generated', 'Processed', 'Pending on Portal', 'Payment Pending', 'Partial Payment Done', 'Payment Done', 'Invoice Generated', 'Job Done') NOT NULL DEFAULT 'Active'
    `);
    console.log("✅ Successfully migrated leads table - converted old status values and updated ENUM");
  } catch (error: any) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log("⚠️  leads table doesn't exist yet, will be created with correct schema");
    } else {
      console.log("⚠️  Migration for leads table:", error.message);
    }
  }
};

/**
 * Migrate estimations table - Add missing columns
 */
export const migrateEstimationsTableColumns = async () => {
  try {
    
    // Add customer_id column if it doesn't exist
    try {
      await db.execute(`
        ALTER TABLE estimations ADD COLUMN customer_id INT NULL AFTER id
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
      }
    }
    
    // Add job_id column if it doesn't exist
    try {
      await db.execute(`
        ALTER TABLE estimations ADD COLUMN job_id INT NULL AFTER customer_id
      `);
      console.log("✅ Successfully added job_id column to estimations table");
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
      }
    }
    
    // Add lead_id column if it doesn't exist
    try {
      await db.execute(`
        ALTER TABLE estimations ADD COLUMN lead_id INT NULL AFTER job_id
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
      }
    }
    
    // Add first_name column if it doesn't exist
    try {
      await db.execute(`
        ALTER TABLE estimations ADD COLUMN first_name VARCHAR(100) NOT NULL DEFAULT '' AFTER lead_id
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
      }
    }
    
    // Add last_name column if it doesn't exist
    try {
      await db.execute(`
        ALTER TABLE estimations ADD COLUMN last_name VARCHAR(100) NOT NULL DEFAULT '' AFTER first_name
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
      }
    }
    
    // Add email column if it doesn't exist
    try {
      await db.execute(`
        ALTER TABLE estimations ADD COLUMN email VARCHAR(255) NULL AFTER last_name
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
      }
    }
    
    // Add solar_service column if it doesn't exist
    try {
      await db.execute(`
        ALTER TABLE estimations ADD COLUMN solar_service ENUM('Commercial', 'Residential', 'Industrial') DEFAULT 'Residential' AFTER email
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
      }
    }
    
    // Add service_type column if it doesn't exist
    try {
      await db.execute(`
        ALTER TABLE estimations ADD COLUMN service_type ENUM('Installation', 'Maintenance', 'Repair', 'Battery Replacement', 'Inverter Replacement', 'Panel Cleaning', 'System Upgrade', 'Energy Audit', 'Consultation', 'Other') DEFAULT 'Installation' AFTER solar_service
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
      }
    }
    
    // Add indexes on all new columns
    try {
      await db.execute(`
        ALTER TABLE estimations ADD INDEX idx_customer_id (customer_id)
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEY_NAME') {
      }
    }
    
    try {
      await db.execute(`
        ALTER TABLE estimations ADD INDEX idx_job_id (job_id)
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEY_NAME') {
      }
    }
    
    try {
      await db.execute(`
        ALTER TABLE estimations ADD INDEX idx_lead_id (lead_id)
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEY_NAME') {
      }
    }
    
    try {
      await db.execute(`
        ALTER TABLE estimations ADD INDEX idx_first_name (first_name)
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEY_NAME') {
      }
    }
    
    try {
      await db.execute(`
        ALTER TABLE estimations ADD INDEX idx_last_name (last_name)
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEY_NAME') {
      }
    }
    
    try {
      await db.execute(`
        ALTER TABLE estimations ADD INDEX idx_email (email)
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEY_NAME') {
      }
    }
    
    try {
      await db.execute(`
        ALTER TABLE estimations ADD INDEX idx_solar_service (solar_service)
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEY_NAME') {
      }
    }
    
    try {
      await db.execute(`
        ALTER TABLE estimations ADD INDEX idx_service_type (service_type)
      `);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEY_NAME') {
      }
    }
    
  } catch (error: any) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
    } else {
    }
  }
};

/**
 * Migrate estimations table - Update status enum to job workflow statuses only
 */
export const migrateEstimationsTableStatus = async () => {
  try {
    // First add structure column if it doesn't exist
    try {
      await db.execute(`
        ALTER TABLE estimations ADD COLUMN structure VARCHAR(100) AFTER mobile
      `);
      console.log("✅ Successfully added structure column to estimations table");
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.log("⚠️  Note on structure column:", error.message);
      }
    }
    
    // Step 1: Convert old status values to the new valid ones
    console.log("🔄 Converting old status values in estimations table...");
    
    const conversions = [
      { old: 'New', new: 'Active' },
      { old: 'Draft', new: 'Active' },
      { old: 'In Progress', new: 'Site Visit' },
      { old: 'Closed', new: 'Job Done' },
      { old: 'Completed', new: 'Job Done' },
      { old: 'Cancelled', new: 'Job Done' },
      { old: 'Inactive', new: 'Active' }
    ];

    for (const conversion of conversions) {
      try {
        await db.execute(`UPDATE estimations SET status = ? WHERE status = ?`, [conversion.new, conversion.old]);
      } catch (err) {
        // Ignore if the old status doesn't exist in this table
      }
    }
    
    // Step 2: Alter the ENUM column with the new values
    await db.execute(`
      ALTER TABLE estimations 
      MODIFY COLUMN status ENUM('Active', 'Site Visit', 'Estimation Generated', 'Processed', 'Pending on Portal', 'Payment Pending', 'Partial Payment Done', 'Payment Done', 'Invoice Generated', 'Job Done') DEFAULT 'Active'
    `);
    console.log("✅ Successfully migrated estimations table - converted old status values and updated ENUM");
  } catch (error: any) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log("⚠️  estimations table doesn't exist yet, will be created with correct schema");
    } else {
      console.log("⚠️  Migration for estimations table:", error.message);
    }
  }
};

/**
 * Migrate invoices table - Update status enum to include job-related statuses
 */
export const migrateInvoicesTableStatus = async () => {
  try {
    await db.execute(`
      ALTER TABLE invoices 
      MODIFY COLUMN status ENUM('Active', 'Inactive', 'Draft', 'Pending', 'Completed', 'Cancelled', 'Refunded') DEFAULT 'Active'
    `);
    console.log("✅ Successfully migrated invoices table - updated status enum");
  } catch (error: any) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log("⚠️  invoices table doesn't exist yet, will be created with correct schema");
    } else {
      console.log("⚠️  Migration for invoices table:", error.message);
    }
  }
};

/**
 * Migrate tax_invoices table - Update status enum
 */
export const migrateTaxInvoicesTableStatus = async () => {
  try {
    await db.execute(`
      ALTER TABLE tax_invoices 
      MODIFY COLUMN status ENUM('Active', 'Inactive', 'Draft', 'Pending', 'Completed', 'Cancelled', 'Refunded') DEFAULT 'Active'
    `);
    console.log("✅ Successfully migrated tax_invoices table - updated status enum");
  } catch (error: any) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log("⚠️  tax_invoices table doesn't exist yet, will be created with correct schema");
    } else {
      console.log("⚠️  Migration for tax_invoices table:", error.message);
    }
  }
};

/**
 * Migrate job_assignments table - Update assignment_status enum to job workflow statuses only
 */
export const migrateJobAssignmentsTableStatus = async () => {
  try {
    // Step 1: Convert old status values to the new valid ones
    console.log("🔄 Converting old status values in job_assignments table...");
    
    const conversions = [
      { old: 'Assigned', new: 'Active' },
      { old: 'Completed', new: 'Job Done' },
      { old: 'Cancelled', new: 'Job Done' }
    ];

    for (const conversion of conversions) {
      try {
        await db.execute(`UPDATE job_assignments SET assignment_status = ? WHERE assignment_status = ?`, [conversion.new, conversion.old]);
      } catch (err) {
        // Ignore if the old status doesn't exist in this table
      }
    }
    
    // Step 2: Alter the ENUM column with the new values
    await db.execute(`
      ALTER TABLE job_assignments 
      MODIFY COLUMN assignment_status ENUM('Active', 'Site Visit', 'Estimation Generated', 'Processed', 'Pending on Portal', 'Payment Pending', 'Partial Payment Done', 'Payment Done', 'Invoice Generated', 'Job Done') DEFAULT 'Active'
    `);
    console.log("✅ Successfully migrated job_assignments table - converted old status values and updated ENUM");
  } catch (error: any) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log("⚠️  job_assignments table doesn't exist yet, will be created with correct schema");
    } else {
      console.log("⚠️  Migration for job_assignments table:", error.message);
    }
  }
};

/**
 * Execute all status-related migrations
 */
export const runStatusMigrations = async () => {
  console.log("\n🔄 Running database status migrations...\n");
  
  await migrateJobsTableStatus();
  await migrateLeadsTableStatus();
  await migrateEstimationsTableColumns();
  await migrateEstimationsTableStatus();
  await migrateInvoicesTableStatus();
  await migrateTaxInvoicesTableStatus();
  await migrateJobAssignmentsTableStatus();
  
  console.log("\n✅ All status migrations completed!\n");
};
