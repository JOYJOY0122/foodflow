import { Alert, Button, Loader, Stack, Text } from "@mantine/core";
import { Navigate, Outlet, createBrowserRouter } from "react-router";

import { useCurrentEmployee } from "../features/auth/hooks";
import { EmployeesPage } from "../features/auth/pages/EmployeesPage";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { HomePage } from "../features/health/pages/HomePage";
import { routes } from "../shared/routes";
import { AppLayout } from "./layout";

export function RequireLogin() {
  const current = useCurrentEmployee();
  if (current.isPending) return <Loader aria-label="確認登入狀態" m="xl" />;
  if (current.error) {
    if ("status" in current.error && current.error.status === 401) return <Navigate to={routes.login} replace />;
    return <Alert color="red" title="無法確認登入狀態" role="alert" m="xl"><Stack>
      <Text>{current.error.message}</Text><Button onClick={() => void current.refetch()} loading={current.isFetching}>重試</Button>
    </Stack></Alert>;
  }
  return current.data ? <Outlet /> : <Navigate to={routes.login} replace />;
}

// AD-23：路由集中在這裡；AD-17：不使用 loader／action。
export const router = createBrowserRouter([
  { path: routes.login, element: <LoginPage /> },
  {
    element: <RequireLogin />,
    errorElement: (
      <Alert color="red" title="頁面發生錯誤" role="alert">
        請重新整理頁面後再試一次
      </Alert>
    ),
    children: [
      { element: <AppLayout />, children: [
      { path: routes.home, element: <HomePage /> },
      { path: routes.employees, element: <EmployeesPage /> },
      { path: "*", element: <Text>找不到頁面</Text> },
      ] },
    ],
  },
]);
