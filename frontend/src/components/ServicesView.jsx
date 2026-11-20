import React, { useState, useEffect } from "react";
import {
  Sparkles, ShieldCheck, Clock, MapPin, Calendar, Check,
  Search, Filter, Plus, AlertCircle, CheckCircle2, ChevronRight,
  Phone, Mail, DollarSign, Award, X, Tag
} from "lucide-react";
import { api } from "../api";
import { money, Spinner } from "../ui";

const SERIF = { fontFamily: "'Cormorant Garamond', serif" };

const SERVICE_CATEGORIES = [
  "All Categories",
  "Jewelry Repair",
  "Cleaning and Polishing",
  "Ring Resizing",
  "Custom Jewelry Design",
  "Bridal Consultation",
  "Ornament Maintenance",
  "Packaging and Gifting"
];

export default function ServicesView({ user }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [bookingService, setBookingService] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Booking Form State
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("Morning (10am - 1pm)");
  const [bookingNotes, setBookingNotes] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [bookingError, setBookingError] = useState("");

  // Provider Service Submission State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Jewelry Repair");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("50");
  const [newTurnaround, setNewTurnaround] = useState("2-3 business days");
  const [newArea, setNewArea] = useState("Metro Area & Insured Courier");
  const [newCover, setNewCover] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [submitError, setSubmitError] = useState("");

  const loadServices = async () => {
    setLoading(true);
    try {
      const data = await api.getServices();
      setServices(data || []);
    } catch (err) {
      console.warn("Failed to load services:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const filteredServices = services.filter((s) => {
    const matchesCat = selectedCategory === "All Categories" || s.category === selectedCategory;
    const matchesSearch = !searchQuery.trim() ||
      s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!bookingService) return;
    setBookingSubmitting(true);
    setBookingError("");
    setBookingSuccess("");

    try {
      await api.bookService(bookingService.id, {
        preferredDate,
        preferredTime,
        notes: bookingNotes,
        customerName: user?.name || "Customer",
        customerEmail: user?.email || "",
        customerPhone: custPhone
      });
      setBookingSuccess("Your booking request has been submitted to the verified artisan!");
      setTimeout(() => {
        setBookingService(null);
        setBookingSuccess("");
        setPreferredDate("");
        setBookingNotes("");
      }, 2000);
    } catch (err) {
      setBookingError(err.message || "Failed to submit service booking");
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleServiceSubmission = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      await api.submitService({
        title: newTitle,
        category: newCategory,
        description: newDesc,
        price: parseFloat(newPrice) || 0,
        estimatedDuration: newTurnaround,
        serviceArea: newArea,
        coverImage: newCover || undefined,
        documentUrl: newDocUrl || undefined
      });
      setSubmitSuccess("Service submitted for Super Admin verification! It will be reviewed by platform administrators before appearing in the marketplace.");
      setNewTitle("");
      setNewDesc("");
      setTimeout(() => {
        setShowSubmitModal(false);
        setSubmitSuccess("");
        loadServices();
      }, 2500);
    } catch (err) {
      setSubmitError(err.message || "Failed to submit service");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="max-w-[1300px] mx-auto px-5 md:px-8 py-10 space-y-8">
      
      {/* Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-sky-900 via-sky-800 to-slate-900 text-white p-8 md:p-12 overflow-hidden shadow-xl border border-sky-800">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-400/20 text-sky-200 border border-sky-400/30 mb-4">
            <ShieldCheck size={14} className="text-sky-300" />
            Super Admin Verified Marketplace Services
          </div>
          <h1 className="text-3xl md:text-5xl font-normal tracking-wide text-white mb-4" style={SERIF}>
            Master Artisan Services & Care
          </h1>
          <p className="text-sm md:text-base text-sky-100 font-light leading-relaxed mb-6">
            From precision laser resizing and ultrasonic deep cleaning to bespoke bridal consultations, trust our verified jewelers to care for your finest ornaments.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold shadow-md transition flex items-center gap-2"
            >
              <Plus size={15} />
              Offer a Jewelry Service (Submit for Verification)
            </button>
          </div>
        </div>
      </div>

      {/* Search and Category Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search services or care..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 outline-none focus:border-sky-500 bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-2 md:pb-0">
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === cat
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-sky-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <Spinner label="Loading verified jewelry services..." />
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 p-8">
          <Sparkles size={36} className="mx-auto mb-3 text-sky-400" />
          <h3 className="text-base text-slate-800 font-medium">No verified services match your criteria</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Try adjusting your search terms or view all categories.
          </p>
          <button
            onClick={() => { setSelectedCategory("All Categories"); setSearchQuery(""); }}
            className="px-4 py-2 bg-sky-50 text-sky-700 rounded-xl text-xs font-semibold"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((svc) => (
            <div
              key={svc.id}
              className="group bg-white rounded-2xl border border-slate-200 hover:border-sky-300 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              {/* Cover Image or Fallback */}
              <div className="relative aspect-[16/9] bg-gradient-to-br from-sky-50 to-blue-100 flex items-center justify-center overflow-hidden">
                {svc.coverImage ? (
                  <img
                    src={svc.coverImage}
                    alt={svc.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <Sparkles size={36} className="text-sky-300" />
                )}

                {/* Verified Badge */}
                {svc.isVerified && (
                  <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-bold text-sky-800 shadow-sm flex items-center gap-1 border border-sky-200">
                    <ShieldCheck size={13} className="text-sky-600" />
                    Super Admin Verified
                  </div>
                )}

                <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-white font-semibold text-xs">
                  {svc.price > 0 ? money(svc.price) : "Custom Estimate"}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider">
                    {svc.category}
                  </span>
                  <h3 className="text-lg font-medium text-slate-900 mt-1 mb-2 leading-snug group-hover:text-sky-700 transition" style={SERIF}>
                    {svc.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4">
                    {svc.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-slate-400" />
                      {svc.estimatedDuration || "2-4 days"}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400" />
                      {svc.serviceArea || "Nationwide"}
                    </span>
                  </div>

                  <button
                    onClick={() => setBookingService(svc)}
                    className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2"
                  >
                    <Calendar size={14} />
                    Request Appointment / Quote
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Appointment Modal */}
      {bookingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-sky-100 overflow-hidden">
            <div className="bg-gradient-to-r from-sky-900 to-slate-900 p-5 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-sky-300 text-xs font-semibold uppercase">
                  <ShieldCheck size={14} /> Verified Service Booking
                </div>
                <h3 className="text-xl font-normal mt-0.5" style={SERIF}>
                  {bookingService.title}
                </h3>
              </div>
              <button
                onClick={() => setBookingService(null)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBooking} className="p-6 space-y-4">
              {bookingError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  {bookingError}
                </div>
              )}

              {bookingSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                  {bookingSuccess}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preferred Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time Slot *
                  </label>
                  <select
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500 bg-white"
                  >
                    <option>Morning (10:00 AM - 1:00 PM)</option>
                    <option>Afternoon (1:00 PM - 4:00 PM)</option>
                    <option>Evening (4:00 PM - 7:00 PM)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  required
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Details & Requirements
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe your jewelry item, current ring size / desired size, or repair details..."
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800 leading-relaxed">
                <span className="font-bold">Verified Guarantee:</span> All services booked through Aurélie are backed by verified master artisans with insured handling.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBookingService(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {bookingSubmitting ? "Submitting..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Provider Submit Service for Verification Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-sky-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-sky-900 to-slate-900 p-5 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-sky-300 text-xs font-semibold uppercase">
                  <Award size={14} /> Artisan & Seller Program
                </div>
                <h3 className="text-xl font-normal mt-0.5" style={SERIF}>
                  Submit Service for Super Admin Verification
                </h3>
              </div>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleServiceSubmission} className="p-6 space-y-4 overflow-y-auto">
              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  {submitError}
                </div>
              )}

              {submitSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                  {submitSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ultrasonic Diamond & Gold Deep Cleaning"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500 bg-white"
                  >
                    {SERVICE_CATEGORIES.filter((c) => c !== "All Categories").map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Base Price ($) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description & Scope of Work *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail the materials handled, equipment used, and inspection standards..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Turnaround Time *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2-3 business days"
                    value={newTurnaround}
                    onChange={(e) => setNewTurnaround(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Service Area *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Store Drop-off & Insured Mail"
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cover Photo URL (optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/jewelry-service.jpg"
                  value={newCover}
                  onChange={(e) => setNewCover(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Artisan Qualifications / Business License URL (for Super Admin audit)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/artisan-license.pdf"
                  value={newDocUrl}
                  onChange={(e) => setNewDocUrl(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-sky-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                Notice: Services will remain unpublished under status <span className="font-bold">PENDING_REVIEW</span> until verified by the Super Admin team.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {submitLoading ? "Submitting..." : "Submit for Verification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
