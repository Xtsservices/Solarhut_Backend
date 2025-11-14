import { db } from "./db";

const createRolesTable = `
CREATE TABLE IF NOT EXISTS roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL UNIQUE
)`;

const createEmployeesTable = `
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(10) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    mobile VARCHAR(15) NOT NULL,
    address TEXT,
    joining_date DATE NOT NULL,
    status ENUM('Active', 'Inactive', 'On Leave') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`;

const createEmployeeRolesTable = `
CREATE TABLE IF NOT EXISTS employee_roles (
    employee_id INT NOT NULL,
    role_id INT NOT NULL,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_id, role_id),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
)`;

const createContactsTable = `
CREATE TABLE IF NOT EXISTS contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`;

const createLeadsTable = `
CREATE TABLE IF NOT EXISTS leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    email VARCHAR(100),
    service_type ENUM('Installation', 'Maintenance') NOT NULL,
    solar_service ENUM('Residential Solar', 'Commercial Solar', 'Industrial Solar') NOT NULL,
    status ENUM('New','Assigned','In Progress','Closed','Rejected') NOT NULL DEFAULT 'New',
    capacity VARCHAR(50),
    message TEXT,
    location VARCHAR(255) NOT NULL,
    property_type VARCHAR(100) NOT NULL,
    assigned_to INT NULL,
    channel VARCHAR(20) DEFAULT 'WEB',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_solar_service (solar_service),
    INDEX idx_property_type (property_type),
    INDEX idx_status (status),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_created_at (created_at)
)`;

const createOTPVerificationTable = `
CREATE TABLE IF NOT EXISTS otp_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mobile VARCHAR(15) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    attempts INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mobile (mobile),
    INDEX idx_expires (expires_at)
)`;

const createPackagesTable = `
CREATE TABLE IF NOT EXISTS packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    capacity VARCHAR(50) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    original_price DECIMAL(12,2) DEFAULT NULL,
    savings DECIMAL(12,2) DEFAULT NULL,
    monthly_generation VARCHAR(255) DEFAULT NULL,
    features TEXT,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
)
`;

const createFeaturesTable = `
CREATE TABLE IF NOT EXISTS features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    feature_name VARCHAR(255) NOT NULL UNIQUE,
    created_by INT NOT NULL,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE
)
`;

const createCountriesTable = `
CREATE TABLE IF NOT EXISTS countries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_code VARCHAR(3) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    alias_name VARCHAR(100),
    currency_format VARCHAR(10) NOT NULL,
    created_by INT NOT NULL,
    updated_by INT,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_country_code (country_code),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_updated_by (updated_by),
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
)
`;

const createStatesTable = `
CREATE TABLE IF NOT EXISTS states (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_id INT NOT NULL,
    state_code VARCHAR(5) NOT NULL,
    name VARCHAR(100) NOT NULL,
    alias_name VARCHAR(100),
    type ENUM('State', 'UT') NOT NULL DEFAULT 'State',
    created_by INT NOT NULL,
    updated_by INT,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_state_per_country (country_id, state_code),
    UNIQUE KEY unique_state_name_per_country (country_id, name),
    INDEX idx_country_id (country_id),
    INDEX idx_state_code (state_code),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_updated_by (updated_by),
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
)
`;

const createDistrictsTable = `
CREATE TABLE IF NOT EXISTS districts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    state_id INT NOT NULL,
    district_code VARCHAR(5) NOT NULL,
    name VARCHAR(100) NOT NULL,
    alias_name VARCHAR(100),
    created_by INT NOT NULL,
    updated_by INT,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_district_per_state (state_id, district_code),
    UNIQUE KEY unique_district_name_per_state (state_id, name),
    INDEX idx_state_id (state_id),
    INDEX idx_district_code (district_code),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_updated_by (updated_by),
    FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
)
`;

const createCustomersTable = `
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_code VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    full_name VARCHAR(200),
    mobile VARCHAR(15) NOT NULL,
    email VARCHAR(100),
    alternate_mobile VARCHAR(15),
    date_of_birth DATE,
    gender ENUM('Male', 'Female', 'Other'),
    customer_type ENUM('Individual', 'Business', 'Corporate') DEFAULT 'Individual',
    company_name VARCHAR(255),
    gst_number VARCHAR(15),
    pan_number VARCHAR(10),
    lead_source VARCHAR(100),
    notes TEXT,
    status ENUM('Active','Inactive','Blacklisted') DEFAULT 'Active',
    created_by INT NOT NULL,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_mobile (mobile),
    INDEX idx_customer_code (customer_code),
    INDEX idx_mobile (mobile),
    INDEX idx_email (email),
    INDEX idx_customer_type (customer_type),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
)
`;

const createCustomerLocationsTable = `
CREATE TABLE IF NOT EXISTS customer_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    location_type ENUM('Home', 'Office', 'Billing', 'Installation', 'Other') DEFAULT 'Home',
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    district_id INT,
    state_id INT,
    country_id INT,
    pincode VARCHAR(10) NOT NULL,
    landmark VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT NOT NULL,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_location_type (location_type),
    INDEX idx_district_id (district_id),
    INDEX idx_state_id (state_id),
    INDEX idx_country_id (country_id),
    INDEX idx_pincode (pincode),
    INDEX idx_is_primary (is_primary),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL,
    FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE SET NULL,
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
)
`;

const createJobsTable = `
CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_code VARCHAR(20) NOT NULL UNIQUE,
    lead_id INT,
    customer_id INT NOT NULL,
    location_id INT,
    service_type ENUM('Installation', 'Maintenance', 'Repair') NOT NULL,
    solar_service ENUM('Residential Solar', 'Commercial Solar', 'Industrial Solar') NOT NULL,
    package_id INT,
    capacity VARCHAR(50),
    estimated_cost DECIMAL(12,2),
    actual_cost DECIMAL(12,2),
    job_priority ENUM('Low', 'Medium', 'High', 'Urgent') DEFAULT 'Medium',
    scheduled_date DATE,
    completion_date DATE,
    job_description TEXT,
    special_instructions TEXT,
    status ENUM('Created', 'Assigned', 'In Progress', 'On Hold', 'Completed', 'Cancelled') DEFAULT 'Created',
    created_by INT NOT NULL,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_job_code (job_code),
    INDEX idx_lead_id (lead_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_location_id (location_id),
    INDEX idx_service_type (service_type),
    INDEX idx_status (status),
    INDEX idx_scheduled_date (scheduled_date),
    INDEX idx_created_by (created_by),
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES customer_locations(id) ON DELETE SET NULL,
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
)
`;

const createJobLocationsTable = `
CREATE TABLE IF NOT EXISTS job_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    district_id INT,
    state_id INT,
    country_id INT,
    pincode VARCHAR(10) NOT NULL,
    landmark VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_type ENUM('Installation', 'Billing', 'Other') DEFAULT 'Installation',
    created_by INT NOT NULL,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_job_id (job_id),
    INDEX idx_district_id (district_id),
    INDEX idx_state_id (state_id),
    INDEX idx_country_id (country_id),
    INDEX idx_pincode (pincode),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL,
    FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE SET NULL,
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
)
`;

const createJobAssignmentsTable = `
CREATE TABLE IF NOT EXISTS job_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    employee_id INT NOT NULL,
    role_type ENUM('Lead Technician', 'Technician', 'Helper', 'Supervisor', 'Sales Representative') NOT NULL,
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_date DATE,
    end_date DATE,
    assignment_status ENUM('Assigned', 'Active', 'Completed', 'Cancelled') DEFAULT 'Assigned',
    work_hours DECIMAL(5,2),
    notes TEXT,
    assigned_by INT NOT NULL,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_job_employee_role (job_id, employee_id, role_type),
    INDEX idx_job_id (job_id),
    INDEX idx_employee_id (employee_id),
    INDEX idx_role_type (role_type),
    INDEX idx_assignment_status (assignment_status),
    INDEX idx_assigned_date (assigned_date),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
)
`;

const createJobStatusTrackingTable = `
CREATE TABLE IF NOT EXISTS job_status_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    previous_status ENUM('Created', 'Assigned', 'In Progress', 'On Hold', 'Completed', 'Cancelled'),
    new_status ENUM('Created', 'Assigned', 'In Progress', 'On Hold', 'Completed', 'Cancelled') NOT NULL,
    status_reason VARCHAR(255),
    comments TEXT,
    attachment_url VARCHAR(500),
    changed_by INT NOT NULL,
    status_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_job_id (job_id),
    INDEX idx_new_status (new_status),
    INDEX idx_status_date (status_date),
    INDEX idx_changed_by (changed_by),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES employees(id) ON DELETE CASCADE
)
`;

const createJobPaymentsTable = `
CREATE TABLE IF NOT EXISTS job_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    payment_type ENUM('Advance', 'Milestone', 'Final', 'Refund') NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method ENUM('Cash', 'Bank Transfer', 'UPI', 'Card', 'Cheque', 'Online') NOT NULL,
    payment_status ENUM('Pending', 'Completed', 'Failed', 'Cancelled', 'Refunded') DEFAULT 'Pending',
    transaction_id VARCHAR(100),
    payment_reference VARCHAR(100),
    payment_date DATE,
    due_date DATE,
    milestone_description TEXT,
    receipt_url VARCHAR(500),
    payment_gateway_response TEXT,
    processed_by INT,
    verified_by INT,
    created_by INT NOT NULL,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_job_id (job_id),
    INDEX idx_payment_type (payment_type),
    INDEX idx_payment_status (payment_status),
    INDEX idx_payment_date (payment_date),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_created_by (created_by),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (verified_by) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
)
`;const insertDefaultRoles = async () => {
  const defaultRoles = [
    "Admin",
    "Sales Person",
    "Field Executive",
    "Installation Technician",
  ];

  for (const roleName of defaultRoles) {
    await db.execute("INSERT IGNORE INTO roles (role_name) VALUES (?)", [
      roleName,
    ]);
  }
};

const runMigrations = async () => {
  try {
    // Check if customers table exists and needs full_name column migration
    const [customersTables] = await db.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers'"
    ) as any;
    
    if (customersTables.length > 0) {
      // Check if full_name column exists and is NOT NULL
      const [fullNameColumn] = await db.execute(
        "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'full_name'"
      ) as any;
      
      if (fullNameColumn.length > 0 && fullNameColumn[0].IS_NULLABLE === 'NO') {
        console.log('Updating full_name column to allow NULL values...');
        await db.execute(
          "ALTER TABLE customers MODIFY COLUMN full_name VARCHAR(200) NULL"
        );
        console.log('full_name column updated successfully');
      }
    }
    
    // Check if jobs table exists and has old structure
    const [tables] = await db.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs'"
    ) as any;
    
    if (tables.length === 0) {
      // Jobs table doesn't exist, skip migration
      return;
    }
    
    const [columns] = await db.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs'"
    ) as any;
    
    const columnNames = columns.map((col: any) => col.COLUMN_NAME);
    
    // If jobs table has old structure with customer_name, recreate it
    if (columnNames.includes('customer_name')) {
      console.log('Detected old jobs table structure. Recreating with new schema...');
      
      // Drop existing jobs table and related tables (in reverse dependency order)
      await db.execute("SET FOREIGN_KEY_CHECKS = 0");
      await db.execute("DROP TABLE IF EXISTS job_payments");
      await db.execute("DROP TABLE IF EXISTS job_status_tracking");
      await db.execute("DROP TABLE IF EXISTS job_assignments");
      await db.execute("DROP TABLE IF EXISTS job_locations");
      await db.execute("DROP TABLE IF EXISTS jobs");
      await db.execute("SET FOREIGN_KEY_CHECKS = 1");
      
      console.log('Old jobs tables dropped successfully');
      return;
    }
    
    // Add customer_id column if it doesn't exist
    if (!columnNames.includes('customer_id')) {
      console.log('Adding customer_id column to jobs table...');
      await db.execute(
        "ALTER TABLE jobs ADD COLUMN customer_id INT NOT NULL AFTER lead_id"
      );
      await db.execute(
        "ALTER TABLE jobs ADD FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE"
      );
      console.log('customer_id column added successfully');
    }
    
    // Add location_id column if it doesn't exist
    if (!columnNames.includes('location_id')) {
      console.log('Adding location_id column to jobs table...');
      await db.execute(
        "ALTER TABLE jobs ADD COLUMN location_id INT AFTER customer_id"
      );
      await db.execute(
        "ALTER TABLE jobs ADD FOREIGN KEY (location_id) REFERENCES customer_locations(id) ON DELETE SET NULL"
      );
      console.log('location_id column added successfully');
    }
    
  } catch (error) {
    console.error('Error running migrations:', error);
    // Don't throw error, continue with initialization
  }
};

export const initializeDatabase = async () => {
  try {
    // Create tables
    await db.execute(createRolesTable);
    await db.execute(createEmployeesTable);
    await db.execute(createEmployeeRolesTable);
    await db.execute(createContactsTable);
    await db.execute(createLeadsTable);
    await db.execute(createOTPVerificationTable);
    await db.execute(createPackagesTable);
    await db.execute(createFeaturesTable);
    await db.execute(createCountriesTable);
    await db.execute(createStatesTable);
    await db.execute(createDistrictsTable);
    await db.execute(createCustomersTable);
    await db.execute(createCustomerLocationsTable);
    
    // Run migrations to handle existing table structure changes
    await runMigrations();
    
    await db.execute(createJobsTable);
    await db.execute(createJobLocationsTable);
    await db.execute(createJobAssignmentsTable);
    await db.execute(createJobStatusTrackingTable);
    await db.execute(createJobPaymentsTable);

    // Insert default roles if they don't exist
    await insertDefaultRoles();

    console.log("Database tables initialized successfully with migrations");
  } catch (error) {
    console.error("Error initializing database tables:", error);
    throw error;
  }
};
