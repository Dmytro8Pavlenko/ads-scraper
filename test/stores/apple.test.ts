import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseLookup } from "../../src/stores/apple.js";

const dir = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(dir, "../fixtures/itunes-lookup.json"), "utf8"),
) as Parameters<typeof parseLookup>[1];

describe("parseLookup", () => {
  it("maps numeric ids and missing rows to not_found", () => {
    const rows = parseLookup(["284882215", "1"], fixture);
    expect(rows[0]).toMatchObject({
      bundleId: "284882215",
      ok: true,
      status: "active",
      title: "Facebook",
      developerUrl: "https://about.meta.com/",
      storeDeveloperId: "284882218",
    });
    expect(rows[1]).toMatchObject({ bundleId: "1", ok: true, status: "not_found" });
  });
});
