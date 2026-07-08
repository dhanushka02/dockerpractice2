const express = require('express');
const db = require('../db');
const { asyncHandler, httpError } = require('../middleware/errors');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM categories ORDER BY name');
  res.json(rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw httpError(400, 'Category name is required');

  const { rows } = await db.query(
    'INSERT INTO categories (name) VALUES ($1) RETURNING *',
    [name]
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw httpError(400, 'Category name is required');

  const { rows } = await db.query(
    'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *',
    [name, req.params.id]
  );
  if (!rows[0]) throw httpError(404, 'Category not found');
  res.json(rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  if (!rowCount) throw httpError(404, 'Category not found');
  res.status(204).end();
}));

module.exports = router;
