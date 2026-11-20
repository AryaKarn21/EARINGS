import React, { useState, useEffect } from "react";
import {
  Tag,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  X,
  Percent,
  Calendar,
} from "lucide-react";
import { api } from "../../api";
import { money } from "../../ui";

export default function CouponsSection() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("percent"); // percent | amount
  const [discountValue, setDiscountValue] = useState(15);
  const [minSpend, setMinSpend] = useState(50);
  const [expiryDate, setExpiryDate] = useState("2027-12-31");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetCoupons();
      setCoupons(res || []);
    } catch (err) {
      console.error("Coupons error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!code) return;
    setBusy(true);
    try {
      await api.adminCreateCoupon({
        code,
        discountPercent: discountType === "percent" ? Number(discountValue) : null,
        discountAmount: discountType === "amount" ? Number(discountValue) : null,
        minSpend: Number(minSpend) || 0,
        expiryDate: expiryDate || null,
        active: true,
        description,
      });
      setShowModal(false);
      loadCoupons();
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (c) => {
    try {
      await api.adminUpdateCoupon(c.code, { active: !c.active });
      loadCoupons();
    } catch (err) {
      alert("Failed: " + err.message);
    }
  };

  const handleDelete = async (code) => {
    if (!window.confirm(`Delete coupon "${code}"?`)) return;
    try {
      await api.adminDeleteCoupon(code);
      loadCoupons();
    } catch (err) {
      alert("Failed: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
            Coupons & Promotional Discounts ({coupons.length})
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Configure promotional voucher codes, minimum basket thresholds, and expiration dates.
          </p>
        </div>

        <button
          onClick={() => {
            setCode("");
            setDiscountValue(15);
            setDescription("");
            setShowModal(true);
          }}
          className="px-4 py-2 bg-primaryDark text-white text-[13.5px] rounded-lg hover:bg-ink transition-colors flex items-center gap-1.5 shadow-sm font-medium"
        >
          <Plus size={16} /> Create Coupon
        </button>
      </div>

      {/* Coupons List */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
            <RefreshCw size={15} className="animate-spin text-primaryDark" /> Loading promotions...
          </div>
        ) : coupons.length === 0 ? (
          <div className="py-16 text-center text-textSecondary text-[13px]">
            No promotional coupons active. Create a new coupon to reward customers.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-textSecondary text-[11.5px] uppercase tracking-wider text-left">
                  <th className="py-3 px-4 font-medium">Coupon Code</th>
                  <th className="py-3 px-4 font-medium">Discount Value</th>
                  <th className="py-3 px-4 font-medium">Minimum Spend</th>
                  <th className="py-3 px-4 font-medium">Expires On</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {coupons.map((c) => (
                  <tr key={c.code} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                          {c.code}
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-[11.5px] text-textSecondary mt-1">{c.description}</p>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-emerald-700">
                      {c.discountPercent ? `${c.discountPercent}% OFF` : money(c.discountAmount)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {c.minSpend ? money(c.minSpend) : "No minimum"}
                    </td>

                    <td className="py-3.5 px-4 text-textSecondary text-[12px]">
                      {c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : "Never"}
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => toggleStatus(c)}
                        className={`text-[11px] px-2.5 py-0.5 rounded font-medium border transition-colors ${
                          c.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {c.active ? "ACTIVE" : "INACTIVE"}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDelete(c.code)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        title="Delete coupon"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Coupon Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[120] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_.2s_ease]"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <h3 className="text-[16px] font-semibold text-slate-900">Create Promotional Coupon</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-textSecondary hover:text-textPrimary"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                  Coupon Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LUXE20, BRIDAL50"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full text-[13.5px] font-mono px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="w-full text-[13px] px-3 py-2 border border-border rounded-lg outline-none bg-white"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="amount">Fixed Amount ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                    Value {discountType === "percent" ? "(%)" : "($)"} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={discountType === "percent" ? 100 : 10000}
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full text-[13px] px-3 py-2 border border-border rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                    Minimum Spend ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minSpend}
                    onChange={(e) => setMinSpend(e.target.value)}
                    className="w-full text-[13px] px-3 py-2 border border-border rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full text-[13px] px-3 py-2 border border-border rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. 15% off first jewellery order"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-[13px] px-3 py-2 border border-border rounded-lg outline-none"
                />
              </div>

              <div className="mt-6 pt-4 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-[13px] border border-border rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 bg-primaryDark text-white text-[13px] rounded-lg hover:bg-ink font-medium disabled:opacity-50"
                >
                  {busy ? "Creating..." : "Save Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
