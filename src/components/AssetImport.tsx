import { useEffect, useMemo, useRef, useState } from "react";
import { downloadInventory, importLimit, previewInventory, type NewAsset } from "../utils/assetCsv";
import type { CompanyAsset } from "../types";

export default function AssetImport({ assets, save, close }: {
  assets: CompanyAsset[];
  save: (rows: NewAsset[]) => Promise<void>;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File>();
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    if (file) {
      file.text().then(text => { if (active) setSource(text); })
        .catch(() => { if (active) setError("Could not read this file."); })
        .finally(() => { if (active) setReading(false); });
    }
    return () => { active = false; };
  }, [file]);
  const preview = useMemo(() => {
    if (!file || reading) return {rows: [], message: ""};
    try { return {rows: previewInventory(source, assets), message: ""}; }
    catch (e) { return {rows: [], message: (e as Error).message}; }
  }, [source, assets, file, reading]);
  const invalid = preview.rows.filter(row => row.errors.length).length;
  const ready = preview.rows.length - invalid;
  async function confirm() {
    if (!ready || invalid || busy) return;
    setBusy(true);
    setError("");
    try { await save(preview.rows.map(r => r.payload)); close(); }
    catch (e) { setError((e as Error).message || "Import failed. Try again."); setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="import-title" onCancel={e => {e.preventDefault(); if (!busy) close();}}
    className="m-auto w-[min(94vw,52rem)] max-h-[90dvh] overflow-auto rounded-xl border border-slate-300 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/50 dark:bg-slate-900 dark:text-white">
    <h2 id="import-title" className="text-xl font-bold">Import company assets</h2>
    <p className="mt-2 text-sm">Choose a CSV with an Asset code and Name for each new asset (up to {importLimit}). Blank category, ownership, status and condition default to Other, Company-owned, Available and Good.</p>
    <button className="my-3 text-sm font-semibold underline" onClick={() => downloadInventory([])}>Download CSV template</button>
    <input type="file" accept=".csv,text/csv" disabled={busy} aria-label="Choose asset CSV" className="block w-full rounded border p-2 text-sm" onChange={e => {
      const next = e.target.files?.[0];
      setSource(""); setError(""); setFile(undefined); setReading(false);
      if (next && next.size > 2_000_000) {setError("Choose a CSV under 2 MB."); return;}
      if (next) {setReading(true); setFile(next);}
    }}/>
    {reading && <p role="status">Reading CSV…</p>}
    {(error || preview.message) && <p role="alert" className="mt-3 font-medium text-red-700 dark:text-red-300">{error || preview.message}</p>}
    {!!preview.rows.length && <>
      <p role="status" className="my-3 text-sm font-semibold">{ready} ready · {invalid} need correction</p>
      <div className="max-h-[42vh] overflow-auto rounded border"><table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800"><tr>{["Row","Code","Asset","Status","Review"].map(t => <th key={t} className="p-2">{t}</th>)}</tr></thead>
        <tbody>{preview.rows.map(({row,payload,errors}) => <tr key={row} className="border-t align-top"><td className="p-2">{row}</td><td className="p-2">{payload.assetCode}</td><td className="p-2">{payload.assetName}<small className="block">{payload.category} · {payload.ownershipType}</small></td><td className="p-2">{payload.status}</td><td className="p-2">{errors.join(" ") || "Ready"}</td></tr>)}</tbody>
      </table></div>
    </>}
    <div className="mt-4 flex justify-end gap-2">
      <button disabled={busy} className="rounded-lg border px-3 py-2" onClick={close}>Cancel</button>
      <button disabled={busy || !ready || !!invalid} onClick={confirm} className="rounded-lg bg-indigo-700 px-3 py-2 font-semibold text-white disabled:opacity-40">{busy ? "Importing…" : `Import ${ready || ""} asset${ready === 1 ? "" : "s"}`}</button>
    </div>
  </dialog>;
}
