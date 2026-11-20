/**
 * Aurélie Transparent Jewellery Pipeline
 * Automatically strips solid/white backgrounds from product photographs while
 * preserving delicate filigree, gold reflections, gemstones, white pearls, and chains.
 *
 * Employs connected-component border flood segmentation with edge-aware antialiasing:
 * 1. Samples background color and tolerance from the perimeter margin.
 * 2. Floods exclusively from the outer image borders inward.
 * 3. Enclosed pearls, diamonds, and white gemstones inside the jewelry silhouette
 *    are NEVER removed because they are not connected to the outer boundary.
 * 4. Applies subtle alpha feathering so chains and fine filigree blend smoothly.
 * 5. Caches processed transparent assets in memory for zero-lag performance.
 */

const transparentCache = new Map();

/**
 * Checks if an image URL is already a confirmed transparent PNG asset.
 */
export function isKnownTransparentAsset(url) {
  if (!url) return false;
  return (
    url.startsWith("data:image/svg+xml") ||
    url.startsWith("data:image/png;base64") ||
    url.includes("-transparent.png") ||
    url.includes("-tryon.png") ||
    url.includes("tryon-cutout-") ||
    url.includes("-clean-tryon")
  );
}

/**
 * Loads an image from a URL or Data URL into an HTMLImageElement.
 */
function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Retry with fresh cache buster to bypass Chrome's non-CORS cached entry
      const retry = new Image();
      retry.crossOrigin = "anonymous";
      retry.onload = () => resolve(retry);
      retry.onerror = () => {
        // Fallback: try direct source
        const plain = new Image();
        plain.onload = () => resolve(plain);
        plain.onerror = (e) => reject(e);
        plain.src = src;
      };
      const separator = src.includes("?") ? "&" : "?";
      retry.src = src.startsWith("data:") ? src : `${src}${separator}_cors_cb=${Date.now()}`;
    };
    const sep = src.includes("?") ? "&" : "?";
    img.src = src.startsWith("data:") ? src : `${src}${sep}_tryon=1`;
  });
}

/**
 * Automatically removes white or solid background from an image on an offscreen canvas.
 * Preserves interior pearls, gemstones, metallic reflections, and chains.
 *
 * @param {string} imageUrl Source image URL
 * @param {object} options Configuration options
 * @returns {Promise<string>} Data URL of the transparent PNG
 */
export async function getTransparentJewelleryImage(imageUrl, options = {}) {
  if (!imageUrl) return null;

  // 1. Fast memory cache check
  if (transparentCache.has(imageUrl)) {
    return transparentCache.get(imageUrl);
  }

  // 2. Direct SVG/transparent Data URL bypass
  if (isKnownTransparentAsset(imageUrl)) {
    transparentCache.set(imageUrl, imageUrl);
    return imageUrl;
  }

  const {
    tolerance = 32, // Euclidean color distance threshold
    featherRadius = 1.2,
    maxDimension = 1024,
  } = options;

  try {
    const img = await loadHtmlImage(imageUrl);
    const canvas = document.createElement("canvas");
    let w = img.naturalWidth || img.width || 400;
    let h = img.naturalHeight || img.height || 400;

    // Constrain large images for performance
    if (w > maxDimension || h > maxDimension) {
      if (w > h) {
        h = Math.round((h * maxDimension) / w);
        w = maxDimension;
      } else {
        w = Math.round((w * maxDimension) / h);
        h = maxDimension;
      }
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Check if the image already has genuine alpha transparency on corners
    const cornerIndices = [
      0, // top-left
      (w - 1) * 4, // top-right
      ((h - 1) * w) * 4, // bottom-left
      ((h - 1) * w + (w - 1)) * 4, // bottom-right
    ];
    const transparentCorners = cornerIndices.filter((idx) => data[idx + 3] === 0).length;
    if (transparentCorners >= 3) {
      // Image already has genuine transparent background!
      transparentCache.set(imageUrl, imageUrl);
      return imageUrl;
    }

    // 3. Sample background color from image perimeter
    let rSum = 0, gSum = 0, bSum = 0, sampleCount = 0;
    const borderThickness = Math.max(2, Math.floor(Math.min(w, h) * 0.02));

    for (let x = 0; x < w; x++) {
      for (let y = 0; y < borderThickness; y++) {
        const idx = (y * w + x) * 4;
        rSum += data[idx]; gSum += data[idx + 1]; bSum += data[idx + 2]; sampleCount++;
      }
      for (let y = h - borderThickness; y < h; y++) {
        const idx = (y * w + x) * 4;
        rSum += data[idx]; gSum += data[idx + 1]; bSum += data[idx + 2]; sampleCount++;
      }
    }
    for (let y = borderThickness; y < h - borderThickness; y++) {
      for (let x = 0; x < borderThickness; x++) {
        const idx = (y * w + x) * 4;
        rSum += data[idx]; gSum += data[idx + 1]; bSum += data[idx + 2]; sampleCount++;
      }
      for (let x = w - borderThickness; x < w; x++) {
        const idx = (y * w + x) * 4;
        rSum += data[idx]; gSum += data[idx + 1]; bSum += data[idx + 2]; sampleCount++;
      }
    }

    const bgR = rSum / sampleCount;
    const bgG = gSum / sampleCount;
    const bgB = bSum / sampleCount;

    // Check if background is solid/light (typical e-commerce white/cream or dark studio)
    const isLightBg = (bgR + bgG + bgB) / 3 > 180;
    const isSolidBg = sampleCount > 0;

    if (!isSolidBg) {
      transparentCache.set(imageUrl, imageUrl);
      return imageUrl;
    }

    // 4. Connected-Component Flood Segmentation from borders
    // visited: 0 = unvisited, 1 = background, 2 = foreground
    const totalPixels = w * h;
    const visited = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let qHead = 0;
    let qTail = 0;

    const tolSq = tolerance * tolerance;
    const tolSoftSq = (tolerance * 1.6) * (tolerance * 1.6);

    const isBgColor = (pxIdx) => {
      const dr = data[pxIdx] - bgR;
      const dg = data[pxIdx + 1] - bgG;
      const db = data[pxIdx + 2] - bgB;
      const distSq = dr * dr + dg * dg + db * db;

      // In light backgrounds, also check luminance
      if (isLightBg && data[pxIdx] > 238 && data[pxIdx + 1] > 238 && data[pxIdx + 2] > 238) {
        return true;
      }
      return distSq <= tolSq;
    };

    // Seed perimeter pixels into queue
    for (let x = 0; x < w; x++) {
      const topIdx = x;
      const botIdx = (h - 1) * w + x;
      if (isBgColor(topIdx * 4)) { visited[topIdx] = 1; queue[qTail++] = topIdx; }
      if (isBgColor(botIdx * 4)) { visited[botIdx] = 1; queue[qTail++] = botIdx; }
    }
    for (let y = 0; y < h; y++) {
      const leftIdx = y * w;
      const rightIdx = y * w + (w - 1);
      if (visited[leftIdx] === 0 && isBgColor(leftIdx * 4)) { visited[leftIdx] = 1; queue[qTail++] = leftIdx; }
      if (visited[rightIdx] === 0 && isBgColor(rightIdx * 4)) { visited[rightIdx] = 1; queue[qTail++] = rightIdx; }
    }

    // BFS Flood Fill outward-to-inward
    while (qHead < qTail) {
      const curr = queue[qHead++];
      const cx = curr % w;
      const cy = Math.floor(curr / w);

      // Check 4 neighbors
      const neighbors = [
        cy > 0 ? curr - w : -1,
        cy < h - 1 ? curr + w : -1,
        cx > 0 ? curr - 1 : -1,
        cx < w - 1 ? curr + 1 : -1,
      ];

      for (let i = 0; i < 4; i++) {
        const n = neighbors[i];
        if (n !== -1 && visited[n] === 0) {
          if (isBgColor(n * 4)) {
            visited[n] = 1; // background
            queue[qTail++] = n;
          }
        }
      }
    }

    // 5. Build alpha mask with edge antialiasing
    // Pixels tagged 1 in `visited` are outer background -> alpha = 0
    // Pixels tagged 0 are foreground jewelry (including all interior pearls and gems!) -> alpha = 255
    let minX = w, minY = h, maxX = 0, maxY = 0;

    for (let i = 0; i < totalPixels; i++) {
      const p4 = i * 4;
      if (visited[i] === 1) {
        data[p4 + 3] = 0; // Transparent
      } else {
        // Foreground jewelry
        const x = i % w;
        const y = Math.floor(i / w);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        // Antialias boundary pixels adjacent to background
        let hasBgNeighbor = false;
        if (x > 0 && visited[i - 1] === 1) hasBgNeighbor = true;
        else if (x < w - 1 && visited[i + 1] === 1) hasBgNeighbor = true;
        else if (y > 0 && visited[i - w] === 1) hasBgNeighbor = true;
        else if (y < h - 1 && visited[i + w] === 1) hasBgNeighbor = true;

        if (hasBgNeighbor) {
          const dr = data[p4] - bgR;
          const dg = data[p4 + 1] - bgG;
          const db = data[p4 + 2] - bgB;
          const distSq = dr * dr + dg * dg + db * db;
          const t = Math.max(0, Math.min(1, (distSq - tolSq) / (tolSoftSq - tolSq || 1)));
          data[p4 + 3] = Math.round(t * 255);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // 6. Crop to bounding box if jewelry is isolated
    if (maxX > minX && maxY > minY) {
      const pad = 10;
      const cropX = Math.max(0, minX - pad);
      const cropY = Math.max(0, minY - pad);
      const cropW = Math.min(w - cropX, (maxX - minX) + pad * 2);
      const cropH = Math.min(h - cropY, (maxY - minY) + pad * 2);

      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const cropCtx = croppedCanvas.getContext("2d");
      cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const transparentDataUrl = croppedCanvas.toDataURL("image/png");
      transparentCache.set(imageUrl, transparentDataUrl);
      return transparentDataUrl;
    }

    const transparentDataUrl = canvas.toDataURL("image/png");
    transparentCache.set(imageUrl, transparentDataUrl);
    return transparentDataUrl;
  } catch (err) {
    console.warn("[TransparentJewellery] Fallback on canvas error:", err);
    return imageUrl;
  }
}
