const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { removeImageBackground } = require('../src/services/imageService');

async function main() {
  await prisma.product.update({
    where: { id: '11fb5222-2ce0-4364-a9e2-cd682356fd40' },
    data: {
      images: ['/uploads/gulabi-kundan-pearl-chandbali.jpg'],
      tryOnAsset: {
        status: 'ready',
        earrings: '/uploads/gulabi-chandbali-tryon.png',
        transparent: '/uploads/gulabi-chandbali-tryon.png',
        componentType: 'earrings',
      },
    },
  });
  console.log('Fixed Sapphire product tryOnAsset');
}

main().finally(() => prisma.$disconnect());
