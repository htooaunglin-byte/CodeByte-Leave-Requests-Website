import { useEffect, useRef, useState } from "react";
import { changeCategory } from "../firebase";

export default function AssetCategories({names, close}: {names: string[]; close: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [removing, setRemoving] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function save(value: string, remove: boolean) {
    setBusy(true);
    setError("");
    try {
      await changeCategory(value, remove);
      if (remove) setRemoving(""); else setName("");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="categories-title" onCancel={e => {e.preventDefault(); if (!busy) close();}}
    className="m-auto max-h-[85dvh] w-[min(94vw,28rem)] overflow-auto rounded-xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/50 dark:bg-slate-900 dark:text-white">
    <h2 id="categories-title" className="text-lg font-bold">Asset categories</h2>
    <form className="my-4 flex gap-2" onSubmit={e => {e.preventDefault(); if (name.trim()) void save(name, false);}}>
      <input aria-label="New category name" placeholder="New category name" maxLength={64} value={name} onChange={e => setName(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2" />
      <button disabled={busy || !name.trim()} className="rounded-lg bg-indigo-700 px-4 text-white disabled:opacity-50">Add</button>
    </form>
    {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    <ul className="divide-y">{names.map(item => <li key={item} className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span className="break-all">{item}</span>
      {removing === item ? <div className="w-full text-sm"><p>Remove this choice? Existing assets keep their category.</p>
        <button disabled={busy} className="mr-4 py-2 font-semibold text-rose-600" onClick={() => save(item,true)}>Confirm removal</button>
        <button disabled={busy} onClick={() => setRemoving("")}>Cancel</button></div> :
        <button disabled={busy} aria-label={`Remove category ${item}`} className="p-2 text-sm text-rose-700 dark:text-rose-300" onClick={() => setRemoving(item)}>Remove</button>}
    </li>)}</ul>
    <button disabled={busy} className="mt-4 rounded-lg border px-4 py-2" onClick={close}>Done</button>
  </dialog>;
}
