import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../../../shared/api/queryKeys";
import { admin, staff } from "../../../test/renderApp";
import { StorageLocationsPage } from "./StorageLocationsPage";

const fridge = { id: 1, code: "R-01", name: "冷藏庫 A", storage_type: "REFRIGERATED",
  description: "靠門口", is_active: true };
const list = (items: unknown[]) => ({ items, total: items.length, page: 1, page_size: 20 });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const error = (code: string, message: string, fields: unknown[] = [], details = {}) =>
  ({ error: { code, message, fields, details } });

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

type Handler = (path: string, init: RequestInit) => Response | undefined;

function renderPage(employee: typeof admin, handler: Handler = () => undefined) {
  const fetchMock = vi.fn(async (path: string, init: RequestInit = {}) =>
    path.endsWith("/auth/me") ? json(employee) : handler(path, init) ?? json(list([fridge])));
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.auth.all, employee);
  client.setQueryData(queryKeys.inventory.all, { cached: true });
  render(<MantineProvider env="test"><QueryClientProvider client={client}><MemoryRouter>
    <StorageLocationsPage />
  </MemoryRouter></QueryClientProvider></MantineProvider>);
  return { client, fetchMock };
}

async function chooseStorageType(dialog: ReturnType<typeof within>, label: string) {
  fireEvent.click(dialog.getByRole("combobox", { name: /^儲存類型/ }));
  fireEvent.click(await screen.findByRole("option", { name: label }));
}

describe("StorageLocationsPage", () => {
  it("lets staff browse with Chinese storage type labels but hides write actions", async () => {
    const { fetchMock } = renderPage(staff);

    expect(await screen.findByText("冷藏庫 A")).toBeTruthy();
    const row = screen.getByText("R-01").closest("tr")!;
    expect(within(row).getByText("冷藏")).toBeTruthy();
    expect(within(row).getByText("啟用")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "新增位置" })).toBeNull();
    expect(screen.queryByRole("button", { name: "編輯 R-01" })).toBeNull();
    expect(screen.queryByRole("button", { name: "刪除 R-01" })).toBeNull();
    expect(fetchMock.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
  });

  it("creates a location and refreshes location and stock queries", async () => {
    let body: unknown;
    const { client } = renderPage(admin, (_, init) => {
      if (init.method === "POST") {
        body = JSON.parse(String(init.body));
        return json({ ...fridge, id: 2, code: "F-01", name: "冷凍庫 B", storage_type: "FROZEN",
          description: null }, 201);
      }
    });
    fireEvent.click(await screen.findByRole("button", { name: "新增位置" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText(/^位置代碼/), { target: { value: " F-01 " } });
    fireEvent.change(dialog.getByLabelText(/^名稱/), { target: { value: "冷凍庫 B" } });
    await chooseStorageType(dialog, "冷凍");
    fireEvent.submit(dialog.getByRole("button", { name: "儲存" }).closest("form")!);

    expect(await screen.findByText("儲存位置已建立")).toBeTruthy();
    expect(body).toEqual({ code: "F-01", name: "冷凍庫 B", storage_type: "FROZEN", description: null });
    await waitFor(() => expect(client.getQueryState(queryKeys.inventory.all)?.isInvalidated).toBe(true));
  });

  it("keeps the form open with inputs and marks the code field on duplicate", async () => {
    renderPage(admin, (_, init) => init.method === "POST"
      ? json(error("DUPLICATE", "位置代碼已存在", [{ field: "code", message: "位置代碼已存在，請換一個代碼" }]), 409)
      : undefined);
    fireEvent.click(await screen.findByRole("button", { name: "新增位置" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText(/^位置代碼/), { target: { value: "R-01" } });
    fireEvent.change(dialog.getByLabelText(/^名稱/), { target: { value: "重複的" } });
    await chooseStorageType(dialog, "常溫");
    fireEvent.submit(dialog.getByRole("button", { name: "儲存" }).closest("form")!);

    expect(await dialog.findByText("位置代碼已存在，請換一個代碼")).toBeTruthy();
    expect((dialog.getByLabelText(/^位置代碼/) as HTMLInputElement).value).toBe("R-01");
    expect((dialog.getByLabelText(/^名稱/) as HTMLInputElement).value).toBe("重複的");
    expect(screen.queryByText("儲存位置已建立")).toBeNull();
  });

  it("requires a storage type before sending", async () => {
    const { fetchMock } = renderPage(admin);
    fireEvent.click(await screen.findByRole("button", { name: "新增位置" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText(/^位置代碼/), { target: { value: "X" } });
    fireEvent.submit(dialog.getByRole("button", { name: "儲存" }).closest("form")!);

    expect(await dialog.findByText("請選擇儲存類型")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("shows how many batches block deactivation and keeps the location active", async () => {
    let sent: { is_active?: boolean } = {};
    renderPage(admin, (_, init) => {
      if (init.method === "PATCH") {
        sent = JSON.parse(String(init.body));
        return json(error("REFERENCED", "此位置仍有 2 個批次有剩餘量，不能停用",
          [{ field: "is_active", message: "位置上仍有剩餘庫存" }], { batch_count: 2 }), 409);
      }
    });
    fireEvent.click(await screen.findByRole("button", { name: "編輯 R-01" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByLabelText(/^啟用此位置/));
    fireEvent.submit(dialog.getByRole("button", { name: "儲存" }).closest("form")!);

    expect(await dialog.findByText("此位置仍有 2 個批次有剩餘量，不能停用")).toBeTruthy();
    expect(dialog.getByText("位置上仍有剩餘庫存")).toBeTruthy();
    expect(sent.is_active).toBe(false);
    expect((dialog.getByLabelText(/^啟用此位置/) as HTMLInputElement).checked).toBe(false);
  });

  it("explains a referenced location must be deactivated instead of deleted", async () => {
    renderPage(admin, (_, init) => init.method === "DELETE"
      ? json(error("REFERENCED", "此位置已被進貨或庫存紀錄使用，不能刪除，請改用停用"), 409)
      : undefined);
    fireEvent.click(await screen.findByRole("button", { name: "刪除 R-01" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByRole("button", { name: "確認刪除" }));

    expect(await dialog.findByText("此位置已被進貨或庫存紀錄使用，不能刪除，請改用停用")).toBeTruthy();
    expect(screen.queryByText("儲存位置已刪除")).toBeNull();
  });

  it("sends search, type and status filters as API query parameters", async () => {
    const { fetchMock } = renderPage(staff);
    await screen.findByText("冷藏庫 A");
    fireEvent.change(screen.getByLabelText("搜尋代碼或名稱"), { target: { value: " R-0 " } });
    fireEvent.click(screen.getByRole("combobox", { name: "儲存類型" }));
    fireEvent.click(await screen.findByRole("option", { name: "冷凍" }));
    fireEvent.click(screen.getByRole("combobox", { name: "狀態" }));
    fireEvent.click(await screen.findByRole("option", { name: "啟用" }));

    await waitFor(() => {
      const url = new URL(String(fetchMock.mock.calls.at(-1)![0]), "http://test");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        page: "1", page_size: "20", search: "R-0", storage_type: "FROZEN", is_active: "true",
      });
    });
  });

  it("closes the dialog and refreshes stock queries after a successful edit", async () => {
    const { client } = renderPage(admin, (_, init) => init.method === "PATCH"
      ? json({ ...fridge, is_active: false }) : undefined);
    fireEvent.click(await screen.findByRole("button", { name: "編輯 R-01" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByLabelText(/^啟用此位置/));
    fireEvent.submit(dialog.getByRole("button", { name: "儲存" }).closest("form")!);

    expect(await screen.findByText("儲存位置已更新")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(client.getQueryState(queryKeys.inventory.all)?.isInvalidated).toBe(true));
  });

  it("deletes an unreferenced location and refreshes stock queries", async () => {
    const { client } = renderPage(admin, (_, init) => init.method === "DELETE"
      ? new Response(null, { status: 204 }) : undefined);
    fireEvent.click(await screen.findByRole("button", { name: "刪除 R-01" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByRole("button", { name: "確認刪除" }));

    expect(await screen.findByText("儲存位置已刪除")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(client.getQueryState(queryKeys.inventory.all)?.isInvalidated).toBe(true));
  });
});
