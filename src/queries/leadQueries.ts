export const leadQueries = {
    createLead: `
        INSERT INTO leads 
        (first_name, last_name, mobile, email, service_type, capacity, message, location, home_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    
    getLeadById: `
        SELECT * FROM leads WHERE id = ?
    `,
    
    getAllLeads: `
        SELECT * FROM leads ORDER BY created_at DESC
    `
};