const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PRODUCT_TRYON_MAPPING = [
  // Sets first (to avoid partial matching by individual components)
  {
    pattern: /aranya.*royal.*temple.*choker.*set|choker.*jhumka.*set/i,
    name: "Aranya Royal Temple Choker & Jhumka Set",
    asset: {
      transparent: "/uploads/aranya-choker-necklace-tryon.png",
      necklace: "/uploads/aranya-choker-necklace-tryon.png",
      earrings: "/uploads/aranya-jhumka-tryon.png",
      hasNecklace: true,
      hasEarrings: true,
      componentType: "set",
      status: "ready",
    },
  },
  {
    pattern: /royal.*pearl.*cascade.*set|necklace.*earring.*set/i,
    name: "Royal Pearl Cascade Necklace & Earring Set",
    asset: {
      transparent: "/uploads/royal-pearl-necklace-tryon.png",
      necklace: "/uploads/royal-pearl-necklace-tryon.png",
      earrings: "/uploads/solstice-pearl-drop-tryon.png",
      hasNecklace: true,
      hasEarrings: true,
      componentType: "set",
      status: "ready",
    },
  },
  // Individual Necklaces
  {
    pattern: /aranya.*choker/i,
    name: "Aranya Kundan Choker",
    asset: {
      transparent: "/uploads/aranya-choker-necklace-tryon.png",
      necklace: "/uploads/aranya-choker-necklace-tryon.png",
      componentType: "necklace",
      status: "ready",
    },
  },
  {
    pattern: /ivory.*pearl.*necklace/i,
    name: "Ivory Pearl Bridal Necklace",
    asset: {
      transparent: "/uploads/royal-pearl-necklace-tryon.png",
      necklace: "/uploads/royal-pearl-necklace-tryon.png",
      componentType: "necklace",
      status: "ready",
    },
  },
  // Individual Earrings
  {
    pattern: /aranya.*jhumka/i,
    name: "Aranya Jhumka",
    asset: {
      transparent: "/uploads/aranya-jhumka-tryon.png",
      earrings: "/uploads/aranya-jhumka-tryon.png",
      componentType: "earrings",
      status: "ready",
    },
  },
  {
    pattern: /mahalaxmi.*jhumka|temple.*gold.*jhumka/i,
    name: "Mahalaxmi Temple Gold Jhumkas",
    asset: {
      transparent: "/uploads/aranya-jhumka-tryon.png",
      earrings: "/uploads/aranya-jhumka-tryon.png",
      componentType: "earrings",
      status: "ready",
    },
  },
  {
    pattern: /solstice.*pearl/i,
    name: "Solstice Pearl Drops",
    asset: {
      transparent: "/uploads/solstice-pearl-drop-tryon.png",
      earrings: "/uploads/solstice-pearl-drop-tryon.png",
      componentType: "earrings",
      status: "ready",
    },
  },
  {
    pattern: /gulabi.*chandbali/i,
    name: "Gulabi Kundan Pearl Chandbalis",
    asset: {
      transparent: "/uploads/gulabi-chandbali-tryon.png",
      earrings: "/uploads/gulabi-chandbali-tryon.png",
      componentType: "earrings",
      status: "ready",
    },
  },
  {
    pattern: /marbella.*chandbali/i,
    name: "Marbella Chandbali",
    asset: {
      transparent: "/uploads/gulabi-chandbali-tryon.png",
      earrings: "/uploads/gulabi-chandbali-tryon.png",
      componentType: "earrings",
      status: "ready",
    },
  },
  {
    pattern: /nawab.*chandbali/i,
    name: "Nawab Chandbali",
    asset: {
      transparent: "/uploads/gulabi-chandbali-tryon.png",
      earrings: "/uploads/gulabi-chandbali-tryon.png",
      componentType: "earrings",
      status: "ready",
    },
  },
];

async function main() {
  console.log("=== Auditing and Synchronizing Virtual Try-On Assets in Database ===");
  const products = await prisma.product.findMany();

  let updatedCount = 0;
  for (const product of products) {
    const match = PRODUCT_TRYON_MAPPING.find((m) => m.pattern.test(product.name));
    if (match) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          tryOnAsset: match.asset,
        },
      });
      console.log(`[UPDATED] "${product.name}" -> tryOnAsset: ${JSON.stringify(match.asset)}`);
      updatedCount++;
    }
  }

  console.log(`=== Done. ${updatedCount} products updated with verified transparent try-on assets. ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
