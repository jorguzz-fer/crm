import { describe, it, expect } from "vitest";
import { captureFromUrl } from "../client/capture-params";

describe("captureFromUrl — whitelist de params", () => {
  it("captura fbclid de URL simples", () => {
    const data = captureFromUrl("https://curso.com/lp?fbclid=IwAR0123");
    expect(data.fbclid).toBe("IwAR0123");
  });

  it("captura gclid", () => {
    const data = captureFromUrl("https://curso.com/lp?gclid=CjwKCAjw1");
    expect(data.gclid).toBe("CjwKCAjw1");
  });

  it("captura gbraid (iOS)", () => {
    const data = captureFromUrl("https://curso.com/lp?gbraid=0AAAAA");
    expect(data.gbraid).toBe("0AAAAA");
  });

  it("captura wbraid (web→app)", () => {
    const data = captureFromUrl("https://curso.com/lp?wbraid=0ZZZZZ");
    expect(data.wbraid).toBe("0ZZZZZ");
  });

  it("captura todos os UTMs quando presentes", () => {
    const data = captureFromUrl(
      "https://curso.com/lp?utm_source=meta&utm_medium=paid&utm_campaign=pos-card&utm_content=video3&utm_term=cardiologia",
    );
    expect(data.utmSource).toBe("meta");
    expect(data.utmMedium).toBe("paid");
    expect(data.utmCampaign).toBe("pos-card");
    expect(data.utmContent).toBe("video3");
    expect(data.utmTerm).toBe("cardiologia");
  });

  it("retorna null pra params ausentes — nunca string vazia", () => {
    const data = captureFromUrl("https://curso.com/lp");
    expect(data.fbclid).toBeNull();
    expect(data.gclid).toBeNull();
    expect(data.utmSource).toBeNull();
  });

  it("preserva landingPage com query string", () => {
    const data = captureFromUrl("https://curso.com/lp?fbclid=x&utm_source=meta");
    expect(data.landingPage).toBe("/lp?fbclid=x&utm_source=meta");
  });

  it("aceita objeto URL pré-parseado (SSR)", () => {
    const url = new URL("https://curso.com/lp?fbclid=abc");
    const data = captureFromUrl(url);
    expect(data.fbclid).toBe("abc");
  });

  it("ignora params desconhecidos (whitelist)", () => {
    const data = captureFromUrl("https://curso.com/lp?custom_evil=xss<script>");
    // Não deve ter nenhum campo custom, só os da whitelist
    expect(Object.values(data)).not.toContain("xss<script>");
  });

  it("preserva referrer e userAgent quando passados", () => {
    const data = captureFromUrl("https://curso.com/lp", {
      referrer: "https://facebook.com",
      userAgent: "Mozilla/5.0 (iPhone)",
    });
    expect(data.referrer).toBe("https://facebook.com");
    expect(data.userAgent).toBe("Mozilla/5.0 (iPhone)");
  });

  it("captura combinação Meta + Google ao mesmo tempo", () => {
    const data = captureFromUrl(
      "https://curso.com/lp?fbclid=IwAR&gclid=Cj&utm_source=google",
    );
    expect(data.fbclid).toBe("IwAR");
    expect(data.gclid).toBe("Cj");
    expect(data.utmSource).toBe("google");
  });
});
