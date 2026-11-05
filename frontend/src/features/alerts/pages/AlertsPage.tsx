import { Stack, Text } from "@mantine/core";

import { PageHeader } from "../../../shared/ui/PageHeader";
import { HomePage } from "../../health/pages/HomePage";

export function AlertsPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader title="預警首頁" description="此功能由 謝文佳 負責，開發中" />
      <Text size="sm">對應需求：FR-12、FR-13、FR-14</Text>
      {/* 預警清單完成前，先保留後端連線狀態供 demo 確認。 */}
      <HomePage />
    </Stack>
  );
}
