import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "../../../shared/api/queryKeys";
import { HomePage } from "./HomePage";

function renderHomePage(queryClient = new QueryClient()) {
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <HomePage />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

function stubHealth(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("HomePage", () => {
  it("shows healthy status from /health", async () => {
    const fetchMock = stubHealth(200, { status: "ok", database: "ok" });

    renderHomePage();

    expect(await screen.findByText("後端正常")).toBeTruthy();
    expect(screen.getByText("資料庫連線正常")).toBeTruthy();
    expect(fetchMock.mock.calls[0]).toEqual(["/health", expect.anything()]);
  });

  it("shows degraded status when the database is down", async () => {
    stubHealth(503, { status: "degraded", database: "unavailable" });

    renderHomePage();

    expect(await screen.findByText("資料庫無法連線")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("後端異常");
  });

  it("shows an error when the backend cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    renderHomePage();

    expect(await screen.findByText("無法連線到後端服務")).toBeTruthy();
  });

  it("hides the old healthy status when a refetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: "ok", database: "ok" }), { status: 200 }),
        )
        .mockRejectedValueOnce(new TypeError("Failed to fetch")),
    );
    const queryClient = new QueryClient();
    renderHomePage(queryClient);
    expect(await screen.findByText("後端正常")).toBeTruthy();

    await act(() => queryClient.refetchQueries({ queryKey: queryKeys.health.all }));

    expect(await screen.findByText("無法連線到後端服務")).toBeTruthy();
    expect(screen.queryByText("後端正常")).toBeNull();
  });

  it("treats a non-JSON proxy error as backend failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad Gateway", { status: 502 })));

    renderHomePage();

    expect(await screen.findByText("無法連線到後端服務")).toBeTruthy();
  });
});
