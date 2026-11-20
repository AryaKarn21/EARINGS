import React, { useState, useEffect, useRef } from "react";
import {
  Image as ImageIcon,
  Search,
  Upload,
  Trash2,
  ExternalLink,
  Check,
  AlertTriangle,
  RefreshCw,
  Plus,
  Filter,
  Layers,
  Copy,
  Info,
} from "lucide-react";
import { api } from "../../api";

export default function ImageLibrarySection({ onNavigate }) {
  const [data, setData] = useState({ items: [], total: 0, unusedCount: 0, totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUsed, setFilterUsed] = useState("all"); // all | used | unused
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [forceDelete, setForceDelete] = useState(false);

  const fileInputRef = useRef(null);

  const loadImages = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetImages({ search, page, limit: 30 });
      setData(res || { items: [], total: 0, unusedCount: 0, totalCount: 0 });
    } catch (err) {
      console.error("Library error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, [search, page]);

  const handleUploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("images", files[i]);
    }
    try {
      await api.adminUploadImages(formData);
      loadImages();
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = (url, key) => {
    navigator.clipboard.writeText(window.location.origin + url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.adminDeleteImage(deleteTarget.key, forceDelete);
      setDeleteTarget(null);
      setForceDelete(false);
      loadImages();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const filteredItems = (data.items || []).filter((item) => {
    if (filterUsed === "used") return item.isUsed;
    if (filterUsed === "unused") return !item.isUsed;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Hidden upload input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleUploadFiles(e.target.files)}
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
            Product Photography & Media Library ({data.totalCount || 0})
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Database-persisted product photography in PostgreSQL. View usage across catalog listings and remove unused assets safely.
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-primaryDark text-white text-[13.5px] rounded-lg hover:bg-ink transition-colors flex items-center gap-1.5 shadow-sm font-medium"
        >
          {uploading ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <Upload size={15} />
          )}
          {uploading ? "Uploading..." : "Upload New Photographs"}
        </button>
      </div>

      {/* Metric summary pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[12px] text-textSecondary font-medium">Total Images in DB</p>
            <p className="text-[22px] font-bold text-slate-900">{data.totalCount || 0}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-50 text-primaryDark flex items-center justify-center">
            <ImageIcon size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[12px] text-textSecondary font-medium">Currently Used in Catalog</p>
            <p className="text-[22px] font-bold text-emerald-700">
              {(data.totalCount || 0) - (data.unusedCount || 0)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Check size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[12px] text-textSecondary font-medium">Unused Images</p>
            <p className="text-[22px] font-bold text-amber-700">{data.unusedCount || 0}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Info size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by filename or product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-[12px]">
            <button
              onClick={() => setFilterUsed("all")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filterUsed === "all" ? "bg-white text-slate-900 shadow-sm" : "text-textSecondary hover:text-slate-900"
              }`}
            >
              All ({data.items?.length || 0})
            </button>
            <button
              onClick={() => setFilterUsed("used")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filterUsed === "used" ? "bg-white text-slate-900 shadow-sm" : "text-textSecondary hover:text-slate-900"
              }`}
            >
              In Use
            </button>
            <button
              onClick={() => setFilterUsed("unused")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filterUsed === "unused" ? "bg-white text-slate-900 shadow-sm" : "text-textSecondary hover:text-slate-900"
              }`}
            >
              Unused ({data.unusedCount || 0})
            </button>
          </div>

          <button
            onClick={loadImages}
            title="Refresh library"
            className="p-2 border border-border rounded-lg bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Grid of Images */}
      <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
        {loading ? (
          <div className="py-24 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
            <RefreshCw size={15} className="animate-spin text-primaryDark" /> Loading media library from PostgreSQL...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center text-textSecondary text-[13px]">
            No photographs found matching the current filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const kbSize = (item.size / 1024).toFixed(1);
              return (
                <div
                  key={item.key}
                  className="group rounded-xl border border-border hover:border-primaryDark bg-white overflow-hidden shadow-sm hover:shadow transition-all flex flex-col"
                >
                  {/* Photo Container */}
                  <div className="relative aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                    <img
                      src={item.url}
                      alt={item.key}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Usage Badge */}
                    <div className="absolute top-2 left-2">
                      {item.isUsed ? (
                        <span className="bg-emerald-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow flex items-center gap-1">
                          <Check size={10} /> In {item.usedInProducts.length} Product{item.usedInProducts.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="bg-amber-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow">
                          Unused
                        </span>
                      )}
                    </div>

                    {/* Quick action overlay */}
                    <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        onClick={() => copyUrl(item.url, item.key)}
                        title="Copy direct image URL"
                        className="px-2.5 py-1.5 rounded bg-white text-slate-800 text-[11px] font-medium hover:bg-slate-100 flex items-center gap-1 shadow"
                      >
                        <Copy size={12} /> {copiedKey === item.key ? "Copied!" : "Copy URL"}
                      </button>
                      <button
                        onClick={() => {
                          setDeleteTarget(item);
                          setDeleteError(null);
                          setForceDelete(false);
                        }}
                        title="Delete image"
                        className="p-1.5 rounded bg-red-600 text-white hover:bg-red-700 shadow"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Metadata and Product Association Details */}
                  <div className="p-3 text-[12px] space-y-1.5 flex-1 flex flex-col justify-between bg-slate-50/50">
                    <div>
                      <p className="font-mono text-[11.5px] text-slate-800 truncate" title={item.key}>
                        {item.key}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-textSecondary mt-0.5">
                        <span>{item.mime.replace("image/", "").toUpperCase()} • {kbSize} KB</span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Referencing products list */}
                    {item.isUsed ? (
                      <div className="pt-2 border-t border-border/80">
                        <p className="text-[10.5px] font-semibold uppercase text-slate-500 tracking-wider mb-1">
                          Referenced in:
                        </p>
                        <div className="space-y-1 max-h-16 overflow-y-auto">
                          {item.usedInProducts.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => onNavigate("products", { editId: p.id })}
                              className="text-[11.5px] text-primaryDark hover:underline truncate cursor-pointer flex items-center justify-between"
                            >
                              <span className="truncate">{p.name}</span>
                              {p.isPrimary && (
                                <span className="text-[9px] bg-primaryDark/10 text-primaryDark px-1 rounded ml-1 shrink-0">
                                  Primary
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-border/80 text-[11px] text-amber-700">
                        Safe to remove without affecting any product listing.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Image Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[130] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_.2s_ease]"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle size={22} />
            </div>

            <h3 className="text-[16px] font-semibold text-slate-900 mb-1">
              Delete Photograph?
            </h3>

            <p className="text-[12.5px] font-mono text-slate-600 bg-slate-50 p-2 rounded mb-3 truncate">
              {deleteTarget.key}
            </p>

            {deleteTarget.isUsed ? (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-[12.5px] text-amber-900 space-y-2">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  Warning: Image is currently used in {deleteTarget.usedInProducts.length} product(s)
                </p>
                <p className="text-[12px] leading-relaxed">
                  Deleting this image directly will leave those products without this photograph.
                </p>
                <label className="flex items-center gap-2 pt-1 font-medium text-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceDelete}
                    onChange={(e) => setForceDelete(e.target.checked)}
                    className="w-4 h-4 accent-rose-600"
                  />
                  <span>Force delete and remove from all associated products</span>
                </label>
              </div>
            ) : (
              <p className="text-[13px] text-textSecondary leading-relaxed mb-5">
                This image is not referenced by any product in the store. It can be safely deleted.
              </p>
            )}

            {deleteError && (
              <div className="mb-4 p-3 bg-dangerLight border border-danger/30 rounded text-danger text-[12.5px]">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-[13px] border border-border rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy || (deleteTarget.isUsed && !forceDelete)}
                onClick={handleDelete}
                className="px-4 py-2 text-[13px] bg-rose-600 text-white rounded hover:bg-rose-700 font-medium disabled:opacity-40"
              >
                {deleteBusy ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
