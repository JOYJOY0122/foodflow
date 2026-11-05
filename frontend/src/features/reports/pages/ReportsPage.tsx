import { Stack, Text } from "@mantine/core";

import { PageHeader } from "../../../shared/ui/PageHeader";

export function ReportsPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader title="異動與統計" description="此功能由 郭明儒 負責，開發中" />
      <Text size="sm">對應需求：FR-17、FR-18</Text>
    </Stack>
  );
}
