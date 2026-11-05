import { Stack, Text } from "@mantine/core";

import { PageHeader } from "../../../shared/ui/PageHeader";

export function IssuesPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader title="領用" description="此功能由 黃予岑 Ken 負責，開發中" />
      <Text size="sm">對應需求：FR-10、FR-11</Text>
    </Stack>
  );
}
