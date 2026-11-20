import React, { useState, useEffect } from "react";
import {
  Star, CheckCircle2, ShieldCheck, MessageSquare, ThumbsUp,
  AlertCircle, Plus, Image as ImageIcon, Send, Clock
} from "lucide-react";
import { api } from "../api";
import { Button, Rating } from "../ui";

const SERIF = { fontFamily: "'Cormorant Garamond', serif" };

export default function ProductReviewsSection({ product, user, onReviewAdded }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("newest");
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadReviews = async () => {
    if (!product?.id) return;
    setLoading(true);
    try {
      const data = await api.getProductReviews(product.id);
      setReviews(data || []);
    } catch (err) {
      console.warn("Failed to fetch product reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [product?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setFormError("Please log in to submit a review.");
      return;
    }
    if (!comment.trim()) {
      setFormError("Please write a few words about your experience with this jewelry.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");

    try {
      await api.createProductReview(product.id, {
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
        imageUrl: imageUrl.trim() || undefined
      });
      setFormSuccess("Thank you! Your verified review has been posted successfully.");
      setTitle("");
      setComment("");
      setImageUrl("");
      await loadReviews();
      if (onReviewAdded) onReviewAdded();
      setTimeout(() => {
        setShowModal(false);
        setFormSuccess("");
      }, 1800);
    } catch (err) {
      setFormError(err.message || "Failed to submit review. Verified purchase may be required.");
    } finally {
      setSubmitting(false);
    }
  };

  // Compute distribution
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
    : Number(product.rating || 5).toFixed(1);

  const starCounts = [5, 4, 3, 2, 1].map((s) => ({
    stars: s,
    count: reviews.filter((r) => r.rating === s).length,
    percentage: totalReviews > 0 ? (reviews.filter((r) => r.rating === s).length / totalReviews) * 100 : 0
  }));

  // Sort reviews
  const sortedReviews = [...reviews].sort((a, b) => {
    if (sort === "highest") return b.rating - a.rating;
    if (sort === "lowest") return a.rating - b.rating;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div className="py-6 space-y-8">
      {/* Overview Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="grid md:grid-cols-12 gap-8 items-center">
          
          {/* Average Rating Block */}
          <div className="md:col-span-4 text-center md:text-left border-b md:border-b-0 md:border-r border-slate-200 pb-6 md:pb-0 md:pr-8">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
              Customer Satisfaction
            </p>
            <div className="flex items-baseline justify-center md:justify-start gap-2">
              <span className="text-5xl font-black text-slate-900" style={SERIF}>
                {avgRating}
              </span>
              <span className="text-slate-400 font-medium">/ 5.0</span>
            </div>
            <div className="flex justify-center md:justify-start my-2">
              <Rating value={Number(avgRating)} size={18} />
            </div>
            <p className="text-xs text-slate-500">
              Based on {totalReviews || product.reviews || 0} customer ratings
            </p>

            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-2 mx-auto md:mx-0"
            >
              <Plus size={15} />
              Write a Review
            </button>
          </div>

          {/* Star Distribution Bars */}
          <div className="md:col-span-8 space-y-2">
            {starCounts.map((sc) => (
              <div key={sc.stars} className="flex items-center gap-3 text-xs text-slate-600">
                <span className="w-12 flex items-center gap-1 font-semibold text-slate-700 shrink-0">
                  {sc.stars} <Star size={12} className="fill-amber-400 text-amber-400" />
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${sc.percentage}%` }}
                  />
                </div>
                <span className="w-8 text-right text-slate-400 font-mono text-[11px] shrink-0">
                  {sc.count}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <h3 className="text-lg font-normal text-slate-900" style={SERIF}>
          Customer Reviews & Photos ({reviews.length})
        </h3>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Sort by:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 bg-white outline-none focus:border-sky-500"
          >
            <option value="newest">Most Recent</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
          </select>
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="text-center py-10 text-slate-400 text-xs">Loading customer reviews...</div>
      ) : sortedReviews.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-8">
          <MessageSquare size={36} className="mx-auto mb-3 text-slate-300" />
          <h4 className="text-base text-slate-700 font-medium">No customer reviews yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Be the first to share your experience with this fine jewelry piece after taking delivery.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-xl text-xs font-semibold transition"
          >
            Submit Verified Review
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedReviews.map((rev) => (
            <div
              key={rev.id}
              className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-sky-200 transition shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Rating value={rev.rating} size={13} />
                    {rev.title && (
                      <span className="font-semibold text-sm text-slate-900 ml-1">
                        {rev.title}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                    <span className="font-medium text-slate-800">
                      {rev.user?.name || "Verified Customer"}
                    </span>
                    <span>&bull;</span>
                    <span>{new Date(rev.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    {rev.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        Verified Purchase
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {rev.comment}
              </p>

              {rev.imageUrl && (
                <div className="pt-2">
                  <img
                    src={rev.imageUrl}
                    alt="Customer ornament photo"
                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 shadow-xs hover:scale-105 transition"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Write Review Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-sky-100 overflow-hidden">
            <div className="bg-gradient-to-r from-sky-900 to-slate-900 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium" style={SERIF}>Review {product.name}</h3>
                <p className="text-xs text-sky-200">Share your genuine experience with other shoppers</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                  {formSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Overall Rating *
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setRating(s)}
                      className="p-1 text-slate-300 hover:text-amber-400 focus:outline-none transition"
                    >
                      <Star
                        size={24}
                        className={s <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-semibold text-slate-700">{rating} out of 5 stars</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Review Title (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stunning craftsmanship, looks even better in person"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Review & Feedback *
                </label>
                <textarea
                  rows={4}
                  placeholder="Tell us about the quality, gemstone brilliance, packaging, and wear comfort..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Photo URL (optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {submitting ? "Verifying & Posting..." : "Post Verified Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
