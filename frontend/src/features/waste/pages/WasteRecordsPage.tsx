import { Stack } from "@mantine/core";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { TrashIcon, ToolIcon } from "../../../shared/ui/icons";

export function WasteRecordsPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader icon={<TrashIcon size={20} />} title="報廢" description="此功能由 郭明儒 負責，開發中" />
      <EmptyState framed icon={<ToolIcon size={24} />} title="功能開發中" description="對應需求：FR-15" />
    </Stack>
  );
}
