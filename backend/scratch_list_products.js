const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      productType: true,
      category: true,
      kind: true,
      images: true,
      tryOnAsset: true,
    },
  });
  console.log("=== NECKLACES & CHOKERS & SETS ===");
  const neckAndSets = products.filter(p => 
    p.productType === "necklace" || 
    p.category?.toLowerCase().includes("neck") || 
    p.category?.toLowerCase().includes("choker") || 
    p.category?.toLowerCase().includes("set") ||
    p.name?.toLowerCase().includes("set") ||
    p.name?.toLowerCase().includes("necklace") ||
    p.name?.toLowerCase().includes("choker")
  );
  console.log(JSON.stringify(neckAndSets, null, 2));

  console.log("\n=== PRODUCTS WITH IMAGES ===");
  const withImages = products.filter(p => p.images && p.images.length > 0);
  console.log(JSON.stringify(withImages, null, 2));
}

main().finally(() => prisma.$disconnect());

