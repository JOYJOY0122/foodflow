import { Alert, Loader, Stack, Text, Title } from "@mantine/core";

import { useHealth } from "../hooks";

/** 骨架階段的首頁：顯示後端 /health 狀態。預警首頁由 alerts feature 接手。 */
export function HomePage() {
  const { data, isPending, isError } = useHealth();

  return (
    <Stack>
      <Title order={2}>系統狀態</Title>
      {isPending && <Loader aria-label="載入中" />}
      {isError && (
        <Alert color="red" title="後端異常" role="alert">
          無法連線到後端服務
        </Alert>
      )}
      {!isError && data?.status === "ok" && (
        <Alert color="green" title="後端正常">
          <Text>資料庫連線正常</Text>
        </Alert>
      )}
      {!isError && data?.status === "degraded" && (
        <Alert color="red" title="後端異常" role="alert">
          <Text>資料庫無法連線</Text>
        </Alert>
      )}
    </Stack>
  );
}
