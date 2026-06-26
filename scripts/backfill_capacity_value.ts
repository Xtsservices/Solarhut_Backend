import { db } from "../src/db";
import { parseCapacity } from "../src/utils/capacityUtils";

async function run() {
  const conn = await (db as any).getConnection();
  try {
    console.log('Starting capacity backfill...');

    // Select jobs that are missing numeric capacity
    const [rows] = await conn.execute(
      `SELECT j.id, j.capacity, j.capacity_raw, j.estimation_id, e.product_description
       FROM jobs j
       LEFT JOIN estimations e ON j.estimation_id = e.id
       WHERE j.capacity_value IS NULL`,
    );

    const jobs = rows as any[];
    console.log(`Found ${jobs.length} jobs to process`);

    let updated = 0;
    for (const job of jobs) {
      const source = job.capacity_raw || job.product_description || job.capacity || null;
      if (!source) continue;

      const parsed = parseCapacity(source);
      if (!parsed) continue;

      const capacityValue = parsed.value ?? null;
      const capacityUnit = parsed.unit ?? null;
      const capacityNormalized = parsed.normalized ?? null;

      // Only write what we have
      const updates: string[] = [];
      const params: any[] = [];
      if (capacityValue !== null) {
        updates.push('capacity_value = ?');
        params.push(capacityValue);
      }
      if (capacityUnit !== null) {
        updates.push('capacity_unit = ?');
        params.push(capacityUnit);
      }
      if (capacityNormalized) {
        updates.push('capacity = ?');
        params.push(capacityNormalized);
      }

      if (updates.length === 0) continue;

      params.push(job.id);
      const sql = `UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`;
      await conn.execute(sql, params);
      updated++;
      if (updated % 100 === 0) console.log(`Updated ${updated}/${jobs.length}`);
    }

    console.log(`Backfill complete. Updated ${updated} jobs.`);
  } catch (err) {
    console.error('Backfill failed:', err);
  } finally {
    try { conn.release(); } catch(e) {}
    process.exit(0);
  }
}

run();
