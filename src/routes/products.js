const express = require('express');
const db = require('../db');
const { asyncHandler, httpError } = require('../middleware/errors');

const router = express.Router();

function parseProduct(body) {
  const product = {
    sku: String(body.sku || '').trim(),
    name: String(body.name || '').trim(),
    categoryId: body.categoryId || null,
    price: Number(body.price),
    cost: Number(body.cost || 0),
    stockQuantity: Number.parseInt(body.stockQuantity || 0, 10),
    lowStockThreshold: Number.parseInt(body.lowStockThreshold || 0, 10),
    isActive: body.isActive !== false
  };

  if (!product.sku) throw httpError(400, 'SKU is required');
  if (!product.name) throw httpError(400, 'Product name is required');
  if (!Number.isFinite(product.price) || product.price < 0) throw httpError(400, 'Valid price is required');
  if (!Number.isFinite(product.cost) || product.cost < 0) throw httpError(400, 'Valid cost is required');
  if (!Number.isInteger(product.stockQuantity) || product.stockQuantity < 0) throw httpError(400, 'Stock quantity must be zero or more');
  if (!Number.isInteger(product.lowStockThreshold) || product.lowStockThreshold < 0) throw httpError(400, 'Low stock threshold must be zero or more');

  return product;
}

router.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const activeOnly = req.query.activeOnly !== 'false';

  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
  }

  if (activeOnly) {
    where.push('p.is_active = TRUE');
  }

  const sql = `
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY p.name
  `;

  const { rows } = await db.query(sql, params);
  res.json(rows);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw httpError(404, 'Product not found');
  res.json(rows[0]);
}));

router.post('/', asyncHandler(async (req, res) => {
  const product = parseProduct(req.body);
  const { rows } = await db.query(
    `INSERT INTO products
      (sku, name, category_id, price, cost, stock_quantity, low_stock_threshold, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      product.sku,
      product.name,
      product.categoryId,
      product.price,
      product.cost,
      product.stockQuantity,
      product.lowStockThreshold,
      product.isActive
    ]
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const product = parseProduct(req.body);
  const { rows } = await db.query(
    `UPDATE products
     SET sku = $1,
         name = $2,
         category_id = $3,
         price = $4,
         cost = $5,
         stock_quantity = $6,
         low_stock_threshold = $7,
         is_active = $8
     WHERE id = $9
     RETURNING *`,
    [
      product.sku,
      product.name,
      product.categoryId,
      product.price,
      product.cost,
      product.stockQuantity,
      product.lowStockThreshold,
      product.isActive,
      req.params.id
    ]
  );
  if (!rows[0]) throw httpError(404, 'Product not found');
  res.json(rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'UPDATE products SET is_active = FALSE WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  if (!rows[0]) throw httpError(404, 'Product not found');
  res.json(rows[0]);
}));

module.exports = router;
