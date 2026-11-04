import js from "@eslint/js";
import tseslint from "typescript-eslint";

// AD-17：元件 → hooks.ts → api.ts → shared/api/client.ts
const NO_DIRECT_FETCH_GLOBALS = ["error", { name: "fetch", message: "AD-17：只有 shared/api/client.ts 可以呼叫 fetch" }];
const NO_DIRECT_FETCH_PROPERTIES = [
  "error",
  { object: "window", property: "fetch", message: "AD-17：只有 shared/api/client.ts 可以呼叫 fetch" },
  { object: "globalThis", property: "fetch", message: "AD-17：只有 shared/api/client.ts 可以呼叫 fetch" },
  { object: "self", property: "fetch", message: "AD-17：只有 shared/api/client.ts 可以呼叫 fetch" },
];

const AXIOS = { name: "axios", message: "AD-17：一律透過 shared/api/client.ts 發請求" };
const REACT_ROUTER_DOM = { name: "react-router-dom", message: "AD-17：只使用 react-router" };
// 用 regex 而不用 glob：glob 的 **/api 會連 shared/api/ 底下的檔案一起擋，**/client 會擋到 react-dom/client。
const CLIENT_PATTERN = {
  regex: "^\\.{1,2}/(.*/)?client(\\.ts)?$",
  message: "AD-17：只有 features/*/api.ts 可以使用 shared/api/client.ts",
};
const API_PATTERN = {
  regex: "^\\.{1,2}/(.*/)?api(\\.ts)?$",
  message: "AD-17：元件與頁面只能使用 hooks.ts",
};
// hooks.ts 與 api.ts 用 ./api 取自己 feature 的 api；往上一層才碰得到其他 feature。
const OTHER_FEATURE_API_PATTERN = {
  regex: "^\\.\\./(.*/)?api(\\.ts)?$",
  message: "AD-17：不可 import 其他 feature 的 api.ts，請使用對方匯出的 hook",
};

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "src/shared/api/schema.d.ts", "*.config.cjs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": NO_DIRECT_FETCH_GLOBALS,
      "no-restricted-properties": NO_DIRECT_FETCH_PROPERTIES,
      "no-restricted-imports": [
        "error",
        {
          paths: [AXIOS, REACT_ROUTER_DOM],
          patterns: [CLIENT_PATTERN, API_PATTERN],
        },
      ],
    },
  },
  {
    files: ["src/features/*/hooks.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [AXIOS, REACT_ROUTER_DOM],
          patterns: [CLIENT_PATTERN, OTHER_FEATURE_API_PATTERN],
        },
      ],
    },
  },
  {
    files: ["src/features/*/api.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [AXIOS, REACT_ROUTER_DOM],
          patterns: [OTHER_FEATURE_API_PATTERN],
        },
      ],
    },
  },
  {
    // 同屬 shared/api：重試策略要判斷 ApiError。
    files: ["src/shared/api/queryKeys.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["src/shared/api/client.ts"],
    rules: {
      "no-restricted-globals": "off",
    },
  },
  {
    // 測試可以 stub 全域 fetch，也會直接驗 client.ts。
    files: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-properties": "off",
      "no-restricted-imports": "off",
    },
  },
);
