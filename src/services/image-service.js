function buildCoverImage(images) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find(image => image.is_cover) || images[0];
}

module.exports = {
  buildCoverImage,
};
