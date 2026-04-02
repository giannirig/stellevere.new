function computeAverageRating(reviews) {
  if (!Array.isArray(reviews) || !reviews.length) return 0;
  const total = reviews.reduce((sum, review) => sum + (Number(review.voto) || 0), 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

module.exports = {
  computeAverageRating,
};
