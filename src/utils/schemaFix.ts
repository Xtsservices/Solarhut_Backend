import { db } from '../db';

/**
 * Function to check and fix the permissions table schema
 * This should be run if you encounter the "Unknown column 'permission'" error
 */
export const fixPermissionsTableSchema = async () => {
    try {
        console.log('🔍 Checking permissions table structure...');
        
        // Check if the table exists and get its structure
        const [columns] = await db.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'permissions'
        `);
        
        const columnNames = (columns as any[]).map(col => col.COLUMN_NAME);
        console.log('📋 Current columns:', columnNames);
        
        // Check if the permission column exists
        if (!columnNames.includes('permission')) {
            console.log('❌ Missing "permission" column. Recreating table...');
            
            // Drop the table if it exists
            await db.execute('DROP TABLE IF EXISTS permissions');
            
            // Recreate the table with the correct schema
            const createPermissionsTable = `
                CREATE TABLE permissions (
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
            
            await db.execute(createPermissionsTable);
            console.log('✅ Permissions table recreated successfully');
        } else {
            console.log('✅ Permissions table schema is correct');
        }
        
    } catch (error) {
        console.error('❌ Error fixing permissions table schema:', error);
        throw error;
    }
};

/**
 * Function to validate and fix all database tables
 * This ensures all tables have the correct schema
 */
export const validateAndFixAllTables = async () => {
    try {
        console.log('🔧 Starting database schema validation and fix...');
        
        // Import the schema initialization function
        const { initializeDatabase } = await import('../schema');
        
        // First, try to fix the permissions table specifically
        await fixPermissionsTableSchema();
        
        // Then run the full database initialization to ensure all tables are correct
        await initializeDatabase();
        
        console.log('✅ All database tables validated and fixed');
        
    } catch (error) {
        console.error('❌ Error during database validation and fix:', error);
        throw error;
    }
};