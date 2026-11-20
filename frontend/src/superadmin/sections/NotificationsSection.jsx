import React, { useState, useEffect } from "react";
import {
  Bell,
  AlertTriangle,
  Package,
  Store,
  MessageSquare,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  Truck,
  Sparkles,
  ShoppingBag,
  RotateCcw,
  CheckCheck,
} from "lucide-react";
import { api } from "../../api";

export default function NotificationsSection({ onNavigate }) {
  const [data, setData] = useState({ count: 0, unreadCount: 0, notifications: [] });
  const [loading, setLoading] = useState(true);
  const [autoPoll, setAutoPoll] = useState(true);

  const loadNotifications = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.adminGetNotifications();
      setData(res || { count: 0, unreadCount: 0, notifications: [] });
    } catch (err) {
      console.error("Notifications error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  // Poll for new notifications every 6s
  useEffect(() => {
    if (!autoPoll) return;
    const interval = setInterval(() => {
      loadNotifications(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoPoll]);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      loadNotifications(true);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (notif.id && !notif.id.startsWith("stock-") && !notif.id.startsWith("review-") && !notif.id.startsWith("seller-") && !notif.id.startsWith("prod-")) {
        await api.markNotificationRead(notif.id);
      }
    } catch (err) {
      // ignore
    }

    // Direct routing based on notification category
    if (notif.category === "NEW_ORDER" || notif.type === "new_order" || notif.link?.includes("orders")) {
      if (onNavigate) onNavigate("orders");
    } else if (notif.category === "NEW_REVIEW" || notif.type === "review" || notif.link?.includes("reviews")) {
      if (onNavigate) onNavigate("reviews");
    } else if (notif.category === "NEW_SERVICE_SUBMISSION" || notif.link?.includes("services")) {
      if (onNavigate) onNavigate("services");
    } else if (notif.category === "DELIVERY_ASSIGNED" || notif.category === "DELIVERY_FAILED" || notif.link?.includes("delivery")) {
      if (onNavigate) onNavigate("delivery");
    } else if (notif.type === "inventory") {
      if (onNavigate) onNavigate("inventory");
    } else if (notif.type === "seller") {
      if (onNavigate) onNavigate("sellers");
    }
  };

  const getIcon = (type, category) => {
    switch (category || type) {
      case "NEW_ORDER":
        return <ShoppingBag size={18} className="text-emerald-600" />;
      case "DELIVERY_ASSIGNED":
      case "OUT_FOR_DELIVERY":
      case "DELIVERED":
        return <Truck size={18} className="text-sky-600" />;
      case "DELIVERY_FAILED":
        return <AlertTriangle size={18} className="text-rose-600" />;
      case "RETURN_REFUND_REQUEST":
        return <RotateCcw size={18} className="text-purple-600" />;
      case "NEW_REVIEW":
        return <MessageSquare size={18} className="text-amber-600" />;
      case "NEW_SERVICE_SUBMISSION":
        return <Sparkles size={18} className="text-sky-600" />;
      case "inventory":
        return <Package size={18} className="text-amber-600" />;
      case "seller":
        return <Store size={18} className="text-indigo-600" />;
      default:
        return <Bell size={18} className="text-sky-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="text-sky-600" size={24} />
            In-App Notification Center ({data.count || 0})
            {data.unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold text-xs animate-pulse">
                {data.unreadCount} Unread
              </span>
            )}
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Real-time notifications for incoming orders, delivery updates, reviews, and service submissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
          >
            <CheckCheck size={14} className="text-emerald-600" />
            Mark All as Read
          </button>

          <button
            onClick={() => setAutoPoll(!autoPoll)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
              autoPoll ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoPoll ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            {autoPoll ? "Live Stream" : "Paused"}
          </button>

          <button
            onClick={() => loadNotifications(false)}
            className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition"
            title="Refresh alerts"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-sky-600" : ""} />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw size={15} className="animate-spin text-sky-600" />
            Scanning database for real-time notifications...
          </div>
        ) : !data.notifications || data.notifications.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-xs space-y-2">
            <CheckCircle size={36} className="mx-auto text-emerald-500 mb-1" />
            <p className="font-semibold text-slate-900 text-sm">All Clear!</p>
            <p className="text-[12px] max-w-sm mx-auto text-slate-400">
              There are no pending alerts or unread notifications at this moment.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 hover:bg-sky-50/50 transition-colors flex items-start justify-between gap-4 cursor-pointer ${
                  !n.isRead ? "bg-sky-50/20" : ""
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    {getIcon(n.type, n.category)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-[13px]">{n.title}</span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" title="Unread" />
                      )}
                      <span
                        className={`text-[9.5px] font-bold uppercase px-1.5 py-0.2 rounded ${
                          n.severity === "danger"
                            ? "bg-rose-100 text-rose-800"
                            : n.severity === "warning"
                            ? "bg-amber-100 text-amber-800"
                            : n.severity === "success"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {n.category || n.type}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-slate-600 mt-1 leading-snug">{n.message}</p>
                    <span className="text-[11px] text-slate-400 mt-1.5 inline-block">
                      {new Date(n.date).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-sky-600 text-xs font-semibold shrink-0 group-hover:translate-x-1 transition mt-2">
                  <span>View Details</span>
                  <ArrowRight size={13} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
