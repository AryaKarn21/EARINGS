const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const all = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      productType: true,
      images: true,
      tryOnAsset: true,
    }
  });
  const withImages = all.filter(p => Array.isArray(p.images) && p.images.length > 0);
  console.log(`Products with images: ${withImages.length} out of ${all.length}`);
  for (const p of withImages) {
    console.log(`[${p.productType}] ${p.name} (${p.id})`);
    console.log(`   images: ${p.images.join(', ')}`);
    console.log(`   tryOnAsset: ${JSON.stringify(p.tryOnAsset)}`);
  }
}

main().finally(() => prisma.$disconnect());
