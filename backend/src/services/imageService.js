const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { prisma } = require("../db/prisma");

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Validate actual file signature (magic numbers) to prevent file extension spoofing
 */
function validateFileSignature(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { mime: "image/png", ext: "png" };
  }

  // WebP: RIFF ... WEBP
  if (
    buffer.slice(0, 4).toString("ascii") === "RIFF" &&
    buffer.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}

/**
 * Store an uploaded image buffer persistently in PostgreSQL ImageAsset
 * and cache on disk.
 */
async function storeImage(buffer, originalName = "") {
  const verified = validateFileSignature(buffer);
  if (!verified) {
    throw new Error("Invalid image file signature. Only JPG, PNG, and WebP are permitted.");
  }

  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("Image file exceeds maximum permitted size of 10MB.");
  }

  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 12);
  const safeBase = originalName
    ? path.parse(originalName).name.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 30)
    : "jewellery";
  const key = `${safeBase}-${Date.now().toString(36)}-${hash}.${verified.ext}`;

  // 1. Save to PostgreSQL ImageAsset (persists permanently)
  const asset = await prisma.imageAsset.upsert({
    where: { key },
    update: {
      mime: verified.mime,
      size: buffer.length,
      data: buffer,
    },
    create: {
      key,
      mime: verified.mime,
      size: buffer.length,
      data: buffer,
    },
  });

  // 2. Cache on disk for fast static access
  const filePath = path.join(UPLOAD_DIR, key);
  try {
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    console.warn("Failed to write image disk cache:", err.message);
  }

  const url = `/api/images/${key}`;
  return {
    key: asset.key,
    url,
    mime: asset.mime,
    size: asset.size,
    createdAt: asset.createdAt,
  };
}

/**
 * Get image by key: returns buffer, mime, and size
 */
async function getImage(key) {
  const cleanKey = path.basename(key);
  const filePath = path.join(UPLOAD_DIR, cleanKey);

  // Check disk cache first
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    const buffer = fs.readFileSync(filePath);
    const verified = validateFileSignature(buffer);
    return {
      buffer,
      mime: verified ? verified.mime : "application/octet-stream",
      size: stat.size,
    };
  }

  // Fallback to database
  const asset = await prisma.imageAsset.findUnique({ where: { key: cleanKey } });
  if (!asset) return null;

  // Re-populate disk cache
  try {
    fs.writeFileSync(filePath, asset.data);
  } catch (err) {
    console.warn("Failed to write to disk cache:", err.message);
  }

  return {
    buffer: asset.data,
    mime: asset.mime,
    size: asset.size,
  };
}

/**
 * List all library images and map which products are using them
 */
async function listImageLibrary({ search = "", limit = 100, page = 1 } = {}) {
  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, sku: true, category: true, productType: true, images: true, primaryImageIndex: true },
  });

  const assets = await prisma.imageAsset.findMany({
    orderBy: { createdAt: "desc" },
    select: { key: true, mime: true, size: true, createdAt: true },
  });

  // Map product usage
  const mapped = assets.map(asset => {
    const url = `/api/images/${asset.key}`;
    const usedIn = allProducts.filter(p => Array.isArray(p.images) && p.images.some(img => img.includes(asset.key)));
    return {
      key: asset.key,
      url,
      mime: asset.mime,
      size: asset.size,
      createdAt: asset.createdAt,
      usedInProducts: usedIn.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        productType: p.productType,
        isPrimary: Array.isArray(p.images) && p.images[p.primaryImageIndex || 0]?.includes(asset.key),
      })),
      isUsed: usedIn.length > 0,
    };
  });

  let filtered = mapped;
  if (search) {
    const s = search.toLowerCase();
    filtered = mapped.filter(
      item =>
        item.key.toLowerCase().includes(s) ||
        item.usedInProducts.some(p => p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s))
    );
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    unusedCount: mapped.filter(m => !m.isUsed).length,
    totalCount: mapped.length,
  };
}

/**
 * Delete image asset with reference safety
 */
async function deleteImageAsset(key, force = false) {
  const cleanKey = path.basename(key);
  const productsUsing = await prisma.product.findMany({
    where: {
      images: {
        has: `/api/images/${cleanKey}`,
      },
    },
    select: { id: true, name: true },
  });

  if (productsUsing.length > 0 && !force) {
    throw new Error(
      `Cannot delete image because it is currently used by ${productsUsing.length} product(s): ${productsUsing
        .map(p => p.name)
        .slice(0, 3)
        .join(", ")}${productsUsing.length > 3 ? "..." : ""}. Remove it from the product first, or use force delete.`
    );
  }

  // If force is true and products are using it, remove the image reference from those products
  if (productsUsing.length > 0 && force) {
    for (const p of productsUsing) {
      const prod = await prisma.product.findUnique({ where: { id: p.id } });
      if (prod && Array.isArray(prod.images)) {
        const nextImages = prod.images.filter(img => !img.includes(cleanKey));
        await prisma.product.update({
          where: { id: p.id },
          data: {
            images: nextImages,
            primaryImageIndex: 0,
          },
        });
      }
    }
  }

  await prisma.imageAsset.deleteMany({ where: { key: cleanKey } });

  const filePath = path.join(UPLOAD_DIR, cleanKey);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }

  return { success: true, key: cleanKey };
}

const { execFile } = require("child_process");

/**
 * Executes the Python background isolation engine to produce a transparent PNG.
 * Preserves the original image and returns the newly stored transparent asset.
 */
async function removeImageBackground(sourceBufferOrPath, nameOrOpts = "jewellery", toleranceParam = 32, isStudParam = false) {
  let originalName = typeof nameOrOpts === "string" ? nameOrOpts : (nameOrOpts?.originalName || "jewellery");
  let tolerance = typeof nameOrOpts === "object" && nameOrOpts?.tolerance != null ? nameOrOpts.tolerance : toleranceParam;
  let isStud = typeof nameOrOpts === "object" && nameOrOpts?.isStud != null ? nameOrOpts.isStud : isStudParam;

  let tempIn = "";
  let tempOut = "";
  try {
    tempIn = path.join(UPLOAD_DIR, `temp-raw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
    tempOut = path.join(UPLOAD_DIR, `temp-trans-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);

    let inputBuffer = null;
    if (Buffer.isBuffer(sourceBufferOrPath)) {
      inputBuffer = sourceBufferOrPath;
    } else if (typeof sourceBufferOrPath === "string") {
      const cleanKey = path.basename(sourceBufferOrPath);
      const imgData = await getImage(cleanKey);
      if (imgData && imgData.buffer) {
        inputBuffer = imgData.buffer;
        if (originalName === "jewellery") originalName = cleanKey;
      } else if (fs.existsSync(sourceBufferOrPath)) {
        inputBuffer = fs.readFileSync(sourceBufferOrPath);
      } else {
        const localUploadPath = path.join(UPLOAD_DIR, cleanKey);
        if (fs.existsSync(localUploadPath)) {
          inputBuffer = fs.readFileSync(localUploadPath);
        }
      }
    }

    if (!inputBuffer) {
      throw new Error(`Could not load image source: ${sourceBufferOrPath}`);
    }

    fs.writeFileSync(tempIn, inputBuffer);

    const scriptPath = path.join(__dirname, "..", "..", "scripts", "isolate_jewellery_background.py");

    await new Promise((resolve, reject) => {
      execFile("python", [scriptPath, tempIn, tempOut, String(tolerance), isStud ? "true" : "false"], (err, stdout, stderr) => {
        if (err) return reject(new Error(`Background removal failed: ${stderr || err.message}`));
        resolve(stdout);
      });
    });

    if (!fs.existsSync(tempOut)) {
      throw new Error("Background removal output file was not created.");
    }

    const outBuffer = fs.readFileSync(tempOut);
    const safeBaseName = `${path.parse(originalName).name}-transparent.png`;
    const stored = await storeImage(outBuffer, safeBaseName);

    return stored;
  } finally {
    if (tempIn && fs.existsSync(tempIn)) { try { fs.unlinkSync(tempIn); } catch {} }
    if (tempOut && fs.existsSync(tempOut)) { try { fs.unlinkSync(tempOut); } catch {} }
  }
}

module.exports = {
  validateFileSignature,
  storeImage,
  getImage,
  listImageLibrary,
  deleteImageAsset,
  removeImageBackground,
};

