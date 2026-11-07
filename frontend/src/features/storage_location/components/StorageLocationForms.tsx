/** 儲存位置頁的表單：新增／編輯位置、刪除確認、整批換位置。失敗時一律保留輸入（NFR-05）。 */

import {
  Alert, Button, Checkbox, Group, Paper, Select, SimpleGrid, Stack, Text, TextInput, Textarea,
} from "@mantine/core";
import { useState, type FormEvent } from "react";

import { storageTypeOptions, type StorageType } from "../../../shared/storageTypes";
import {
  useActiveStorageLocations, useCreateStorageLocation, useDeleteStorageLocation, useMoveBatch,
  useUpdateStorageLocation, type LocationBatch, type StorageLocation,
} from "../hooks";

function fieldError(error: unknown, field: string): string | undefined {
  if (error && typeof error === "object" && "fields" in error && Array.isArray(error.fields)) {
    return error.fields.find((item: { field: string; message: string }) => item.field === field)?.message;
  }
}

export function LocationForm({ location, onSaved, onCancel, onBusy }: {
  location: StorageLocation | null;
  onSaved: (message: string) => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const create = useCreateStorageLocation();
  const update = useUpdateStorageLocation();
  const mutation = location ? update : create;
  const [code, setCode] = useState(location?.code ?? "");
  const [name, setName] = useState(location?.name ?? "");
  const [storageType, setStorageType] = useState<StorageType | null>(location?.storage_type ?? null);
  const [description, setDescription] = useState(location?.description ?? "");
  const [active, setActive] = useState(location?.is_active ?? true);
  const [typeMissing, setTypeMissing] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!storageType) { setTypeMissing(true); return; }
    setTypeMissing(false);
    const body = { code: code.trim(), name: name.trim(), storage_type: storageType,
      description: description.trim() || null };
    onBusy(true);
    try {
      if (location) {
        await update.mutateAsync({ id: location.id, body: { ...body, is_active: active } });
      } else {
        await create.mutateAsync(body);
      }
      onSaved(location ? "儲存位置已更新" : "儲存位置已建立");
    } catch { /* 失敗時保留所有輸入，讓使用者修正後重送。 */ } finally { onBusy(false); }
  }

  const pending = mutation.isPending;
  return <form onSubmit={submit} noValidate><Stack>
    {mutation.error && <Alert color="red" role="alert" title="儲存未完成">{mutation.error.message}</Alert>}
    <TextInput label="位置代碼" required maxLength={32} autoFocus value={code}
      onChange={(e) => setCode(e.currentTarget.value)} error={fieldError(mutation.error, "code")} disabled={pending} />
    <TextInput label="名稱" required maxLength={100} value={name}
      onChange={(e) => setName(e.currentTarget.value)} error={fieldError(mutation.error, "name")} disabled={pending} />
    <Select label="儲存類型" required data={storageTypeOptions} value={storageType} allowDeselect={false}
      placeholder="請選擇" onChange={(value) => { setStorageType(value as StorageType | null); setTypeMissing(false); }}
      error={typeMissing ? "請選擇儲存類型" : fieldError(mutation.error, "storage_type")} disabled={pending} />
    <Textarea label="說明" maxLength={500} rows={3} value={description}
      onChange={(e) => setDescription(e.currentTarget.value)} error={fieldError(mutation.error, "description")} disabled={pending} />
    {location && <Checkbox label="啟用此位置" description="停用後進貨不能再選此位置；仍有剩餘庫存的位置不能停用"
      checked={active} onChange={(e) => setActive(e.currentTarget.checked)}
      error={fieldError(mutation.error, "is_active")} disabled={pending} />}
    <Group justify="flex-end">
      <Button variant="default" onClick={onCancel} disabled={pending}>取消</Button>
      <Button type="submit" loading={pending}>儲存</Button>
    </Group>
  </Stack></form>;
}

export function DeleteConfirm({ location, onDeleted, onCancel, onBusy }: {
  location: StorageLocation;
  onDeleted: (message: string) => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const remove = useDeleteStorageLocation();
  async function confirm() {
    onBusy(true);
    try {
      await remove.mutateAsync(location.id);
      onDeleted("儲存位置已刪除");
    } catch { /* 錯誤顯示在下方，對話框保持開啟。 */ } finally { onBusy(false); }
  }
  return <Stack>
    <Text>確定要刪除「{location.code} {location.name}」嗎？刪除後無法復原。</Text>
    <Text size="sm" c="dimmed">曾被進貨或庫存紀錄使用的位置不能刪除，請改用停用。</Text>
    {remove.error && <Alert color="red" role="alert" title="刪除未完成">{remove.error.message}</Alert>}
    <Group justify="flex-end">
      <Button variant="default" onClick={onCancel} disabled={remove.isPending}>取消</Button>
      <Button color="red" onClick={() => void confirm()} loading={remove.isPending}>確認刪除</Button>
    </Group>
  </Stack>;
}

export function MoveBatchForm({ batch, onSaved, onCancel, onBusy }: {
  batch: LocationBatch;
  onSaved: (message: string) => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const move = useMoveBatch();
  const active = useActiveStorageLocations(true);
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [targetMissing, setTargetMissing] = useState(false);
  const options = (active.data?.items ?? [])
    .filter((location) => location.id !== batch.current_location_id)
    .map((location) => ({ value: String(location.id), label: `${location.code} ${location.name}` }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!target) { setTargetMissing(true); return; }
    setTargetMissing(false);
    onBusy(true);
    try {
      const moved = await move.mutateAsync({ batchId: batch.id,
        body: { to_location_id: Number(target), reason: reason.trim() } });
      onSaved(`批次 ${moved.batch_number} 已移到 ${moved.current_location_code} ${moved.current_location_name}`);
    } catch { /* 失敗時保留選擇與原因，讓使用者修正後重送。 */ } finally { onBusy(false); }
  }

  const pending = move.isPending;
  return <form onSubmit={submit} noValidate><Stack>
    <Paper bg="gray.0" radius="md" p="sm">
      <SimpleGrid cols={2} spacing="xs" verticalSpacing={6}>
        {([
          ["食材", batch.ingredient_name],
          ["批號", batch.batch_number],
          ["剩餘量", `${batch.remaining_quantity} ${batch.unit}`],
          ["到期日", batch.expiry_date],
          ["目前位置", `${batch.current_location_code} ${batch.current_location_name}`],
        ] as const).map(([label, value]) => <div key={label}>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text size="sm" fw={600}>{value}</Text>
        </div>)}
      </SimpleGrid>
    </Paper>
    <Text size="sm" c="dimmed">整批移動，剩餘量與到期日不變，並留下位置變更紀錄。</Text>
    {move.error && <Alert color="red" role="alert" title="換位置未完成">{move.error.message}</Alert>}
    {active.error && <Alert color="red" role="alert" title="無法載入位置">{active.error.message}</Alert>}
    <Select label="移到" required data={options} value={target} allowDeselect={false} searchable
      placeholder={active.isPending ? "載入位置中…" : "請選擇啟用中的位置"}
      nothingFoundMessage="沒有其他啟用中的位置"
      onChange={(value) => { setTarget(value); setTargetMissing(false); }}
      error={targetMissing ? "請選擇目標位置" : fieldError(move.error, "to_location_id")} disabled={pending} />
    <Textarea label="原因" required maxLength={500} rows={3} value={reason}
      onChange={(e) => setReason(e.currentTarget.value)} error={fieldError(move.error, "reason")} disabled={pending} />
    <Group justify="flex-end">
      <Button variant="default" onClick={onCancel} disabled={pending}>取消</Button>
      <Button type="submit" loading={pending}>確認換位置</Button>
    </Group>
  </Stack></form>;
}
