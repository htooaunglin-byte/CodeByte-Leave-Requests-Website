import type { CompanyAsset } from "../types";

const headers = ["Asset code", "Name", "Category", "Brand / model", "Serial number", "Ownership", "Status",
      "Condition", "Location", "Assigned employee", "Assigned date", "Accessories", "Supplier", "Rental end"];

function quoteCell(value: string | undefined | null): string {
  const text = value ?? "";
  // Keep spreadsheet software from evaluating employee-entered text as a formula.
  const safe = /^\s*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function inventoryCsv(assets: CompanyAsset[]): string {
  const rows = [
    headers,
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
  link.download = assets.length === 0 ? "CodeByte-asset-template.csv" : "CodeByte-assets-" + new Date().toISOString().slice(0, 10) + ".csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type NewAsset = Omit<CompanyAsset, "id" | "createdAt" | "updatedAt">;
export const importLimit = 200;

// Consume one quoted or unquoted cell and its delimiter at a time.
function readCsv(input: string) {
  const text = input.replace(/^\uFEFF/, "");
  const cell = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\n|\r|$)/gy;
  const records: string[][] = [];
  let record: string[] = [];
  while (cell.lastIndex < text.length) {
    const match = cell.exec(text);
    if (!match) throw new Error(`Check the CSV quoting near record ${records.length + 1}.`);
    record.push((match[1]?.replaceAll('""', '"') ?? match[2]).trim());
    if (match[3] === "," && cell.lastIndex === text.length) record.push("");
    if (match[3] !== "," || cell.lastIndex === text.length) {
      records.push(record);
      record = [];
    }
  }
  return records;
}

export function previewInventory(input: string, assets: Pick<CompanyAsset, "assetCode">[]) {
  const [labels = [], ...records] = readCsv(input);
  const columns = labels.map(label => label.toLowerCase());
  for (const required of ["asset code", "name"]) {
    if (!columns.includes(required)) throw new Error(`Missing column “${required}”. Use the CSV template.`);
  }
  const supported = headers.map(label => label.toLowerCase());
  if (new Set(columns).size !== columns.length || columns.some(label => !supported.includes(label))) {
    throw new Error("Use unique column names from the CSV template.");
  }
  const rows = records.map((cells, index) => ({cells, row: index + 2})).filter(r => r.cells.some(Boolean));
  if (!rows.length || rows.length > importLimit) throw new Error(`Choose a CSV containing 1–${importLimit} assets.`);
  const counts = new Map<string, number>();
  for (const {cells} of rows) {
    const code = cells[columns.indexOf("asset code")]?.toUpperCase();
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const existing = new Set(assets.map(a => a.assetCode.trim().toUpperCase()));
  return rows.map(({cells, row}) => {
    const get = (key: string) => cells[columns.indexOf(key)] || "";
    const errors: string[] = [];
    function choice<T extends string>(key: string, options: readonly T[]): T {
      const value = get(key);
      if (!value) return options[0];
      const found = options.find(v => v.toLowerCase() === value.toLowerCase());
      if (!found) errors.push(`Use ${options.join(" or ")} for ${key}.`);
      return found ?? options[0];
    }
    const assetCode = get("asset code").toUpperCase();
    const assetName = get("name");
    if (cells.length !== columns.length) errors.push("Column count differs from header.");
    if (!assetCode || assetCode.length > 64) errors.push("Enter an asset code (1–64 characters).");
    if (!assetName || assetName.length > 200) errors.push("Enter a name (1–200 characters).");
    if (existing.has(assetCode)) errors.push("Code already in inventory.");
    if ((counts.get(assetCode) ?? 0) > 1) errors.push("Repeated code in this CSV.");
    if (get("assigned employee") || get("assigned date")) errors.push("Assign employees through the asset page.");
    const payload: NewAsset = {
      assetCode, assetName, category: choice("category", ["Other","Laptop","Monitor","Phone","Network Equipment"] as const),
      ownershipType: choice("ownership", ["Company-owned","Rented"] as const),
      condition: choice("condition", ["Good","Fair","Damaged"] as const),
      status: choice("status", ["Available","Under Maintenance"] as const),
      location: get("location"), serialNumber: get("serial number"), brandModel: get("brand / model"),
      accessories: get("accessories").split(",").map(a => a.trim()).filter(Boolean),
      supplier: get("supplier"), rentalEndDate: get("rental end"),
    };
    const end = payload.rentalEndDate;
    if (end && (!/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isFinite(Date.parse(end)) || new Date(end).toISOString().slice(0,10) !== end)) errors.push("Rental end must be a valid YYYY-MM-DD date.");
    if ((end || payload.supplier) && payload.ownershipType !== "Rented") errors.push("Set ownership to Rented for supplier or rental details.");
    return {row, payload, errors};
  });
}
