import { Paper, Table } from "@mantine/core";
import type { ReactNode } from "react";

interface DataTableProps {
  /** 表頭的 `Table.Th`。 */
  head: ReactNode;
  /** 表身的 `Table.Tr`，由呼叫端自己放（可以用 Fragment 插入展開列）。 */
  children: ReactNode;
  /** 表格的無障礙名稱（aria-label）。 */
  label?: string;
  /** 欄位多時的最小寬度；寬度不夠時表格在外框內橫向捲動，頁面本身不捲動。 */
  minWidth?: number;
}

/**
 * 資料表格（DESIGN.md › 資料表格）：只負責外框與表頭，列由呼叫端放。
 * 表頭底色、字級與列分隔線來自 theme.ts 的 Table 預設樣式，列高至少 52px（theme.css）。
 *
 * ```tsx
 * <DataTable label="R-01 的批次" head={<><Table.Th>食材</Table.Th><Table.Th ta="right">剩餘量</Table.Th></>}>
 *   {items.map((item) => <Table.Tr key={item.id}>…</Table.Tr>)}
 * </DataTable>
 * ```
 */
export function DataTable({ head, children, label, minWidth }: DataTableProps) {
  const table = <Table className="ff-data-table" aria-label={label} verticalSpacing="sm" horizontalSpacing="md"
    highlightOnHover bg="white">
    <Table.Thead><Table.Tr>{head}</Table.Tr></Table.Thead>
    <Table.Tbody>{children}</Table.Tbody>
  </Table>;
  return <Paper withBorder radius="lg" style={{ overflow: "hidden", borderColor: "var(--ff-line)" }}>
    {minWidth === undefined ? table : <Table.ScrollContainer minWidth={minWidth}>{table}</Table.ScrollContainer>}
  </Paper>;
}
