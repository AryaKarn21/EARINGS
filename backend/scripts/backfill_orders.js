import prisma from '../src/prisma.js';

async function main() {
  const orders = await prisma.order.findMany();
  console.log(`Found ${orders.length} orders.`);
  for (const o of orders) {
    if (!o.orderNumber) {
      const year = new Date(o.createdAt || Date.now()).getFullYear();
      const rand = Math.floor(10000 + Math.random() * 90000);
      const num = `AUR-${year}-${rand}`;
      await prisma.order.update({
        where: { id: o.id },
        data: { orderNumber: num }
      });
      console.log(`Updated order ${o.id} with orderNumber ${num}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
