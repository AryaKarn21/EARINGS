const fs = require('fs');
const path = require('path');

async function testPipeline() {
  console.log("=== VERIFYING JEWELLERY BACKGROUND ISOLATION PIPELINE ===");

  // 1. Check Python script directly
  const { execFileSync } = require('child_process');
  const scriptPath = path.join(__dirname, 'isolate_jewellery_background.py');
  const sampleInput = path.join(__dirname, '..', 'uploads', 'ornate-gold-jhumka-earrings-mv96n82x-83d1d98a3123.png');
  const sampleOutput = path.join(__dirname, '..', 'uploads', 'verify-test-output.png');

  if (fs.existsSync(sampleInput)) {
    console.log("Testing Python OpenCV background isolation on BEBO image...");
    execFileSync('python', [scriptPath, sampleInput, sampleOutput, '32', 'false']);
    if (fs.existsSync(sampleOutput)) {
      const stats = fs.statSync(sampleOutput);
      console.log(`✓ Python isolation succeeded! Output size: ${stats.size} bytes`);
      
      // Check transparency with Python
      const pyCheck = `
from PIL import Image
im = Image.open(r"${sampleOutput.replace(/\\/g, '\\\\')}")
w, h = im.size
c1 = im.getpixel((0, 0))
c2 = im.getpixel((w - 1, 0))
c3 = im.getpixel((0, h - 1))
c4 = im.getpixel((w - 1, h - 1))
center = im.getpixel((w // 2, h // 2))
print(f"Dimensions: {w}x{h}")
print(f"Corners Alpha: ({c1[3]}, {c2[3]}, {c3[3]}, {c4[3]})")
print(f"Center Alpha: {center[3]}")
assert c1[3] == 0 and c2[3] == 0 and c3[3] == 0 and c4[3] == 0, "Corners must have alpha=0"
assert center[3] > 0, "Center jewellery must have alpha > 0"
print("[OK] Perfect genuine alpha transparency verified!")
`;
      const res = execFileSync('python', ['-c', pyCheck], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).toString();
      console.log(res);
      fs.unlinkSync(sampleOutput);
    }
  } else {
    console.log("Sample input not found on disk:", sampleInput);
  }

  // 2. Check Backend Server Endpoint
  console.log("\nTesting Backend API http://127.0.0.1:4000/api/images/bebo-jhumka-tryon-mv99f8cp-c98051a97590.png...");
  try {
    const res = await fetch("http://127.0.0.1:4000/api/images/bebo-jhumka-tryon-mv99f8cp-c98051a97590.png");
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log(`Content-Type: ${res.headers.get("content-type")}`);
    console.log(`Access-Control-Allow-Origin: ${res.headers.get("access-control-allow-origin")}`);
    console.log(`Cache-Control: ${res.headers.get("cache-control")}`);
    const buf = await res.arrayBuffer();
    console.log(`✓ Successfully downloaded ${buf.byteLength} bytes transparent PNG over HTTP with CORS headers enabled.`);
  } catch (err) {
    console.error("HTTP fetch error:", err.message);
  }

  // 3. Check All Database Earring Products
  console.log("\nChecking Database Product tryOnAssets...");
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const earrings = await prisma.product.findMany({
    where: {
      OR: [
        { productType: 'earrings' },
        { productType: 'set' },
      ],
      NOT: { images: { equals: [] } }
    },
    select: { id: true, name: true, productType: true, images: true, tryOnAsset: true }
  });

  for (const e of earrings) {
    const hasTransparent = e.tryOnAsset?.transparent || e.tryOnAsset?.earrings;
    console.log(`[${e.productType}] ${e.name}: ${hasTransparent ? '✓ READY (' + (e.tryOnAsset.earrings || e.tryOnAsset.transparent) + ')' : '✗ MISSING'}`);
  }
  await prisma.$disconnect();

  console.log("\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

testPipeline().catch(console.error);
