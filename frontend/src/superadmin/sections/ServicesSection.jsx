import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Eye,
  X,
  FileText,
  AlertTriangle,
  BadgeCheck,
  Calendar,
  DollarSign,
  MapPin,
  Store,
  User,
  Filter,
} from "lucide-react";
import { api } from "../../api";
import { money } from "../../ui";

export default function ServicesSection({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("services"); // 'services' | 'bookings'
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Inspection modal
  const [selectedService, setSelectedService] = useState(null);
  const [verifyAction, setVerifyAction] = useState(null); // 'APPROVED_VERIFIED' | 'REJECTED' | 'SUSPENDED'
  const [rejectionReason, setRejectionReason] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetServices({
        q: search,
        status: statusFilter,
      });
      setServices(res.services || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Failed to load services:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetServiceBookings();
      setBookings(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Failed to load service bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "services") {
      loadServices();
    } else {
      loadBookings();
    }
  }, [activeTab, search, statusFilter]);

  const handleVerifySubmit = async () => {
    if (!selectedService || !verifyAction) return;
    setVerifyLoading(true);
    try {
      await api.adminVerifyService(selectedService.id, {
        status: verifyAction,
        rejectionReason: verifyAction === "REJECTED" || verifyAction === "SUSPENDED" ? rejectionReason : null,
      });
      setSelectedService(null);
      setVerifyAction(null);
      setRejectionReason("");
      loadServices();
    } catch (err) {
      alert("Failed to update service verification status: " + err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  // Metrics
  const pendingCount = services.filter((s) => s.status === "PENDING_REVIEW").length;
  const verifiedCount = services.filter((s) => s.status === "APPROVED_VERIFIED").length;
  const suspendedCount = services.filter((s) => s.status === "SUSPENDED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="text-sky-600" size={24} />
            Super Admin-Verified Services ({total})
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Audit provider credentials, verify authentic jewelry maintenance services, and grant the official "Super Admin Verified" badge.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab("services")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === "services" ? "bg-white text-sky-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Services Verification
            </button>
            <button
              onClick={() => setActiveTab("bookings")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === "bookings" ? "bg-white text-sky-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Marketplace Bookings ({bookings.length})
            </button>
          </div>

          <button
            onClick={activeTab === "services" ? loadServices : loadBookings}
            className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition"
            title="Refresh list"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-sky-600" : ""} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 text-xs font-medium">
            <span>Pending Review</span>
            <Clock size={16} />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{pendingCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Awaiting verification</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-sky-600 text-xs font-medium">
            <span>Super Admin Verified</span>
            <BadgeCheck size={16} />
          </div>
          <div className="text-2xl font-bold text-sky-700 mt-1">{verifiedCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Live on marketplace</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 text-xs font-medium">
            <span>Suspended / Rejected</span>
            <AlertTriangle size={16} />
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{suspendedCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Hidden from customers</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-medium">
            <span>Customer Bookings</span>
            <Calendar size={16} />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{bookings.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across all categories</div>
        </div>
      </div>

      {/* Filter and Search */}
      {activeTab === "services" && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search services by title, category, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="">All Verification Statuses</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="APPROVED_VERIFIED">Approved & Verified</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === "services" ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw size={15} className="animate-spin text-sky-600" />
              Loading marketplace services...
            </div>
          ) : services.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              <Sparkles size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-800">No services found</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Artisan services submitted by verified sellers will appear here for verification.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Service & Category</th>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Pricing & Duration</th>
                    <th className="py-3 px-4">Verification Status</th>
                    <th className="py-3 px-4">Documents</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {services.map((service) => {
                    const isVerified = service.status === "APPROVED_VERIFIED";
                    const isPending = service.status === "PENDING_REVIEW";
                    const isSuspended = service.status === "SUSPENDED";

                    return (
                      <tr key={service.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {service.coverImage ? (
                              <img
                                src={service.coverImage}
                                alt={service.name}
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 font-bold text-xs">
                                ✦
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                {service.name}
                                {isVerified && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-800 font-bold text-[9.5px]">
                                    <BadgeCheck size={11} className="text-sky-600" />
                                    Verified
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 capitalize">{service.category?.replace("-", " ")}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">
                            {service.provider?.sellerProfile?.storeName || service.provider?.name || "Independent Artisan"}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">{service.provider?.email}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{money(service.price)}</div>
                          <div className="text-[11px] text-slate-500">{service.durationMinutes} mins • {service.pricingMethod}</div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider ${
                              isVerified
                                ? "bg-emerald-100 text-emerald-800"
                                : isPending
                                ? "bg-amber-100 text-amber-800 animate-pulse"
                                : isSuspended
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {service.status.replace("_", " ")}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 text-[11px] text-slate-600">
                            <FileText size={13} className="text-slate-400" />
                            <span>{service.documents?.length || 0} doc(s)</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedService(service)}
                            className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-medium rounded-lg text-xs transition inline-flex items-center gap-1.5"
                          >
                            <Eye size={13} />
                            Audit & Verify
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Bookings Tab */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {bookings.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              <Calendar size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-800">No service bookings yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Booking Ref</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Appointment Date & Slot</th>
                    <th className="py-3 px-4">Customer Contact</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-sky-700">{b.bookingNumber}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{b.service?.name}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {new Date(b.appointmentDate).toLocaleDateString()}
                        </div>
                        <div className="text-[11px] text-slate-400">{b.timeSlot}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{b.contactPhone || b.customerKey}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase bg-slate-100 text-slate-700">
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Service Audit & Verification Modal */}
      {selectedService && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-sky-600" size={22} />
                <h3 className="font-bold text-slate-900 text-base">Service Verification Audit</h3>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl">
                {selectedService.coverImage && (
                  <img
                    src={selectedService.coverImage}
                    alt={selectedService.name}
                    className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                  />
                )}
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{selectedService.name}</h4>
                  <p className="text-slate-500 mt-0.5">{selectedService.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-600">
                    <span><strong>Fee:</strong> {money(selectedService.price)} ({selectedService.pricingMethod})</span>
                    <span><strong>Duration:</strong> {selectedService.durationMinutes} mins</span>
                    <span><strong>Area:</strong> {selectedService.serviceArea}</span>
                  </div>
                </div>
              </div>

              {/* Provider Info */}
              <div className="p-3 border border-slate-200 rounded-xl">
                <h5 className="font-semibold text-slate-800 mb-1">Service Provider</h5>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>Name: <strong>{selectedService.provider?.name}</strong></div>
                  <div>Email: <span className="font-mono">{selectedService.provider?.email}</span></div>
                  <div>Store: <strong>{selectedService.provider?.sellerProfile?.storeName || "Direct Artisan"}</strong></div>
                </div>
              </div>

              {/* Uploaded Verification Documents */}
              <div className="p-3 border border-slate-200 rounded-xl">
                <h5 className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                  <FileText size={14} className="text-sky-600" />
                  Uploaded Verification Documents ({selectedService.documents?.length || 0})
                </h5>
                {selectedService.documents?.length === 0 ? (
                  <div className="text-slate-400 italic">No business certificates uploaded.</div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedService.documents?.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-700">{doc.title}</span>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-600 hover:underline font-semibold"
                        >
                          View Document
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Decision Form */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block font-semibold text-slate-800 mb-2">Verification Decision</label>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setVerifyAction("APPROVED_VERIFIED")}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      verifyAction === "APPROVED_VERIFIED"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "border-slate-200 hover:bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    <BadgeCheck size={16} />
                    Approve & Verify (Badge Awarded)
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerifyAction("SUSPENDED")}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      verifyAction === "SUSPENDED"
                        ? "bg-amber-600 text-white border-amber-600"
                        : "border-slate-200 hover:bg-amber-50 text-amber-800"
                    }`}
                  >
                    <Clock size={16} />
                    Suspend Service
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerifyAction("REJECTED")}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      verifyAction === "REJECTED"
                        ? "bg-rose-600 text-white border-rose-600"
                        : "border-slate-200 hover:bg-rose-50 text-rose-800"
                    }`}
                  >
                    <XCircle size={16} />
                    Reject Application
                  </button>
                </div>

                {(verifyAction === "REJECTED" || verifyAction === "SUSPENDED") && (
                  <div className="mb-3">
                    <label className="block text-slate-700 font-medium mb-1">Reason for Decision *</label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Explain reason for rejection or suspension..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedService(null)}
                    className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={!verifyAction || verifyLoading}
                    onClick={handleVerifySubmit}
                    className="px-5 py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white rounded-lg font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {verifyLoading ? "Saving Audit..." : "Save Verification Decision"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
