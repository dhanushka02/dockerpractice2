# POS Tool

A complete point of sale starter built with Node.js, Express, vanilla JavaScript, and PostgreSQL.

No container files are included. You can run it against a local PostgreSQL database now and later point `DATABASE_URL` to your PostgreSQL database service.

## Features

- POS checkout screen with product search, cart, customer selection, tax, cash change, and receipt
- Product management with SKU, category, price, cost, stock, and active/inactive status
- Customer management
- Inventory adjustments and movement history
- Sales history with receipt details
- Dashboard reports for today revenue, orders, low stock, and recent sales totals
- PostgreSQL schema with foreign keys, transactions, and stock-safe checkout

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a PostgreSQL database:

```bash
createdb pos_tool
```

3. Create your environment file:

```bash
cp .env.example .env
```

4. Edit `.env` if your PostgreSQL username, password, host, port, or database name is different.

5. Create tables and seed sample data:

```bash
npm run db:schema
npm run db:seed
```

6. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful Scripts

- `npm start` - run the Express server
- `npm run dev` - run with nodemon
- `npm run db:schema` - apply PostgreSQL schema
- `npm run db:seed` - insert sample categories, products, and customers

## API Overview

- `GET /api/health`
- `GET /api/settings`
- `GET /api/categories`
- `POST /api/categories`
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/customers`
- `POST /api/customers`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`
- `GET /api/sales`
- `GET /api/sales/:id`
- `POST /api/sales`
- `GET /api/inventory/movements`
- `POST /api/inventory/adjustments`
- `GET /api/reports/summary`

