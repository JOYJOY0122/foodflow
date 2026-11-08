import { Box } from "@mantine/core";
import type { ReactNode } from "react";

import { statusBadgeMap, type BadgeStatus } from "./statusBadgeMap";

/**
 * NFR-01：狀態同時顯示文字與顏色；強度依 statusBadgeMap 的 tone。
 *
 * ```tsx
 * <StatusBadge status="EXPIRED" detail="1 天" />   // 「過期 1 天」
 * ```
 *
 * `detail` 由後端回傳的天數組成，標籤開頭一定是狀態詞。
 */
export function StatusBadge({ status, detail }: { status: BadgeStatus; detail?: ReactNode }) {
  const { label, color, tone } = statusBadgeMap[status];
  return (
    <Box component="span" data-status={status} data-tone={tone} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 9999,
      fontSize: "var(--mantine-font-size-xs)", fontWeight: 700, lineHeight: 1.4, whiteSpace: "nowrap",
      color: tone === "weak" ? "var(--mantine-color-dimmed)" : `var(--mantine-color-${color}-8)`,
      background: tone === "strong" ? `var(--mantine-color-${color}-0)` : "transparent",
    }}>
      {tone !== "weak" && <span data-dot aria-hidden="true"
        style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />}
      {detail === undefined ? label : `${label} `}{detail}
    </Box>
  );
}
