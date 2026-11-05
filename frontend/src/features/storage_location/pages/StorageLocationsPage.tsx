import { Stack, Text } from "@mantine/core";

import { PageHeader } from "../../../shared/ui/PageHeader";

export function StorageLocationsPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader title="儲存位置" description="此功能由 黃予岑 Ken 負責，開發中" />
      <Text size="sm">對應需求：FR-05</Text>
    </Stack>
  );
}
