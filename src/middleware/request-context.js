function attachRequestContext(appContext) {
  return (req, res, next) => {
    req.appContext = appContext;
    res.locals.appName = 'StelleVere V2';
    next();
  };
}

module.exports = {
  attachRequestContext,
};
