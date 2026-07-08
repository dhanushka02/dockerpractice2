INSERT INTO categories (name) VALUES
  ('Drinks'),
  ('Snacks'),
  ('Meals'),
  ('Household')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (sku, name, category_id, price, cost, stock_quantity, low_stock_threshold)
VALUES
  ('DRK-001', 'Bottled Water', (SELECT id FROM categories WHERE name = 'Drinks'), 2.50, 0.80, 80, 10),
  ('DRK-002', 'Iced Coffee', (SELECT id FROM categories WHERE name = 'Drinks'), 4.80, 1.70, 35, 8),
  ('SNK-001', 'Potato Chips', (SELECT id FROM categories WHERE name = 'Snacks'), 3.60, 1.20, 48, 10),
  ('SNK-002', 'Chocolate Bar', (SELECT id FROM categories WHERE name = 'Snacks'), 2.90, 1.00, 65, 12),
  ('MEL-001', 'Chicken Sandwich', (SELECT id FROM categories WHERE name = 'Meals'), 8.90, 3.60, 20, 5),
  ('MEL-002', 'Veggie Wrap', (SELECT id FROM categories WHERE name = 'Meals'), 7.90, 3.10, 18, 5),
  ('HHD-001', 'Paper Towels', (SELECT id FROM categories WHERE name = 'Household'), 5.50, 2.20, 25, 6)
ON CONFLICT (sku) DO NOTHING;

INSERT INTO customers (full_name, phone, email, address)
VALUES
  ('Walk-in Customer', NULL, NULL, NULL),
  ('Asha Perera', '0400000001', 'asha@example.com', 'Adelaide SA'),
  ('Noah Smith', '0400000002', 'noah@example.com', 'Adelaide SA')
ON CONFLICT DO NOTHING;
