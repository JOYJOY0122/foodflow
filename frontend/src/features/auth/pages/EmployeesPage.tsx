import {
  Alert, Button, Checkbox, Group, Loader, Pagination, Paper, PasswordInput, Select, Stack, Table, Text, TextInput,
} from "@mantine/core";
import { useState, type FormEvent } from "react";

import { ActiveBadge } from "../../../shared/ui/ActiveBadge";
import { DataTable } from "../../../shared/ui/DataTable";
import { FormModal } from "../../../shared/ui/FormModal";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { SearchInput, Toolbar } from "../../../shared/ui/Toolbar";
import { PlusIcon, UsersIcon } from "../../../shared/ui/icons";

import {
  useCreateEmployee, useCurrentEmployee, useEmployees, useResetPassword, useUpdateEmployee,
  type Employee, type EmployeeCreate, type EmployeeUpdate,
} from "../hooks";

/** 主卡片內距（px）；工具列以同樣的距離貼齊卡片邊緣。 */
const CARD_PADDING = 20;

const roleOptions = [{ value: "ADMIN", label: "管理者" }, { value: "STAFF", label: "一般員工" }];
function fieldError(error: unknown, field: string): string | undefined {
  if (error && typeof error === "object" && "fields" in error && Array.isArray(error.fields)) {
    return error.fields.find((item: { field: string; message: string }) => item.field === field)?.message;
  }
}

function EmployeeForm({ employee, onSaved, onCancel, onBusy }: {
  employee: Employee | null; onSaved: (message: string) => void; onCancel: () => void; onBusy: (busy: boolean) => void;
}) {
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const [username, setUsername] = useState(employee?.username ?? "");
  const [name, setName] = useState(employee?.name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<EmployeeUpdate["role"]>(employee?.role ?? "STAFF");
  const [active, setActive] = useState(employee?.is_active ?? true);
  const [confirmed, setConfirmed] = useState(false);
  const destructive = employee && ((employee.is_active && !active) || (employee.role === "ADMIN" && role !== "ADMIN"));
  const mutation = employee ? update : create;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (destructive && !confirmed) return;
    onBusy(true);
    try {
      if (employee) {
        await update.mutateAsync({ id: employee.id, body: { name: name.trim(), role, is_active: active } });
      } else {
        const body: EmployeeCreate = { username: username.trim(), name: name.trim(), password, role, is_active: active };
        await create.mutateAsync(body);
      }
      onSaved(employee ? "員工資料已儲存" : "員工帳號已建立");
    } catch { /* Keep all form values on failure. */ } finally { onBusy(false); }
  }
  return <form onSubmit={submit}><Stack>
    {mutation.error && <Alert color="red" role="alert" title="儲存未完成">{mutation.error.message}</Alert>}
    <TextInput label="帳號" required maxLength={64} autoFocus={!employee} readOnly={!!employee}
      description={employee ? "帳號建立後固定" : undefined} value={username}
      onChange={(e) => setUsername(e.currentTarget.value)} error={fieldError(mutation.error, "username")} disabled={mutation.isPending} />
    <TextInput label="姓名" required maxLength={100} autoFocus={!!employee} value={name}
      onChange={(e) => setName(e.currentTarget.value)} error={fieldError(mutation.error, "name")} disabled={mutation.isPending} />
    {!employee && <PasswordInput label="初始密碼" description="8～128 字元；空白會保留" required
      minLength={8} maxLength={128} autoComplete="new-password" value={password}
      onChange={(e) => setPassword(e.currentTarget.value)} error={fieldError(mutation.error, "password")} disabled={mutation.isPending} />}
    <Select label="角色" data={roleOptions} value={role} allowDeselect={false} required
      onChange={(value) => { setRole(value as EmployeeUpdate["role"]); setConfirmed(false); }} disabled={mutation.isPending} />
    <Checkbox label="啟用帳號" checked={active} onChange={(e) => { setActive(e.currentTarget.checked); setConfirmed(false); }} disabled={mutation.isPending} />
    {destructive && <Alert color="orange" title="請確認權限變更">
      <Text size="sm" mb="sm">停用或降權將使此員工現有登入立即失效。歷史操作紀錄會保留；最後一位有效管理者不能停用或降權。</Text>
      <Checkbox label="我了解影響，確認變更" checked={confirmed} onChange={(e) => setConfirmed(e.currentTarget.checked)} disabled={mutation.isPending} />
    </Alert>}
    <Group justify="flex-end"><Button variant="default" onClick={onCancel} disabled={mutation.isPending}>取消</Button>
      <Button type="submit" loading={mutation.isPending} disabled={!!destructive && !confirmed}>儲存</Button></Group>
  </Stack></form>;
}

function PasswordForm({ employee, onSaved, onCancel, onBusy }: {
  employee: Employee; onSaved: (message: string) => void; onCancel: () => void; onBusy: (busy: boolean) => void;
}) {
  const reset = useResetPassword();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) return;
    if (password !== confirmation) { setMismatch(true); return; }
    setMismatch(false);
    onBusy(true);
    try {
      await reset.mutateAsync({ id: employee.id, password });
      onSaved("密碼已重設，請通知員工使用新密碼登入");
    } catch { /* Keep input for correction or retry. */ } finally { onBusy(false); }
  }
  return <form onSubmit={submit}><Stack>
    <Text>重設「{employee.name}（{employee.username}）」的密碼</Text>
    <Alert color="orange" title="現有登入將失效">重設成功後，員工必須以新密碼重新登入。</Alert>
    {reset.error && <Alert color="red" role="alert" title="重設未完成">{reset.error.message}</Alert>}
    <PasswordInput label="新密碼" description="8～128 字元；空白會保留" required autoFocus
      minLength={8} maxLength={128} autoComplete="new-password" value={password}
      onChange={(e) => setPassword(e.currentTarget.value)} error={fieldError(reset.error, "password")} disabled={reset.isPending} />
    <PasswordInput label="再次輸入新密碼" required minLength={8} maxLength={128} autoComplete="new-password"
      value={confirmation} onChange={(e) => setConfirmation(e.currentTarget.value)}
      error={mismatch ? "兩次密碼不一致" : undefined} disabled={reset.isPending} />
    <Checkbox label="我了解影響，確認重設密碼" checked={confirmed}
      onChange={(e) => setConfirmed(e.currentTarget.checked)} disabled={reset.isPending} />
    <Group justify="flex-end"><Button variant="default" onClick={onCancel} disabled={reset.isPending}>取消</Button>
      <Button type="submit" loading={reset.isPending} disabled={!confirmed}>確認重設密碼</Button></Group>
  </Stack></form>;
}

export function EmployeesPage() {
  const current = useCurrentEmployee();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const employees = useEmployees({ search, role, status, page }, current.data?.role === "ADMIN");
  const [editing, setEditing] = useState<Employee | null | undefined>(undefined);
  const [resetting, setResetting] = useState<Employee | null>(null);
  const [success, setSuccess] = useState("");
  const [modalBusy, setModalBusy] = useState(false);
  function saved(message: string) { setPage(1); setSuccess(message); setEditing(undefined); setResetting(null); }
  if (current.data?.role !== "ADMIN") return <Alert color="orange" title="沒有權限" role="alert">只有管理者可以管理員工帳號。</Alert>;
  return <Stack gap="lg" maw={1200} mx="auto">
    <PageHeader icon={<UsersIcon size={20} />} title="員工帳號" description="維護個人帳號、角色與登入權限"
      actions={<Button leftSection={<PlusIcon size={18} />} onClick={() => { setEditing(null); setSuccess(""); }}>
        新增員工</Button>} />
    {success && <Alert color="green" role="status" withCloseButton onClose={() => setSuccess("")}>{success}</Alert>}
    <Paper withBorder radius="xl" shadow="md" p={CARD_PADDING}><Stack>
      <Toolbar cols={{ base: 1, sm: 3 }} bleed={CARD_PADDING}>
        <SearchInput label="搜尋帳號或姓名" placeholder="輸入關鍵字" value={search}
          onChange={(e) => { setSearch(e.currentTarget.value); setPage(1); }} />
        <Select label="角色篩選" data={[{ value: "", label: "全部角色" }, ...roleOptions]} value={role}
          onChange={(value) => { setRole(value ?? ""); setPage(1); }} allowDeselect={false} />
        <Select label="狀態篩選" data={[{ value: "", label: "全部狀態" }, { value: "true", label: "啟用" }, { value: "false", label: "停用" }]}
          value={status} onChange={(value) => { setStatus(value ?? ""); setPage(1); }} allowDeselect={false} />
      </Toolbar>
      {employees.isPending && <Group role="status"><Loader size="sm" /><Text>載入員工中…</Text></Group>}
      {employees.error && <Alert color="red" title="無法載入員工" role="alert"><Stack gap="sm"><Text>{employees.error.message}</Text><Button variant="default" onClick={() => void employees.refetch()} loading={employees.isFetching}>重新載入</Button></Stack></Alert>}
      {employees.data && <>
        <Text c="dimmed" size="sm">共 {employees.data.total} 位員工</Text>
        {employees.data.items.length === 0 ? <Text ta="center" py="xl" c="dimmed">沒有符合條件的員工，請調整搜尋或篩選條件。</Text> :
          <DataTable minWidth={640} head={<>
            <Table.Th>帳號</Table.Th><Table.Th>姓名</Table.Th><Table.Th>角色</Table.Th><Table.Th>狀態</Table.Th><Table.Th>操作</Table.Th>
          </>}>
            {employees.data.items.map((employee) => <Table.Tr key={employee.id}>
              <Table.Td>{employee.username}</Table.Td>
              <Table.Td fw={700}>{employee.name}{current.data?.id === employee.id && <Text span size="xs" c="dimmed" fw={400}>（自己）</Text>}</Table.Td>
              <Table.Td>{employee.role === "ADMIN" ? "管理者" : "一般員工"}</Table.Td>
              <Table.Td><ActiveBadge active={employee.is_active} /></Table.Td>
              <Table.Td><Group gap="xs" wrap="nowrap"><Button variant="default" aria-label={`編輯 ${employee.username}`} onClick={() => { setEditing(employee); setSuccess(""); }}>編輯</Button>
                <Button variant="subtle" aria-label={`重設 ${employee.username} 密碼`} onClick={() => { setResetting(employee); setSuccess(""); }}>重設密碼</Button></Group></Table.Td>
            </Table.Tr>)}
          </DataTable>}
        {employees.data.total > 20 && <Pagination value={page} onChange={setPage} total={Math.ceil(employees.data.total / 20)} aria-label="員工分頁" />}
      </>}
    </Stack></Paper>
    <FormModal opened={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? "編輯員工" : "新增員工"} busy={modalBusy}>
      {editing !== undefined && <EmployeeForm key={editing?.id ?? "new"} employee={editing} onSaved={saved} onCancel={() => setEditing(undefined)} onBusy={setModalBusy} />}
    </FormModal>
    <FormModal opened={!!resetting} onClose={() => setResetting(null)} title="重設密碼" busy={modalBusy}>
      {resetting && <PasswordForm key={resetting.id} employee={resetting} onSaved={saved} onCancel={() => setResetting(null)} onBusy={setModalBusy} />}
    </FormModal>
  </Stack>;
}
