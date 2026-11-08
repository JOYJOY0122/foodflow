import { Stack } from "@mantine/core";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { LeafIcon, ToolIcon } from "../../../shared/ui/icons";

export function IngredientsPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader icon={<LeafIcon size={20} />} title="食材" description="此功能由 謝文佳 負責，開發中" />
      <EmptyState framed icon={<ToolIcon size={24} />} title="功能開發中" description="對應需求：FR-03" />
    </Stack>
  );
}
