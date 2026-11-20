import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  computeEarAnchors,
  mapVideoToContainer,
  isStudEarring,
  getProductTryOnImage,
  getProductJewelleryType,
  getProductTryOnAssets,
  isChokerNecklace,
  EAR_LANDMARKS,
  PRODUCT_TRYON_ASSETS,
} from "./src/services/earGeometry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("=== RUNNING EAR GEOMETRY & TRY-ON PIPELINE VERIFICATION SUITE ===\n");

// 1. Verify getProductJewelleryType and getProductTryOnAssets resolution
console.log("Test 1: Product Type & Component Try-On Asset Resolution");
const aranyaJhumka = { name: "Aranya Jhumka", kind: "jhumka", category: "jhumka" };
assert.strictEqual(getProductJewelleryType(aranyaJhumka), "earrings");
const aranyaJhumkaAssets = getProductTryOnAssets(aranyaJhumka);
assert.strictEqual(aranyaJhumkaAssets.earringAsset, "/uploads/aranya-jhumka-tryon.png");
assert.strictEqual(aranyaJhumkaAssets.necklaceAsset, null);

const aranyaChoker = { name: "Aranya Kundan Choker", category: "necklace", kind: "choker" };
assert.strictEqual(getProductJewelleryType(aranyaChoker), "necklace");
const aranyaChokerAssets = getProductTryOnAssets(aranyaChoker);
assert.strictEqual(aranyaChokerAssets.necklaceAsset, "/uploads/aranya-choker-necklace-tryon.png");
assert.strictEqual(aranyaChokerAssets.earringAsset, null);
assert.strictEqual(isChokerNecklace(aranyaChoker), true);

const bridalNecklace = { name: "Ivory Pearl Bridal Necklace", category: "necklace", kind: "necklace" };
assert.strictEqual(getProductJewelleryType(bridalNecklace), "necklace");
const bridalAssets = getProductTryOnAssets(bridalNecklace);
assert.strictEqual(bridalAssets.necklaceAsset, "/uploads/royal-pearl-necklace-tryon.png");

const royalSet = { name: "Aranya Royal Temple Choker & Jhumka Set", category: "jewellery-set", kind: "set" };
assert.strictEqual(getProductJewelleryType(royalSet), "set");
const setAssets = getProductTryOnAssets(royalSet);
assert.strictEqual(setAssets.necklaceAsset, "/uploads/aranya-choker-necklace-tryon.png");
assert.strictEqual(setAssets.earringAsset, "/uploads/aranya-jhumka-tryon.png");

console.log("✓ Earring, Necklace, and Jewellery Set product types and component assets verified with zero string-collision\n");

// 2. Verify physical assets exist in both frontend public/ and backend uploads/
console.log("Test 2: Asset Availability on Disk");
const publicUploads = path.join(__dirname, "public", "uploads");
const backendUploads = path.join(__dirname, "..", "backend", "uploads");

const testFiles = [
  "aranya-jhumka-tryon.png",
  "gulabi-chandbali-tryon.png",
  "solstice-pearl-drop-tryon.png",
  "aranya-choker-necklace-tryon.png",
  "royal-pearl-necklace-tryon.png"
];
for (const file of testFiles) {
  const pPath = path.join(publicUploads, file);
  const bPath = path.join(backendUploads, file);
  assert(fs.existsSync(pPath), `File missing in frontend public: ${pPath}`);
  assert(fs.existsSync(bPath), `File missing in backend uploads: ${bPath}`);
  const stat = fs.statSync(pPath);
  assert(stat.size > 20000, `Asset size seems too small: ${stat.size} bytes`);
  console.log(`✓ ${file}: Present and verified (${(stat.size / 1024).toFixed(1)} KB)`);
}
console.log();

// 3. Verify isStudEarring classification
console.log("Test 3: Stud vs Hanging Earring Classification");
assert.strictEqual(isStudEarring({ kind: "flower-stud" }), true, "flower-stud must be classified as stud");
assert.strictEqual(isStudEarring({ kind: "diamond-stud" }), true, "diamond-stud must be classified as stud");
assert.strictEqual(isStudEarring({ name: "Aranya Jhumka", kind: "jhumka" }), false, "jhumka must be classified as hanging");
assert.strictEqual(isStudEarring({ name: "Nawab Chandbali", kind: "chandbali" }), false, "chandbali must be classified as hanging");
console.log("✓ Stud and hanging earrings correctly classified\n");

// 4. Verify mapVideoToContainer math
console.log("Test 4: mapVideoToContainer Aspect-Ratio & Mirroring Math");
// Container: 400x600 (portrait: ratio = 0.666)
// Video: 1280x720 (widescreen 16:9: ratio = 1.777)
// Container is taller than video -> renderHeight = 600, renderWidth = 600 * (16/9) = 1066.67
// offsetX = (400 - 1066.67) / 2 = -333.33
const mappedCenter = mapVideoToContainer({
  normX: 0.5,
  normY: 0.5,
  videoWidth: 1280,
  videoHeight: 720,
  containerWidth: 400,
  containerHeight: 600,
  isMirrored: true,
});
// Center of frame should land exactly at center of container (x=200, y=300)
assert(Math.abs(mappedCenter.x - 200) < 1.0, `Center X expected ~200, got ${mappedCenter.x}`);
assert(Math.abs(mappedCenter.y - 300) < 1.0, `Center Y expected ~300, got ${mappedCenter.y}`);
console.log(`✓ Center mapping verified: x=${mappedCenter.x}, y=${mappedCenter.y}`);

// Wearer's left ear (raw frame image right: normX = 0.65)
// In mirrored view, it must map to SCREEN LEFT (x < 200)
const mappedLeftEar = mapVideoToContainer({
  normX: 0.65,
  normY: 0.5,
  videoWidth: 1280,
  videoHeight: 720,
  containerWidth: 400,
  containerHeight: 600,
  isMirrored: true,
});
assert(mappedLeftEar.x < 200, `Mirrored left ear must be on screen left (<200), got ${mappedLeftEar.x}`);

// Wearer's right ear (raw frame image left: normX = 0.35)
// In mirrored view, it must map to SCREEN RIGHT (x > 200)
const mappedRightEar = mapVideoToContainer({
  normX: 0.35,
  normY: 0.5,
  videoWidth: 1280,
  videoHeight: 720,
  containerWidth: 400,
  containerHeight: 600,
  isMirrored: true,
});
assert(mappedRightEar.x > 200, `Mirrored right ear must be on screen right (>200), got ${mappedRightEar.x}`);
console.log(`✓ Mirrored ear coordinates: Left ear on screen left (${mappedLeftEar.x.toFixed(1)}px), Right ear on screen right (${mappedRightEar.x.toFixed(1)}px)\n`);

// 5. Verify computeEarAnchors
console.log("Test 5: computeEarAnchors Anatomical Placement");
// Create mock 478 MediaPipe landmarks for front-facing portrait
const mockLandmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
mockLandmarks[EAR_LANDMARKS.FOREHEAD_TOP] = { x: 0.50, y: 0.20, z: 0 };
mockLandmarks[EAR_LANDMARKS.CHIN_BOTTOM] = { x: 0.50, y: 0.70, z: 0 }; // Face height = 0.50
mockLandmarks[EAR_LANDMARKS.NOSE_TIP] = { x: 0.50, y: 0.45, z: -0.05 };
mockLandmarks[EAR_LANDMARKS.RIGHT_TRAGUS] = { x: 0.35, y: 0.45, z: 0 }; // Wearer's right (image left)
mockLandmarks[EAR_LANDMARKS.RIGHT_CHEEK] = { x: 0.38, y: 0.48, z: 0 };
mockLandmarks[EAR_LANDMARKS.RIGHT_GONION] = { x: 0.37, y: 0.60, z: 0 };
mockLandmarks[EAR_LANDMARKS.LEFT_TRAGUS] = { x: 0.65, y: 0.45, z: 0 };  // Wearer's left (image right)
mockLandmarks[EAR_LANDMARKS.LEFT_CHEEK] = { x: 0.62, y: 0.48, z: 0 };
mockLandmarks[EAR_LANDMARKS.LEFT_GONION] = { x: 0.63, y: 0.60, z: 0 };

const anchors = computeEarAnchors(mockLandmarks, { mirrorX: true });
assert.strictEqual(anchors.wearerRight.visible, true, "Wearer right ear should be visible in front-facing view");
assert.strictEqual(anchors.wearerLeft.visible, true, "Wearer left ear should be visible in front-facing view");

// Downward lobule offset check: earlobe anchor Y must be below tragus Y (0.45)
assert(anchors.wearerRight.y > 0.45, `Right earlobe anchor (${anchors.wearerRight.y}) must sit below tragus (0.45)`);
assert(anchors.wearerLeft.y > 0.45, `Left earlobe anchor (${anchors.wearerLeft.y}) must sit below tragus (0.45)`);

// Lateral outward offset check:
// Wearer's right earlobe must sit outward (left of tragus 0.35):
assert(anchors.wearerRight.x < 0.35, `Right earlobe anchor X (${anchors.wearerRight.x}) must be lateral/outward of tragus (0.35)`);
// Wearer's left earlobe must sit outward (right of tragus 0.65):
assert(anchors.wearerLeft.x > 0.65, `Left earlobe anchor X (${anchors.wearerLeft.x}) must be lateral/outward of tragus (0.65)`);

assert(anchors.necklace, "Necklace anchor must be present");
assert(anchors.necklace.y > 0.70, `Collarbone anchor Y (${anchors.necklace.y}) must sit below chin (0.70)`);
assert(Math.abs(anchors.necklace.x - 0.50) < 0.05, `Collarbone anchor X (${anchors.necklace.x}) must sit along center line`);

console.log(`✓ Anatomical anchors calculated:`);
console.log(`  Right Tragus: (0.350, 0.450) -> Earlobe Piercing Anchor: (${anchors.wearerRight.x.toFixed(3)}, ${anchors.wearerRight.y.toFixed(3)})`);
console.log(`  Left Tragus:  (0.650, 0.450) -> Earlobe Piercing Anchor: (${anchors.wearerLeft.x.toFixed(3)}, ${anchors.wearerLeft.y.toFixed(3)})`);
console.log(`  Suprasternal Collarbone Notch: (${anchors.necklace.x.toFixed(3)}, ${anchors.necklace.y.toFixed(3)}) with widthNorm=${anchors.necklace.widthNorm.toFixed(3)}`);
console.log(`  Face Height: ${anchors.faceHeight.toFixed(3)}, Roll Deg: ${anchors.rollDeg.toFixed(2)}°, Yaw Deg: ${anchors.yawDeg.toFixed(2)}°`);

console.log("\nALL 5 TEST SUITES PASSED SUCCESSFULLY!");
