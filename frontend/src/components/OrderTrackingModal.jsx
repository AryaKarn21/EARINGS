import React, { useState, useEffect, useCallback } from "react";
import {
  X, CheckCircle2, Clock, Truck, Package, ShieldCheck,
  AlertCircle, RefreshCw, KeyRound, MapPin, Phone, User,
  DollarSign, RotateCcw, Ban
} from "lucide-react";
import { api } from "../api";
import { money } from "../ui";

const SERIF = { fontFamily: "'Cormorant Garamond', serif" };

const STEPS = [
  { key: "Placed", label: "Order Placed", desc: "Order recorded & awaiting confirmation" },
  { key: "Confirmed", label: "Confirmed", desc: "Verified & sent to artisan" },
  { key: "Preparing", label: "Preparing", desc: "Jewelry crafted & packed" },
  { key: "Dispatched", label: "Dispatched", desc: "Assigned to delivery courier" },
  { key: "Out for Delivery", label: "Out for Delivery", desc: "Courier is on the way" },
  { key: "Delivered", label: "Delivered", desc: "Safely received with OTP verification" }
];

function getStepIndex(status) {
  if (status === "Delivered") return 5;
  if (status === "Out for Delivery") return 4;
  if (status === "Dispatched" || status === "Ready for Dispatch") return 3;
  if (status === "Preparing" || status === "Processing") return 2;
  if (status === "Confirmed") return 1;
  return 0; // Placed / Pending
}

export default function OrderTrackingModal({ orderId, onClose, onRefreshList }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.trackOrder(orderId);
      setOrder(data);
    } catch (err) {
      setError(err.message || "Failed to load tracking information");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancel = async () => {
    const reason = window.prompt("Reason for cancellation (optional):", "Changed mind");
    if (reason === null) return;
    setActionLoading(true);
    try {
      await api.cancelOrder(orderId, reason);
      setActionMsg("Order successfully cancelled.");
      await loadData();
      if (onRefreshList) onRefreshList();
    } catch (err) {
      alert("Error cancelling order: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async () => {
    const reason = window.prompt("Please state the reason for requesting a return:", "Defective item or sizing issue");
    if (!reason) return;
    setActionLoading(true);
    try {
      await api.returnOrder(orderId, reason);
      setActionMsg("Return request submitted. Our team will contact you shortly.");
      await loadData();
      if (onRefreshList) onRefreshList();
    } catch (err) {
      alert("Error requesting return: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!orderId) return null;

  const currentStep = order ? getStepIndex(order.status) : 0;
  const isCancelled = order?.status === "Cancelled";
  const isFailed = order?.deliveryStatus === "FAILED" || order?.deliveryStatus === "ATTEMPTED";
  const canCancel = order && (order.status === "Placed" || order.status === "Pending" || order.status === "Confirmed");
  const canReturn = order && order.status === "Delivered";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-sky-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold tracking-wider uppercase mb-1">
            <Truck size={15} />
            Live Shipment Tracking
          </div>
          <h2 className="text-2xl font-normal text-white" style={SERIF}>
            Order #{order?.orderNumber || (order?.id ? order.id.slice(0, 10) : "...")}
          </h2>
          <p className="text-xs text-sky-200 mt-1">
            Placed on {order?.createdAt ? new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "..."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              order?.status === "Delivered" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
              isCancelled ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" :
              "bg-sky-400/20 text-sky-200 border border-sky-400/30"
            }`}>
              Order: {order?.status || "Loading..."}
            </span>

            {order?.deliveryStatus && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-slate-100 border border-white/20">
                Delivery: {order.deliveryStatus}
              </span>
            )}

            <button
              onClick={loadData}
              disabled={loading}
              className="ml-auto text-xs text-sky-200 hover:text-white flex items-center gap-1 transition px-2 py-1 rounded bg-white/5 hover:bg-white/10"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {loading && !order && (
            <div className="text-center py-12 text-slate-400">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-sky-600" />
              Loading real-time order tracking details...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              {error}
            </div>
          )}

          {actionMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              {actionMsg}
            </div>
          )}

          {order && (
            <>
              {/* Delivery OTP Notice (Only if not yet delivered) */}
              {order.status !== "Delivered" && !isCancelled && order.deliveryOtp && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0">
                      <KeyRound size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-sky-900 uppercase tracking-wide">
                        Your Secure Handover OTP
                      </p>
                      <p className="text-xs text-sky-700 mt-0.5">
                        Share this 4-digit code with your courier when receiving the package:
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-2xl font-black text-sky-900 tracking-widest bg-white px-3 py-1.5 rounded-lg border border-sky-300 shadow-sm inline-block">
                      {order.deliveryOtp}
                    </span>
                  </div>
                </div>
              )}

              {/* Cancelled Alert */}
              {isCancelled && (
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 flex items-center gap-3">
                  <Ban size={22} className="text-rose-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">This order was cancelled</p>
                    <p className="text-xs text-slate-500 mt-0.5">Refund processing has been initiated to your original payment method.</p>
                  </div>
                </div>
              )}

              {/* Visual Step Timeline */}
              {!isCancelled && (
                <div className="py-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                    Delivery Progression
                  </p>
                  <div className="relative">
                    {/* Progress Bar Background */}
                    <div className="absolute top-4 left-4 right-4 h-1 bg-slate-200 -z-0" />
                    <div
                      className="absolute top-4 left-4 h-1 bg-sky-600 transition-all duration-500 -z-0"
                      style={{ width: `${(Math.min(currentStep, 5) / 5) * 100}%` }}
                    />

                    {/* Step Nodes */}
                    <div className="grid grid-cols-6 gap-1 relative z-10">
                      {STEPS.map((s, idx) => {
                        const isDone = idx < currentStep || order.status === "Delivered";
                        const isCurrent = idx === currentStep && order.status !== "Delivered";
                        return (
                          <div key={s.key} className="flex flex-col items-center text-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition shadow-sm ${
                              isDone ? "bg-emerald-600 text-white ring-4 ring-emerald-100" :
                              isCurrent ? "bg-sky-600 text-white ring-4 ring-sky-200 animate-pulse" :
                              "bg-white border-2 border-slate-300 text-slate-400"
                            }`}>
                              {isDone ? <CheckCircle2 size={16} /> : idx + 1}
                            </div>
                            <p className={`text-[11px] font-semibold mt-2 leading-tight ${
                              isDone ? "text-emerald-800" : isCurrent ? "text-sky-900 font-bold" : "text-slate-400"
                            }`}>
                              {s.label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Courier Information Card */}
              {order.deliveryPerson && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Assigned Delivery Personnel
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{order.deliveryPerson.name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          {order.deliveryPerson.vehicleType && (
                            <span>Vehicle: {order.deliveryPerson.vehicleType}</span>
                          )}
                          {order.deliveryPerson.vehicleNumber && (
                            <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-[10px]">{order.deliveryPerson.vehicleNumber}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {order.deliveryPerson.phone && (
                      <a
                        href={`tel:${order.deliveryPerson.phone}`}
                        className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Phone size={13} />
                        Call Courier
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Order Items Summary */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Items in this Package ({order.items?.length || 0})
                </p>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {order.items?.map((it) => (
                    <div key={it.id} className="p-3.5 flex items-center justify-between bg-white text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 shrink-0 font-bold">
                          <Package size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{it.product?.name || "Handcrafted Ornament"}</p>
                          <p className="text-slate-500 text-[11px]">Qty: {it.qty} × {money(it.price)}</p>
                        </div>
                      </div>
                      <div className="text-right font-semibold text-slate-900">
                        {money(it.price * it.qty)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping & Payment Details */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                    <MapPin size={14} className="text-sky-600" />
                    Shipping Destination
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {order.shippingAddress || "Provided shipping address on file"}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                    <DollarSign size={14} className="text-sky-600" />
                    Payment Summary
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span>Method:</span>
                      <span className="font-semibold text-slate-800">{order.paymentMethod || "Card"}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Status:</span>
                      <span className={`font-semibold ${order.paymentStatus === "Paid" ? "text-emerald-700" : "text-amber-700"}`}>
                        {order.paymentStatus}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
                      <span>Total:</span>
                      <span>{money(order.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status History Audit Trail */}
              {order.statusHistory && order.statusHistory.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Shipment Activity Log
                  </p>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                    {order.statusHistory.map((h, i) => (
                      <div key={h.id || i} className="flex items-start justify-between text-xs text-slate-600 border-b border-slate-100 last:border-b-0 pb-1.5 last:pb-0">
                        <div className="flex items-center gap-2">
                          <Clock size={12} className="text-slate-400" />
                          <span className="font-semibold text-slate-800">{h.status}</span>
                          {h.notes && <span className="text-slate-500 text-[11px]">— {h.notes}</span>}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition"
              >
                Cancel Order
              </button>
            )}

            {canReturn && (
              <button
                onClick={handleReturn}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                Request Return
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
