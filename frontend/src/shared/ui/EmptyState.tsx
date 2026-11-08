import { Paper, Stack, Text, ThemeIcon, Title, type TitleOrder } from "@mantine/core";
import type { ReactNode } from "react";

import { SearchIcon } from "./icons";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** 48px 圖示方塊裡的圖示，預設是搜尋圖示。 */
  icon?: ReactNode;
  /** 一個次要按鈕，例如「新增第一個位置」或「清除篩選」。 */
  action?: ReactNode;
  /** `success` 用在「沒有任何預警」這類好消息。 */
  tone?: "default" | "success";
  /** 外面沒有卡片時設為 true，自己包成白色卡片；卡片裡不要再包卡片。 */
  framed?: boolean;
  /** 標題的層級，依頁面的標題結構決定，預設 h2。 */
  order?: TitleOrder;
}

/**
 * 空狀態（DESIGN.md › 空狀態）：圖示方塊、標題、一句說明、一個次要按鈕。
 * 真的沒有資料時引導新增；篩選後沒有結果時寫「沒有符合條件的…」。
 *
 * ```tsx
 * <EmptyState icon={<MapPinIcon size={24} />} title="還沒有儲存位置" description="…"
 *   action={<Button variant="default">新增第一個位置</Button>} />
 * <EmptyState framed icon={<ToolIcon size={24} />} title="功能開發中" description="對應需求：FR-04" />
 * ```
 */
export function EmptyState({
  title, description, icon, action, tone = "default", framed = false, order = 2,
}: EmptyStateProps) {
  const content = <Stack align="center" gap="xs" py={48} px="md" ta="center">
    <ThemeIcon size={48} radius="lg" variant="light" color={tone === "success" ? "green" : "forest"} aria-hidden="true">
      {icon ?? <SearchIcon size={24} />}
    </ThemeIcon>
    <Title order={order} fz="xl" fw={700} mt="xs">{title}</Title>
    {description && <Text c="dimmed" maw={420}>{description}</Text>}
    {action && <div style={{ marginTop: "var(--mantine-spacing-xs)" }}>{action}</div>}
  </Stack>;
  return framed ? <Paper radius="xl" shadow="md" className="ff-card">{content}</Paper> : content;
}
