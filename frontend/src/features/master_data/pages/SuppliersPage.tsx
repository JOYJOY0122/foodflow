import { Stack } from "@mantine/core";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { StoreIcon, ToolIcon } from "../../../shared/ui/icons";

export function SuppliersPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader icon={<StoreIcon size={20} />} title="供應商" description="此功能由 謝文佳 負責，開發中" />
      <EmptyState framed icon={<ToolIcon size={24} />} title="功能開發中" description="對應需求：FR-04" />
    </Stack>
  );
}
