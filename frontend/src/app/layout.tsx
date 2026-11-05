import { Alert, AppShell, Button, Group, Text, Title } from "@mantine/core";
import { Link, Outlet, useNavigate } from "react-router";

import { useCurrentEmployee, useLogout } from "../features/auth/hooks";
import { routes } from "../shared/routes";

export function AppLayout() {
  const current = useCurrentEmployee();
  const logout = useLogout();
  const navigate = useNavigate();
  async function signOut() {
    try {
      await logout.mutateAsync();
      navigate(routes.login, { replace: true });
    } catch { /* Keep retry available when logout did not complete. */ }
  }
  return (
    <AppShell header={{ height: 72 }} padding="xl" styles={{ main: { background: "#f7f8f2" } }}>
      <AppShell.Header>
        <Group h="100%" px="xl" justify="space-between">
          <Group gap="xl"><Title order={3} c="forest.8">食序 FoodFlow</Title>
            <Button component={Link} to={routes.home} variant="subtle">首頁</Button>
            {current.data?.role === "ADMIN" && <Button component={Link} to={routes.employees} variant="subtle">員工帳號</Button>}
          </Group>
          <Group><Text size="sm" maw={220} truncate title={current.data?.name}>{current.data?.name} · {current.data?.role === "ADMIN" ? "管理者" : "一般員工"}</Text>
            <Button variant="default" onClick={() => void signOut()} loading={logout.isPending}>登出</Button></Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        {logout.error && <Alert color="red" role="alert" mb="md" title="登出未完成">{logout.error.message}，請再試一次。</Alert>}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
