import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "./db/client.js";
import { loadBase } from "./lib/config.js";

const config = loadBase();
await migrate(getDb(config.databaseUrl), { migrationsFolder: "drizzle" });
await closeDb();
console.log("migrated");
