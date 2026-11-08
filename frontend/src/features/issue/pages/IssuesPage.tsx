import { Stack } from "@mantine/core";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { OutboxIcon, ToolIcon } from "../../../shared/ui/icons";

export function IssuesPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader icon={<OutboxIcon size={20} />} title="領用" description="此功能由 黃予岑 Ken 負責，開發中" />
      <EmptyState framed icon={<ToolIcon size={24} />} title="功能開發中" description="對應需求：FR-10、FR-11" />
    </Stack>
  );
}
