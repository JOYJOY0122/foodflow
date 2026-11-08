import { Stack } from "@mantine/core";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { ClipboardIcon, ToolIcon } from "../../../shared/ui/icons";

export function StocktakesPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader icon={<ClipboardIcon size={20} />} title="盤點" description="此功能由 郭明儒 負責，開發中" />
      <EmptyState framed icon={<ToolIcon size={24} />} title="功能開發中" description="對應需求：FR-16" />
    </Stack>
  );
}
