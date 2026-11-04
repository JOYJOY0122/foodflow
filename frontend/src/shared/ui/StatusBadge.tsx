import { Badge } from "@mantine/core";

import { statusBadgeMap, type BadgeStatus } from "./statusBadgeMap";

/** NFR-01：狀態同時顯示文字與顏色。 */
export function StatusBadge({ status }: { status: BadgeStatus }) {
  const { label, color } = statusBadgeMap[status];
  return (
    <Badge color={color} variant="light" data-status={status}>
      {label}
    </Badge>
  );
}
