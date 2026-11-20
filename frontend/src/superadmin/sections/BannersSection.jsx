import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  Upload,
  RefreshCw,
  X,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
} from "lucide-react";
import { api } from "../../api";

export default function BannersSection() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("/collection");
  const [imageUrl, setImageUrl] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const loadBanners = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetBanners();
      setBanners(res || []);
    } catch (err) {
      console.error("Banners error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const openCreateModal = () => {
    setEditingBanner(null);
    setTitle("");
    setSubtitle("");
    setLinkUrl("/collection");
    setImageUrl("");
    setActive(true);
    setShowModal(true);
  };

  const openEditModal = (b) => {
    setEditingBanner(b);
    setTitle(b.title);
    setSubtitle(b.subtitle || "");
    setLinkUrl(b.linkUrl || "/collection");
    setImageUrl(b.imageUrl);
    setActive(b.active);
    setShowModal(true);
  };

  const handleUploadBannerImage = async (files) => {
    if (!files || files.length === 0) return;
    setUploadingImage(true);
    const formData = new FormData();
    formData.append("images", files[0]);
    try {
      const res = await api.adminUploadImages(formData);
      if (res.images && res.images[0]) {
        setImageUrl(res.images[0].url);
      }
    } catch (err) {
      alert("Image upload failed: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title || !imageUrl) {
      alert("Title and image are required");
      return;
    }
    setBusy(true);
    try {
      if (editingBanner) {
        await api.adminUpdateBanner(editingBanner.id, {
          title,
          subtitle,
          linkUrl,
          imageUrl,
          active,
        });
      } else {
        await api.adminCreateBanner({
          title,
          subtitle,
          linkUrl,
          imageUrl,
          active,
          position: banners.length,
        });
      }
      setShowModal(false);
      loadBanners();
    } catch (err) {
      alert("Save failed: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Delete banner "${b.title}"?`)) return;
    try {
      await api.adminDeleteBanner(b.id);
      loadBanners();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleMove = async (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= banners.length) return;
    const next = [...banners];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    setBanners(next);
    try {
      await api.adminReorderBanners(next.map((b) => b.id));
    } catch (err) {
      console.error("Reorder error:", err);
      loadBanners();
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleUploadBannerImage(e.target.files)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
            Homepage Banners & Hero Promotions ({banners.length})
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Configure featured campaign banners, seasonal showcases, and storefront promotions with real photo uploads.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primaryDark text-white text-[13.5px] rounded-lg hover:bg-ink transition-colors flex items-center gap-1.5 shadow-sm font-medium"
        >
          <Plus size={16} /> Create Banner
        </button>
      </div>

      {/* Banners Grid */}
      <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
            <RefreshCw size={15} className="animate-spin text-primaryDark" /> Loading banners...
          </div>
        ) : banners.length === 0 ? (
          <div className="py-16 text-center text-textSecondary text-[13px]">
            No banners created yet. Create a hero banner to feature on the storefront.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {banners.map((b, idx) => (
              <div
                key={b.id}
                className="border border-border rounded-xl overflow-hidden shadow-sm flex flex-col bg-slate-50/40"
              >
                {/* Banner Image Preview */}
                <div className="relative aspect-[16/7] bg-slate-900 overflow-hidden flex items-center justify-center">
                  <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover opacity-85" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-end p-4 text-white">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                      Position #{idx + 1}
                    </span>
                    <h3 className="text-[18px] font-serif font-bold text-white">{b.title}</h3>
                    {b.subtitle && <p className="text-[12px] text-white/80 line-clamp-1">{b.subtitle}</p>}
                  </div>
                  <div className="absolute top-2 right-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded shadow ${
                        b.active ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {b.active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                </div>

                {/* Banner Control Bar */}
                <div className="p-3.5 bg-white border-t border-border flex items-center justify-between text-[12.5px]">
                  <div className="flex items-center gap-1">
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, -1)}
                      className="p-1.5 border border-border rounded hover:bg-slate-50 disabled:opacity-30"
                      title="Move up in display order"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      disabled={idx === banners.length - 1}
                      onClick={() => handleMove(idx, 1)}
                      className="p-1.5 border border-border rounded hover:bg-slate-50 disabled:opacity-30"
                      title="Move down in display order"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <span className="text-[11.5px] font-mono text-textSecondary ml-2 truncate max-w-[150px]">
                      {b.linkUrl}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(b)}
                      className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 rounded font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(b)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Banner Create/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[120] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_.2s_ease]"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <h3 className="text-[16px] font-semibold text-slate-900">
                {editingBanner ? "Edit Banner" : "Create Storefront Banner"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-textSecondary hover:text-textPrimary"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                  Banner Headline *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Royal Mithila Gold Collection"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-[13.5px] px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                  Subtitle / Subheading
                </label>
                <input
                  type="text"
                  placeholder="e.g. Handcrafted filigree & heritage jhumkas for the festive season"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full text-[13px] px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                  Destination Link
                </label>
                <input
                  type="text"
                  placeholder="/collection or /collection?category=jhumka"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full text-[13px] font-mono px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark"
                />
              </div>

              {/* Image Upload Area */}
              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                  Banner Photograph *
                </label>
                <div className="border border-dashed border-border rounded-lg p-3 text-center bg-slate-50 space-y-2">
                  {imageUrl ? (
                    <div className="relative aspect-[16/7] rounded overflow-hidden bg-slate-900">
                      <img src={imageUrl} alt="Banner" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-2 right-2 px-2.5 py-1 bg-ink/80 text-white rounded text-[11px] font-medium hover:bg-ink"
                      >
                        Change Photo
                      </button>
                    </div>
                  ) : (
                    <div className="py-6">
                      <ImageIcon size={24} className="mx-auto text-slate-400 mb-1" />
                      <p className="text-[12px] text-textSecondary mb-2">Upload a banner image from your device</p>
                      <button
                        type="button"
                        disabled={uploadingImage}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-1.5 bg-primaryDark text-white text-[12.5px] rounded font-medium hover:bg-ink disabled:opacity-50"
                      >
                        {uploadingImage ? "Uploading..." : "Browse Computer"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="bannerActive"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 accent-primaryDark cursor-pointer"
                />
                <label htmlFor="bannerActive" className="text-[13px] font-medium text-slate-800 cursor-pointer">
                  Activate banner on storefront
                </label>
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
                  {busy ? "Saving..." : editingBanner ? "Save Changes" : "Create Banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
