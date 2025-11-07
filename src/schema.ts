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
    password VARCHAR(255),
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

const createLeadsTable = `
CREATE TABLE IF NOT EXISTS leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    email VARCHAR(100),
    service_type ENUM('Installation', 'Maintenance') NOT NULL,
    capacity VARCHAR(50),
    message TEXT,
    location VARCHAR(255) NOT NULL,
    home_type VARCHAR(100) NOT NULL,
    channel VARCHAR(20) DEFAULT 'WEB',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

        // Modify password column to be nullable and remove date_of_birth
        try {
            await db.execute('ALTER TABLE employees MODIFY COLUMN password VARCHAR(255) NULL');
            await db.execute('ALTER TABLE employees DROP COLUMN IF EXISTS date_of_birth');
        } catch (error) {
            console.log('Note: schema modification failed, continuing...');
        }
        
        await db.execute(createEmployeeRolesTable);
        await db.execute(createContactsTable);
        await db.execute(createLeadsTable);
        
        // Insert default roles if they don't exist
        await insertDefaultRoles();

        // Check if updated_at column exists
        const [rows] = await db.execute(columnExistsQuery, ['updated_at']) as any;
        
        // Add updated_at column if it doesn't exist
        if (rows[0].count === 0) {
            await db.execute(addUpdatedAtColumn);
        }

        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database tables:', error);
        throw error;
    }
};