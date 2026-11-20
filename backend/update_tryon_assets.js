const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const updates = [
    {
      match: { name: "Aranya Jhumka" },
      data: {
        productType: "earrings",
        category: "jhumka",
        kind: "jhumka",
        tryOnAsset: {
          transparent: "/uploads/aranya-jhumka-tryon.png",
          componentType: "earrings",
        },
      },
    },
    {
      match: { name: "Mahalaxmi Temple Gold Jhumkas" },
      data: {
        productType: "earrings",
        category: "jhumka",
        kind: "jhumka",
        tryOnAsset: {
          transparent: "/uploads/aranya-jhumka-tryon.png",
          componentType: "earrings",
        },
      },
    },
    {
      match: { name: "Aranya Kundan Choker" },
      data: {
        productType: "necklace",
        category: "choker",
        kind: "kundan-choker",
        tryOnAsset: {
          transparent: "/uploads/aranya-choker-necklace-tryon.png",
          necklace: "/uploads/aranya-choker-necklace-tryon.png",
          componentType: "necklace",
        },
      },
    },
    {
      match: { name: "Aranya Royal Temple Choker & Jhumka Set" },
      data: {
        productType: "set",
        category: "jewellery-set",
        kind: "choker-jhumka-set",
        tryOnAsset: {
          transparent: "/uploads/aranya-choker-necklace-tryon.png",
          necklace: "/uploads/aranya-choker-necklace-tryon.png",
          earrings: "/uploads/aranya-jhumka-tryon.png",
          componentType: "set",
          hasNecklace: true,
          hasEarrings: true,
        },
      },
    },
    {
      match: { name: "Gulabi Kundan Pearl Chandbalis" },
      data: {
        productType: "earrings",
        category: "chandbali",
        kind: "chandbali",
        tryOnAsset: {
          transparent: "/uploads/gulabi-chandbali-tryon.png",
          componentType: "earrings",
        },
      },
    },
    {
      match: { name: "Nawab Chandbali" },
      data: {
        productType: "earrings",
        category: "chandbali",
        kind: "chandbali",
        tryOnAsset: {
          transparent: "/uploads/gulabi-chandbali-tryon.png",
          componentType: "earrings",
        },
      },
    },
    {
      match: { name: "Marbella Chandbali" },
      data: {
        productType: "earrings",
        category: "chandbali",
        kind: "chandbali-silver",
        tryOnAsset: {
          transparent: "/uploads/gulabi-chandbali-tryon.png",
          componentType: "earrings",
        },
      },
    },
    {
      match: { name: "Solstice Pearl Drops" },
      data: {
        productType: "earrings",
        category: "drop",
        kind: "pearl-drop",
        tryOnAsset: {
          transparent: "/uploads/solstice-pearl-drop-tryon.png",
          componentType: "earrings",
        },
      },
    },
    {
      match: { name: "Ivory Pearl Bridal Necklace" },
      data: {
        productType: "necklace",
        category: "bridal-necklace",
        kind: "pearl-cluster-necklace",
        tryOnAsset: {
          transparent: "/uploads/royal-pearl-necklace-tryon.png",
          necklace: "/uploads/royal-pearl-necklace-tryon.png",
          componentType: "necklace",
        },
      },
    },
    {
      match: { name: "Royal Pearl Cascade Necklace & Earring Set" },
      data: {
        productType: "set",
        category: "jewellery-set",
        kind: "pearl-cluster-necklace",
        tryOnAsset: {
          transparent: "/uploads/royal-pearl-necklace-tryon.png",
          necklace: "/uploads/royal-pearl-necklace-tryon.png",
          earrings: "/uploads/solstice-pearl-drop-tryon.png",
          componentType: "set",
          hasNecklace: true,
          hasEarrings: true,
        },
      },
    },
  ];

  for (const item of updates) {
    const updated = await prisma.product.updateMany({
      where: item.match,
      data: item.data,
    });
    console.log(`Updated ${item.match.name}: ${updated.count} row(s)`);
  }
}

main().finally(() => prisma.$disconnect());
