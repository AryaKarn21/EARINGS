import React, { useState, useEffect } from "react";
import {
  Camera,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Layers,
  Settings,
  Eye,
} from "lucide-react";
import { api } from "../../api";

export default function TryOnSettingsSection({ onNavigate }) {
  const [conversion, setConversion] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getConversion().catch(() => null),
      api.adminGetProducts({ limit: 100 }).catch(() => ({ products: [] })),
    ]).then(([conv, prods]) => {
      setConversion(conv);
      setProducts(prods.products || []);
      setLoading(false);
    });
  }, []);

  const earrings = products.filter((p) => p.productType === "earrings");
  const readyCount = earrings.filter((p) => p.kind && p.color).length;
  const nonReadyCount = earrings.length - readyCount;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
          Virtual Try-On & Augmented Reality Mirror Settings
        </h2>
        <p className="text-[13px] text-textSecondary mt-0.5">
          Real-time client-side ear tracking via MediaPipe. 2D vector earring overlays with head-yaw tracking.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
          <p className="text-[12px] font-medium text-textSecondary mb-1">Try-On Ready Earrings</p>
          <p className="text-[26px] font-bold text-slate-900 leading-none">{readyCount}</p>
          <p className="text-[11.5px] text-emerald-600 mt-2">Proper silhouette vector configured</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
          <p className="text-[12px] font-medium text-textSecondary mb-1">Recorded Funnel Sessions</p>
          <p className="text-[26px] font-bold text-primaryDark leading-none">
            {conversion?.totalTryOns ?? 0}
          </p>
          <p className="text-[11.5px] text-slate-500 mt-2">Camera + photo uploads</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
          <p className="text-[12px] font-medium text-textSecondary mb-1">Cart Conversion Rate</p>
          <p className="text-[26px] font-bold text-emerald-700 leading-none">
            {conversion?.tryOnToCartRate ?? 0}%
          </p>
          <p className="text-[11.5px] text-slate-500 mt-2">Try-on to purchase velocity</p>
        </div>
      </div>

      {/* Try-on Readiness Checklist */}
      <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-primaryDark" />
            <h3 className="text-[15px] font-semibold text-slate-900">
              Virtual Try-On Asset Readiness Checker
            </h3>
          </div>
          <span className="text-[12px] text-textSecondary">
            {readyCount} of {earrings.length} earrings ready
          </span>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg border border-border space-y-2 text-[12.5px] text-textSecondary leading-relaxed">
          <p className="font-semibold text-slate-900 flex items-center gap-2">
            <CheckCircle size={15} className="text-emerald-600" /> Real-Time 2D Vector Overlay Guarantee
          </p>
          <p>
            Earrings are tracked to both ears using 478 MediaPipe facial landmarks with automatic head-yaw rotation damping.
            Each earring uses its silhouette <span className="font-mono text-slate-800">kind</span> (stud, hoop, drop, jhumka, etc.) and
            color finish. No fake 3D models or heavy downloads required.
          </p>
        </div>

        {nonReadyCount > 0 && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[12.5px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>
                {nonReadyCount} jewellery piece(s) are missing valid silhouette kind or color specifications.
              </span>
            </div>
            <button
              onClick={() => onNavigate("products")}
              className="text-[12px] font-bold text-amber-900 underline ml-2"
            >
              Fix in Catalogue
            </button>
          </div>
        )}
      </div>

      {/* Permissions and UX Guidelines */}
      <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-3">
        <h3 className="text-[14.5px] font-semibold text-slate-900 pb-2 border-b border-border">
          Camera Lifecycle & Security Rules
        </h3>
        <ul className="text-[13px] text-slate-700 space-y-2">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primaryDark mt-2" />
            <span>
              <strong>Zero Server Camera Stream:</strong> Video frames and webcam feeds run purely in the browser. Media streams are never sent or recorded on the backend.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primaryDark mt-2" />
            <span>
              <strong>Automatic Track Cleanup:</strong> Video tracks explicitly stop on modal close and route changes to immediately turn off user webcam indicators.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primaryDark mt-2" />
            <span>
              <strong>High-Res Look Compositing:</strong> When shoppers click "Save Photo", an offscreen HTML5 canvas accurately composites their video frame with earring overlays.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
