const express = require('express');
const db = require('../db');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

router.get('/summary', asyncHandler(async (req, res) => {
  const todayResult = await db.query(
    `SELECT
       COALESCE(SUM(total), 0) AS revenue,
       COUNT(*)::int AS orders
     FROM sales
     WHERE status = 'paid'
       AND created_at >= date_trunc('day', NOW())`
  );

  const lowStockResult = await db.query(
    `SELECT id, sku, name, stock_quantity, low_stock_threshold
     FROM products
     WHERE is_active = TRUE
       AND stock_quantity <= low_stock_threshold
     ORDER BY stock_quantity ASC, name ASC
     LIMIT 20`
  );

  const topProductsResult = await db.query(
    `SELECT
       si.product_id,
       si.name_snapshot AS name,
       SUM(si.quantity)::int AS quantity_sold,
       SUM(si.line_total) AS revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.status = 'paid'
     GROUP BY si.product_id, si.name_snapshot
     ORDER BY quantity_sold DESC
     LIMIT 5`
  );

  const salesByDayResult = await db.query(
    `SELECT
       to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
       COUNT(*)::int AS orders,
       COALESCE(SUM(total), 0) AS revenue
     FROM sales
     WHERE status = 'paid'
       AND created_at >= NOW() - INTERVAL '7 days'
     GROUP BY date_trunc('day', created_at)
     ORDER BY day`
  );

  res.json({
    today: todayResult.rows[0],
    lowStock: lowStockResult.rows,
    topProducts: topProductsResult.rows,
    salesByDay: salesByDayResult.rows
  });
}));

module.exports = router;
