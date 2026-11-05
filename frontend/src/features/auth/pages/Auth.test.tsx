import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../../../shared/api/queryKeys";
import { Providers } from "../../../app/providers";
import { RequireLogin } from "../../../app/router";
import { useCurrentEmployee, useLogin, useLogout } from "../hooks";
import { EmployeesPage } from "./EmployeesPage";
import { LoginPage } from "./LoginPage";

const admin = { id: 1, username: "manager", name: "王店長", role: "ADMIN", is_active: true,
  created_at: "2026-11-06T00:00:00Z" };
const staff = { ...admin, id: 2, username: "staff", name: "員工", role: "STAFF" };
const error = (message: string, code = "DUPLICATE", fields: unknown[] = []) => ({ error: { code, message, fields, details: {} } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

function wrapper(client: QueryClient, initialPath = "/login") {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <MantineProvider env="test"><QueryClientProvider client={client}><MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter></QueryClientProvider></MantineProvider>;
  };
}
function renderPage(page: React.ReactNode, employee = admin) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.auth.all, employee);
  render(page, { wrapper: wrapper(client) });
  return client;
}

describe("authentication", () => {
  it("blocks form entry while checking an existing session, then redirects", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    const client = new QueryClient();
    render(<Routes><Route path="/login" element={<LoginPage />} /><Route path="/" element={<div>已有登入的首頁</div>} /></Routes>, { wrapper: wrapper(client) });
    expect(screen.getByLabelText("確認登入狀態")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    await act(async () => { resolve(json(admin)); });
    expect(await screen.findByText("已有登入的首頁")).toBeTruthy();
    expect(screen.queryByLabelText(/^帳號/)).toBeNull();
  });

  it.each(["network", "server"])("shows initial session %s failure and recovers on retry", async (failure) => {
    let failed = true;
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (!failed) return json(error("尚未登入", "UNAUTHENTICATED"), 401);
      if (failure === "network") throw new TypeError("Failed to fetch");
      return json(error("服務暫時失效", "INTERNAL_ERROR"), 500);
    }));
    const client = new QueryClient();
    render(<LoginPage />, { wrapper: wrapper(client) });
    expect(await screen.findByText("無法確認登入狀態")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    failed = false;
    fireEvent.click(screen.getByRole("button", { name: "重試" }));
    expect(await screen.findByLabelText(/^帳號/)).toBeTruthy();
  });

  it("settles an expired session and clears operational data without leaving a pending guard", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(error("尚未登入", "UNAUTHENTICATED"), 401)));
    function Probe() {
      const client = useQueryClient();
      const current = useCurrentEmployee();
      useEffect(() => { client.setQueryData(queryKeys.inventory.all, { private: true }); }, [client]);
      if (current.isPending) return <div>checking-session</div>;
      return <div>{current.data ? "signed-in" : "anonymous"}:{client.getQueryData(queryKeys.inventory.all) ? "private-data" : "cleared"}</div>;
    }
    render(<Providers><Probe /></Providers>);
    expect(await screen.findByText("anonymous:cleared")).toBeTruthy();
  });
  it("preserves login inputs after invalid credentials without redirecting", async () => {
    vi.stubGlobal("fetch", vi.fn(async (path: string) => path.endsWith("/me")
      ? json(error("尚未登入", "UNAUTHENTICATED"), 401)
      : json(error("登入失敗，請確認帳號密碼", "INVALID_CREDENTIALS"), 401)));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<LoginPage />, { wrapper: wrapper(client) });
    fireEvent.change(await screen.findByLabelText("帳號", { exact: false }), { target: { value: "wrong" } });
    fireEvent.change(screen.getByLabelText("密碼", { exact: false }), { target: { value: "wrong-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "登入" }).closest("form")!);
    expect(await screen.findByText("登入失敗，請確認帳號密碼")).toBeTruthy();
    expect((screen.getByLabelText("帳號", { exact: false }) as HTMLInputElement).value).toBe("wrong");
    expect((screen.getByLabelText("密碼", { exact: false }) as HTMLInputElement).value).toBe("wrong-password");
  });

  it("navigates to the home page after successful login", async () => {
    vi.stubGlobal("fetch", vi.fn(async (path: string) => path.endsWith("/me")
      ? json(error("尚未登入", "UNAUTHENTICATED"), 401) : json(admin)));
    const client = new QueryClient();
    render(<Routes><Route path="/login" element={<LoginPage />} /><Route path="/" element={<div>登入後首頁</div>} /></Routes>, { wrapper: wrapper(client) });
    fireEvent.change(await screen.findByLabelText("帳號", { exact: false }), { target: { value: "manager" } });
    fireEvent.change(screen.getByLabelText("密碼", { exact: false }), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: "登入" }).closest("form")!);
    expect(await screen.findByText("登入後首頁")).toBeTruthy();
  });

  it("clears operational caches when switching identities and logging out", async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.inventory.all, { private: true });
    client.setQueryData(queryKeys.auth.all, staff);
    vi.stubGlobal("fetch", vi.fn(async (path: string) => path.endsWith("logout") ? new Response(null, { status: 204 }) : json(admin)));
    const login = renderHook(() => useLogin(), { wrapper: wrapper(client) });
    await act(async () => { await login.result.current.mutateAsync({ username: "manager", password: "password123" }); });
    expect(client.getQueryData(queryKeys.inventory.all)).toBeUndefined();
    expect(client.getQueryData(queryKeys.auth.all)).toEqual(admin);
    client.setQueryData(queryKeys.employees.all, { private: true });
    const logout = renderHook(() => useLogout(), { wrapper: wrapper(client) });
    await act(async () => { await logout.result.current.mutateAsync(); });
    expect(client.getQueryData(queryKeys.employees.all)).toBeUndefined();
    expect(client.getQueryData(queryKeys.auth.all)).toBeNull();
  });
});

describe("employee management", () => {
  it.each(["demotion", "deactivation", "password reset"])("redirects successful self-%s and removes operational caches", async (operation) => {
    let revoked = false;
    vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit) => {
      if (path.endsWith("/me")) return revoked ? json(error("尚未登入", "UNAUTHENTICATED"), 401) : json(admin);
      if (options.method === "PATCH") {
        revoked = true;
        return json({ ...admin, ...JSON.parse(options.body as string) });
      }
      if (options.method === "POST") { revoked = true; return new Response(null, { status: 204 }); }
      return json({ items: [admin], total: 1, page: 1, page_size: 20 });
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(queryKeys.auth.all, admin);
    client.setQueryData(queryKeys.inventory.all, { private: true });
    client.setQueryData(queryKeys.reports.all, { private: true });
    render(<Routes><Route path="/login" element={<LoginPage />} /><Route element={<RequireLogin />}>
      <Route path="/employees" element={<EmployeesPage />} /></Route></Routes>,
    { wrapper: wrapper(client, "/employees") });
    if (operation === "password reset") {
      fireEvent.click(await screen.findByRole("button", { name: "重設 manager 密碼" }));
      const dialog = within(await screen.findByRole("dialog"));
      fireEvent.change(dialog.getByLabelText(/^新密碼/), { target: { value: "new-password" } });
      fireEvent.change(dialog.getByLabelText(/^再次輸入新密碼/), { target: { value: "new-password" } });
      fireEvent.click(dialog.getByLabelText("我了解影響，確認重設密碼"));
      fireEvent.submit(dialog.getByRole("button", { name: "確認重設密碼" }).closest("form")!);
    } else {
      fireEvent.click(await screen.findByRole("button", { name: "編輯 manager" }));
      const dialog = within(await screen.findByRole("dialog"));
      if (operation === "deactivation") fireEvent.click(dialog.getByLabelText("啟用帳號"));
      else {
        fireEvent.click(dialog.getByRole("combobox", { name: /^角色/ }));
        fireEvent.click(await screen.findByRole("option", { name: "一般員工" }));
      }
      fireEvent.click(dialog.getByLabelText("我了解影響，確認變更"));
      fireEvent.submit(dialog.getByRole("button", { name: "儲存" }).closest("form")!);
    }
    expect(await screen.findByRole("heading", { name: "登入帳號" })).toBeTruthy();
    expect(client.getQueryData(queryKeys.inventory.all)).toBeUndefined();
    expect(client.getQueryData(queryKeys.reports.all)).toBeUndefined();
    // A disabled observer may recreate an empty query while the guard unmounts it.
    expect(client.getQueriesData({ queryKey: queryKeys.employees.all })
      .every(([, data]) => data === undefined)).toBe(true);
    expect(client.getQueryData(queryKeys.auth.all)).toBeNull();
  });
  it("denies staff and never fetches the management API", async () => {
    const fetchMock = vi.fn(async (path: string) => path.endsWith("/me") ? json(staff) : json({}, 403));
    vi.stubGlobal("fetch", fetchMock);
    renderPage(<EmployeesPage />, staff);
    expect(await screen.findByText("只有管理者可以管理員工帳號。")).toBeTruthy();
    expect(fetchMock.mock.calls.every(([path]) => !String(path).includes("/employees"))).toBe(true);
  });

  it("keeps create form values and shows field errors when save fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit) => {
      if (path.endsWith("/me")) return json(admin);
      if (options.method === "POST") return json(error("帳號已存在", "DUPLICATE", [{ field: "username", message: "請使用其他帳號" }]), 409);
      return json({ items: [admin], total: 1, page: 1, page_size: 20 });
    }));
    renderPage(<EmployeesPage />);
    fireEvent.click(screen.getByRole("button", { name: "新增員工" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText(/^帳號/), { target: { value: "manager" } });
    fireEvent.change(dialog.getByLabelText(/^姓名/), { target: { value: "新人" } });
    fireEvent.change(dialog.getByLabelText(/^初始密碼/), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: "儲存" }).closest("form")!);
    expect(await screen.findByText("帳號已存在")).toBeTruthy();
    expect(screen.getByText("請使用其他帳號")).toBeTruthy();
    expect((dialog.getByLabelText(/^姓名/) as HTMLInputElement).value).toBe("新人");
    expect((dialog.getByLabelText(/^初始密碼/) as HTMLInputElement).value).toBe("password123");
  });

  it("requires explicit confirmation for deactivation", async () => {
    vi.stubGlobal("fetch", vi.fn(async (path: string) => path.endsWith("/me") ? json(admin)
      : json({ items: [staff], total: 1, page: 1, page_size: 20 })));
    renderPage(<EmployeesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "編輯 staff" }));
    fireEvent.click(await screen.findByLabelText("啟用帳號"));
    const save = screen.getByRole("button", { name: "儲存" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByText(/停用或降權將使此員工現有登入立即失效/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("我了解影響，確認變更"));
    expect(save.disabled).toBe(false);
  });

  it("shows empty results and sends search/role/status filters with pagination reset", async () => {
    const fetchMock = vi.fn(async (path: string) => path.endsWith("/me") ? json(admin)
      : json({ items: [], total: 21, page: Number(new URL(path, "http://localhost").searchParams.get("page")), page_size: 20 }));
    vi.stubGlobal("fetch", fetchMock);
    renderPage(<EmployeesPage />);
    expect(await screen.findByText("沒有符合條件的員工，請調整搜尋或篩選條件。")).toBeTruthy();
    expect((screen.getByLabelText("搜尋帳號或姓名") as HTMLInputElement).maxLength).toBe(100);
    async function goToSecondPage() {
      fireEvent.click(await screen.findByRole("button", { name: "2" }));
      await waitFor(() => expect(new URL(fetchMock.mock.calls.at(-1)![0], "http://localhost").searchParams.get("page")).toBe("2"));
    }
    await goToSecondPage();
    fireEvent.change(screen.getByLabelText("搜尋帳號或姓名"), { target: { value: "王" } });
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)![0]).toContain("page=1&page_size=20&search=%E7%8E%8B"));
    await goToSecondPage();
    fireEvent.click(screen.getByRole("combobox", { name: "角色篩選" }));
    fireEvent.click(await screen.findByRole("option", { name: "一般員工" }));
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)![0]).toContain("page=1&page_size=20&search=%E7%8E%8B&role=STAFF"));
    await goToSecondPage();
    fireEvent.click(screen.getByRole("combobox", { name: "狀態篩選" }));
    fireEvent.click(await screen.findByRole("option", { name: "停用" }));
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)![0]).toContain("page=1&page_size=20&search=%E7%8E%8B&role=STAFF&is_active=false"));
  });

  it("returns to page one after editing the last match on page two", async () => {
    let saved = false;
    const fetchMock = vi.fn(async (path: string, options: RequestInit) => {
      if (path.endsWith("/me")) return json(admin);
      if (options.method === "PATCH") { saved = true; return json({ ...staff, is_active: false }); }
      const page = Number(new URL(path, "http://localhost").searchParams.get("page"));
      return json({ items: saved && page === 2 ? [] : [page === 2 ? staff : admin],
        total: saved ? 20 : 21, page, page_size: 20 });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(<EmployeesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "2" }));
    fireEvent.click(await screen.findByRole("button", { name: "編輯 staff" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByLabelText("啟用帳號"));
    fireEvent.click(dialog.getByLabelText("我了解影響，確認變更"));
    fireEvent.submit(dialog.getByRole("button", { name: "儲存" }).closest("form")!);
    expect(await screen.findByText("員工資料已儲存")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "編輯 manager" })).toBeTruthy();
    expect(new URL(fetchMock.mock.calls.at(-1)![0], "http://localhost").searchParams.get("page")).toBe("1");
    expect(screen.queryByText("沒有符合條件的員工，請調整搜尋或篩選條件。")).toBeNull();
  });

  it("recovers the employee list after retry", async () => {
    let failed = true;
    vi.stubGlobal("fetch", vi.fn(async (path: string) => {
      if (path.endsWith("/me")) return json(admin);
      if (failed) return json(error("暫時無法載入", "INTERNAL_ERROR"), 500);
      return json({ items: [staff], total: 1, page: 1, page_size: 20 });
    }));
    renderPage(<EmployeesPage />);
    expect(await screen.findByText("暫時無法載入")).toBeTruthy();
    failed = false;
    fireEvent.click(screen.getByRole("button", { name: "重新載入" }));
    expect(await screen.findByRole("button", { name: "編輯 staff" })).toBeTruthy();
  });

  it("keeps the reset password form on a server failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit) => {
      if (path.endsWith("/me")) return json(admin);
      if (options.method === "POST") return json(error("重設暫時失敗", "INTERNAL_ERROR"), 500);
      return json({ items: [staff], total: 1, page: 1, page_size: 20 });
    }));
    renderPage(<EmployeesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "重設 staff 密碼" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText(/^新密碼/), { target: { value: "new-password" } });
    fireEvent.change(dialog.getByLabelText(/^再次輸入新密碼/), { target: { value: "new-password" } });
    fireEvent.click(dialog.getByLabelText("我了解影響，確認重設密碼"));
    fireEvent.submit(dialog.getByRole("button", { name: "確認重設密碼" }).closest("form")!);
    expect(await screen.findByText("重設暫時失敗")).toBeTruthy();
    expect((dialog.getByLabelText(/^新密碼/) as HTMLInputElement).value).toBe("new-password");
  });
});
