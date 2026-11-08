import { Alert, AppShell, Box, Burger, Button, Group, NavLink, ScrollArea, Text, Title, useMantineTheme } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useEffect, useState, type ComponentType } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";

import { useCurrentEmployee, useLogout } from "../features/auth/hooks";
import { routes } from "../shared/routes";
import {
  BellIcon, ChartIcon, ClipboardIcon, FolderIcon, LayersIcon, LeafIcon, LogoutIcon, MapPinIcon, OutboxIcon,
  SproutIcon, StoreIcon, TagIcon, TrashIcon, TruckIcon, UsersIcon,
} from "../shared/ui/icons";

interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ size?: number }>;
  adminOnly?: boolean;
}

// 依 SRS 第 4.1 節：盤點調整與帳號管理僅限管理者；基本資料一般員工可查詢。
const operationItems: NavItem[] = [
  { label: "預警首頁", to: routes.home, icon: BellIcon },
  { label: "庫存", to: routes.inventory, icon: LayersIcon },
  { label: "進貨", to: routes.goodsReceipts, icon: TruckIcon },
  { label: "領用", to: routes.issues, icon: OutboxIcon },
  { label: "報廢", to: routes.wasteRecords, icon: TrashIcon },
  { label: "盤點", to: routes.stocktakes, icon: ClipboardIcon, adminOnly: true },
  { label: "異動與統計", to: routes.reports, icon: ChartIcon },
];
const masterDataItems: NavItem[] = [
  { label: "食材", to: routes.ingredients, icon: LeafIcon },
  { label: "分類", to: routes.ingredientCategories, icon: TagIcon },
  { label: "供應商", to: routes.suppliers, icon: StoreIcon },
  { label: "儲存位置", to: routes.storageLocations, icon: MapPinIcon },
];
const accountItems: NavItem[] = [
  { label: "員工帳號", to: routes.employees, icon: UsersIcon, adminOnly: true },
];

const NAVBAR_ID = "app-navbar";
// useMediaQuery 與 AppShell 共用同一個斷點，避免按鈕狀態與實際收合規則錯開。
const NAVBAR_BREAKPOINT = "sm";

function isActive(pathname: string, to: string) {
  // React Router 預設不分大小寫，比對時一併忽略。
  const path = pathname.toLowerCase();
  return to === routes.home ? path === to : path === to || path.startsWith(`${to}/`);
}

export function AppLayout() {
  const current = useCurrentEmployee();
  const logout = useLogout();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const theme = useMantineTheme();
  // 寬度達斷點（含 1024×768 平板）時導覽列與內容並排，以下改為覆蓋式。
  const wide = useMediaQuery(`(min-width: ${theme.breakpoints[NAVBAR_BREAKPOINT]})`, true, { getInitialValueInEffect: false });
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const opened = wide ? desktopOpened : mobileOpened;
  const isAdmin = current.data?.role === "ADMIN";
  const visible = (items: NavItem[]) => items.filter((item) => isAdmin || !item.adminOnly);
  const masterDataActive = masterDataItems.some((item) => isActive(pathname, item.to));
  const [masterDataOpened, setMasterDataOpened] = useState(masterDataActive);

  // 換頁（含瀏覽器上一頁）時關閉覆蓋式導覽，並展開目前頁面所在的群組。
  useEffect(() => {
    closeMobile();
    if (masterDataActive) setMasterDataOpened(true);
  }, [pathname, masterDataActive, closeMobile]);

  async function signOut() {
    try {
      await logout.mutateAsync();
      navigate(routes.login, { replace: true });
    } catch { /* Keep retry available when logout did not complete. */ }
  }
  function link(item: NavItem) {
    const active = isActive(pathname, item.to);
    return <NavLink key={item.to} component={Link} to={item.to} label={item.label} active={active}
      leftSection={<item.icon size={18} />} aria-current={active ? "page" : undefined} onClick={closeMobile} mih={44} />;
  }

  return (
    <AppShell header={{ height: 72 }} padding={{ base: 16, sm: 24, lg: 32 }}
      styles={{
        header: { background: "var(--ff-surface-raised)", backdropFilter: "blur(8px)", borderColor: "var(--ff-line)" },
        navbar: { background: "var(--ff-sidebar)", borderColor: "var(--ff-line-nested)" },
      }}
      navbar={{ width: 236, breakpoint: NAVBAR_BREAKPOINT, collapsed: { mobile: !mobileOpened, desktop: !desktopOpened } }}>
      <AppShell.Header>
        <Group h="100%" px={{ base: "md", sm: "xl" }} justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={wide ? toggleDesktop : toggleMobile} size="sm" w={44} h={44} style={{ flexShrink: 0 }}
              aria-label={opened ? "收合導覽列" : "展開導覽列"} aria-expanded={opened} aria-controls={NAVBAR_ID} />
            <Box className="ff-icon-tile" w={34} h={34} style={{ borderRadius: "var(--mantine-radius-md)" }}
              aria-hidden="true"><SproutIcon size={20} /></Box>
            <Box style={{ lineHeight: 1.2, whiteSpace: "nowrap" }}>
              <Title order={3} fz={17} fw={900} c="forest.9" lh={1.2}>食序 FoodFlow</Title>
              <Text fz="xs" c="dimmed" visibleFrom="sm">餐廳食材管理</Text>
            </Box>
          </Group>
          <Group wrap="nowrap" gap="sm"><Text size="sm" fw={600} maw={220} truncate visibleFrom="sm" title={current.data?.name}>{current.data?.name} · {current.data?.role === "ADMIN" ? "管理者" : "一般員工"}</Text>
            <Button variant="default" leftSection={<LogoutIcon size={16} />} onClick={() => void signOut()}
              loading={logout.isPending}>登出</Button></Group>
        </Group>
      </AppShell.Header>
      {/* 收合時導覽列只是移出畫面，inert 讓裡面的連結不會被鍵盤聚焦。 */}
      <AppShell.Navbar id={NAVBAR_ID} p="sm" aria-label="主要導覽" inert={!opened}>
        <AppShell.Section grow component={ScrollArea}>
          {visible(operationItems).map(link)}
          {/* 群組收起時由父項目標示目前所在位置。 */}
          <NavLink component="button" type="button" label="基本資料" mih={44} leftSection={<FolderIcon size={18} />}
            opened={masterDataOpened} onChange={setMasterDataOpened} active={masterDataActive && !masterDataOpened}>
            {visible(masterDataItems).map(link)}
          </NavLink>
          {visible(accountItems).map(link)}
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main>
        {logout.error && <Alert color="red" role="alert" mb="md" title="登出未完成">{logout.error.message}，請再試一次。</Alert>}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
