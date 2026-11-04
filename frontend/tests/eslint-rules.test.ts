// @vitest-environment node
/** AD-17、T6：實際跑 ESLint，確認宣稱的保護真的擋得到。 */

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
