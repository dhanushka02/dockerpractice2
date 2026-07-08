const express = require('express');
const config = require('../config');
const db = require('../db');
const { asyncHandler, httpError } = require('../middleware/errors');

const router = express.Router();

function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

function createInvoiceNo() {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${stamp}-${random}`;
}

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.*, c.full_name AS customer_name
     FROM sales s
     LEFT JOIN customers c ON c.id = s.customer_id
     ORDER BY s.created_at DESC
     LIMIT 100`
  );
  res.json(rows);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const saleResult = await db.query(
    `SELECT s.*, c.full_name AS customer_name, c.phone AS customer_phone
     FROM sales s
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.id = $1`,
    [req.params.id]
  );

  if (!saleResult.rows[0]) throw httpError(404, 'Sale not found');

  const itemResult = await db.query(
    'SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY id',
    [req.params.id]
  );

  res.json({
    ...saleResult.rows[0],
    items: itemResult.rows
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const customerId = req.body.customerId || null;
  const paymentMethod = req.body.paymentMethod || 'cash';
  const cashReceived = req.body.cashReceived === '' || req.body.cashReceived == null
    ? null
    : Number(req.body.cashReceived);

  if (!items.length) throw httpError(400, 'At least one cart item is required');
  if (!['cash', 'card', 'bank_transfer'].includes(paymentMethod)) throw httpError(400, 'Invalid payment method');

  const sale = await db.transaction(async (client) => {
    const productIds = [...new Set(items.map((item) => Number.parseInt(item.productId, 10)))];
    if (productIds.some((id) => !Number.isInteger(id))) throw httpError(400, 'Invalid product in cart');

    const productResult = await client.query(
      `SELECT * FROM products
       WHERE id = ANY($1::int[]) AND is_active = TRUE
       FOR UPDATE`,
      [productIds]
    );

    const products = new Map(productResult.rows.map((product) => [Number(product.id), product]));
    if (products.size !== productIds.length) throw httpError(400, 'One or more products are unavailable');

    const saleItems = items.map((item) => {
      const productId = Number.parseInt(item.productId, 10);
      const quantity = Number.parseInt(item.quantity, 10);
      const discountAmount = money(item.discountAmount || 0);
      const product = products.get(productId);

      if (!Number.isInteger(quantity) || quantity <= 0) throw httpError(400, 'Quantity must be greater than zero');
      if (discountAmount < 0) throw httpError(400, 'Discount cannot be negative');
      if (Number(product.stock_quantity) < quantity) {
        throw httpError(400, `${product.name} only has ${product.stock_quantity} in stock`);
      }

      const gross = money(Number(product.price) * quantity);
      const safeDiscount = Math.min(discountAmount, gross);
      const taxableAmount = money(gross - safeDiscount);
      const taxAmount = money(taxableAmount * config.taxRate);
      const lineTotal = money(taxableAmount + taxAmount);

      return {
        product,
        quantity,
        discountAmount: safeDiscount,
        taxAmount,
        lineTotal,
        gross
      };
    });

    const subtotal = money(saleItems.reduce((sum, item) => sum + item.gross, 0));
    const discountTotal = money(saleItems.reduce((sum, item) => sum + item.discountAmount, 0));
    const taxTotal = money(saleItems.reduce((sum, item) => sum + item.taxAmount, 0));
    const total = money(saleItems.reduce((sum, item) => sum + item.lineTotal, 0));

    if (paymentMethod === 'cash' && (!Number.isFinite(cashReceived) || cashReceived < total)) {
      throw httpError(400, 'Cash received must cover the sale total');
    }

    const invoiceNo = createInvoiceNo();
    const changeDue = paymentMethod === 'cash' ? money(cashReceived - total) : 0;
    const saleResult = await client.query(
      `INSERT INTO sales
        (invoice_no, customer_id, subtotal, discount_total, tax_total, total, payment_method, cash_received, change_due)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [invoiceNo, customerId, subtotal, discountTotal, taxTotal, total, paymentMethod, cashReceived, changeDue]
    );

    const createdSale = saleResult.rows[0];

    for (const item of saleItems) {
      await client.query(
        `INSERT INTO sale_items
          (sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, discount_amount, tax_amount, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          createdSale.id,
          item.product.id,
          item.product.sku,
          item.product.name,
          item.quantity,
          item.product.price,
          item.discountAmount,
          item.taxAmount,
          item.lineTotal
        ]
      );

      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [item.quantity, item.product.id]
      );

      await client.query(
        `INSERT INTO inventory_movements (product_id, sale_id, movement_type, quantity_change, note)
         VALUES ($1, $2, 'sale', $3, $4)`,
        [item.product.id, createdSale.id, -item.quantity, `Sold on ${createdSale.invoice_no}`]
      );
    }

    const itemResult = await client.query(
      'SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY id',
      [createdSale.id]
    );

    return {
      ...createdSale,
      items: itemResult.rows
    };
  });

  res.status(201).json(sale);
}));

module.exports = router;
