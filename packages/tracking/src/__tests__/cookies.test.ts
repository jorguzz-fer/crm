import { describe, it, expect } from "vitest";
import { readTrackingCookies } from "../client/cookies";

describe("readTrackingCookies", () => {
  it("retorna tudo null quando header ausente", () => {
    const cookies = readTrackingCookies(null);
    expect(cookies).toEqual({ fbp: null, fbc: null, ga: null });
  });

  it("retorna tudo null quando header vazio", () => {
    expect(readTrackingCookies("")).toEqual({ fbp: null, fbc: null, ga: null });
  });

  it("extrai _fbp", () => {
    const cookies = readTrackingCookies("_fbp=fb.1.1234567890.987654321");
    expect(cookies.fbp).toBe("fb.1.1234567890.987654321");
  });

  it("extrai _fbc", () => {
    const cookies = readTrackingCookies("_fbc=fb.1.1234567890.IwAR0");
    expect(cookies.fbc).toBe("fb.1.1234567890.IwAR0");
  });

  it("extrai _ga", () => {
    const cookies = readTrackingCookies("_ga=GA1.1.12345.67890");
    expect(cookies.ga).toBe("GA1.1.12345.67890");
  });

  it("extrai todos quando header tem múltiplos cookies", () => {
    const header = "session=abc; _fbp=fb.1.x; _fbc=fb.1.y; _ga=GA1.1.z; lang=pt-BR";
    const cookies = readTrackingCookies(header);
    expect(cookies).toEqual({
      fbp: "fb.1.x",
      fbc: "fb.1.y",
      ga: "GA1.1.z",
    });
  });

  it("ignora cookies não relacionados a tracking", () => {
    const cookies = readTrackingCookies("session=abc; auth=xyz");
    expect(cookies.fbp).toBeNull();
    expect(cookies.fbc).toBeNull();
    expect(cookies.ga).toBeNull();
  });

  it("decodifica valor percent-encoded", () => {
    const cookies = readTrackingCookies("_fbc=fb.1.%7Bid%7D");
    expect(cookies.fbc).toBe("fb.1.{id}");
  });
});
