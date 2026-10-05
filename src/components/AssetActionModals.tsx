import { useState, useEffect, FormEvent } from "react";
import {
  CompanyAsset,
  AssetAssignment,
  AssetCategory,
  AssetOwnership,
  AssetStatus,
  AssetCondition,
  RentalBillingPeriod,
  TeamMember,
  getTeamMemberRank,
} from "../types";
import {
  X,
  Check,
  Plus,
  AlertTriangle,
  ShieldAlert,
  Laptop,
  UserCheck,
  RotateCcw,
  Truck,
  Archive,
  Trash2,
  Package,
} from "lucide-react";

const CATEGORIES: AssetCategory[] = ["Laptop", "Monitor", "Phone", "Network Equipment", "Other"];
const CONDITIONS: AssetCondition[] = ["Good", "Fair", "Damaged"];
const QUICK_ACCESSORIES = ["Charger", "Laptop Bag", "Mouse", "USB-C Hub", "Power Cable", "HDMI Cable"];

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ============================================================================
// 1. ADD / EDIT ASSET MODAL
// ============================================================================
interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAsset: CompanyAsset | null;
  existingAssets: CompanyAsset[];
  onSave: (payload: Omit<CompanyAsset, "id" | "createdAt" | "updatedAt">, assetId?: string) => Promise<void>;
}

export function AssetFormModal({
  isOpen,
  onClose,
  editingAsset,
  existingAssets,
  onSave,
}: AssetFormModalProps) {
  const [assetCode, setAssetCode] = useState("");
  const [assetName, setAssetName] = useState("");
  const [category, setCategory] = useState<AssetCategory>("Laptop");
  const [brandModel, setBrandModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [ownershipType, setOwnershipType] = useState<AssetOwnership>("Company-owned");
  const [accessories, setAccessories] = useState<string[]>([]);
  const [accessoryInput, setAccessoryInput] = useState("");
  const [status, setStatus] = useState<AssetStatus>("Available");
  const [condition, setCondition] = useState<AssetCondition>("Good");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // Rented fields
  const [supplier, setSupplier] = useState("");
  const [rentalStartDate, setRentalStartDate] = useState("");
  const [rentalEndDate, setRentalEndDate] = useState("");
  const [rentalCostStr, setRentalCostStr] = useState("");
  const [rentalCurrency, setRentalCurrency] = useState("MMK");
  const [rentalBillingPeriod, setRentalBillingPeriod] = useState<RentalBillingPeriod>("Monthly");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingAsset) {
      setAssetCode(editingAsset.assetCode || "");
      setAssetName(editingAsset.assetName || "");
      setCategory(editingAsset.category || "Laptop");
      setBrandModel(editingAsset.brandModel || "");
      setSerialNumber(editingAsset.serialNumber || "");
      setOwnershipType(editingAsset.ownershipType || "Company-owned");
      setAccessories(editingAsset.accessories || []);
      setAccessoryInput("");
      setStatus(editingAsset.status || "Available");
      setCondition(editingAsset.condition || "Good");
      setLocation(editingAsset.location || "");
      setNotes(editingAsset.notes || "");
      setSupplier(editingAsset.supplier || "");
      setRentalStartDate(editingAsset.rentalStartDate || "");
      setRentalEndDate(editingAsset.rentalEndDate || "");
      setRentalCostStr(
        editingAsset.rentalCost !== undefined && editingAsset.rentalCost !== null
          ? String(editingAsset.rentalCost)
          : ""
      );
      setRentalCurrency(editingAsset.rentalCurrency || "MMK");
      setRentalBillingPeriod(editingAsset.rentalBillingPeriod ?? "Monthly");
    } else {
      setAssetCode("");
      setAssetName("");
      setCategory("Laptop");
      setBrandModel("");
      setSerialNumber("");
      setOwnershipType("Company-owned");
      setAccessories([]);
      setAccessoryInput("");
      setStatus("Available");
      setCondition("Good");
      setLocation("");
      setNotes("");
      setSupplier("");
      setRentalStartDate("");
      setRentalEndDate("");
      setRentalCostStr("");
      setRentalCurrency("MMK");
      setRentalBillingPeriod("Monthly");
    }
  }, [isOpen, editingAsset]);

  if (!isOpen) return null;

  const handleAddAccessory = (item: string) => {
    const trimmed = item.trim();
    if (!trimmed) return;
    if (!accessories.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setAccessories([...accessories, trimmed]);
    }
    setAccessoryInput("");
  };

  const handleRemoveAccessory = (item: string) => {
    setAccessories(accessories.filter((a) => a !== item));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedCode = assetCode.trim().toUpperCase();
    const trimmedName = assetName.trim();

    if (!normalizedCode) {
      setError("Asset code is required (e.g. CBC-16).");
      return;
    }
    if (!trimmedName) {
      setError("Asset name is required (e.g. Lenovo ThinkPad X1 Carbon).");
      return;
    }

    const isDuplicate = existingAssets.some(
      (a) => a.id !== editingAsset?.id && a.assetCode.trim().toUpperCase() === normalizedCode
    );
    if (isDuplicate) {
      setError(`Asset code "${normalizedCode}" already exists. Please use a unique code.`);
      return;
    }

    if (
      ownershipType === "Rented" &&
      rentalStartDate &&
      rentalEndDate &&
      rentalStartDate > rentalEndDate
    ) {
      setError("Rental end date cannot be earlier than rental start date.");
      return;
    }

    const parsedCost =
      rentalCostStr.trim() !== "" && !isNaN(Number(rentalCostStr))
        ? Number(rentalCostStr)
        : null;

    // Include any pending text in the accessory input box if user didn't press Add
    let finalAccessories = [...accessories];
    if (accessoryInput.trim()) {
      const extra = accessoryInput.trim();
      if (!finalAccessories.some((a) => a.toLowerCase() === extra.toLowerCase())) {
        finalAccessories.push(extra);
      }
    }

    setSubmitting(true);
    try {
      const payload: Omit<CompanyAsset, "id" | "createdAt" | "updatedAt"> = {
        assetCode: normalizedCode,
        assetName: trimmedName,
        category,
        brandModel: brandModel.trim(),
        serialNumber: serialNumber.trim(),
        ownershipType,
        accessories: finalAccessories,
        status: editingAsset?.status === "Assigned" ? "Assigned" : status,
        condition,
        location: location.trim(),
        notes: notes.trim(),
        supplier: ownershipType === "Rented" ? supplier.trim() : "",
        rentalStartDate: ownershipType === "Rented" ? rentalStartDate : "",
        rentalEndDate: ownershipType === "Rented" ? rentalEndDate : "",
        rentalCost: ownershipType === "Rented" ? parsedCost : null,
        rentalCurrency: ownershipType === "Rented" && parsedCost !== null ? rentalCurrency : "",
        rentalBillingPeriod:
          ownershipType === "Rented" && parsedCost !== null ? rentalBillingPeriod : "",
      };

      await onSave(payload, editingAsset?.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save asset.");
    } finally {
      setSubmitting(false);
    }
  };

  const isCurrentlyAssigned = editingAsset?.status === "Assigned";

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Laptop className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            {editingAsset ? `Edit Asset (${editingAsset.assetCode})` : "Add Company Asset"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3.5 rounded-xl text-rose-900 dark:text-rose-300 text-xs flex gap-2.5 items-start">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Identification */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Asset Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CBC-16"
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono uppercase text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Asset Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Lenovo ThinkPad X1 Carbon"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Category, Brand/Model, Serial */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Brand / Model <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Lenovo Gen 11"
                value={brandModel}
                onChange={(e) => setBrandModel(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Serial Number <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. PF-3X9K21"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Ownership, Condition, Status, Location */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Ownership Type
              </label>
              <select
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value as AssetOwnership)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
              >
                <option value="Company-owned">Company-owned</option>
                <option value="Rented">Rented</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as AssetCondition)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
              >
                {CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Status
              </label>
              {isCurrentlyAssigned ? (
                <div className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/40">
                  Assigned (Use Return to change)
                </div>
              ) : (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AssetStatus)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                >
                  <option value="Available">Available</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  {ownershipType === "Rented" && (
                    <option value="Returned to Supplier">Returned to Supplier</option>
                  )}
                  <option value="Retired">Retired</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Location <span className="text-slate-400 font-normal">(Opt.)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Yangon Office"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          {/* Rented Asset Details Section */}
          {ownershipType === "Rented" && (
            <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/20 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Rental & Supplier Details (All fields optional)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Supplier / Rental Company
                  </label>
                  <input
                    type="text"
                    placeholder="Supplier name (optional)"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Rental Start Date
                  </label>
                  <input
                    type="date"
                    value={rentalStartDate}
                    onChange={(e) => setRentalStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Rental End Date
                  </label>
                  <input
                    type="date"
                    value={rentalEndDate}
                    onChange={(e) => setRentalEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Rental Cost (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Amount"
                    value={rentalCostStr}
                    onChange={(e) => setRentalCostStr(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={rentalCurrency}
                    onChange={(e) => setRentalCurrency(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 cursor-pointer"
                  >
                    <option value="MMK">MMK</option>
                    <option value="USD">USD</option>
                    <option value="SGD">SGD</option>
                    <option value="THB">THB</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Billing Period
                  </label>
                  <select
                    value={rentalBillingPeriod}
                    onChange={(e) => setRentalBillingPeriod(e.target.value as RentalBillingPeriod)}
                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 cursor-pointer"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Yearly">Yearly</option>
                    <option value="One-time">One-time</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Included Accessories */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
              Included Accessories
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Charger"
                value={accessoryInput}
                onChange={(e) => setAccessoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAccessory(accessoryInput);
                  }
                }}
                className="flex-1 px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <button
                type="button"
                onClick={() => handleAddAccessory(accessoryInput)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              >
                + Add Item
              </button>
            </div>

            {/* Quick-add buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mr-1">Quick add:</span>
              {QUICK_ACCESSORIES.map((item) => {
                const active = accessories.some((a) => a.toLowerCase() === item.toLowerCase());
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => (active ? handleRemoveAccessory(item) : handleAddAccessory(item))}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
                      active
                        ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700"
                        : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {active ? `✓ ${item}` : `+ ${item}`}
                  </button>
                );
              })}
            </div>

            {accessories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {accessories.map((acc) => (
                  <span
                    key={acc}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    {acc}
                    <button
                      type="button"
                      onClick={() => handleRemoveAccessory(acc)}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Any configuration details, warranty notes, or physical remarks..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/50 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {submitting ? "Saving..." : editingAsset ? "Save Changes" : "Create Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 2. ASSIGN ASSET MODAL
// ============================================================================
interface AssignAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedAsset?: CompanyAsset | null;
  preselectedEmployee?: TeamMember | null;
  availableAssets: CompanyAsset[];
  teamMembers: TeamMember[];
  onAssign: (params: {
    assetId: string;
    employee: TeamMember;
    assignedDate: string;
    conditionAtHandover: AssetCondition;
    accessoriesHandedOver: string[];
    assignmentNotes?: string;
  }) => Promise<void>;
}

export function AssignAssetModal({
  isOpen,
  onClose,
  preselectedAsset,
  preselectedEmployee,
  availableAssets,
  teamMembers,
  onAssign,
}: AssignAssetModalProps) {
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [assignedDate, setAssignedDate] = useState(getTodayStr());
  const [conditionAtHandover, setConditionAtHandover] = useState<AssetCondition>("Good");
  const [accessoriesHandedOver, setAccessoriesHandedOver] = useState<string[]>([]);
  const [customAccessory, setCustomAccessory] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeMembers = [...teamMembers]
    .filter((m) => m.status !== "Deactivated")
    .sort((a, b) => {
      const rA = getTeamMemberRank(a);
      const rB = getTeamMemberRank(b);
      if (rA !== rB) return rA - rB;
      return a.name.localeCompare(b.name);
    });

  const targetAsset =
    preselectedAsset || availableAssets.find((a) => a.id === selectedAssetId) || null;

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setAssignedDate(getTodayStr());
    setAssignmentNotes("");
    setCustomAccessory("");

    if (preselectedAsset) {
      setSelectedAssetId(preselectedAsset.id);
      setConditionAtHandover(preselectedAsset.condition || "Good");
      setAccessoriesHandedOver([...(preselectedAsset.accessories || [])]);
    } else {
      const firstAvail = availableAssets[0];
      setSelectedAssetId(firstAvail?.id || "");
      setConditionAtHandover(firstAvail?.condition || "Good");
      setAccessoriesHandedOver([...(firstAvail?.accessories || [])]);
    }

    if (preselectedEmployee) {
      setSelectedEmployeeId(preselectedEmployee.id);
    } else {
      setSelectedEmployeeId(activeMembers[0]?.id || "");
    }
  }, [isOpen, preselectedAsset, preselectedEmployee]);

  const handleAssetSelectionChange = (newId: string) => {
    setSelectedAssetId(newId);
    const found = availableAssets.find((a) => a.id === newId);
    if (found) {
      setConditionAtHandover(found.condition || "Good");
      setAccessoriesHandedOver([...(found.accessories || [])]);
    }
  };

  if (!isOpen) return null;

  const toggleAccessory = (acc: string) => {
    if (accessoriesHandedOver.includes(acc)) {
      setAccessoriesHandedOver(accessoriesHandedOver.filter((a) => a !== acc));
    } else {
      setAccessoriesHandedOver([...accessoriesHandedOver, acc]);
    }
  };

  const handleAddCustomAccessory = () => {
    const trimmed = customAccessory.trim();
    if (!trimmed) return;
    if (!accessoriesHandedOver.includes(trimmed)) {
      setAccessoriesHandedOver([...accessoriesHandedOver, trimmed]);
    }
    setCustomAccessory("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!targetAsset) {
      setError("Please select an available asset to assign.");
      return;
    }
    const employee =
      preselectedEmployee || teamMembers.find((m) => m.id === selectedEmployeeId);
    if (!employee) {
      setError("Please select an employee.");
      return;
    }
    if (!assignedDate) {
      setError("Assignment date is required.");
      return;
    }

    setSubmitting(true);
    try {
      await onAssign({
        assetId: targetAsset.id,
        employee,
        assignedDate,
        conditionAtHandover,
        accessoriesHandedOver,
        assignmentNotes: assignmentNotes.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to assign asset.");
    } finally {
      setSubmitting(false);
    }
  };

  const allCandidateAccessories = Array.from(
    new Set([...(targetAsset?.accessories || []), ...accessoriesHandedOver])
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Assign Asset to Employee
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3.5 rounded-xl text-rose-900 dark:text-rose-300 text-xs flex gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Asset Selection or Summary */}
          {preselectedAsset ? (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Selected Equipment
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400 mr-2">
                    {preselectedAsset.assetCode}
                  </span>
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">
                    {preselectedAsset.assetName}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {preselectedAsset.category}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Select Available Asset <span className="text-rose-500">*</span>
              </label>
              {availableAssets.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                  No available assets in inventory. Add a new asset or return an assigned asset first.
                </div>
              ) : (
                <select
                  value={selectedAssetId}
                  onChange={(e) => handleAssetSelectionChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60 cursor-pointer"
                  required
                >
                  {availableAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetCode} — {a.assetName} ({a.category}, {a.condition})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Employee Selection */}
          {preselectedEmployee ? (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Assigning To Employee
              </div>
              <div className="mt-1 font-semibold text-sm text-slate-900 dark:text-white">
                {preselectedEmployee.name}{" "}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  ({preselectedEmployee.role})
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Assign To Employee <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60 cursor-pointer"
                required
              >
                <option value="">-- Select Employee --</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Assignment Date & Handover Condition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Assignment Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Condition at Handover <span className="text-rose-500">*</span>
              </label>
              <select
                value={conditionAtHandover}
                onChange={(e) => setConditionAtHandover(e.target.value as AssetCondition)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60 cursor-pointer"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Accessories Handed Over */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
              Accessories Handed Over
            </label>
            {allCandidateAccessories.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {allCandidateAccessories.map((acc) => {
                  const checked = accessoriesHandedOver.includes(acc);
                  return (
                    <label
                      key={acc}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
                        checked
                          ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-200"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAccessory(acc)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">{acc}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                No default accessories listed on this asset. You can add items below.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Add accessory handed over (e.g. Charger)..."
                value={customAccessory}
                onChange={(e) => setCustomAccessory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomAccessory();
                  }
                }}
                className="flex-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60"
              />
              <button
                type="button"
                onClick={handleAddCustomAccessory}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Handover Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              Handover Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Optional remarks at handover..."
              value={assignmentNotes}
              onChange={(e) => setAssignmentNotes(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !targetAsset}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {submitting ? "Assigning..." : "Confirm Assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 3. RETURN ASSET MODAL
// ============================================================================
interface ReturnAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: CompanyAsset | null;
  activeAssignment?: AssetAssignment | null;
  onReturn: (params: {
    assetId: string;
    returnedDate: string;
    conditionAtReturn: AssetCondition;
    accessoriesReturned: string[];
    missingOrDamagedItems?: string;
    returnNotes?: string;
    postReturnStatus: "Available" | "Under Maintenance";
  }) => Promise<void>;
}

export function ReturnAssetModal({
  isOpen,
  onClose,
  asset,
  activeAssignment,
  onReturn,
}: ReturnAssetModalProps) {
  const [returnedDate, setReturnedDate] = useState(getTodayStr());
  const [conditionAtReturn, setConditionAtReturn] = useState<AssetCondition>("Good");
  const [accessoriesReturned, setAccessoriesReturned] = useState<string[]>([]);
  const [missingOrDamagedItems, setMissingOrDamagedItems] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [postReturnStatus, setPostReturnStatus] = useState<"Available" | "Under Maintenance">("Available");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const expectedAccessories =
    activeAssignment?.accessoriesHandedOver && activeAssignment.accessoriesHandedOver.length > 0
      ? activeAssignment.accessoriesHandedOver
      : asset?.accessories || [];

  useEffect(() => {
    if (!isOpen || !asset) return;
    setError(null);
    setReturnedDate(getTodayStr());
    setConditionAtReturn(asset.condition || "Good");
    setAccessoriesReturned([...expectedAccessories]);
    setMissingOrDamagedItems("");
    setReturnNotes("");
    setPostReturnStatus("Available");
  }, [isOpen, asset, activeAssignment]);

  if (!isOpen || !asset) return null;

  const toggleReturnedAccessory = (acc: string) => {
    if (accessoriesReturned.includes(acc)) {
      setAccessoriesReturned(accessoriesReturned.filter((a) => a !== acc));
    } else {
      setAccessoriesReturned([...accessoriesReturned, acc]);
    }
  };

  const unreturnedItems = expectedAccessories.filter((acc) => !accessoriesReturned.includes(acc));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!returnedDate) {
      setError("Return date is required.");
      return;
    }

    let finalMissing = missingOrDamagedItems.trim();
    if (unreturnedItems.length > 0 && !finalMissing) {
      finalMissing = `Missing accessories: ${unreturnedItems.join(", ")}`;
    }

    setSubmitting(true);
    try {
      await onReturn({
        assetId: asset.id,
        returnedDate,
        conditionAtReturn,
        accessoriesReturned,
        missingOrDamagedItems: finalMissing,
        returnNotes: returnNotes.trim(),
        postReturnStatus,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process asset return.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Return Asset from Employee
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3.5 rounded-xl text-rose-900 dark:text-rose-300 text-xs flex gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Summary Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                {asset.assetCode}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Assigned: {asset.assignedDate || activeAssignment?.assignedDate || "—"}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {asset.assetName}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Returning from:{" "}
              <strong className="text-slate-900 dark:text-white">
                {asset.assignedEmployeeName || activeAssignment?.employeeName || "Assigned Employee"}
              </strong>
            </div>
          </div>

          {asset.ownershipType === "Rented" && (
            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-300">
              <strong>Rented Equipment Note:</strong> Returning from an employee places this asset back into CodeByte inventory. To record returning it to the rental vendor, use the separate <em>Return to Supplier</em> action afterwards.
            </div>
          )}

          {/* Return Date & Condition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Return Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={returnedDate}
                onChange={(e) => setReturnedDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Condition Upon Return <span className="text-rose-500">*</span>
              </label>
              <select
                value={conditionAtReturn}
                onChange={(e) => {
                  const val = e.target.value as AssetCondition;
                  setConditionAtReturn(val);
                  if (val === "Damaged") {
                    setPostReturnStatus("Under Maintenance");
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60 cursor-pointer"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Accessories Returned Checklist */}
          {expectedAccessories.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                Accessories Returned (Uncheck any missing items)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {expectedAccessories.map((acc) => {
                  const checked = accessoriesReturned.includes(acc);
                  return (
                    <label
                      key={acc}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
                        checked
                          ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/70 text-emerald-950 dark:text-emerald-200"
                          : "bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleReturnedAccessory(acc)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="truncate">{acc}</span>
                    </label>
                  );
                })}
              </div>
              {unreturnedItems.length > 0 && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                  Missing from handover: {unreturnedItems.join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Missing or Damaged Items */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              Missing or Damaged Items <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Missing USB-C charger or minor screen scratch"
              value={missingOrDamagedItems}
              onChange={(e) => setMissingOrDamagedItems(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60"
            />
          </div>

          {/* Post-Return Asset Status */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
              Next Asset Status <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPostReturnStatus("Available")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  postReturnStatus === "Available"
                    ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-200"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                <div className="text-xs font-bold">Available</div>
                <div className="text-[11px] opacity-80 mt-0.5">Ready for next assignment</div>
              </button>
              <button
                type="button"
                onClick={() => setPostReturnStatus("Under Maintenance")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  postReturnStatus === "Under Maintenance"
                    ? "bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-200"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                <div className="text-xs font-bold">Under Maintenance</div>
                <div className="text-[11px] opacity-80 mt-0.5">Needs repair or inspection</div>
              </button>
            </div>
          </div>

          {/* Return Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              Return Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Any additional return remarks..."
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {submitting ? "Processing..." : "Confirm Return"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 4. RETURN TO SUPPLIER MODAL (Rented Assets Only, No Active Assignment)
// ============================================================================
interface ReturnToSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: CompanyAsset | null;
  onConfirm: (params: {
    assetId: string;
    returnedToSupplierDate: string;
    returnedToSupplierNotes?: string;
  }) => Promise<void>;
}

export function ReturnToSupplierModal({
  isOpen,
  onClose,
  asset,
  onConfirm,
}: ReturnToSupplierModalProps) {
  const [returnedDate, setReturnedDate] = useState(getTodayStr());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setReturnedDate(getTodayStr());
    setNotes("");
  }, [isOpen]);

  if (!isOpen || !asset) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm({
        assetId: asset.id,
        returnedToSupplierDate: returnedDate,
        returnedToSupplierNotes: notes.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to record supplier return.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Return Rented Asset to Supplier
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 rounded-xl text-rose-900 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
            <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {asset.assetCode} — {asset.assetName}
            </div>
            {asset.supplier && (
              <div className="text-slate-600 dark:text-slate-300">
                Supplier: <strong>{asset.supplier}</strong>
              </div>
            )}
            {asset.rentalEndDate && (
              <div className="text-slate-500 dark:text-slate-400 font-mono">
                Rental End Date: {asset.rentalEndDate}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              Supplier Return Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={returnedDate}
              onChange={(e) => setReturnedDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              Return Receipt / Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Receipt number, handover contact, or condition remarks..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Confirm Returned to Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 5. RETIRE / DELETE ASSET CONFIRMATION MODAL
// ============================================================================
interface RetireOrDeleteModalProps {
  isOpen: boolean;
  mode: "retire" | "delete";
  onClose: () => void;
  asset: CompanyAsset | null;
  hasHistory: boolean;
  onRetire: (assetId: string, reason: string) => Promise<void>;
  onDelete: (assetId: string) => Promise<void>;
}

export function RetireOrDeleteModal({
  isOpen,
  mode,
  onClose,
  asset,
  hasHistory,
  onRetire,
  onDelete,
}: RetireOrDeleteModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setReason("");
    setError(null);
  }, [isOpen, mode]);

  if (!isOpen || !asset) return null;

  const canDelete = !hasHistory && !asset.hasAssignmentHistory && asset.status !== "Assigned";

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "delete" && canDelete) {
        await onDelete(asset.id);
      } else {
        await onRetire(asset.id, reason.trim());
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Operation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              mode === "delete" && canDelete
                ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                : "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
            }`}
          >
            {mode === "delete" && canDelete ? (
              <Trash2 className="w-5 h-5" />
            ) : (
              <Archive className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {mode === "delete" && canDelete
                ? "Permanently Delete Asset?"
                : "Retire Asset from Active Inventory?"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {mode === "delete" && !canDelete
                ? "This asset has assignment history and cannot be permanently deleted. Retiring preserves historical records."
                : mode === "delete"
                ? "Only mistakenly created assets with zero assignment history can be deleted. This cannot be undone."
                : "Retiring marks this equipment as decommissioned while preserving its full assignment & audit history."}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-xs">
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
            {asset.assetCode}
          </span>{" "}
          — <strong className="text-slate-900 dark:text-white">{asset.assetName}</strong>
        </div>

        {(mode === "retire" || !canDelete) && (
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              Retirement Reason <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. End of hardware lifecycle / beyond repair"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirm}
            className={`px-4 py-2 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50 ${
              mode === "delete" && canDelete
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700"
            }`}
          >
            {submitting
              ? "Processing..."
              : mode === "delete" && canDelete
              ? "Confirm Permanent Delete"
              : "Retire Asset"}
          </button>
        </div>
      </div>
    </div>
  );
}
