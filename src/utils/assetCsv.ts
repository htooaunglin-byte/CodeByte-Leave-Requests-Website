import type { CompanyAsset } from "../types";

function quoteCell(value: string | undefined | null): string {
  const text = value ?? "";
  // Keep spreadsheet software from evaluating employee-entered text as a formula.
  const safe = /^\s*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function inventoryCsv(assets: CompanyAsset[]): string {
  const rows = [
    ["Asset code", "Name", "Category", "Brand / model", "Serial number", "Ownership", "Status",
      "Condition", "Location", "Assigned employee", "Assigned date", "Accessories", "Supplier", "Rental end"],
    ...assets.map(a => [
      a.assetCode, a.assetName, a.category, a.brandModel, a.serialNumber, a.ownershipType,
      a.status, a.condition, a.location, a.assignedEmployeeName, a.assignedDate,
      a.accessories?.join(", "), a.supplier, a.rentalEndDate,
    ]),
  ];
  return "\uFEFF" + rows.map(row => row.map(quoteCell).join(",")).join("\r\n");
}

export function downloadInventory(assets: CompanyAsset[]): void {
  const blob = new Blob([inventoryCsv(assets)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "CodeByte-assets-" + new Date().toISOString().slice(0, 10) + ".csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
