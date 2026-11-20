import React, { useState, useEffect } from "react";
import {
  Clock,
  Search,
  Filter,
  RefreshCw,
  Shield,
  ChevronLeft,
  ChevronRight,
  Code,
} from "lucide-react";
import { api } from "../../api";

const TARGET_TYPES = [
  "Product",
  "Category",
  "User",
  "Review",
  "Order",
  "SellerProfile",
  "ImageAsset",
  "SiteSetting",
  "Banner",
  "Coupon",
];

export default function AuditLogsSection() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [targetType, setTargetType] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetAuditLogs({
        targetType,
        page,
        limit: 25,
      });
      setLogs(res.logs || []);
      setTotal(res.total || res.count || 0);
    } catch (err) {
      console.error("Audit log error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [targetType, page]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
            Security & Administrative Audit Logs ({total})
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Immutable, append-only historical audit trail recording every administrative creation, role change, and mutation.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="p-2 border border-border rounded-lg bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          title="Refresh audit log"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value);
              setPage(1);
            }}
            className="text-[12.5px] px-3 py-2 bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark"
          >
            <option value="">All Target Entities</option>
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
            <RefreshCw size={15} className="animate-spin text-primaryDark" /> Loading audit trail from PostgreSQL...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-textSecondary text-[13px]">
            No audit log entries recorded for this filter.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/60 transition-colors space-y-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-[13px] text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                      <span className="text-[12.5px] font-medium text-primaryDark">
                        {log.targetType} #{log.targetId ? log.targetId.slice(0, 8) : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[12px] text-textSecondary">
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded font-semibold text-[10.5px]">
                        {log.actorRole}
                      </span>
                      <span className="font-mono text-slate-500">
                        {log.actorOwnerKey ? log.actorOwnerKey.slice(0, 10) : "system"}
                      </span>
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Toggle view diff button */}
                  {(log.before || log.after) && (
                    <div className="pt-1">
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-[11.5px] text-primaryDark hover:underline flex items-center gap-1 font-medium"
                      >
                        <Code size={12} /> {isExpanded ? "Hide Snapshot Diff" : "Inspect Snapshot Diff"}
                      </button>

                      {isExpanded && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto">
                          <div>
                            <span className="text-amber-400 font-bold block mb-1">State Before:</span>
                            <pre>{log.before ? JSON.stringify(log.before, null, 2) : "null (New entity created)"}</pre>
                          </div>
                          <div>
                            <span className="text-emerald-400 font-bold block mb-1">State After:</span>
                            <pre>{log.after ? JSON.stringify(log.after, null, 2) : "null (Entity deleted)"}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-border bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12.5px] text-textSecondary">
          <span>Showing {logs.length} entries</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded border border-border bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 font-medium text-slate-800">Page {page}</span>
            <button
              disabled={logs.length < 25}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded border border-border bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
