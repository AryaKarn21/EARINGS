import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  Truck,
  Package,
  Clock,
  XCircle,
  X,
  CreditCard,
  MapPin,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  BadgeCheck,
} from "lucide-react";
import { api } from "../../api";
import { money } from "../../ui";

export default function OrdersSection({ onNavigate }) {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [autoPoll, setAutoPoll] = useState(true);

  // Delivery personnel list for assignment
  const [deliveryPersonnel, setDeliveryPersonnel] = useState([]);

  // Assignment Modal
  const [orderToAssign, setOrderToAssign] = useState(null);
  const [selectedCourierId, setSelectedCourierId] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Refund Modal
  const [orderToRefund, setOrderToRefund] = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const loadOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.adminGetOrders({
        q: search,
        status: statusFilter,
        deliveryStatus: deliveryFilter,
        paymentStatus: paymentFilter,
        page,
        limit: 15,
      });
      setOrders(res.orders || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error("Orders error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadApprovedCouriers = async () => {
    try {
      const res = await api.adminGetDeliveryPersonnel({ status: "APPROVED" });
      setDeliveryPersonnel(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Failed to load couriers:", err);
    }
  };

  // Initial & Filter fetch
  useEffect(() => {
    loadOrders();
    loadApprovedCouriers();
  }, [search, statusFilter, deliveryFilter, paymentFilter, page]);

  // Real-time live order polling (every 8s)
  useEffect(() => {
    if (!autoPoll) return;
    const interval = setInterval(() => {
      loadOrders(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [autoPoll, search, statusFilter, deliveryFilter, paymentFilter, page]);

  const openOrderDetail = async (order) => {
    setSelectedOrder(order);
    setCustomerInfo(null);
    try {
      const res = await api.adminGetOrder(order.id);
      setSelectedOrder(res.order);
      setCustomerInfo(res.customer);
    } catch (err) {
      console.error("Order detail error:", err);
    }
  };

  const handleAssignDelivery = async (e) => {
    e.preventDefault();
    if (!orderToAssign || !selectedCourierId) return;
    setAssigning(true);
    try {
      await api.adminAssignDelivery(orderToAssign.id, {
        deliveryPersonId: selectedCourierId,
        notes: assignmentNotes,
      });
      setOrderToAssign(null);
      setSelectedCourierId("");
      setAssignmentNotes("");
      loadOrders(true);
    } catch (err) {
      alert("Failed to assign delivery: " + err.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedOrder) return;
    setStatusUpdating(true);
    try {
      const updated = await api.adminUpdateOrderStatus(selectedOrder.id, newStatus);
      setSelectedOrder((prev) => ({ ...prev, status: updated.status }));
      loadOrders(true);
    } catch (err) {
      alert("Failed to update order status: " + err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleProcessRefund = async (e) => {
    e.preventDefault();
    if (!orderToRefund) return;
    setRefunding(true);
    try {
      await api.adminRefundOrder(orderToRefund.id, {
        reason: refundReason || "Administrator issued refund",
      });
      setOrderToRefund(null);
      setRefundReason("");
      loadOrders(true);
      if (selectedOrder?.id === orderToRefund.id) {
        setSelectedOrder((prev) => ({ ...prev, paymentStatus: "REFUNDED" }));
      }
    } catch (err) {
      alert("Refund failed: " + err.message);
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="text-sky-600" size={24} />
            Order Fulfillment & Delivery Management ({total})
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Real-time orders queue, delivery boy dispatch assignment, cash-on-delivery reconciliation, and audit tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Real-time Polling indicator */}
          <button
            onClick={() => setAutoPoll(!autoPoll)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              autoPoll
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-slate-50 border-slate-200 text-slate-600"
            }`}
            title="Auto-refresh incoming orders without page refresh"
          >
            <span className={`w-2 h-2 rounded-full ${autoPoll ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            {autoPoll ? "Live Order Feed" : "Polling Paused"}
          </button>

          <button
            onClick={() => loadOrders(false)}
            className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition"
            title="Refresh orders now"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-sky-600" : ""} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by order #, ID, customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Order Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="">All Order Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Delivery Status */}
          <select
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="">All Delivery Statuses</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="PICKED_UP">Picked Up</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="FAILED">Delivery Failed</option>
          </select>

          {/* Payment Status */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="">All Payment Statuses</option>
            <option value="PENDING">Payment Pending (COD)</option>
            <option value="PENDING_PAYMENT">Payment Pending (Online)</option>
            <option value="PAID">Paid</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw size={15} className="animate-spin text-sky-600" />
            Loading orders from Neon PostgreSQL...
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <ShoppingBag size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-800">No orders match criteria</p>
            <p className="text-[11px] text-slate-400 mt-1">Try adjusting search query or active filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Date & Customer</th>
                  <th className="py-3 px-4">Items & Amount</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Delivery Courier</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => {
                  const orderNum = o.orderNumber || `AUR-${o.id.slice(0, 8).toUpperCase()}`;
                  const customerName = o.shippingAddress?.name || "Customer";
                  const isDelivered = o.status === "Delivered" && o.deliveryStatus === "DELIVERED";
                  const isAssigned = o.deliveryPersonId != null;

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Order Number */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-sky-700 flex items-center gap-1.5">
                          {orderNum}
                          {o.isReturnRequested && (
                            <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[9px] font-bold rounded">
                              Return Req
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{o.id}</div>
                      </td>

                      {/* Date & Customer */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{customerName}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={11} />
                          {new Date(o.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Items & Amount */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{money(o.total || 0)}</div>
                        <div className="text-[11px] text-slate-500">
                          {o.items?.length || 0} item(s) • {o.paymentMethod?.toUpperCase()}
                        </div>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase ${
                            o.paymentStatus === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : o.paymentStatus === "REFUNDED"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {o.paymentStatus || "PENDING"}
                        </span>
                      </td>

                      {/* Assigned Delivery Courier */}
                      <td className="py-3 px-4">
                        {isAssigned ? (
                          <div>
                            <div className="font-medium text-slate-800 flex items-center gap-1">
                              <Truck size={12} className="text-sky-600" />
                              {o.deliveryPerson?.name || "Assigned Driver"}
                            </div>
                            <div className="text-[10px] text-sky-600 font-semibold uppercase">
                              {o.deliveryStatus}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setOrderToAssign(o);
                              setSelectedCourierId(deliveryPersonnel[0]?.id || "");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold rounded-lg text-[11px] transition"
                          >
                            <Truck size={12} />
                            Assign Driver
                          </button>
                        )}
                      </td>

                      {/* Order Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase ${
                            o.status === "Delivered"
                              ? "bg-emerald-100 text-emerald-800"
                              : o.status === "Shipped"
                              ? "bg-sky-100 text-sky-800"
                              : o.status === "Processing"
                              ? "bg-blue-100 text-blue-800"
                              : o.status === "Cancelled"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAssigned && !isDelivered && o.status !== "Cancelled" && (
                            <button
                              onClick={() => {
                                setOrderToAssign(o);
                                setSelectedCourierId(o.deliveryPersonId || deliveryPersonnel[0]?.id || "");
                              }}
                              className="px-2 py-1 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg text-[11px] font-medium transition"
                              title="Reassign delivery courier"
                            >
                              Reassign
                            </button>
                          )}

                          <button
                            onClick={() => openOrderDetail(o)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-[11px] transition inline-flex items-center gap-1"
                          >
                            <Eye size={12} />
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing page {page} of {totalPages} ({total} orders)
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Assign Delivery Courier Modal */}
      {orderToAssign && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Truck className="text-sky-600" size={20} />
                <h3 className="font-semibold text-slate-900 text-sm">
                  Assign Delivery Courier for #{orderToAssign.orderNumber || orderToAssign.id.slice(0, 8)}
                </h3>
              </div>
              <button
                onClick={() => setOrderToAssign(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAssignDelivery} className="mt-4 space-y-4">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Select Approved Courier *</label>
                {deliveryPersonnel.length === 0 ? (
                  <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs">
                    No approved delivery personnel available. Please add or approve delivery staff in the Delivery Personnel tab first.
                  </div>
                ) : (
                  <select
                    value={selectedCourierId}
                    onChange={(e) => setSelectedCourierId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                  >
                    <option value="">Choose an approved driver...</option>
                    {deliveryPersonnel.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} — {d.assignedArea} ({d.vehicleType})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Dispatch / Courier Instructions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Fragile gold filigree ornament. Require OTP verification on doorstep."
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Destination:</span>
                  <span className="font-medium text-slate-800">{orderToAssign.shippingAddress?.address || "Standard Address"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Order Total:</span>
                  <span className="font-bold text-slate-900">{money(orderToAssign.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Collection:</span>
                  <span className="font-semibold text-sky-700">{orderToAssign.paymentMethod === 'cod' ? 'Cash on Delivery (Reconciliation Required)' : 'Prepaid'}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOrderToAssign(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedCourierId || assigning}
                  className="px-4 py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white rounded-lg font-medium shadow-sm transition disabled:opacity-50"
                >
                  {assigning ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  Order #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase bg-slate-100 text-slate-700">
                    {selectedOrder.status}
                  </span>
                </h3>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">{selectedOrder.id}</div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Delivery OTP & Status Badge */}
              <div className="p-3 bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-sky-800 uppercase tracking-wider">
                    Customer Delivery OTP
                  </div>
                  <div className="font-mono text-xl font-bold text-sky-900 tracking-widest mt-0.5">
                    {selectedOrder.deliveryOtp || "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">Delivery Status</div>
                  <div className="font-bold text-slate-800 uppercase tracking-wide">
                    {selectedOrder.deliveryStatus}
                  </div>
                </div>
              </div>

              {/* Delivery Proof (if completed) */}
              {selectedOrder.deliveryProof && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs mb-1">
                    <BadgeCheck size={16} />
                    Verified Delivery Handover Completed
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 text-[11px]">
                    <div>Recipient: <strong>{selectedOrder.deliveryProof.recipientName || "Customer"}</strong></div>
                    <div>Timestamp: {new Date(selectedOrder.deliveryProof.timestamp).toLocaleString()}</div>
                    {selectedOrder.deliveryProof.cashCollected != null && (
                      <div>Cash Collected: <strong>{money(selectedOrder.deliveryProof.cashCollected)}</strong> (Reconciled)</div>
                    )}
                    <div>Courier Verified OTP: <span className="font-mono font-bold">{selectedOrder.deliveryProof.otpUsed}</span></div>
                  </div>
                </div>
              )}

              {/* Line Items */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Purchased Items ({selectedOrder.items?.length || 0})</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-400">
                          Qty: {item.qty} × {money(item.price)}
                        </div>
                      </div>
                      <div className="font-bold text-slate-900">
                        {money(item.price * item.qty)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping & Payment Details */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <h5 className="font-semibold text-slate-800 mb-1">Shipping Details</h5>
                  <div className="text-slate-600">
                    <div>{selectedOrder.shippingAddress?.name || customerInfo?.name}</div>
                    <div>{selectedOrder.shippingAddress?.address}</div>
                    <div>{selectedOrder.shippingAddress?.city}</div>
                  </div>
                </div>
                <div>
                  <h5 className="font-semibold text-slate-800 mb-1">Payment Reconciliation</h5>
                  <div className="text-slate-600 space-y-0.5">
                    <div>Method: <strong className="uppercase">{selectedOrder.paymentMethod}</strong></div>
                    <div>Status: <strong className="text-emerald-700">{selectedOrder.paymentStatus}</strong></div>
                    <div>Total: <strong className="text-slate-900 text-sm">{money(selectedOrder.total)}</strong></div>
                  </div>
                </div>
              </div>

              {/* Status Update & Actions */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">Transition Status:</span>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => handleUpdateStatus(e.target.value)}
                    disabled={statusUpdating}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-medium text-slate-800 focus:outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {selectedOrder.paymentStatus !== "REFUNDED" && (
                    <button
                      type="button"
                      onClick={() => setOrderToRefund(selectedOrder)}
                      className="px-3 py-1.5 border border-purple-200 text-purple-700 hover:bg-purple-50 rounded-lg font-medium transition flex items-center gap-1"
                    >
                      <RotateCcw size={13} />
                      Issue Refund
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {orderToRefund && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-xs">
            <h3 className="font-semibold text-slate-900 text-sm mb-2 flex items-center gap-2">
              <RotateCcw size={16} className="text-purple-600" />
              Process Order Refund
            </h3>
            <p className="text-slate-500 mb-3">
              Refund full amount of <strong>{money(orderToRefund.total)}</strong> for order #{orderToRefund.orderNumber}?
            </p>
            <form onSubmit={handleProcessRefund} className="space-y-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Reason for Refund *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Return approved, customer cancelled before dispatch"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderToRefund(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refunding}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
                >
                  {refunding ? "Processing..." : "Confirm Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
