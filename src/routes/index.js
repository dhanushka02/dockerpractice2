const express = require('express');

const categories = require('./categories');
const customers = require('./customers');
const inventory = require('./inventory');
const products = require('./products');
const reports = require('./reports');
const sales = require('./sales');
const { asyncHandler } = require('../middleware/errors');
const config = require('../config');
const db = require('../db');

const router = express.Router();

router.get('/health', asyncHandler(async (req, res) => {
  await db.query('SELECT 1');
  res.json({ status: 'ok' });
}));

router.get('/settings', (req, res) => {
  res.json({ taxRate: config.taxRate });
});

router.use('/categories', categories);
router.use('/customers', customers);
router.use('/inventory', inventory);
router.use('/products', products);
router.use('/reports', reports);
router.use('/sales', sales);

module.exports = router;
