import { Stack, Text } from "@mantine/core";

import { PageHeader } from "../../../shared/ui/PageHeader";

export function GoodsReceiptsPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader title="進貨" description="此功能由 ChiaJungTien 負責，開發中" />
      <Text size="sm">對應需求：FR-06、FR-07</Text>
    </Stack>
  );
}
