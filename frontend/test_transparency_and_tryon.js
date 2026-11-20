import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getProductJewelleryType,
  getProductTryOnAssets,
  getProductTryOnImage,
  mapVideoToContainer,
  isStudEarring,
  isChokerNecklace
} from "./src/services/earGeometry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("=== RUNNING VIRTUAL TRY-ON TRANSPARENCY & CATEGORY VERIFICATION ===");

// 1. Verify Transparent PNG Assets & Alpha Header
const assetsToCheck = [
  "aranya-jhumka-tryon.png",
  "gulabi-chandbali-tryon.png",
  "solstice-pearl-drop-tryon.png",
  "aranya-choker-necklace-tryon.png",
  "royal-pearl-necklace-tryon.png",
  "mahalakshmi-jhumkas-tryon.png",
  "meridian-hoops-tryon.png",
  "diamond-stud-tryon.png",
  "royal-sapphire-chandbali-tryon.png",
  "bebo-jhumka-tryon.png"
];

console.log("\n1. Verifying Transparent PNG Assets:");
let allAssetsValid = true;
for (const file of assetsToCheck) {
  const filePath = path.join(__dirname, "public", "uploads", file);
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    const buf = fs.readFileSync(filePath);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    // Check color type in IHDR chunk (bytes 24-25). Type 6 = RGBA with true alpha channel
    const colorType = buf[25];
    console.log(`✓ ${file}: ${(stat.size / 1024).toFixed(1)} KB | PNG: ${isPng} | ColorType: ${colorType} (${colorType === 6 ? "RGBA TrueColor + Alpha" : "Non-RGBA"})`);
    if (!isPng || colorType !== 6) allAssetsValid = false;
  } else {
    console.error(`✗ Missing asset: ${file}`);
    allAssetsValid = false;
  }
}

// 2. Verify Category Detection & Asset Resolution for All Jewellery Types
console.log("\n2. Verifying All Jewellery Types & Asset Resolution:");
const testProducts = [
  { name: "Aranya Jhumka", kind: "jhumka", category: "earrings", images: ["/uploads/aranya-jhumka-tryon.png"] },
  { name: "Gulabi Kundan Pearl Chandbalis", kind: "chandbali", category: "earrings", images: ["/uploads/gulabi-chandbali-tryon.png"] },
  { name: "Solstice Pearl Drops", kind: "pearl-drop", category: "earrings", images: ["/uploads/solstice-pearl-drop-tryon.png"] },
  { name: "Diamond Solitaire Studs", kind: "diamond-stud", category: "stud", images: ["/uploads/solstice-pearl-drop-tryon.png"] },
  { name: "Aranya Kundan Choker", kind: "choker", category: "necklace", images: ["/uploads/aranya-choker-necklace-tryon.png"] },
  { name: "Ivory Pearl Bridal Necklace", kind: "bridal-necklace", category: "necklace", images: ["/uploads/royal-pearl-necklace-tryon.png"] },
  { name: "Aranya Lakshmi Choker & Jhumka Set", kind: "choker", category: "set", images: ["/uploads/aranya-lakshmi-choker-jhumka-set.jpg"] },
  { name: "Royal Kundan Bangle", kind: "bangle", category: "bangle", images: ["/uploads/royal-pearl-cascade-necklace-set.jpg"] },
  { name: "Solitaire Diamond Band Ring", kind: "band-ring", category: "ring", images: ["/uploads/solstice-pearl-drop-tryon.png"] }
];

let allCategoriesValid = true;
for (const prod of testProducts) {
  const type = getProductJewelleryType(prod);
  const assets = getProductTryOnAssets(prod);
  const primaryImg = getProductTryOnImage(prod);
  console.log(`- "${prod.name}": detected type="${type}" | earringAsset=${Boolean(assets.earringAsset)} | necklaceAsset=${Boolean(assets.necklaceAsset)} | ornamentAsset=${Boolean(assets.ornamentAsset)} | primary=${primaryImg}`);

  if (type === "necklace" && !assets.necklaceAsset) allCategoriesValid = false;
  if (type === "earrings" && !assets.earringAsset) allCategoriesValid = false;
  if (type === "set" && (!assets.necklaceAsset || !assets.earringAsset)) allCategoriesValid = false;
  if (type === "bracelet" && !primaryImg) allCategoriesValid = false;
  if (type === "ring" && !primaryImg) allCategoriesValid = false;
}

// 3. Verify Coordinate Mapping & Aspect Parity
console.log("\n3. Verifying Coordinate Mapping & Aspect Parity:");
const testCoords = mapVideoToContainer({
  normX: 0.5,
  normY: 0.5,
  videoWidth: 1280,
  videoHeight: 720,
  containerWidth: 400,
  containerHeight: 600,
  isMirrored: true
});
console.log(`✓ Center mapped at (${testCoords.x.toFixed(1)}, ${testCoords.y.toFixed(1)}) with renderDims=${testCoords.renderWidth.toFixed(0)}x${testCoords.renderHeight.toFixed(0)}`);

// Final assertion
if (allAssetsValid && allCategoriesValid) {
  console.log("\n✅ ALL TRY-ON TRANSPARENCY & ORNAMENT TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
} else {
  console.error("\n❌ SOME TESTS FAILED!");
  process.exit(1);
}
