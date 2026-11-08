import {
  AccordionChevron, ActionIcon, Affix, Alert, Badge, Box, Button, Flex, Group, Loader, Menu, Pagination,
  Paper, Select, SimpleGrid, Stack, Table, Text, ThemeIcon, VisuallyHidden,
  useMantineTheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import dayjs from "dayjs";
import { Fragment, useCallback, useEffect, useState, type CSSProperties } from "react";

import { useCurrentEmployee } from "../../auth/hooks";
import { ActiveBadge } from "../../../shared/ui/ActiveBadge";
import { CodeTag } from "../../../shared/ui/CodeTag";
import { DataTable } from "../../../shared/ui/DataTable";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { FormModal } from "../../../shared/ui/FormModal";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { StorageTypeIcon, storageTypeColors, storageTypeIcons } from "../../../shared/ui/StorageTypeIcon";
import { SearchInput, Toolbar } from "../../../shared/ui/Toolbar";
import {
  BoxIcon, DotsIcon, MapPinIcon, PencilIcon, PlusIcon, SearchIcon, SwapIcon, TrashIcon,
} from "../../../shared/ui/icons";
import { storageTypeLabels, storageTypeOptions, type StorageType } from "../../../shared/storageTypes";
import { DeleteConfirm, LocationForm, MoveBatchForm } from "../components/StorageLocationForms";
import classes from "./StorageLocationsPage.module.css";
import {
  PAGE_SIZE, useActiveStorageLocations, useLocationBatches, useStorageLocations,
  type LocationBatch, type StorageLocation,
} from "../hooks";

/** 版面：寬螢幕用表格、平板用卡片、手機用扁平清單。 */
type Layout = "table" | "cards" | "list";

/** 類型文字徽章；圖示方塊（StorageTypeIcon）只是輔助，類型一定以文字標示（NFR-01）。 */
function TypeBadge({ type }: { type: StorageType }) {
  return <Badge color="gray" variant="light" radius="sm">{storageTypeLabels[type]}</Badge>;
}

function ExpandToggle({ location, expanded, onToggle }: {
  location: StorageLocation; expanded: boolean; onToggle: () => void;
}) {
  return <ActionIcon variant={expanded ? "filled" : "subtle"} color={expanded ? "forest" : "gray"} size={44}
    radius="md" aria-expanded={expanded} aria-label={`${expanded ? "收合" : "查看"} ${location.code} 的批次`}
    onClick={onToggle}>
    <AccordionChevron style={{ transition: "transform 150ms ease",
      transform: expanded ? "rotate(180deg)" : undefined }} />
  </ActionIcon>;
}

/** 到期日距今天數，只做日期換算，不涉及預警門檻。 */
function ExpiryHint({ date }: { date: string }) {
  const days = dayjs(date).startOf("day").diff(dayjs().startOf("day"), "day");
  if (days < 0) return <Text span size="xs" c="expired.8" fw={600}>已過期 {-days} 天</Text>;
  return <Text span size="xs" c="dimmed">{days === 0 ? "今天到期" : `還有 ${days} 天`}</Text>;
}

/** 主卡片內距（px）；工具列以同樣的距離貼齊卡片邊緣。 */
const CARD_PADDING = 20;

/** 清單項目依序進場，最多延遲到第 10 個，避免長清單等太久。 */
const stagger = (index: number, base = 0) =>
  ({ "--delay": `${base + Math.min(index, 10) * 70}ms` }) as CSSProperties;

/** 啟用中位置的數量與各類型分布，資料來自換位置選單共用的查詢。四格等寬，手機上置中。 */
function LocationSummary({ compact }: { compact: boolean }) {
  const active = useActiveStorageLocations(true);
  if (active.error) return null;
  const items = active.data?.items ?? [];
  const value = (n: number) => (active.isPending ? "—" : n);
  const stats = [
    { key: "all", label: "啟用中", color: "forest", Icon: MapPinIcon, value: value(active.data?.total ?? 0) },
    ...storageTypeOptions.map((option) => ({
      key: option.value, label: option.label, color: storageTypeColors[option.value],
      Icon: storageTypeIcons[option.value],
      value: value(items.filter((item) => item.storage_type === option.value).length),
    })),
  ];
  return <Paper withBorder radius="xl" shadow="xs" aria-label="位置摘要" className={`${classes.enter} ff-raised`}
    style={stagger(0, 80)}>
    <SimpleGrid cols={4} spacing={0}>
      {stats.map(({ key, label, color, Icon, value: count }, index) => <Flex key={key}
        direction={compact ? "column" : "row"} align="center" justify="center" gap={compact ? 2 : 10}
        px={compact ? 4 : "md"} py="sm"
        style={index > 0 ? { borderLeft: "1px solid var(--ff-line-soft)" } : undefined}>
        <Text size={compact ? "xs" : "sm"} c="dimmed"
          style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <Box component="span" c={color} style={{ display: "inline-flex" }}><Icon size={compact ? 14 : 16} /></Box>{label}
        </Text>
        <Text fw={700} fz="lg" lh={1.2}>{count}</Text>
      </Flex>)}
    </SimpleGrid>
  </Paper>;
}

function LocationBatches({ location, isAdmin, layout, onMove, onSettled }: {
  location: StorageLocation; isAdmin: boolean; layout: Layout;
  onMove: (batch: LocationBatch) => void; onSettled: (locationId: number) => void;
}) {
  const batches = useLocationBatches(location.id);
  // 批次載入完、頁面高度確定後才捲動；否則第一次展開時頁面不夠高，捲不到位。
  useEffect(() => {
    if (!batches.isPending) onSettled(location.id);
  }, [batches.isPending, location.id, onSettled]);

  if (batches.isPending) return <Group role="status" py="sm"><Loader size="sm" /><Text>載入批次中…</Text></Group>;
  if (batches.error) return <Alert color="red" title="無法載入批次" role="alert"><Stack gap="sm">
    <Text>{batches.error.message}</Text>
    <Button variant="light" onClick={() => void batches.refetch()} loading={batches.isFetching}>重新載入</Button>
  </Stack></Alert>;
  const { items, total } = batches.data;
  if (items.length === 0) return <Group gap="sm" py="xs">
    <ThemeIcon size={32} radius="xl" variant="light" color="gray"><BoxIcon size={17} /></ThemeIcon>
    <Text c="dimmed" size="sm">此位置目前沒有剩餘庫存的批次。</Text>
  </Group>;

  const label = `${location.code} 的批次`;
  const moveButton = (batch: LocationBatch, size?: string) => isAdmin &&
    <Button variant="default" size={size} leftSection={<SwapIcon size={16} />} style={{ flexShrink: 0 }}
      aria-label={`換位置 ${batch.batch_number}`} onClick={() => onMove(batch)}>換位置</Button>;
  const quantity = (batch: LocationBatch, size = "md") => <Text ta="right" style={{ whiteSpace: "nowrap" }}>
    <Text span fw={700} fz={size}>{batch.remaining_quantity}</Text>
    <Text span size="sm" c="dimmed"> {batch.unit}</Text>
  </Text>;

  const heading = layout === "list"
    ? <Text size="xs" c="dimmed" fw={600}>{total} 個批次 · 最早到期在前</Text>
    : <Group justify="space-between" gap="xs">
      <Group gap={8}>
        <Text fw={600}>目前存放</Text>
        <Badge variant="filled" color="forest" radius="xl">{total} 個批次</Badge>
      </Group>
      <Text size="xs" c="dimmed">依到期日排序，最早到期在前</Text>
    </Group>;

  return <Stack gap="sm">
    {heading}
    {total > items.length && <Alert color="orange" variant="light" p="xs">
      共 {total} 個批次，只顯示到期日最早的 {items.length} 個。</Alert>}
    {layout === "table" && <DataTable label={label} head={<>
      <Table.Th>食材</Table.Th><Table.Th w={160}>批號</Table.Th><Table.Th w={130} ta="right">剩餘量</Table.Th>
      <Table.Th w={160} ta="center">到期日</Table.Th>
      {isAdmin && <Table.Th w={130}><VisuallyHidden>操作</VisuallyHidden></Table.Th>}
    </>}>
      {items.map((batch, index) => <Table.Tr key={batch.id} className={classes.enter} style={stagger(index, 40)}>
        <Table.Td fw={700}>{batch.ingredient_name}</Table.Td>
        <Table.Td><CodeTag code={batch.batch_number} /></Table.Td>
        <Table.Td ta="right">{quantity(batch)}</Table.Td>
        <Table.Td ta="center"><Text size="sm">{batch.expiry_date}</Text><ExpiryHint date={batch.expiry_date} /></Table.Td>
        {isAdmin && <Table.Td ta="right">{moveButton(batch)}</Table.Td>}
      </Table.Tr>)}
    </DataTable>}
    {layout === "cards" && <SimpleGrid component="ul" aria-label={label} cols={2} spacing="xs" m={0} p={0}
      style={{ listStyle: "none" }}>
      {items.map((batch, index) => <Paper component="li" key={batch.id} withBorder radius="md" p="sm" shadow="xs"
        className={classes.enter} style={stagger(index, 40)}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap={8} style={{ minWidth: 0 }}>
            <Text fw={600}>{batch.ingredient_name}</Text>
            <CodeTag code={batch.batch_number} />
          </Group>
          {quantity(batch, "lg")}
        </Group>
        <Group justify="space-between" align="flex-end" mt={6} gap="xs" wrap="nowrap">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text size="sm" c="dimmed">到期日 {batch.expiry_date}</Text>
            <ExpiryHint date={batch.expiry_date} />
          </Stack>
          {moveButton(batch)}
        </Group>
      </Paper>)}
    </SimpleGrid>}
    {/* 手機：白底清單列加分隔線，不再卡片包卡片。 */}
    {layout === "list" && <Paper component="ul" aria-label={label} radius="md" withBorder m={0} p={0}
      style={{ listStyle: "none", overflow: "hidden" }}>
      {items.map((batch, index) => <Box component="li" key={batch.id} px="md" py="sm" className={classes.enter}
        style={{ ...stagger(index, 40), ...(index > 0 ? { borderTop: "1px solid var(--ff-line-soft)" } : {}) }}>
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Box style={{ minWidth: 0 }}>
            <Text fw={600} truncate>{batch.ingredient_name}</Text>
            <Text size="xs" c="dimmed" ff="monospace">{batch.batch_number}</Text>
          </Box>
          {quantity(batch, "lg")}
        </Group>
        <Group justify="space-between" wrap="nowrap" gap="sm" mt={6}>
          <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>
            到期 {batch.expiry_date} · <ExpiryHint date={batch.expiry_date} />
          </Text>
          {moveButton(batch, "compact-sm")}
        </Group>
      </Box>)}
    </Paper>}
  </Stack>;
}

function LocationsEmpty({ filtered, isAdmin, onCreate }: { filtered: boolean; isAdmin: boolean; onCreate: () => void }) {
  return <Paper radius="lg" bg="gray.0" style={{ border: "1px dashed var(--ff-line-nested)" }}>
    <EmptyState icon={filtered ? <SearchIcon size={24} /> : <MapPinIcon size={24} />}
      title={filtered ? "沒有符合條件的位置" : "還沒有儲存位置"}
      description={filtered ? "請調整搜尋或篩選條件。" : "先建立店內固定的冷藏庫、冷凍庫與常溫架，進貨時就能直接選擇。"}
      action={!filtered && isAdmin && <Button variant="default" leftSection={<PlusIcon size={16} />} onClick={onCreate}>
        新增第一個位置</Button>} />
  </Paper>;
}

export function StorageLocationsPage() {
  const theme = useMantineTheme();
  // 1024 平板扣掉導覽列後內容約 720px，表格太擠；未達 lg 時改用卡片。
  const wide = useMediaQuery(`(min-width: ${theme.breakpoints.lg})`, false, { getInitialValueInEffect: false });
  // 手機寬度：扁平清單、浮動新增鈕、對話框全螢幕。
  const phone = useMediaQuery(`(max-width: ${theme.breakpoints.xs})`, false, { getInitialValueInEffect: false });
  const layout: Layout = wide ? "table" : phone ? "list" : "cards";
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
  const filtered = search.trim() !== "" || storageType !== "" || status !== "";

  function done(message: string) {
    // 刪除或停用可能讓目前頁變空且分頁元件消失，回到第 1 頁。
    setPage(1);
    setSuccess(message);
    setEditing(undefined);
    setDeleting(null);
    setMoving(null);
  }
  const create = () => { setEditing(null); setSuccess(""); };
  const toggle = (id: number) => setExpanded(expanded === id ? null : id);
  // 展開的位置捲到頁首下方，批次清單才不會落在畫面外；收合時不捲動。
  const scrollToLocation = useCallback((id: number) => {
    const target = document.querySelector(`[data-location-id="${id}"]`);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);
  const edit = (location: StorageLocation) => { setEditing(location); setSuccess(""); };
  const remove = (location: StorageLocation) => { setDeleting(location); setSuccess(""); };
  const adminActions = (location: StorageLocation) => <Group gap={4} wrap="nowrap">
    <Button variant="subtle" leftSection={<PencilIcon size={16} />}
      aria-label={`編輯 ${location.code}`} onClick={() => edit(location)}>編輯</Button>
    <Button variant="subtle" color="red" leftSection={<TrashIcon size={16} />}
      aria-label={`刪除 ${location.code}`} onClick={() => remove(location)}>刪除</Button>
  </Group>;
  const actionMenu = (location: StorageLocation) => <Menu position="bottom-end" withinPortal shadow="md">
    <Menu.Target>
      <ActionIcon variant="subtle" color="gray" size={44} radius="md" aria-label={`${location.code} 的操作`}>
        <DotsIcon size={20} />
      </ActionIcon>
    </Menu.Target>
    <Menu.Dropdown>
      <Menu.Item leftSection={<PencilIcon size={16} />} aria-label={`編輯 ${location.code}`}
        onClick={() => edit(location)}>編輯</Menu.Item>
      <Menu.Item color="red" leftSection={<TrashIcon size={16} />} aria-label={`刪除 ${location.code}`}
        onClick={() => remove(location)}>刪除</Menu.Item>
    </Menu.Dropdown>
  </Menu>;
  const batches = (location: StorageLocation) => <LocationBatches location={location} isAdmin={isAdmin}
    layout={layout} onMove={(batch) => { setMoving(batch); setSuccess(""); }} onSettled={scrollToLocation} />;
  const nameBlock = (location: StorageLocation, clamp: boolean, open = false) => <Stack gap={2}
    style={{ minWidth: 0 }}>
    <Group gap="xs" wrap={clamp ? "nowrap" : "wrap"}>
      <Text fw={700} truncate={clamp} c={open ? "forest.9" : undefined}>{location.name}</Text>
      <CodeTag code={location.code} />
    </Group>
    {location.description && <Text size="sm" c="dimmed" lineClamp={clamp ? 1 : undefined}>{location.description}</Text>}
  </Stack>;
  const expandedPanel = (location: StorageLocation, inset: number) => <Box mt="md" mx={-inset} mb={-inset} p={inset}
    bg="gray.0" className={classes.reveal} style={{ borderTop: "1px solid var(--ff-line-selected)",
      borderRadius: `0 0 var(--mantine-radius-${phone ? "lg" : "md"}) var(--mantine-radius-${phone ? "lg" : "md"})` }}>
    {batches(location)}</Box>;

  const items = locations.data?.items ?? [];
  const list = () => {
    if (layout === "table") return <DataTable head={<>
      <Table.Th>位置</Table.Th><Table.Th w={110} ta="center">儲存類型</Table.Th>
      <Table.Th w={100} ta="center">狀態</Table.Th>{isAdmin && <Table.Th w={190}>操作</Table.Th>}
      <Table.Th w={64}><VisuallyHidden>批次</VisuallyHidden></Table.Th>
    </>}>
      {items.map((location, index) => {
        const open = expanded === location.id;
        return <Fragment key={location.id}>
          <Table.Tr data-location={location.code} data-location-id={location.id} opacity={location.is_active ? 1 : 0.6}
            className={`${classes.enter} ${classes.anchor}`}
            style={{ ...stagger(index, 240), ...(open ? {
              background: "var(--ff-surface-selected)", boxShadow: "inset 0 1px 0 var(--ff-line-selected)",
            } : {}) }}>
            <Table.Td><Group gap="md" wrap="nowrap">
              <StorageTypeIcon type={location.storage_type} muted={!location.is_active} />
              {nameBlock(location, true, open)}
            </Group></Table.Td>
            <Table.Td ta="center"><TypeBadge type={location.storage_type} /></Table.Td>
            <Table.Td ta="center"><ActiveBadge active={location.is_active} /></Table.Td>
            {isAdmin && <Table.Td>{adminActions(location)}</Table.Td>}
            <Table.Td ta="right"><ExpandToggle location={location} expanded={open}
              onToggle={() => toggle(location.id)} /></Table.Td>
          </Table.Tr>
          {open && <Table.Tr className={classes.reveal}><Table.Td colSpan={isAdmin ? 5 : 4}
            style={{ background: "var(--ff-surface-selected)" }} px="lg" py="md">
            {batches(location)}
          </Table.Td></Table.Tr>}
        </Fragment>;
      })}
    </DataTable>;

    if (layout === "cards") return <Stack gap="sm">{items.map((location, index) => {
      const open = expanded === location.id;
      return <Paper key={location.id} component="article" data-location={location.code} data-location-id={location.id}
        withBorder radius="md" p="md" shadow={open ? "sm" : "xs"} opacity={location.is_active ? 1 : 0.75}
        aria-label={`${location.code} ${location.name}`} className={`${classes.enter} ${classes.anchor}`}
        style={{ ...stagger(index, 240), ...(open ? { borderColor: "var(--mantine-color-forest-3)" } : {}) }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
            <StorageTypeIcon type={location.storage_type} muted={!location.is_active} />
            <Stack gap={6} style={{ minWidth: 0 }}>
              {nameBlock(location, false, open)}
              <Group gap="xs"><TypeBadge type={location.storage_type} /><ActiveBadge active={location.is_active} /></Group>
            </Stack>
          </Group>
          <Group gap={0} wrap="nowrap" mr={-6} mt={-6}>
            {isAdmin && adminActions(location)}
            <ExpandToggle location={location} expanded={open} onToggle={() => toggle(location.id)} />
          </Group>
        </Group>
        {open && expandedPanel(location, 16)}
      </Paper>;
    })}</Stack>;

    // 手機：一列一個位置，圖示＋兩行文字＋右側操作，比照常見 App 的清單列。
    return <Stack gap="sm">{items.map((location, index) => {
      const open = expanded === location.id;
      const meta = [location.code, storageTypeLabels[location.storage_type]].join(" · ");
      return <Paper key={location.id} component="article" data-location={location.code} data-location-id={location.id}
        radius="lg" p="md" withBorder opacity={location.is_active ? 1 : 0.7}
        aria-label={`${location.code} ${location.name}`} className={`${classes.enter} ${classes.anchor}`}
        style={{ ...stagger(index, 240), ...(open ? { borderColor: "var(--mantine-color-forest-3)" } : {}) }}>
        <Group gap="md" wrap="nowrap">
          <StorageTypeIcon type={location.storage_type} muted={!location.is_active} size={44} />
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap={6} wrap="nowrap">
              <Text fw={700} truncate>{location.name}</Text>
              {!location.is_active && <ActiveBadge active={false} />}
            </Group>
            <Text size="xs" c="dimmed" truncate>{meta}</Text>
            {location.description && <Text size="xs" c="dimmed" lineClamp={1}>{location.description}</Text>}
          </Box>
          <Group gap={0} wrap="nowrap" mr={-8}>
            {isAdmin && actionMenu(location)}
            <ExpandToggle location={location} expanded={open} onToggle={() => toggle(location.id)} />
          </Group>
        </Group>
        {open && expandedPanel(location, 16)}
      </Paper>;
    })}</Stack>;
  };

  const filters = <Toolbar cols={{ base: 2, sm: 3 }} spacing={phone ? "xs" : "md"}
    bleed={phone ? undefined : CARD_PADDING}>
    <SearchInput label={phone ? undefined : "搜尋代碼或名稱"} aria-label={phone ? "搜尋代碼或名稱" : undefined}
      placeholder={phone ? "搜尋代碼或名稱" : "例如 R-01、冷藏"}
      maxLength={100} value={search} radius={phone ? "xl" : undefined}
      style={phone ? { gridColumn: "1 / -1" } : undefined}
      onChange={(e) => { setSearch(e.currentTarget.value); setPage(1); }} />
    <Select label={phone ? undefined : "儲存類型"} aria-label={phone ? "儲存類型" : undefined} radius={phone ? "xl" : undefined}
      data={[{ value: "", label: "全部類型" }, ...storageTypeOptions]} value={storageType}
      onChange={(value) => { setStorageType(value ?? ""); setPage(1); }} allowDeselect={false} />
    <Select label={phone ? undefined : "狀態"} aria-label={phone ? "狀態" : undefined} radius={phone ? "xl" : undefined}
      data={[{ value: "", label: "全部狀態" }, { value: "true", label: "啟用" }, { value: "false", label: "停用" }]}
      value={status} onChange={(value) => { setStatus(value ?? ""); setPage(1); }} allowDeselect={false} />
  </Toolbar>;

  const body = <Stack gap="md">
    {filters}
    {locations.isPending && <Group role="status" justify="center" py="xl"><Loader size="sm" /><Text>載入儲存位置中…</Text></Group>}
    {locations.error && <Alert color="red" title="無法載入儲存位置" role="alert"><Stack gap="sm">
      <Text>{locations.error.message}</Text>
      <Button variant="light" onClick={() => void locations.refetch()} loading={locations.isFetching}>重新載入</Button>
    </Stack></Alert>}
    {locations.data && <>
      <Text c="dimmed" size="sm">共 {locations.data.total} 個位置</Text>
      {items.length === 0 ? <LocationsEmpty filtered={filtered} isAdmin={isAdmin} onCreate={create} /> : list()}
      {locations.data.total > PAGE_SIZE && <Group justify="center"><Pagination value={page} onChange={setPage}
        total={Math.ceil(locations.data.total / PAGE_SIZE)} aria-label="儲存位置分頁" /></Group>}
    </>}
  </Stack>;

  return <Stack gap={phone ? "md" : "lg"} maw={1200} mx="auto" pb={phone && isAdmin ? 80 : undefined}>
    <Box className={classes.enter}>
      <PageHeader icon={<MapPinIcon size={20} />} title="儲存位置" description={phone ? undefined : "維護食材的實際存放處，供進貨登記與員工查找"}
        actions={isAdmin && !phone && <Button leftSection={<PlusIcon size={18} />} onClick={create}>新增位置</Button>} />
    </Box>
    {success && <Alert color="green" role="status" withCloseButton onClose={() => setSuccess("")}>{success}</Alert>}
    <LocationSummary compact={phone} />

    {/* 手機不再多包一層外框，卡片直接貼齊頁面左右邊距，內容寬度多出約 30px。 */}
    {phone
      ? <Box className={classes.enter} style={stagger(0, 160)}>{body}</Box>
      : <Paper withBorder radius="xl" shadow="md" p={CARD_PADDING} className={classes.enter}
        style={stagger(0, 160)}>{body}</Paper>}

    {/* 手機的新增改為右下角浮動按鈕，與常見 App 一致。 */}
    {isAdmin && phone && <Affix position={{ bottom: 20, right: 20 }}>
      <ActionIcon size={56} radius="xl" variant="filled" aria-label="新增位置" onClick={create}
        style={{ boxShadow: "var(--mantine-shadow-lg)" }}>
        <PlusIcon size={26} />
      </ActionIcon>
    </Affix>}

    <FormModal opened={editing !== undefined} onClose={() => setEditing(undefined)}
      title={editing ? "編輯儲存位置" : "新增儲存位置"} busy={modalBusy} fullScreen={phone}>
      {editing !== undefined && <LocationForm key={editing?.id ?? "new"} location={editing}
        onSaved={done} onCancel={() => setEditing(undefined)} onBusy={setModalBusy} />}
    </FormModal>
    <FormModal opened={!!deleting} onClose={() => setDeleting(null)} title="刪除儲存位置"
      kind="confirm" busy={modalBusy} fullScreen={phone}>
      {deleting && <DeleteConfirm key={deleting.id} location={deleting} onDeleted={done}
        onCancel={() => setDeleting(null)} onBusy={setModalBusy} />}
    </FormModal>
    <FormModal opened={!!moving} onClose={() => setMoving(null)} title="整批換位置" busy={modalBusy} fullScreen={phone}>
      {moving && <MoveBatchForm key={moving.id} batch={moving} onSaved={done}
        onCancel={() => setMoving(null)} onBusy={setModalBusy} />}
    </FormModal>
  </Stack>;
}
