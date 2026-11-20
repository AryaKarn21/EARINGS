import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Shield,
  ShoppingBag,
  RefreshCw,
  Mail,
  UserCheck,
  X,
  AlertCircle,
} from "lucide-react";
import { api } from "../../api";
import { money } from "../../ui";

const ROLES = [
  "CUSTOMER",
  "CUSTOMER_SUPPORT",
  "ORDER_MANAGER",
  "PRODUCT_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
  "SELLER",
];

export default function CustomersSection() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Role Edit Modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("CUSTOMER");
  const [updating, setUpdating] = useState(false);
  const [modalError, setModalError] = useState(null);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetCustomers({ q: search, role: roleFilter });
      setCustomers(res || []);
    } catch (err) {
      console.error("Customers error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, roleFilter]);

  const openRoleModal = (user) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setModalError(null);
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setUpdating(true);
    setModalError(null);
    try {
      await api.adminUpdateUserRole(selectedUser.id, selectedRole);
      setSelectedUser(null);
      loadCustomers();
    } catch (err) {
      setModalError(err.message || "Failed to update role");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
            Customer Accounts & RBAC Roles ({customers.length})
          </h2>
          <p className="text-[13px] text-textSecondary mt-0.5">
            Manage buyer profiles, inspect total customer spend, and configure verified administrative roles.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-[12.5px] px-3 py-2 bg-slate-50 border border-border rounded-lg outline-none focus:border-primaryDark"
          >
            <option value="">All Account Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            onClick={loadCustomers}
            title="Refresh list"
            className="p-2 border border-border rounded-lg bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
            <RefreshCw size={15} className="animate-spin text-primaryDark" /> Loading customer records...
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-textSecondary text-[13px]">
            No customer accounts found matching your query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-textSecondary text-[11.5px] uppercase tracking-wider text-left">
                  <th className="py-3 px-4 font-medium">Customer Name</th>
                  <th className="py-3 px-4 font-medium">Email Address</th>
                  <th className="py-3 px-4 font-medium">RBAC Role</th>
                  <th className="py-3 px-4 font-medium">Orders Placed</th>
                  <th className="py-3 px-4 font-medium">Lifetime Spend</th>
                  <th className="py-3 px-4 font-medium">Joined Date</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-border text-slate-700 flex items-center justify-center font-bold text-[12px]">
                          {c.name ? c.name[0].toUpperCase() : "U"}
                        </div>
                        <span className="font-semibold text-slate-900">{c.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-textSecondary font-mono text-[12px]">
                      {c.email}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded font-medium border ${
                          c.role === "SUPER_ADMIN"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : c.role === "ADMIN"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : c.role === "SELLER"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {c.role}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {c.orderCount || 0}
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {money(c.totalSpend || 0)}
                    </td>

                    <td className="py-3 px-4 text-textSecondary text-[12px]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openRoleModal(c)}
                        className="px-3 py-1 bg-slate-100 hover:bg-primaryLight text-primaryDark rounded text-[12px] font-medium transition-colors"
                      >
                        Change Role
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Assignment Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-[120] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_.2s_ease]"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-primaryDark" />
                <h3 className="text-[16px] font-semibold text-slate-900">
                  Update Role for {selectedUser.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-textSecondary hover:text-textPrimary"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-dangerLight border border-danger/30 rounded text-danger text-[12.5px]">
                {modalError}
              </div>
            )}

            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div>
                <label className="block text-[12px] text-textSecondary mb-1 font-medium">
                  Account Email
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedUser.email}
                  className="w-full text-[13px] px-3 py-2 bg-slate-50 border border-border rounded text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-slate-800 mb-1">
                  Assign Authorization Role *
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full text-[13px] px-3.5 py-2.5 border border-border rounded-lg outline-none focus:border-primaryDark bg-white font-medium"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <p className="text-[11.5px] text-textSecondary mt-1 leading-relaxed">
                  Only SUPER_ADMINs can alter permissions. Role modifications take effect on the very
                  next request and are recorded in the audit trail.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 text-[13px] border border-border rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 bg-primaryDark text-white text-[13px] rounded-lg hover:bg-ink font-medium disabled:opacity-50"
                >
                  {updating ? "Updating..." : "Save Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
