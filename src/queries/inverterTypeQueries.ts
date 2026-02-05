import { db, executeQuery } from "../db";

export interface InverterType {
  id?: number;
  name: string;
  status?: 'Active' | 'Inactive';
  created_by: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
}

// Get all inverter types
export const getAllInverterTypes = async (): Promise<InverterType[]> => {
  try {
    const [rows] = await executeQuery(`
      SELECT 
        it.*,
        CONCAT(e.first_name, ' ', e.last_name) as created_by_name,
        CONCAT(u.first_name, ' ', u.last_name) as updated_by_name
      FROM inverter_types it
      LEFT JOIN employees e ON it.created_by = e.id
      LEFT JOIN employees u ON it.updated_by = u.id
      ORDER BY it.name ASC
    `);
    return rows as InverterType[];
  } catch (error) {
    console.error('Error in getAllInverterTypes:', error);
    throw new Error(`Failed to fetch inverter types: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Get active inverter types for dropdown
export const getActiveInverterTypes = async (): Promise<InverterType[]> => {
  const [rows] = await db.execute(`
    SELECT id, name
    FROM inverter_types 
    WHERE status = 'Active'
    ORDER BY name ASC
  `);
  return rows as InverterType[];
};

// Get inverter type by ID
export const getInverterTypeById = async (id: number): Promise<InverterType | null> => {
  const [rows]: [any[], any] = await db.execute(`
    SELECT 
      it.*,
      CONCAT(e.first_name, ' ', e.last_name) as created_by_name
    FROM inverter_types it
    LEFT JOIN employees e ON it.created_by = e.id
    WHERE it.id = ?
  `, [id]);
  
  if (rows.length === 0) return null;
  return rows[0] as InverterType;
};

// Create new inverter type
export const createInverterType = async (inverterType: InverterType): Promise<number> => {
  const [result]: [any, any] = await db.execute(`
    INSERT INTO inverter_types (name, status, created_by)
    VALUES (?, ?, ?)
  `, [
    inverterType.name,
    inverterType.status || 'Active',
    inverterType.created_by
  ]);
  
  return result.insertId;
};

// Update inverter type
export const updateInverterType = async (id: number, inverterType: Partial<InverterType>): Promise<boolean> => {
  const fields = [];
  const values = [];
  
  if (inverterType.name !== undefined) {
    fields.push('name = ?');
    values.push(inverterType.name);
  }
  
  if (inverterType.status !== undefined) {
    fields.push('status = ?');
    values.push(inverterType.status);
  }
  
  if (inverterType.updated_by !== undefined) {
    fields.push('updated_by = ?');
    values.push(inverterType.updated_by);
  }
  
  // Check if there are any meaningful changes
  if (fields.length === 0) return false;
  
  // Add timestamp field
  fields.push('updated_at = NOW()');
  values.push(id);
  
  const [result]: [any, any] = await db.execute(`
    UPDATE inverter_types 
    SET ${fields.join(', ')}
    WHERE id = ?
  `, values);
  
  return result.affectedRows > 0;
};

// Delete inverter type (soft delete by setting status to Inactive)
export const deleteInverterType = async (id: number): Promise<boolean> => {
  const [result]: [any, any] = await db.execute(`
    UPDATE inverter_types 
    SET status = 'Inactive'
    WHERE id = ?
  `, [id]);
  
  return result.affectedRows > 0;
};

// Hard delete inverter type (permanent deletion)
export const hardDeleteInverterType = async (id: number): Promise<boolean> => {
  const [result]: [any, any] = await db.execute(`
    DELETE FROM inverter_types 
    WHERE id = ?
  `, [id]);
  
  return result.affectedRows > 0;
};

// Check if inverter type name exists
export const inverterTypeNameExists = async (name: string, excludeId?: number): Promise<boolean> => {
  let query = `SELECT COUNT(*) as count FROM inverter_types WHERE name = ?`;
  let params = [name];
  
  if (excludeId) {
    query += ` AND id != ?`;
    params.push(excludeId.toString());
  }
  
  const [rows]: [any[], any] = await db.execute(query, params);
  return rows[0].count > 0;
};