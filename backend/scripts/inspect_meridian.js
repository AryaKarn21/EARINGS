const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findMany({
    where: { productType: 'earrings', images: { equals: [] } },
    select: { id: true, name: true, category: true, kind: true, material: true, color: true }
  });
  console.log(`Earrings with empty images: ${p.length}`);
  console.log(JSON.stringify(p, null, 2));
}

main().finally(() => prisma.$disconnect());
