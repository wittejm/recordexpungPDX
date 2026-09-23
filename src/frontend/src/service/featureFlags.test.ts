import { resolveTier, sb819IsEnabled } from "./featureFlags";

describe("resolveTier", () => {
  it("recognizes local hosts", () => {
    expect(resolveTier("localhost")).toBe("local");
    expect(resolveTier("127.0.0.1")).toBe("local");
  });

  it("recognizes the staging host", () => {
    expect(resolveTier("dev.recordsponge.com")).toBe("staging");
  });

  it("recognizes production", () => {
    expect(resolveTier("recordsponge.com")).toBe("production");
    expect(resolveTier("www.recordsponge.com")).toBe("production");
  });

  it("treats an unknown host as production", () => {
    // An unrecognized domain must hide unreleased work, not expose it.
    expect(resolveTier("some-new-host.example.com")).toBe("production");
  });
});

describe("the SB-819 flag", () => {
  it("is on locally and on staging", () => {
    expect(sb819IsEnabled("localhost", undefined)).toBe(true);
    expect(sb819IsEnabled("dev.recordsponge.com", undefined)).toBe(true);
  });

  it("is off in production", () => {
    expect(sb819IsEnabled("recordsponge.com", undefined)).toBe(false);
    expect(sb819IsEnabled("www.recordsponge.com", undefined)).toBe(false);
  });

  it("honors a build-time override in both directions", () => {
    expect(sb819IsEnabled("recordsponge.com", "true")).toBe(true);
    expect(sb819IsEnabled("localhost", "false")).toBe(false);
  });
});
