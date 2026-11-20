const router = require("express").Router();
const { prisma } = require("../db/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { createNotification } = require("../services/notificationService");
const auditLog = require("../services/auditLog");
const ah = require("../utils/asyncHandler");

// Middleware: Delivery Boy role only
const requireDeliveryBoy = [requireAuth, requireRole("DELIVERY_BOY")];

// GET /api/delivery/profile — Delivery personnel profile
router.get("/profile", requireAuth, ah(async (req, res) => {
  const profile = await prisma.deliveryProfile.findUnique({
    where: { userId: req.user.id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  res.json({
    user: req.user,
    profile: profile || null,
    isApproved: profile?.status === "APPROVED",
  });
}));

// POST /api/delivery/register — Register/update delivery profile
router.post("/register", requireAuth, ah(async (req, res) => {
  const { phone, assignedArea, vehicleType, idDocumentUrl } = req.body;

  // Ensure role is DELIVERY_BOY or promote if eligible
  if (req.user.role === "CUSTOMER") {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { role: "DELIVERY_BOY" },
    });
  }

  const profile = await prisma.deliveryProfile.upsert({
    where: { userId: req.user.id },
    create: {
      userId: req.user.id,
      phone: phone || null,
      assignedArea: assignedArea || "Downtown",
      vehicleType: vehicleType || "Motorcycle",
      idDocumentUrl: idDocumentUrl || null,
      status: "APPROVED", // Auto-approved for active sandbox/testing, can be toggled by Super Admin
    },
    update: {
      phone: phone || undefined,
      assignedArea: assignedArea || undefined,
      vehicleType: vehicleType || undefined,
      idDocumentUrl: idDocumentUrl || undefined,
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  await createNotification({
    targetRole: "SUPER_ADMIN",
    category: "SYSTEM_ALERT",
    title: `Delivery Personnel Registered: ${req.user.name}`,
    message: `${req.user.name} applied for Delivery Boy duties in area: ${assignedArea || 'General'}.`,
    link: `/superadmin/delivery`,
    metadata: { userId: req.user.id, phone, vehicleType },
  });

  res.status(201).json(profile);
}));

// PATCH /api/delivery/availability — Toggle active availability
router.patch("/availability", requireDeliveryBoy, ah(async (req, res) => {
  const { isAvailable } = req.body;
  const updated = await prisma.deliveryProfile.update({
    where: { userId: req.user.id },
    data: { isAvailable: Boolean(isAvailable) },
  });
  res.json(updated);
}));

// GET /api/delivery/dashboard — Delivery stats & today's assignments
router.get("/dashboard", requireDeliveryBoy, ah(async (req, res) => {
  const deliveryPersonId = req.user.id;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalAssigned,
    pendingPickup,
    outForDelivery,
    deliveredCount,
    failedCount,
    todayAssignments,
  ] = await prisma.$transaction([
    prisma.deliveryAssignment.count({ where: { deliveryPersonId } }),
    prisma.deliveryAssignment.count({ where: { deliveryPersonId, status: "ASSIGNED" } }),
    prisma.deliveryAssignment.count({ where: { deliveryPersonId, status: "OUT_FOR_DELIVERY" } }),
    prisma.deliveryAssignment.count({ where: { deliveryPersonId, status: "DELIVERED" } }),
    prisma.deliveryAssignment.count({ where: { deliveryPersonId, status: "FAILED" } }),
    prisma.deliveryAssignment.findMany({
      where: {
        deliveryPersonId,
        createdAt: { gte: startOfToday },
      },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  res.json({
    metrics: {
      totalAssigned,
      pendingPickup,
      outForDelivery,
      deliveredCount,
      failedCount,
      todayCount: todayAssignments.length,
    },
    todayAssignments,
  });
}));

// GET /api/delivery/assignments — List active or all assigned deliveries
router.get("/assignments", requireDeliveryBoy, ah(async (req, res) => {
  const { status } = req.query;
  const where = { deliveryPersonId: req.user.id };
  if (status) where.status = status;

  const assignments = await prisma.deliveryAssignment.findMany({
    where,
    include: {
      order: {
        include: {
          items: true,
          deliveryProof: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(assignments);
}));

// PATCH /api/delivery/orders/:id/pickup — Delivery boy confirms package pickup
router.patch("/orders/:id/pickup", requireDeliveryBoy, ah(async (req, res) => {
  const orderId = req.params.id;
  const deliveryPersonId = req.user.id;

  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { orderId, deliveryPersonId },
    include: { order: true },
  });

  if (!assignment) {
    return res.status(403).json({ error: "You are not assigned to this delivery." });
  }

  if (assignment.status !== "ASSIGNED" && assignment.status !== "FAILED") {
    return res.status(400).json({ error: `Cannot pick up order in ${assignment.status} status.` });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedAssignment = await tx.deliveryAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "PICKED_UP",
        pickedUpAt: new Date(),
      },
    });

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: "Shipped",
        deliveryStatus: "PICKED_UP",
      },
      include: { items: true },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        previousStatus: assignment.order.status,
        newStatus: "Shipped",
        deliveryStatus: "PICKED_UP",
        changedByKey: req.user.id,
        notes: `Package picked up by delivery courier ${req.user.name}.`,
      },
    });

    return { updatedAssignment, updatedOrder };
  });

  // Notify customer
  if (assignment.order.ownerKey) {
    await createNotification({
      userId: assignment.order.ownerKey,
      category: "DELIVERY_ASSIGNED",
      title: `Package Picked Up: #${assignment.order.orderNumber}`,
      message: `Your package for order #${assignment.order.orderNumber} has been picked up by ${req.user.name} and is on its way.`,
      link: `/orders?orderId=${orderId}`,
      metadata: { orderId, orderNumber: assignment.order.orderNumber },
    });
  }

  res.json(result);
}));

// PATCH /api/delivery/orders/:id/out-for-delivery — Delivery boy begins last-mile delivery
router.patch("/orders/:id/out-for-delivery", requireDeliveryBoy, ah(async (req, res) => {
  const orderId = req.params.id;
  const deliveryPersonId = req.user.id;

  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { orderId, deliveryPersonId },
    include: { order: true },
  });

  if (!assignment) {
    return res.status(403).json({ error: "You are not assigned to this delivery." });
  }

  if (assignment.status !== "PICKED_UP") {
    return res.status(400).json({ error: "Must pick up package before marking Out for Delivery." });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedAssignment = await tx.deliveryAssignment.update({
      where: { id: assignment.id },
      data: { status: "OUT_FOR_DELIVERY" },
    });

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        deliveryStatus: "OUT_FOR_DELIVERY",
      },
      include: { items: true },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        previousStatus: assignment.order.status,
        newStatus: "Shipped",
        deliveryStatus: "OUT_FOR_DELIVERY",
        changedByKey: req.user.id,
        notes: `Delivery agent ${req.user.name} is out for delivery with order #${assignment.order.orderNumber}.`,
      },
    });

    return { updatedAssignment, updatedOrder };
  });

  // Notify customer
  await createNotification({
    userId: assignment.order.ownerKey,
    category: "OUT_FOR_DELIVERY",
    title: `Order Out for Delivery: #${assignment.order.orderNumber}`,
    message: `Delivery agent ${req.user.name} is out for delivery. Have your OTP ${assignment.order.deliveryOtp || ''} ready!`,
    link: `/orders?orderId=${orderId}`,
    metadata: { orderId, orderNumber: assignment.order.orderNumber },
  });

  res.json(result);
}));

// POST /api/delivery/orders/:id/complete — Delivery completion with OTP verification & Proof
router.post("/orders/:id/complete", requireDeliveryBoy, ah(async (req, res) => {
  const orderId = req.params.id;
  const deliveryPersonId = req.user.id;
  const { otp, recipientName, photoUrl, notes, cashCollected } = req.body;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) return res.status(404).json({ error: "Order not found" });

  if (order.deliveryPersonId !== deliveryPersonId) {
    return res.status(403).json({ error: "You are not assigned to complete this delivery." });
  }

  if (order.status === "Delivered" && order.deliveryStatus === "DELIVERED") {
    return res.status(409).json({ error: "Order is already marked as delivered." });
  }

  if (order.deliveryStatus !== "OUT_FOR_DELIVERY" && order.deliveryStatus !== "PICKED_UP") {
    return res.status(400).json({ error: "Order must be out for delivery before marking delivered." });
  }

  // OTP Verification
  if (!otp || String(otp).trim() !== String(order.deliveryOtp).trim()) {
    return res.status(400).json({
      error: "Invalid Delivery OTP. Please request the customer to provide the 4-digit OTP shown in their tracking screen.",
    });
  }

  // Payment reconciliation for Cash on Delivery (COD)
  const isCod = order.paymentMethod === "cod";
  const finalPaymentStatus = isCod ? "PAID" : order.paymentStatus;
  const collectedAmount = isCod ? (cashCollected !== undefined ? Number(cashCollected) : order.total) : null;

  const completedTime = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update assignment
    await tx.deliveryAssignment.updateMany({
      where: { orderId, deliveryPersonId },
      data: {
        status: "DELIVERED",
        deliveredAt: completedTime,
        otpVerified: true,
        notes: notes || "Delivered successfully with OTP verification.",
      },
    });

    // 2. Create DeliveryProof
    const proof = await tx.deliveryProof.upsert({
      where: { orderId },
      create: {
        orderId,
        deliveryPersonId,
        recipientName: recipientName || "Authorized Recipient",
        otpUsed: String(otp).trim(),
        photoUrl: photoUrl || null,
        timestamp: completedTime,
        notes: notes || "Handover completed with OTP verification",
        cashCollected: collectedAmount,
        isPaymentConfirmed: true,
      },
      update: {
        recipientName: recipientName || undefined,
        otpUsed: String(otp).trim(),
        photoUrl: photoUrl || undefined,
        timestamp: completedTime,
        cashCollected: collectedAmount,
      },
    });

    // 3. Update Order
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: "Delivered",
        deliveryStatus: "DELIVERED",
        deliveredAt: completedTime,
        paymentStatus: finalPaymentStatus,
      },
      include: { items: true },
    });

    // 4. Status History
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        previousStatus: order.status,
        newStatus: "Delivered",
        deliveryStatus: "DELIVERED",
        paymentStatus: finalPaymentStatus,
        changedByKey: req.user.id,
        notes: `Delivery completed by ${req.user.name}. Recipient: ${recipientName || 'Customer'}. OTP verified. ${isCod ? `Cash collected: $${collectedAmount}` : 'Prepaid'}`,
      },
    });

    return { updatedOrder, proof };
  });

  // 1. Notify Super Admin
  await createNotification({
    targetRole: "SUPER_ADMIN",
    category: "DELIVERED",
    title: `Order #${order.orderNumber} Delivered`,
    message: `Delivery courier ${req.user.name} delivered order #${order.orderNumber} successfully with OTP.`,
    link: `/superadmin/orders?orderId=${order.id}`,
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      deliveryPerson: req.user.name,
      deliveredAt: completedTime,
      cashCollected: collectedAmount,
    },
  });

  // 2. Notify Customer
  await createNotification({
    userId: order.ownerKey,
    category: "DELIVERED",
    title: `Order Delivered: #${order.orderNumber}!`,
    message: `Your package for order #${order.orderNumber} has been delivered. Please share your product review!`,
    link: `/orders?orderId=${order.id}`,
    metadata: { orderId: order.id, orderNumber: order.orderNumber, deliveredAt: completedTime },
  });

  // 3. Notify Sellers
  const sellerIds = [...new Set(order.items.map(i => i.sellerId).filter(Boolean))];
  for (const sId of sellerIds) {
    const seller = await prisma.sellerProfile.findUnique({ where: { id: sId }, select: { userId: true } });
    if (seller?.userId) {
      await createNotification({
        userId: seller.userId,
        category: "DELIVERED",
        title: `Package Delivered: Order #${order.orderNumber}`,
        message: `Your item in order #${order.orderNumber} was marked as delivered.`,
        link: `/seller/orders`,
        metadata: { orderId: order.id, orderNumber: order.orderNumber },
      });
    }
  }

  res.json({
    success: true,
    message: "Order marked as delivered successfully.",
    order: result.updatedOrder,
    proof: result.proof,
  });
}));

// POST /api/delivery/orders/:id/fail — Record delivery failure
router.post("/orders/:id/fail", requireDeliveryBoy, ah(async (req, res) => {
  const orderId = req.params.id;
  const deliveryPersonId = req.user.id;
  const { failureReason, notes } = req.body;

  if (!failureReason) {
    return res.status(400).json({ error: "Failure reason is required." });
  }

  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { orderId, deliveryPersonId },
    include: { order: true },
  });

  if (!assignment) {
    return res.status(403).json({ error: "You are not assigned to this order." });
  }

  const failedTime = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const updatedAssignment = await tx.deliveryAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "FAILED",
        failedAt: failedTime,
        failureReason,
        notes: notes || null,
      },
    });

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        deliveryStatus: "FAILED",
        deliveryNotes: `Delivery attempt failed: ${failureReason}. ${notes || ''}`,
      },
      include: { items: true },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        previousStatus: assignment.order.status,
        newStatus: assignment.order.status,
        deliveryStatus: "FAILED",
        changedByKey: req.user.id,
        notes: `Delivery attempt failed: ${failureReason}. Notes: ${notes || 'None'}`,
      },
    });

    return { updatedAssignment, updatedOrder };
  });

  // Notify Super Admin
  await createNotification({
    targetRole: "SUPER_ADMIN",
    category: "DELIVERY_FAILED",
    title: `Delivery Failed: Order #${assignment.order.orderNumber}`,
    message: `Delivery agent ${req.user.name} reported failed delivery for #${assignment.order.orderNumber}. Reason: "${failureReason}".`,
    link: `/superadmin/orders?orderId=${orderId}`,
    metadata: { orderId, orderNumber: assignment.order.orderNumber, failureReason, notes },
  });

  // Notify Customer
  await createNotification({
    userId: assignment.order.ownerKey,
    category: "DELIVERY_FAILED",
    title: `Delivery Attempt Unsuccessful: #${assignment.order.orderNumber}`,
    message: `Our courier attempted delivery for #${assignment.order.orderNumber} but could not complete it (${failureReason}). A reschedule will be arranged.`,
    link: `/orders?orderId=${orderId}`,
    metadata: { orderId, orderNumber: assignment.order.orderNumber, failureReason },
  });

  res.json({
    success: true,
    message: "Delivery attempt marked as failed.",
    data: result,
  });
}));

module.exports = router;
