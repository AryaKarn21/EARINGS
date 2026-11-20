import React, { useState, useRef } from "react";
import {
  Sparkles,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Trash2,
  Sliders,
  AlertTriangle,
  Check,
} from "lucide-react";
import { api } from "../../api";
import { getTransparentJewelleryImage } from "../../services/transparentJewelleryService";

const STATUS_CONFIGS = {
  ready: {
    label: "Transparent PNG ready",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  pending: {
    label: "Background removal pending",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  uploaded: {
    label: "Original uploaded",
    color: "bg-sky-50 text-sky-700 border-sky-200",
    icon: Upload,
  },
  failed: {
    label: "Background removal failed",
    color: "bg-rose-50 text-rose-700 border-rose-200",
    icon: AlertCircle,
  },
  manual_review: {
    label: "Manual review required",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    icon: AlertTriangle,
  },
};

export default function TryOnAssetManager({
  productType = "earrings",
  catalogImages = [],
  tryOnAsset = {},
  onChangeTryOnAsset,
}) {
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("earrings"); // For sets: 'necklace' | 'earrings'
  const [tolerance, setTolerance] = useState(32);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const fileInputRef = useRef(null);
  const isSet = productType === "sets";

  const currentAsset = tryOnAsset || {};
  const currentStatus = currentAsset.status || (currentAsset.transparent ? "ready" : "pending");
  const statusCfg = STATUS_CONFIGS[currentStatus] || STATUS_CONFIGS.pending;
  const StatusIcon = statusCfg.icon;

  const currentPreviewUrl = isSet
    ? activeTab === "necklace"
      ? currentAsset.necklace
      : currentAsset.earrings
    : currentAsset.transparent || currentAsset.earrings || currentAsset.necklace;

  const handleStatusChange = (newStatus) => {
    onChangeTryOnAsset({
      ...currentAsset,
      status: newStatus,
    });
  };

  const handleAssetUrlChange = (field, url, newStatus = "ready") => {
    const next = { ...currentAsset, status: newStatus };
    if (field === "both") {
      next.transparent = url;
      if (productType === "necklace") next.necklace = url;
      else next.earrings = url;
    } else {
      next[field] = url;
      if (!isSet) next.transparent = url;
    }
    onChangeTryOnAsset(next);
  };

  // Convert base64 data URL to File object for upload fallback
  const dataUrlToFile = (dataUrl, filename) => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Auto-remove background using backend Python OpenCV isolation engine
  const handleAutoRemoveBackground = async (sourceUrl) => {
    if (!sourceUrl) return;
    setProcessing(true);
    setFeedback(null);
    try {
      let uploadedUrl = null;

      // 1. Primary: Use high-precision backend Python OpenCV connected-component engine
      try {
        const res = await api.adminRemoveBackground({
          imageUrl: sourceUrl,
          tolerance,
          isStud: productType === "earrings" && currentAsset.kind === "stud",
        });
        if (res && res.url) {
          uploadedUrl = res.url;
        }
      } catch (backendErr) {
        console.warn("Backend isolation API error, falling back to client canvas:", backendErr);
      }

      // 2. Secondary fallback: client canvas segmentation
      if (!uploadedUrl) {
        const transparentDataUrl = await getTransparentJewelleryImage(sourceUrl, {
          tolerance,
          featherRadius: 1.2,
        });

        if (transparentDataUrl && transparentDataUrl.startsWith("data:image/png")) {
          const file = dataUrlToFile(transparentDataUrl, `tryon-cutout-${Date.now()}.png`);
          const formData = new FormData();
          formData.append("images", file);
          const res = await api.adminUploadImages(formData);
          uploadedUrl = res.images?.[0]?.url || transparentDataUrl;
        }
      }

      if (!uploadedUrl) {
        throw new Error("Unable to isolate background. Please try a different tolerance or upload a PNG directly.");
      }

      if (isSet) {
        handleAssetUrlChange(activeTab, uploadedUrl, "ready");
      } else if (productType === "necklace") {
        handleAssetUrlChange("necklace", uploadedUrl, "ready");
      } else {
        handleAssetUrlChange("earrings", uploadedUrl, "ready");
      }

      setFeedback({
        type: "success",
        message: "Jewellery background removed cleanly! Individual transparent cutout is ready for Virtual Try-On.",
      });
    } catch (err) {
      console.error("Auto background removal failed:", err);
      handleStatusChange("failed");
      setFeedback({
        type: "error",
        message: err.message || "Background removal failed.",
      });
    } finally {
      setProcessing(false);
    }
  };

  // Upload manually prepared transparent PNG
  const handleUploadTransparent = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/webp"].includes(file.type)) {
      alert("Please upload a transparent PNG or WebP file.");
      return;
    }

    setProcessing(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("images", file);
      const res = await api.adminUploadImages(formData);
      const uploadedUrl = res.images?.[0]?.url;

      if (uploadedUrl) {
        if (isSet) {
          handleAssetUrlChange(activeTab, uploadedUrl, "ready");
        } else if (productType === "necklace") {
          handleAssetUrlChange("necklace", uploadedUrl, "ready");
        } else {
          handleAssetUrlChange("earrings", uploadedUrl, "ready");
        }
        setFeedback({
          type: "success",
          message: "Transparent PNG uploaded and configured successfully!",
        });
      }
    } catch (err) {
      setFeedback({ type: "error", message: "Upload failed: " + err.message });
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClearAsset = () => {
    if (isSet) {
      const next = { ...currentAsset };
      delete next[activeTab];
      onChangeTryOnAsset(next);
    } else {
      onChangeTryOnAsset({
        ...currentAsset,
        transparent: null,
        earrings: null,
        necklace: null,
        status: "pending",
      });
    }
    setFeedback(null);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-[13.5px] font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles size={16} className="text-primaryDark" />
            Virtual Try-On Asset (Camera Overlay)
          </h4>
          <p className="text-[12px] text-textSecondary">
            Dedicated transparent PNG cutouts rendered over the live camera preview without rectangular white backgrounds.
          </p>
        </div>

        {/* Status Chip */}
        <div className="flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-full border text-[11.5px] font-medium flex items-center gap-1.5 ${statusCfg.color}`}>
            <StatusIcon size={13} />
            <span>{statusCfg.label}</span>
          </div>

          <select
            value={currentStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-[11.5px] border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 outline-none"
          >
            {Object.entries(STATUS_CONFIGS).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Set Tab Switcher (if Jewellery Set) */}
      {isSet && (
        <div className="flex border-b border-slate-200 bg-slate-100/50 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("necklace")}
            className={`px-4 py-2 text-[12.5px] font-medium border-b-2 transition-colors ${
              activeTab === "necklace"
                ? "border-primaryDark text-primaryDark bg-white rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            Necklace Component {currentAsset.necklace ? "✓" : ""}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("earrings")}
            className={`px-4 py-2 text-[12.5px] font-medium border-b-2 transition-colors ${
              activeTab === "earrings"
                ? "border-primaryDark text-primaryDark bg-white rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            Earrings Component {currentAsset.earrings ? "✓" : ""}
          </button>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`px-4 py-2 text-[12px] flex items-center justify-between border-b ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <Check size={14} className="text-emerald-600" /> : <AlertCircle size={14} className="text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 text-xs">
            &times;
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row gap-6 items-start">
        {/* Checkerboard Preview Area */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <div
            className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl border border-slate-300 relative flex items-center justify-center overflow-hidden shadow-inner bg-white"
            style={{
              backgroundImage: `
                linear-gradient(45deg, #cbd5e1 25%, transparent 25%),
                linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #cbd5e1 75%),
                linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)
              `,
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
            }}
          >
            {currentPreviewUrl ? (
              <img
                src={currentPreviewUrl}
                alt="Try-on asset preview"
                className="max-w-[90%] max-h-[90%] object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)] transition-all"
              />
            ) : (
              <div className="text-center p-3 text-slate-400">
                <Layers size={28} className="mx-auto mb-1 opacity-50" />
                <span className="text-[11px] block">No transparent asset configured</span>
              </div>
            )}
            {processing && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-primaryDark">
                <RefreshCw size={24} className="animate-spin" />
                <span className="text-[11px] font-semibold">Isolating jewellery...</span>
              </div>
            )}
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {currentPreviewUrl ? "Checkerboard Preview (Alpha Verified)" : "Checkerboard Preview"}
          </span>
        </div>

        {/* Controls and Operations */}
        <div className="flex-1 space-y-4 w-full">
          <div>
            <h5 className="text-[13px] font-semibold text-slate-800 mb-1">
              {isSet
                ? activeTab === "necklace"
                  ? "Necklace Component Asset"
                  : "Matching Earrings Component Asset"
                : productType === "necklace"
                ? "Necklace Try-On Overlay"
                : "Earrings Try-On Overlay"}
            </h5>
            <p className="text-[12px] text-slate-600 leading-relaxed">
              Generate an alpha-isolated individual earring from your catalogue photographs, or upload a manually prepared PNG cutout with genuine transparency.
            </p>
          </div>

          {/* Tolerance Slider */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between text-[12px] text-slate-700 mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Sliders size={13} className="text-slate-500" />
                Background Isolation Sensitivity
              </span>
              <span className="font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">
                Tol: {tolerance}
              </span>
            </div>
            <input
              type="range"
              min="15"
              max="50"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="w-full accent-primaryDark cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Crisp Edges (Low)</span>
              <span>Balanced (32)</span>
              <span>Aggressive Shadow Cut (50)</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Auto-Remove Background from Catalogue Primary */}
            <button
              type="button"
              disabled={processing || catalogImages.length === 0}
              onClick={() => handleAutoRemoveBackground(catalogImages[0])}
              className="px-3.5 py-2 bg-primaryDark text-white text-[12.5px] rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-xs"
            >
              <Sparkles size={14} className={processing ? "animate-spin" : ""} />
              {processing ? "Isolating with AI..." : "Auto-Isolate from Catalogue Image"}
            </button>

            {/* Upload Manually Prepared PNG */}
            <button
              type="button"
              disabled={processing}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 border border-slate-300 bg-white text-slate-700 text-[12.5px] rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-xs"
            >
              <Upload size={14} />
              Upload Transparent PNG
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/webp"
              hidden
              onChange={handleUploadTransparent}
            />

            {/* Clear Button */}
            {currentPreviewUrl && (
              <button
                type="button"
                onClick={handleClearAsset}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 text-[12px] rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                Clear
              </button>
            )}
          </div>

          {/* Select from existing Catalogue Images */}
          {catalogImages.length > 1 && (
            <div className="pt-2">
              <span className="text-[11.5px] font-medium text-slate-600 block mb-1.5">
                Or isolate from another catalogue photo:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {catalogImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAutoRemoveBackground(imgUrl)}
                    title={`Isolate background from photo #${idx + 1}`}
                    className="w-12 h-12 rounded border border-slate-200 overflow-hidden hover:border-primaryDark transition-colors flex-shrink-0 relative group"
                  >
                    <img src={imgUrl} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-primaryDark/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px]">
                      Use
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual URL Input Option */}
          <div className="pt-1">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Direct Transparent Asset URL (or /api/images/... path)
            </label>
            <input
              type="text"
              placeholder="/api/images/...-tryon.png"
              value={currentPreviewUrl || ""}
              onChange={(e) => {
                if (isSet) {
                  handleAssetUrlChange(activeTab, e.target.value, e.target.value ? "ready" : "pending");
                } else {
                  handleAssetUrlChange("both", e.target.value, e.target.value ? "ready" : "pending");
                }
              }}
              className="w-full text-[12px] px-3 py-1.5 border border-slate-200 rounded-lg outline-none font-mono text-slate-700 focus:border-primaryDark bg-slate-50/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
