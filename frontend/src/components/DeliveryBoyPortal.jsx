import React, { useState, useEffect } from "react";
import {
  Truck, Package, CheckCircle2, Clock, MapPin, Phone,
  AlertCircle, KeyRound, DollarSign, ShieldCheck, X,
  ArrowRight, RefreshCw, UserCheck, Check, Navigation, AlertTriangle
} from "lucide-react";
import { api } from "../api";
import { money, Spinner } from "../ui";

const SERIF = { fontFamily: "'Cormorant Garamond', serif" };

export default function DeliveryBoyPortal({ user, onReturnToStore }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active"); // active, completed, all

  // Complete Delivery Modal (OTP Verification)
  const [completingOrder, setCompletingOrder] = useState(null);
  const [otp, setOtp] = useState("");
  const [cashCollected, setCashCollected] = useState(false);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [completeError, setCompleteError] = useState("");

  // Fail Delivery Modal
  const [failingOrder, setFailingOrder] = useState(null);
  const [failReason, setFailReason] = useState("Customer unavailable");
  const [failNotes, setFailNotes] = useState("");
  const [failSubmitting, setFailSubmitting] = useState(false);
  const [failError, setFailError] = useState("");

  // Registration Form State (if not yet registered)
  const [regPhone, setRegPhone] = useState("");
  const [regVehicleType, setRegVehicleType] = useState("Bike");
  const [regVehicleNum, setRegVehicleNum] = useState("");
  const [regArea, setRegArea] = useState("");
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regSuccess, setRegSuccess] = useState("");
  const [regError, setRegError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.getDeliveryDashboard();
      setData(res);
    } catch (err) {
      console.warn("Delivery dashboard fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegSubmitting(true);
    setRegError("");
    setRegSuccess("");
    try {
      await api.registerDeliveryProfile({
        phone: regPhone,
        vehicleType: regVehicleType,
        vehicleNumber: regVehicleNum,
        assignedArea: regArea
      });
      setRegSuccess("Profile submitted successfully! Awaiting Super Admin approval.");
      setTimeout(() => {
        loadDashboard();
      }, 1500);
    } catch (err) {
      setRegError(err.message || "Failed to register profile");
    } finally {
      setRegSubmitting(false);
    }
  };

  const handlePickup = async (orderId) => {
    try {
      await api.pickupDeliveryOrder(orderId);
      await loadDashboard();
    } catch (err) {
      alert("Error confirming pickup: " + err.message);
    }
  };

  const handleOutForDelivery = async (orderId) => {
    try {
      await api.startDeliveryOrder(orderId);
      await loadDashboard();
    } catch (err) {
      alert("Error updating status to Out for Delivery: " + err.message);
    }
  };

  const handleCompleteDelivery = async (e) => {
    e.preventDefault();
    if (!completingOrder) return;
    if (!otp.trim()) {
      setCompleteError("Customer handover OTP is required.");
      return;
    }
    setCompleteSubmitting(true);
    setCompleteError("");

    try {
      await api.completeDeliveryOrder(completingOrder.id, {
        otp: otp.trim(),
        cashCollected,
        notes: completeNotes.trim() || undefined
      });
      setCompletingOrder(null);
      setOtp("");
      setCashCollected(false);
      setCompleteNotes("");
      await loadDashboard();
    } catch (err) {
      setCompleteError(err.message || "OTP verification failed. Check the code provided by customer.");
    } finally {
      setCompleteSubmitting(false);
    }
  };

  const handleFailDelivery = async (e) => {
    e.preventDefault();
    if (!failingOrder) return;
    setFailSubmitting(true);
    setFailError("");

    try {
      await api.failDeliveryOrder(failingOrder.id, {
        reason: failReason,
        notes: failNotes.trim() || undefined
      });
      setFailingOrder(null);
      setFailNotes("");
      await loadDashboard();
    } catch (err) {
      setFailError(err.message || "Failed to record delivery attempt");
    } finally {
      setFailSubmitting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <Spinner label="Loading Delivery Portal..." />
      </div>
    );
  }

  const profile = data?.profile;
  const assignments = data?.assignments || [];

  // Filter assignments
  const activeAssignments = assignments.filter(
    (a) => a.status === "ASSIGNED" || a.status === "PICKED_UP" || a.status === "OUT_FOR_DELIVERY"
  );
  const completedAssignments = assignments.filter((a) => a.status === "DELIVERED");
  const displayedAssignments =
    activeTab === "active" ? activeAssignments :
    activeTab === "completed" ? completedAssignments : assignments;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
              <Truck size={18} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white flex items-center gap-2">
                Aurélie Logistics
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800">
                  Courier App
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadDashboard}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh assignments"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={onReturnToStore}
              className="text-xs px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              Return to Store
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {/* If no delivery profile exists or pending approval */}
        {!profile ? (
          <div className="max-w-lg mx-auto bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-sky-600/20 text-sky-400 border border-sky-500/30 flex items-center justify-center mb-4">
              <Truck size={24} />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2" style={SERIF}>
              Join Aurélie Delivery Fleet
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Register your courier profile to receive delivery assignments, package handovers, and doorstep OTP verification.
            </p>

            <form onSubmit={handleRegister} className="space-y-4">
              {regError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                  {regError}
                </div>
              )}
              {regSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs">
                  {regSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (555) 000-0000"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Vehicle Type</label>
                  <select
                    value={regVehicleType}
                    onChange={(e) => setRegVehicleType(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-sky-500"
                  >
                    <option>Bike</option>
                    <option>Motorcycle</option>
                    <option>Van</option>
                    <option>Car</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Vehicle Plate #</label>
                  <input
                    type="text"
                    placeholder="e.g. AUR-789"
                    value={regVehicleNum}
                    onChange={(e) => setRegVehicleNum(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Operational Area</label>
                <input
                  type="text"
                  placeholder="e.g. Downtown, Uptown, Midtown"
                  value={regArea}
                  onChange={(e) => setRegArea(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={regSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {regSubmitting ? "Submitting Application..." : "Submit Registration Application"}
              </button>
            </form>
          </div>
        ) : profile.approvalStatus !== "APPROVED" ? (
          <div className="max-w-lg mx-auto bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center shadow-xl">
            <Clock size={40} className="mx-auto mb-3 text-amber-400 animate-pulse" />
            <h2 className="text-xl font-semibold text-white mb-2">Registration Pending Approval</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed mb-6">
              Your delivery account is currently under review by the Super Admin team. Once approved, active delivery routes and assignments will appear here.
            </p>
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300 text-left space-y-1">
              <div><span className="text-slate-500">Status:</span> <span className="font-semibold text-amber-400">{profile.approvalStatus}</span></div>
              <div><span className="text-slate-500">Phone:</span> {profile.phone}</div>
              <div><span className="text-slate-500">Area:</span> {profile.assignedArea || "Marketplace Hub"}</div>
            </div>
          </div>
        ) : (
          <>
            {/* Courier Profile Status Banner */}
            <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-slate-900 rounded-2xl border border-sky-900/60 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold">
                  <UserCheck size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{user?.name || "Active Courier"}</h2>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                      <ShieldCheck size={12} /> Approved & Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                    <span>{profile.vehicleType} ({profile.vehicleNumber || "Unlisted"})</span>
                    <span>&bull;</span>
                    <span>Zone: {profile.assignedArea || "Platform Wide"}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6 w-full sm:w-auto justify-between sm:justify-start">
                <div className="text-left">
                  <p className="text-[10px] uppercase font-semibold text-slate-500">Active Drops</p>
                  <p className="text-2xl font-bold text-sky-400 font-mono">{data.stats?.inProgress || activeAssignments.length}</p>
                </div>
                <div className="text-left">
                  <p className="text-[10px] uppercase font-semibold text-slate-500">Delivered</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono">{data.stats?.delivered || profile.totalDeliveries || 0}</p>
                </div>
                <div className="text-left">
                  <p className="text-[10px] uppercase font-semibold text-slate-500">Rating</p>
                  <p className="text-2xl font-bold text-amber-400 font-mono">{Number(profile.rating || 5).toFixed(1)}</p>
                </div>
              </div>
            </div>

            {/* Assignments Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                onClick={() => setActiveTab("active")}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === "active"
                    ? "bg-sky-500 text-slate-950 shadow-sm"
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                Active Assignments ({activeAssignments.length})
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === "completed"
                    ? "bg-sky-500 text-slate-950 shadow-sm"
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                Delivered History ({completedAssignments.length})
              </button>
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === "all"
                    ? "bg-sky-500 text-slate-950 shadow-sm"
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                All Records ({assignments.length})
              </button>
            </div>

            {/* Assignments List */}
            {displayedAssignments.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 p-8">
                <Package size={36} className="mx-auto mb-3 text-slate-600" />
                <h3 className="text-sm text-slate-300 font-medium">No deliveries in this view</h3>
                <p className="text-xs text-slate-500 mt-1">
                  New package assignments from Super Admin will notify and show up here in real time.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedAssignments.map((asg) => {
                  const order = asg.order;
                  const isDelivered = asg.status === "DELIVERED";
                  const isOut = asg.status === "OUT_FOR_DELIVERY";
                  const isPicked = asg.status === "PICKED_UP";
                  const isAssigned = asg.status === "ASSIGNED";
                  const isCod = order?.paymentMethod === "Cash on Delivery" || order?.paymentMethod === "COD";

                  return (
                    <div
                      key={asg.id}
                      className="bg-slate-900 rounded-2xl border border-slate-800 p-5 hover:border-slate-700 transition shadow-sm space-y-4"
                    >
                      {/* Top Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/80 px-2.5 py-1 rounded-lg border border-sky-800">
                            #{order?.orderNumber || (order?.id ? order.id.slice(0, 10) : "...")}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isDelivered ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                            isOut ? "bg-amber-950 text-amber-300 border border-amber-800 animate-pulse" :
                            isPicked ? "bg-blue-950 text-blue-300 border border-blue-800" :
                            "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}>
                            {asg.status.replace(/_/g, " ")}
                          </span>
                        </div>

                        <div className="text-xs text-slate-400">
                          Assigned {new Date(asg.assignedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>

                      {/* Delivery Address & Customer */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                            <MapPin size={13} className="text-sky-400" />
                            Delivery Destination
                          </div>
                          <p className="text-xs text-slate-400 pl-4 leading-relaxed">
                            {order?.shippingAddress || "Customer address on record"}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                            <DollarSign size={13} className="text-emerald-400" />
                            Payment Collection
                          </div>
                          <div className="text-xs pl-4 space-y-0.5">
                            <div className="text-slate-300">
                              Order Total: <span className="font-bold text-white">{money(order?.total || 0)}</span>
                            </div>
                            <div className="text-[11px]">
                              {isCod ? (
                                <span className="text-amber-400 font-semibold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                                  Cash on Delivery &bull; Collect {money(order?.total || 0)} at doorstep
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-semibold">
                                  Prepaid via {order?.paymentMethod || "Card"} (Do not charge customer)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          Package Contents ({order?.items?.length || 0})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {order?.items?.map((it) => (
                            <span
                              key={it.id}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700/80"
                            >
                              {it.product?.name || "Ornament"} &times; {it.qty}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Workflow Actions */}
                      {!isDelivered && (
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                          <button
                            onClick={() => { setFailingOrder(asg); setFailError(""); }}
                            className="px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-950/40 rounded-xl border border-rose-900/60 transition flex items-center gap-1"
                          >
                            <AlertTriangle size={13} />
                            Report Delivery Issue
                          </button>

                          <div className="flex items-center gap-2 ml-auto">
                            {isAssigned && (
                              <button
                                onClick={() => handlePickup(order.id)}
                                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
                              >
                                <Package size={14} />
                                Confirm Package Pickup
                              </button>
                            )}

                            {isPicked && (
                              <button
                                onClick={() => handleOutForDelivery(order.id)}
                                className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-sm transition flex items-center gap-1.5 font-bold"
                              >
                                <Navigation size={14} />
                                Start Route (Out for Delivery)
                              </button>
                            )}

                            {isOut && (
                              <button
                                onClick={() => { setCompletingOrder(asg); setCompleteError(""); }}
                                className="px-5 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-md transition flex items-center gap-2"
                              >
                                <KeyRound size={15} />
                                Verify Handover OTP & Complete
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Delivery Completion Confirmation Info */}
                      {isDelivered && (
                        <div className="flex items-center justify-between pt-2 text-xs text-emerald-400 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={14} />
                            Handover verified via Customer OTP on {new Date(asg.deliveredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Complete Handover (OTP Verification) Modal */}
      {completingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-2xl border border-sky-800/80 shadow-2xl max-w-md w-full overflow-hidden text-slate-100">
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 p-5 border-b border-emerald-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <KeyRound size={18} />
                Handover OTP Verification
              </div>
              <button
                onClick={() => setCompletingOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCompleteDelivery} className="p-6 space-y-4">
              {completeError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  {completeError}
                </div>
              )}

              <p className="text-xs text-slate-300">
                Ask the customer for their unique 4-digit handover OTP from their order confirmation or tracking screen.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Customer 4-Digit Handover OTP *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="e.g. 4892"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full text-center tracking-widest font-mono text-2xl font-black py-3 rounded-xl bg-slate-950 border border-sky-700 text-sky-400 outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              {/* Cash Reconciliation */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-200">
                  <input
                    type="checkbox"
                    checked={cashCollected}
                    onChange={(e) => setCashCollected(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-0 bg-slate-800 border-slate-700"
                  />
                  <span>
                    Confirm Payment Received ({money(completingOrder.order?.total || 0)})
                  </span>
                </label>
                <p className="text-[11px] text-slate-400 pl-6 leading-relaxed">
                  For Cash on Delivery orders, this confirms cash has been physically collected and reconciled.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Handover Notes / Evidence (optional)
                </label>
                <input
                  type="text"
                  placeholder="Handed over directly to customer / porch drop"
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompletingOrder(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completeSubmitting}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {completeSubmitting ? "Verifying OTP..." : "Confirm Delivery Handover"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Failed Delivery Attempt Modal */}
      {failingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-2xl border border-rose-900/60 shadow-2xl max-w-md w-full overflow-hidden text-slate-100">
            <div className="bg-gradient-to-r from-rose-950 to-slate-900 p-5 border-b border-rose-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <AlertTriangle size={18} />
                Report Failed Delivery Attempt
              </div>
              <button
                onClick={() => setFailingOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFailDelivery} className="p-6 space-y-4">
              {failError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                  {failError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason for Attempt Failure *
                </label>
                <select
                  value={failReason}
                  onChange={(e) => setFailReason(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-rose-500"
                >
                  <option>Customer unavailable / not answering door or phone</option>
                  <option>Incorrect or incomplete address</option>
                  <option>Customer requested delivery reschedule</option>
                  <option>Customer rejected parcel</option>
                  <option>Premises access restricted / security gate closed</option>
                  <option>Severe weather conditions / road blockage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Attempt Details & Reschedule Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Tried calling customer 2 times. Left voicemail to re-attempt tomorrow morning."
                  value={failNotes}
                  onChange={(e) => setFailNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFailingOrder(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={failSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {failSubmitting ? "Recording Attempt..." : "Record Failed Attempt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
