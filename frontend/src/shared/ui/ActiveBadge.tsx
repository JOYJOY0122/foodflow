import { Box } from "@mantine/core";

/**
 * 「啟用／停用」標籤；不是 StatusBadge（DESIGN.md › 狀態標籤）。膠囊加圓點，文字一定顯示。
 *
 * ```tsx
 * <ActiveBadge active={location.is_active} />
 * ```
 */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Box component="span" data-active={active} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 9999,
      fontSize: "var(--mantine-font-size-xs)", fontWeight: 600, lineHeight: 1.4, whiteSpace: "nowrap", flexShrink: 0,
      color: active ? "var(--mantine-color-green-8)" : "var(--ff-text-muted)",
      background: active ? "var(--ff-success-bg)" : "var(--ff-inactive-bg)",
    }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
      {active ? "啟用" : "停用"}
    </Box>
  );
}
