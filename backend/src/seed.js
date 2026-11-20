/**
 * Populates PostgreSQL with the same starter catalogue the old in-memory demo
 * shipped with. Safe to re-run — it wipes and re-inserts Category/Product only.
 *
 * NOTE (changed from the Mongo version): Postgres enforces referential
 * integrity, and cart items, wishlist items, product views, try-on sessions
 * and AI recommendations all cascade from Product. Re-seeding therefore also
 * clears those. Orders are deliberately untouched — order lines store a
 * product id snapshot with no foreign key, exactly so purchase history
 * survives a catalogue reset.
 *
 * Usage:  npm run seed
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { prisma, connectDB, disconnectDB } = require("./db/prisma");

const CATEGORIES = [
  { slug: "stud", name: "Stud Earrings", productType: "earrings" },
  { slug: "hoop", name: "Hoops", productType: "earrings" },
  { slug: "drop", name: "Drop Earrings", productType: "earrings" },
  { slug: "jhumka", name: "Jhumka", productType: "earrings" },
  { slug: "chandbali", name: "Chandbali", productType: "earrings" },
  { slug: "huggie", name: "Huggies", productType: "earrings" },
  { slug: "statement", name: "Statement Earrings", productType: "earrings" },
  { slug: "pearl", name: "Pearl Earrings", productType: "earrings" },
  { slug: "bridal", name: "Bridal Earrings", productType: "earrings" },
  { slug: "minimal", name: "Minimal Earrings", productType: "earrings" },

  // --- Necklaces ---
  { slug: "chain-necklace", name: "Chain Necklaces", productType: "necklace" },
  { slug: "pendant-necklace", name: "Pendant Necklaces", productType: "necklace" },
  { slug: "choker", name: "Chokers", productType: "necklace" },
  { slug: "layered-necklace", name: "Layered Necklaces", productType: "necklace" },
  { slug: "bridal-necklace", name: "Bridal Necklaces", productType: "necklace" },

  // --- Bracelets ---
  { slug: "bangle", name: "Bangles", productType: "bracelet" },
  { slug: "cuff-bracelet", name: "Cuffs", productType: "bracelet" },
  { slug: "chain-bracelet", name: "Chain Bracelets", productType: "bracelet" },
  { slug: "charm-bracelet", name: "Charm Bracelets", productType: "bracelet" },

  // --- Rings ---
  { slug: "band-ring", name: "Bands", productType: "ring" },
  { slug: "stackable-ring", name: "Stackable Rings", productType: "ring" },
  { slug: "statement-ring", name: "Statement Rings", productType: "ring" },
  { slug: "cocktail-ring", name: "Cocktail Rings", productType: "ring" },

  // --- Anklets ---
  { slug: "chain-anklet", name: "Chain Anklets", productType: "anklet" },
  { slug: "beaded-anklet", name: "Beaded Anklets", productType: "anklet" },
  { slug: "charm-anklet", name: "Charm Anklets", productType: "anklet" },
];

const PRODUCTS = [
  { name: "Solstice Pearl Drops", category: "drop", material: "Gold Vermeil", color: "Gold", stone: "Freshwater Pearl", style: "Elegant", occasion: ["Wedding", "Party", "Date"], price: 128, originalPrice: 160, rating: 4.8, reviews: 342, kind: "pearl-drop", faceShapeMatch: ["Oval", "Round", "Diamond"], description: "An elongated pearl suspended from a polished gold bezel." },
  { name: "Meridian Hoops", category: "hoop", material: "Sterling Silver", color: "Silver", style: "Minimal", occasion: ["Everyday", "Office", "Casual"], price: 64, rating: 4.6, reviews: 501, kind: "hoop", faceShapeMatch: ["Square", "Heart", "Long"], description: "A clean, medium-weight hoop with a hairline profile." },
  { name: "Aranya Jhumka", category: "jhumka", material: "22K Gold Plated", color: "Gold", stone: "Kundan", style: "Traditional", occasion: ["Festive", "Wedding", "Traditional"], price: 96, originalPrice: 120, rating: 4.9, reviews: 218, kind: "jhumka", faceShapeMatch: ["Round", "Heart", "Oval"], description: "A hand-finished bell silhouette in kundan-set gold." },
  { name: "Nawab Chandbali", category: "chandbali", material: "Gold Plated Brass", color: "Gold", stone: "Ruby Glass", style: "Traditional", occasion: ["Wedding", "Festive"], price: 142, rating: 4.7, reviews: 156, kind: "chandbali", faceShapeMatch: ["Oval", "Square", "Heart"], description: "The crescent chandbali with a slimmer arc and ruby-glass accents." },
  { name: "Featherline Huggies", category: "huggie", material: "14K Gold", color: "Gold", style: "Minimal", occasion: ["Everyday", "Office"], price: 58, rating: 4.5, reviews: 410, kind: "huggie", faceShapeMatch: ["Long", "Diamond", "Oval"], description: "A snug, close-set hoop for daily wear." },
  { name: "Cascade Crystal Drops", category: "drop", material: "Rhodium Plated", color: "Silver", stone: "Cubic Zirconia", style: "Bold", occasion: ["Party", "Date"], price: 118, rating: 4.6, reviews: 189, kind: "chandelier", faceShapeMatch: ["Round", "Square", "Heart"], description: "Graduated crystal tiers that catch the light." },
  { name: "Petit Pearl Studs", category: "stud", material: "Sterling Silver", color: "Silver", stone: "Pearl", style: "Minimal", occasion: ["Everyday", "Office"], price: 42, rating: 4.7, reviews: 623, kind: "pearl-stud", faceShapeMatch: ["Square", "Diamond", "Long"], description: "A single round pearl on a brushed silver post." },
  { name: "Aurora Statement Fan", category: "statement", material: "Gold Plated Brass", color: "Gold", stone: "Mixed Crystal", style: "Bold", occasion: ["Party", "Wedding"], price: 168, originalPrice: 210, rating: 4.4, reviews: 97, kind: "fan", faceShapeMatch: ["Oval", "Long"], description: "An architectural fan silhouette." },
  { name: "Bloom Rose Gold Studs", category: "stud", material: "Rose Gold Plated", color: "Rose Gold", style: "Cute", occasion: ["Everyday", "Casual"], price: 38, rating: 4.6, reviews: 288, kind: "flower-stud", faceShapeMatch: ["Round", "Heart", "Diamond"], description: "A soft floral stud in warm rose gold." },
  { name: "Vesper Diamond Drops", category: "drop", material: "18K White Gold", color: "Diamond", stone: "Diamond, 0.4ct tw", style: "Luxury", occasion: ["Wedding", "Party"], price: 890, rating: 5.0, reviews: 41, kind: "diamond-drop", faceShapeMatch: ["Oval", "Diamond", "Square"], description: "Two brilliant-cut diamonds in a vertical line." },
  { name: "Ivory Pearl Chandelier", category: "bridal", material: "Gold Vermeil", color: "Pearl", stone: "Pearl Cluster", style: "Elegant", occasion: ["Wedding"], price: 210, rating: 4.9, reviews: 74, kind: "pearl-chandelier", faceShapeMatch: ["Oval", "Heart", "Round"], description: "Layered pearl clusters designed to catch candlelight." },
  { name: "Linea Minimal Bar Studs", category: "minimal", material: "Sterling Silver", color: "Silver", style: "Modern", occasion: ["Office", "Everyday"], price: 34, rating: 4.5, reviews: 355, kind: "bar-stud", faceShapeMatch: ["Round", "Square"], description: "A single brushed bar, set on the diagonal." },
  { name: "Zafira Vintage Drops", category: "drop", material: "Antique Gold", color: "Gold", stone: "Emerald Glass", style: "Vintage", occasion: ["Festive", "Traditional"], price: 88, rating: 4.6, reviews: 132, kind: "vintage-drop", faceShapeMatch: ["Oval", "Long", "Diamond"], description: "Filigree work and a deep emerald drop." },
  { name: "Sundown Gold Hoops", category: "hoop", material: "18K Gold Plated", color: "Gold", style: "Bold", occasion: ["Party", "Casual"], price: 76, rating: 4.4, reviews: 209, kind: "hoop-large", faceShapeMatch: ["Square", "Heart", "Long"], description: "A generous, high-polish hoop that moves with you." },
  { name: "Opaline Studs", category: "stud", material: "Sterling Silver", color: "Silver", stone: "Opal", style: "Elegant", occasion: ["Everyday", "Date"], price: 54, rating: 4.7, reviews: 176, kind: "opal-stud", faceShapeMatch: ["Diamond", "Oval"], description: "A soft-fire opal set low in a silver bezel." },
  { name: "Bardot Pearl Huggies", category: "huggie", material: "Gold Plated", color: "Pearl", stone: "Seed Pearl", style: "Cute", occasion: ["Everyday", "Casual"], price: 48, rating: 4.5, reviews: 264, kind: "pearl-huggie", faceShapeMatch: ["Round", "Heart"], description: "Tiny seed pearls set along a slim gold huggie hoop." },
  { name: "Marbella Chandbali", category: "chandbali", material: "Oxidised Silver", color: "Silver", stone: "Turquoise", style: "Traditional", occasion: ["Traditional", "Festive"], price: 104, rating: 4.6, reviews: 88, kind: "chandbali-silver", faceShapeMatch: ["Oval", "Square"], description: "Oxidised silver set with raw-cut turquoise." },
  { name: "Noir Statement Drops", category: "statement", material: "Black Rhodium", color: "Silver", stone: "Black Onyx", style: "Bold", occasion: ["Party", "Date"], price: 134, rating: 4.3, reviews: 61, kind: "onyx-drop", faceShapeMatch: ["Long", "Oval"], description: "Matte onyx discs on a blackened chain." },
  { name: "First Light Diamond Studs", category: "stud", material: "14K White Gold", color: "Diamond", stone: "Diamond, 0.2ct tw", style: "Luxury", occasion: ["Everyday", "Office", "Wedding"], price: 420, rating: 4.9, reviews: 152, kind: "diamond-stud", faceShapeMatch: ["Round", "Square", "Heart", "Long", "Diamond", "Oval"], description: "The four-prong diamond stud every jewellery box needs." },
  { name: "Rosalind Bridal Drops", category: "bridal", material: "Rose Gold Plated", color: "Rose Gold", stone: "Cubic Zirconia", style: "Luxury", occasion: ["Wedding"], price: 176, rating: 4.8, reviews: 66, kind: "bridal-drop", faceShapeMatch: ["Oval", "Heart", "Round"], description: "A tapered line of pavé stones with a rose-gold drop." },
  { name: "Etta Everyday Huggies", category: "huggie", material: "Sterling Silver", color: "Silver", style: "Minimal", occasion: ["Everyday", "Office", "Casual"], price: 36, rating: 4.6, reviews: 512, kind: "huggie-small", faceShapeMatch: ["Long", "Diamond", "Square"], description: "A featherweight huggie for ears that are never without one." },

  // --- Necklaces --- (faceShapeMatch populated: worn near the face, same as earrings)
  { name: "Solstice Pearl Pendant", productType: "necklace", category: "pendant-necklace", material: "Gold Vermeil", color: "Gold", stone: "Freshwater Pearl", style: "Elegant", occasion: ["Wedding", "Party", "Date"], price: 96, originalPrice: 120, rating: 4.7, reviews: 214, kind: "pearl-pendant", faceShapeMatch: ["Oval", "Round", "Diamond"], description: "A single pearl drop on a fine gold chain — the necklace companion to our Solstice earrings.", dimensions: "45cm chain, 1.2cm pendant", weight: "4.8g" },
  { name: "Meridian Chain", productType: "necklace", category: "chain-necklace", material: "Sterling Silver", color: "Silver", style: "Minimal", occasion: ["Everyday", "Office", "Casual"], price: 58, rating: 4.6, reviews: 388, kind: "curb-chain", faceShapeMatch: ["Square", "Heart", "Long"], description: "A polished curb chain sized to layer or wear alone.", dimensions: "50cm", weight: "6.2g" },
  { name: "Aranya Kundan Choker", productType: "necklace", category: "choker", material: "22K Gold Plated", color: "Gold", stone: "Kundan", style: "Traditional", occasion: ["Festive", "Wedding", "Traditional"], price: 168, originalPrice: 210, rating: 4.9, reviews: 142, kind: "kundan-choker", faceShapeMatch: ["Round", "Heart", "Oval"], description: "A hand-set kundan choker that pairs with our Aranya jhumkas.", dimensions: "36cm adjustable", weight: "38g" },
  { name: "Cascade Layered Necklace", productType: "necklace", category: "layered-necklace", material: "Rhodium Plated", color: "Silver", stone: "Cubic Zirconia", style: "Bold", occasion: ["Party", "Date"], price: 84, rating: 4.4, reviews: 96, kind: "layered-cz", faceShapeMatch: ["Round", "Square", "Heart"], description: "Three graduated chains, each finished with a small crystal charm.", dimensions: "38-45cm layered", weight: "9.1g" },
  { name: "Ivory Pearl Bridal Necklace", productType: "necklace", category: "bridal-necklace", material: "Gold Vermeil", color: "Pearl", stone: "Pearl Cluster", style: "Elegant", occasion: ["Wedding"], price: 260, rating: 4.9, reviews: 58, kind: "pearl-cluster-necklace", faceShapeMatch: ["Oval", "Heart", "Round"], description: "Layered pearl clusters matching the Ivory Pearl Chandelier earrings, built for bridal photos.", dimensions: "40cm + 5cm extender", weight: "22g" },
  { name: "Linea Bar Necklace", productType: "necklace", category: "chain-necklace", material: "Sterling Silver", color: "Silver", style: "Modern", occasion: ["Office", "Everyday"], price: 46, rating: 4.5, reviews: 201, kind: "bar-pendant", faceShapeMatch: ["Round", "Square"], description: "A single brushed bar pendant, the necklace match to our Linea studs.", dimensions: "42cm + 3cm extender", weight: "3.9g" },

  // --- Bracelets --- (worn on the wrist — faceShapeMatch intentionally left empty)
  { name: "Featherline Bangle", productType: "bracelet", category: "bangle", material: "14K Gold", color: "Gold", style: "Minimal", occasion: ["Everyday", "Office"], price: 72, rating: 4.5, reviews: 267, kind: "slim-bangle", description: "A slim, close-fit bangle — the bracelet match to our Featherline huggies.", dimensions: "6cm diameter", weight: "8.4g" },
  { name: "Sundown Cuff", productType: "bracelet", category: "cuff-bracelet", material: "18K Gold Plated", color: "Gold", style: "Bold", occasion: ["Party", "Casual"], price: 68, rating: 4.4, reviews: 133, kind: "open-cuff", description: "An open, high-polish cuff that adjusts to fit.", dimensions: "adjustable, 5.5-6.5cm", weight: "14.2g" },
  { name: "Meridian Chain Bracelet", productType: "bracelet", category: "chain-bracelet", material: "Sterling Silver", color: "Silver", style: "Minimal", occasion: ["Everyday", "Office", "Casual"], price: 44, rating: 4.6, reviews: 302, kind: "curb-chain-bracelet", description: "The bracelet match to our Meridian chain necklace.", dimensions: "17cm + 2cm extender", weight: "5.1g" },
  { name: "Bloom Charm Bracelet", productType: "bracelet", category: "charm-bracelet", material: "Rose Gold Plated", color: "Rose Gold", style: "Cute", occasion: ["Everyday", "Casual"], price: 52, rating: 4.6, reviews: 178, kind: "flower-charm", description: "A delicate chain with a single rose-gold flower charm, matching our Bloom studs.", dimensions: "16cm + 3cm extender", weight: "4.6g" },
  { name: "Aranya Kundan Bangle", productType: "bracelet", category: "bangle", material: "22K Gold Plated", color: "Gold", stone: "Kundan", style: "Traditional", occasion: ["Festive", "Wedding", "Traditional"], price: 118, rating: 4.8, reviews: 91, kind: "kundan-bangle", description: "A kundan-set bangle designed to pair with the Aranya jhumka and choker set.", dimensions: "6.4cm diameter", weight: "24g" },

  // --- Rings ---
  { name: "Linea Band Ring", productType: "ring", category: "band-ring", material: "Sterling Silver", color: "Silver", style: "Minimal", occasion: ["Everyday", "Office"], price: 32, rating: 4.5, reviews: 245, kind: "plain-band", description: "A brushed, low-profile band — sized to stack or wear alone.", dimensions: "2mm band width", weight: "1.8g" },
  { name: "First Light Diamond Band", productType: "ring", category: "band-ring", material: "14K White Gold", color: "Diamond", stone: "Diamond, 0.15ct tw", style: "Luxury", occasion: ["Everyday", "Wedding"], price: 380, rating: 4.9, reviews: 87, kind: "diamond-band", description: "A pavé diamond band, the ring companion to our First Light studs.", dimensions: "2.5mm band width", weight: "2.2g" },
  { name: "Cascade Stackable Set", productType: "ring", category: "stackable-ring", material: "Rhodium Plated", color: "Silver", stone: "Cubic Zirconia", style: "Bold", occasion: ["Party", "Date"], price: 58, rating: 4.4, reviews: 112, kind: "stackable-trio", description: "Three slim rings, sold as a set, each set with a single crystal.", dimensions: "1.5mm each, sold as 3", weight: "3.4g total" },
  { name: "Aurora Statement Ring", productType: "ring", category: "statement-ring", material: "Gold Plated Brass", color: "Gold", stone: "Mixed Crystal", style: "Bold", occasion: ["Party", "Wedding"], price: 94, rating: 4.3, reviews: 54, kind: "fan-ring", description: "An architectural fan silhouette, matching the Aurora Statement Fan earrings.", dimensions: "2.1cm face width", weight: "6.8g" },
  { name: "Noir Onyx Cocktail Ring", productType: "ring", category: "cocktail-ring", material: "Black Rhodium", color: "Silver", stone: "Black Onyx", style: "Bold", occasion: ["Party", "Date"], price: 76, rating: 4.3, reviews: 48, kind: "onyx-cocktail", description: "A matte onyx disc set in blackened silver, matching the Noir Statement Drops.", dimensions: "1.8cm face diameter", weight: "5.9g" },

  // --- Anklets ---
  { name: "Meridian Chain Anklet", productType: "anklet", category: "chain-anklet", material: "Sterling Silver", color: "Silver", style: "Minimal", occasion: ["Everyday", "Casual"], price: 38, rating: 4.5, reviews: 156, kind: "curb-chain-anklet", description: "A slim curb chain anklet, matching the Meridian jewelry set.", dimensions: "24cm + 3cm extender", weight: "3.2g" },
  { name: "Bardot Seed Pearl Anklet", productType: "anklet", category: "beaded-anklet", material: "Gold Plated", color: "Pearl", stone: "Seed Pearl", style: "Cute", occasion: ["Everyday", "Casual"], price: 34, rating: 4.5, reviews: 98, kind: "pearl-beaded", description: "Tiny seed pearls strung along a slim gold chain, matching the Bardot Pearl Huggies.", dimensions: "23cm + 2cm extender", weight: "2.9g" },
  { name: "Bloom Charm Anklet", productType: "anklet", category: "charm-anklet", material: "Rose Gold Plated", color: "Rose Gold", style: "Cute", occasion: ["Everyday", "Casual"], price: 36, rating: 4.4, reviews: 71, kind: "flower-charm-anklet", description: "A single rose-gold flower charm on a fine chain, completing the Bloom set.", dimensions: "22cm + 3cm extender", weight: "2.6g" },
];

async function seed() {
  await connectDB();

  await prisma.$transaction([
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.category.createMany({ data: CATEGORIES }),
    prisma.product.createMany({ data: PRODUCTS }),
  ]);

  console.log(`Seeded ${CATEGORIES.length} categories and ${PRODUCTS.length} products.`);

  // Bootstrap SUPER_ADMIN — deliberately NOT part of the product/category
  // reset above (and not wiped on re-seed): real user accounts and role
  // assignments must survive a catalogue reset. Idempotent via upsert, so
  // running `npm run seed` repeatedly never creates duplicates or errors if
  // the account already exists.
  //
  // Without this, RBAC would be unreachable on a fresh install — every
  // role-management route requires an existing SUPER_ADMIN to call it, so
  // there'd be no way to ever create the first one.
  const email = process.env.SEED_SUPER_ADMIN_EMAIL || "admin@aurelie.local";
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD || "change-me-immediately";
  await prisma.user.upsert({
    where: { email },
    create: { name: "Aurélie Admin", email, passwordHash: await bcrypt.hash(password, 10), role: "SUPER_ADMIN" },
    update: {}, // never overwrite an existing account's password/role on re-seed
  });
  console.log(`\nSUPER_ADMIN account ready: ${email}`);
  if (!process.env.SEED_SUPER_ADMIN_PASSWORD) {
    console.log("Using the default password — set SEED_SUPER_ADMIN_EMAIL and");
    console.log("SEED_SUPER_ADMIN_PASSWORD in .env before deploying anywhere real,");
    console.log("or log in and note this is a placeholder credential to rotate.");
  }

  await disconnectDB();
  process.exit(0);
}

seed().catch(async err => {
  console.error(err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
