import React, { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Trash2,
  Edit,
  Search,
  RefreshCw,
  Package,
  X,
  AlertTriangle,
} from "lucide-react";
import { api } from "../../api";

const PRODUCT_TYPES = [
  "earrings",
  "necklace",
  "ring",
  "bracelet",
  "bangle",
  "pendant",
  "anklet",
  "sets",
  "other",
];

export default function CategoriesSection() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [productType, setProductType] = useState("earrings");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetCategories();
      setCategories(res || []);
    } catch (err) {
      console.error("Categories error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName("");
    setSlug("");
    setProductType("earrings");
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setProductType(cat.productType || "earrings");
    setError(null);
    setShowModal(true);
  };

  const handleNameChange = (val) => {
    setName(val);
    if (!editingCategory) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name || !slug) return;
    setBusy(true);
    setError(null);
    try {
      if (editingCategory) {
        await api.adminUpdateCategory(editingCategory.id, { name, slug, productType });
      } else {
        await api.adminCreateCategory({ name, slug, productType });
      }
      setShowModal(false);
      loadCategories();
    } catch (err) {
      setError(err.message || "Failed to save category.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;
    try {
      await api.adminDeleteCategory(cat.id);
      loadCategories();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  const filtered = categories.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase());
    const matchesType = !selectedType || c.productType === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
            Jewellery Categories & Subcategories ({categories.length})
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Organize products by jewellery silhouettes and taxonomies across earrings, necklaces, rings, and ornaments.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primaryDark text-white text-[13.5px] rounded-lg hover:bg-ink transition-colors flex items-center gap-1.5 shadow-sm font-medium"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search category name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-[12.5px] px-3 py-2 bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark"
          >
            <option value="">All Product Types</option>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>

          <button
            onClick={loadCategories}
            title="Refresh categories"
            className="p-2 border border-border rounded-lg bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
            <RefreshCw size={15} className="animate-spin text-primaryDark" /> Loading categories...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-textSecondary text-[13px]">
            No categories match your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map((cat) => (
              <div
                key={cat.id}
                className="border border-border rounded-xl p-4 bg-slate-50/50 hover:bg-white hover:border-primaryDark/60 transition-all shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-primaryDark px-2 py-0.5 rounded bg-primaryLight/60">
                      {cat.productType || "earrings"}
                    </span>
                    <span className="text-[12px] text-textSecondary flex items-center gap-1 font-medium">
                      <Package size={13} /> {cat.productCount} items
                    </span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-slate-900">{cat.name}</h3>
                  <p className="text-[11.5px] font-mono text-slate-500 mt-0.5">slug: {cat.slug}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEditModal(cat)}
                    className="px-2.5 py-1 text-[12px] text-slate-700 hover:bg-slate-200 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    disabled={cat.productCount > 0}
                    title={cat.productCount > 0 ? "Cannot delete category with active products" : "Delete category"}
                    className="p-1 text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Modal */}
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
              <h3 className="text-[16px] font-semibold text-slate-900">
                {editingCategory ? `Edit Category "${editingCategory.name}"` : "Add New Category"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-textSecondary hover:text-textPrimary"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-dangerLight border border-danger/30 rounded text-danger text-[12.5px]">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chandbali Earrings, Chain Necklaces"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full text-[13.5px] px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                  URL Slug *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. chandbali, chain-necklaces"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  className="w-full text-[13px] font-mono px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                  Jewellery Product Type *
                </label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full text-[13px] px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark bg-white capitalize"
                >
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {t}
                    </option>
                  ))}
                </select>
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
                  {busy ? "Saving..." : editingCategory ? "Save Changes" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
