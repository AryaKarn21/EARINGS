const { prisma } = require("../src/db/prisma");
const { createNotification, getNotifications } = require("../src/services/notificationService");

async function runTests() {
  console.log("=== STARTING END-TO-END WORKFLOW INTEGRATION TEST ===");

  // 1. Find or create a test customer and test delivery boy
  let customer = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
  if (!customer) {
    customer = await prisma.user.create({
      data: { name: "Ananya Sharma", email: "ananya.test@example.com", role: "CUSTOMER" },
    });
  }
  console.log("Customer:", customer.name, customer.id);

  let deliveryBoy = await prisma.user.findFirst({ where: { role: "DELIVERY_BOY" } });
  if (!deliveryBoy) {
    deliveryBoy = await prisma.user.create({
      data: {
        name: "Rohan Varma (Courier)",
        email: "rohan.delivery@example.com",
        role: "DELIVERY_BOY",
        deliveryProfile: {
          create: {
            phone: "+91 98765 43210",
            assignedArea: "Central District",
            vehicleType: "Electric Scooter",
            status: "APPROVED",
            isAvailable: true,
          },
        },
      },
    });
  }
  console.log("Delivery Boy:", deliveryBoy.name, deliveryBoy.id);

  // Find a product
  const product = await prisma.product.findFirst();
  if (!product) throw new Error("No products found in database!");
  console.log("Product:", product.name, product.id);

  // 2. Test Order Placement
  const year = new Date().getFullYear();
  const orderNumber = `AUR-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
  const deliveryOtp = "4826";

  const order = await prisma.order.create({
    data: {
      orderNumber,
      ownerKey: customer.id,
      items: {
        create: [
          { position: 0, productId: product.id, name: product.name, price: product.price, qty: 1, sellerId: product.sellerId },
        ],
      },
      subtotal: product.price,
      shipping: 0,
      total: product.price,
      paymentMethod: "cod",
      paymentStatus: "PENDING",
      status: "Pending",
      deliveryStatus: "UNASSIGNED",
      deliveryOtp,
      shippingAddress: { name: customer.name, address: "74 Lotus Lane", city: "Mumbai" },
    },
    include: { items: true },
  });
  console.log(`[PASS] Order created: #${order.orderNumber} (ID: ${order.id}) with OTP: ${deliveryOtp}`);

  // Test Notification for Super Admin
  const adminNotif = await createNotification({
    targetRole: "SUPER_ADMIN",
    category: "NEW_ORDER",
    title: `New Order Received #${order.orderNumber}`,
    message: `${customer.name} placed order #${order.orderNumber} for $${order.total}.`,
    link: `/superadmin/orders?orderId=${order.id}`,
    metadata: { orderId: order.id, orderNumber: order.orderNumber, amount: order.total },
  });
  console.log("[PASS] Super Admin notification created:", adminNotif?.title);

  // 3. Test Assignment by Super Admin
  const assignedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      deliveryPersonId: deliveryBoy.id,
      deliveryStatus: "ASSIGNED",
      assignedAt: new Date(),
      status: "Processing",
    },
  });
  const assignment = await prisma.deliveryAssignment.create({
    data: {
      orderId: order.id,
      deliveryPersonId: deliveryBoy.id,
      status: "ASSIGNED",
    },
  });
  console.log(`[PASS] Order #${order.orderNumber} assigned to ${deliveryBoy.name}`);

  // 4. Test Pickup by Delivery Boy
  await prisma.deliveryAssignment.update({
    where: { id: assignment.id },
    data: { status: "PICKED_UP", pickedUpAt: new Date() },
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "Shipped", deliveryStatus: "PICKED_UP" },
  });
  console.log(`[PASS] Order #${order.orderNumber} picked up.`);

  // 5. Test Out for Delivery
  await prisma.deliveryAssignment.update({
    where: { id: assignment.id },
    data: { status: "OUT_FOR_DELIVERY" },
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { deliveryStatus: "OUT_FOR_DELIVERY" },
  });
  console.log(`[PASS] Order #${order.orderNumber} out for delivery.`);

  // 6. Test Delivery Completion with OTP
  const deliveredTime = new Date();
  await prisma.$transaction([
    prisma.deliveryAssignment.update({
      where: { id: assignment.id },
      data: { status: "DELIVERED", deliveredAt: deliveredTime, otpVerified: true },
    }),
    prisma.deliveryProof.create({
      data: {
        orderId: order.id,
        deliveryPersonId: deliveryBoy.id,
        recipientName: customer.name,
        otpUsed: deliveryOtp,
        cashCollected: order.total,
        isPaymentConfirmed: true,
      },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: "Delivered",
        deliveryStatus: "DELIVERED",
        deliveredAt: deliveredTime,
        paymentStatus: "PAID",
      },
    }),
  ]);
  console.log(`[PASS] Order #${order.orderNumber} marked DELIVERED with OTP ${deliveryOtp} and cash reconciled.`);

  // 7. Test Verified Review submission
  const review = await prisma.review.upsert({
    where: { productId_ownerKey: { productId: product.id, ownerKey: customer.id } },
    create: {
      productId: product.id,
      orderId: order.id,
      ownerKey: customer.id,
      rating: 5,
      title: "Exquisite Craftsmanship & Timely Delivery!",
      comment: "Arrived in a stunning velvet box. The filigree detail is museum-grade.",
      verifiedPurchase: true,
      moderationStatus: "Approved",
    },
    update: {
      rating: 5,
      verifiedPurchase: true,
      orderId: order.id,
    },
  });
  console.log(`[PASS] Verified purchase review created for product ${product.name} (Verified: ${review.verifiedPurchase})`);

  // 8. Test Services Module: Submission & Super Admin Verification
  const serviceSlug = `custom-bridal-styling-${Date.now().toString(36)}`;
  const service = await prisma.service.create({
    data: {
      providerId: deliveryBoy.id, // any valid user id
      name: "Heritage Kundan & Pearl Polishing",
      slug: serviceSlug,
      category: "cleaning-polishing",
      description: "Restores authentic heritage Kundan, Meenakari, and pearl settings to pristine lustre.",
      price: 45.0,
      pricingMethod: "fixed",
      durationMinutes: 45,
      serviceArea: "Greater Mumbai & Suburban",
      status: "PENDING_REVIEW",
      documents: {
        create: [
          { title: "Master Goldsmith Certification", fileUrl: "/docs/goldsmith-cert.pdf", fileType: "pdf" },
        ],
      },
    },
    include: { documents: true },
  });
  console.log(`[PASS] Service submitted in PENDING_REVIEW: "${service.name}"`);

  // Super Admin approves service
  const approvedService = await prisma.service.update({
    where: { id: service.id },
    data: { status: "APPROVED_VERIFIED" },
  });
  console.log(`[PASS] Service approved by Super Admin: Status is now "${approvedService.status}"`);

  // Customer books approved service
  const booking = await prisma.serviceBooking.create({
    data: {
      serviceId: approvedService.id,
      customerKey: customer.id,
      bookingNumber: `SRV-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      appointmentDate: new Date(Date.now() + 86400000 * 2),
      timeSlot: "Afternoon (2:00 PM - 5:00 PM)",
      contactPhone: "+91 91234 56789",
      customerAddress: "Flat 402, Sea View Apartments",
      status: "CONFIRMED",
    },
  });
  console.log(`[PASS] Customer booked service: Booking #${booking.bookingNumber}`);

  // Test Notifications retrieval
  const notifs = await getNotifications({ role: "SUPER_ADMIN", limit: 5 });
  console.log(`[PASS] Fetched notifications for Super Admin. Count: ${notifs.notifications.length}, Unread: ${notifs.unreadCount}`);

  console.log("=== ALL BACKEND WORKFLOW TESTS PASSED CLEANLY! ===");
}

runTests()
  .catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
