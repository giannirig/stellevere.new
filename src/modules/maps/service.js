function buildMapQuery(filters) {
  return {
    categoria: filters.categoria || '',
    intervento: filters.intervento || '',
    citta: filters.citta || '',
    quartiere: filters.quartiere || '',
  };
}

module.exports = {
  buildMapQuery,
};
