const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { removeImageBackground } = require('../src/services/imageService');

async function syncAllProducts() {
  console.log("Checking all products for Try-On asset readiness...");
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      productType: true,
      kind: true,
      images: true,
      tryOnAsset: true,
    },
  });

  let updatedCount = 0;

  for (const prod of products) {
    // If Sapphire product, ensure it has a valid catalogue image
    if (prod.name.toLowerCase().includes("sapphire") && (!prod.images || prod.images.length === 0 || prod.images[0].includes("auriel_sapphire_drop"))) {
      prod.images = ["/uploads/gulabi-kundan-pearl-chandbali.jpg"];
      await prisma.product.update({
        where: { id: prod.id },
        data: { images: prod.images },
      });
      console.log(`Updated Sapphire product catalogue image.`);
    }

    const hasImages = Array.isArray(prod.images) && prod.images.length > 0;
    if (!hasImages) continue;

    const currentTryOn = prod.tryOnAsset || {};
    const hasTransparent = Boolean(currentTryOn.transparent || currentTryOn.earrings || currentTryOn.necklace);

    if (!hasTransparent) {
      console.log(`Product [${prod.name}] is missing try-on asset. Generating from ${prod.images[0]}...`);
      try {
        const isStud = prod.kind === "stud" || /stud/i.test(prod.name);
        const result = await removeImageBackground(prod.images[0], {
          originalName: `${prod.name}-tryon`,
          tolerance: 32,
          isStud,
        });

        if (result && result.url) {
          const newAsset = {
            status: "ready",
            transparent: result.url,
            earrings: prod.productType === "necklace" ? undefined : result.url,
            necklace: prod.productType === "necklace" ? result.url : undefined,
            componentType: prod.productType || "earrings",
          };

          await prisma.product.update({
            where: { id: prod.id },
            data: { tryOnAsset: newAsset },
          });

          console.log(`✓ Successfully updated [${prod.name}] tryOnAsset -> ${result.url}`);
          updatedCount++;
        }
      } catch (err) {
        console.warn(`Failed to generate tryOnAsset for [${prod.name}]:`, err.message);
      }
    } else {
      console.log(`✓ Product [${prod.name}] already has tryOnAsset configured.`);
    }
  }

  console.log(`Sync completed. Reprocessed ${updatedCount} products.`);
}

syncAllProducts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
