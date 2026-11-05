import { Group, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** 放在右側的主要操作，例如「新增」按鈕。 */
  actions?: ReactNode;
}

/** 各頁共用的標題列；每頁只放一個，作為該頁的 h1。 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start">
      <div>
        <Title order={1} size="h2">{title}</Title>
        {description && <Text c="dimmed" mt={4}>{description}</Text>}
      </div>
      {actions}
    </Group>
  );
}
