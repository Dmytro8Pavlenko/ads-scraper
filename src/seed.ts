import { loadBase } from "./lib/config.js";
import { closeDb, getDb } from "./db/client.js";
import { apps } from "./db/schema.js";
import { iosIds } from "./data/ios-ids.js";

const ANDROID = [
  "com.facebook.katana",
  "com.whatsapp",
  "com.instagram.android",
  "com.twitter.android",
  "com.google.android.youtube",
  "com.zhiliaoapp.musically",
  "com.king.candycrushsaga",
  "com.spotify.music",
  "com.roblox.client",
  "com.pinterest",
];

const config = loadBase();
const db = getDb(config.databaseUrl);

const rows = [
  ...iosIds.map((bundleId) => ({ store: "ios", bundleId })),
  ...ANDROID.map((bundleId) => ({ store: "android", bundleId })),
];

await db.insert(apps).values(rows).onConflictDoNothing();
await closeDb();
console.log(`seeded ${rows.length} apps (${iosIds.length} ios)`);
