const router = require("express").Router();
const { getImage } = require("../services/imageService");
const ah = require("../utils/asyncHandler");

router.get("/:key", ah(async (req, res) => {
  const { key } = req.params;
  const image = await getImage(key);

  if (!image) {
    return res.status(404).json({ error: "Image not found" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Content-Type", image.mime);
  res.setHeader("Content-Length", image.size);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(image.buffer);
}));

module.exports = router;
