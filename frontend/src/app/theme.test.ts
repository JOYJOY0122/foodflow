import { defaultVariantColorsResolver, mergeMantineTheme, DEFAULT_THEME } from "@mantine/core";
// 專案沒有 @types/node；測試在 Node 上執行，從 frontend/ 讀原始碼。
// @ts-expect-error -- node:fs has no type declarations here
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { statusBadgeMap } from "../shared/ui/statusBadgeMap";
import { cssVariablesResolver, isPrimaryFilled, resolveVariantColors, theme, tokens } from "./theme";

const mergedTheme = mergeMantineTheme(DEFAULT_THEME, theme);

describe("theme", () => {
  it("keeps the forest palette, Noto Sans TC and 44px touch targets", () => {
    expect(theme.primaryColor).toBe("forest");
    expect(theme.colors?.forest).toEqual([
      "#edf7f0", "#d7eade", "#b1d5bf", "#87bfa0", "#64ab85", "#4b9e74", "#3d936b", "#2f805a", "#236e4b", "#145f3e",
    ]);
    expect(theme.defaultRadius).toBe("md");
    expect(theme.fontFamily).toBe('"Noto Sans TC", system-ui, sans-serif');
    expect(theme.fontFamilyMonospace).toContain("JetBrains Mono");
    expect(theme.components?.Button?.defaultProps).toMatchObject({ mih: 44 });
    expect(theme.components?.NavLink?.defaultProps).toMatchObject({ mih: 44 });
    for (const input of ["TextInput", "PasswordInput", "Select"]) {
      expect(theme.components?.[input]?.styles).toEqual({ input: { minHeight: 44 } });
    }
  });

  it("uses forest.8 for filled components and the DESIGN.md text color", () => {
    expect(theme.primaryShade).toEqual({ light: 8, dark: 8 });
    expect(theme.black).toBe(tokens.text);
  });

  it.each([
    ["expired", "#fbe9e7", "#b3361f"],
    ["today", "#fdf0e2", "#a54e0e"],
    ["soon", "#f8f3dc", "#8a6d0b"],
    ["lowStock", "#eeebf8", "#5b4fa8"],
    ["normal", "#e5f2e9", "#2a7a4f"],
    ["chilled", "#e2f1ec", "#2b8577"],
    ["frozen", "#e7eef4", "#467596"],
    ["ambient", "#f1f4da", "#7a8a24"],
    ["red", "#fbe9e7", "#b3361f"],
    ["orange", "#fdf0e2", "#a54e0e"],
    ["green", "#e9f4ec", "#2a7a4f"],
  ])("defines %s with its background at index 0 and text at index 8", (name, background, text) => {
    const tuple = theme.colors?.[name];
    expect(tuple).toHaveLength(10);
    expect(tuple?.[0]).toBe(background);
    expect(tuple?.[8]).toBe(text);
  });

  it("maps gray to the DESIGN.md neutrals", () => {
    expect(theme.colors?.gray?.[6]).toBe(tokens.textMuted);
    expect(theme.colors?.gray?.[9]).toBe(tokens.text);
  });

  it("gives every status badge a palette defined in the theme", () => {
    for (const { color } of Object.values(statusBadgeMap)) expect(theme.colors?.[color]).toBeDefined();
  });

  it("defines every var(--ff-*) used anywhere in src", () => {
    const { variables } = cssVariablesResolver(mergedTheme);
    const files = (readdirSync("src", { recursive: true }) as string[]).filter((file) => /\.(tsx?|css)$/.test(file));
    const used = new Set<string>();
    for (const source of files.map((file) => readFileSync(`src/${file}`, "utf8") as string)) {
      for (const match of source.matchAll(/var\((--ff-[a-z0-9-]+)/g)) used.add(match[1]);
    }
    expect(used.size).toBeGreaterThan(10);
    const missing = [...used].filter((name) => !(name in variables));
    expect(missing).toEqual([]);
  });
});

describe("resolveVariantColors", () => {
  const resolve = resolveVariantColors();

  it("uses index 0 as background and index 8 as text for light variants", () => {
    const result = resolve({ color: "expired", theme: mergedTheme, variant: "light" });
    expect(result.background).toBe("var(--mantine-color-expired-0)");
    expect(result.color).toBe("var(--mantine-color-expired-8)");
  });

  it.each([
    ["filled", "expired"],
    ["light", "forest.8"],
  ])("falls back to Mantine for variant %s with color %s", (variant, color) => {
    const input = { color, theme: mergedTheme, variant };
    expect(resolve(input)).toEqual(defaultVariantColorsResolver(input));
  });
});

describe("Button primary style", () => {
  const button = theme.components?.Button;
  const vars = (props: Record<string, unknown>) => button?.vars?.(mergedTheme, props, {});
  const classNames = (props: Record<string, unknown>) => button?.classNames?.(mergedTheme, props, {});

  it.each([{}, { color: "forest" }, { variant: "filled" }])("uses the gradient for %j", (props) => {
    expect(vars(props).root["--button-bg"]).toBe("var(--ff-gradient-primary)");
    expect(vars(props).root["--button-hover"]).toBe(tokens.primary900);
    expect(classNames(props).root).toBe("ff-button-primary");
    expect(isPrimaryFilled(props.variant as string | undefined, props.color as string | undefined)).toBe(true);
  });

  it.each([{ color: "red" }, { variant: "default" }])("keeps Mantine colors for %j", (props) => {
    expect(vars(props).root["--button-bg"]).toBeUndefined();
    expect(classNames(props).root).toBe("");
  });
});
