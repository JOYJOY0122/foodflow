import { Stack, Text } from "@mantine/core";

import { PageHeader } from "../../../shared/ui/PageHeader";

export function InventoryPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader title="庫存" description="此功能由 ChiaJungTien 負責，開發中" />
      <Text size="sm">對應需求：FR-08、FR-09</Text>
    </Stack>
  );
}
