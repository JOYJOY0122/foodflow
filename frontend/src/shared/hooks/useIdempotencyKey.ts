import { useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";

/**
 * AD-8：每個表單實例一把 key，成功後或內容變更時才 rotate。
 * 用 uuid 套件產生，因為平板以 http 連線時 crypto.randomUUID 不可用。
 */
export function useIdempotencyKey(): { key: string; rotate: () => void } {
  const [key, setKey] = useState<string>(() => uuidv4());
  const rotate = useCallback(() => setKey(uuidv4()), []);
  return { key, rotate };
}
