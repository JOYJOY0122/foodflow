import { describe, expect, it } from "vitest";

import { theme } from "./theme";

describe("theme", () => {
  it("keeps the forest palette, Noto Sans TC and 44px touch targets", () => {
    expect(theme.primaryColor).toBe("forest");
    expect(theme.colors?.forest).toEqual([
      "#edf7f0", "#d7eade", "#b1d5bf", "#87bfa0", "#64ab85", "#4b9e74", "#3d936b", "#2f805a", "#236e4b", "#145f3e",
    ]);
    expect(theme.defaultRadius).toBe("md");
    expect(theme.fontFamily).toBe('"Noto Sans TC", system-ui, sans-serif');
    expect(theme.components?.Button?.defaultProps).toEqual({ mih: 44 });
    for (const input of ["TextInput", "PasswordInput", "Select"]) {
      expect(theme.components?.[input]?.styles).toEqual({ input: { minHeight: 44 } });
    }
  });
});
