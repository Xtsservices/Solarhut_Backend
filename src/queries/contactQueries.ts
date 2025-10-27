export const contactQueries = {
    createContact: `
        INSERT INTO contact_us 
        (first_name, last_name, mobile, email, service_type, capacity, message, location, home_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    
    // Add more queries here as needed
    getContactById: `
        SELECT * FROM contact_us WHERE id = ?
    `,
    
    getAllContacts: `
        SELECT * FROM contact_us ORDER BY created_at DESC
    `
};