const router = require("express").Router();
const { prisma } = require("../db/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { createNotification } = require("../services/notificationService");
const auditLog = require("../services/auditLog");
const ah = require("../utils/asyncHandler");

function ownerKey(req) {
  return req.user?.id || req.headers["x-guest-id"] || "guest";
}

// Generate unique booking number e.g. BK-2026-48192
function generateBookingNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `SRV-${year}-${rand}`;
}

// ============================================================================
// 1. PUBLIC SERVICE DISCOVERY
// ============================================================================

// GET /api/services — List public approved & verified services
router.get("/", ah(async (req, res) => {
  const { category, q, maxPrice, sort = "rating", page = 1, limit = 20 } = req.query;

  const where = {
    status: "APPROVED_VERIFIED",
  };

  if (category && category !== "all") {
    where.category = { equals: category, mode: "insensitive" };
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { serviceArea: { contains: q, mode: "insensitive" } },
    ];
  }

  if (maxPrice) {
    where.price = { lte: Number(maxPrice) };
  }

  let orderBy = { rating: "desc" };
  if (sort === "priceAsc") orderBy = { price: "asc" };
  if (sort === "priceDesc") orderBy = { price: "desc" };
  if (sort === "newest") orderBy = { createdAt: "desc" };
  if (sort === "reviews") orderBy = { reviewCount: "desc" };

  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const [total, services] = await prisma.$transaction([
    prisma.service.count({ where }),
    prisma.service.findMany({
      where,
      orderBy,
      skip: (parsedPage - 1) * parsedLimit,
      take: parsedLimit,
      include: {
        provider: { select: { id: true, name: true, email: true, sellerProfile: { select: { storeName: true, logoUrl: true } } } },
        documents: { select: { id: true, title: true, fileUrl: true } },
      },
    }),
  ]);

  res.json({
    total,
    page: parsedPage,
    totalPages: Math.ceil(total / parsedLimit) || 1,
    services: services.map(s => ({
      ...s,
      isVerified: s.status === "APPROVED_VERIFIED",
      verifiedBadge: "Super Admin Verified",
    })),
  });
}));

// GET /api/services/categories — Featured ornament service categories
router.get("/categories", (_req, res) => {
  res.json([
    { slug: "cleaning-polishing", name: "Jewelry Cleaning & Polishing", description: "Deep ultrasonic cleaning, tarnish removal, and mirror buffing" },
    { slug: "jewelry-repair", name: "Jewelry Repair & Restoration", description: "Fix broken clasps, solder broken chains, and repair delicate filigree" },
    { slug: "ring-resizing", name: "Ring Resizing & Fitting", description: "Professional enlargement and reduction for gold, silver, and platinum rings" },
    { slug: "customization", name: "Custom Ornament Design", description: "Bespoke bridal sets, custom gemstone settings, and engraved ornaments" },
    { slug: "bridal-consultation", name: "Bridal Consultation", description: "1-on-1 virtual or in-person bridal jewellery styling consultation" },
    { slug: "maintenance", name: "Maintenance & Gold Plating", description: "Re-rhodium and high-micron 18k/24k gold electroplating" },
    { slug: "gifting", name: "Bespoke Gifting & Velvet Packaging", description: "Handmade velvet presentation boxes and calligraphy gifting notes" },
  ]);
});

// GET /api/services/:idOrSlug — Service details
router.get("/:idOrSlug", ah(async (req, res) => {
  const { idOrSlug } = req.params;

  const service = await prisma.service.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug },
      ],
    },
    include: {
      provider: { select: { id: true, name: true, email: true, sellerProfile: true } },
      documents: true,
      reviews: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!service) return res.status(404).json({ error: "Service not found" });

  res.json({
    ...service,
    isVerified: service.status === "APPROVED_VERIFIED",
    verifiedBadge: service.status === "APPROVED_VERIFIED" ? "Super Admin Verified" : null,
  });
}));

// ============================================================================
// 2. PROVIDER / SELLER SERVICE SUBMISSION
// ============================================================================

// POST /api/services — Submit service (requires SELLER or ADMIN role)
router.post("/", requireAuth, ah(async (req, res) => {
  const {
    name,
    category,
    description,
    price,
    pricingMethod = "fixed",
    durationMinutes = 60,
    serviceArea = "All Areas",
    bookingInfo,
    terms,
    coverImage,
    gallery = [],
    documents = [],
  } = req.body;

  if (!name || !category || !description || price === undefined) {
    return res.status(400).json({ error: "Name, category, description, and price are required." });
  }

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;

  const service = await prisma.$transaction(async (tx) => {
    const created = await tx.service.create({
      data: {
        providerId: req.user.id,
        name: String(name).trim(),
        slug,
        category,
        description,
        price: Number(price),
        pricingMethod,
        durationMinutes: Number(durationMinutes) || 60,
        serviceArea,
        bookingInfo,
        terms,
        coverImage: coverImage || null,
        gallery: Array.isArray(gallery) ? gallery : [],
        status: "PENDING_REVIEW", // Gated for Super Admin review
      },
    });

    if (documents.length > 0) {
      await tx.serviceDocument.createMany({
        data: documents.map(d => ({
          serviceId: created.id,
          title: d.title || "Certification / License",
          fileUrl: d.fileUrl || d.url,
          fileType: d.fileType || "application/pdf",
        })),
      });
    }

    return created;
  });

  // Notify Super Admin of new service submission
  await createNotification({
    targetRole: "SUPER_ADMIN",
    category: "NEW_SERVICE_SUBMISSION",
    title: `New Service Submission: ${service.name}`,
    message: `${req.user.name} submitted service "${service.name}" for marketplace verification.`,
    link: `/superadmin/services?serviceId=${service.id}`,
    metadata: { serviceId: service.id, name: service.name, provider: req.user.name },
  });

  res.status(201).json(service);
}));

// GET /api/services/my/submissions — Provider's own services
router.get("/my/submissions", requireAuth, ah(async (req, res) => {
  const services = await prisma.service.findMany({
    where: { providerId: req.user.id },
    include: {
      documents: true,
      bookings: { take: 10, orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(services);
}));

// ============================================================================
// 3. CUSTOMER SERVICE BOOKINGS
// ============================================================================

// POST /api/services/:id/bookings — Book a service
router.post("/:id/bookings", ah(async (req, res) => {
  const serviceId = req.params.id;
  const { appointmentDate, timeSlot, contactPhone, customerAddress, notes } = req.body;

  if (!appointmentDate) {
    return res.status(400).json({ error: "Appointment date is required." });
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { provider: true },
  });

  if (!service) return res.status(404).json({ error: "Service not found" });

  if (service.status !== "APPROVED_VERIFIED") {
    return res.status(400).json({ error: "This service is currently not available for new bookings." });
  }

  const customer = ownerKey(req);
  const bookingNumber = generateBookingNumber();

  const booking = await prisma.serviceBooking.create({
    data: {
      serviceId: service.id,
      customerKey: customer,
      bookingNumber,
      appointmentDate: new Date(appointmentDate),
      timeSlot: timeSlot || "Morning (10:00 AM - 1:00 PM)",
      contactPhone: contactPhone || null,
      customerAddress: customerAddress || null,
      notes: notes || null,
      price: service.price,
      status: "PENDING",
      paymentStatus: "PENDING",
    },
    include: {
      service: { select: { id: true, name: true, category: true, price: true } },
    },
  });

  // Notify Provider
  await createNotification({
    userId: service.providerId,
    category: "SERVICE_BOOKING",
    title: `New Service Booking: ${bookingNumber}`,
    message: `A customer requested booking for "${service.name}" on ${new Date(appointmentDate).toLocaleDateString()}.`,
    link: `/seller/services/bookings`,
    metadata: { bookingId: booking.id, bookingNumber, serviceId: service.id },
  });

  // Notify Customer if logged in
  if (req.user?.id) {
    await createNotification({
      userId: req.user.id,
      category: "SERVICE_BOOKING",
      title: `Service Booking Placed: ${bookingNumber}`,
      message: `Your booking for "${service.name}" has been received. Appointment: ${new Date(appointmentDate).toLocaleDateString()} (${timeSlot || 'Morning'}).`,
      link: `/account/bookings`,
      metadata: { bookingId: booking.id, bookingNumber },
    });
  }

  res.status(201).json(booking);
}));

// GET /api/services/bookings/my — Customer's service bookings
router.get("/bookings/my", ah(async (req, res) => {
  const customer = ownerKey(req);
  const bookings = await prisma.serviceBooking.findMany({
    where: { customerKey: customer },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          category: true,
          coverImage: true,
          price: true,
          provider: { select: { name: true, email: true } },
        },
      },
      reviews: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(bookings);
}));

// PATCH /api/services/bookings/:id/cancel — Cancel booking
router.patch("/bookings/:id/cancel", ah(async (req, res) => {
  const customer = ownerKey(req);
  const booking = await prisma.serviceBooking.findUnique({ where: { id: req.params.id } });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const isOwner = booking.customerKey === customer;
  const isAdmin = req.user && ["SUPER_ADMIN", "ADMIN"].includes(req.user.role);

  if (!isOwner && !isAdmin) return res.status(403).json({ error: "Unauthorized" });

  if (["COMPLETED", "IN_PROGRESS"].includes(booking.status)) {
    return res.status(400).json({ error: "Cannot cancel a booking that is already in progress or completed." });
  }

  const updated = await prisma.serviceBooking.update({
    where: { id: booking.id },
    data: {
      status: "CANCELLED",
      cancellationReason: req.body.reason || "Customer requested cancellation",
    },
  });

  res.json(updated);
}));

// POST /api/services/:id/reviews — Customer reviews completed service
router.post("/:id/reviews", ah(async (req, res) => {
  const serviceId = req.params.id;
  const key = ownerKey(req);
  const { rating, comment, bookingId } = req.body;

  if (!rating || Number(rating) < 1 || Number(rating) > 5) {
    return res.status(400).json({ error: "Rating must be an integer between 1 and 5." });
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return res.status(404).json({ error: "Service not found" });

  // Check verified booking
  const eligibleBooking = await prisma.serviceBooking.findFirst({
    where: {
      serviceId,
      customerKey: key,
      status: "COMPLETED",
      ...(bookingId ? { id: bookingId } : {}),
    },
  });

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceReview.create({
      data: {
        serviceId,
        bookingId: eligibleBooking?.id || undefined,
        ownerKey: key,
        rating: Number(rating),
        comment: comment || null,
      },
    });

    // Recompute service rating
    const agg = await tx.serviceReview.aggregate({
      where: { serviceId },
      _avg: { rating: true },
      _count: { _all: true },
    });

    await tx.service.update({
      where: { id: serviceId },
      data: {
        rating: Math.round((agg._avg.rating || 5) * 10) / 10,
        reviewCount: agg._count._all,
      },
    });

    return created;
  });

  res.status(201).json(review);
}));

module.exports = router;
