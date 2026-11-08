import { Text } from "@mantine/core";

/**
 * 代碼與批號標籤：JetBrains Mono 12/600、code-bg 底、6px 圓角。只用在代碼，不用在一般文字或數量。
 *
 * ```tsx
 * <CodeTag code="R-01" />
 * ```
 */
export function CodeTag({ code }: { code: string }) {
  return <Text component="span" ff="monospace" fz="xs" fw={600} px={6} py={2}
    style={{ borderRadius: "var(--mantine-radius-xs)", whiteSpace: "nowrap", background: "var(--ff-code-bg)",
      color: "var(--ff-code-fg)" }}>{code}</Text>;
}
