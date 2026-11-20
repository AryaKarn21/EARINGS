import React, { useState, useEffect } from "react";
import {
  Store,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  Mail,
  Phone,
  Percent,
  Package,
  Eye,
  X,
  Check,
} from "lucide-react";
import { api } from "../../api";

export default function SellersSection({ onNavigate }) {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Seller Detail / Action Modal
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [commissionRate, setCommissionRate] = useState(10);
  const [actionBusy, setActionBusy] = useState(false);

  const loadSellers = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetSellers({ q: search, status: statusFilter });
      setSellers(res || []);
    } catch (err) {
      console.error("Sellers error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSellers();
  }, [search, statusFilter]);

  const openSellerModal = async (seller) => {
    setSelectedSeller(seller);
    setCommissionRate(seller.commissionRate || 10);
    setRejectionReason(seller.rejectionReason || "");
    setActionStatus(seller.status);
    setModalLoading(true);
    try {
      const res = await api.adminGetSeller(seller.id);
      setSellerProducts(res.products || []);
    } catch (err) {
      console.error("Seller detail error:", err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedSeller) return;
    setActionBusy(true);
    try {
      await api.adminUpdateSellerStatus(selectedSeller.id, {
        status: newStatus,
        rejectionReason: newStatus === "REJECTED" ? rejectionReason : null,
      });
      setSelectedSeller(null);
      loadSellers();
    } catch (err) {
      alert("Status update failed: " + err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleUpdateCommission = async () => {
    if (!selectedSeller) return;
    setActionBusy(true);
    try {
      await api.adminUpdateSellerCommission(selectedSeller.id, commissionRate);
      alert("Commission rate updated successfully.");
      loadSellers();
    } catch (err) {
      alert("Commission update failed: " + err.message);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
            Artisan & Marketplace Sellers ({sellers.length})
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Review merchant onboarding applications, inspect seller catalogues, configure commission rates, and manage accounts.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by store name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-[12.5px] px-3 py-2 bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved & Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <button
            onClick={loadSellers}
            title="Refresh sellers list"
            className="p-2 border border-border rounded-lg bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Sellers Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
            <RefreshCw size={15} className="animate-spin text-primaryDark" /> Loading sellers...
          </div>
        ) : sellers.length === 0 ? (
          <div className="py-16 text-center text-textSecondary text-[13px]">
            No sellers found matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-textSecondary text-[11.5px] uppercase tracking-wider text-left">
                  <th className="py-3 px-4 font-medium">Store & Merchant</th>
                  <th className="py-3 px-4 font-medium">Contact</th>
                  <th className="py-3 px-4 font-medium">Catalogue</th>
                  <th className="py-3 px-4 font-medium">Commission</th>
                  <th className="py-3 px-4 font-medium">Account Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sellers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                          <Store size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{s.storeName}</p>
                          <p className="text-[11.5px] text-textSecondary">Owner: {s.user?.name || "N/A"}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-textSecondary text-[12px]">
                      <div className="flex items-center gap-1.5">
                        <Mail size={12} className="text-slate-400" />
                        <span>{s.contactEmail || s.user?.email || "—"}</span>
                      </div>
                      {s.contactPhone && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Phone size={12} className="text-slate-400" />
                          <span>{s.contactPhone}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{s.productCount}</span> items
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {s.commissionRate}%
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded font-medium ${
                          s.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : s.status === "PENDING"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : s.status === "SUSPENDED"
                            ? "bg-orange-50 text-orange-700 border border-orange-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openSellerModal(s)}
                        className="px-3 py-1 bg-slate-100 hover:bg-primaryLight text-primaryDark rounded text-[12px] font-medium transition-colors"
                      >
                        Inspect & Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Seller Inspection / Review Modal */}
      {selectedSeller && (
        <div
          className="fixed inset-0 z-[120] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_.2s_ease]"
          onClick={() => setSelectedSeller(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                  <Store size={20} />
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-slate-900">{selectedSeller.storeName}</h3>
                  <p className="text-[12px] text-textSecondary">Merchant ID: {selectedSeller.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSeller(null)}
                className="text-textSecondary hover:text-textPrimary"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Profile Details */}
              <div className="grid grid-cols-2 gap-4 text-[13px] bg-slate-50 p-4 rounded-xl border border-border">
                <div>
                  <span className="text-textSecondary text-[11.5px] uppercase tracking-wider font-semibold">
                    Contact Email
                  </span>
                  <p className="font-medium text-slate-900 mt-0.5">{selectedSeller.contactEmail || "—"}</p>
                </div>
                <div>
                  <span className="text-textSecondary text-[11.5px] uppercase tracking-wider font-semibold">
                    Phone
                  </span>
                  <p className="font-medium text-slate-900 mt-0.5">{selectedSeller.contactPhone || "—"}</p>
                </div>
                <div>
                  <span className="text-textSecondary text-[11.5px] uppercase tracking-wider font-semibold">
                    Store Slug
                  </span>
                  <p className="font-mono text-slate-900 mt-0.5">{selectedSeller.slug}</p>
                </div>
                <div>
                  <span className="text-textSecondary text-[11.5px] uppercase tracking-wider font-semibold">
                    Current Status
                  </span>
                  <p className="font-semibold text-primaryDark mt-0.5">{selectedSeller.status}</p>
                </div>
              </div>

              {/* Commission Rate Setting */}
              <div className="p-4 border border-border rounded-xl space-y-2">
                <label className="block text-[13px] font-semibold text-slate-900">
                  Marketplace Commission Rate (%)
                </label>
                <div className="flex items-center gap-2 max-w-xs">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    className="w-24 text-[13px] px-3 py-1.5 border border-border rounded outline-none focus:border-primaryDark"
                  />
                  <span className="text-[13px] text-textSecondary">%</span>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleUpdateCommission}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded text-[12px] font-medium hover:bg-slate-900"
                  >
                    Save Rate
                  </button>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="space-y-3">
                <p className="text-[13px] font-semibold text-slate-900">Manage Account Approval</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={actionBusy || selectedSeller.status === "APPROVED"}
                    onClick={() => handleUpdateStatus("APPROVED")}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-medium hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <CheckCircle size={15} /> Approve Seller
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy || selectedSeller.status === "SUSPENDED"}
                    onClick={() => handleUpdateStatus("SUSPENDED")}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-[13px] font-medium hover:bg-amber-700 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <AlertTriangle size={15} /> Suspend Account
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy || selectedSeller.status === "REJECTED"}
                    onClick={() => handleUpdateStatus("REJECTED")}
                    className="px-4 py-2 bg-rose-600 text-white rounded-lg text-[13px] font-medium hover:bg-rose-700 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <XCircle size={15} /> Reject Application
                  </button>
                </div>

                {selectedSeller.status === "REJECTED" && (
                  <div>
                    <label className="block text-[12px] text-textSecondary mb-1 font-medium">
                      Rejection Reason (Recorded in merchant audit log)
                    </label>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Identity verification documentation incomplete..."
                      className="w-full text-[12.5px] p-2.5 border border-border rounded-lg outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Seller's Products Catalogue */}
              <div className="space-y-2">
                <h4 className="text-[13.5px] font-semibold text-slate-900">
                  Seller Catalog ({sellerProducts.length} items)
                </h4>
                {modalLoading ? (
                  <p className="text-[12px] text-textSecondary py-4">Loading catalogue...</p>
                ) : sellerProducts.length === 0 ? (
                  <p className="text-[12.5px] text-textSecondary bg-slate-50 p-4 rounded-lg text-center">
                    This seller has not submitted any products yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {sellerProducts.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-slate-50 text-[12.5px]"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{p.name}</p>
                          <p className="text-[11px] text-textSecondary">
                            {p.productType} • {p.category} • {p.stock} in stock
                          </p>
                        </div>
                        <span className="font-semibold">{p.price ? `$${p.price}` : "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSeller(null)}
                className="px-4 py-2 text-[13px] border border-border rounded-lg bg-white hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
