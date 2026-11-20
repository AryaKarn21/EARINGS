import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Star,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  Package,
  CheckCircle,
} from "lucide-react";
import { api } from "../../api";
import { money } from "../../ui";

export default function TrendingSection({ onNavigate }) {
  const [data, setData] = useState({ featured: [], trending: [], newArrivals: [] });
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetMerchandising();
      setData(res || { featured: [], trending: [], newArrivals: [] });
    } catch (err) {
      console.error("Merchandising error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecalcTrends = async () => {
    setRecalculating(true);
    setRecalcMsg(null);
    try {
      const res = await api.adminRecalcTrends();
      setRecalcMsg(res.message || "Recalculation finished.");
      loadData();
    } catch (err) {
      alert("Recalculation error: " + err.message);
    } finally {
      setRecalculating(false);
      setTimeout(() => setRecalcMsg(null), 3000);
    }
  };

  const toggleFeatured = async (product) => {
    try {
      await api.adminUpdateProductStatus(product.id, {
        isEditorsPick: !product.isEditorsPick,
      });
      loadData();
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
            Trending & Featured Merchandising
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Real algorithmic trend scoring based on views, cart adds, wishlists, and sales. Curate Editor's Picks for homepage spotlight.
          </p>
        </div>

        <button
          onClick={handleRecalcTrends}
          disabled={recalculating}
          className="px-4 py-2 bg-primaryDark text-white text-[13px] rounded-lg hover:bg-ink transition-colors flex items-center gap-1.5 shadow-sm font-medium"
        >
          <RefreshCw size={14} className={recalculating ? "animate-spin" : ""} />
          {recalculating ? "Recalculating..." : "Recalculate Trend Scores"}
        </button>
      </div>

      {recalcMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[13px] flex items-center gap-2">
          <CheckCircle size={15} /> {recalcMsg}
        </div>
      )}

      {/* Two Column Layout: Editor's Picks & Top Trending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Editor's Picks (Featured) */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Star size={18} className="text-amber-500 fill-amber-500" />
              <h3 className="text-[15px] font-semibold text-slate-900">
                Editor's Picks ({data.featured?.length || 0})
              </h3>
            </div>
            <button
              onClick={() => onNavigate("products")}
              className="text-[12px] text-primaryDark hover:underline"
            >
              Manage in Catalogue
            </button>
          </div>

          <p className="text-[12.5px] text-textSecondary leading-relaxed">
            These pieces receive top billing on the storefront landing page and showcase craftsmanship highlights.
          </p>

          {loading ? (
            <div className="py-12 text-center text-textSecondary text-[13px]">Loading...</div>
          ) : data.featured.length === 0 ? (
            <div className="py-12 text-center text-textSecondary text-[13px] bg-slate-50 rounded-lg">
              No products marked as Editor's Pick yet. Star products in the catalog to feature them here.
            </div>
          ) : (
            <div className="space-y-3">
              {data.featured.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-slate-300 transition-colors bg-slate-50/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-border">
                      {p.images && p.images[0] ? (
                        <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={18} className="text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-[13px]">{p.name}</p>
                      <p className="text-[11.5px] text-textSecondary">
                        {p.productType} • {p.category} • {money(p.price)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleFeatured(p)}
                    className="text-[11.5px] px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-medium"
                  >
                    Unfeature
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Trending Algorithm Rails */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-teal-600" />
              <h3 className="text-[15px] font-semibold text-slate-900">
                Algorithmic Trending Pieces ({data.trending?.length || 0})
              </h3>
            </div>
          </div>

          <p className="text-[12.5px] text-textSecondary leading-relaxed">
            Scored dynamically from actual customer views, try-on sessions, cart additions, and completed purchases.
          </p>

          {loading ? (
            <div className="py-12 text-center text-textSecondary text-[13px]">Loading...</div>
          ) : data.trending.length === 0 ? (
            <div className="py-12 text-center text-textSecondary text-[13px] bg-slate-50 rounded-lg">
              No trend signals detected yet. As shoppers interact with the storefront, scores update.
            </div>
          ) : (
            <div className="space-y-3">
              {data.trending.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-slate-50/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-border">
                      {p.images && p.images[0] ? (
                        <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={18} className="text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-[13px]">{p.name}</p>
                      <p className="text-[11.5px] text-textSecondary">
                        {p.productType} • {p.category} • {money(p.price)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[13px] font-bold text-teal-700 font-mono">
                      {Number(p.trendScore || 0).toFixed(1)}
                    </span>
                    <p className="text-[10px] text-textSecondary uppercase">Score</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
