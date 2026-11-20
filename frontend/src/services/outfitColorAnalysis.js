/**
 * Real outfit-color analysis — replaces the backend's old
 * `palettes[Math.floor(Math.random() * palettes.length)]` mock entirely
 * (see backend/src/routes/stylist.js's POST /outfit-match, now a thin
 * endpoint that trusts a result computed here rather than generating one
 * itself).
 *
 * APPROACH: genuine, deterministic computer vision — not a vendor API call.
 * No AI vision provider key exists in this project (see backend/.env.example:
 * only DATABASE_URL/JWT_SECRET/SEED_SUPER_ADMIN_*, nothing for a vision
 * provider), and paying for one wasn't asked for. Dominant-color extraction
 * via canvas pixel sampling is a well-established, genuinely-computed
 * technique — not a fabricated placeholder — and keeps the same "never
 * leaves the browser" property faceShapeDetection.js already established for
 * the face-shape step, which matters more for a photo of someone's actual
 * outfit than it does for a jewelry color swatch.
 *
 * WHAT THIS DOES NOT CLAIM: mapping "navy outfit" -> "silver jewelry reads
 * elegant against it" is a styling opinion, the same honest framing
 * recommendationEngine.js already uses for face-shape advice — not a
 * scientific color-theory proof. The color EXTRACTION (hue/saturation/
 * lightness from real pixels) is exact; the STYLE MAPPING is a documented,
 * explainable lookup table below, not a guess.
 */

export const OUTFIT_ANALYSIS_ERROR = {
  UNSUPPORTED_IMAGE: "UNSUPPORTED_IMAGE",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
};

export class OutfitAnalysisError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "OutfitAnalysisError";
    this.code = code;
  }
}

// Every option a shopper can pick manually (OutfitMatch's fallback UI) maps
// to the exact same { recommendedColor, recommendedStyle } shape automatic
// extraction produces, so the backend and the recommendation engine
// (services/recommendationEngine.js, unchanged) never need to know whether
// a result came from pixels or a manual click.
export const MANUAL_COLOR_OPTIONS = [
  { label: "Black / charcoal", hueName: "black", recommendedColor: "Silver", recommendedStyle: "Bold" },
  { label: "White / ivory", hueName: "white", recommendedColor: "Gold", recommendedStyle: "Minimal" },
  { label: "Grey", hueName: "grey", recommendedColor: "Silver", recommendedStyle: "Minimal" },
  { label: "Navy / blue", hueName: "blue", recommendedColor: "Silver", recommendedStyle: "Elegant" },
  { label: "Red", hueName: "red", recommendedColor: "Gold", recommendedStyle: "Bold" },
  { label: "Pink", hueName: "pink", recommendedColor: "Rose Gold", recommendedStyle: "Bold" },
  { label: "Purple", hueName: "purple", recommendedColor: "Diamond", recommendedStyle: "Elegant" },
  { label: "Green / teal", hueName: "green", recommendedColor: "Silver", recommendedStyle: "Elegant" },
  { label: "Orange / rust", hueName: "orange", recommendedColor: "Gold", recommendedStyle: "Traditional" },
  { label: "Yellow / mustard", hueName: "yellow", recommendedColor: "Gold", recommendedStyle: "Traditional" },
  { label: "Beige / tan / brown", hueName: "beige", recommendedColor: "Gold", recommendedStyle: "Traditional" },
  { label: "Soft pastel", hueName: "pastel", recommendedColor: "Pearl", recommendedStyle: "Elegant" },
];

// Minimum share of sampled (weighted) pixels the winning hue bucket needs to
// hold before the result is trusted automatically. Below this, the colors
// present are too evenly mixed to call one of them "dominant" — ambiguous,
// not wrong — so the caller should offer the manual picker instead of
// presenting a shaky guess as confident analysis.
const MIN_CONFIDENT_SHARE = 0.22;

// Downsampled analysis size — large enough to capture real color
// distribution, small enough that this runs instantly on any device.
const SAMPLE_SIZE = 48;

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  switch (max) {
    case r: h = ((g - b) / d) % 6; break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return { h, s, l };
}

// 12 hue buckets, 30deg each, named for plain-language descriptions below —
// only used once a pixel has already cleared the achromatic/pastel checks.
const HUE_BUCKETS = [
  { name: "red", from: 345, to: 15 },
  { name: "orange", from: 15, to: 45 },
  { name: "yellow", from: 45, to: 70 },
  { name: "green", from: 70, to: 160 },
  { name: "teal", from: 160, to: 195 },
  { name: "blue", from: 195, to: 255 },
  { name: "purple", from: 255, to: 290 },
  { name: "pink", from: 290, to: 345 },
];

function hueBucketName(h) {
  for (const b of HUE_BUCKETS) {
    if (b.from > b.to) { if (h >= b.from || h < b.to) return b.name; }
    else if (h >= b.from && h < b.to) return b.name;
  }
  return "blue";
}

// Rule-based styling lookup — documented reasoning per entry, exactly the
// same "style opinion, not a measurement" framing as
// recommendationEngine.js's face-shape reasons. Pastel and achromatic cases
// are handled by the caller before this table is consulted.
const HUE_STYLE_TABLE = {
  red: { recommendedColor: "Gold", recommendedStyle: "Bold", why: "a rich, warm color that gold tends to pick up rather than compete with" },
  pink: { recommendedColor: "Rose Gold", recommendedStyle: "Bold", why: "a warm-leaning color rose gold is specifically mixed to complement" },
  purple: { recommendedColor: "Diamond", recommendedStyle: "Elegant", why: "a deep, cool-leaning color that reads well against bright, clear stones" },
  blue: { recommendedColor: "Silver", recommendedStyle: "Elegant", why: "a cool tone that pairs naturally with cool-toned metal" },
  teal: { recommendedColor: "Silver", recommendedStyle: "Elegant", why: "a cool, blue-leaning tone that suits cool-toned metal" },
  green: { recommendedColor: "Silver", recommendedStyle: "Elegant", why: "a cool-leaning tone that suits cool-toned metal" },
  yellow: { recommendedColor: "Gold", recommendedStyle: "Traditional", why: "a warm tone that sits naturally alongside warm gold" },
  orange: { recommendedColor: "Gold", recommendedStyle: "Traditional", why: "a warm, earthy tone warm metal tends to sit well against" },
};

const DESC_PHRASES = {
  black: "a black outfit",
  white: "a white outfit",
  grey: "a grey outfit",
  "light grey": "a light grey outfit",
  pastel: "a soft pastel outfit",
  red: "a red outfit",
  pink: "a pink outfit",
  purple: "a purple outfit",
  blue: "a navy/blue outfit",
  teal: "a teal outfit",
  green: "a green outfit",
  yellow: "a yellow outfit",
  orange: "an orange/rust outfit",
};

function achromaticBucket(l) {
  if (l > 0.85) return { name: "white", recommendedColor: "Gold", recommendedStyle: "Minimal", why: "a crisp, bright neutral that warm gold lifts rather than blends into" };
  if (l > 0.60) return { name: "light grey", recommendedColor: "Silver", recommendedStyle: "Minimal", why: "a soft neutral that cool-toned metal keeps clean and understated" };
  if (l > 0.32) return { name: "grey", recommendedColor: "Silver", recommendedStyle: "Minimal", why: "a mid neutral that cool-toned metal keeps clean and understated" };
  return { name: "black", recommendedColor: "Silver", recommendedStyle: "Bold", why: "a dark, high-contrast neutral that bright silver or diamond stands out sharply against" };
}

/**
 * @param {HTMLImageElement} imgEl an already-loaded image (object URL or
 *   data URL from a local file — this never fetches a remote URL itself)
 * @returns {{
 *   desc: string, hueName: string, color: string, style: string,
 *   confidence: number, reason: string
 * }}
 * @throws {OutfitAnalysisError}
 */
export function analyzeOutfitImage(imgEl) {
  if (!imgEl.naturalWidth || !imgEl.naturalHeight) {
    throw new OutfitAnalysisError(OUTFIT_ANALYSIS_ERROR.UNSUPPORTED_IMAGE, "This file couldn't be read as an image.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext("2d");

  let data;
  try {
    ctx.drawImage(imgEl, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  } catch (err) {
    throw new OutfitAnalysisError(OUTFIT_ANALYSIS_ERROR.UNSUPPORTED_IMAGE, `Could not process this image: ${err.message}`);
  }

  // Weighted histogram over named buckets (achromatic tiers + pastel + the
  // 8 hue buckets), accumulating lightness so each bucket's own average
  // lightness is available for the pastel/achromatic split without a second
  // pass over the pixels.
  const weights = {};
  const lightnessSums = {};
  let totalWeight = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 16) continue; // fully/mostly transparent pixel — nothing was photographed here
    const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2]);

    // Near-pure white/black pixels are downweighted (0.25x), not excluded —
    // a genuinely white or black outfit should still win on volume, but
    // blown-out highlights/shadows from lighting shouldn't dominate a
    // colorful outfit's real color.
    const extreme = l > 0.95 || l < 0.05;
    const weight = extreme ? 0.25 : 1;

    let bucket;
    if (s < 0.12) bucket = `achromatic:${Math.round(l * 10)}`;
    else if (l > 0.75 && s < 0.40) bucket = "pastel";
    else bucket = `hue:${hueBucketName(h)}`;

    weights[bucket] = (weights[bucket] || 0) + weight;
    lightnessSums[bucket] = (lightnessSums[bucket] || 0) + l * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    throw new OutfitAnalysisError(OUTFIT_ANALYSIS_ERROR.UNSUPPORTED_IMAGE, "This image appears to be blank or fully transparent.");
  }

  // Distinct, non-trivial hue buckets (ignoring achromatic/pastel) present
  // in meaningful volume — a genuine multicolor/patterned outfit, not just
  // JPEG noise around one dominant color.
  const distinctHueShares = Object.entries(weights)
    .filter(([key]) => key.startsWith("hue:"))
    .map(([, w]) => w / totalWeight)
    .filter(share => share > 0.15);

  const [winningBucket, winningWeight] = Object.entries(weights).sort((a, b) => b[1] - a[1])[0];
  const confidence = winningWeight / totalWeight;

  if (confidence < MIN_CONFIDENT_SHARE) {
    throw new OutfitAnalysisError(OUTFIT_ANALYSIS_ERROR.LOW_CONFIDENCE, "This photo doesn't have one clearly dominant color — pick a color below instead.");
  }

  let hueName, recommendedColor, recommendedStyle, why;
  if (winningBucket.startsWith("achromatic:")) {
    const avgL = lightnessSums[winningBucket] / weights[winningBucket];
    ({ name: hueName, recommendedColor, recommendedStyle, why } = achromaticBucket(avgL));
  } else if (winningBucket === "pastel") {
    hueName = "pastel";
    recommendedColor = "Pearl";
    recommendedStyle = "Elegant";
    why = "a soft, muted tone pearl's gentle luster complements rather than competes with";
  } else {
    hueName = winningBucket.slice(4);
    ({ recommendedColor, recommendedStyle, why } = HUE_STYLE_TABLE[hueName] || HUE_STYLE_TABLE.blue);
  }

  // A genuinely multicolor outfit (several strong, roughly-even hues) reads
  // as a bold styling choice regardless of which single hue happened to
  // edge out the others — overridden here rather than silently reported as
  // a single-color outfit.
  const isMulticolor = distinctHueShares.length >= 3;
  if (isMulticolor) recommendedStyle = "Bold";

  const desc = isMulticolor ? "a multicolor outfit" : (DESC_PHRASES[hueName] || `a ${hueName} outfit`);

  return {
    desc,
    hueName,
    color: recommendedColor,
    style: recommendedStyle,
    confidence: Math.round(confidence * 100) / 100,
    reason: isMulticolor
      ? "Several strong colors were detected, which tends to read as a bolder, statement look."
      : `Its dominant color is ${why}.`,
  };
}
