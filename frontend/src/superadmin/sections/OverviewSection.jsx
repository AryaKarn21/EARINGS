import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Package,
  ShoppingBag,
  Users,
  Store,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowUpRight,
  Eye,
  Plus,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import { api } from "../../api";
import { money } from "../../ui";

export default function OverviewSection({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState("all");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminGetDashboard();
      setData(res);
    } catch (err) {
      console.error("Dashboard error:", err);
      setError(err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="py-24 text-center text-textSecondary text-[13.5px] flex items-center justify-center gap-2">
        <RefreshCw size={16} className="animate-spin text-primaryDark" /> Loading real marketplace metrics...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-dangerLight/40 border border-danger/20 rounded-xl my-6">
        <p className="text-danger font-medium text-[14px] mb-2">{error || "Failed to load metrics"}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-primaryDark text-white text-[13px] rounded hover:bg-ink transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Revenue",
      value: money(data.revenue),
      subtext: "From completed & valid orders",
      icon: DollarSign,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      target: "orders",
    },
    {
      label: "Total Orders",
      value: data.orderCount,
      subtext: `${data.recentOrders?.length || 0} recent transactions`,
      icon: ShoppingBag,
      color: "text-blue-600 bg-blue-50 border-blue-200",
      target: "orders",
    },
    {
      label: "Total Products",
      value: data.productCount,
      subtext: `${data.publishedProductCount} published • ${data.draftProductCount} draft`,
      icon: Package,
      color: "text-sky-600 bg-sky-50 border-sky-200",
      target: "products",
    },
    {
      label: "Pending Approvals",
      value: data.pendingProductCount + data.pendingSellerCount,
      subtext: `${data.pendingProductCount} products • ${data.pendingSellerCount} sellers`,
      icon: Clock,
      color: "text-amber-600 bg-amber-50 border-amber-200",
      target: data.pendingProductCount > 0 ? "products" : "sellers",
    },
    {
      label: "Active Sellers",
      value: data.sellerCount,
      subtext: `${data.pendingSellerCount} applications pending`,
      icon: Store,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
      target: "sellers",
    },
    {
      label: "Customers",
      value: data.customerCount,
      subtext: "Registered marketplace buyers",
      icon: Users,
      color: "text-violet-600 bg-violet-50 border-violet-200",
      target: "customers",
    },
    {
      label: "Inventory Alerts",
      value: data.lowStockCount + data.outOfStockCount,
      subtext: `${data.lowStockCount} low stock • ${data.outOfStockCount} out of stock`,
      icon: AlertTriangle,
      color: "text-rose-600 bg-rose-50 border-rose-200",
      target: "inventory",
    },
    {
      label: "Trending Items",
      value: data.trendingCount,
      subtext: "Algorithmically scored jewellery",
      icon: TrendingUp,
      color: "text-teal-600 bg-teal-50 border-teal-200",
      target: "trending",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Banner & Date Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-sky-50 via-white to-sky-50/50 p-6 rounded-2xl border border-sky-100 shadow-sm">
        <div>
          <h2 className="text-[22px] font-semibold text-slate-900 tracking-tight">
            Aurélie Executive Control Center
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Live operations, PostgreSQL synchronized catalog, inventory control & marketplace analytics.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="text-[12.5px] px-3 py-2 bg-white border border-border rounded-lg shadow-sm outline-none focus:border-primaryDark"
          >
            <option value="all">Lifetime Metrics</option>
            <option value="30d">Last 30 Days</option>
            <option value="7d">Last 7 Days</option>
            <option value="today">Today</option>
          </select>
          <button
            onClick={loadData}
            title="Refresh database metrics"
            className="p-2 bg-white border border-border rounded-lg hover:bg-slate-50 text-slate-700 shadow-sm transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              onClick={() => onNavigate && onNavigate(card.target)}
              className="bg-white p-5 rounded-xl border border-border hover:border-primaryDark/50 shadow-sm hover:shadow transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-medium text-textSecondary">{card.label}</span>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${card.color}`}>
                  <Icon size={18} />
                </div>
              </div>
              <div>
                <p className="text-[26px] font-bold text-slate-900 tracking-tight leading-none">
                  {card.value}
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11.5px] text-textSecondary">
                  <span>{card.subtext}</span>
                  <ArrowUpRight
                    size={14}
                    className="opacity-0 group-hover:opacity-100 text-primaryDark transition-opacity"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Launchpad Action rail */}
      <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
        <h3 className="text-[14px] font-semibold text-slate-900 mb-3">Administrative Launchpad</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-[12.5px]">
          <button
            onClick={() => onNavigate("products", { action: "create" })}
            className="p-3 border border-border rounded-lg bg-sky-50/50 hover:bg-sky-100/60 text-primaryDark font-medium flex flex-col items-center gap-1.5 transition-colors"
          >
            <Plus size={16} /> Add Product
          </button>
          <button
            onClick={() => onNavigate("images")}
            className="p-3 border border-border rounded-lg hover:bg-slate-50 text-slate-700 flex flex-col items-center gap-1.5 transition-colors"
          >
            <ImageIcon size={16} /> Image Library
          </button>
          <button
            onClick={() => onNavigate("sellers")}
            className="p-3 border border-border rounded-lg hover:bg-slate-50 text-slate-700 flex flex-col items-center gap-1.5 transition-colors"
          >
            <Store size={16} /> Manage Sellers
          </button>
          <button
            onClick={() => onNavigate("inventory")}
            className="p-3 border border-border rounded-lg hover:bg-slate-50 text-slate-700 flex flex-col items-center gap-1.5 transition-colors"
          >
            <AlertTriangle size={16} /> Check Stock
          </button>
          <button
            onClick={() => onNavigate("banners")}
            className="p-3 border border-border rounded-lg hover:bg-slate-50 text-slate-700 flex flex-col items-center gap-1.5 transition-colors"
          >
            <Sparkles size={16} /> Storefront Banners
          </button>
          <button
            onClick={() => onNavigate("settings")}
            className="p-3 border border-border rounded-lg hover:bg-slate-50 text-slate-700 flex flex-col items-center gap-1.5 transition-colors"
          >
            <CheckCircle2 size={16} /> Store Settings
          </button>
        </div>
      </div>

      {/* Two Column Section: Recent Orders & Recent Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-primaryDark" />
              <h3 className="text-[14.5px] font-semibold text-slate-900">Recent Customer Orders</h3>
            </div>
            <button
              onClick={() => onNavigate("orders")}
              className="text-[12px] text-primaryDark font-medium hover:underline flex items-center gap-0.5"
            >
              View all orders <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            {(!data.recentOrders || data.recentOrders.length === 0) ? (
              <div className="p-10 text-center text-textSecondary text-[13px]">
                No orders placed yet. As customers checkout, orders appear here in real-time.
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-textSecondary text-[11.5px] uppercase tracking-wider text-left">
                    <th className="py-2.5 px-4 font-medium">Order ID</th>
                    <th className="py-2.5 px-4 font-medium">Date</th>
                    <th className="py-2.5 px-4 font-medium">Amount</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.recentOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-[12px] text-slate-800">
                        #{ord.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4 text-textSecondary text-[12px]">
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {money(ord.total || 0)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                            ord.status === "Delivered"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : ord.status === "Processing" || ord.status === "Shipped"
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : ord.status === "Cancelled"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recently Added Products */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-primaryDark" />
              <h3 className="text-[14.5px] font-semibold text-slate-900">Recent Products & Photography</h3>
            </div>
            <button
              onClick={() => onNavigate("products")}
              className="text-[12px] text-primaryDark font-medium hover:underline flex items-center gap-0.5"
            >
              View all products <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="p-4 flex-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(data.recentProducts || []).map((p) => {
                const hasPhoto = Array.isArray(p.images) && p.images.length > 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => onNavigate("products", { editId: p.id })}
                    className="border border-border rounded-lg p-2.5 hover:border-primaryDark transition-all cursor-pointer group bg-slate-50/40"
                  >
                    <div className="relative aspect-square rounded bg-primaryLight/40 flex items-center justify-center overflow-hidden mb-2">
                      {hasPhoto ? (
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-center p-2 text-textSecondary text-[11px]">
                          <ImageIcon size={20} className="mx-auto mb-1 text-slate-400" />
                          <span>No photo</span>
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 text-[10px] bg-ink/75 text-white px-1.5 py-0.5 rounded font-mono">
                        {money(p.price)}
                      </span>
                    </div>
                    <p className="text-[12.5px] font-medium text-slate-800 truncate" title={p.name}>
                      {p.name}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-textSecondary mt-1">
                      <span className="capitalize">{p.category}</span>
                      <span className={p.stock > 0 ? "text-emerald-600" : "text-rose-600"}>
                        {p.stock} in stock
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Administrative Activity Log Stream */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-primaryDark" />
            <h3 className="text-[14.5px] font-semibold text-slate-900">Recent Administrative Audit Events</h3>
          </div>
          <button
            onClick={() => onNavigate("audit-logs")}
            className="text-[12px] text-primaryDark font-medium hover:underline flex items-center gap-0.5"
          >
            Complete Audit Log <ArrowUpRight size={13} />
          </button>
        </div>

        {(!data.recentActivities || data.recentActivities.length === 0) ? (
          <p className="text-[13px] text-textSecondary py-4 text-center">No recent administrative events logged.</p>
        ) : (
          <div className="space-y-3">
            {data.recentActivities.map((act) => (
              <div
                key={act.id}
                className="flex items-start justify-between p-3 rounded-lg bg-slate-50/70 border border-slate-100 text-[12.5px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primaryDark mt-1.5" />
                  <div>
                    <span className="font-semibold text-slate-900">{act.action}</span> on{" "}
                    <span className="font-medium text-primaryDark">{act.targetType}</span>{" "}
                    <span className="font-mono text-[11px] text-slate-500">#{act.targetId.slice(0, 8)}</span>
                    <p className="text-[11px] text-textSecondary mt-0.5">
                      Performed by <span className="font-mono">{act.actorOwnerKey.slice(0, 8)}</span> ({act.actorRole})
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
