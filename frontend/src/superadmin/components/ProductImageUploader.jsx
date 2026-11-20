import React, { useState, useRef } from "react";
import {
  Upload,
  X,
  Star,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Library,
  Sparkles,
} from "lucide-react";
import { api } from "../../api";

export default function ProductImageUploader({
  images = [],
  primaryIndex = 0,
  onChangeImages,
  onChangePrimaryIndex,
  onAutoPrepareTryOn,
  tryOnAsset = null,
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isolatingUrl, setIsolatingUrl] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [replaceTargetIndex, setReplaceTargetIndex] = useState(null);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryImages, setLibraryImages] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");

  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  const handleTriggerTryOn = async (url) => {
    if (!onAutoPrepareTryOn || !url) return;
    setIsolatingUrl(url);
    try {
      await onAutoPrepareTryOn(url);
    } catch (err) {
      console.warn("Failed to prepare try-on asset:", err);
    } finally {
      setIsolatingUrl(null);
    }
  };

  // Process files through real upload API
  const handleFiles = async (fileList, isReplace = false, targetIdx = null) => {
    if (!fileList || fileList.length === 0) return;

    setError(null);
    setUploading(true);
    setProgress(20);

    const formData = new FormData();
    const validFiles = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      // Client-side MIME check
      if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type)) {
        setError(`"${file.name}" is not a supported image format. Please select JPG, PNG, or WebP.`);
        setUploading(false);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`"${file.name}" exceeds the 10MB upload limit.`);
        setUploading(false);
        return;
      }
      formData.append("images", file);
      validFiles.push(file);
    }

    setProgress(50);

    try {
      const result = await api.adminUploadImages(formData);
      setProgress(90);

      const newUrls = (result.images || []).map(img => img.url);

      if (isReplace && targetIdx != null) {
        if (newUrls.length > 0) {
          const next = [...images];
          next[targetIdx] = newUrls[0];
          onChangeImages(next);
        }
      } else {
        const next = [...images, ...newUrls];
        onChangeImages(next);
        if (images.length === 0) {
          onChangePrimaryIndex(0);
        }
        // Auto-prepare transparent cutout for Virtual Try-On if not yet configured
        if (onAutoPrepareTryOn && (!tryOnAsset?.transparent && !tryOnAsset?.earrings) && newUrls.length > 0) {
          handleTriggerTryOn(newUrls[0]);
        }
      }
      setProgress(100);
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 400);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload images to server.");
      setUploading(false);
      setProgress(0);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (index) => {
    const next = images.filter((_, i) => i !== index);
    onChangeImages(next);

    if (primaryIndex === index) {
      onChangePrimaryIndex(0);
    } else if (primaryIndex > index) {
      onChangePrimaryIndex(primaryIndex - 1);
    }
  };

  const handleMove = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChangeImages(next);

    // Keep primary index pointing to same item
    if (primaryIndex === fromIndex) {
      onChangePrimaryIndex(toIndex);
    } else if (primaryIndex === toIndex) {
      onChangePrimaryIndex(fromIndex);
    }
  };

  const startReplace = (index) => {
    setReplaceTargetIndex(index);
    if (replaceInputRef.current) {
      replaceInputRef.current.value = "";
      replaceInputRef.current.click();
    }
  };

  const openLibraryModal = async () => {
    setShowLibraryModal(true);
    setLoadingLibrary(true);
    try {
      const res = await api.adminGetImages({ limit: 100 });
      setLibraryImages(res.items || []);
    } catch (err) {
      console.error("Library load error:", err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const selectFromLibrary = (url) => {
    if (!images.includes(url)) {
      const next = [...images, url];
      onChangeImages(next);
      if (images.length === 0) {
        onChangePrimaryIndex(0);
      }
    }
    setShowLibraryModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length > 0) {
            handleFiles(e.target.files, true, replaceTargetIndex);
          }
        }}
      />

      {/* Dropzone & Action Bar */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
          isDragOver
            ? "border-primaryDark bg-primaryLight/50"
            : "border-border bg-slate-50/70 hover:border-primaryDark/60"
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-primaryLight flex items-center justify-center text-primaryDark">
            <Upload size={22} />
          </div>
          <p className="text-[14px] font-medium text-textPrimary">
            Drag & drop jewellery photographs here, or browse your device
          </p>
          <p className="text-[12px] text-textSecondary">
            High-resolution JPG, PNG, or WebP up to 10MB per photograph.
          </p>

          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-primaryDark text-white text-[13px] rounded hover:bg-ink transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={15} /> Upload Photographs
            </button>
            <button
              type="button"
              onClick={openLibraryModal}
              disabled={uploading}
              className="px-4 py-2 border border-border bg-white text-textPrimary text-[13px] rounded hover:bg-primaryLight/40 transition-colors flex items-center gap-1.5"
            >
              <Library size={15} /> Choose from Library
            </button>
          </div>
        </div>

        {/* Upload Progress Bar */}
        {uploading && (
          <div className="mt-5 max-w-sm mx-auto space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-textSecondary">
              <span className="flex items-center gap-1.5 font-medium text-primaryDark">
                <RefreshCw size={12} className="animate-spin" /> Storing and optimizing images...
              </span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primaryDark h-full transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-dangerLight border border-danger/30 rounded text-danger text-[12.5px] flex items-center justify-center gap-2 max-w-md mx-auto">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto text-danger/70 hover:text-danger"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Gallery / Reorder / Primary Selection Grid */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12.5px] text-textSecondary">
            <span>
              {images.length} photograph{images.length !== 1 ? "s" : ""} attached (
              <span className="text-primaryDark font-medium">Primary: Image #{primaryIndex + 1}</span>)
            </span>
            <span className="text-[11.5px] text-slate-500">
              Drag or use arrows to reorder • Star to set as primary
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((url, idx) => {
              const isPrimary = primaryIndex === idx;
              return (
                <div
                  key={`${url}-${idx}`}
                  className={`group relative rounded-lg border bg-white overflow-hidden shadow-sm transition-all ${
                    isPrimary
                      ? "border-primaryDark ring-2 ring-primaryDark/30"
                      : "border-border hover:border-slate-400"
                  }`}
                >
                  {/* Photo Container */}
                  <div className="relative aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                    <img
                      src={url}
                      alt={`Product photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Primary Badge */}
                    {isPrimary && (
                      <div className="absolute top-1.5 left-1.5 bg-primaryDark text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow flex items-center gap-1">
                        <Star size={10} className="fill-current" /> Primary
                      </div>
                    )}

                    {/* Quick Action Overlay */}
                    <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onChangePrimaryIndex(idx)}
                          title="Set as primary storefront image"
                          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                            isPrimary
                              ? "bg-amber-400 text-slate-900"
                              : "bg-white/90 text-slate-700 hover:bg-white"
                          }`}
                        >
                          <Star size={13} className={isPrimary ? "fill-current" : ""} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(idx)}
                          title="Delete photograph"
                          className="w-7 h-7 rounded bg-red-600/90 text-white hover:bg-red-600 flex items-center justify-center transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, idx - 1)}
                            title="Move left"
                            className="w-6 h-6 rounded bg-white/80 hover:bg-white text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-[10px]"
                          >
                            <ArrowLeft size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === images.length - 1}
                            onClick={() => handleMove(idx, idx + 1)}
                            title="Move right"
                            className="w-6 h-6 rounded bg-white/80 hover:bg-white text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-[10px]"
                          >
                            <ArrowRight size={11} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => startReplace(idx)}
                          title="Replace photo"
                          className="px-1.5 py-0.5 rounded bg-white/90 hover:bg-white text-[10px] text-slate-800 font-medium"
                        >
                          Replace
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Caption underneath */}
                  <div className="p-1.5 text-center text-[11px] text-textSecondary bg-slate-50 border-t border-border flex items-center justify-between px-2">
                    <span>Photo #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => onChangePrimaryIndex(idx)}
                      className={`text-[10px] font-medium hover:underline ${
                        isPrimary ? "text-primaryDark" : "text-textSecondary"
                      }`}
                    >
                      {isPrimary ? "Main" : "Make main"}
                    </button>
                  </div>

                  {/* Virtual Try-On Asset Action */}
                  {onAutoPrepareTryOn && (
                    <div className="p-1 bg-white border-t border-slate-100 flex items-center justify-between gap-1 px-1.5">
                      <button
                        type="button"
                        onClick={() => handleTriggerTryOn(url)}
                        disabled={isolatingUrl === url}
                        title="Auto-isolate jewellery background for Virtual Try-On"
                        className="w-full py-1 px-1.5 rounded bg-amber-50/80 hover:bg-amber-100/90 text-amber-900 border border-amber-200/80 text-[10px] font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        {isolatingUrl === url ? (
                          <RefreshCw size={10} className="animate-spin text-amber-700" />
                        ) : (
                          <Sparkles size={10} className="text-amber-600" />
                        )}
                        <span>{isolatingUrl === url ? "Isolating..." : "Make Try-On"}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Library Selection Modal */}
      {showLibraryModal && (
        <div
          className="fixed inset-0 z-[120] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_.2s_ease]"
          onClick={() => setShowLibraryModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Library size={18} className="text-primaryDark" />
                <h3 className="font-semibold text-textPrimary text-[15px]">Select from Photo Library</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLibraryModal(false)}
                className="text-textSecondary hover:text-textPrimary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 border-b border-border bg-slate-50">
              <input
                type="text"
                placeholder="Search images by filename or SKU..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="w-full text-[13px] px-3 py-1.5 bg-white border border-border rounded outline-none focus:border-primaryDark"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingLibrary ? (
                <div className="py-12 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-primaryDark" /> Loading library...
                </div>
              ) : libraryImages.length === 0 ? (
                <div className="py-12 text-center text-textSecondary text-[13px]">
                  No images in library yet. Upload new photographs from your computer.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {libraryImages
                    .filter((img) =>
                      img.key.toLowerCase().includes(librarySearch.toLowerCase())
                    )
                    .map((img) => {
                      const alreadyAdded = images.includes(img.url);
                      return (
                        <div
                          key={img.key}
                          onClick={() => selectFromLibrary(img.url)}
                          className={`relative aspect-square rounded border cursor-pointer overflow-hidden transition-all group ${
                            alreadyAdded
                              ? "border-success ring-2 ring-success/30 opacity-70"
                              : "border-border hover:border-primaryDark hover:scale-[1.02]"
                          }`}
                        >
                          <img
                            src={img.url}
                            alt={img.key}
                            className="w-full h-full object-cover"
                          />
                          {alreadyAdded && (
                            <div className="absolute top-1 right-1 bg-success text-white rounded-full p-0.5">
                              <Check size={11} />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1 text-center">
                            <span className="text-[11px] text-white font-medium">
                              {alreadyAdded ? "Already Selected" : "Add to Product"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLibraryModal(false)}
                className="px-4 py-1.5 text-[13px] border border-border rounded bg-white hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
