function buildSeoPathParts(work) {
  return [
    work.categoria_slug,
    work.tipo_slug,
    work.citta,
    work.quartiere,
    work.slug,
  ].filter(Boolean);
}

module.exports = {
  buildSeoPathParts,
};
