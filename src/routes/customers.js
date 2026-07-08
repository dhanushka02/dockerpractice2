const express = require('express');
const db = require('../db');
const { asyncHandler, httpError } = require('../middleware/errors');

const router = express.Router();

function parseCustomer(body) {
  const customer = {
    fullName: String(body.fullName || '').trim(),
    phone: String(body.phone || '').trim() || null,
    email: String(body.email || '').trim() || null,
    address: String(body.address || '').trim() || null
  };

  if (!customer.fullName) throw httpError(400, 'Customer name is required');
  return customer;
}

router.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    where.push(`(full_name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  const { rows } = await db.query(
    `SELECT * FROM customers ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY full_name`,
    params
  );
  res.json(rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const customer = parseCustomer(req.body);
  const { rows } = await db.query(
    `INSERT INTO customers (full_name, phone, email, address)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [customer.fullName, customer.phone, customer.email, customer.address]
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const customer = parseCustomer(req.body);
  const { rows } = await db.query(
    `UPDATE customers
     SET full_name = $1, phone = $2, email = $3, address = $4
     WHERE id = $5
     RETURNING *`,
    [customer.fullName, customer.phone, customer.email, customer.address, req.params.id]
  );
  if (!rows[0]) throw httpError(404, 'Customer not found');
  res.json(rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
  if (!rowCount) throw httpError(404, 'Customer not found');
  res.status(204).end();
}));

module.exports = router;
