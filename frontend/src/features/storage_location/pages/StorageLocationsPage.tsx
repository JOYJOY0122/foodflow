import {
  Alert, Badge, Button, Checkbox, Group, Loader, Modal, Pagination, Paper, Select, Stack, Table,
  Text, TextInput, Textarea,
} from "@mantine/core";
import { useState, type FormEvent } from "react";

import { useCurrentEmployee } from "../../auth/hooks";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { storageTypeLabels, storageTypeOptions, type StorageType } from "../../../shared/storageTypes";
import {
  PAGE_SIZE, useCreateStorageLocation, useDeleteStorageLocation, useStorageLocations,
  useUpdateStorageLocation, type StorageLocation,
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
  const [success, setSuccess] = useState("");
  const [modalBusy, setModalBusy] = useState(false);

  function done(message: string) {
    // 刪除或停用可能讓目前頁變空且分頁元件消失，回到第 1 頁。
    setPage(1);
    setSuccess(message);
    setEditing(undefined);
    setDeleting(null);
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
              <Table.Th>說明</Table.Th><Table.Th>狀態</Table.Th>{isAdmin && <Table.Th>操作</Table.Th>}
            </Table.Tr></Table.Thead>
            <Table.Tbody>{locations.data.items.map((location) => <Table.Tr key={location.id}>
              <Table.Td>{location.code}</Table.Td>
              <Table.Td>{location.name}</Table.Td>
              <Table.Td>{storageTypeLabels[location.storage_type]}</Table.Td>
              <Table.Td>{location.description ?? <Text span c="dimmed">—</Text>}</Table.Td>
              <Table.Td><Badge color={location.is_active ? "green" : "gray"} variant="light">
                {location.is_active ? "啟用" : "停用"}</Badge></Table.Td>
              {isAdmin && <Table.Td><Group gap="xs">
                <Button variant="light" aria-label={`編輯 ${location.code}`}
                  onClick={() => { setEditing(location); setSuccess(""); }}>編輯</Button>
                <Button variant="subtle" color="red" aria-label={`刪除 ${location.code}`}
                  onClick={() => { setDeleting(location); setSuccess(""); }}>刪除</Button>
              </Group></Table.Td>}
            </Table.Tr>)}</Table.Tbody>
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
  </Stack>;
}
