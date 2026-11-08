import { Alert, Box, Button, Container, Group, Loader, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";

import { routes } from "../../../shared/routes";
import { SproutIcon } from "../../../shared/ui/icons";
import { useCurrentEmployee, useLogin } from "../hooks";

export function LoginPage() {
  const current = useCurrentEmployee();
  const login = useLogin();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  if (current.isPending) return <Loader aria-label="確認登入狀態" m="xl" />;
  if (current.error && !("status" in current.error && current.error.status === 401)) {
    return <Container size={440} py={64}><Alert color="red" title="無法確認登入狀態" role="alert"><Stack>
      <Text>{current.error.message}</Text><Button onClick={() => void current.refetch()} loading={current.isFetching}>重試</Button>
    </Stack></Alert></Container>;
  }
  if (current.data) return <Navigate to={routes.home} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await login.mutateAsync({ username: username.trim(), password });
      navigate(routes.home, { replace: true });
    } catch { /* Mutation error is displayed; preserve input for retry. */ }
  }
  return <div style={{ minHeight: "100vh", background: "var(--ff-canvas)" }}><Container size={440} py={64}>
    <Stack gap="lg">
      <div>
        <Group gap={12} wrap="nowrap">
          <Box className="ff-icon-tile" w={42} h={42} style={{ borderRadius: "var(--mantine-radius-lg)" }}
            aria-hidden="true"><SproutIcon size={22} /></Box>
          <Title order={1} c="forest.9">食序 FoodFlow</Title>
        </Group>
        <Text c="dimmed" mt="xs">餐廳食材管理，從每一天開始。</Text>
      </div>
      <Paper withBorder radius="xl" p="xl" shadow="md">
        <form onSubmit={submit}>
          <Stack>
            <Title order={2}>登入帳號</Title>
            <Text size="sm" c="dimmed">請使用管理者提供的個人帳號。</Text>
            {login.error && <Alert color="red" title="登入未完成" role="alert">{login.error.message}</Alert>}
            <TextInput label="帳號" autoComplete="username" autoFocus required maxLength={64}
              value={username} onChange={(e) => setUsername(e.currentTarget.value)} disabled={login.isPending} />
            <PasswordInput label="密碼" autoComplete="current-password" required maxLength={128}
              value={password} onChange={(e) => setPassword(e.currentTarget.value)} disabled={login.isPending} />
            <Button type="submit" loading={login.isPending} fullWidth mt="sm">登入</Button>
          </Stack>
        </form>
      </Paper>
      <Text size="sm" c="dimmed">忘記密碼時，請聯絡管理者重設。</Text>
    </Stack>
  </Container></div>;
}
