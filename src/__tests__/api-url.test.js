import { apiHeaders, resolveApiUrl } from "../api";

describe("API URL resolution", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("keeps relative API paths in local development", () => {
    expect(resolveApiUrl("/api/ask-vela", {
      nodeEnv: "development",
      locationProtocol: "http:",
    })).toBe("/api/ask-vela");
  });

  it("uses an explicit API base URL when configured", () => {
    expect(resolveApiUrl("/api/ask-vela", {
      apiBaseUrl: "http://localhost:8888/",
      nodeEnv: "development",
      locationProtocol: "http:",
    })).toBe("http://localhost:8888/api/ask-vela");
  });

  it("routes Capacitor builds to the production Netlify API", () => {
    expect(resolveApiUrl("/api/daily-brief", {
      nodeEnv: "production",
      locationProtocol: "capacitor:",
    })).toBe("https://velahealth.health/api/daily-brief");
  });

  it("adds the local dev bypass header only in development", () => {
    process.env.NODE_ENV = "development";
    process.env.REACT_APP_ASK_VELA_DEV_TOKEN = "local-token";

    expect(apiHeaders({ "Content-Type": "application/json" })).toEqual({
      "Content-Type": "application/json",
      "x-dev-token": "local-token",
    });

    process.env.NODE_ENV = "production";
    expect(apiHeaders({ "Content-Type": "application/json" })).toEqual({
      "Content-Type": "application/json",
    });
  });
});
