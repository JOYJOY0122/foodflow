import { Stack, Text } from "@mantine/core";

import { PageHeader } from "../../../shared/ui/PageHeader";

export function SuppliersPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader title="供應商" description="此功能由 謝文佳 負責，開發中" />
      <Text size="sm">對應需求：FR-04</Text>
    </Stack>
  );
}
