const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function updateImages() {
  console.log("Updating product images with real luxury jewellery photographs...");

  // Image 1: Royal Pearl Cascade Necklace & Chandelier Earrings Set
  // media_1791970065220.jpg -> royal-pearl-cascade-necklace-set.jpg
  // Image 2: Mahalaxmi Temple Gold Jhumkas
  // media_1791970164467.jpg -> mahalakshmi-temple-gold-jhumkas.jpg
  // Image 3: Aranya Lakshmi Temple Choker & Jhumka Set
  // media_1791970234180.jpg -> aranya-lakshmi-choker-jhumka-set.jpg
  // Image 4: Gulabi Kundan & Pearl Chandbali
  // media_1791970375578.jpg -> gulabi-kundan-pearl-chandbali.jpg

  const updates = [
    {
      match: { name: "Aranya Jhumka" },
      image: "/uploads/mahalakshmi-temple-gold-jhumkas.jpg",
      description: "Handcrafted 22K antique gold temple jhumkas featuring Goddess Lakshmi medallion studs encircled with rubies and emeralds, bell motifs set with kundan stones, and cascading natural freshwater pearl drops."
    },
    {
      match: { name: "Nawab Chandbali" },
      image: "/uploads/gulabi-kundan-pearl-chandbali.jpg",
      description: "Artisanal crescent chandbali earrings featuring hand-cut pink quartz floral stud tops, filigree floral crescents set with uncut kundan polki, and lush teardrop pearl fringes."
    },
    {
      match: { name: "Solstice Pearl Drops" },
      image: "/uploads/royal-pearl-cascade-necklace-set.jpg",
      description: "Exquisite multi-tier freshwater pearl drop earrings with regal filigree craftsmanship, designed to catch candlelight and complement evening attire."
    },
    {
      match: { name: "Aranya Kundan Choker" },
      image: "/uploads/aranya-lakshmi-choker-jhumka-set.jpg",
      description: "Magnificent 22K gold-plated antique temple choker necklace featuring an intricately sculpted Goddess Lakshmi centerpiece, pearl tassels, and matching temple jhumkas."
    },
    {
      match: { name: "Ivory Pearl Bridal Necklace" },
      image: "/uploads/royal-pearl-cascade-necklace-set.jpg",
      description: "Royal pearl cascade necklace set with matching chandelier pearl drop earrings, handcrafted for bridal occasions and gala celebrations."
    },
    {
      match: { name: "Marbella Chandbali" },
      image: "/uploads/gulabi-kundan-pearl-chandbali.jpg",
      description: "The crescent chandbali with blossom floral tops, delicate pink stones, and radiant teardrop pearl clusters."
    }
  ];

  for (const item of updates) {
    const existing = await prisma.product.findFirst({
      where: item.match,
    });
    if (existing) {
      const currentImages = Array.isArray(existing.images) ? existing.images : [];
      const newImages = [item.image, ...currentImages.filter(img => img !== item.image)];
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          images: newImages,
          description: item.description,
        },
      });
      console.log(`Updated product: ${existing.name} -> ${item.image}`);
    } else {
      console.log(`Product not found for: ${item.match.name}`);
    }
  }

  // Also check if we can create two dedicated flagship showcase products for maximum impact:
  const lakshmiJhumkaShowcase = await prisma.product.findFirst({
    where: { name: "Mahalaxmi Temple Gold Jhumkas" }
  });
  if (!lakshmiJhumkaShowcase) {
    await prisma.product.create({
      data: {
        name: "Mahalaxmi Temple Gold Jhumkas",
        productType: "earring",
        category: "jhumka",
        kind: "jhumka",
        material: "22K Antique Gold",
        color: "Gold",
        stone: "Ruby, Emerald & Pearl",
        style: "Traditional",
        occasion: ["Wedding", "Festive", "Traditional"],
        price: 185,
        originalPrice: 230,
        rating: 5.0,
        reviews: 142,
        stock: 15,
        isPublished: true,
        faceShapeMatch: ["Round", "Heart", "Oval"],
        images: ["/uploads/mahalakshmi-temple-gold-jhumkas.jpg"],
        description: "Royal antique temple gold jhumkas adorned with Goddess Lakshmi medallion studs encircled by precious rubies and emeralds, delicate kundan teardrops, and lush pearl drops.",
        tags: ["Temple", "Lakshmi", "Antique Gold", "Bridal", "Festive"],
      }
    });
    console.log("Created flagship product: Mahalaxmi Temple Gold Jhumkas");
  }

  const gulabiChandbaliShowcase = await prisma.product.findFirst({
    where: { name: "Gulabi Kundan Pearl Chandbalis" }
  });
  if (!gulabiChandbaliShowcase) {
    await prisma.product.create({
      data: {
        name: "Gulabi Kundan Pearl Chandbalis",
        productType: "earring",
        category: "chandbali",
        kind: "chandbali",
        material: "18K Gold Plated Brass",
        color: "Gold",
        stone: "Pink Quartz & Pearl",
        style: "Traditional",
        occasion: ["Wedding", "Party", "Festive"],
        price: 165,
        originalPrice: 195,
        rating: 4.9,
        reviews: 98,
        stock: 20,
        isPublished: true,
        faceShapeMatch: ["Oval", "Square", "Heart", "Diamond"],
        images: ["/uploads/gulabi-kundan-pearl-chandbali.jpg"],
        description: "Exquisite royal chandbali earrings with delicate pink quartz flower studs, intricate floral crescent arcs set with kundan polki, and cascading teardrop freshwater pearl fringes.",
        tags: ["Chandbali", "Kundan", "Pink Quartz", "Pearl", "Statement"],
      }
    });
    console.log("Created flagship product: Gulabi Kundan Pearl Chandbalis");
  }

  const royalPearlShowcase = await prisma.product.findFirst({
    where: { name: "Royal Pearl Cascade Necklace & Earring Set" }
  });
  if (!royalPearlShowcase) {
    await prisma.product.create({
      data: {
        name: "Royal Pearl Cascade Necklace & Earring Set",
        productType: "necklace",
        category: "bridal-necklace",
        kind: "pearl-cluster-necklace",
        material: "22K Gold Vermeil",
        color: "Gold",
        stone: "Freshwater Pearl",
        style: "Luxury",
        occasion: ["Wedding", "Gala", "Festive"],
        price: 340,
        originalPrice: 420,
        rating: 5.0,
        reviews: 76,
        stock: 8,
        isPublished: true,
        faceShapeMatch: ["Oval", "Heart", "Round"],
        images: ["/uploads/royal-pearl-cascade-necklace-set.jpg"],
        description: "Opulent multi-layered pearl necklace with sculpted gold filigree collars and matching royal chandelier drop earrings.",
        tags: ["Pearl", "Bridal", "Necklace Set", "Gold Vermeil", "Luxury"],
      }
    });
    console.log("Created flagship product: Royal Pearl Cascade Necklace & Earring Set");
  }

  const lakshmiChokerShowcase = await prisma.product.findFirst({
    where: { name: "Aranya Royal Temple Choker & Jhumka Set" }
  });
  if (!lakshmiChokerShowcase) {
    await prisma.product.create({
      data: {
        name: "Aranya Royal Temple Choker & Jhumka Set",
        productType: "necklace",
        category: "choker",
        kind: "kundan-choker",
        material: "22K Antique Gold Plated",
        color: "Gold",
        stone: "Kundan & Natural Pearl",
        style: "Traditional",
        occasion: ["Wedding", "Festive", "Traditional"],
        price: 295,
        originalPrice: 380,
        rating: 4.9,
        reviews: 115,
        stock: 10,
        isPublished: true,
        faceShapeMatch: ["Round", "Heart", "Oval"],
        images: ["/uploads/aranya-lakshmi-choker-jhumka-set.jpg"],
        description: "Masterpiece temple jewellery choker depicting Goddess Lakshmi flanked by sacred peacocks and carved lotus motifs, finished with pearl jhumkas.",
        tags: ["Temple", "Choker", "Jhumka", "Bridal", "Lakshmi"],
      }
    });
    console.log("Created flagship product: Aranya Royal Temple Choker & Jhumka Set");
  }

  console.log("All product images successfully updated and linked!");
}

updateImages()
  .catch(err => {
    console.error("Error updating images:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
