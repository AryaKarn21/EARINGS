import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { BarChart3, TrendingUp, Sparkles, RefreshCw, Layers } from "lucide-react";
import { api } from "../../api";
import { money } from "../../ui";

const PIE_COLORS = ["#0284C7", "#0EA5E9", "#38BDF8", "#7DD3FC", "#BAE6FD", "#0369A1", "#075985"];

export default function AnalyticsSection() {
  const [loading, setLoading] = useState(true);
  const [tryOnData, setTryOnData] = useState([]);
  const [conversion, setConversion] = useState(null);
  const [faceShapes, setFaceShapes] = useState({});
  const [categories, setCategories] = useState([]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [tryOn, conv, shapes, cats] = await Promise.all([
        api.getMostTriedOn().catch(() => []),
        api.getConversion().catch(() => null),
        api.getFaceShapePopularity().catch(() => ({})),
        api.adminGetCategories().catch(() => []),
      ]);
      setTryOnData(tryOn || []);
      setConversion(conv);
      setFaceShapes(shapes || {});
      setCategories(cats || []);
    } catch (err) {
      console.error("Analytics error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const faceShapePieData = Object.entries(faceShapes).map(([name, value]) => ({
    name,
    value,
  }));

  const categoryBarData = categories.slice(0, 8).map((c) => ({
    name: c.name.split(" ")[0],
    items: c.productCount || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
            Analytics & Business Intelligence
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Aggregated metrics over customer try-on sessions, conversion funnels, face-shape AI recommendations, and catalogue distribution.
          </p>
        </div>

        <button
          onClick={loadAnalytics}
          className="p-2 border border-border rounded-lg bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          title="Refresh metrics"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* KPI Conversion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
          <p className="text-[12px] font-medium text-textSecondary mb-1">Total Try-On Sessions</p>
          <p className="text-[26px] font-bold text-slate-900 leading-none">
            {conversion?.totalTryOns ?? 0}
          </p>
          <p className="text-[11.5px] text-slate-500 mt-2">Interactive MediaPipe sessions</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
          <p className="text-[12px] font-medium text-textSecondary mb-1">Try-On → Cart Conversion</p>
          <p className="text-[26px] font-bold text-primaryDark leading-none">
            {conversion?.tryOnToCartRate ?? 0}%
          </p>
          <p className="text-[11.5px] text-slate-500 mt-2">Shoppers adding to basket post-try-on</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
          <p className="text-[12px] font-medium text-textSecondary mb-1">Try-On → Purchase Conversion</p>
          <p className="text-[26px] font-bold text-emerald-600 leading-none">
            {conversion?.tryOnToPurchaseRate ?? 0}%
          </p>
          <p className="text-[11.5px] text-slate-500 mt-2">Completed checkouts attributed to try-on</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Tried-On Pieces */}
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
            <h3 className="text-[14.5px] font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles size={16} className="text-primaryDark" /> Most Tried-On Jewellery
            </h3>
            <span className="text-[11px] font-mono text-textSecondary">Live Sessions</span>
          </div>

          <div className="h-64">
            {tryOnData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-textSecondary text-[13px]">
                No try-on sessions logged yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={tryOnData.map((t) => ({
                    name: t.product?.name ? t.product.name.slice(0, 15) + "..." : "Product",
                    tryOns: t.tryOns,
                  }))}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
                >
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="tryOns" fill="#0284C7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Face-Shape Distribution */}
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
            <h3 className="text-[14.5px] font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp size={16} className="text-primaryDark" /> Face-Shape Popularity
            </h3>
            <span className="text-[11px] font-mono text-textSecondary">AI Stylist Inputs</span>
          </div>

          <div className="h-64">
            {faceShapePieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-textSecondary text-[13px]">
                Run the AI Stylist quiz to populate face-shape distributions.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={faceShapePieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={85}
                    innerRadius={35}
                    paddingAngle={3}
                    label={{ fontSize: 11 }}
                  >
                    {faceShapePieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Catalogue Distribution by Category */}
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
            <h3 className="text-[14.5px] font-semibold text-slate-900 flex items-center gap-2">
              <Layers size={16} className="text-primaryDark" /> Inventory Distribution by Category
            </h3>
            <span className="text-[11px] font-mono text-textSecondary">Database Counts</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBarData} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="items" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
