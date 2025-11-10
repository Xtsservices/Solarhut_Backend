import { db } from './db';

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

const dropRoleIdColumn = `
ALTER TABLE employees
DROP COLUMN role_id`;

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

const dropTables = `
DROP TABLE IF EXISTS employee_roles;
DROP TABLE IF EXISTS roles;
`;

const createRolesTable = `
CREATE TABLE IF NOT EXISTS roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL UNIQUE
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

const dropLeadsTable = `DROP TABLE IF EXISTS leads`;

const createLeadsTable = `
CREATE TABLE leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    email VARCHAR(100),
    service_type ENUM('Installation', 'Maintenance') NOT NULL,
    solar_service ENUM('Residential Solar', 'Commercial Solar', 'Industrial Solar') NOT NULL,
    capacity VARCHAR(50),
    message TEXT,
    location VARCHAR(255) NOT NULL,
    property_type VARCHAR(100) NOT NULL,
    channel VARCHAR(20) DEFAULT 'WEB',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_solar_service (solar_service),
    INDEX idx_property_type (property_type),
    INDEX idx_created_at (created_at)
)`;

// Function to check if a column exists
const columnExistsQuery = `
SELECT COUNT(*) as count
FROM information_schema.columns 
WHERE table_schema = DATABASE()
AND table_name = 'leads' 
AND column_name = ?
`;

const addUpdatedAtColumn = `
ALTER TABLE leads
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
`;

const insertDefaultRoles = async () => {
    const defaultRoles = [
        'Sales Person',
        'Field Executive',
        'Installation Technician'
    ];

    for (const roleName of defaultRoles) {
        await db.execute(
            'INSERT IGNORE INTO roles (role_name) VALUES (?)',
            [roleName]
        );
    }
};

export const initializeDatabase = async () => {
    try {
        // Drop only employee_roles table, preserve roles
        await db.execute('DROP TABLE IF EXISTS employee_roles');
        
        // Create tables
        await db.execute(createRolesTable);
        await db.execute(createEmployeesTable);
        
        // Try to drop role_id column if it exists
        try {
            await db.execute(dropRoleIdColumn);
        } catch (error) {
            // Ignore error if column doesn't exist
            console.log('Note: role_id column might not exist, continuing...');
        }

        // Remove password and date_of_birth columns permanently
        try {
            await db.execute('ALTER TABLE employees DROP COLUMN IF EXISTS password');
            await db.execute('ALTER TABLE employees DROP COLUMN IF EXISTS date_of_birth');
        } catch (error) {
            console.log('Note: column removal failed, continuing...');
        }
        
        await db.execute(createEmployeeRolesTable);
        await db.execute(createContactsTable);

        // Drop and recreate leads table with new structure
        console.log('Dropping existing leads table...');
        await db.execute(dropLeadsTable);
        console.log('Creating new leads table with updated structure...');
        await db.execute(createLeadsTable);
        console.log('✅ Leads table successfully recreated with new structure');
        
        // Insert default roles if they don't exist
        await insertDefaultRoles();

        // Check if updated_at column exists
        const [rows] = await db.execute(columnExistsQuery, ['updated_at']) as any;
        
        // Add updated_at column if it doesn't exist
        if (rows[0].count === 0) {
            await db.execute(addUpdatedAtColumn);
        }

        // Create OTP verification table
        await db.execute(createOTPVerificationTable);

        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database tables:', error);
        throw error;
    }
};