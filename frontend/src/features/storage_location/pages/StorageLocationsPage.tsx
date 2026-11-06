import {
  Alert, Badge, Button, Checkbox, Group, Loader, Modal, Pagination, Paper, Select, Stack, Table,
  Text, TextInput, Textarea,
} from "@mantine/core";
import { Fragment, useState, type FormEvent } from "react";

import { useCurrentEmployee } from "../../auth/hooks";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { storageTypeLabels, storageTypeOptions, type StorageType } from "../../../shared/storageTypes";
import {
  PAGE_SIZE, useActiveStorageLocations, useCreateStorageLocation, useDeleteStorageLocation,
  useLocationBatches, useMoveBatch, useStorageLocations, useUpdateStorageLocation,
  type LocationBatch, type StorageLocation,
} from "../hooks";

function fieldError(error: unknown, field: string): string | undefined {
  if (error && typeof error === "object" && "fields" in error && Array.isArray(error.fields)) {
    return error.fields.find((item: { field: string; message: string }) => item.field === field)?.message;
  }
}

function LocationForm({ location, onSaved, onCancel, onBusy }: {
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

function DeleteConfirm({ location, onDeleted, onCancel, onBusy }: {
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

function MoveBatchForm({ batch, onSaved, onCancel, onBusy }: {
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
    <Text>
      {batch.ingredient_name}・{batch.batch_number}・剩餘 {batch.remaining_quantity} {batch.unit}・到期 {batch.expiry_date}
    </Text>
    <Text size="sm" c="dimmed">
      目前位置：{batch.current_location_code} {batch.current_location_name}。整批移動，數量與到期日不變。
    </Text>
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

function LocationBatches({ location, isAdmin, onMove }: {
  location: StorageLocation;
  isAdmin: boolean;
  onMove: (batch: LocationBatch) => void;
}) {
  const batches = useLocationBatches(location.id);
  if (batches.isPending) return <Group role="status"><Loader size="sm" /><Text>載入批次中…</Text></Group>;
  if (batches.error) return <Alert color="red" title="無法載入批次" role="alert"><Stack gap="sm">
    <Text>{batches.error.message}</Text>
    <Button variant="light" onClick={() => void batches.refetch()} loading={batches.isFetching}>重新載入</Button>
  </Stack></Alert>;
  if (batches.data.items.length === 0) return <Text c="dimmed">此位置目前沒有剩餘庫存的批次。</Text>;
  return <Stack gap="xs">
  {batches.data.total > batches.data.items.length && <Text size="sm" c="orange">
    共 {batches.data.total} 個批次，只顯示到期日最早的 {batches.data.items.length} 個。</Text>}
  <Table aria-label={`${location.code} 的批次`} verticalSpacing="xs">
    <Table.Thead><Table.Tr>
      <Table.Th>食材</Table.Th><Table.Th>批號</Table.Th><Table.Th>剩餘量</Table.Th><Table.Th>到期日</Table.Th>
      {isAdmin && <Table.Th>操作</Table.Th>}
    </Table.Tr></Table.Thead>
    <Table.Tbody>{batches.data.items.map((batch) => <Table.Tr key={batch.id}>
      <Table.Td>{batch.ingredient_name}</Table.Td>
      <Table.Td>{batch.batch_number}</Table.Td>
      <Table.Td>{batch.remaining_quantity} {batch.unit}</Table.Td>
      <Table.Td>{batch.expiry_date}</Table.Td>
      {isAdmin && <Table.Td><Button variant="light" aria-label={`換位置 ${batch.batch_number}`}
        onClick={() => onMove(batch)}>換位置</Button></Table.Td>}
    </Table.Tr>)}</Table.Tbody>
  </Table>
  </Stack>;
}

export function StorageLocationsPage() {
  const current = useCurrentEmployee();
  const isAdmin = current.data?.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [storageType, setStorageType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const locations = useStorageLocations({ search, storageType, status, page });
  const [editing, setEditing] = useState<StorageLocation | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<StorageLocation | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [moving, setMoving] = useState<LocationBatch | null>(null);
  const [success, setSuccess] = useState("");
  const [modalBusy, setModalBusy] = useState(false);

  function done(message: string) {
    // 刪除或停用可能讓目前頁變空且分頁元件消失，回到第 1 頁。
    setPage(1);
    setSuccess(message);
    setEditing(undefined);
    setDeleting(null);
    setMoving(null);
  }

  return <Stack gap="lg" maw={1200} mx="auto">
    <PageHeader title="儲存位置" description="維護食材的實際存放處，供進貨登記與員工查找"
      actions={isAdmin && <Button onClick={() => { setEditing(null); setSuccess(""); }}>新增位置</Button>} />
    {success && <Alert color="green" role="status" withCloseButton onClose={() => setSuccess("")}>{success}</Alert>}
    <Paper withBorder radius="lg" p="lg"><Stack>
      <Group align="flex-end" grow>
        <TextInput label="搜尋代碼或名稱" placeholder="輸入關鍵字" maxLength={100} value={search}
          onChange={(e) => { setSearch(e.currentTarget.value); setPage(1); }} />
        <Select label="儲存類型" data={[{ value: "", label: "全部類型" }, ...storageTypeOptions]} value={storageType}
          onChange={(value) => { setStorageType(value ?? ""); setPage(1); }} allowDeselect={false} />
        <Select label="狀態" data={[{ value: "", label: "全部狀態" }, { value: "true", label: "啟用" }, { value: "false", label: "停用" }]}
          value={status} onChange={(value) => { setStatus(value ?? ""); setPage(1); }} allowDeselect={false} />
      </Group>
      {locations.isPending && <Group role="status"><Loader size="sm" /><Text>載入儲存位置中…</Text></Group>}
      {locations.error && <Alert color="red" title="無法載入儲存位置" role="alert"><Stack gap="sm">
        <Text>{locations.error.message}</Text>
        <Button variant="light" onClick={() => void locations.refetch()} loading={locations.isFetching}>重新載入</Button>
      </Stack></Alert>}
      {locations.data && <>
        <Text c="dimmed" size="sm">共 {locations.data.total} 個位置</Text>
        {locations.data.items.length === 0
          ? <Text ta="center" py="xl">沒有符合條件的位置，請調整搜尋或篩選條件。</Text>
          : <Table.ScrollContainer minWidth={700}><Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead><Table.Tr>
              <Table.Th>代碼</Table.Th><Table.Th>名稱</Table.Th><Table.Th>儲存類型</Table.Th>
              <Table.Th>說明</Table.Th><Table.Th>狀態</Table.Th><Table.Th>操作</Table.Th>
            </Table.Tr></Table.Thead>
            <Table.Tbody>{locations.data.items.map((location) => <Fragment key={location.id}><Table.Tr>
              <Table.Td>{location.code}</Table.Td>
              <Table.Td>{location.name}</Table.Td>
              <Table.Td>{storageTypeLabels[location.storage_type]}</Table.Td>
              <Table.Td>{location.description ?? <Text span c="dimmed">—</Text>}</Table.Td>
              <Table.Td><Badge color={location.is_active ? "green" : "gray"} variant="light">
                {location.is_active ? "啟用" : "停用"}</Badge></Table.Td>
              <Table.Td><Group gap="xs">
                <Button variant="default" aria-expanded={expanded === location.id}
                  aria-label={`${expanded === location.id ? "收合" : "查看"} ${location.code} 的批次`}
                  onClick={() => setExpanded(expanded === location.id ? null : location.id)}>
                  {expanded === location.id ? "收合批次" : "查看批次"}</Button>
                {isAdmin && <>
                  <Button variant="light" aria-label={`編輯 ${location.code}`}
                    onClick={() => { setEditing(location); setSuccess(""); }}>編輯</Button>
                  <Button variant="subtle" color="red" aria-label={`刪除 ${location.code}`}
                    onClick={() => { setDeleting(location); setSuccess(""); }}>刪除</Button>
                </>}
              </Group></Table.Td>
            </Table.Tr>
            {expanded === location.id && <Table.Tr><Table.Td colSpan={6} bg="gray.0">
              <LocationBatches location={location} isAdmin={isAdmin}
                onMove={(batch) => { setMoving(batch); setSuccess(""); }} />
            </Table.Td></Table.Tr>}
            </Fragment>)}</Table.Tbody>
          </Table></Table.ScrollContainer>}
        {locations.data.total > PAGE_SIZE && <Pagination value={page} onChange={setPage}
          total={Math.ceil(locations.data.total / PAGE_SIZE)} aria-label="儲存位置分頁" />}
      </>}
    </Stack></Paper>
    <Modal opened={editing !== undefined} onClose={() => { if (!modalBusy) setEditing(undefined); }}
      title={editing ? "編輯儲存位置" : "新增儲存位置"} centered closeOnClickOutside={false}
      closeOnEscape={!modalBusy} withCloseButton={!modalBusy}>
      {editing !== undefined && <LocationForm key={editing?.id ?? "new"} location={editing}
        onSaved={done} onCancel={() => setEditing(undefined)} onBusy={setModalBusy} />}
    </Modal>
    <Modal opened={!!deleting} onClose={() => { if (!modalBusy) setDeleting(null); }} title="刪除儲存位置"
      centered closeOnClickOutside={false} closeOnEscape={!modalBusy} withCloseButton={!modalBusy}>
      {deleting && <DeleteConfirm key={deleting.id} location={deleting} onDeleted={done}
        onCancel={() => setDeleting(null)} onBusy={setModalBusy} />}
    </Modal>
    <Modal opened={!!moving} onClose={() => { if (!modalBusy) setMoving(null); }} title="整批換位置"
      centered closeOnClickOutside={false} closeOnEscape={!modalBusy} withCloseButton={!modalBusy}>
      {moving && <MoveBatchForm key={moving.id} batch={moving} onSaved={done}
        onCancel={() => setMoving(null)} onBusy={setModalBusy} />}
    </Modal>
  </Stack>;
}
