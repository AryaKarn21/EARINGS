import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  Package,
  Layers,
  Image as ImageIcon,
  Store,
  Users,
  ShoppingBag,
  Boxes,
  TrendingUp,
  Star,
  Sliders,
  Tag,
  BarChart3,
  Sparkles,
  Camera,
  Bell,
  ShieldCheck,
  Settings,
  Search,
  ExternalLink,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User as UserIcon,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Truck,
} from "lucide-react";
import { api, setToken, setStoredUser, getStoredUser } from "../api";

// Section Components
import OverviewSection from "./sections/OverviewSection";
import ProductsSection from "./sections/ProductsSection";
import CategoriesSection from "./sections/CategoriesSection";
import ImageLibrarySection from "./sections/ImageLibrarySection";
import SellersSection from "./sections/SellersSection";
import CustomersSection from "./sections/CustomersSection";
import OrdersSection from "./sections/OrdersSection";
import DeliverySection from "./sections/DeliverySection";
import ServicesSection from "./sections/ServicesSection";
import InventorySection from "./sections/InventorySection";
import TrendingSection from "./sections/TrendingSection";
import ReviewsSection from "./sections/ReviewsSection";
import BannersSection from "./sections/BannersSection";
import CouponsSection from "./sections/CouponsSection";
import AnalyticsSection from "./sections/AnalyticsSection";
import AISettingsSection from "./sections/AISettingsSection";
import TryOnSettingsSection from "./sections/TryOnSettingsSection";
import NotificationsSection from "./sections/NotificationsSection";
import AuditLogsSection from "./sections/AuditLogsSection";
import StoreSettingsSection from "./sections/StoreSettingsSection";

export default function SuperAdminPortal({ onReturnToStore, user: initialUser, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  
  // Real DB-verified authorization state
  const [authStatus, setAuthStatus] = useState("checking"); // 'checking' | 'authorized' | 'unauthorized'
  const [currentUser, setCurrentUser] = useState(initialUser || getStoredUser());
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  
  // Real-time unread notification count polling
  useEffect(() => {
    if (authStatus !== "authorized") return;
    const fetchUnread = async () => {
      try {
        const res = await api.getUnreadNotificationCount();
        if (res && typeof res.unreadCount === "number") {
          setUnreadNotifications(res.unreadCount);
        }
      } catch (e) {
        // quiet error
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [authStatus]);
  
  // Login form state for quick superadmin login if unauthorized
  const [loginEmail, setLoginEmail] = useState("admin@aurelie.local");
  const [loginPassword, setLoginPassword] = useState("admin@123");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Verify server-side role on mount
  useEffect(() => {
    verifySuperAdminAccess();
  }, []);

  const verifySuperAdminAccess = async () => {
    setAuthStatus("checking");
    const token = api.getToken();
    if (!token) {
      setAuthStatus("unauthorized");
      return;
    }

    try {
      const res = await api.getMe();
      if (res && res.user) {
        setCurrentUser(res.user);
        if (onUserUpdate) onUserUpdate(res.user);
        
        // Strict role check: SUPER_ADMIN or ADMIN
        if (res.user.role === "SUPER_ADMIN" || res.user.role === "ADMIN") {
          setAuthStatus("authorized");
        } else {
          setAuthStatus("unauthorized");
        }
      } else {
        setAuthStatus("unauthorized");
      }
    } catch (err) {
      console.error("Super Admin auth check failed:", err);
      setAuthStatus("unauthorized");
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await api.login(loginEmail, loginPassword);
      if (res && res.token && res.user) {
        setToken(res.token);
        setStoredUser(res.user);
        setCurrentUser(res.user);
        if (onUserUpdate) onUserUpdate(res.user);

        if (res.user.role === "SUPER_ADMIN" || res.user.role === "ADMIN") {
          setAuthStatus("authorized");
        } else {
          setLoginError(`Account "${res.user.email}" has role "${res.user.role}". Only SUPER_ADMIN accounts can access this portal.`);
          setAuthStatus("unauthorized");
        }
      } else {
        setLoginError("Invalid credentials or server error");
      }
    } catch (err) {
      setLoginError(err.message || "Login failed. Please verify credentials.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    api.logout();
    setToken(null);
    setStoredUser(null);
    setCurrentUser(null);
    if (onUserUpdate) onUserUpdate(null);
    setAuthStatus("unauthorized");
    setUserDropdownOpen(false);
  };

  // 20 Navigation Items Grouped Logically
  const navGroups = [
    {
      group: "Core",
      items: [
        { id: "overview", label: "Overview", icon: LayoutDashboard, badge: null }
      ]
    },
    {
      group: "Catalogue & Ornaments",
      items: [
        { id: "products", label: "Products & Ornaments", icon: Package, badge: "Catalog" },
        { id: "categories", label: "Categories", icon: Layers, badge: null },
        { id: "images", label: "Product Image Library", icon: ImageIcon, badge: "Storage" },
        { id: "inventory", label: "Inventory", icon: Boxes, badge: null }
      ]
    },
    {
      group: "Commerce & Fulfillment",
      items: [
        { id: "orders", label: "Orders & Fulfillment", icon: ShoppingBag, badge: null },
        { id: "delivery", label: "Delivery Personnel", icon: Truck, badge: "Fleet" },
        { id: "services", label: "Verified Services", icon: Sparkles, badge: "Verified" },
        { id: "customers", label: "Customers", icon: Users, badge: null },
        { id: "sellers", label: "Sellers & Vendors", icon: Store, badge: "Market" },
        { id: "coupons", label: "Coupons & Discounts", icon: Tag, badge: null }
      ]
    },
    {
      group: "Merchandising & Content",
      items: [
        { id: "trending", label: "Trending & Featured", icon: TrendingUp, badge: null },
        { id: "reviews", label: "Reviews & Ratings", icon: Star, badge: null },
        { id: "banners", label: "Homepage Banners", icon: Sliders, badge: null }
      ]
    },
    {
      group: "Intelligence & Experience",
      items: [
        { id: "ai-settings", label: "AI Stylist Settings", icon: Sparkles, badge: "AI" },
        { id: "tryon-settings", label: "Virtual Try-On", icon: Camera, badge: "AR" },
        { id: "analytics", label: "Analytics & Reports", icon: BarChart3, badge: null }
      ]
    },
    {
      group: "System & Governance",
      items: [
        { id: "notifications", label: "Notifications", icon: Bell, badge: unreadNotifications > 0 ? `${unreadNotifications}` : null },
        { id: "audit-logs", label: "Audit Logs", icon: ShieldCheck, badge: null },
        { id: "settings", label: "Store Settings", icon: Settings, badge: null }
      ]
    }
  ];

  // Flat list for breadcrumbs and lookup
  const allNavItems = useMemo(() => {
    return navGroups.flatMap(g => g.items);
  }, [navGroups]);

  const currentNav = allNavItems.find(item => item.id === activeTab) || allNavItems[0];

  // Render Access Denied / Direct Super Admin Login if unauthorized
  if (authStatus === "checking") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center mb-6 animate-pulse">
          <ShieldCheck className="w-8 h-8 text-sky-400" />
        </div>
        <h2 className="text-xl font-semibold tracking-wide">Verifying Super Admin Authorization</h2>
        <p className="text-slate-400 text-sm mt-2">Checking database permissions and server tokens...</p>
      </div>
    );
  }

  if (authStatus === "unauthorized") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-sky-500/10 border border-sky-400/30 text-sky-400 mb-4">
              <ShieldAlert size={36} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Aurélie Super Admin</h1>
            <p className="text-sm text-slate-400 mt-1.5">
              Restricted Portal • Role-Based Authorization Required
            </p>
          </div>

          {currentUser ? (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
              <div className="flex items-center gap-2 font-semibold text-amber-300 mb-1">
                <AlertTriangle size={15} />
                Access Denied for Current Account
              </div>
              <p>
                Signed in as <strong className="text-white">{currentUser.email}</strong> with role <strong className="text-amber-300 font-mono uppercase">{currentUser.role || "CUSTOMER"}</strong>.
                Super Admin privileges are required.
              </p>
              <button
                onClick={handleAdminLogout}
                className="mt-3 text-xs underline text-amber-300 hover:text-white"
              >
                Sign out of {currentUser.email}
              </button>
            </div>
          ) : null}

          {loginError && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Super Admin Email
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="admin@aurelie.local"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 transition shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loginLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  Access Super Admin Dashboard
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <button
              onClick={onReturnToStore}
              className="text-xs text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5 mx-auto"
            >
              <ExternalLink size={13} />
              Return to Customer Storefront
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F7FD] flex flex-col font-sans text-slate-900 antialiased selection:bg-sky-200">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex flex-1">
        {/* =========================================================================
            PERSISTENT SIDEBAR NAVIGATION (Sky Blue Design System)
            ========================================================================= */}
        <aside
          className={`fixed top-0 bottom-0 left-0 w-72 bg-gradient-to-b from-[#0B1E33] via-[#0F2942] to-[#0A1929] text-white z-50 flex flex-col border-r border-sky-900/40 shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Sidebar Header / Brand */}
          <div className="h-20 px-6 flex items-center justify-between border-b border-sky-800/40 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-sky-300 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-sky-500/20">
                <ShieldCheck size={22} className="text-[#0B1E33]" />
              </div>
              <div>
                <h1 className="font-serif text-xl tracking-wider font-bold text-white flex items-center gap-2">
                  Aurélie
                </h1>
                <p className="text-[10px] font-semibold tracking-widest uppercase text-sky-400">
                  Super Admin
                </p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          {/* Sidebar Nav Items (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin scrollbar-thumb-sky-900/50">
            {navGroups.map((grp) => (
              <div key={grp.group} className="space-y-1">
                <div className="px-3 text-[10px] font-bold tracking-wider uppercase text-sky-400/80 mb-2">
                  {grp.group}
                </div>
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-sky-500 to-sky-600 text-slate-950 font-semibold shadow-lg shadow-sky-500/25 translate-x-1"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon
                          size={17}
                          className={isActive ? "text-slate-950" : "text-sky-400/80"}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isActive
                              ? "bg-slate-950 text-white"
                              : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Sidebar Footer / System Status */}
          <div className="p-4 border-t border-sky-800/40 bg-black/20 space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                PostgreSQL DB Live
              </span>
              <span className="font-mono text-sky-400">v2.4 Pro</span>
            </div>

            <button
              onClick={onReturnToStore}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 transition border border-white/10"
            >
              <ExternalLink size={13} className="text-sky-400" />
              View Customer Storefront
            </button>
          </div>
        </aside>

        {/* =========================================================================
            MAIN CONTENT AREA
            ========================================================================= */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar Navigation */}
          <header className="sticky top-0 z-40 h-20 bg-white/90 backdrop-blur-md border-b border-sky-100 px-6 lg:px-8 flex items-center justify-between shadow-xs">
            {/* Left: Mobile Toggle & Breadcrumbs */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <Menu size={20} />
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="text-sky-700 font-semibold">Super Admin</span>
                <ChevronRight size={14} className="text-slate-400" />
                <span className="text-slate-900 font-bold bg-sky-50 text-sky-900 px-2.5 py-1 rounded-lg border border-sky-100">
                  {currentNav.label}
                </span>
              </div>
            </div>

            {/* Right: Actions, Global Search, Notifications & Account */}
            <div className="flex items-center gap-4">
              {/* Quick Jump Search Input */}
              <div className="relative hidden md:block w-64 lg:w-80">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Quick find across portal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim()) {
                      const q = searchQuery.toLowerCase();
                      const match = allNavItems.find(
                        item => item.label.toLowerCase().includes(q) || item.id.includes(q)
                      );
                      if (match) {
                        setActiveTab(match.id);
                        setSearchQuery("");
                      }
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500 transition"
                />
              </div>

              {/* Notification Popover Button */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                  title="Notifications"
                >
                  <Bell size={18} />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 text-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <span className="font-bold text-slate-900">Administrative Notifications</span>
                      <button
                        onClick={() => {
                          setActiveTab("notifications");
                          setNotificationsOpen(false);
                        }}
                        className="text-sky-600 hover:underline text-[11px] font-semibold"
                      >
                        View All
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100 flex items-start gap-2.5">
                        <CheckCircle2 size={15} className="text-sky-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-800">PostgreSQL Cloud DB Connected</p>
                          <p className="text-slate-500 text-[11px]">Database schema fully synchronized with Prisma 6.</p>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 flex items-start gap-2.5">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-800">Low Stock Notice</p>
                          <p className="text-slate-500 text-[11px]">3 jewellery items have fallen below safety inventory.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Super Admin User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-sky-400 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "A"}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-bold text-slate-900 leading-tight">
                      {currentUser?.name || "Administrator"}
                    </div>
                    <div className="text-[10px] font-semibold text-sky-600 tracking-wide uppercase">
                      {currentUser?.role || "SUPER_ADMIN"}
                    </div>
                  </div>
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50 text-xs">
                    <div className="px-3 py-2 bg-slate-50 rounded-xl mb-2">
                      <p className="font-bold text-slate-900">{currentUser?.name || "Super Admin"}</p>
                      <p className="text-[11px] text-slate-500 font-mono truncate">{currentUser?.email}</p>
                      <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                        <ShieldCheck size={11} />
                        Verified DB Super Admin
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        setActiveTab("settings");
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition font-medium"
                    >
                      <Settings size={14} className="text-slate-400" />
                      Store & Admin Settings
                    </button>

                    <button
                      onClick={() => {
                        onReturnToStore();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition font-medium"
                    >
                      <ExternalLink size={14} className="text-slate-400" />
                      Open Customer Storefront
                    </button>

                    <div className="border-t border-slate-100 my-1 pt-1">
                      <button
                        onClick={handleAdminLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition font-medium"
                      >
                        <LogOut size={14} />
                        Sign Out of Admin
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Active Section Container */}
          <main className="flex-1 p-6 lg:p-10 max-w-[1600px] w-full mx-auto">
            {activeTab === "overview" && <OverviewSection onNavigate={setActiveTab} />}
            {activeTab === "products" && <ProductsSection onNavigate={setActiveTab} />}
            {activeTab === "categories" && <CategoriesSection onNavigate={setActiveTab} />}
            {activeTab === "images" && <ImageLibrarySection onNavigate={setActiveTab} />}
            {activeTab === "sellers" && <SellersSection onNavigate={setActiveTab} />}
            {activeTab === "customers" && <CustomersSection onNavigate={setActiveTab} />}
            {activeTab === "orders" && <OrdersSection onNavigate={setActiveTab} />}
            {activeTab === "delivery" && <DeliverySection onNavigate={setActiveTab} />}
            {activeTab === "services" && <ServicesSection onNavigate={setActiveTab} />}
            {activeTab === "inventory" && <InventorySection onNavigate={setActiveTab} />}
            {activeTab === "trending" && <TrendingSection onNavigate={setActiveTab} />}
            {activeTab === "reviews" && <ReviewsSection onNavigate={setActiveTab} />}
            {activeTab === "banners" && <BannersSection onNavigate={setActiveTab} />}
            {activeTab === "coupons" && <CouponsSection onNavigate={setActiveTab} />}
            {activeTab === "analytics" && <AnalyticsSection onNavigate={setActiveTab} />}
            {activeTab === "ai-settings" && <AISettingsSection onNavigate={setActiveTab} />}
            {activeTab === "tryon-settings" && <TryOnSettingsSection onNavigate={setActiveTab} />}
            {activeTab === "notifications" && <NotificationsSection onNavigate={setActiveTab} />}
            {activeTab === "audit-logs" && <AuditLogsSection onNavigate={setActiveTab} />}
            {activeTab === "settings" && <StoreSettingsSection onNavigate={setActiveTab} />}
          </main>
        </div>
      </div>
    </div>
  );
}
