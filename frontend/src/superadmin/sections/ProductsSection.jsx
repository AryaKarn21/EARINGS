import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Star,
  Sparkles,
  TrendingUp,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Tag,
  Store,
  Layers,
  Image as ImageIcon,
} from "lucide-react";
import { api } from "../../api";
import { money } from "../../ui";
import ProductImageUploader from "../components/ProductImageUploader";
import TryOnAssetManager from "../components/TryOnAssetManager";

const JEWELLERY_TYPES = [
  { id: "earrings", label: "Earrings" },
  { id: "necklace", label: "Necklaces" },
  { id: "ring", label: "Rings" },
  { id: "bracelet", label: "Bracelets" },
  { id: "bangle", label: "Bangles" },
  { id: "pendant", label: "Pendants" },
  { id: "anklet", label: "Anklets" },
  { id: "sets", label: "Jewellery Sets" },
  { id: "other", label: "Other Ornaments" },
];

const OCCASIONS = ["Everyday", "Office", "Party", "Wedding", "Festive", "Evening", "Bridal", "Casual"];
const STYLES = ["Minimal", "Traditional", "Modern", "Bohemian", "Luxury", "Statement", "Vintage", "Cute"];
const MATERIALS = ["18K Gold Plated", "14K Solid Gold", "Sterling Silver", "Rose Gold Plated", "Platinum Plated", "Brass & Enamel", "Pearl & Gemstone"];
const COLORS = ["Gold", "Silver", "Rose Gold", "White Gold", "Pearl", "Emerald Green", "Ruby Red", "Sapphire Blue", "Multicolor"];

export default function ProductsSection({ initialAction, initialEditId }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [isPublishedFilter, setIsPublishedFilter] = useState("");
  const [sort, setSort] = useState("newest");

  // Form Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formTab, setFormTab] = useState("basic");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Form State
  const [form, setForm] = useState(getDefaultForm());

  function getDefaultForm() {
    return {
      name: "",
      sku: "",
      productType: "earrings",
      category: "stud",
      material: "18K Gold Plated",
      color: "Gold",
      stone: "—",
      style: "Minimal",
      occasion: ["Everyday"],
      price: 45,
      originalPrice: "",
      stock: 15,
      description: "",
      dimensions: "2.0cm x 1.2cm",
      weight: "3.2g",
      images: [],
      primaryImageIndex: 0,
      approvalStatus: "APPROVED",
      isPublished: true,
      isEditorsPick: false,
      sellerId: "",
      kind: "stud",
      tags: [],
    };
  }

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetProducts({
        q,
        productType: selectedType,
        category: selectedCategory,
        stockFilter,
        approvalStatus,
        isPublished: isPublishedFilter,
        sort,
        page,
        limit: 15,
      });
      setProducts(res.products || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      setCategories(res.categories || []);
    } catch (err) {
      console.error("Products error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [q, selectedType, selectedCategory, stockFilter, approvalStatus, isPublishedFilter, sort, page]);

  // Handle open by external navigation
  useEffect(() => {
    if (initialAction === "create") {
      openCreateModal();
    } else if (initialEditId) {
      api.adminGetProduct(initialEditId).then((prod) => {
        if (prod) openEditModal(prod);
      });
    }
  }, [initialAction, initialEditId]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm(getDefaultForm());
    setFormTab("basic");
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (prod) => {
    setEditingProduct(prod);
    setForm({
      ...getDefaultForm(),
      ...prod,
      originalPrice: prod.originalPrice || "",
      occasion: Array.isArray(prod.occasion) ? prod.occasion : [prod.occasion || "Everyday"],
      images: Array.isArray(prod.images) ? prod.images : [],
    });
    setFormTab("basic");
    setFormError(null);
    setShowModal(true);
  };

  const setFormField = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const toggleOccasion = (occ) => {
    setForm((prev) => {
      const current = prev.occasion || [];
      if (current.includes(occ)) {
        return { ...prev, occasion: current.filter((o) => o !== occ) };
      }
      return { ...prev, occasion: [...current, occ] };
    });
  };

  const handleAutoPrepareTryOn = async (imageUrl) => {
    if (!imageUrl) return;
    try {
      const res = await api.adminRemoveBackground({
        imageUrl,
        tolerance: 32,
        isStud: form.productType === "earrings" && form.kind === "stud",
      });
      if (res && res.url) {
        setFormField("tryOnAsset", {
          ...(form.tryOnAsset || {}),
          status: "ready",
          transparent: res.url,
          earrings: form.productType === "necklace" ? undefined : res.url,
          necklace: form.productType === "necklace" ? res.url : undefined,
          componentType: form.productType || "earrings",
        });
      }
    } catch (err) {
      console.warn("Auto try-on background removal failed:", err);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormBusy(true);

    if (!form.name || !form.category) {
      setFormError("Product name and category are required.");
      setFormBusy(false);
      return;
    }

    if (Number(form.price) < 0) {
      setFormError("Price cannot be negative.");
      setFormBusy(false);
      return;
    }

    try {
      const payload = {
        ...form,
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        stock: Math.max(0, Number(form.stock)),
        primaryImageIndex: Math.min(
          Math.max(0, Number(form.primaryImageIndex) || 0),
          Math.max(0, (form.images || []).length - 1)
        ),
      };

      if (editingProduct) {
        await api.adminUpdateProduct(editingProduct.id, payload);
      } else {
        await api.adminCreateProduct(payload);
      }

      setShowModal(false);
      loadProducts();
    } catch (err) {
      console.error("Save error:", err);
      setFormError(err.message || "Failed to save product.");
    } finally {
      setFormBusy(false);
    }
  };

  const togglePublish = async (prod) => {
    try {
      await api.adminUpdateProductStatus(prod.id, { isPublished: !prod.isPublished });
      loadProducts();
    } catch (err) {
      alert("Status update failed: " + err.message);
    }
  };

  const toggleFeatured = async (prod) => {
    try {
      await api.adminUpdateProductStatus(prod.id, { isEditorsPick: !prod.isEditorsPick });
      loadProducts();
    } catch (err) {
      alert("Featured toggle failed: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await api.adminDeleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      loadProducts();
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  // Calculate discount percentage
  const discountPercent =
    form.originalPrice && Number(form.originalPrice) > Number(form.price)
      ? Math.round((1 - Number(form.price) / Number(form.originalPrice)) * 100)
      : null;

  const primaryPhoto =
    form.images && form.images.length > 0
      ? form.images[form.primaryImageIndex || 0] || form.images[0]
      : null;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
            Jewellery & Ornament Catalog ({total})
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Manage earrings, necklaces, rings, bracelets, bangles, pendants, anklets and sets.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primaryDark text-white text-[13.5px] rounded-lg hover:bg-ink transition-colors flex items-center gap-1.5 shadow-sm font-medium"
        >
          <Plus size={16} /> Add New Jewellery
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by jewellery name, SKU, material, gemstones..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark focus:bg-white"
            />
          </div>

          {/* Jewellery Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="text-[12.5px] px-3 py-2 bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark"
          >
            <option value="">All Jewellery Types</option>
            {JEWELLERY_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="text-[12.5px] px-3 py-2 bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Stock Level Filter */}
          <select
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              setPage(1);
            }}
            className="text-[12.5px] px-3 py-2 bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark"
          >
            <option value="">All Stock Levels</option>
            <option value="low">Low Stock (≤ 5)</option>
            <option value="out">Out of Stock (0)</option>
          </select>

          {/* Publishing Filter */}
          <select
            value={isPublishedFilter}
            onChange={(e) => {
              setIsPublishedFilter(e.target.value);
              setPage(1);
            }}
            className="text-[12.5px] px-3 py-2 bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark"
          >
            <option value="">All Statuses</option>
            <option value="true">Published</option>
            <option value="false">Draft / Unpublished</option>
          </select>

          {/* Sort order */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-[12.5px] px-3 py-2 bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark"
          >
            <option value="newest">Newest Added</option>
            <option value="oldest">Oldest Added</option>
            <option value="priceAsc">Price: Low to High</option>
            <option value="priceDesc">Price: High to Low</option>
            <option value="stockAsc">Stock: Low to High</option>
            <option value="stockDesc">Stock: High to Low</option>
            <option value="trending">Trending Score</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
              <RefreshCw size={15} className="animate-spin text-primaryDark" /> Fetching catalogue from database...
            </div>
          ) : products.length === 0 ? (
            <div className="py-20 text-center text-textSecondary text-[13px]">
              No products found matching the selected filters.
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-textSecondary text-[11.5px] uppercase tracking-wider text-left">
                  <th className="py-3 px-4 font-medium">Photograph & Name</th>
                  <th className="py-3 px-4 font-medium">Type / Category</th>
                  <th className="py-3 px-4 font-medium">Price</th>
                  <th className="py-3 px-4 font-medium">Stock</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Featured</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => {
                  const hasPhoto = Array.isArray(p.images) && p.images.length > 0;
                  const primaryImg = hasPhoto
                    ? p.images[p.primaryImageIndex || 0] || p.images[0]
                    : null;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Photo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-lg bg-primaryLight/40 border border-border flex items-center justify-center overflow-hidden shrink-0">
                            {primaryImg ? (
                              <img
                                src={primaryImg}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon size={18} className="text-slate-400" />
                            )}
                            {hasPhoto && (
                              <span className="absolute bottom-0 right-0 bg-ink/70 text-white text-[9px] px-1 rounded-tl">
                                {p.images.length}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{p.name}</p>
                            <p className="text-[11.5px] font-mono text-textSecondary">
                              {p.sku || `#${p.id.slice(0, 8)}`}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type & Category */}
                      <td className="py-3 px-4">
                        <span className="capitalize font-medium text-slate-800">{p.productType}</span>
                        <p className="text-[11.5px] text-textSecondary capitalize">{p.category}</p>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{money(p.price)}</span>
                        {p.originalPrice && (
                          <p className="text-[11px] text-textSecondary line-through">
                            {money(p.originalPrice)}
                          </p>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-4">
                        <span
                          className={`font-medium ${
                            p.stock === 0
                              ? "text-rose-600 font-semibold"
                              : p.stock <= 5
                              ? "text-amber-600 font-semibold"
                              : "text-emerald-700"
                          }`}
                        >
                          {p.stock === 0 ? "Out of Stock" : `${p.stock} units`}
                        </span>
                      </td>

                      {/* Status / Publish Toggle */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => togglePublish(p)}
                          className={`inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded font-medium transition-colors ${
                            p.isPublished
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {p.isPublished ? (
                            <>
                              <CheckCircle size={12} /> Published
                            </>
                          ) : (
                            <>
                              <XCircle size={12} /> Draft
                            </>
                          )}
                        </button>
                      </td>

                      {/* Featured (Editor's Pick) */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleFeatured(p)}
                          title="Toggle Editor's Pick"
                          className={`p-1.5 rounded transition-colors ${
                            p.isEditorsPick
                              ? "text-amber-500 bg-amber-50 hover:bg-amber-100"
                              : "text-slate-300 hover:text-slate-500"
                          }`}
                        >
                          <Star size={16} className={p.isEditorsPick ? "fill-current" : ""} />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(p)}
                          className="px-2.5 py-1 text-[12px] bg-slate-100 hover:bg-primaryLight text-primaryDark rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="px-2 py-1 text-[12px] text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-border bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12.5px] text-textSecondary">
          <span>
            Showing {products.length} of {total} jewellery pieces
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded border border-border bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 font-medium text-slate-800">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded border border-border bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Section Add / Edit Product Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[110] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-[fadeIn_.2s_ease]"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-slate-50/60">
              <div>
                <h3 className="text-[17px] font-semibold text-slate-900">
                  {editingProduct ? `Edit "${editingProduct.name}"` : "Create New Product Listing"}
                </h3>
                <p className="text-[12px] text-textSecondary">
                  Fill in jewellery specifications, upload real photographs, and control storefront availability.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-textSecondary hover:text-textPrimary p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tab Navigation inside modal */}
            <div className="flex border-b border-border px-6 bg-slate-50/30 overflow-x-auto text-[13px]">
              {[
                ["basic", "1. Basic Details"],
                ["photos", "2. Photographs & Media"],
                ["specs", "3. Jewellery Specifications"],
                ["inventory", "4. Pricing & Inventory"],
                ["publishing", "5. Merchandising & SEO"],
              ].map(([tId, tLabel]) => (
                <button
                  key={tId}
                  onClick={() => setFormTab(tId)}
                  className={`py-3 px-4 font-medium border-b-2 whitespace-nowrap transition-colors ${
                    formTab === tId
                      ? "border-primaryDark text-primaryDark"
                      : "border-transparent text-textSecondary hover:text-textPrimary"
                  }`}
                >
                  {tLabel}
                </button>
              ))}
            </div>

            {/* Modal Body with Live Preview on the side */}
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6">
              {formError && (
                <div className="mb-5 p-3.5 bg-dangerLight border border-danger/30 rounded-lg text-danger text-[13px]">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Fields Column */}
                <div className="lg:col-span-2 space-y-6">
                  {/* TAB 1: Basic Information */}
                  {formTab === "basic" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                          Product Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Celine Solitaire Pearl Drop Earrings"
                          value={form.name}
                          onChange={(e) => setFormField("name", e.target.value)}
                          className="w-full text-[13.5px] px-3.5 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Jewellery Type *
                          </label>
                          <select
                            value={form.productType}
                            onChange={(e) => setFormField("productType", e.target.value)}
                            className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark bg-white"
                          >
                            {JEWELLERY_TYPES.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Category / Silhouette *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. stud, hoop, drop, choker, bangle"
                            value={form.category}
                            onChange={(e) => setFormField("category", e.target.value)}
                            className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            SKU (Stock Keeping Unit)
                          </label>
                          <input
                            type="text"
                            placeholder="Auto-generated if blank"
                            value={form.sku}
                            onChange={(e) => setFormField("sku", e.target.value)}
                            className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Silhouette Kind
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. stud, huggie, teardrop"
                            value={form.kind}
                            onChange={(e) => setFormField("kind", e.target.value)}
                            className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                          Product Description
                        </label>
                        <textarea
                          rows={4}
                          placeholder="Detailed description of the jewellery craftsmanship, finish, and wearability..."
                          value={form.description}
                          onChange={(e) => setFormField("description", e.target.value)}
                          className="w-full text-[13px] px-3.5 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark leading-relaxed"
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Photographs & Imagery (Catalogue vs Virtual Try-On) */}
                  {formTab === "photos" && (
                    <div className="space-y-6">
                      {/* Role 1: Catalogue Photography */}
                      <div className="bg-slate-50/70 p-4 rounded-xl border border-border">
                        <div className="mb-3">
                          <h4 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
                            <ImageIcon size={16} className="text-primaryDark" />
                            Role 1: Catalogue Photography (Storefront & Product Cards)
                          </h4>
                          <p className="text-[12px] text-textSecondary">
                            Original high-quality product photographs. Displayed in product cards, product details gallery, cart, and wishlist.
                          </p>
                        </div>

                        <ProductImageUploader
                          images={form.images || []}
                          primaryIndex={form.primaryImageIndex || 0}
                          onChangeImages={(newImages) => setFormField("images", newImages)}
                          onChangePrimaryIndex={(newIdx) => setFormField("primaryImageIndex", newIdx)}
                          onAutoPrepareTryOn={handleAutoPrepareTryOn}
                          tryOnAsset={form.tryOnAsset}
                        />
                      </div>

                      {/* Role 2: Virtual Try-On Overlay Asset */}
                      <TryOnAssetManager
                        productType={form.productType || "earrings"}
                        catalogImages={form.images || []}
                        tryOnAsset={form.tryOnAsset || {}}
                        onChangeTryOnAsset={(newAsset) => setFormField("tryOnAsset", newAsset)}
                      />
                    </div>
                  )}

                  {/* TAB 3: Jewellery Specifications */}
                  {formTab === "specs" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Metal & Material
                          </label>
                          <select
                            value={form.material}
                            onChange={(e) => setFormField("material", e.target.value)}
                            className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark bg-white"
                          >
                            {MATERIALS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Primary Color / Finish
                          </label>
                          <select
                            value={form.color}
                            onChange={(e) => setFormField("color", e.target.value)}
                            className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark bg-white"
                          >
                            {COLORS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Stone / Gemstone Type
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Freshwater Pearl, Cubic Zirconia, —"
                            value={form.stone}
                            onChange={(e) => setFormField("stone", e.target.value)}
                            className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark"
                          />
                        </div>

                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Jewellery Style
                          </label>
                          <select
                            value={form.style}
                            onChange={(e) => setFormField("style", e.target.value)}
                            className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark bg-white"
                          >
                            {STYLES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Dimensions
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 2.2cm x 0.8cm"
                            value={form.dimensions}
                            onChange={(e) => setFormField("dimensions", e.target.value)}
                            className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark"
                          />
                        </div>

                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Weight
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 3.4g"
                            value={form.weight}
                            onChange={(e) => setFormField("weight", e.target.value)}
                            className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[12.5px] font-medium text-slate-700 mb-1.5">
                          Target Occasions (Select multiple)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {OCCASIONS.map((occ) => {
                            const selected = form.occasion && form.occasion.includes(occ);
                            return (
                              <button
                                key={occ}
                                type="button"
                                onClick={() => toggleOccasion(occ)}
                                className={`px-3 py-1 text-[12px] rounded-full border transition-colors ${
                                  selected
                                    ? "bg-primaryDark text-white border-primaryDark"
                                    : "bg-slate-50 text-slate-700 border-border hover:border-slate-400"
                                }`}
                              >
                                {occ}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: Pricing & Inventory */}
                  {formTab === "inventory" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Selling Price ($ USD) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={form.price}
                            onChange={(e) => setFormField("price", e.target.value)}
                            className="w-full text-[14px] font-semibold px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark"
                          />
                        </div>

                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Original / Compare-At Price ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="e.g. 65.00"
                            value={form.originalPrice}
                            onChange={(e) => setFormField("originalPrice", e.target.value)}
                            className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark"
                          />
                        </div>

                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Calculated Discount
                          </label>
                          <div className="px-3 py-2.5 bg-slate-50 border border-border rounded-lg text-[13px] font-medium text-emerald-700">
                            {discountPercent ? `${discountPercent}% OFF` : "No discount"}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Available Inventory Quantity *
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={form.stock}
                            onChange={(e) => setFormField("stock", e.target.value)}
                            className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark"
                          />
                        </div>

                        <div>
                          <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                            Low Stock Alert Threshold
                          </label>
                          <div className="px-3 py-2.5 bg-slate-50 border border-border rounded-lg text-[13px] text-textSecondary">
                            Automatic alert triggered when stock ≤ 5 units
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: Publishing & Merchandising */}
                  {formTab === "publishing" && (
                    <div className="space-y-5">
                      <div className="p-4 rounded-xl border border-border bg-slate-50/70 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[13.5px] font-semibold text-slate-900">Publish in Storefront</p>
                            <p className="text-[12px] text-textSecondary">
                              When enabled, shoppers can browse, add to cart, and purchase this jewellery.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={form.isPublished}
                            onChange={(e) => setFormField("isPublished", e.target.checked)}
                            className="w-5 h-5 accent-primaryDark cursor-pointer"
                          />
                        </div>

                        <div className="pt-3 border-t border-border flex items-center justify-between">
                          <div>
                            <p className="text-[13.5px] font-semibold text-slate-900">Featured (Editor's Pick)</p>
                            <p className="text-[12px] text-textSecondary">
                              Pin this piece to homepage curated highlights.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={form.isEditorsPick}
                            onChange={(e) => setFormField("isEditorsPick", e.target.checked)}
                            className="w-5 h-5 accent-primaryDark cursor-pointer"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                          Product Approval Status
                        </label>
                        <select
                          value={form.approvalStatus}
                          onChange={(e) => setFormField("approvalStatus", e.target.value)}
                          className="w-full text-[13px] px-3 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark bg-white font-medium"
                        >
                          <option value="APPROVED">APPROVED (Ready for purchase)</option>
                          <option value="PENDING_APPROVAL">PENDING APPROVAL (Under review)</option>
                          <option value="DRAFT">DRAFT (Internal prep only)</option>
                          <option value="REJECTED">REJECTED (Does not meet standards)</option>
                          <option value="ARCHIVED">ARCHIVED (Discontinued)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side: Live Storefront Card Preview */}
                <div className="border border-border rounded-xl p-4 bg-slate-50/50 flex flex-col">
                  <h4 className="text-[12.5px] font-semibold text-slate-700 uppercase tracking-wider mb-3">
                    Live Storefront Preview
                  </h4>
                  <div className="bg-white rounded-lg border border-border overflow-hidden shadow-sm flex-1 flex flex-col max-w-[280px] mx-auto w-full">
                    {/* Primary Image Preview */}
                    <div className="relative aspect-square bg-primaryLight/30 flex items-center justify-center overflow-hidden">
                      {primaryPhoto ? (
                        <img
                          src={primaryPhoto}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-4 text-textSecondary text-[12px]">
                          <ImageIcon size={28} className="mx-auto mb-1 text-slate-300" />
                          <span>No photograph uploaded yet</span>
                        </div>
                      )}

                      {discountPercent && (
                        <span className="absolute top-2 left-2 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          -{discountPercent}%
                        </span>
                      )}

                      {form.isEditorsPick && (
                        <span className="absolute top-2 right-2 bg-amber-400 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Star size={10} className="fill-current" /> Pick
                        </span>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="p-3.5 flex flex-col flex-1">
                      <p className="text-[10.5px] uppercase tracking-wider text-primaryDark font-medium">
                        {form.material || "Fine Jewellery"}
                      </p>
                      <h5 className="text-[13.5px] font-semibold text-slate-900 line-clamp-1 mt-0.5">
                        {form.name || "Untitled Jewellery Piece"}
                      </h5>
                      <p className="text-[11.5px] text-textSecondary line-clamp-2 mt-1">
                        {form.description || "Jewellery piece description will appear here."}
                      </p>
                      <div className="mt-auto pt-3 flex items-center justify-between">
                        <div>
                          <span className="text-[15px] font-bold text-slate-900">
                            {money(form.price || 0)}
                          </span>
                          {form.originalPrice && (
                            <span className="text-[11px] text-textSecondary line-through ml-1.5">
                              {money(form.originalPrice)}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            form.stock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {form.stock > 0 ? "In Stock" : "Out of Stock"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-textSecondary text-center mt-3">
                    This preview updates live as you type and upload photographs.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="mt-8 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex gap-2">
                  {formTab !== "basic" && (
                    <button
                      type="button"
                      onClick={() => {
                        const tabs = ["basic", "photos", "specs", "inventory", "publishing"];
                        const idx = tabs.indexOf(formTab);
                        if (idx > 0) setFormTab(tabs[idx - 1]);
                      }}
                      className="px-3 py-1.5 text-[12.5px] border border-border rounded text-textSecondary hover:text-textPrimary"
                    >
                      ← Previous Section
                    </button>
                  )}
                  {formTab !== "publishing" && (
                    <button
                      type="button"
                      onClick={() => {
                        const tabs = ["basic", "photos", "specs", "inventory", "publishing"];
                        const idx = tabs.indexOf(formTab);
                        if (idx < tabs.length - 1) setFormTab(tabs[idx + 1]);
                      }}
                      className="px-3 py-1.5 text-[12.5px] border border-border rounded text-textSecondary hover:text-textPrimary"
                    >
                      Next Section →
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-[13px] border border-border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formBusy}
                    className="px-6 py-2 bg-primaryDark text-white text-[13px] rounded-lg hover:bg-ink transition-colors font-medium disabled:opacity-50"
                  >
                    {formBusy ? "Saving..." : editingProduct ? "Save Changes" : "Create Product"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[130] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4"
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
              Delete "{deleteTarget.name}"?
            </h3>
            <p className="text-[13px] text-textSecondary leading-relaxed mb-5">
              Are you sure you want to permanently delete this product? Past orders will retain their
              snapshot data, but this item will be removed from customer storefronts and inventory.
            </p>
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
                disabled={deleteBusy}
                onClick={handleDelete}
                className="px-4 py-2 text-[13px] bg-rose-600 text-white rounded hover:bg-rose-700 font-medium disabled:opacity-50"
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
