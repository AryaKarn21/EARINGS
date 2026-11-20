const router = require("express").Router();
const { prisma } = require("../db/prisma");
const { orderOut, ordersOut } = require("../db/serialize");
const { requireAuth, requireRole } = require("../middleware/auth");
const { getSettings } = require("../services/settingsService");
const { createNotification } = require("../services/notificationService");
const auditLog = require("../services/auditLog");
const ah = require("../utils/asyncHandler");

const STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
function ownerKey(req) {
  return req.user?.id || req.headers["x-guest-id"] || "guest";
}

const ORDER_INCLUDE = {
  items: { orderBy: { position: "asc" } },
  deliveryPerson: { select: { id: true, name: true, email: true } },
  statusHistory: { orderBy: { createdAt: "desc" } },
  deliveryProof: true,
};

// Helper: generate unique Order Number (e.g. AUR-2026-83719)
async function generateOrderNumber() {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt++) {
    const rand = Math.floor(10000 + Math.random() * 90000);
    const candidate = `AUR-${year}-${rand}`;
    const exists = await prisma.order.findUnique({ where: { orderNumber: candidate } });
    if (!exists) return candidate;
  }
  return `AUR-${year}-${Date.now().toString().slice(-5)}`;
}

// Helper: generate 4-digit OTP for delivery verification
function generateDeliveryOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// GET /api/orders — List customer orders
router.get("/", ah(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { ownerKey: ownerKey(req) },
    orderBy: { createdAt: "desc" },
    include: ORDER_INCLUDE,
  });
  res.json(ordersOut(orders));
}));

// POST /api/orders — Place new order
router.post("/", ah(async (req, res) => {
  const { items, shippingAddress, paymentMethod = "cod", coupon } = req.body;
  if (!items?.length) return res.status(400).json({ error: "Order must contain at least one item" });

  const lineItems = [];
  const sellerIds = new Set();

  for (const i of items) {
    const product = await prisma.product.findUnique({ where: { id: i.productId } }).catch(() => null);
    if (!product) return res.status(400).json({ error: `Invalid product ${i.productId} in order` });

    if (product.sellerId) sellerIds.add(product.sellerId);

    lineItems.push({
      position: lineItems.length,
      productId: product.id,
      name: product.name,
      price: product.price,
      qty: Math.max(1, Number(i.qty) || 1),
      sellerId: product.sellerId || null,
    });
  }

  const subtotal = lineItems.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = coupon ? Math.round(subtotal * 0.1 * 100) / 100 : 0;

  const { "shipping.freeThreshold": freeThreshold = 100, "shipping.flatRate": flatRate = 15 } =
    await getSettings(["shipping.freeThreshold", "shipping.flatRate"]);
  const shipping = subtotal >= freeThreshold ? 0 : flatRate;
  const total = Math.max(0, subtotal - discount + shipping);

  const orderNumber = await generateOrderNumber();
  const deliveryOtp = generateDeliveryOtp();
  const isOnlinePayment = paymentMethod !== "cod";
  // No payment gateway is integrated yet — an online "payment" here is just a
  // method selection, not a verified charge. PENDING_PAYMENT reflects that
  // honestly instead of claiming PAID on unverified client input; an admin
  // (or, later, a real gateway webhook) must confirm it via
  // PATCH /api/orders/:id/status or /api/admin/orders/:id/update.
  const initialPaymentStatus = isOnlinePayment ? "PENDING_PAYMENT" : "PENDING";

  const customerKey = ownerKey(req);
  const customerName = shippingAddress?.name || req.user?.name || "Customer";

  // Create order and initial status history in transaction
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        ownerKey: customerKey,
        items: { create: lineItems },
        subtotal,
        discount,
        shipping,
        total,
        shippingAddress: shippingAddress ?? undefined,
        paymentMethod,
        paymentStatus: initialPaymentStatus,
        status: "Pending",
        deliveryStatus: "UNASSIGNED",
        deliveryOtp,
      },
      include: ORDER_INCLUDE,
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: created.id,
        previousStatus: null,
        newStatus: "Pending",
        deliveryStatus: "UNASSIGNED",
        paymentStatus: initialPaymentStatus,
        changedByKey: customerKey,
        notes: `Order placed by ${customerName}. Payment: ${paymentMethod.toUpperCase()}`,
      },
    });

    return created;
  });

  // 1. Notify Super Admin
  await createNotification({
    targetRole: "SUPER_ADMIN",
    category: "NEW_ORDER",
    title: `New Order Received #${orderNumber}`,
    message: `${customerName} placed order #${orderNumber} for $${total.toFixed(2)} (${lineItems.length} item(s)).`,
    link: `/superadmin/orders?orderId=${order.id}`,
    metadata: {
      orderId: order.id,
      orderNumber,
      amount: total,
      customer: customerName,
      paymentStatus: initialPaymentStatus,
      paymentMethod,
      itemCount: lineItems.length,
      deliveryAddress: shippingAddress?.address || "Standard Delivery",
    },
  });

  // 2. Notify Customer if authenticated
  if (req.user?.id) {
    await createNotification({
      userId: req.user.id,
      category: "NEW_ORDER",
      title: `Order Placed Successfully: #${orderNumber}`,
      message: `Your order #${orderNumber} for $${total.toFixed(2)} has been confirmed! Delivery OTP is ${deliveryOtp}.`,
      link: `/orders?orderId=${order.id}`,
      metadata: { orderId: order.id, orderNumber, total, deliveryOtp },
    });
  }

  // 3. Notify relevant Sellers for their items
  if (sellerIds.size > 0) {
    const sellerProfiles = await prisma.sellerProfile.findMany({
      where: { id: { in: Array.from(sellerIds) } },
      select: { userId: true, storeName: true },
    });

    for (const seller of sellerProfiles) {
      if (seller.userId) {
        await createNotification({
          userId: seller.userId,
          category: "SELLER_ORDER_UPDATE",
          title: `New Order #${orderNumber} for ${seller.storeName}`,
          message: `New product order received under #${orderNumber}. Please prepare the package for dispatch.`,
          link: `/seller/orders`,
          metadata: { orderId: order.id, orderNumber },
        });
      }
    }
  }

  res.status(201).json(orderOut(order));
}));

// GET /api/orders/:id/track — Visual timeline & delivery tracking
router.get("/:id/track", ah(async (req, res) => {
  const key = ownerKey(req);
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      items: true,
      deliveryPerson: {
        select: {
          id: true,
          name: true,
          deliveryProfile: {
            select: { phone: true, vehicleType: true, assignedArea: true },
          },
        },
      },
      statusHistory: { orderBy: { createdAt: "asc" } },
      deliveryProof: true,
    },
  });

  if (!order) return res.status(404).json({ error: "Order not found" });

  const isOwner = order.ownerKey === key;
  const isDeliveryPerson = req.user && order.deliveryPersonId === req.user.id;
  const isAdmin = req.user && ["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER", "CUSTOMER_SUPPORT"].includes(req.user.role);

  if (!isOwner && !isDeliveryPerson && !isAdmin) {
    return res.status(403).json({ error: "Access denied to this order tracking" });
  }

  // Build standard visual milestones
  const milestones = [
    { key: "PLACED", label: "Order Placed", done: true, time: order.createdAt },
    {
      key: "CONFIRMED",
      label: "Order Confirmed",
      done: ["Processing", "Shipped", "Delivered"].includes(order.status),
      time: order.statusHistory.find(h => h.newStatus === "Processing")?.createdAt || null,
    },
    {
      key: "PREPARING",
      label: "Preparing Order",
      done: ["Processing", "Shipped", "Delivered"].includes(order.status),
      time: order.statusHistory.find(h => h.notes?.includes("Prepare"))?.createdAt || null,
    },
    {
      key: "DISPATCH",
      label: "Ready for Dispatch / Assigned",
      done: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.deliveryStatus),
      time: order.assignedAt,
    },
    {
      key: "OUT_FOR_DELIVERY",
      label: "Out for Delivery",
      done: ["OUT_FOR_DELIVERY", "DELIVERED"].includes(order.deliveryStatus),
      time: order.statusHistory.find(h => h.deliveryStatus === "OUT_FOR_DELIVERY")?.createdAt || null,
    },
    {
      key: "DELIVERED",
      label: "Delivered",
      done: order.status === "Delivered" && order.deliveryStatus === "DELIVERED",
      time: order.deliveredAt,
    },
  ];

  // Estimated delivery calculation (3 business days from order placement)
  const estimatedDate = new Date(new Date(order.createdAt).getTime() + 3 * 24 * 60 * 60 * 1000);

  // Mask delivery person sensitive details
  const deliveryPersonPublic = order.deliveryPerson ? {
    name: order.deliveryPerson.name,
    phone: order.deliveryPerson.deliveryProfile?.phone || "Contact via Support",
    vehicleType: order.deliveryPerson.deliveryProfile?.vehicleType || "Standard Courier",
  } : null;

  res.json({
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    total: order.total,
    shippingAddress: order.shippingAddress,
    createdAt: order.createdAt,
    assignedAt: order.assignedAt,
    deliveredAt: order.deliveredAt,
    cancelReason: order.cancelReason,
    isReturnRequested: order.isReturnRequested,
    returnReason: order.returnReason,
    // Only customer owner sees the secret delivery OTP to give to the courier
    deliveryOtp: isOwner ? order.deliveryOtp : undefined,
    deliveryPerson: deliveryPersonPublic,
    milestones,
    history: order.statusHistory,
    estimatedDelivery: estimatedDate.toISOString(),
    deliveryProof: order.deliveryProof ? {
      timestamp: order.deliveryProof.timestamp,
      photoUrl: order.deliveryProof.photoUrl,
      recipientName: order.deliveryProof.recipientName,
      cashCollected: order.deliveryProof.cashCollected,
    } : null,
    items: order.items,
  });
}));

// PATCH /api/orders/:id/cancel — Customer cancellation
router.patch("/:id/cancel", ah(async (req, res) => {
  const key = ownerKey(req);
  const { reason = "Customer requested cancellation" } = req.body;

  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const isOwner = order.ownerKey === key;
  const isAdmin = req.user && ["SUPER_ADMIN", "ADMIN"].includes(req.user.role);

  if (!isOwner && !isAdmin) return res.status(403).json({ error: "Unauthorized" });

  if (["Shipped", "Delivered"].includes(order.status) || ["OUT_FOR_DELIVERY", "DELIVERED"].includes(order.deliveryStatus)) {
    return res.status(400).json({ error: "Cannot cancel an order that is already shipped or out for delivery." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "Cancelled",
        deliveryStatus: "CANCELLED",
        cancelReason: reason,
      },
      include: ORDER_INCLUDE,
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        newStatus: "Cancelled",
        deliveryStatus: "CANCELLED",
        changedByKey: key,
        notes: `Cancellation: ${reason}`,
      },
    });

    return o;
  });

  // Notify Super Admin
  await createNotification({
    targetRole: "SUPER_ADMIN",
    category: "SYSTEM_ALERT",
    title: `Order Cancelled: #${order.orderNumber}`,
    message: `Order #${order.orderNumber} was cancelled. Reason: ${reason}`,
    link: `/superadmin/orders?orderId=${order.id}`,
    metadata: { orderId: order.id, orderNumber: order.orderNumber, reason },
  });

  res.json(orderOut(updated));
}));

// POST /api/orders/:id/return — Customer return request
router.post("/:id/return", ah(async (req, res) => {
  const key = ownerKey(req);
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: "Return reason is required" });

  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (order.ownerKey !== key && req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (order.status !== "Delivered") {
    return res.status(400).json({ error: "Return requests are only permitted for delivered orders." });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      isReturnRequested: true,
      returnReason: reason,
    },
    include: ORDER_INCLUDE,
  });

  await prisma.orderStatusHistory.create({
    data: {
      orderId: order.id,
      previousStatus: order.status,
      newStatus: "Delivered",
      deliveryStatus: order.deliveryStatus,
      changedByKey: key,
      notes: `Return requested: ${reason}`,
    },
  });

  await createNotification({
    targetRole: "SUPER_ADMIN",
    category: "RETURN_REFUND_REQUEST",
    title: `Return Request for Order #${order.orderNumber}`,
    message: `Customer requested a return for order #${order.orderNumber}. Reason: "${reason}"`,
    link: `/superadmin/orders?orderId=${order.id}`,
    metadata: { orderId: order.id, orderNumber: order.orderNumber, reason },
  });

  res.json(orderOut(updated));
}));

// PATCH /api/orders/:id/status — Admin order status update
router.patch("/:id/status", requireAuth, requireRole("ORDER_MANAGER", "ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: `Status must be one of ${STATUSES.join(", ")}` });

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Order not found" });

  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
      include: ORDER_INCLUDE,
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: o.id,
        previousStatus: existing.status,
        newStatus: req.body.status,
        deliveryStatus: o.deliveryStatus,
        paymentStatus: o.paymentStatus,
        changedByKey: req.user.id,
        notes: req.body.notes || `Order status updated to ${req.body.status} by ${req.user.name}`,
      },
    });

    return o;
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "order.status.update",
    targetType: "Order",
    targetId: updated.id,
    before: { status: existing.status },
    after: { status: updated.status },
  });

  res.json(orderOut(updated));
}));

module.exports = router;
