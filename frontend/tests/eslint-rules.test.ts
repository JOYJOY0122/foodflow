// @vitest-environment node
/** AD-17、T6、DESIGN.md：實際跑 ESLint，確認宣稱的保護真的擋得到。 */

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function ruleIds(filePath: string, code: string): Promise<(string | null)[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId);
}

const COMPONENT = "src/features/inventory/components/List.tsx";
const PAGE = "src/features/inventory/pages/ListPage.tsx";
const HOOKS = "src/features/inventory/hooks.ts";
const API = "src/features/inventory/api.ts";
const CLIENT = "src/shared/api/client.ts";

describe("AD-17 data access rules", () => {
  it.each([COMPONENT, PAGE, HOOKS, API])("forbids global fetch in %s", async (file) => {
    expect(await ruleIds(file, 'fetch("/x");\n')).toContain("no-restricted-globals");
  });

  it.each([COMPONENT, PAGE, HOOKS, API])("forbids window.fetch in %s", async (file) => {
    expect(await ruleIds(file, 'window.fetch("/x");\n')).toContain("no-restricted-properties");
  });

  it("allows fetch only in client.ts", async () => {
    expect(await ruleIds(CLIENT, 'fetch("/x");\n')).toEqual([]);
  });

  it.each([
    [COMPONENT, '../api'],
    [PAGE, '../api'],
    [COMPONENT, '../../../shared/api/client'],
    [HOOKS, '../../shared/api/client'],
    [COMPONENT, 'axios'],
    [API, 'axios'],
    [COMPONENT, 'react-router-dom'],
    [HOOKS, '../waste/api'],
    [API, '../waste/api'],
  ])("%s cannot import %s", async (file, source) => {
    expect(await ruleIds(file, `import "${source}";\n`)).toContain("no-restricted-imports");
  });

  it.each([
    [COMPONENT, '../hooks'],
    [HOOKS, './api'],
    [API, '../../shared/api/client'],
    [COMPONENT, '../../../shared/api/queryKeys'],
    [HOOKS, '../../shared/api/queryKeys'],
    [COMPONENT, 'react-router'],
  ])("%s may import %s", async (file, source) => {
    expect(await ruleIds(file, `import "${source}";\n`)).toEqual([]);
  });
});

describe("DESIGN.md color guard", () => {
  it.each([
    [PAGE, 'export const c = "#1f2a24";\n'],
    [PAGE, 'export const c = "#fff";\n'],
    [PAGE, 'export const c = "1px solid #e3eadf";\n'],
    [COMPONENT, "export const c = `rgb(1,2,3)`;\n"],
    [COMPONENT, "const a = 0.5;\nexport const c = `rgba(0,0,0,${a})`;\n"],
    [COMPONENT, 'export const c = "rgba(35, 90, 55, 0.45)";\n'],
    [HOOKS, 'export const c = "hsl(120 30% 40%)";\n'],
    [PAGE, 'export const c = "HSLA(120, 30%, 40%, 0.5)";\n'],
    [PAGE, 'export const el = <div color="#236e4b" />;\n'],
    [API, 'export const c = "#236e4b";\n'],
  ])("%s rejects hard-coded color in %j", async (file, code) => {
    expect(await ruleIds(file, code)).toContain("no-restricted-syntax");
  });

  it.each([
    'export const c = "#1";\n',
    'export const c = `批次 #12`;\n',
    'export const el = <div color="forest" />;\n',
    'export const c = "var(--ff-line)";\n',
    'export const c = "forest.8";\n',
  ])("allows %j", async (code) => {
    expect(await ruleIds(PAGE, code)).toEqual([]);
  });

  it("allows hex inside the theme", async () => {
    expect(await ruleIds("src/app/theme.ts", 'export const c = "#1f2a24";\n')).toEqual([]);
  });
});
