import { db } from './db';

const createContactUsTable = `
CREATE TABLE IF NOT EXISTS contact_us (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    email VARCHAR(100) NOT NULL,
    service_type ENUM('Installation', 'Maintenance') NOT NULL,
    capacity VARCHAR(50),
    message TEXT,
    location VARCHAR(255) NOT NULL,
    home_type VARCHAR(100) NOT NULL,
    channel VARCHAR(20) DEFAULT 'WEB',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;

const alterContactUsTable = `
ALTER TABLE contact_us
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
`;

export const initializeDatabase = async () => {
    try {
        await db.execute(createContactUsTable);
        await db.execute(alterContactUsTable);
        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database tables:', error);
        throw error;
    }
};