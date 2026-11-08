import { Stack } from "@mantine/core";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { BellIcon, ToolIcon } from "../../../shared/ui/icons";
import { HomePage } from "../../health/pages/HomePage";

export function AlertsPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader icon={<BellIcon size={20} />} title="預警首頁" description="此功能由 謝文佳 負責，開發中" />
      <EmptyState framed icon={<ToolIcon size={24} />} title="功能開發中" description="對應需求：FR-12、FR-13、FR-14" />
      {/* 預警清單完成前，先保留後端連線狀態供 demo 確認。 */}
      <HomePage />
    </Stack>
  );
}
