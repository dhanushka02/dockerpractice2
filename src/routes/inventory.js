const express = require('express');
const db = require('../db');
const { asyncHandler, httpError } = require('../middleware/errors');

const router = express.Router();

router.get('/movements', asyncHandler(async (req, res) => {
  const productId = req.query.productId || null;
  const params = [];
  const where = [];

  if (productId) {
    params.push(productId);
    where.push(`im.product_id = $${params.length}`);
  }

  const { rows } = await db.query(
    `SELECT im.*, p.sku, p.name AS product_name
     FROM inventory_movements im
     JOIN products p ON p.id = im.product_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY im.created_at DESC
     LIMIT 100`,
    params
  );

  res.json(rows);
}));

router.post('/adjustments', asyncHandler(async (req, res) => {
  const productId = Number.parseInt(req.body.productId, 10);
  const quantityChange = Number.parseInt(req.body.quantityChange, 10);
  const movementType = req.body.movementType === 'restock' ? 'restock' : 'adjustment';
  const note = String(req.body.note || '').trim() || null;

  if (!Number.isInteger(productId)) throw httpError(400, 'Product is required');
  if (!Number.isInteger(quantityChange) || quantityChange === 0) throw httpError(400, 'Quantity change cannot be zero');

  const result = await db.transaction(async (client) => {
    const productResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
    const product = productResult.rows[0];
    if (!product) throw httpError(404, 'Product not found');

    const nextStock = Number(product.stock_quantity) + quantityChange;
    if (nextStock < 0) throw httpError(400, 'Stock cannot go below zero');

    const updated = await client.query(
      'UPDATE products SET stock_quantity = $1 WHERE id = $2 RETURNING *',
      [nextStock, productId]
    );
    const movement = await client.query(
      `INSERT INTO inventory_movements (product_id, movement_type, quantity_change, note)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [productId, movementType, quantityChange, note]
    );

    return { product: updated.rows[0], movement: movement.rows[0] };
  });

  res.status(201).json(result);
}));

module.exports = router;
