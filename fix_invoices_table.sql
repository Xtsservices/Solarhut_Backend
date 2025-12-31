-- Create invoices table similar to estimations
CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customerId INT NOT NULL,
    estimationId INT NOT NULL,
    invoiceDate DATE NOT NULL,
    items JSON NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    tax DECIMAL(12,2) NOT NULL,
    grandTotal DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES customers(id),
    FOREIGN KEY (estimationId) REFERENCES estimations(id)
);
