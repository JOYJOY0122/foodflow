import { Modal } from "@mantine/core";
import type { ReactNode } from "react";

interface FormModalProps {
  opened: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** 送出中：不能用 Esc、遮罩或關閉鈕關閉，避免請求進行到一半就離開。 */
  busy?: boolean;
  /** 手機寬度時全螢幕。 */
  fullScreen?: boolean;
  /** `form` 560px（預設）、`confirm` 440px（確認型對話框）。 */
  kind?: "form" | "confirm";
  /** 預設點遮罩不關閉，避免誤觸丟掉輸入；忙碌中一律不關閉。 */
  closeOnClickOutside?: boolean;
}

/**
 * 表單與確認對話框（DESIGN.md › 表單與對話框），統一處理「忙碌時不可關閉」。
 *
 * ```tsx
 * <FormModal opened={editing !== undefined} title="編輯儲存位置" busy={busy} fullScreen={phone}
 *   onClose={() => setEditing(undefined)}>
 *   <LocationForm … onBusy={setBusy} />
 * </FormModal>
 * ```
 */
export function FormModal({
  opened, title, onClose, children, busy = false, fullScreen = false, kind = "form", closeOnClickOutside = false,
}: FormModalProps) {
  return <Modal opened={opened} onClose={() => { if (!busy) onClose(); }} title={title} centered
    size={kind === "confirm" ? 440 : 560} fullScreen={fullScreen}
    closeOnClickOutside={closeOnClickOutside && !busy} closeOnEscape={!busy} withCloseButton={!busy}>
    {children}
  </Modal>;
}
