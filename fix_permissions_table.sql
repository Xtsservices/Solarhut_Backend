-- Script to fix permissions table schema issue
-- This will show the current table structure and provide commands to fix it

-- 1. First, check the current table structure
DESCRIBE permissions;

-- 2. If the table doesn't have the correct columns, drop and recreate it
DROP TABLE IF EXISTS permissions;

-- 3. Recreate the table with the correct schema
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
);