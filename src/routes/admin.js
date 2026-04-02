const express = require('express');
const { getAdminModules } = require('../modules/admin/service');

function createAdminRouter() {
  const router = express.Router();

  router.get('/admin', (req, res) => {
    res.render('admin/index', {
      modules: getAdminModules(),
    });
  });

  return router;
}

module.exports = {
  createAdminRouter,
};
