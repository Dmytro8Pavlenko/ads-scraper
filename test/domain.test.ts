import { describe, expect, it } from "vitest";
import { etldPlusOne, fallbackHosts, hostFromUrl } from "../src/lib/domain.js";

describe("hostFromUrl", () => {
  it("lowercases and strips www, path, port", () => {
    expect(hostFromUrl("https://WWW.Example.COM:443/app-ads.txt")).toBe("example.com");
  });

  it("accepts a bare host", () => {
    expect(hostFromUrl("ads.super-games.co.uk")).toBe("ads.super-games.co.uk");
  });
});

describe("etldPlusOne", () => {
  it("uses psl for a subdomain", () => {
    expect(etldPlusOne("ads.example-publisher.com")).toBe("example-publisher.com");
  });

  it("keeps a listed host that is already eTLD+1", () => {
    expect(etldPlusOne("example.com")).toBe("example.com");
  });
});

describe("fallbackHosts", () => {
  it("tries listed host then root", () => {
    expect(fallbackHosts("cdn.example.com")).toEqual(["cdn.example.com", "example.com"]);
  });
});
