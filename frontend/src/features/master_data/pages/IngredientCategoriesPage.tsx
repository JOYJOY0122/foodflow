import { Stack, Text } from "@mantine/core";

import { PageHeader } from "../../../shared/ui/PageHeader";

export function IngredientCategoriesPage() {
  return (
    <Stack gap="lg" maw={1200} mx="auto">
      <PageHeader title="分類" description="此功能由 謝文佳 負責，開發中" />
      <Text size="sm">對應需求：FR-03</Text>
    </Stack>
  );
}
