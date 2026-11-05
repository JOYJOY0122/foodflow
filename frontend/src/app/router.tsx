import { Alert, Text } from "@mantine/core";
import { createBrowserRouter } from "react-router";

import { HomePage } from "../features/health/pages/HomePage";
import { routes } from "../shared/routes";
import { AppLayout } from "./layout";

// AD-23：路由集中在這裡；AD-17：不使用 loader／action。
// 各 feature 的頁面由負責人加入，路徑常數放在 shared/routes.ts。
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: (
      <Alert color="red" title="頁面發生錯誤" role="alert">
        請重新整理頁面後再試一次
      </Alert>
    ),
    children: [
      { path: routes.home, element: <HomePage /> },
      { path: "*", element: <Text>找不到頁面</Text> },
    ],
  },
]);
