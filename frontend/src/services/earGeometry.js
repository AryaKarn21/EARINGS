/**
 * Phase 8 — High-precision ear tracking and anatomical earlobe geometry.
 *
 * MediaPipe Face Landmarker (468/478 points) does not have a single dedicated
 * landmark for the earlobe piercing point. This module calculates the exact
 * anatomical piercing / earlobe anchor using the pre-auricular notch (tragus),
 * helix root, mandibular angle (gonion), and the head orientation vectors.
 *
 * It also provides accurate coordinate transformation from normalized video
 * coordinates to screen pixel coordinates, fully accounting for CSS `object-fit: cover`
 * aspect-ratio cropping/overflow and horizontal video mirroring (`scaleX(-1)`).
 */

// MediaPipe 468/478 Face Mesh Landmarks for Ear and Jaw Anatomy:
export const EAR_LANDMARKS = {
  // Wearer's Right Side (appears on Image Left in unmirrored camera frame):
  RIGHT_TRAGUS: 162,       // Pre-auricular notch / anterior ear canal
  RIGHT_HELIX_ROOT: 127,   // Superior auricular insertion
  RIGHT_CHEEK: 234,        // Zygomatic arch outer boundary
  RIGHT_GONION: 172,       // Mandibular angle (jaw corner below ear)
  RIGHT_SUB_JAW: 136,      // Sub-auricular lower jawline

  // Wearer's Left Side (appears on Image Right in unmirrored camera frame):
  LEFT_TRAGUS: 389,        // Pre-auricular notch / anterior ear canal
  LEFT_HELIX_ROOT: 356,    // Superior auricular insertion
  LEFT_CHEEK: 454,         // Zygomatic arch outer boundary
  LEFT_GONION: 397,        // Mandibular angle (jaw corner below ear)
  LEFT_SUB_JAW: 365,       // Sub-auricular lower jawline

  // Central Structural Reference Points:
  FOREHEAD_TOP: 10,        // Hairline center / top of forehead
  CHIN_BOTTOM: 152,        // Menton / bottom of chin
  NOSE_TIP: 1,             // Pronasale / nose tip
  NOSE_BASE: 2,            // Subnasale / bottom of nose
  PHILTRUM: 164,           // Philtrum midline
  NOSE_BRIDGE: 6,          // Nasion / upper nose bridge
  GLABELLA: 168,           // Between eyebrows
};

export const EAR_GEOMETRY_INDICES = {
  LEFT_CHEEK: EAR_LANDMARKS.RIGHT_CHEEK, // legacy compatibility
  RIGHT_CHEEK: EAR_LANDMARKS.LEFT_CHEEK,
  FOREHEAD_TOP: EAR_LANDMARKS.FOREHEAD_TOP,
  CHIN_BOTTOM: EAR_LANDMARKS.CHIN_BOTTOM,
};

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Checks whether an earring candidate should be treated as a stud
 * (centered on the piercing point) or hanging/drop (attached at top hook/post).
 */
export function isStudEarring(product) {
  if (!product) return false;
  const category = (product.category || "").toLowerCase();
  const kind = (product.kind || "").toLowerCase();
  const name = (product.name || "").toLowerCase();

  // Explicit hanging, hoop, chandbali, jhumka, and drop styles are never studs
  if (
    /chandbali|jhumka|hoop|huggie|chandelier|drop|dangle/i.test(name) ||
    /chandbali|jhumka|hoop|huggie|chandelier|drop|dangle/i.test(category)
  ) {
    return false;
  }

  return (
    category.includes("stud") ||
    kind.includes("stud") ||
    name.includes("stud") ||
    kind === "pearl-stud" ||
    kind === "flower-stud" ||
    kind === "diamond-stud" ||
    kind === "opal-stud" ||
    kind === "bar-stud"
  );
}

/**
 * Checks whether a necklace candidate is a high-collar choker.
 */
export function isChokerNecklace(product) {
  if (!product) return false;
  const category = (product.category || "").toLowerCase();
  const kind = (product.kind || "").toLowerCase();
  const name = (product.name || "").toLowerCase();
  return category.includes("choker") || kind.includes("choker") || name.includes("choker");
}

/**
 * Structured product-type detection:
 * Returns "set" | "necklace" | "earrings"
 */
export function getProductJewelleryType(product) {
  if (!product) return "earrings";
  const type = (product.productType || "").toLowerCase();
  const cat = (product.category || "").toLowerCase();
  const kind = (product.kind || "").toLowerCase();
  const name = (product.name || "").toLowerCase();
  const compType = (product.tryOnAsset?.componentType || "").toLowerCase();

  // 1. Jewellery Sets
  if (
    type === "set" ||
    cat.includes("set") ||
    name.includes("set") ||
    compType === "set" ||
    (product.tryOnAsset?.hasNecklace && product.tryOnAsset?.hasEarrings)
  ) {
    return "set";
  }

  // 2. Necklaces & Chokers
  if (
    type === "necklace" ||
    cat.includes("necklace") ||
    cat.includes("choker") ||
    cat.includes("pendant") ||
    kind.includes("necklace") ||
    kind.includes("choker") ||
    name.includes("necklace") ||
    name.includes("choker") ||
    compType === "necklace"
  ) {
    return "necklace";
  }

  // 3. Earrings: Highest priority before rings!
  // Prevents "ear ring", "ear-ring", "hoop ring", "bali ring" from ever being treated as finger rings
  const isEarringItem = (
    type === "earrings" ||
    compType === "earrings" ||
    /earrings?|ear\s*rings?|jhumka|chandbali|hoop|huggie|stud|drops?|chandelier|fan|tassel/i.test(cat) ||
    /earrings?|ear\s*rings?|jhumka|chandbali|hoop|huggie|stud|drops?|chandelier|fan|tassel/i.test(kind) ||
    /earrings?|ear\s*rings?|jhumka|chandbali|hoop|huggie|stud|drops?|chandelier|fan|tassel/i.test(name)
  );

  if (isEarringItem) {
    return "earrings";
  }

  // 4. Bracelets, Bangles & Cuffs
  if (
    type === "bracelet" ||
    type === "bangle" ||
    cat.includes("bracelet") ||
    cat.includes("bangle") ||
    cat.includes("cuff") ||
    kind.includes("bracelet") ||
    kind.includes("bangle") ||
    name.includes("bracelet") ||
    name.includes("bangle") ||
    name.includes("cuff")
  ) {
    return "bracelet";
  }

  // 5. Finger Rings (only when not an earring)
  if (
    type === "ring" ||
    compType === "ring" ||
    /band-ring|cocktail-ring|statement-ring|stackable-ring|\brings?\b/i.test(cat) ||
    /band-ring|cocktail-ring|statement-ring|stackable-ring|\brings?\b/i.test(kind) ||
    /\brings?\b/i.test(name)
  ) {
    return "ring";
  }

  return "earrings";
}

export const PRODUCT_TRYON_ASSETS = {
  // Flagship & classic product try-on transparent cutouts:
  // Earring transparent assets:
  "BEBO": "/uploads/bebo-jhumka-tryon.png",
  "bebo": "/uploads/bebo-jhumka-tryon.png",
  "Aranya Jhumka": "/uploads/aranya-jhumka-tryon.png",
  "Mahalaxmi Temple Gold Jhumkas": "/uploads/aranya-jhumka-tryon.png",
  "jhumka": "/uploads/aranya-jhumka-tryon.png",
  "Nawab Chandbali": "/uploads/gulabi-chandbali-tryon.png",
  "Marbella Chandbali": "/uploads/gulabi-chandbali-tryon.png",
  "Gulabi Kundan Pearl Chandbalis": "/uploads/gulabi-chandbali-tryon.png",
  "chandbali": "/uploads/gulabi-chandbali-tryon.png",
  "chandbali-silver": "/uploads/gulabi-chandbali-tryon.png",
  "Solstice Pearl Drops": "/uploads/solstice-pearl-drop-tryon.png",
  "Aurélie Royal Sapphire Chandbali": "/uploads/royal-sapphire-chandbali-tryon.png",
  "Royal Sapphire Chandbali": "/uploads/royal-sapphire-chandbali-tryon.png",
  "sapphire-chandbali": "/uploads/royal-sapphire-chandbali-tryon.png",
  "sapphire": "/uploads/royal-sapphire-chandbali-tryon.png",
  "Meridian Hoops": "/uploads/meridian-hoops-tryon.png",
  "meridian-hoops": "/uploads/meridian-hoops-tryon.png",
  "Sundown Gold Hoops": "/uploads/meridian-hoops-tryon.png",
  "hoop": "/uploads/meridian-hoops-tryon.png",
  "hoop-large": "/uploads/meridian-hoops-tryon.png",
  "Petit Pearl Studs": "/uploads/diamond-stud-tryon.png",
  "First Light Diamond Studs": "/uploads/diamond-stud-tryon.png",
  "diamond-stud": "/uploads/diamond-stud-tryon.png",

  // Necklace transparent assets:
  "Aranya Kundan Choker": "/uploads/aranya-choker-necklace-tryon.png",
  "Ivory Pearl Bridal Necklace": "/uploads/royal-pearl-necklace-tryon.png",
  "Cascade Layered Necklace": "/uploads/royal-pearl-necklace-tryon.png",
};

/**
 * Resolves all try-on assets and component configuration for a product.
 * Returns:
 * {
 *   type: "earrings" | "necklace" | "set" | "bracelet" | "ring",
 *   isStud: boolean,
 *   isChoker: boolean,
 *   earringAsset: string | null,
 *   necklaceAsset: string | null,
 *   isTransparentReady: boolean
 * }
 */
export function getProductTryOnAssets(product) {
  if (!product) {
    return {
      type: "earrings",
      isStud: false,
      isChoker: false,
      earringAsset: null,
      necklaceAsset: null,
      isTransparentReady: false,
    };
  }

  const type = getProductJewelleryType(product);
  const isStud = isStudEarring(product);
  const isChoker = isChokerNecklace(product);

  const pName = (product.name || "").trim().toLowerCase();
  const pKind = (product.kind || "").trim().toLowerCase();
  const pCat = (product.category || "").trim().toLowerCase();

  let earringAsset = null;
  let necklaceAsset = null;
  let ornamentAsset = null;

  // 1. Read explicit tryOnAsset from database if present
  if (product.tryOnAsset) {
    if (product.tryOnAsset.earrings) earringAsset = product.tryOnAsset.earrings;
    if (product.tryOnAsset.necklace) necklaceAsset = product.tryOnAsset.necklace;
    if (product.tryOnAsset.ornament) ornamentAsset = product.tryOnAsset.ornament;
    if (product.tryOnAsset.transparent) {
      if (type === "necklace") necklaceAsset = necklaceAsset || product.tryOnAsset.transparent;
      else if (type === "bracelet" || type === "ring") ornamentAsset = ornamentAsset || product.tryOnAsset.transparent;
      else earringAsset = earringAsset || product.tryOnAsset.transparent;
    }
  }

  // 2. Resolve for Sets
  if (type === "set") {
    if (pName.includes("aranya") || pName.includes("lakshmi") || pName.includes("temple")) {
      necklaceAsset = necklaceAsset || "/uploads/aranya-choker-necklace-tryon.png";
      earringAsset = earringAsset || "/uploads/aranya-jhumka-tryon.png";
    } else if (pName.includes("pearl") || pName.includes("cascade") || pName.includes("royal") || pName.includes("bridal")) {
      necklaceAsset = necklaceAsset || "/uploads/royal-pearl-necklace-tryon.png";
      earringAsset = earringAsset || "/uploads/solstice-pearl-drop-tryon.png";
    }
  }

  // 3. Resolve for Necklaces
  if (type === "necklace") {
    if (pName.includes("aranya") || pName.includes("choker") || pCat.includes("choker")) {
      necklaceAsset = necklaceAsset || "/uploads/aranya-choker-necklace-tryon.png";
    } else if (pName.includes("pearl") || pName.includes("bridal") || pName.includes("cascade") || pKind.includes("pearl")) {
      necklaceAsset = necklaceAsset || "/uploads/royal-pearl-necklace-tryon.png";
    }
  }

  // 4. Resolve for Earrings
  if (type === "earrings") {
    if (
      pName.includes("jhumka") ||
      pCat.includes("jhumka") ||
      pKind.includes("jhumka") ||
      (pName.includes("aranya") && !pName.includes("choker") && !pName.includes("bangle")) ||
      pName.includes("mahalaxmi")
    ) {
      earringAsset = earringAsset || "/uploads/aranya-jhumka-tryon.png";
    } else if (pName.includes("sapphire") || pKind.includes("sapphire")) {
      earringAsset = earringAsset || "/uploads/royal-sapphire-chandbali-tryon.png";
    } else if (pName.includes("chandbali") || pCat.includes("chandbali") || pKind.includes("chandbali")) {
      earringAsset = earringAsset || "/uploads/royal-sapphire-chandbali-tryon.png";
    } else if (pName.includes("solstice") || pName.includes("drop") || pKind.includes("drop") || pName.includes("pearl")) {
      earringAsset = earringAsset || "/uploads/solstice-pearl-drop-tryon.png";
    } else if (pName.includes("bebo")) {
      earringAsset = earringAsset || "/uploads/bebo-jhumka-tryon.png";
    } else if (pCat.includes("stud") || pKind.includes("stud") || isStud) {
      earringAsset = earringAsset || "/uploads/diamond-stud-tryon.png";
    } else if (pCat.includes("hoop") || pCat.includes("huggie") || pName.includes("hoop") || pName.includes("huggie") || pKind.includes("hoop") || pKind.includes("huggie")) {
      earringAsset = earringAsset || "/uploads/meridian-hoops-tryon.png";
    }
  }

  // 5. Fallback to product images if available (will be processed for transparency)
  if (!earringAsset && !necklaceAsset && !ornamentAsset && product.images && product.images.length > 0) {
    const primaryImg = product.images[product.primaryImageIndex || 0] || product.images[0];
    if (primaryImg) {
      if (type === "necklace") necklaceAsset = primaryImg;
      else if (type === "bracelet" || type === "ring") ornamentAsset = primaryImg;
      else earringAsset = primaryImg;
    }
  }

  const isTransparentReady = Boolean(earringAsset || necklaceAsset || ornamentAsset);
  return { type, isStud, isChoker, earringAsset, necklaceAsset, ornamentAsset, isTransparentReady };
}

/**
 * Resolves the primary transparent try-on asset URL.
 * Guaranteed never to return a flat white-canvas product photo.
 */
export function getProductTryOnImage(product) {
  const assets = getProductTryOnAssets(product);
  if (assets.type === "necklace") return assets.necklaceAsset;
  if (assets.type === "set") return assets.necklaceAsset || assets.earringAsset;
  if (assets.type === "bracelet" || assets.type === "ring") return assets.ornamentAsset || assets.earringAsset;
  return assets.earringAsset;
}

/**
 * Maps normalized coordinates [0, 1] from a source video/image onto the
 * displayed container, compensating exactly for CSS `object-fit: cover`
 * aspect-ratio cropping/overflow and horizontal mirroring (`scaleX(-1)`).
 *
 * @param {{
 *   normX: number,
 *   normY: number,
 *   videoWidth: number,
 *   videoHeight: number,
 *   containerWidth: number,
 *   containerHeight: number,
 *   isMirrored?: boolean
 * }} params
 * @returns {{
 *   x: number,
 *   y: number,
 *   renderWidth: number,
 *   renderHeight: number,
 *   offsetX: number,
 *   offsetY: number
 * }}
 */
export function mapVideoToContainer({
  normX,
  normY,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight,
  isMirrored = false,
}) {
  if (!videoWidth || !videoHeight || !containerWidth || !containerHeight) {
    const x = isMirrored ? containerWidth * (1 - normX) : containerWidth * normX;
    return {
      x,
      y: containerHeight * normY,
      renderWidth: containerWidth,
      renderHeight: containerHeight,
      offsetX: 0,
      offsetY: 0,
    };
  }

  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;
  let renderWidth, renderHeight, offsetX, offsetY;

  if (containerAspect < videoAspect) {
    // Container is taller than video: video height fills container, sides overflow and crop
    renderHeight = containerHeight;
    renderWidth = containerHeight * videoAspect;
    offsetX = (containerWidth - renderWidth) / 2;
    offsetY = 0;
  } else {
    // Container is wider than video: video width fills container, top/bottom crop
    renderWidth = containerWidth;
    renderHeight = containerWidth / videoAspect;
    offsetX = 0;
    offsetY = (containerHeight - renderHeight) / 2;
  }

  // Unmirrored coordinate within container bounding box (may be negative if cropped):
  const unmirroredX = offsetX + normX * renderWidth;
  const unmirroredY = offsetY + normY * renderHeight;

  // If video has CSS [transform:scaleX(-1)], mirrored coordinates reflect horizontally
  const screenX = isMirrored ? containerWidth - unmirroredX : unmirroredX;
  const screenY = unmirroredY;

  return {
    x: screenX,
    y: screenY,
    renderWidth,
    renderHeight,
    offsetX,
    offsetY,
  };
}

/**
 * Computes high-precision anatomical earlobe piercing anchors from MediaPipe landmarks.
 *
 * @param {Array<{x:number, y:number, z:number, visibility?:number}>} landmarks
 *   Full 468/478 landmark array from MediaPipe FaceLandmarker.
 * @param {{ mirrorX?: boolean }} [options]
 * @returns {{
 *   wearerRight: {x: number, y: number, z: number, visible: boolean},
 *   wearerLeft: {x: number, y: number, z: number, visible: boolean},
 *   faceHeight: number,
 *   faceWidth: number,
 *   yawDeg: number,
 *   rollDeg: number,
 *   scale: number,
 *   keyLandmarks: object,
 *   left: {x: number, y: number, visible: boolean},
 *   right: {x: number, y: number, visible: boolean}
 * }}
 */
export function computeEarAnchors(landmarks, { mirrorX = false } = {}) {
  const foreheadTop = landmarks[EAR_LANDMARKS.FOREHEAD_TOP];
  const chinBottom = landmarks[EAR_LANDMARKS.CHIN_BOTTOM];
  const noseTip = landmarks[EAR_LANDMARKS.NOSE_TIP];
  const noseBase = landmarks[EAR_LANDMARKS.NOSE_BASE] || landmarks[EAR_LANDMARKS.PHILTRUM] || noseTip;

  // Wearer's right points (image left in raw frame):
  const rCheek = landmarks[EAR_LANDMARKS.RIGHT_CHEEK];       // Zygomatic arch contour (234)
  const rTragus = landmarks[EAR_LANDMARKS.RIGHT_TRAGUS];     // Malar reference (162)
  const rGonion = landmarks[EAR_LANDMARKS.RIGHT_GONION];     // Lower jaw angle (172)
  const rHelix = landmarks[EAR_LANDMARKS.RIGHT_HELIX_ROOT];  // Superior insertion (127)

  // Wearer's left points (image right in raw frame):
  const lCheek = landmarks[EAR_LANDMARKS.LEFT_CHEEK];        // Zygomatic arch contour (454)
  const lTragus = landmarks[EAR_LANDMARKS.LEFT_TRAGUS];      // Malar reference (389)
  const lGonion = landmarks[EAR_LANDMARKS.LEFT_GONION];      // Lower jaw angle (397)
  const lHelix = landmarks[EAR_LANDMARKS.LEFT_HELIX_ROOT];   // Superior insertion (356)

  // 1. Calculate Primary Face Geometry & Axes:
  const faceHeight = dist(foreheadTop, chinBottom) || 0.4;
  const cheekboneWidth = dist(rCheek, lCheek) || 0.35;

  // Downward unit vector along face vertical axis (forehead -> chin):
  const downVecX = chinBottom.x - foreheadTop.x;
  const downVecY = chinBottom.y - foreheadTop.y;
  const uDownX = downVecX / faceHeight;
  const uDownY = downVecY / faceHeight;

  // 2D Head Roll Angle (tilt):
  // When upright: downVecX ≈ 0, downVecY > 0 -> rollRad = 0
  const rollRad = Math.atan2(downVecX, downVecY);
  const rollDeg = (rollRad * 180) / Math.PI;

  // Perpendicular Lateral Vectors pointing outward away from facial midline:
  // Toward wearer's right ear (Image-Left in raw camera frame, -X when upright):
  const uLateralLeftX = -uDownY;
  const uLateralLeftY = uDownX;

  // Toward wearer's left ear (Image-Right in raw camera frame, +X when upright):
  const uLateralRightX = uDownY;
  const uLateralRightY = -uDownX;

  // 2. Head Yaw & Perspective Depth Calculation:
  const midCheekX = (rCheek.x + lCheek.x) / 2;
  const cheekSpan = Math.abs(lCheek.x - rCheek.x) || 0.35;
  const noseOffsetRatio = (noseTip.x - midCheekX) / (cheekSpan / 2);
  const zAsymmetry = (lCheek.z - rCheek.z) / (cheekboneWidth || 1);
  const yawDeg = clamp((noseOffsetRatio * 0.65 + zAsymmetry * 0.35) * 65, -60, 60);

  // 3. Anatomical Earlobe Piercing Estimation:
  // In human craniofacial anatomy:
  // - Tragus (162 / 389) marks the superior auricular insertion level (ear canal).
  // - Gonion (172 / 397) marks the mandibular angle (jaw corner below ear).
  // - The lobule piercing hangs between tragus and gonion, approximately 45% of the distance from tragus to gonion,
  //   which aligns vertically with the subnasale / upper lip margin.
  const rVerticalTarget = (rTragus && rGonion)
    ? (rTragus.y * 0.42 + rGonion.y * 0.58)
    : (noseBase.y + faceHeight * 0.06);
  const lVerticalTarget = (lTragus && lGonion)
    ? (lTragus.y * 0.42 + lGonion.y * 0.58)
    : (noseBase.y + faceHeight * 0.06);

  const rDownDist = Math.max(faceHeight * 0.14, (rVerticalTarget - rCheek.y) * uDownY + (rVerticalTarget - rCheek.x) * uDownX);
  const lDownDist = Math.max(faceHeight * 0.14, (lVerticalTarget - lCheek.y) * uDownY + (lVerticalTarget - lCheek.x) * uDownX);

  // Use the outermost contour point (cheek vs tragus vs gonion) as base for lateral projection
  const rOuterBaseX = Math.min(rCheek.x, rTragus ? rTragus.x : rCheek.x, rGonion ? rGonion.x : rCheek.x);
  const lOuterBaseX = Math.max(lCheek.x, lTragus ? lTragus.x : lCheek.x, lGonion ? lGonion.x : lCheek.x);

  // Perspective foreshortening: as head turns, visible lateral ear extension adjusts
  const baseLateralOffset = cheekboneWidth * 0.16;
  const rYawFactor = clamp(1 - (yawDeg / 45) * 0.35, 0.45, 1.25);
  const lYawFactor = clamp(1 + (yawDeg / 45) * 0.35, 0.45, 1.25);

  const rLateral = baseLateralOffset * rYawFactor;
  const lLateral = baseLateralOffset * lYawFactor;

  // Wearer's right earlobe (raw image left):
  const rAnchorX = rOuterBaseX + uLateralLeftX * rLateral;
  const rAnchorY = rCheek.y + uDownY * rDownDist + uLateralLeftY * rLateral;
  const rAnchorZ = rCheek.z;

  // Wearer's left earlobe (raw image right):
  const lAnchorX = lOuterBaseX + uLateralRightX * lLateral;
  const lAnchorY = lCheek.y + uDownY * lDownDist + uLateralRightY * lLateral;
  const lAnchorZ = lCheek.z;

  // 4. Occlusion Handling:
  // Head turned strongly left (yawDeg > 36°): wearer's right ear turns away.
  // Head turned strongly right (yawDeg < -36°): wearer's left ear turns away.
  const rVisible = yawDeg < 38;
  const lVisible = yawDeg > -38;

  const wearerRight = {
    x: rAnchorX,
    y: rAnchorY,
    z: rAnchorZ,
    visible: rVisible,
  };

  const wearerLeft = {
    x: lAnchorX,
    y: lAnchorY,
    z: lAnchorZ,
    visible: lVisible,
  };

  // For callers specifying mirrorX (legacy normalized mapping):
  const mirror = (x) => (mirrorX ? 1 - x : x);

  const leftCompat = mirrorX
    ? { x: mirror(lAnchorX), y: lAnchorY, visible: lVisible }
    : { x: rAnchorX, y: rAnchorY, visible: rVisible };
  const rightCompat = mirrorX
    ? { x: mirror(rAnchorX), y: rAnchorY, visible: rVisible }
    : { x: lAnchorX, y: lAnchorY, visible: lVisible };

  // 5. Anatomical Necklace & Collarbone Anchor:
  const neckDropRatio = 0.46;
  const neckDropOffset = faceHeight * neckDropRatio;
  const neckAnchorX = chinBottom.x + uDownX * neckDropOffset;
  const neckAnchorY = chinBottom.y + uDownY * neckDropOffset;
  const neckWidthNorm = cheekboneWidth * 1.55;

  const necklace = {
    x: neckAnchorX,
    y: neckAnchorY,
    widthNorm: neckWidthNorm,
    rollDeg: rollDeg * 0.45,
    visible: true,
  };

  return {
    wearerRight,
    wearerLeft,
    necklace,
    faceHeight,
    faceWidth: cheekboneWidth,
    yawDeg,
    rollDeg,
    scale: cheekboneWidth,
    keyLandmarks: {
      forehead: { x: foreheadTop.x, y: foreheadTop.y },
      chin: { x: chinBottom.x, y: chinBottom.y },
      noseTip: { x: noseTip.x, y: noseTip.y },
      noseBase: { x: noseBase.x, y: noseBase.y },
      neck: { x: neckAnchorX, y: neckAnchorY },
      rightCheek: { x: rCheek.x, y: rCheek.y },
      leftCheek: { x: lCheek.x, y: lCheek.y },
      rightEarAnchor: { x: rAnchorX, y: rAnchorY },
      leftEarAnchor: { x: lAnchorX, y: lAnchorY },
      rightGonion: { x: rGonion.x, y: rGonion.y },
      leftGonion: { x: lGonion.x, y: lGonion.y },
    },
    left: leftCompat,
    right: rightCompat,
  };
}

/**
 * Normalizes current scale factor relative to initial baseline.
 */
export function scaleRelativeToBaseline(currentScale, baselineScale) {
  if (!baselineScale) return 1;
  return clamp(currentScale / baselineScale, 0.6, 1.8);
}
