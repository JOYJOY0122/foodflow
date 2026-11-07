import type { components } from "./api/schema";

export type StorageType = components["schemas"]["StorageType"];

/** 儲存位置類型與食材保存方式共用同一組選項（後端 `StorageType`）。 */
export const storageTypeLabels: Record<StorageType, string> = {
  REFRIGERATED: "冷藏",
  FROZEN: "冷凍",
  AMBIENT: "常溫",
};

export const storageTypeOptions = (Object.keys(storageTypeLabels) as StorageType[]).map(
  (value) => ({ value, label: storageTypeLabels[value] }),
);
