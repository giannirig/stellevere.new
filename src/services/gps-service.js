function buildGpsCheck({ declaredPoint, imagePoints }) {
  if (!declaredPoint || !Array.isArray(imagePoints) || !imagePoints.length) {
    return { status: 'no_exif', matches: true };
  }

  const mismatch = imagePoints.some(point => {
    const latDiff = Math.abs(Number(point.lat) - Number(declaredPoint.lat));
    const lngDiff = Math.abs(Number(point.lng) - Number(declaredPoint.lng));
    return latDiff > 0.01 || lngDiff > 0.01;
  });

  return {
    status: mismatch ? 'mismatch' : 'ok',
    matches: !mismatch,
  };
}

module.exports = {
  buildGpsCheck,
};
