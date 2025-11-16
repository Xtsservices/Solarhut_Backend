import { db } from "./db";
import { countries } from "./utils/countries";
import { indianStates } from "./utils/states";
import { indianDistricts } from "./utils/districts";
import * as countryQueries from "./queries/countryQueries";
import * as stateQueries from "./queries/stateQueries";
import * as districtQueries from "./queries/districtQueries";

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
)`;

const createCustomersTable = `
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_code VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    full_name VARCHAR(200) GENERATED ALWAYS AS (CONCAT(first_name, IFNULL(CONCAT(' ', last_name), ''))) STORED,
    mobile VARCHAR(15) NOT NULL UNIQUE,
    email VARCHAR(100) UNIQUE,
    alternate_mobile VARCHAR(15),
    date_of_birth DATE,
    gender ENUM('Male', 'Female', 'Other'),
    customer_type ENUM('Individual', 'Business', 'Corporate') DEFAULT 'Individual',
    company_name VARCHAR(255),
    gst_number VARCHAR(15) UNIQUE,
    pan_number VARCHAR(10) UNIQUE,
    lead_source VARCHAR(100),
    notes TEXT,
    created_by INT NOT NULL,
    updated_by INT,
    status ENUM('Active','Inactive','Blacklisted') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer_code (customer_code),
    INDEX idx_mobile (mobile),
    INDEX idx_email (email),
    INDEX idx_customer_type (customer_type),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_updated_by (updated_by),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
)`;

const createCustomerLocationsTable = `
CREATE TABLE IF NOT EXISTS customer_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    location_type ENUM('Home', 'Office', 'Billing', 'Installation', 'Other') NOT NULL,
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    city VARCHAR(100),
    district_id INT,
    state_id INT,
    country_id INT,
    pincode VARCHAR(10),
    landmark VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_primary BOOLEAN DEFAULT FALSE,
    created_by INT NOT NULL,
    updated_by INT,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_location_type (location_type),
    INDEX idx_district_id (district_id),
    INDEX idx_state_id (state_id),
    INDEX idx_country_id (country_id),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_updated_by (updated_by),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL,
    FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE SET NULL,
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
)`;

const createPermissionsTable = `
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
    INDEX idx_customer_id (customer_id),
    INDEX idx_location_id (location_id),
    INDEX idx_service_type (service_type),
    INDEX idx_status (status),
    INDEX idx_scheduled_date (scheduled_date),
    INDEX idx_created_by (created_by),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES customer_locations(id) ON DELETE SET NULL,
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES employees(id) ON DELETE SET NULL
)
`;

const createJobAssignmentsTable = `
CREATE TABLE IF NOT EXISTS job_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    employee_id INT NOT NULL,
    role_type VARCHAR(50) NULL,
    assignment_status ENUM('Assigned', 'Active', 'Completed', 'Cancelled') DEFAULT 'Assigned',
    start_date DATE,
    end_date DATE,
    work_hours DECIMAL(5,2),
    notes TEXT,
    assigned_by INT NOT NULL,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_job_employee_role (job_id, employee_id, role_type),
    INDEX idx_job_id (job_id),
    INDEX idx_employee_id (employee_id),
    INDEX idx_assignment_status (assignment_status),
    INDEX idx_assigned_by (assigned_by),
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
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    status_reason VARCHAR(255),
    comments TEXT,
    attachment_url VARCHAR(500),
    changed_by INT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_job_id (job_id),
    INDEX idx_new_status (new_status),
    INDEX idx_changed_at (changed_at),
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
    discount_amount DECIMAL(12,2) DEFAULT 0,
    taxable_amount DECIMAL(12,2) NOT NULL,
    gst_rate DECIMAL(5,2) DEFAULT 0,
    cgst_rate DECIMAL(5,2) DEFAULT 0,
    sgst_rate DECIMAL(5,2) DEFAULT 0,
    igst_rate DECIMAL(5,2) DEFAULT 0,
    cgst_amount DECIMAL(12,2) DEFAULT 0,
    sgst_amount DECIMAL(12,2) DEFAULT 0,
    igst_amount DECIMAL(12,2) DEFAULT 0,
    total_tax_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
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
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (verified_by) REFERENCES employees(id) ON DELETE SET NULL,
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

const insertDefaultRoles = async () => {
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

const insertDefaultCountries = async () => {
  try {
    // We need a system user ID for created_by field
    // Let's try to get the first admin user, or use ID 1 as fallback
    const [adminUsers] = await db.execute(
      `SELECT e.id FROM employees e 
       INNER JOIN employee_roles er ON e.id = er.employee_id 
       INNER JOIN roles r ON er.role_id = r.role_id 
       WHERE r.role_name = 'Admin' AND e.status = 'Active' 
       LIMIT 1`
    ) as any;
    
    const systemUserId = adminUsers.length > 0 ? adminUsers[0].id : 1;

    for (const country of countries) {
      // Check if country code already exists
      const existingCountryByCode = await countryQueries.getCountryByCode(country.country_code);
      if (existingCountryByCode) {
        console.log(`Country with code ${country.country_code} already exists, skipping...`);
        continue;
      }

      // Check if country name already exists (check against uppercase)
      const existingCountryByName = await countryQueries.getCountryByName(country.name.toUpperCase());
      if (existingCountryByName) {
        console.log(`Country with name ${country.name} already exists, skipping...`);
        continue;
      }

      // Create the country with the same logic as createCountry controller
      const aliasName = country.name; // Use the original name as alias
      // If name has spaces, keep original case; otherwise convert to uppercase
      const countryName = country.name.includes(' ') ? country.name : country.name.toUpperCase();

      const id = await countryQueries.createCountry(
        country.country_code,
        countryName,
        aliasName,
        country.currency_format,
        systemUserId,
        'Active'
      );

      console.log(`Created default country: ${country.name} (${country.country_code}) with ID: ${id}`);
    }
  } catch (error) {
    console.error('Error inserting default countries:', error);
    // Don't throw error to prevent app startup failure
  }
};

const insertDefaultStates = async () => {
  try {
    // We need a system user ID for created_by field
    // Let's try to get the first admin user, or use ID 1 as fallback
    const [adminUsers] = await db.execute(
      `SELECT e.id FROM employees e 
       INNER JOIN employee_roles er ON e.id = er.employee_id 
       INNER JOIN roles r ON er.role_id = r.role_id 
       WHERE r.role_name = 'Admin' AND e.status = 'Active' 
       LIMIT 1`
    ) as any;
    
    const systemUserId = adminUsers.length > 0 ? adminUsers[0].id : 1;

    for (const state of indianStates) {
      // Get country ID from country code
      const country = await countryQueries.getCountryByCode(state.country_code);
      if (!country) {
        console.log(`Country with code ${state.country_code} not found, skipping state ${state.name}...`);
        continue;
      }

      // Check if state code already exists for this country
      const existingStateByCode = await stateQueries.getStateByCode(country.id, state.state_code);
      if (existingStateByCode) {
        console.log(`State with code ${state.state_code} already exists for country ${state.country_code}, skipping...`);
        continue;
      }

      // Check if state name already exists for this country (check against uppercase)
      const existingStateByName = await stateQueries.getStateByName(country.id, state.name.toUpperCase());
      if (existingStateByName) {
        console.log(`State with name ${state.name} already exists for country ${state.country_code}, skipping...`);
        continue;
      }

      // Create the state with the same logic as createState controller
      const aliasName = state.name; // Use the original name as alias
      // If name has spaces, replace with underscores; otherwise keep original case
      const stateName = state.name.includes(' ') ? state.name.replace(/\s+/g, '_') : state.name;

      const id = await stateQueries.createState(
        country.id,
        state.state_code,
        stateName,
        aliasName,
        state.type as 'State' | 'UT',
        systemUserId,
        'Active'
      );

      console.log(`Created default state: ${state.name} (${state.state_code}) for ${state.country_code} with ID: ${id}`);
    }
  } catch (error) {
    console.error('Error inserting default states:', error);
    // Don't throw error to prevent app startup failure
  }
};

const insertDefaultDistricts = async () => {
  try {
    // We need a system user ID for created_by field
    // Let's try to get the first admin user, or use ID 1 as fallback
    const [adminUsers] = await db.execute(
      `SELECT e.id FROM employees e 
       INNER JOIN employee_roles er ON e.id = er.employee_id 
       INNER JOIN roles r ON er.role_id = r.role_id 
       WHERE r.role_name = 'Admin' AND e.status = 'Active' 
       LIMIT 1`
    ) as any;
    
    const systemUserId = adminUsers.length > 0 ? adminUsers[0].id : 1;

    for (const district of indianDistricts) {
      // Get state ID from state code (search across all countries)
      const [stateRows] = await db.execute(
        `SELECT s.id FROM states s WHERE s.state_code = ? AND s.status = 'Active'`,
        [district.state_code]
      ) as any;
      
      if (stateRows.length === 0) {
        console.log(`State with code ${district.state_code} not found, skipping district ${district.name}...`);
        continue;
      }
      
      const state = stateRows[0];

      // Check if district code already exists for this state
      const existingDistrictByCode = await districtQueries.getDistrictByCode(state.id, district.district_code);
      if (existingDistrictByCode) {
        console.log(`District with code ${district.district_code} already exists for state ${district.state_code}, skipping...`);
        continue;
      }

      // Check if district name already exists for this state (check against uppercase)
      const existingDistrictByName = await districtQueries.getDistrictByName(state.id, district.name.toUpperCase());
      if (existingDistrictByName) {
        console.log(`District with name ${district.name} already exists for state ${district.state_code}, skipping...`);
        continue;
      }

      // Create the district with the same logic as createDistrict controller
      const aliasName = district.name; // Use the original name as alias
      // If name has spaces, replace with underscores; otherwise keep original case
      const districtName = district.name.includes(' ') ? district.name.replace(/\s+/g, '_').toUpperCase() : district.name.toUpperCase();

      const id = await districtQueries.createDistrict(
        state.id,
        district.district_code,
        districtName,
        aliasName,
        systemUserId,
        'Active'
      );

      console.log(`Created default district: ${district.name} (${district.district_code}) for state ${district.state_code} with ID: ${id}`);
    }
  } catch (error) {
    console.error('Error inserting default districts:', error);
    // Don't throw error to prevent app startup failure
  }
};

const migrateJobAssignmentsTable = async () => {
  try {
    // Check if job_assignments table exists and migrate role_type column to allow NULL
    await db.execute(`
      ALTER TABLE job_assignments 
      MODIFY COLUMN role_type VARCHAR(50) NULL
    `);
    console.log("Successfully migrated job_assignments table - role_type column now allows NULL");
  } catch (error: any) {
    // If table doesn't exist, ignore the error as it will be created with correct schema
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log("job_assignments table doesn't exist yet, will be created with correct schema");
    } else {
      console.log("Migration for job_assignments table:", error.message);
    }
  }
};

const migrateJobPaymentsTable = async () => {
  try {
    // Check if job_payments table exists and add tax-related columns
    const taxColumns = [
      'ADD COLUMN discount_amount DECIMAL(12,2) DEFAULT 0',
      'ADD COLUMN taxable_amount DECIMAL(12,2) DEFAULT 0',
      'ADD COLUMN gst_rate DECIMAL(5,2) DEFAULT 0',
      'ADD COLUMN cgst_rate DECIMAL(5,2) DEFAULT 0',
      'ADD COLUMN sgst_rate DECIMAL(5,2) DEFAULT 0',
      'ADD COLUMN igst_rate DECIMAL(5,2) DEFAULT 0',
      'ADD COLUMN cgst_amount DECIMAL(12,2) DEFAULT 0',
      'ADD COLUMN sgst_amount DECIMAL(12,2) DEFAULT 0',
      'ADD COLUMN igst_amount DECIMAL(12,2) DEFAULT 0',
      'ADD COLUMN total_tax_amount DECIMAL(12,2) DEFAULT 0',
      'ADD COLUMN total_amount DECIMAL(12,2) DEFAULT 0'
    ];

    for (const column of taxColumns) {
      try {
        await db.execute(`ALTER TABLE job_payments ${column}`);
      } catch (columnError: any) {
        // If column already exists, skip it
        if (columnError.code !== 'ER_DUP_FIELDNAME') {
          console.log(`Error adding column to job_payments: ${columnError.message}`);
        }
      }
    }

    // Update existing records to set taxable_amount = amount and total_amount = amount where they are 0
    await db.execute(`
      UPDATE job_payments 
      SET taxable_amount = amount, total_amount = amount 
      WHERE taxable_amount = 0 OR total_amount = 0
    `);

    console.log("Successfully migrated job_payments table - added tax calculation fields");
  } catch (error: any) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log("job_payments table doesn't exist yet, will be created with correct schema");
    } else {
      console.log("Migration for job_payments table:", error.message);
    }
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
    await db.execute(createPermissionsTable);
    await db.execute(createJobsTable);
    await db.execute(createJobAssignmentsTable);
    await db.execute(createJobStatusTrackingTable);
    await db.execute(createJobPaymentsTable);
    await db.execute(createJobLocationsTable);

    // Run migrations for existing tables
    await migrateJobAssignmentsTable();
    await migrateJobPaymentsTable();

    // Insert default roles if they don't exist
    await insertDefaultRoles();

    // Insert default countries if they don't exist
    await insertDefaultCountries();

    // Insert default states if they don't exist
    await insertDefaultStates();

    // Insert default districts if they don't exist
    await insertDefaultDistricts();

    console.log("Database tables initialized successfully with default data");
  } catch (error) {
    console.error("Error initializing database tables:", error);
    throw error;
  }
};
