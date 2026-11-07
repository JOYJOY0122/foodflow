import { Button, MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("shows the title as the page heading with description and actions", () => {
    render(<MantineProvider><PageHeader title="庫存" description="查看各食材庫存" actions={<Button>新增</Button>} /></MantineProvider>);
    expect(screen.getByRole("heading", { level: 1, name: "庫存" })).toBeTruthy();
    expect(screen.getByText("查看各食材庫存")).toBeTruthy();
    expect(screen.getByRole("button", { name: "新增" })).toBeTruthy();
  });

  it("renders without description or actions", () => {
    render(<MantineProvider><PageHeader title="報廢" /></MantineProvider>);
    expect(screen.getByRole("heading", { level: 1, name: "報廢" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
