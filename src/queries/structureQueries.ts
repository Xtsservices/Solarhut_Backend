import { db } from "../db";

export interface Structure {
  id?: number;
  name: string;
  status?: 'Active' | 'Inactive';
  created_by: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
}

// Get all structures
export const getAllStructures = async (): Promise<Structure[]> => {
  const [rows] = await db.execute(`
    SELECT 
      s.*,
      CONCAT(e.first_name, ' ', e.last_name) as created_by_name,
      CONCAT(u.first_name, ' ', u.last_name) as updated_by_name
    FROM structures s
    LEFT JOIN employees e ON s.created_by = e.id
    LEFT JOIN employees u ON s.updated_by = u.id
    ORDER BY s.name ASC
  `);
  return rows as Structure[];
};

// Get active structures for dropdown
export const getActiveStructures = async (): Promise<Structure[]> => {
  const [rows] = await db.execute(`
    SELECT id, name
    FROM structures 
    WHERE status = 'Active'
    ORDER BY name ASC
  `);
  return rows as Structure[];
};

// Get structure by ID
export const getStructureById = async (id: number): Promise<Structure | null> => {
  const [rows]: [any[], any] = await db.execute(`
    SELECT 
      s.*,
      CONCAT(e.first_name, ' ', e.last_name) as created_by_name,
      CONCAT(u.first_name, ' ', u.last_name) as updated_by_name
    FROM structures s
    LEFT JOIN employees e ON s.created_by = e.id
    LEFT JOIN employees u ON s.updated_by = u.id
    WHERE s.id = ?
  `, [id]);
  
  if (rows.length === 0) return null;
  return rows[0] as Structure;
};

// Create new structure
export const createStructure = async (structure: Structure): Promise<number> => {
  const [result]: [any, any] = await db.execute(`
    INSERT INTO structures (name, status, created_by)
    VALUES (?, ?, ?)
  `, [
    structure.name,
    structure.status || 'Active',
    structure.created_by
  ]);
  
  return result.insertId;
};

// Update structure
export const updateStructure = async (id: number, structure: Partial<Structure>, updatedBy?: number): Promise<boolean> => {
  const fields = [];
  const values = [];
  
  if (structure.name !== undefined) {
    fields.push('name = ?');
    values.push(structure.name);
  }
  
  if (structure.status !== undefined) {
    fields.push('status = ?');
    values.push(structure.status);
  }
  
  if (updatedBy) {
    fields.push('updated_by = ?');
    values.push(updatedBy);
  }
  
  // Check if there are any meaningful changes
  if (fields.length === 0) return false;
  
  // Add timestamp field
  fields.push('updated_at = NOW()');
  values.push(id);
  
  const [result]: [any, any] = await db.execute(`
    UPDATE structures 
    SET ${fields.join(', ')}
    WHERE id = ?
  `, values);
  
  return result.affectedRows > 0;
};

// Delete structure (soft delete by setting status to Inactive)
export const deleteStructure = async (id: number): Promise<boolean> => {
  const [result]: [any, any] = await db.execute(`
    UPDATE structures 
    SET status = 'Inactive'
    WHERE id = ?
  `, [id]);
  
  return result.affectedRows > 0;
};

// Hard delete structure (permanent deletion)
export const hardDeleteStructure = async (id: number): Promise<boolean> => {
  const [result]: [any, any] = await db.execute(`
    DELETE FROM structures 
    WHERE id = ?
  `, [id]);
  
  return result.affectedRows > 0;
};

// Check if structure name exists
export const structureNameExists = async (name: string, excludeId?: number): Promise<boolean> => {
  let query = `SELECT COUNT(*) as count FROM structures WHERE name = ?`;
  let params = [name];
  
  if (excludeId) {
    query += ` AND id != ?`;
    params.push(excludeId.toString());
  }
  
  const [rows]: [any[], any] = await db.execute(query, params);
  return rows[0].count > 0;
};