import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL before running npm run db:migrate");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const migrationsDirectory = path.join(process.cwd(), "migrations");
const migrations = (await fs.readdir(migrationsDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const migration of migrations) {
  const source = await fs.readFile(path.join(migrationsDirectory, migration), "utf8");
  await sql.unsafe(source);
  console.log(`Applied ${migration}`);
}

await sql.end();
