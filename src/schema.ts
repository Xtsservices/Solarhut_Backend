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

    // Insert default roles if they don't exist
    await insertDefaultRoles();

    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Error initializing database tables:", error);
    throw error;
  }
};
