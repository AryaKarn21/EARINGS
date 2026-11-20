/**
 * Phase 2 — natural-language query parsing for search.
 *
 * This is NOT an LLM call and NOT embeddings — it's deterministic keyword/
 * pattern matching against the real vocabulary actually used in the
 * catalogue (pulled from seed.js's color/style/occasion values, not
 * guessed). That's a deliberate choice, not a shortcut: it's free, has no
 * external dependency, runs in under a millisecond, and — most importantly
 * — its behaviour is fully predictable and testable, which a hosted NL
 * model's wouldn't be for a v1. The extraction feeds into a genuine
 * Postgres full-text search for anything it doesn't recognise (see
 * routes/products.js), it doesn't replace it.
 *
 * WHERE EMBEDDINGS WOULD SLOT IN LATER (not built now — no vector DB is
 * provisioned, and adding one is a real infra decision, not a code change
 * to sneak in here): this module's `parseQuery()` would stay as the first
 * pass for hard attribute filters (price, explicit color/material/occasion
 * words are unambiguous and cheap to extract this way), and `remainingText`
 * — what's left after known attributes are stripped — is exactly the input
 * you'd embed and run through a vector similarity search instead of
 * Postgres ts_rank, for queries where meaning matters more than keywords
 * ("something that goes with a green saree" has no literal keyword match
 * today but would embed well). The interface (parseQuery returns
 * {filters, remainingText}) is designed so that swap only touches
 * routes/products.js, not this file.
 */

// Pulled from what's actually in seed.js — not a guessed list. If you add a
// new color/style/occasion to the catalogue, add the matching phrase here
// too, or it'll just fall through to full-text search on the raw word
// (which still works, just without the structured filter).
const COLOR_PHRASES = {
  gold: "Gold",
  "rose gold": "Rose Gold",
  silver: "Silver",
  diamond: "Diamond",
  pearl: "Pearl",
};

const STYLE_PHRASES = {
  bold: "Bold",
  statement: "Bold",
  cute: "Cute",
  elegant: "Elegant",
  luxury: "Luxury",
  luxurious: "Luxury",
  minimal: "Minimal",
  minimalist: "Minimal",
  modern: "Modern",
  traditional: "Traditional",
  vintage: "Vintage",
};

const OCCASION_PHRASES = {
  casual: "Casual",
  date: "Date",
  everyday: "Everyday",
  daily: "Everyday",
  festive: "Festive",
  festival: "Festive",
  office: "Office",
  work: "Office",
  party: "Party",
  wedding: "Wedding",
  bridal: "Wedding",
};

const PRODUCT_TYPE_PHRASES = {
  earring: "earrings",
  earrings: "earrings",
  necklace: "necklace",
  necklaces: "necklace",
  bracelet: "bracelet",
  bracelets: "bracelet",
  ring: "ring",
  rings: "ring",
  anklet: "anklet",
  anklets: "anklet",
};

// Category slugs that are also plain English words worth recognising in a
// query. Not every category slug is included — only ones a shopper would
// plausibly type ("hoop earrings", not "huggie earrings" as often).
const CATEGORY_PHRASES = {
  hoop: "hoop",
  hoops: "hoop",
  stud: "stud",
  studs: "stud",
  jhumka: "jhumka",
  jhumkas: "jhumka",
  chandbali: "chandbali",
  huggie: "huggie",
  huggies: "huggie",
  choker: "choker",
  chokers: "choker",
  pendant: "pendant-necklace",
  bangle: "bangle",
  bangles: "bangle",
  cuff: "cuff-bracelet",
  band: "band-ring",
  cocktail: "cocktail-ring",
  stackable: "stackable-ring",
  chain: "chain-necklace",
};

// "round face", "oval face" etc. — deliberately requires the word "face"
// nearby so a query like "diamond earrings" doesn't get misread as a face
// shape (diamond is also a stone/color). Order matters: longer phrases like
// "diamond-shaped face" are matched before the bare "diamond" fallback.
const FACE_SHAPE_PATTERN = /\b(oval|round|square|heart|long|diamond)[\s-]*(?:shaped|shape)?\s+face\b/i;
const FACE_SHAPE_MAP = { oval: "Oval", round: "Round", square: "Square", heart: "Heart", long: "Long", diamond: "Diamond" };

// "under $50", "below 50", "less than $50", "over $100", "above 100",
// "$20-$40", "$20 to $40", "between $20 and $40".
const PRICE_UNDER = /\b(?:under|below|less than|cheaper than|up to)\s*\$?\s*(\d+(?:\.\d+)?)/i;
const PRICE_OVER = /\b(?:over|above|more than)\s*\$?\s*(\d+(?:\.\d+)?)/i;
const PRICE_RANGE = /\$?\s*(\d+(?:\.\d+)?)\s*(?:-|to)\s*\$?\s*(\d+(?:\.\d+)?)/i;
const PRICE_BETWEEN = /\bbetween\s*\$?\s*(\d+(?:\.\d+)?)\s*and\s*\$?\s*(\d+(?:\.\d+)?)/i;

/**
 * Removes a matched phrase from the working text so it doesn't also get
 * passed into full-text search as a literal term (mostly harmless if it
 * did — ts_rank would just find no match for it and contribute nothing —
 * but cleaner remainingText makes the parse easier to unit test and debug).
 */
function strip(text, phrase) {
  return text.replace(new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
}

function matchPhraseMap(text, map) {
  // Longest phrase first so "rose gold" matches before the bare "gold".
  const phrases = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    if (new RegExp(`\\b${phrase}\\b`, "i").test(text)) {
      return { value: map[phrase], remaining: strip(text, phrase) };
    }
  }
  return { value: null, remaining: text };
}

/**
 * @param {string} q raw search query, e.g. "gold earrings for wedding under $50"
 * @returns {{ filters: object, remainingText: string, extracted: object }}
 *   filters: ready to merge into the Prisma `where` clause in routes/products.js
 *   remainingText: what's left for full-text ranking after known attributes are removed
 *   extracted: same data as filters, but labelled for debugging/transparency
 *   (e.g. a "why these results" UI, or just for testing this module directly)
 */
function parseQuery(q) {
  let text = ` ${String(q || "").trim()} `;
  const filters = {};
  const extracted = {};

  // Price — check range/between before single-sided under/over, since
  // "between $20 and $50" would otherwise partially match "over"-style
  // patterns on the word "and".
  let priceMatch = text.match(PRICE_BETWEEN) || text.match(PRICE_RANGE);
  if (priceMatch) {
    filters.minPrice = Number(priceMatch[1]);
    filters.maxPrice = Number(priceMatch[2]);
    extracted.priceRange = [filters.minPrice, filters.maxPrice];
    text = text.replace(priceMatch[0], " ");
  } else {
    const under = text.match(PRICE_UNDER);
    if (under) {
      filters.maxPrice = Number(under[1]);
      extracted.priceMax = filters.maxPrice;
      text = text.replace(under[0], " ");
    }
    const over = text.match(PRICE_OVER);
    if (over) {
      filters.minPrice = Number(over[1]);
      extracted.priceMin = filters.minPrice;
      text = text.replace(over[0], " ");
    }
  }

  // Face shape — before color, so "diamond face" is read as a face shape,
  // not a color, on this pass (color matching happens after on what's left).
  const faceMatch = text.match(FACE_SHAPE_PATTERN);
  if (faceMatch) {
    filters.faceShape = FACE_SHAPE_MAP[faceMatch[1].toLowerCase()];
    extracted.faceShape = filters.faceShape;
    text = text.replace(faceMatch[0], " ");
  }

  const color = matchPhraseMap(text, COLOR_PHRASES);
  if (color.value) { filters.color = color.value; extracted.color = color.value; text = color.remaining; }

  const style = matchPhraseMap(text, STYLE_PHRASES);
  if (style.value) { filters.style = style.value; extracted.style = style.value; text = style.remaining; }

  const occasion = matchPhraseMap(text, OCCASION_PHRASES);
  if (occasion.value) { filters.occasion = occasion.value; extracted.occasion = occasion.value; text = occasion.remaining; }

  const productType = matchPhraseMap(text, PRODUCT_TYPE_PHRASES);
  if (productType.value) { filters.productType = productType.value; extracted.productType = productType.value; text = productType.remaining; }

  const category = matchPhraseMap(text, CATEGORY_PHRASES);
  if (category.value) { filters.category = category.value; extracted.category = category.value; text = category.remaining; }

  // Common connector words left over after attribute phrases are stripped —
  // harmless to leave in for ts_rank (they're stopwords to Postgres's
  // english config anyway), stripped here mainly so remainingText reads
  // cleanly for debugging/tests.
  const remainingText = text.replace(/\b(for|with|in|a|an|the|and|to)\b/gi, " ").replace(/\s+/g, " ").trim();

  return { filters, remainingText, extracted };
}

// A tiny, explicit thesaurus — NOT semantic similarity. This exists because
// "lightweight" (a word shoppers actually type, per the spec's own example
// query) doesn't literally appear in any product description; "featherweight"
// does. Without this, ts_rank would find zero full-text matches for
// "lightweight earrings for everyday use" even though several products are
// honestly a good match for that intent. This only ever expands
// remainingText before it goes into the full-text query (see
// buildTsQuery below) — it never invents a structured filter, and it's
// small and hand-curated on purpose so its behaviour stays predictable.
const SYNONYM_EXPANSIONS = {
  lightweight: ["featherweight", "light", "delicate", "slim"],
  light: ["featherweight", "lightweight", "delicate"],
  heavy: ["statement", "chunky", "bold"],
  chunky: ["statement", "bold", "heavy"],
  delicate: ["featherweight", "light", "minimal", "slim"],
  simple: ["minimal", "plain"],
  everyday: ["daily", "casual"],
};

/**
 * Turns leftover free text into a Postgres tsquery string, expanding known
 * synonyms into OR groups. Tokens are OR'd together (not AND'd) — remaining
 * text after structured-attribute extraction is often a mix of a real
 * descriptive word and filler ("lightweight ... use", "... outfit"), and
 * requiring every leftover token to match would zero out an otherwise good
 * result over a single filler word. ts_rank naturally ranks a product
 * matching more terms higher than one matching only one, so OR here doesn't
 * lose that signal — it just stops filler words from being able to exclude
 * a match outright.
 *
 * Tokens are restricted to alphanumerics before being interpolated into raw
 * SQL — this runs through $queryRawUnsafe in routes/products.js, so
 * anything that isn't a plain word is dropped rather than risk building an
 * invalid or unsafe tsquery string.
 */
function buildTsQuery(remainingText) {
  const tokens = remainingText
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  if (!tokens.length) return null;

  const groups = tokens.map(token => {
    const synonyms = SYNONYM_EXPANSIONS[token];
    return synonyms ? `(${[token, ...synonyms].join(" | ")})` : token;
  });
  return groups.join(" | ");
}

module.exports = { parseQuery, buildTsQuery, COLOR_PHRASES, STYLE_PHRASES, OCCASION_PHRASES, PRODUCT_TYPE_PHRASES, CATEGORY_PHRASES, FACE_SHAPE_MAP, SYNONYM_EXPANSIONS };
