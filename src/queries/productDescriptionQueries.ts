import { db } from "../db";

export interface ProductDescription {
  id?: number;
  name: string;
  status?: 'Active' | 'Inactive';
  created_by: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
}

// Get all product descriptions
export const getAllProductDescriptions = async (): Promise<ProductDescription[]> => {
  const [rows] = await db.execute(`
    SELECT 
      pd.*,
      CONCAT(e.first_name, ' ', e.last_name) as created_by_name,
      CONCAT(u.first_name, ' ', u.last_name) as updated_by_name
    FROM product_descriptions pd
    LEFT JOIN employees e ON pd.created_by = e.id
    LEFT JOIN employees u ON pd.updated_by = u.id
    ORDER BY pd.name ASC
  `);
  return rows as ProductDescription[];
};

// Get active product descriptions for dropdown
export const getActiveProductDescriptions = async (): Promise<ProductDescription[]> => {
  const [rows] = await db.execute(`
    SELECT id, name
    FROM product_descriptions 
    WHERE status = 'Active'
    ORDER BY name ASC
  `);
  return rows as ProductDescription[];
};

// Get product description by ID
export const getProductDescriptionById = async (id: number): Promise<ProductDescription | null> => {
  const [rows]: [any[], any] = await db.execute(`
    SELECT 
      pd.*,
      CONCAT(e.first_name, ' ', e.last_name) as created_by_name,
      CONCAT(u.first_name, ' ', u.last_name) as updated_by_name
    FROM product_descriptions pd
    LEFT JOIN employees e ON pd.created_by = e.id
    LEFT JOIN employees u ON pd.updated_by = u.id
    WHERE pd.id = ?
  `, [id]);
  
  if (rows.length === 0) return null;
  return rows[0] as ProductDescription;
};

// Create new product description
export const createProductDescription = async (productDescription: ProductDescription): Promise<number> => {
  const [result]: [any, any] = await db.execute(`
    INSERT INTO product_descriptions (name, status, created_by)
    VALUES (?, ?, ?)
  `, [
    productDescription.name,
    productDescription.status || 'Active',
    productDescription.created_by
  ]);
  
  return result.insertId;
};

// Update product description
export const updateProductDescription = async (id: number, productDescription: Partial<ProductDescription>, updatedBy?: number): Promise<boolean> => {
  const fields = [];
  const values = [];
  
  if (productDescription.name !== undefined) {
    fields.push('name = ?');
    values.push(productDescription.name);
  }
  
  if (productDescription.status !== undefined) {
    fields.push('status = ?');
    values.push(productDescription.status);
  }
  
  if (updatedBy) {
    fields.push('updated_by = ?');
    values.push(updatedBy);
  }
  
  fields.push('updated_at = NOW()');
  
  if (fields.length === 1) return false; // Only updated_at was added
  
  values.push(id);
  
  const [result]: [any, any] = await db.execute(`
    UPDATE product_descriptions 
    SET ${fields.join(', ')}
    WHERE id = ?
  `, values);
  
  return result.affectedRows > 0;
};

// Delete product description (soft delete by setting status to Inactive)
export const deleteProductDescription = async (id: number): Promise<boolean> => {
  const [result]: [any, any] = await db.execute(`
    UPDATE product_descriptions 
    SET status = 'Inactive'
    WHERE id = ?
  `, [id]);
  
  return result.affectedRows > 0;
};

// Hard delete product description (permanent deletion)
export const hardDeleteProductDescription = async (id: number): Promise<boolean> => {
  const [result]: [any, any] = await db.execute(`
    DELETE FROM product_descriptions 
    WHERE id = ?
  `, [id]);
  
  return result.affectedRows > 0;
};

// Check if product description name exists
export const productDescriptionNameExists = async (name: string, category?: string, excludeId?: number): Promise<boolean> => {
  let query = `SELECT COUNT(*) as count FROM product_descriptions WHERE name = ?`;
  let params = [name];
  
  if (excludeId) {
    query += ` AND id != ?`;
    params.push(excludeId.toString());
  }
  
  const [rows]: [any[], any] = await db.execute(query, params);
  return rows[0].count > 0;
};

