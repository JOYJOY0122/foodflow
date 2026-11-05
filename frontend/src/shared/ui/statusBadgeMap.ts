/** AD-23：狀態的顯示文字與顏色只定義在這裡。 */

export const statusBadgeMap = {
  EXPIRED: { label: "過期", color: "red" },
  EXPIRES_TODAY: { label: "今日到期", color: "orange" },
  EXPIRING_SOON: { label: "即期", color: "yellow" },
  LOW_STOCK: { label: "低庫存", color: "violet" },
  NORMAL: { label: "正常", color: "green" },
} as const;

export type BadgeStatus = keyof typeof statusBadgeMap;
