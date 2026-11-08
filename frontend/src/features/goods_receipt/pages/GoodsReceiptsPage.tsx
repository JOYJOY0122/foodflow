import { Stack } from "@mantine/core";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { TruckIcon, ToolIcon } from "../../../shared/ui/icons";

export function GoodsReceiptsPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader icon={<TruckIcon size={20} />} title="進貨" description="此功能由 ChiaJungTien 負責，開發中" />
      <EmptyState framed icon={<ToolIcon size={24} />} title="功能開發中" description="對應需求：FR-06、FR-07" />
    </Stack>
  );
}
