import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routes } from "../shared/routes";
import { admin, renderApp, staff } from "../test/renderApp";

const MASTER_DATA = ["食材", "分類", "供應商", "儲存位置"];

function nav() {
  return screen.getByRole("navigation", { name: "主要導覽" });
}
function navLabels() {
  return Array.from(nav().querySelectorAll("a, button")).map((item) => item.textContent?.trim());
}
function expandMasterData() {
  const group = within(nav()).getByRole("button", { name: "基本資料" });
  if (group.getAttribute("aria-expanded") !== "true") fireEvent.click(group);
}
/** 依查詢字串中的 min-width（em，以 16px 計）模擬指定視窗寬度。 */
function setViewportWidth(width: number) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: (() => {
      const min = /min-width:\s*([\d.]+)em/.exec(query);
      return min ? width >= Number(min[1]) * 16 : false;
    })(),
    media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

afterEach(() => vi.restoreAllMocks());

describe("AppLayout navigation", () => {
  it("lists every item in order for managers", async () => {
    renderApp(routes.home, admin);
    await screen.findByRole("heading", { level: 1, name: "預警首頁" });
    expandMasterData();
    expect(navLabels()).toEqual([
      "預警首頁", "庫存", "進貨", "領用", "報廢", "盤點", "異動與統計", "基本資料", ...MASTER_DATA, "員工帳號",
    ]);
  });

  it("hides stocktake and employee accounts from staff but keeps master data for lookup", async () => {
    renderApp(routes.home, staff);
    await screen.findByRole("heading", { level: 1, name: "預警首頁" });
    expandMasterData();
    expect(navLabels()).toEqual(["預警首頁", "庫存", "進貨", "領用", "報廢", "異動與統計", "基本資料", ...MASTER_DATA]);
  });

  it("marks the current item and matches the home item exactly", async () => {
    renderApp(routes.inventory);
    await screen.findByRole("heading", { level: 1, name: "庫存" });
    expect(within(nav()).getByRole("link", { name: "庫存" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav()).getByRole("link", { name: "預警首頁" }).getAttribute("aria-current")).toBeNull();
  });

  it("opens the master data group when a child page is loaded directly", async () => {
    renderApp(routes.suppliers);
    await screen.findByRole("heading", { level: 1, name: "供應商" });
    expect(within(nav()).getByRole("button", { name: "基本資料" }).getAttribute("aria-expanded")).toBe("true");
    expect(within(nav()).getByRole("link", { name: "供應商" }).getAttribute("aria-current")).toBe("page");
  });

  it("starts open on a 1024px tablet and can collapse", async () => {
    setViewportWidth(1024);
    renderApp(routes.home);
    await screen.findByRole("heading", { level: 1, name: "預警首頁" });
    expect(nav().hasAttribute("inert")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "收合導覽列" }));
    expect(nav().hasAttribute("inert")).toBe(true);
    const expand = screen.getByRole("button", { name: "展開導覽列" });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(expand);
    expect(nav().hasAttribute("inert")).toBe(false);
  });

  it("starts closed on narrow screens and closes after choosing an item", async () => {
    renderApp(routes.home);
    await screen.findByRole("heading", { level: 1, name: "預警首頁" });
    expect(nav().hasAttribute("inert")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "展開導覽列" }));
    expect(nav().hasAttribute("inert")).toBe(false);
    fireEvent.click(within(nav()).getByRole("link", { name: "庫存" }));
    expect(await screen.findByRole("heading", { level: 1, name: "庫存" })).toBeTruthy();
    expect(nav().hasAttribute("inert")).toBe(true);
  });

  it("starts closed as an overlay below 768px", async () => {
    setViewportWidth(700);
    renderApp(routes.home);
    await screen.findByRole("heading", { level: 1, name: "預警首頁" });
    expect(nav().hasAttribute("inert")).toBe(true);
    expect(screen.getByRole("button", { name: "展開導覽列" })).toBeTruthy();
  });

  it("opens the master data group when a child page is reached by in-app navigation", async () => {
    const { router } = renderApp(routes.inventory);
    await screen.findByRole("heading", { level: 1, name: "庫存" });
    const group = within(nav()).getByRole("button", { name: "基本資料" });
    expect(group.getAttribute("aria-expanded")).toBe("false");
    await act(() => router.navigate(routes.ingredients));
    expect(group.getAttribute("aria-expanded")).toBe("true");
    expect((await within(nav()).findByRole("link", { name: "食材" })).getAttribute("aria-current")).toBe("page");
  });

  it("marks the master data group when it is collapsed on one of its pages", async () => {
    renderApp(routes.suppliers);
    await screen.findByRole("heading", { level: 1, name: "供應商" });
    const group = within(nav()).getByRole("button", { name: "基本資料" });
    expect(group.hasAttribute("data-active")).toBe(false);
    fireEvent.click(group);
    expect(group.getAttribute("aria-expanded")).toBe("false");
    expect(group.hasAttribute("data-active")).toBe(true);
  });

  it("closes the overlay when the route changes outside the navigation", async () => {
    const { router } = renderApp(routes.home);
    await screen.findByRole("heading", { level: 1, name: "預警首頁" });
    fireEvent.click(screen.getByRole("button", { name: "展開導覽列" }));
    expect(nav().hasAttribute("inert")).toBe(false);
    await act(() => router.navigate(routes.reports));
    expect(nav().hasAttribute("inert")).toBe(true);
  });

  it("marks the current item regardless of URL case", async () => {
    renderApp("/Inventory");
    await screen.findByRole("heading", { level: 1, name: "庫存" });
    expect(within(nav()).getByRole("link", { name: "庫存" }).getAttribute("aria-current")).toBe("page");
  });
});

describe("AppLayout header", () => {
  it("shows the manager role", async () => {
    renderApp(routes.home, admin);
    expect(await screen.findByText("王店長 · 管理者")).toBeTruthy();
  });
  it("shows the system name, employee, role and signs out to the login page", async () => {
    renderApp(routes.home, staff);
    expect(await screen.findByText("食序 FoodFlow")).toBeTruthy();
    expect(screen.getByText("員工 · 一般員工")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "登出" }));
    expect(await screen.findByRole("heading", { name: "登入帳號" })).toBeTruthy();
  });
});
