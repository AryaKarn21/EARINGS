import React, { useState, useEffect } from "react";
import {
  Star,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Search,
  MessageSquare,
  ThumbsUp,
  Flag,
} from "lucide-react";
import { api } from "../../api";

export default function ReviewsSection() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [total, setTotal] = useState(0);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetReviews({ status: statusFilter });
      setReviews(res.reviews || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Reviews error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [statusFilter]);

  const handleModerate = async (reviewId, newStatus) => {
    try {
      await api.adminModerateReview(reviewId, newStatus);
      loadReviews();
    } catch (err) {
      alert("Moderation error: " + err.message);
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm("Delete this review permanently?")) return;
    try {
      await api.adminDeleteReview(reviewId);
      loadReviews();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
            Customer Reviews & Moderation ({total})
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Audit customer feedback, investigate flagged submissions, and approve genuine ratings.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between gap-3">
        <div className="flex bg-slate-100 p-0.5 rounded-lg text-[12.5px]">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === "" ? "bg-white text-slate-900 shadow-sm" : "text-textSecondary hover:text-slate-900"
            }`}
          >
            All Reviews
          </button>
          <button
            onClick={() => setStatusFilter("Flagged")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === "Flagged" ? "bg-white text-slate-900 shadow-sm" : "text-textSecondary hover:text-slate-900"
            }`}
          >
            Flagged & Reported
          </button>
          <button
            onClick={() => setStatusFilter("Approved")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === "Approved" ? "bg-white text-slate-900 shadow-sm" : "text-textSecondary hover:text-slate-900"
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setStatusFilter("Rejected")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === "Rejected" ? "bg-white text-slate-900 shadow-sm" : "text-textSecondary hover:text-slate-900"
            }`}
          >
            Rejected
          </button>
        </div>

        <button
          onClick={loadReviews}
          title="Refresh reviews"
          className="p-2 border border-border rounded-lg bg-white hover:bg-slate-50 text-slate-700 transition-colors"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Reviews List */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
            <RefreshCw size={15} className="animate-spin text-primaryDark" /> Loading reviews...
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-16 text-center text-textSecondary text-[13px]">
            No reviews matching this moderation filter.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reviews.map((r) => (
              <div key={r.id} className="p-5 hover:bg-slate-50/50 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-900 text-[14px]">
                      {r.product?.name || "Product"}
                    </span>
                    <span className="text-[12px] text-textSecondary ml-2">
                      by <span className="font-mono">{r.ownerKey.slice(0, 10)}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-medium border ${
                        r.moderationStatus === "Approved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : r.moderationStatus === "Flagged"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {r.moderationStatus}
                    </span>
                    <span className="text-[11.5px] text-slate-400">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Stars and Title */}
                <div className="flex items-center gap-2">
                  <div className="flex text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        className={s <= r.rating ? "fill-current" : "text-slate-200"}
                      />
                    ))}
                  </div>
                  {r.title && <span className="font-medium text-slate-800 text-[13px]">{r.title}</span>}
                </div>

                {/* Comment */}
                <p className="text-[13px] text-slate-700 leading-relaxed max-w-3xl">
                  {r.comment || "No comment provided."}
                </p>

                {/* Footer and moderation action bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 text-[12px] text-textSecondary">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <ThumbsUp size={13} /> {r.helpfulCount || 0} helpful votes
                    </span>
                    {r.reportCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <Flag size={13} /> {r.reportCount} reports
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {r.moderationStatus !== "Approved" && (
                      <button
                        onClick={() => handleModerate(r.id, "Approved")}
                        className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded font-medium transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    {r.moderationStatus !== "Rejected" && (
                      <button
                        onClick={() => handleModerate(r.id, "Rejected")}
                        className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded font-medium transition-colors"
                      >
                        Reject
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Delete review"
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
    </div>
  );
}
