import { ThemeIcon } from "@mantine/core";
import type { ComponentType } from "react";

import type { StorageType } from "../storageTypes";
import { BoxIcon, FridgeIcon, SnowflakeIcon } from "./icons";

/** 保存方式的圖示。 */
export const storageTypeIcons: Record<StorageType, ComponentType<{ size?: number }>> = {
  REFRIGERATED: FridgeIcon, FROZEN: SnowflakeIcon, AMBIENT: BoxIcon,
};

/** 保存方式的色票名稱（theme.ts 的 chilled／frozen／ambient），只用在圖示，不當文字色或狀態色。 */
export const storageTypeColors: Record<StorageType, string> = {
  REFRIGERATED: "chilled", FROZEN: "frozen", AMBIENT: "ambient",
};

/**
 * 保存方式的上色圖示方塊；停用的項目改成灰色。純裝飾，旁邊一定要寫「冷藏／冷凍／常溫」文字（NFR-01）。
 *
 * ```tsx
 * <StorageTypeIcon type="FROZEN" size={28} />            // 表格內
 * <StorageTypeIcon type={location.storage_type} muted />  // 停用
 * ```
 */
export function StorageTypeIcon({ type, size = 40, muted = false }: {
  type: StorageType; size?: number; muted?: boolean;
}) {
  const Icon = storageTypeIcons[type];
  return <ThemeIcon size={size} radius={size <= 28 ? "sm" : "md"} variant="light"
    color={muted ? "gray" : storageTypeColors[type]} aria-hidden="true" data-storage-type={type}>
    <Icon size={Math.round(size * 0.55)} />
  </ThemeIcon>;
}
