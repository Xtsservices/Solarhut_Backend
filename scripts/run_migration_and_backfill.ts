import fs from "fs";
import path from "path";
import { db } from "../src/db";
import { parseCapacity } from "../src/utils/capacityUtils";

async function runSqlFile(filePath: string) {
  const sql = fs.readFileSync(filePath, "utf8");
  // Split statements by semicolon and execute non-empty trimmed statements
  const statements = sql
    .split(/;\s*(?=\n|$)/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      // Execute each statement
      await db.execute(stmt);
      console.log("Executed:", stmt.split("\n")[0].slice(0, 120));
    } catch (err: any) {
      console.error("SQL execution error:", err.message || err);
      throw err;
    }
  }
}

async function backfillCapacity() {
  // 1) Copy capacity -> capacity_raw where capacity_raw IS NULL
  const [rows] = await db.execute<any[]>(
    `SELECT id, capacity, capacity_raw FROM jobs`,
  );

  for (const row of rows) {
    const id = row.id;
    const capacityRawExisting = row.capacity_raw;
    const capacityField = row.capacity;

    let updated = false;
    let newCapacityRaw = capacityRawExisting;
    let newCapacity = capacityField;

    if ((!capacityRawExisting || capacityRawExisting === "") && capacityField) {
      newCapacityRaw = capacityField;
      updated = true;
    }

    // Always try to parse capacity_raw (if present) and normalize into capacity
    if (newCapacityRaw) {
      const parsed = parseCapacity(newCapacityRaw);
      if (parsed && parsed.normalized && parsed.normalized !== newCapacity) {
        newCapacity = parsed.normalized as any;
        updated = true;
      }
    }

    if (updated) {
      try {
        await db.execute(
          `UPDATE jobs SET capacity = ?, capacity_raw = ? WHERE id = ?`,
          [newCapacity, newCapacityRaw, id],
        );
        console.log(
          `Backfilled job ${id}: capacity='${newCapacity}', capacity_raw='${newCapacityRaw}'`,
        );
      } catch (err: any) {
        console.error(`Failed to update job ${id}:`, err.message || err);
      }
    }
  }
}

async function main() {
  try {
    const migrationsDir = path.join(__dirname, "..", "migrations");
    const migrationFile = path.join(migrationsDir, "001_add_capacity_raw.sql");

    console.log("Running migration:", migrationFile);
    await runSqlFile(migrationFile);

    console.log("Running backfill for capacity...");
    await backfillCapacity();

    console.log("Migration and backfill completed.");
    process.exit(0);
  } catch (err) {
    console.error("Migration/backfill failed:", err);
    process.exit(1);
  }
}

main();
