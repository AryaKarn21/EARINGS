const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prods = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: "Choker", mode: "insensitive" } },
        { name: { contains: "Necklace", mode: "insensitive" } },
        { category: { contains: "necklace", mode: "insensitive" } },
        { productType: "necklace" },
        { productType: "set" }
      ]
    }
  });
  for (const p of prods) {
    console.log(`[${p.id}] ${p.name} | type=${p.productType} | cat=${p.category}`);
    console.log(`  tryOnAsset:`, JSON.stringify(p.tryOnAsset));
    console.log(`  images:`, p.images);
  }
}

main().finally(() => prisma.$disconnect());
