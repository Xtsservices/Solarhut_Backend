import { db } from './db';

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

export const initializeDatabase = async () => {
    try {
        // Create table if not exists
        await db.execute(createLeadsTable);

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