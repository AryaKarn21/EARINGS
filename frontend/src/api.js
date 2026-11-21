/**
 * Single point of contact with the backend. No component ever calls fetch()
 * directly — everything goes through here, so swapping REST for GraphQL, or
 * pointing at a different host, only touches this file.
 */
const BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, "") : "/api";

function getGuestId() {
  let id = localStorage.getItem("aurelie_guest_id");
  if (!id) {
    id = "guest_" + Math.random().toString(36).slice(2, 12);
    localStorage.setItem("aurelie_guest_id", id);
  }
  return id;
}

export function getToken() {
  return typeof localStorage !== "undefined" ? localStorage.getItem("aurelie_token") : null;
}

async function request(path, opts = {}) {
  const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const headers = {
    "X-Guest-Id": getGuestId(),
    ...(opts.headers || {}),
  };

  // Only set application/json when not uploading FormData (browser sets boundary automatically)
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new Error(body?.error || `Request failed: ${res.status}`);
  }
  return body;
}

export const api = {
  // Products
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },
  getProduct: (id) => request(`/products/${id}`),
  createProduct: (data) => request(`/products`, { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  getRecommendations: (prefs, limit = 10) => request(`/products/recommendations/for-me?limit=${limit}`, { method: "POST", body: JSON.stringify(prefs) }),

  // Categories
  getCategories: () => request(`/categories`),

  // Banners (Public storefront)
  getBanners: () => request(`/banners`),

  // Cart
  getCart: () => request(`/cart`),
  addToCart: (productId, qty = 1) => request(`/cart/items`, { method: "POST", body: JSON.stringify({ productId, qty }) }),
  updateCartItem: (productId, qty) => request(`/cart/items/${productId}`, { method: "PUT", body: JSON.stringify({ qty }) }),
  removeCartItem: (productId) => request(`/cart/items/${productId}`, { method: "DELETE" }),

  // Wishlist
  getWishlist: () => request(`/wishlist`),
  addWishlist: (productId) => request(`/wishlist/${productId}`, { method: "POST" }),
  removeWishlist: (productId) => request(`/wishlist/${productId}`, { method: "DELETE" }),

  // Orders
  getOrders: () => request(`/orders`),
  createOrder: (data) => request(`/orders`, { method: "POST", body: JSON.stringify(data) }),
  trackOrder: (id) => request(`/orders/${id}/track`),
  cancelOrder: (id, reason) => request(`/orders/${id}/cancel`, { method: "PATCH", body: JSON.stringify({ reason }) }),
  returnOrder: (id, reason) => request(`/orders/${id}/return`, { method: "POST", body: JSON.stringify({ reason }) }),

  // Reviews
  getProductReviews: (productId, params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/products/${productId}/reviews${qs ? `?${qs}` : ""}`);
  },
  createProductReview: (productId, data) => request(`/products/${productId}/reviews`, { method: "POST", body: JSON.stringify(data) }),
  updateReview: (id, data) => request(`/reviews/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteReview: (id) => request(`/reviews/${id}`, { method: "DELETE" }),
  markReviewHelpful: (id) => request(`/reviews/${id}/helpful`, { method: "POST" }),

  // Notifications
  getNotifications: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/notifications${qs ? `?${qs}` : ""}`);
  },
  getUnreadNotificationCount: () => request(`/notifications/unread-count`),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => request(`/notifications/mark-all-read`, { method: "POST" }),

  // Delivery Boy Module
  getDeliveryProfile: () => request(`/delivery/profile`),
  registerDeliveryProfile: (data) => request(`/delivery/register`, { method: "POST", body: JSON.stringify(data) }),
  toggleDeliveryAvailability: (isAvailable) => request(`/delivery/availability`, { method: "PATCH", body: JSON.stringify({ isAvailable }) }),
  getDeliveryDashboard: () => request(`/delivery/dashboard`),
  getDeliveryAssignments: (status) => request(`/delivery/assignments${status ? `?status=${status}` : ""}`),
  deliveryPickupOrder: (id) => request(`/delivery/orders/${id}/pickup`, { method: "PATCH" }),
  deliveryOutForDelivery: (id) => request(`/delivery/orders/${id}/out-for-delivery`, { method: "PATCH" }),
  deliveryCompleteOrder: (id, data) => request(`/delivery/orders/${id}/complete`, { method: "POST", body: JSON.stringify(data) }),
  deliveryFailOrder: (id, data) => request(`/delivery/orders/${id}/fail`, { method: "POST", body: JSON.stringify(data) }),

  // Verified Services Module
  getServices: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/services${qs ? `?${qs}` : ""}`);
  },
  getServiceCategories: () => request(`/services/categories`),
  getService: (idOrSlug) => request(`/services/${idOrSlug}`),
  submitService: (data) => request(`/services`, { method: "POST", body: JSON.stringify(data) }),
  getMyServices: () => request(`/services/my/submissions`),
  bookService: (id, data) => request(`/services/${id}/bookings`, { method: "POST", body: JSON.stringify(data) }),
  getMyServiceBookings: () => request(`/services/bookings/my`),
  cancelServiceBooking: (id, reason) => request(`/services/bookings/${id}/cancel`, { method: "PATCH", body: JSON.stringify({ reason }) }),
  reviewService: (id, data) => request(`/services/${id}/reviews`, { method: "POST", body: JSON.stringify(data) }),

  // AI Stylist
  quiz: (prefs) => request(`/stylist/quiz`, { method: "POST", body: JSON.stringify(prefs) }),
  detectFaceShape: (result) => request(`/stylist/face-shape`, { method: "POST", body: JSON.stringify(result) }),
  outfitMatch: (analysis) => request(`/stylist/outfit-match`, { method: "POST", body: JSON.stringify(analysis) }),

  // Virtual Try-On
  startTryOnSession: (productId, mode) => request(`/tryon/sessions`, { method: "POST", body: JSON.stringify({ productId, mode }) }),
  convertTryOnSession: (sessionId) => request(`/tryon/sessions/${sessionId}/convert`, { method: "POST" }),
  logTryOnEvent: (payload) => request(`/tryon/events`, { method: "POST", body: JSON.stringify(payload) }),

  // Auth
  register: (data) => request(`/auth/register`, { method: "POST", body: JSON.stringify(data) }),
  login: (data) => request(`/auth/login`, { method: "POST", body: JSON.stringify(data) }),
  googleLogin: (credential) => request(`/auth/google`, { method: "POST", body: JSON.stringify({ credential }) }),
  getMe: () => request(`/auth/me`),

  // =========================================================================
  // SUPER ADMIN PORTAL APIs
  // =========================================================================

  // 1. Overview Dashboard
  adminGetDashboard: () => request(`/admin/dashboard`),

  // 2. Real Product Photo Uploads & Image Library
  adminUploadImages: (formDataOrJson) => {
    if (typeof FormData !== "undefined" && formDataOrJson instanceof FormData) {
      return request(`/admin/upload-images`, { method: "POST", body: formDataOrJson });
    }
    return request(`/admin/upload-images`, { method: "POST", body: JSON.stringify(formDataOrJson) });
  },
  adminGetImages: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/admin/images${qs ? `?${qs}` : ""}`);
  },
  adminDeleteImage: (key, force = false) => request(`/admin/images/${encodeURIComponent(key)}${force ? "?force=true" : ""}`, { method: "DELETE" }),
  adminRemoveBackground: (formDataOrJson) => {
    if (typeof FormData !== "undefined" && formDataOrJson instanceof FormData) {
      return request(`/admin/remove-background`, { method: "POST", body: formDataOrJson });
    }
    return request(`/admin/remove-background`, { method: "POST", body: JSON.stringify(formDataOrJson) });
  },

  // 3. Products & Ornaments Management
  adminGetProducts: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/admin/products${qs ? `?${qs}` : ""}`);
  },
  adminGetProduct: (id) => request(`/admin/products/${id}`),
  adminCreateProduct: (data) => request(`/admin/products`, { method: "POST", body: JSON.stringify(data) }),
  adminUpdateProduct: (id, data) => request(`/admin/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  adminDeleteProduct: (id) => request(`/admin/products/${id}`, { method: "DELETE" }),
  adminUpdateProductStatus: (id, statusData) => request(`/admin/products/${id}/status`, { method: "PATCH", body: JSON.stringify(statusData) }),

  // 4. Categories
  adminGetCategories: () => request(`/admin/categories`),
  adminCreateCategory: (data) => request(`/admin/categories`, { method: "POST", body: JSON.stringify(data) }),
  adminUpdateCategory: (id, data) => request(`/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  adminDeleteCategory: (id) => request(`/admin/categories/${id}`, { method: "DELETE" }),

  // 5. Sellers
  adminGetSellers: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/admin/sellers${qs ? `?${qs}` : ""}`);
  },
  adminGetSeller: (id) => request(`/admin/sellers/${id}`),
  adminUpdateSellerStatus: (id, data) => request(`/admin/sellers/${id}/status`, { method: "PATCH", body: JSON.stringify(data) }),
  adminUpdateSellerCommission: (id, commissionRate) => request(`/admin/sellers/${id}/commission`, { method: "PATCH", body: JSON.stringify({ commissionRate }) }),

  // 6. Customers
  adminGetCustomers: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/admin/customers${qs ? `?${qs}` : ""}`);
  },
  adminGetCustomer: (id) => request(`/admin/customers/${id}`),
  adminUpdateUserRole: (id, role) => request(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),

  // 7. Orders & Delivery Assignments
  adminGetOrders: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/admin/orders${qs ? `?${qs}` : ""}`);
  },
  adminGetOrder: (id) => request(`/admin/orders/${id}`),
  adminUpdateOrderStatus: (id, status) => request(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  adminAssignDelivery: (orderId, data) => request(`/admin/orders/${orderId}/assign-delivery`, { method: "POST", body: JSON.stringify(data) }),
  adminRefundOrder: (orderId, data) => request(`/admin/orders/${orderId}/refund`, { method: "POST", body: JSON.stringify(data) }),

  // 7B. Delivery Personnel Management
  adminGetDeliveryPersonnel: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/admin/delivery-personnel${qs ? `?${qs}` : ""}`);
  },
  adminUpdateDeliveryPersonnelStatus: (id, data) => request(`/admin/delivery-personnel/${id}/status`, { method: "PATCH", body: JSON.stringify(data) }),
  adminInviteDeliveryPersonnel: (data) => request(`/admin/delivery-personnel/invite`, { method: "POST", body: JSON.stringify(data) }),

  // 7C. Verified Services Management
  adminGetServices: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/admin/services${qs ? `?${qs}` : ""}`);
  },
  adminVerifyService: (id, data) => request(`/admin/services/${id}/verify`, { method: "PATCH", body: JSON.stringify(data) }),
  adminGetServiceBookings: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/admin/services/bookings${qs ? `?${qs}` : ""}`);
  },
  adminUpdateServiceBookingStatus: (id, data) => request(`/admin/services/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify(data) }),

  // 8. Inventory
  adminGetInventory: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/admin/inventory${qs ? `?${qs}` : ""}`);
  },
  adminAdjustInventory: (data) => request(`/admin/inventory/adjust`, { method: "POST", body: JSON.stringify(data) }),

  // 9. Trending & Merchandising
  adminGetMerchandising: () => request(`/admin/merchandising`),
  adminRecalcTrends: () => request(`/admin/merchandising/recalc`, { method: "POST" }),

  // 10. Reviews & Ratings Moderation
  adminGetReviews: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/admin/reviews${qs ? `?${qs}` : ""}`);
  },
  adminModerateReview: (id, status) => request(`/admin/reviews/${id}/moderate`, { method: "PATCH", body: JSON.stringify({ status }) }),
  adminDeleteReview: (id) => request(`/admin/reviews/${id}`, { method: "DELETE" }),

  // 11. Homepage Banners
  adminGetBanners: () => request(`/admin/banners`),
  adminCreateBanner: (data) => request(`/admin/banners`, { method: "POST", body: JSON.stringify(data) }),
  adminUpdateBanner: (id, data) => request(`/admin/banners/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  adminDeleteBanner: (id) => request(`/admin/banners/${id}`, { method: "DELETE" }),
  adminReorderBanners: (orderedIds) => request(`/admin/banners/reorder`, { method: "PATCH", body: JSON.stringify({ orderedIds }) }),

  // 12. Coupons & Promotions
  adminGetCoupons: () => request(`/admin/coupons`),
  adminCreateCoupon: (data) => request(`/admin/coupons`, { method: "POST", body: JSON.stringify(data) }),
  adminUpdateCoupon: (code, data) => request(`/admin/coupons/${encodeURIComponent(code)}`, { method: "PATCH", body: JSON.stringify(data) }),
  adminDeleteCoupon: (code) => request(`/admin/coupons/${encodeURIComponent(code)}`, { method: "DELETE" }),

  // 13. Analytics & BI
  getMostTriedOn: () => request(`/admin/analytics/most-tried-on`),
  getConversion: () => request(`/admin/analytics/conversion`),
  getFaceShapePopularity: () => request(`/admin/analytics/face-shape-popularity`),

  // 14 & 15. AI Stylist & Try-On Settings
  adminGetAISettings: () => request(`/admin/ai-settings`),
  adminUpdateAISettings: (data) => request(`/admin/ai-settings`, { method: "PATCH", body: JSON.stringify(data) }),

  // 16. Notifications
  adminGetNotifications: () => request(`/admin/notifications`),

  // 17. Audit Logs
  adminGetAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },

  // 18. Store Settings
  adminGetSettings: () => request(`/admin/settings`),
  adminUpdateSettings: (data) => request(`/admin/settings`, { method: "PATCH", body: JSON.stringify(data) }),

  getToken,
};

export function setToken(token) {
  if (token) localStorage.setItem("aurelie_token", token);
  else localStorage.removeItem("aurelie_token");
}

export function setStoredUser(user) {
  if (user) localStorage.setItem("aurelie_user", JSON.stringify(user));
  else localStorage.removeItem("aurelie_user");
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem("aurelie_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}