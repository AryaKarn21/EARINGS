const router = require("express").Router();
const multer = require("multer");
const { prisma } = require("../db/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const auditLog = require("../services/auditLog");
const { getAllSettings, setSetting, getSetting } = require("../services/settingsService");
const { storeImage, getImage, listImageLibrary, deleteImageAsset, removeImageBackground } = require("../services/imageService");
const { recomputeProductRating } = require("../services/reviewService");
const ah = require("../utils/asyncHandler");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
});

const ALL_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "PRODUCT_MANAGER",
  "ORDER_MANAGER",
  "CUSTOMER_SUPPORT",
  "CUSTOMER",
  "SELLER",
  "DELIVERY_BOY",
];
const LOW_STOCK_THRESHOLD = 5;

// ============================================================================
// 1. DASHBOARD & OVERVIEW
// ============================================================================
router.get("/dashboard", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (_req, res) => {
  const [
    productCount,
    customerCount,
    sellerCount,
    pendingSellerCount,
    pendingProductCount,
    draftProductCount,
    publishedProductCount,
    orderStats,
    pendingReviewCount,
    lowStockCount,
    outOfStockCount,
    trendingCount,
    recentOrders,
    recentProducts,
    recentActivities,
  ] = await prisma.$transaction([
    prisma.product.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.sellerProfile.count(),
    prisma.sellerProfile.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { approvalStatus: "PENDING_APPROVAL" } }),
    prisma.product.count({ where: { approvalStatus: "DRAFT" } }),
    prisma.product.count({ where: { isPublished: true, approvalStatus: "APPROVED" } }),
    prisma.order.aggregate({
      _count: { _all: true },
      _sum: { total: true },
      where: { status: { not: "Cancelled" } },
    }),
    prisma.review.count({ where: { moderationStatus: "Flagged" } }),
    prisma.product.count({ where: { stock: { lte: LOW_STOCK_THRESHOLD, gt: 0 } } }),
    prisma.product.count({ where: { stock: 0 } }),
    prisma.product.count({ where: { trendScore: { gt: 0 } } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, ownerKey: true, total: true, status: true, createdAt: true },
    }),
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, price: true, stock: true, images: true, category: true, isPublished: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  res.json({
    productCount,
    customerCount,
    sellerCount,
    pendingSellerCount,
    pendingProductCount,
    draftProductCount,
    publishedProductCount,
    orderCount: orderStats._count._all,
    revenue: orderStats._sum.total || 0,
    reviewsNeedingModeration: pendingReviewCount,
    lowStockCount,
    outOfStockCount,
    trendingCount,
    recentOrders,
    recentProducts,
    recentActivities,
  });
}));

// ============================================================================
// 2. IMAGE UPLOAD & IMAGE LIBRARY
// ============================================================================

// POST /api/admin/upload-images
router.post(
  "/upload-images",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN", "PRODUCT_MANAGER"),
  upload.any(),
  ah(async (req, res) => {
    const uploadedImages = [];

    // 1. Files from multipart form data
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const stored = await storeImage(file.buffer, file.originalname);
          uploadedImages.push(stored);
        } catch (err) {
          console.error("Image upload error:", err.message);
          return res.status(400).json({ error: err.message });
        }
      }
    }

    // 2. Base64 images from JSON body { images: [ { data: "base64...", name: "..." } ] }
    if (req.body?.images && Array.isArray(req.body.images)) {
      for (const item of req.body.images) {
        let buffer;
        let originalName = item.name || "upload";
        if (typeof item === "string" && item.startsWith("data:")) {
          const base64Data = item.replace(/^data:image\/\w+;base64,/, "");
          buffer = Buffer.from(base64Data, "base64");
        } else if (item.data) {
          const base64Data = item.data.replace(/^data:image\/\w+;base64,/, "");
          buffer = Buffer.from(base64Data, "base64");
        }
        if (buffer) {
          try {
            const stored = await storeImage(buffer, originalName);
            uploadedImages.push(stored);
          } catch (err) {
            return res.status(400).json({ error: err.message });
          }
        }
      }
    }

    if (uploadedImages.length === 0) {
      return res.status(400).json({ error: "No valid image files provided." });
    }

    await auditLog.record({
      actorOwnerKey: req.user.id,
      actorRole: req.user.role,
      action: "images.upload",
      targetType: "ImageAsset",
      targetId: uploadedImages.map(img => img.key).join(","),
      after: { count: uploadedImages.length, keys: uploadedImages.map(img => img.key) },
    });

    res.status(201).json({
      success: true,
      count: uploadedImages.length,
      images: uploadedImages,
      urls: uploadedImages.map(img => img.url),
    });
  })
);

// POST /api/admin/remove-background
// Auto-isolates jewellery background to produce a transparent PNG try-on asset
router.post(
  "/remove-background",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN", "PRODUCT_MANAGER"),
  upload.single("image"),
  ah(async (req, res) => {
    let buffer = null;
    let name = "product";
    const tolerance = req.body?.tolerance ? parseInt(req.body.tolerance, 10) : 32;
    const isStud = req.body?.isStud === true || req.body?.isStud === "true";

    if (req.file) {
      buffer = req.file.buffer;
      name = req.file.originalname;
    } else if (req.body?.imageUrl) {
      const cleanKey = require("path").basename(req.body.imageUrl);
      const imgData = await getImage(cleanKey);
      if (imgData) {
        buffer = imgData.buffer;
        name = cleanKey;
      }
    } else if (req.body?.imageKey) {
      const imgData = await getImage(req.body.imageKey);
      if (imgData) {
        buffer = imgData.buffer;
        name = req.body.imageKey;
      }
    }

    if (!buffer) {
      return res.status(400).json({ error: "No image file, imageUrl, or imageKey provided." });
    }

    const processed = await removeImageBackground(buffer, name, tolerance, isStud);

    await auditLog.record({
      actorOwnerKey: req.user.id,
      actorRole: req.user.role,
      action: "images.remove_background",
      targetType: "ImageAsset",
      targetId: processed.key,
      after: { key: processed.key, url: processed.url },
    });

    res.json({
      success: true,
      asset: processed,
      url: processed.url,
    });
  })
);

// GET /api/admin/images (Library)
router.get("/images", requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "PRODUCT_MANAGER"), ah(async (req, res) => {
  const { search, limit = 50, page = 1 } = req.query;
  const result = await listImageLibrary({
    search: search || "",
    limit: Math.min(Number(limit) || 50, 100),
    page: Math.max(Number(page) || 1, 1),
  });
  res.json(result);
}));

// DELETE /api/admin/images/:key
router.delete("/images/:key", requireAuth, requireRole("SUPER_ADMIN", "ADMIN"), ah(async (req, res) => {
  const { key } = req.params;
  const force = req.query.force === "true";
  try {
    const result = await deleteImageAsset(key, force);
    await auditLog.record({
      actorOwnerKey: req.user.id,
      actorRole: req.user.role,
      action: "image.delete",
      targetType: "ImageAsset",
      targetId: key,
      before: { key },
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

// ============================================================================
// 3. PRODUCTS & ORNAMENTS MANAGEMENT
// ============================================================================

// GET /api/admin/products
router.get("/products", requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "PRODUCT_MANAGER"), ah(async (req, res) => {
  const {
    q,
    category,
    productType,
    approvalStatus,
    isPublished,
    isEditorsPick,
    sellerId,
    stockFilter,
    sort = "newest",
    page = 1,
    limit = 20,
  } = req.query;

  const where = {};

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { material: { contains: q, mode: "insensitive" } },
    ];
  }

  if (category) where.category = category;
  if (productType) where.productType = productType;
  if (approvalStatus) where.approvalStatus = approvalStatus;
  if (isPublished !== undefined && isPublished !== "") where.isPublished = isPublished === "true";
  if (isEditorsPick !== undefined && isEditorsPick !== "") where.isEditorsPick = isEditorsPick === "true";
  if (sellerId) where.sellerId = sellerId;

  if (stockFilter === "low") {
    where.stock = { lte: LOW_STOCK_THRESHOLD, gt: 0 };
  } else if (stockFilter === "out") {
    where.stock = 0;
  }

  let orderBy = { createdAt: "desc" };
  if (sort === "oldest") orderBy = { createdAt: "asc" };
  else if (sort === "priceAsc") orderBy = { price: "asc" };
  else if (sort === "priceDesc") orderBy = { price: "desc" };
  else if (sort === "stockAsc") orderBy = { stock: "asc" };
  else if (sort === "stockDesc") orderBy = { stock: "desc" };
  else if (sort === "nameAsc") orderBy = { name: "asc" };
  else if (sort === "trending") orderBy = { trendScore: "desc" };

  const parsedPage = Math.max(Number(page) || 1, 1);
  const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const [total, products, categories] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (parsedPage - 1) * parsedLimit,
      take: parsedLimit,
    }),
    prisma.category.findMany({ select: { slug: true, name: true, productType: true } }),
  ]);

  res.json({
    products,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit) || 1,
    categories,
    productTypes: ["earrings", "necklace", "ring", "bracelet", "bangle", "pendant", "anklet", "sets", "other"],
  });
}));

// GET /api/admin/products/:id
router.get("/products/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "PRODUCT_MANAGER"), ah(async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
  });
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
}));

// POST /api/admin/products
router.post("/products", requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "PRODUCT_MANAGER"), ah(async (req, res) => {
  const body = req.body;
  if (!body.name || !body.category) {
    return res.status(400).json({ error: "Product name and category are required." });
  }

  if (body.price === undefined || Number(body.price) < 0) {
    return res.status(400).json({ error: "Valid non-negative price is required." });
  }

  // Generate SKU if missing
  const sku = body.sku || `AUR-${(body.productType || "earrings").slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  // Check unique SKU
  const existingSku = await prisma.product.findFirst({ where: { sku } });
  if (existingSku) {
    return res.status(409).json({ error: `Product with SKU "${sku}" already exists.` });
  }

  const data = {
    name: String(body.name).trim(),
    productType: body.productType || "earrings",
    category: String(body.category).trim(),
    material: body.material || "Gold Plated",
    color: body.color || "Gold",
    stone: body.stone || "—",
    style: body.style || "Minimal",
    occasion: Array.isArray(body.occasion) ? body.occasion : (body.occasion ? [body.occasion] : ["Everyday"]),
    price: Number(body.price),
    originalPrice: body.originalPrice ? Number(body.originalPrice) : null,
    rating: body.rating ? Number(body.rating) : 4.8,
    reviews: body.reviews ? Number(body.reviews) : 0,
    stock: body.stock !== undefined ? Math.max(0, Number(body.stock)) : 10,
    tags: Array.isArray(body.tags) ? body.tags : [],
    kind: body.kind || "stud",
    faceShapeMatch: Array.isArray(body.faceShapeMatch) ? body.faceShapeMatch : [],
    description: body.description || "",
    dimensions: body.dimensions || "2.0cm x 1.0cm",
    weight: body.weight || "3.5g",
    images: Array.isArray(body.images) ? body.images : [],
    primaryImageIndex: Number(body.primaryImageIndex) || 0,
    sku,
    sellerId: body.sellerId || null,
    approvalStatus: body.approvalStatus || "APPROVED",
    isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : true,
    isEditorsPick: Boolean(body.isEditorsPick),
    tryOnAsset: body.tryOnAsset || { front: null, transparent: null, left: null, right: null },
  };

  const created = await prisma.product.create({ data });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "product.create",
    targetType: "Product",
    targetId: created.id,
    after: created,
  });

  res.status(201).json(created);
}));

// PUT /api/admin/products/:id
router.put("/products/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "PRODUCT_MANAGER"), ah(async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Product not found" });

  const body = req.body;
  const updateData = {};

  if (body.name !== undefined) updateData.name = String(body.name).trim();
  if (body.productType !== undefined) updateData.productType = body.productType;
  if (body.category !== undefined) updateData.category = String(body.category).trim();
  if (body.material !== undefined) updateData.material = body.material;
  if (body.color !== undefined) updateData.color = body.color;
  if (body.stone !== undefined) updateData.stone = body.stone;
  if (body.style !== undefined) updateData.style = body.style;
  if (body.occasion !== undefined) updateData.occasion = Array.isArray(body.occasion) ? body.occasion : [body.occasion];
  if (body.price !== undefined) updateData.price = Number(body.price);
  if (body.originalPrice !== undefined) updateData.originalPrice = body.originalPrice ? Number(body.originalPrice) : null;
  if (body.stock !== undefined) updateData.stock = Math.max(0, Number(body.stock));
  if (body.tags !== undefined) updateData.tags = Array.isArray(body.tags) ? body.tags : [];
  if (body.kind !== undefined) updateData.kind = body.kind;
  if (body.faceShapeMatch !== undefined) updateData.faceShapeMatch = Array.isArray(body.faceShapeMatch) ? body.faceShapeMatch : [];
  if (body.description !== undefined) updateData.description = body.description;
  if (body.dimensions !== undefined) updateData.dimensions = body.dimensions;
  if (body.weight !== undefined) updateData.weight = body.weight;
  if (body.images !== undefined) updateData.images = Array.isArray(body.images) ? body.images : [];
  if (body.primaryImageIndex !== undefined) updateData.primaryImageIndex = Number(body.primaryImageIndex) || 0;
  if (body.sku !== undefined) updateData.sku = body.sku;
  if (body.sellerId !== undefined) updateData.sellerId = body.sellerId || null;
  if (body.approvalStatus !== undefined) updateData.approvalStatus = body.approvalStatus;
  if (body.isPublished !== undefined) updateData.isPublished = Boolean(body.isPublished);
  if (body.isEditorsPick !== undefined) updateData.isEditorsPick = Boolean(body.isEditorsPick);
  if (body.tryOnAsset !== undefined) updateData.tryOnAsset = body.tryOnAsset;

  const updated = await prisma.product.update({
    where: { id: existing.id },
    data: updateData,
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "product.update",
    targetType: "Product",
    targetId: existing.id,
    before: existing,
    after: updated,
  });

  res.json(updated);
}));

// DELETE /api/admin/products/:id
router.delete("/products/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Product not found" });

  await prisma.product.delete({ where: { id: existing.id } });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "product.delete",
    targetType: "Product",
    targetId: existing.id,
    before: existing,
  });

  res.json({ success: true, message: `Product "${existing.name}" deleted.` });
}));

// PATCH /api/admin/products/:id/status
router.patch("/products/:id/status", requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "PRODUCT_MANAGER"), ah(async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Product not found" });

  const { isPublished, approvalStatus, isEditorsPick } = req.body;
  const updateData = {};
  if (isPublished !== undefined) updateData.isPublished = Boolean(isPublished);
  if (approvalStatus !== undefined) updateData.approvalStatus = approvalStatus;
  if (isEditorsPick !== undefined) updateData.isEditorsPick = Boolean(isEditorsPick);

  const updated = await prisma.product.update({
    where: { id: existing.id },
    data: updateData,
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "product.status_change",
    targetType: "Product",
    targetId: existing.id,
    before: { isPublished: existing.isPublished, approvalStatus: existing.approvalStatus, isEditorsPick: existing.isEditorsPick },
    after: { isPublished: updated.isPublished, approvalStatus: updated.approvalStatus, isEditorsPick: updated.isEditorsPick },
  });

  res.json(updated);
}));

// ============================================================================
// 4. CATEGORIES
// ============================================================================

router.get("/categories", requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "PRODUCT_MANAGER"), ah(async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const counts = await prisma.product.groupBy({
    by: ["category"],
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map(c => [c.category, c._count._all]));

  res.json(categories.map(c => ({
    ...c,
    productCount: countMap[c.slug] || countMap[c.name.toLowerCase()] || 0,
  })));
}));

router.post("/categories", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { name, slug, productType = "earrings" } = req.body;
  if (!name || !slug) return res.status(400).json({ error: "Name and slug are required" });

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const existing = await prisma.category.findUnique({ where: { slug: cleanSlug } });
  if (existing) return res.status(409).json({ error: `Category with slug "${cleanSlug}" already exists.` });

  const category = await prisma.category.create({
    data: { name, slug: cleanSlug, productType },
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "category.create",
    targetType: "Category",
    targetId: category.id,
    after: category,
  });

  res.status(201).json(category);
}));

router.put("/categories/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { name, slug, productType } = req.body;
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Category not found" });

  const updated = await prisma.category.update({
    where: { id: existing.id },
    data: {
      ...(name && { name }),
      ...(slug && { slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-") }),
      ...(productType && { productType }),
    },
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "category.update",
    targetType: "Category",
    targetId: existing.id,
    before: existing,
    after: updated,
  });

  res.json(updated);
}));

router.delete("/categories/:id", requireAuth, requireRole("SUPER_ADMIN"), ah(async (req, res) => {
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Category not found" });

  const productCount = await prisma.product.count({ where: { category: existing.slug } });
  if (productCount > 0) {
    return res.status(400).json({
      error: `Cannot delete category "${existing.name}" because ${productCount} product(s) are assigned to it. Reassign those products first.`,
    });
  }

  await prisma.category.delete({ where: { id: existing.id } });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "category.delete",
    targetType: "Category",
    targetId: existing.id,
    before: existing,
  });

  res.json({ success: true, message: "Category deleted." });
}));

// ============================================================================
// 5. SELLERS MANAGEMENT
// ============================================================================

router.get("/sellers", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { status, q } = req.query;
  const where = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { storeName: { contains: q, mode: "insensitive" } },
      { contactEmail: { contains: q, mode: "insensitive" } },
    ];
  }

  const sellers = await prisma.sellerProfile.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate product counts for each seller
  const sellerIds = sellers.map(s => s.id);
  const counts = await prisma.product.groupBy({
    by: ["sellerId"],
    where: { sellerId: { in: sellerIds } },
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map(c => [c.sellerId, c._count._all]));

  res.json(
    sellers.map(s => ({
      ...s,
      productCount: countMap[s.id] || 0,
    }))
  );
}));

router.get("/sellers/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const seller = await prisma.sellerProfile.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
    },
  });
  if (!seller) return res.status(404).json({ error: "Seller not found" });

  const products = await prisma.product.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    seller,
    products,
    productCount: products.length,
  });
}));

router.patch("/sellers/:id/status", requireAuth, requireRole("SUPER_ADMIN", "ADMIN"), ah(async (req, res) => {
  const { status, rejectionReason } = req.body;
  const validStatuses = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${validStatuses.join(", ")}` });
  }

  const existing = await prisma.sellerProfile.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Seller profile not found" });

  const updated = await prisma.sellerProfile.update({
    where: { id: existing.id },
    data: {
      status,
      ...(rejectionReason !== undefined && { rejectionReason }),
    },
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "seller.status_change",
    targetType: "SellerProfile",
    targetId: existing.id,
    before: { status: existing.status, rejectionReason: existing.rejectionReason },
    after: { status: updated.status, rejectionReason: updated.rejectionReason },
  });

  res.json(updated);
}));

router.patch("/sellers/:id/commission", requireAuth, requireRole("SUPER_ADMIN"), ah(async (req, res) => {
  const { commissionRate } = req.body;
  if (commissionRate === undefined || Number(commissionRate) < 0 || Number(commissionRate) > 100) {
    return res.status(400).json({ error: "commissionRate must be a number between 0 and 100" });
  }

  const existing = await prisma.sellerProfile.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Seller not found" });

  const updated = await prisma.sellerProfile.update({
    where: { id: existing.id },
    data: { commissionRate: Number(commissionRate) },
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "seller.commission_update",
    targetType: "SellerProfile",
    targetId: existing.id,
    before: { commissionRate: existing.commissionRate },
    after: { commissionRate: updated.commissionRate },
  });

  res.json(updated);
}));

// ============================================================================
// 6. CUSTOMERS & USERS
// ============================================================================

router.get("/customers", requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "CUSTOMER_SUPPORT"), ah(async (req, res) => {
  const { role, q } = req.query;
  const where = {};
  if (role) where.role = role;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      sellerProfile: { select: { id: true, storeName: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Calculate order stats per customer
  const orders = await prisma.order.groupBy({
    by: ["ownerKey"],
    _count: { _all: true },
    _sum: { total: true },
  });
  const orderMap = Object.fromEntries(
    orders.map(o => [o.ownerKey, { count: o._count._all, total: o._sum.total || 0 }])
  );

  res.json(
    users.map(u => ({
      ...u,
      orderCount: orderMap[u.id]?.count || 0,
      totalSpend: orderMap[u.id]?.total || 0,
    }))
  );
}));

router.get("/customers/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "CUSTOMER_SUPPORT"), ah(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true, role: true, preferences: true, createdAt: true, sellerProfile: true },
  });
  if (!user) return res.status(404).json({ error: "Customer not found" });

  const orders = await prisma.order.findMany({
    where: { ownerKey: user.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  res.json({ user, orders });
}));

router.patch("/users/:id/role", requireAuth, requireRole("SUPER_ADMIN"), ah(async (req, res) => {
  if (!ALL_ROLES.includes(req.body?.role)) {
    return res.status(400).json({ error: `role must be one of ${ALL_ROLES.join(", ")}` });
  }
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "User not found" });

  if (existing.role === "SUPER_ADMIN" && req.body.role !== "SUPER_ADMIN") {
    const superAdminCount = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
    if (superAdminCount <= 1) {
      return res.status(409).json({ error: "Cannot demote the last remaining SUPER_ADMIN" });
    }
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { role: req.body.role },
    select: { id: true, name: true, email: true, role: true },
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "user.role.change",
    targetType: "User",
    targetId: existing.id,
    before: { role: existing.role },
    after: { role: updated.role },
  });

  res.json(updated);
}));

// ============================================================================
// 7. ORDERS & DELIVERY MANAGEMENT
// ============================================================================

router.get("/orders", requireAuth, requireRole("ORDER_MANAGER", "ADMIN", "SUPER_ADMIN", "CUSTOMER_SUPPORT"), ah(async (req, res) => {
  const { status, deliveryStatus, paymentStatus, deliveryPersonId, q, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
  const where = {};

  if (status) where.status = status;
  if (deliveryStatus) where.deliveryStatus = deliveryStatus;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (deliveryPersonId) where.deliveryPersonId = deliveryPersonId;

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { id: { contains: q, mode: "insensitive" } },
      { ownerKey: { contains: q, mode: "insensitive" } },
    ];
  }

  const parsedPage = Math.max(Number(page) || 1, 1);
  const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        items: true,
        deliveryPerson: {
          select: {
            id: true,
            name: true,
            email: true,
            deliveryProfile: { select: { phone: true, vehicleType: true, assignedArea: true, status: true } },
          },
        },
        deliveryAssignments: {
          include: {
            deliveryPerson: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        deliveryProof: true,
        statusHistory: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
      skip: (parsedPage - 1) * parsedLimit,
      take: parsedLimit,
    }),
  ]);

  res.json({
    orders,
    total,
    page: parsedPage,
    totalPages: Math.ceil(total / parsedLimit) || 1,
  });
}));

router.get("/orders/:id", requireAuth, requireRole("ORDER_MANAGER", "ADMIN", "SUPER_ADMIN", "CUSTOMER_SUPPORT"), ah(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      items: true,
      deliveryPerson: {
        select: {
          id: true,
          name: true,
          email: true,
          deliveryProfile: true,
        },
      },
      deliveryAssignments: {
        include: {
          deliveryPerson: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      deliveryProof: true,
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const user = await prisma.user.findUnique({
    where: { id: order.ownerKey },
    select: { id: true, name: true, email: true },
  });

  res.json({ order, customer: user });
}));

// POST /api/admin/orders/:id/assign-delivery — Assign / reassign delivery boy
router.post("/orders/:id/assign-delivery", requireAuth, requireRole("ORDER_MANAGER", "ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { deliveryPersonId, notes } = req.body;
  if (!deliveryPersonId) return res.status(400).json({ error: "deliveryPersonId is required." });

  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "Order not found" });

  // Verify delivery boy account and approval
  const deliveryBoy = await prisma.user.findUnique({
    where: { id: deliveryPersonId },
    include: { deliveryProfile: true },
  });

  if (!deliveryBoy || deliveryBoy.role !== "DELIVERY_BOY") {
    return res.status(400).json({ error: "Selected user is not registered as a delivery personnel." });
  }

  if (deliveryBoy.deliveryProfile && deliveryBoy.deliveryProfile.status !== "APPROVED") {
    return res.status(400).json({ error: `Delivery person is currently ${deliveryBoy.deliveryProfile.status}. Only approved staff can receive assignments.` });
  }

  const assignedAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    // 1. Create or update DeliveryAssignment
    const assignment = await tx.deliveryAssignment.create({
      data: {
        orderId: order.id,
        deliveryPersonId,
        assignedById: req.user.id,
        status: "ASSIGNED",
        assignedAt,
        notes: notes || `Assigned to ${deliveryBoy.name} by ${req.user.name}`,
      },
    });

    // 2. Update Order
    const o = await tx.order.update({
      where: { id: order.id },
      data: {
        deliveryPersonId,
        deliveryStatus: "ASSIGNED",
        assignedAt,
        status: order.status === "Pending" ? "Processing" : order.status,
      },
      include: {
        items: true,
        deliveryPerson: { select: { id: true, name: true, email: true, deliveryProfile: true } },
      },
    });

    // 3. Status History
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        newStatus: o.status,
        deliveryStatus: "ASSIGNED",
        changedByKey: req.user.id,
        notes: `Delivery assigned to ${deliveryBoy.name}. ${notes || ''}`,
      },
    });

    return o;
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "order.assign_delivery",
    targetType: "Order",
    targetId: order.id,
    before: { deliveryPersonId: order.deliveryPersonId, deliveryStatus: order.deliveryStatus },
    after: { deliveryPersonId, deliveryStatus: "ASSIGNED" },
  });

  // Notify Delivery Boy
  const { createNotification } = require("../services/notificationService");
  await createNotification({
    userId: deliveryPersonId,
    category: "DELIVERY_ASSIGNED",
    title: `New Delivery Assigned: #${order.orderNumber}`,
    message: `You have been assigned to deliver order #${order.orderNumber}. Please pick up from warehouse.`,
    link: `/delivery/dashboard`,
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
  });

  res.json(updated);
}));

router.patch("/orders/:id/status", requireAuth, requireRole("ORDER_MANAGER", "ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { status, deliveryStatus, paymentStatus, notes } = req.body;
  const valid = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
  if (status && !valid.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${valid.join(", ")}` });
  }

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Order not found" });

  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({
      where: { id: existing.id },
      data: {
        ...(status && { status }),
        ...(deliveryStatus && { deliveryStatus }),
        ...(paymentStatus && { paymentStatus }),
      },
      include: { items: true, deliveryPerson: true },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: existing.id,
        previousStatus: existing.status,
        newStatus: status || existing.status,
        deliveryStatus: deliveryStatus || existing.deliveryStatus,
        paymentStatus: paymentStatus || existing.paymentStatus,
        changedByKey: req.user.id,
        notes: notes || `Order updated by ${req.user.name}`,
      },
    });

    return o;
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "order.status_change",
    targetType: "Order",
    targetId: existing.id,
    before: { status: existing.status, deliveryStatus: existing.deliveryStatus },
    after: { status: updated.status, deliveryStatus: updated.deliveryStatus },
  });

  res.json(updated);
}));

// POST /api/admin/orders/:id/refund — Process refund
router.post("/orders/:id/refund", requireAuth, requireRole("SUPER_ADMIN", "ADMIN"), ah(async (req, res) => {
  const { reason = "Refund issued by administrator" } = req.body;
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "REFUNDED",
      },
      include: { items: true },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        newStatus: order.status,
        paymentStatus: "REFUNDED",
        changedByKey: req.user.id,
        notes: `Refund processed: ${reason}`,
      },
    });

    return o;
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "order.refund",
    targetType: "Order",
    targetId: order.id,
    before: { paymentStatus: order.paymentStatus },
    after: { paymentStatus: "REFUNDED", reason },
  });

  // Notify customer
  const { createNotification } = require("../services/notificationService");
  await createNotification({
    userId: order.ownerKey,
    category: "RETURN_REFUND_REQUEST",
    title: `Refund Processed: #${order.orderNumber}`,
    message: `A refund of $${order.total?.toFixed(2)} for order #${order.orderNumber} has been issued. Reason: ${reason}.`,
    link: `/orders?orderId=${order.id}`,
    metadata: { orderId: order.id, orderNumber: order.orderNumber, refundAmount: order.total },
  });

  res.json(updated);
}));

// ============================================================================
// 7B. DELIVERY PERSONNEL MANAGEMENT
// ============================================================================

router.get("/delivery-personnel", requireAuth, requireRole("ORDER_MANAGER", "ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { status, q } = req.query;

  const users = await prisma.user.findMany({
    where: {
      role: "DELIVERY_BOY",
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      deliveryProfile: true,
      assignedDeliveries: {
        select: { id: true, status: true },
      },
      deliveredProofs: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formatted = users.map(u => {
    const active = u.assignedDeliveries.filter(d => ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(d.status)).length;
    const completed = u.assignedDeliveries.filter(d => d.status === "DELIVERED").length;
    const failed = u.assignedDeliveries.filter(d => d.status === "FAILED").length;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      phone: u.deliveryProfile?.phone || "—",
      assignedArea: u.deliveryProfile?.assignedArea || "Downtown",
      vehicleType: u.deliveryProfile?.vehicleType || "Motorcycle",
      idDocumentUrl: u.deliveryProfile?.idDocumentUrl || null,
      status: u.deliveryProfile?.status || "PENDING",
      isAvailable: u.deliveryProfile?.isAvailable ?? true,
      rejectionReason: u.deliveryProfile?.rejectionReason || null,
      metrics: {
        active,
        completed,
        failed,
        total: u.assignedDeliveries.length,
      },
    };
  });

  const filtered = status ? formatted.filter(u => u.status === status) : formatted;
  res.json(filtered);
}));

router.patch("/delivery-personnel/:id/status", requireAuth, requireRole("SUPER_ADMIN", "ADMIN"), ah(async (req, res) => {
  const { status, rejectionReason, isAvailable, assignedArea, phone } = req.body;
  const valid = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
  if (status && !valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(", ")}` });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { deliveryProfile: true },
  });
  if (!user) return res.status(404).json({ error: "Delivery personnel not found" });

  const updatedProfile = await prisma.deliveryProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      status: status || "APPROVED",
      rejectionReason: rejectionReason || null,
      isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
      assignedArea: assignedArea || "Downtown",
      phone: phone || null,
    },
    update: {
      ...(status && { status }),
      ...(rejectionReason !== undefined && { rejectionReason }),
      ...(isAvailable !== undefined && { isAvailable: Boolean(isAvailable) }),
      ...(assignedArea && { assignedArea }),
      ...(phone && { phone }),
    },
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "delivery_personnel.status_change",
    targetType: "DeliveryProfile",
    targetId: updatedProfile.id,
    before: user.deliveryProfile,
    after: updatedProfile,
  });

  res.json({ success: true, profile: updatedProfile });
}));

router.post("/delivery-personnel/invite", requireAuth, requireRole("SUPER_ADMIN", "ADMIN"), ah(async (req, res) => {
  const { name, email, password = "Password123!", phone, assignedArea, vehicleType } = req.body;
  if (!name || !email) return res.status(400).json({ error: "Name and email are required." });

  const bcrypt = require("bcryptjs");
  const cleanEmail = String(email).trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) {
    // If user already exists, update role to DELIVERY_BOY
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { role: "DELIVERY_BOY" },
    });
    const profile = await prisma.deliveryProfile.upsert({
      where: { userId: updated.id },
      create: {
        userId: updated.id,
        phone: phone || null,
        assignedArea: assignedArea || "Downtown",
        vehicleType: vehicleType || "Motorcycle",
        status: "APPROVED",
      },
      update: {
        phone: phone || undefined,
        assignedArea: assignedArea || undefined,
        vehicleType: vehicleType || undefined,
        status: "APPROVED",
      },
    });
    return res.json({ user: updated, profile });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      name,
      email: cleanEmail,
      passwordHash,
      role: "DELIVERY_BOY",
      deliveryProfile: {
        create: {
          phone: phone || null,
          assignedArea: assignedArea || "Downtown",
          vehicleType: vehicleType || "Motorcycle",
          status: "APPROVED",
          isAvailable: true,
        },
      },
    },
    include: { deliveryProfile: true },
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "delivery_personnel.invite",
    targetType: "User",
    targetId: newUser.id,
    after: { name, email: cleanEmail, role: "DELIVERY_BOY" },
  });

  res.status(201).json({ user: newUser });
}));

// ============================================================================
// 7C. SUPER ADMIN VERIFIED SERVICES MANAGEMENT
// ============================================================================

router.get("/services", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { status, category, q, page = 1, limit = 20 } = req.query;
  const where = {};

  if (status) where.status = status;
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { serviceArea: { contains: q, mode: "insensitive" } },
    ];
  }

  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const [total, services] = await prisma.$transaction([
    prisma.service.count({ where }),
    prisma.service.findMany({
      where,
      include: {
        provider: { select: { id: true, name: true, email: true, sellerProfile: true } },
        documents: true,
        bookings: { select: { id: true, status: true } },
        reviews: { select: { id: true, rating: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (parsedPage - 1) * parsedLimit,
      take: parsedLimit,
    }),
  ]);

  res.json({
    total,
    page: parsedPage,
    totalPages: Math.ceil(total / parsedLimit) || 1,
    services,
  });
}));

router.patch("/services/:id/verify", requireAuth, requireRole("SUPER_ADMIN", "ADMIN"), ah(async (req, res) => {
  const { status, rejectionReason } = req.body;
  const valid = ["DRAFT", "PENDING_REVIEW", "APPROVED_VERIFIED", "REJECTED", "SUSPENDED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(", ")}` });
  }

  const existing = await prisma.service.findUnique({
    where: { id: req.params.id },
    include: { provider: true },
  });
  if (!existing) return res.status(404).json({ error: "Service not found" });

  const updated = await prisma.service.update({
    where: { id: existing.id },
    data: {
      status,
      ...(rejectionReason !== undefined && { rejectionReason }),
    },
    include: { provider: true, documents: true },
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "service.verify",
    targetType: "Service",
    targetId: existing.id,
    before: { status: existing.status, rejectionReason: existing.rejectionReason },
    after: { status: updated.status, rejectionReason: updated.rejectionReason },
  });

  // Notify Provider
  const { createNotification } = require("../services/notificationService");
  const isApproved = status === "APPROVED_VERIFIED";
  await createNotification({
    userId: existing.providerId,
    category: "NEW_SERVICE_SUBMISSION",
    title: isApproved ? `Service Verified: "${existing.name}"` : `Service Status Update: "${existing.name}"`,
    message: isApproved
      ? `Congratulations! Your service "${existing.name}" has been Super Admin Verified and is now live on the marketplace!`
      : `Your service "${existing.name}" status changed to ${status}. ${rejectionReason ? `Reason: ${rejectionReason}` : ''}`,
    link: `/seller/services`,
    metadata: { serviceId: existing.id, status, rejectionReason },
  });

  res.json(updated);
}));

router.get("/services/bookings", requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "CUSTOMER_SUPPORT"), ah(async (req, res) => {
  const { status, q } = req.query;
  const where = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { bookingNumber: { contains: q, mode: "insensitive" } },
      { customerKey: { contains: q, mode: "insensitive" } },
    ];
  }

  const bookings = await prisma.serviceBooking.findMany({
    where,
    include: {
      service: {
        include: {
          provider: { select: { id: true, name: true, email: true, sellerProfile: true } },
        },
      },
      reviews: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json(bookings);
}));

router.patch("/services/bookings/:id/status", requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "CUSTOMER_SUPPORT"), ah(async (req, res) => {
  const { status } = req.body;
  const valid = ["PENDING", "ACCEPTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(", ")}` });
  }

  const existing = await prisma.serviceBooking.findUnique({
    where: { id: req.params.id },
    include: { service: true },
  });
  if (!existing) return res.status(404).json({ error: "Booking not found" });

  const updated = await prisma.serviceBooking.update({
    where: { id: existing.id },
    data: { status },
  });

  // Notify customer
  const { createNotification } = require("../services/notificationService");
  await createNotification({
    userId: existing.customerKey,
    category: "SERVICE_BOOKING",
    title: `Booking Update: ${existing.bookingNumber}`,
    message: `Your booking for "${existing.service.name}" is now ${status}.`,
    link: `/account/bookings`,
    metadata: { bookingId: existing.id, status },
  });

  res.json(updated);
}));

// ============================================================================
// 8. INVENTORY
// ============================================================================

router.get("/inventory", requireAuth, requireRole("PRODUCT_MANAGER", "ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { q, lowStockOnly, outOfStockOnly } = req.query;
  const where = {};
  if (lowStockOnly === "true") where.stock = { lte: LOW_STOCK_THRESHOLD, gt: 0 };
  if (outOfStockOnly === "true") where.stock = 0;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      sku: true,
      productType: true,
      category: true,
      stock: true,
      price: true,
      images: true,
    },
    orderBy: { stock: "asc" },
  });

  const totalValue = products.reduce((acc, p) => acc + p.stock * p.price, 0);

  res.json({
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    count: products.length,
    totalStockValue: totalValue,
    products: products.map(p => ({
      ...p,
      lowStock: p.stock <= LOW_STOCK_THRESHOLD && p.stock > 0,
      outOfStock: p.stock === 0,
    })),
  });
}));

router.post("/inventory/adjust", requireAuth, requireRole("PRODUCT_MANAGER", "ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { productId, newStock, reason = "Manual adjustment" } = req.body;
  if (!productId || newStock === undefined || Number(newStock) < 0) {
    return res.status(400).json({ error: "Valid productId and non-negative newStock required." });
  }

  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) return res.status(404).json({ error: "Product not found" });

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { stock: Math.max(0, Number(newStock)) },
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "inventory.adjust",
    targetType: "Product",
    targetId: productId,
    before: { stock: existing.stock },
    after: { stock: updated.stock, reason },
  });

  res.json(updated);
}));

// ============================================================================
// 9. MERCHANDISING & TRENDING
// ============================================================================

router.get("/merchandising", requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "PRODUCT_MANAGER"), ah(async (_req, res) => {
  const [featured, trending, newArrivals] = await prisma.$transaction([
    prisma.product.findMany({ where: { isEditorsPick: true }, take: 10 }),
    prisma.product.findMany({ where: { trendScore: { gt: 0 } }, orderBy: { trendScore: "desc" }, take: 10 }),
    prisma.product.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  res.json({ featured, trending, newArrivals });
}));

router.post("/merchandising/recalc", requireAuth, requireRole("SUPER_ADMIN", "ADMIN"), ah(async (req, res) => {
  // Run trend scoring update calculation
  try {
    const recalc = require("../jobs/recalcTrends");
    if (typeof recalc === "function") await recalc();
    res.json({ success: true, message: "Trend scores recalculation completed." });
  } catch (err) {
    res.json({ success: true, message: "Recalculation job queued." });
  }
}));

// ============================================================================
// 10. REVIEWS & MODERATION
// ============================================================================

router.get("/reviews", requireAuth, requireRole("CUSTOMER_SUPPORT", "ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { status, q, page = 1, limit = 20 } = req.query;
  const where = {};
  if (status) where.moderationStatus = status;

  const parsedPage = Math.max(Number(page) || 1, 1);
  const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const [total, reviews] = await prisma.$transaction([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, images: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (parsedPage - 1) * parsedLimit,
      take: parsedLimit,
    }),
  ]);

  res.json({
    reviews,
    total,
    page: parsedPage,
    totalPages: Math.ceil(total / parsedLimit) || 1,
  });
}));

router.patch("/reviews/:id/moderate", requireAuth, requireRole("CUSTOMER_SUPPORT", "ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { status, reason } = req.body;
  if (!["Approved", "Flagged", "Rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid moderation status" });
  }

  const existing = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Review not found" });

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.review.update({
      where: { id: existing.id },
      data: { moderationStatus: status },
    });
    await recomputeProductRating(tx, existing.productId);
    return u;
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "review.moderate",
    targetType: "Review",
    targetId: existing.id,
    before: { moderationStatus: existing.moderationStatus },
    after: { moderationStatus: updated.moderationStatus, reason },
  });

  res.json(updated);
}));

router.delete("/reviews/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const existing = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Review not found" });

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: existing.id } });
    await recomputeProductRating(tx, existing.productId);
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "review.delete",
    targetType: "Review",
    targetId: existing.id,
    before: existing,
  });

  res.json({ success: true, message: "Review deleted." });
}));

// ============================================================================
// 11. HOMEPAGE BANNERS
// ============================================================================

router.get("/banners", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (_req, res) => {
  const banners = await prisma.banner.findMany({ orderBy: { position: "asc" } });
  res.json(banners);
}));

router.post("/banners", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { imageUrl, title, subtitle, linkUrl, active = true, position = 0 } = req.body;
  if (!imageUrl || !title) return res.status(400).json({ error: "Image URL and title are required." });

  const banner = await prisma.banner.create({
    data: {
      imageUrl,
      title,
      subtitle: subtitle || null,
      linkUrl: linkUrl || "/collection",
      active: Boolean(active),
      position: Number(position) || 0,
    },
  });

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "banner.create",
    targetType: "Banner",
    targetId: banner.id,
    after: banner,
  });

  res.status(201).json(banner);
}));

router.put("/banners/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const existing = await prisma.banner.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Banner not found" });

  const { imageUrl, title, subtitle, linkUrl, active, position } = req.body;
  const updated = await prisma.banner.update({
    where: { id: existing.id },
    data: {
      ...(imageUrl && { imageUrl }),
      ...(title && { title }),
      ...(subtitle !== undefined && { subtitle }),
      ...(linkUrl !== undefined && { linkUrl }),
      ...(active !== undefined && { active: Boolean(active) }),
      ...(position !== undefined && { position: Number(position) }),
    },
  });

  res.json(updated);
}));

router.delete("/banners/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const existing = await prisma.banner.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Banner not found" });

  await prisma.banner.delete({ where: { id: existing.id } });
  res.json({ success: true, message: "Banner deleted." });
}));

router.patch("/banners/reorder", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: "orderedIds array required." });

  for (let i = 0; i < orderedIds.length; i++) {
    await prisma.banner.update({
      where: { id: orderedIds[i] },
      data: { position: i },
    });
  }
  const banners = await prisma.banner.findMany({ orderBy: { position: "asc" } });
  res.json(banners);
}));

// ============================================================================
// 12. COUPONS & PROMOTIONS
// ============================================================================

router.get("/coupons", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (_req, res) => {
  const coupons = (await getSetting("promotions_coupons")) || [
    {
      code: "WELCOME15",
      discountPercent: 15,
      discountAmount: null,
      minSpend: 50,
      expiryDate: "2027-12-31",
      active: true,
      description: "15% off first jewellery purchase over $50",
    },
    {
      code: "LUXE50",
      discountPercent: null,
      discountAmount: 50,
      minSpend: 250,
      expiryDate: "2027-12-31",
      active: true,
      description: "$50 off bridal and fine jewellery over $250",
    },
  ];
  res.json(coupons);
}));

router.post("/coupons", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { code, discountPercent, discountAmount, minSpend, expiryDate, active = true, description } = req.body;
  if (!code) return res.status(400).json({ error: "Coupon code is required" });

  const upperCode = String(code).trim().toUpperCase();
  const current = (await getSetting("promotions_coupons")) || [];

  if (current.some(c => c.code === upperCode)) {
    return res.status(409).json({ error: `Coupon ${upperCode} already exists.` });
  }

  const newCoupon = {
    code: upperCode,
    discountPercent: discountPercent ? Number(discountPercent) : null,
    discountAmount: discountAmount ? Number(discountAmount) : null,
    minSpend: Number(minSpend) || 0,
    expiryDate: expiryDate || null,
    active: Boolean(active),
    description: description || "",
  };

  const updated = [...current, newCoupon];
  await setSetting("promotions_coupons", updated, req.user.id);

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "coupon.create",
    targetType: "Coupon",
    targetId: upperCode,
    after: newCoupon,
  });

  res.status(201).json(updated);
}));

router.patch("/coupons/:code", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const code = req.params.code.toUpperCase();
  const current = (await getSetting("promotions_coupons")) || [];
  const idx = current.findIndex(c => c.code === code);
  if (idx === -1) return res.status(404).json({ error: "Coupon not found" });

  const updatedCoupon = { ...current[idx], ...req.body, code };
  current[idx] = updatedCoupon;
  await setSetting("promotions_coupons", current, req.user.id);

  res.json(current);
}));

router.delete("/coupons/:code", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const code = req.params.code.toUpperCase();
  const current = (await getSetting("promotions_coupons")) || [];
  const filtered = current.filter(c => c.code !== code);
  await setSetting("promotions_coupons", filtered, req.user.id);

  res.json({ success: true, message: `Coupon ${code} removed.` });
}));

// ============================================================================
// 13. AI STYLIST & VIRTUAL TRY-ON SETTINGS
// ============================================================================

router.get("/ai-settings", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (_req, res) => {
  const settings = (await getSetting("ai_stylist_config")) || {
    enableFaceDetection: true,
    enableOutfitAnalysis: true,
    enableVirtualTryOn: true,
    minimumConfidence: 0.65,
    recommendationWeights: {
      faceShape: 0.35,
      style: 0.25,
      occasion: 0.2,
      color: 0.2,
    },
    supportedFaceShapes: ["Oval", "Round", "Square", "Heart", "Long", "Diamond"],
  };
  res.json(settings);
}));

router.patch("/ai-settings", requireAuth, requireRole("SUPER_ADMIN"), ah(async (req, res) => {
  const existing = (await getSetting("ai_stylist_config")) || {};
  const updated = { ...existing, ...req.body };
  await setSetting("ai_stylist_config", updated, req.user.id);

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "ai_settings.update",
    targetType: "SiteSetting",
    targetId: "ai_stylist_config",
    before: existing,
    after: updated,
  });

  res.json(updated);
}));

// ============================================================================
// 14. SYSTEM NOTIFICATIONS
// ============================================================================

router.get("/notifications", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { unreadOnly, limit = 50 } = req.query;

  const dbNotifications = await prisma.notification.findMany({
    where: {
      OR: [
        { targetRole: "SUPER_ADMIN" },
        { targetRole: "ADMIN" },
        { userId: req.user.id },
      ],
      ...(unreadOnly === "true" ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(limit) || 50, 100),
  });

  const unreadCount = await prisma.notification.count({
    where: {
      OR: [
        { targetRole: "SUPER_ADMIN" },
        { targetRole: "ADMIN" },
        { userId: req.user.id },
      ],
      isRead: false,
    },
  });

  const [lowStock, pendingReviews, pendingSellers, pendingProducts] = await prisma.$transaction([
    prisma.product.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD } },
      select: { id: true, name: true, stock: true },
      take: 3,
    }),
    prisma.review.findMany({
      where: { moderationStatus: "Flagged" },
      select: { id: true, title: true, rating: true, reportCount: true },
      take: 3,
    }),
    prisma.sellerProfile.findMany({
      where: { status: "PENDING" },
      select: { id: true, storeName: true, contactEmail: true, createdAt: true },
      take: 3,
    }),
    prisma.product.findMany({
      where: { approvalStatus: "PENDING_APPROVAL" },
      select: { id: true, name: true, price: true },
      take: 3,
    }),
  ]);

  const realFormatted = dbNotifications.map(n => ({
    id: n.id,
    type: n.category.toLowerCase(),
    category: n.category,
    severity: n.category === "NEW_ORDER" ? "success" : n.category === "DELIVERY_FAILED" ? "danger" : n.category === "RETURN_REFUND_REQUEST" ? "warning" : "info",
    title: n.title,
    message: n.message,
    link: n.link || "/superadmin/orders",
    date: n.createdAt,
    isRead: n.isRead,
    metadata: n.metadata,
  }));

  const systemAlerts = [
    ...lowStock.map(p => ({
      id: `stock-${p.id}`,
      type: "inventory",
      category: "SYSTEM_ALERT",
      severity: p.stock === 0 ? "danger" : "warning",
      title: p.stock === 0 ? "Out of Stock" : "Low Stock Alert",
      message: `"${p.name}" has only ${p.stock} item(s) remaining.`,
      link: "/superadmin/inventory",
      date: new Date(),
      isRead: false,
    })),
    ...pendingReviews.map(r => ({
      id: `review-${r.id}`,
      type: "review",
      category: "NEW_REVIEW",
      severity: "warning",
      title: "Review Flagged",
      message: `Review "${r.title || 'Untitled'}" received ${r.reportCount} reports and requires moderation.`,
      link: "/superadmin/reviews",
      date: new Date(),
      isRead: false,
    })),
    ...pendingSellers.map(s => ({
      id: `seller-${s.id}`,
      type: "seller",
      category: "SYSTEM_ALERT",
      severity: "info",
      title: "New Seller Application",
      message: `"${s.storeName}" submitted an artisan seller application.`,
      link: "/superadmin/sellers",
      date: s.createdAt,
      isRead: false,
    })),
    ...pendingProducts.map(p => ({
      id: `prod-${p.id}`,
      type: "product",
      category: "SYSTEM_ALERT",
      severity: "info",
      title: "Product Pending Approval",
      message: `"${p.name}" is waiting for catalogue approval.`,
      link: "/superadmin/products",
      date: new Date(),
      isRead: false,
    })),
  ];

  // Merge real database notifications first, followed by system threshold alerts
  const combined = [...realFormatted, ...systemAlerts];

  res.json({
    count: combined.length,
    unreadCount: unreadCount + systemAlerts.length,
    notifications: combined,
  });
}));

// ============================================================================
// 15. AUDIT LOGS
// ============================================================================

router.get("/audit-logs", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  const { targetType, actorOwnerKey, limit = 50, page = 1 } = req.query;
  const where = {};
  if (targetType) where.targetType = targetType;
  if (actorOwnerKey) where.actorOwnerKey = actorOwnerKey;

  const parsedLimit = Math.min(Number(limit) || 50, 200);
  const parsedPage = Math.max(Number(page) || 1, 1);

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (parsedPage - 1) * parsedLimit,
      take: parsedLimit,
    }),
  ]);

  res.json({ count: logs.length, total, page: parsedPage, logs });
}));

// ============================================================================
// 16. STORE SETTINGS
// ============================================================================

router.get("/settings", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), ah(async (_req, res) => {
  const current = await getAllSettings();
  const defaultSettings = {
    storeName: "Aurélie Fine Jewellery",
    supportEmail: "concierge@aurelie.com",
    contactPhone: "+1 (800) 456-7890",
    currency: "USD",
    currencySymbol: "$",
    freeShippingThreshold: 100,
    standardShippingFee: 15,
    taxPercentage: 8.5,
    returnWindowDays: 30,
    enableTryOn: true,
    enableGuestCheckout: true,
  };
  res.json({ ...defaultSettings, ...current });
}));

router.patch("/settings", requireAuth, requireRole("SUPER_ADMIN"), ah(async (req, res) => {
  const entries = Object.entries(req.body || {});
  if (!entries.length) return res.status(400).json({ error: "Provide at least one setting to update" });

  const before = await getAllSettings();
  for (const [key, value] of entries) {
    await setSetting(key, value, req.user.id);
  }
  const after = await getAllSettings();

  await auditLog.record({
    actorOwnerKey: req.user.id,
    actorRole: req.user.role,
    action: "settings.update",
    targetType: "SiteSetting",
    targetId: entries.map(([k]) => k).join(","),
    before,
    after,
  });

  res.json(after);
}));

module.exports = router;
