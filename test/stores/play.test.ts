import { describe, expect, it } from "vitest";
import { isPlayCaptcha, parsePlayPage } from "../../src/stores/play.js";

describe("play parse", () => {
  it("treats /sorry as captcha", () => {
    expect(isPlayCaptcha(200, "<html></html>", "https://google.com/sorry/index")).toBe(true);
  });

  it("reads 404 as not_found", () => {
    const row = parsePlayPage("com.missing.app", 404, "");
    expect(row).toMatchObject({ ok: true, status: "not_found", httpStatus: 404 });
  });

  it("pulls title, developer id and website", () => {
    const html = `
      <meta property="og:title" content="Candy Crush Saga">
      <meta name="appstore:developer_url" content="https://candycrush.com">
      <a href="/store/apps/dev?id=12345">King</a>
    `;
    expect(parsePlayPage("com.king.candycrushsaga", 200, html)).toMatchObject({
      ok: true,
      status: "active",
      title: "Candy Crush Saga",
      storeDeveloperId: "12345",
      developerUrl: "https://candycrush.com",
    });
  });

  it("falls back to the AF_initData contact blob when meta is missing", () => {
    const html = `
      <meta property="og:title" content="WhatsApp Messenger - Apps on Google Play">
      <a href="/store/apps/developer?id=WhatsApp+LLC"><span>WhatsApp LLC</span></a>
      ["WhatsApp LLC",[null,null,null,null,[null,null,"/store/apps/developer?id\\u003dWhatsApp+LLC"]],"5191370068110375942"],[[null,null,null,null,null,[null,null,"http://www.whatsapp.com/"]],["android@support.whatsapp.com"]
    `;
    expect(parsePlayPage("com.whatsapp", 200, html)).toMatchObject({
      developerUrl: "http://www.whatsapp.com/",
      storeDeveloperId: "WhatsApp+LLC",
    });
  });
});
