import React, { useState, useEffect } from "react";
import {
  Truck,
  UserCheck,
  UserX,
  Plus,
  Search,
  RefreshCw,
  Phone,
  MapPin,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronRight,
  Eye,
  X,
  FileText,
  BadgeCheck,
} from "lucide-react";
import { api } from "../../api";

export default function DeliverySection({ onNavigate }) {
  const [deliveryStaff, setDeliveryStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    phone: "",
    assignedArea: "Downtown & North District",
    vehicleType: "Motorcycle / Van",
    password: "Password123!",
  });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  // Status Dialog
  const [selectedPersonnel, setSelectedPersonnel] = useState(null);
  const [statusAction, setStatusAction] = useState(null); // 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadDeliveryStaff = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetDeliveryPersonnel({
        q: search,
        status: statusFilter,
      });
      setDeliveryStaff(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Failed to load delivery personnel:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveryStaff();
  }, [search, statusFilter]);

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email) return;
    setInviteSubmitting(true);
    try {
      await api.adminInviteDeliveryPersonnel(inviteForm);
      setShowInviteModal(false);
      setInviteForm({
        name: "",
        email: "",
        phone: "",
        assignedArea: "Downtown & North District",
        vehicleType: "Motorcycle / Van",
        password: "Password123!",
      });
      loadDeliveryStaff();
    } catch (err) {
      alert("Failed to create delivery account: " + err.message);
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleStatusChange = async (targetPersonnel, targetStatus) => {
    setSelectedPersonnel(targetPersonnel);
    setStatusAction(targetStatus);
    setRejectionReason("");
  };

  const confirmStatusChange = async () => {
    if (!selectedPersonnel || !statusAction) return;
    setActionLoading(true);
    try {
      await api.adminUpdateDeliveryPersonnelStatus(selectedPersonnel.id, {
        status: statusAction,
        rejectionReason: statusAction === "REJECTED" ? rejectionReason : null,
      });
      setSelectedPersonnel(null);
      setStatusAction(null);
      loadDeliveryStaff();
    } catch (err) {
      alert("Failed to update status: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Metrics
  const totalCount = deliveryStaff.length;
  const approvedCount = deliveryStaff.filter((d) => d.status === "APPROVED").length;
  const pendingCount = deliveryStaff.filter((d) => d.status === "PENDING").length;
  const totalDelivered = deliveryStaff.reduce((sum, d) => sum + (d.metrics?.completed || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="text-sky-600" size={24} />
            Delivery Personnel Management ({totalCount})
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Register, approve, suspend, and monitor dedicated delivery drivers across marketplace zones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-medium text-xs rounded-xl shadow-sm transition"
          >
            <Plus size={15} />
            Add Delivery Person
          </button>
          <button
            onClick={loadDeliveryStaff}
            className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition"
            title="Refresh list"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-sky-600" : ""} />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Fleet</span>
            <Truck size={16} className="text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active delivery accounts</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-medium">
            <span>Approved & Active</span>
            <BadgeCheck size={16} />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{approvedCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Eligible for assignments</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 text-xs font-medium">
            <span>Pending Review</span>
            <Clock size={16} />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{pendingCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Verification required</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-sky-600 text-xs font-medium">
            <span>Delivered Packages</span>
            <CheckCircle size={16} />
          </div>
          <div className="text-2xl font-bold text-sky-900 mt-1">{totalDelivered}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">With customer OTP verification</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search delivery personnel by name or email..."
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
            <option value="">All Statuses</option>
            <option value="APPROVED">Approved Only</option>
            <option value="PENDING">Pending Review</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Delivery Personnel Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw size={15} className="animate-spin text-sky-600" />
            Loading delivery personnel...
          </div>
        ) : deliveryStaff.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <Truck size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-800">No delivery personnel found</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Add delivery drivers using the "Add Delivery Person" button above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Courier Profile</th>
                  <th className="py-3 px-4">Contact & Area</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Status & Duty</th>
                  <th className="py-3 px-4">Performance</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveryStaff.map((person) => {
                  const isApproved = person.status === "APPROVED";
                  const isPending = person.status === "PENDING";
                  const isSuspended = person.status === "SUSPENDED";

                  return (
                    <tr key={person.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-400 to-sky-600 text-white font-bold flex items-center justify-center text-xs">
                            {person.name?.charAt(0) || "D"}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{person.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{person.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Phone size={12} className="text-slate-400" />
                          <span>{person.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5">
                          <MapPin size={11} className="text-sky-500" />
                          <span>{person.assignedArea}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium">
                          {person.vehicleType}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider ${
                              isApproved
                                ? "bg-emerald-100 text-emerald-800"
                                : isPending
                                ? "bg-amber-100 text-amber-800"
                                : isSuspended
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {person.status}
                          </span>
                          {person.isAvailable && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" title="Available for immediate assignment" />
                          )}
                        </div>
                        {person.rejectionReason && (
                          <div className="text-[10px] text-rose-600 mt-1 max-w-[180px] truncate" title={person.rejectionReason}>
                            Note: {person.rejectionReason}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-[11px] text-slate-700 font-medium">
                          <span className="text-emerald-600 font-bold">{person.metrics?.completed || 0}</span> delivered
                          {person.metrics?.active > 0 && (
                            <span className="text-sky-600 ml-1.5">({person.metrics.active} active)</span>
                          )}
                        </div>
                        {person.metrics?.failed > 0 && (
                          <div className="text-[10px] text-rose-500">{person.metrics.failed} failed attempt(s)</div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <button
                              onClick={() => handleStatusChange(person, "APPROVED")}
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg text-[11px] transition"
                            >
                              Approve
                            </button>
                          )}

                          {isApproved && (
                            <button
                              onClick={() => handleStatusChange(person, "SUSPENDED")}
                              className="px-2.5 py-1 border border-rose-200 hover:bg-rose-50 text-rose-600 font-medium rounded-lg text-[11px] transition"
                            >
                              Suspend
                            </button>
                          )}

                          {isSuspended && (
                            <button
                              onClick={() => handleStatusChange(person, "APPROVED")}
                              className="px-2.5 py-1 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg text-[11px] transition"
                            >
                              Re-activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Invite Delivery Personnel Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Truck className="text-sky-600" size={20} />
                <h3 className="font-semibold text-slate-900 text-sm">Add Delivery Personnel</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Joshi"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="vikram.delivery@example.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Vehicle Type</label>
                  <select
                    value={inviteForm.vehicleType}
                    onChange={(e) => setInviteForm({ ...inviteForm, vehicleType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  >
                    <option value="Motorcycle / Scooter">Motorcycle / Scooter</option>
                    <option value="Electric Bike">Electric Bike</option>
                    <option value="Courier Van">Courier Van</option>
                    <option value="Bicycle">Bicycle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Assigned Delivery Area</label>
                <input
                  type="text"
                  placeholder="e.g. Central Mumbai & Bandra"
                  value={inviteForm.assignedArea}
                  onChange={(e) => setInviteForm({ ...inviteForm, assignedArea: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Initial Password</label>
                <input
                  type="text"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="px-4 py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white rounded-lg font-medium shadow-sm transition disabled:opacity-50"
                >
                  {inviteSubmitting ? "Creating Account..." : "Create & Approve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation / Reason Modal */}
      {selectedPersonnel && statusAction && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-xs">
            <h3 className="font-semibold text-slate-900 text-sm mb-2">
              Confirm Status Change: {statusAction}
            </h3>
            <p className="text-slate-500 mb-4">
              Are you sure you want to change the status of <strong>{selectedPersonnel.name}</strong> to{" "}
              <strong className="text-sky-600">{statusAction}</strong>?
            </p>

            {statusAction === "REJECTED" && (
              <div className="mb-4">
                <label className="block text-slate-700 font-medium mb-1">Reason for Rejection *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide reason for rejecting application..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedPersonnel(null);
                  setStatusAction(null);
                }}
                className="px-3.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={confirmStatusChange}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {actionLoading ? "Updating..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
