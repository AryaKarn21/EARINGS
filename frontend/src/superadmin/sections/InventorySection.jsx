import React, { useState, useEffect } from "react";
import {
  Package,
  AlertTriangle,
  Search,
  RefreshCw,
  Plus,
  Minus,
  Edit,
  X,
  TrendingDown,
  DollarSign,
  CheckCircle,
} from "lucide-react";
import { api } from "../../api";
import { money } from "../../ui";

export default function InventorySection({ onNavigate }) {
  const [data, setData] = useState({ products: [], totalStockValue: 0, count: 0, lowStockThreshold: 5 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all"); // all | low | out

  // Stock Adjustment Modal
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustedStock, setAdjustedStock] = useState(0);
  const [reason, setReason] = useState("Restock delivery received");
  const [adjusting, setAdjusting] = useState(false);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetInventory({
        q: search,
        lowStockOnly: filterType === "low",
        outOfStockOnly: filterType === "out",
      });
      setData(res || { products: [], totalStockValue: 0, count: 0, lowStockThreshold: 5 });
    } catch (err) {
      console.error("Inventory error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [search, filterType]);

  const openAdjustModal = (product) => {
    setSelectedProduct(product);
    setAdjustedStock(product.stock);
    setReason("Restock delivery received");
  };

  const handleSaveStock = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setAdjusting(true);
    try {
      await api.adminAdjustInventory({
        productId: selectedProduct.id,
        newStock: Number(adjustedStock),
        reason,
      });
      setSelectedProduct(null);
      loadInventory();
    } catch (err) {
      alert("Inventory adjustment failed: " + err.message);
    } finally {
      setAdjusting(false);
    }
  };

  const lowCount = (data.products || []).filter((p) => p.lowStock).length;
  const outCount = (data.products || []).filter((p) => p.outOfStock).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
            Inventory & Stock Control
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Monitor catalogue stock levels, manage low-inventory thresholds, and record physical warehouse adjustments.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[12px] text-textSecondary font-medium">Total Inventory Value</p>
            <p className="text-[22px] font-bold text-slate-900">{money(data.totalStockValue || 0)}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[12px] text-textSecondary font-medium">Low Stock Alerts (≤ 5)</p>
            <p className="text-[22px] font-bold text-amber-600">{lowCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[12px] text-textSecondary font-medium">Out of Stock</p>
            <p className="text-[22px] font-bold text-rose-600">{outCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingDown size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-[12px]">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filterType === "all" ? "bg-white text-slate-900 shadow-sm" : "text-textSecondary hover:text-slate-900"
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setFilterType("low")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filterType === "low" ? "bg-white text-slate-900 shadow-sm" : "text-textSecondary hover:text-slate-900"
              }`}
            >
              Low Stock (≤ 5)
            </button>
            <button
              onClick={() => setFilterType("out")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filterType === "out" ? "bg-white text-slate-900 shadow-sm" : "text-textSecondary hover:text-slate-900"
              }`}
            >
              Out of Stock (0)
            </button>
          </div>

          <button
            onClick={loadInventory}
            title="Refresh stock levels"
            className="p-2 border border-border rounded-lg bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
            <RefreshCw size={15} className="animate-spin text-primaryDark" /> Checking warehouse inventory...
          </div>
        ) : data.products.length === 0 ? (
          <div className="py-16 text-center text-textSecondary text-[13px]">
            No inventory matches your search filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-textSecondary text-[11.5px] uppercase tracking-wider text-left">
                  <th className="py-3 px-4 font-medium">Product / SKU</th>
                  <th className="py-3 px-4 font-medium">Category</th>
                  <th className="py-3 px-4 font-medium">Unit Price</th>
                  <th className="py-3 px-4 font-medium">Current Stock</th>
                  <th className="py-3 px-4 font-medium">Inventory Value</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Quick Stock Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.products.map((p) => {
                  const val = p.stock * p.price;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        <p className="text-[11.5px] font-mono text-textSecondary">{p.sku || `#${p.id.slice(0, 8)}`}</p>
                      </td>

                      <td className="py-3 px-4 capitalize text-slate-700">
                        {p.productType} • {p.category}
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-900">
                        {money(p.price)}
                      </td>

                      <td className="py-3 px-4 font-bold text-[14px]">
                        <span
                          className={
                            p.stock === 0
                              ? "text-rose-600"
                              : p.stock <= 5
                              ? "text-amber-600"
                              : "text-slate-900"
                          }
                        >
                          {p.stock}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {money(val)}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded font-medium border ${
                            p.stock === 0
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : p.stock <= 5
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {p.stock === 0 ? "Out of Stock" : p.stock <= 5 ? "Low Stock" : "Healthy"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openAdjustModal(p)}
                          className="px-3 py-1 bg-slate-100 hover:bg-primaryLight text-primaryDark rounded text-[12px] font-medium transition-colors"
                        >
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-[120] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_.2s_ease]"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900">Adjust Stock</h3>
                <p className="text-[12px] text-textSecondary">{selectedProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="text-textSecondary hover:text-textPrimary"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStock} className="space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                  New Available Quantity *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustedStock((s) => Math.max(0, Number(s) - 1))}
                    className="w-9 h-9 border border-border rounded flex items-center justify-center text-slate-700 hover:bg-slate-100"
                  >
                    <Minus size={15} />
                  </button>
                  <input
                    type="number"
                    min="0"
                    required
                    value={adjustedStock}
                    onChange={(e) => setAdjustedStock(e.target.value)}
                    className="flex-1 text-[15px] font-bold text-center py-1.5 border border-border rounded outline-none focus:border-primaryDark"
                  />
                  <button
                    type="button"
                    onClick={() => setAdjustedStock((s) => Number(s) + 1)}
                    className="w-9 h-9 border border-border rounded flex items-center justify-center text-slate-700 hover:bg-slate-100"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                  Reason for Adjustment (Recorded in Audit Trail)
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full text-[13px] px-3 py-2 border border-border rounded-lg outline-none bg-white"
                >
                  <option value="Restock delivery received">Restock delivery received</option>
                  <option value="Physical count audit adjustment">Physical count audit adjustment</option>
                  <option value="Damaged / broken ornament write-off">Damaged / broken ornament write-off</option>
                  <option value="Direct supplier shipment">Direct supplier shipment</option>
                  <option value="Return to inventory">Customer return to inventory</option>
                </select>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 text-[13px] border border-border rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="px-5 py-2 bg-primaryDark text-white text-[13px] rounded-lg hover:bg-ink font-medium disabled:opacity-50"
                >
                  {adjusting ? "Saving..." : "Save Quantity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
