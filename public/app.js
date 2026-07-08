const state = {
  products: [],
  categories: [],
  customers: [],
  cart: [],
  sales: [],
  taxRate: 0.1
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const money = (value) => Number(value || 0).toLocaleString('en-AU', {
  style: 'currency',
  currency: 'AUD'
});

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }

  if (response.status === 204) return null;
  return response.json();
}

function showToast(message, type = 'success') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function setView(view) {
  $$('.nav-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view);
  });

  $$('.view').forEach((section) => {
    section.classList.toggle('active', section.id === `view-${view}`);
  });
}

async function loadBaseData() {
  const [settings, categories, products, customers] = await Promise.all([
    api('/settings'),
    api('/categories'),
    api('/products?activeOnly=false'),
    api('/customers')
  ]);

  state.taxRate = Number(settings.taxRate || 0);
  state.categories = categories;
  state.products = products;
  state.customers = customers;

  renderCategoryOptions();
  renderProducts();
  renderProductTable();
  renderCustomers();
  renderCustomerOptions();
  renderInventoryProducts();
}

function renderCategoryOptions() {
  const optionHtml = state.categories.map((category) => (
    `<option value="${category.id}">${category.name}</option>`
  )).join('');

  $('#category-filter').innerHTML = `<option value="">All categories</option>${optionHtml}`;
  $('#product-category').innerHTML = `<option value="">No category</option>${optionHtml}`;
}

function filteredProducts(activeOnly = true) {
  const search = $('#product-search')?.value.trim().toLowerCase() || '';
  const category = $('#category-filter')?.value || '';

  return state.products.filter((product) => {
    const matchesStatus = !activeOnly || product.is_active;
    const matchesSearch = !search
      || product.name.toLowerCase().includes(search)
      || product.sku.toLowerCase().includes(search);
    const matchesCategory = !category || String(product.category_id || '') === category;
    return matchesStatus && matchesSearch && matchesCategory;
  });
}

function renderProducts() {
  const grid = $('#product-grid');
  const products = filteredProducts(true);

  if (!products.length) {
    grid.innerHTML = '<div class="empty">No products found.</div>';
    return;
  }

  grid.innerHTML = products.map((product) => `
    <button class="product-card" data-add-product="${product.id}" ${product.stock_quantity <= 0 ? 'disabled' : ''}>
      <strong>${product.name}</strong>
      <span class="small-muted">${product.sku}${product.category_name ? ` - ${product.category_name}` : ''}</span>
      <div class="product-meta">
        <span>${money(product.price)}</span>
        <span>${product.stock_quantity} left</span>
      </div>
    </button>
  `).join('');
}

function addToCart(productId) {
  const product = state.products.find((item) => Number(item.id) === Number(productId));
  if (!product || !product.is_active) return;

  const existing = state.cart.find((item) => Number(item.productId) === Number(productId));
  if (existing) {
    if (existing.quantity >= Number(product.stock_quantity)) {
      showToast('Not enough stock for this product.', 'error');
      return;
    }
    existing.quantity += 1;
  } else {
    if (Number(product.stock_quantity) <= 0) {
      showToast('This product is out of stock.', 'error');
      return;
    }
    state.cart.push({
      productId: product.id,
      quantity: 1,
      discountAmount: 0
    });
  }

  renderCart();
}

function getCartTotals() {
  return state.cart.reduce((totals, item) => {
    const product = state.products.find((candidate) => Number(candidate.id) === Number(item.productId));
    if (!product) return totals;

    const gross = Number(product.price) * Number(item.quantity);
    const discount = Math.min(Number(item.discountAmount || 0), gross);
    const taxable = gross - discount;
    const tax = taxable * state.taxRate;

    totals.subtotal += gross;
    totals.discount += discount;
    totals.tax += tax;
    totals.total += taxable + tax;
    return totals;
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 });
}

function renderCart() {
  const container = $('#cart-items');

  if (!state.cart.length) {
    container.innerHTML = '<div class="empty">Cart is empty.</div>';
  } else {
    container.innerHTML = state.cart.map((item) => {
      const product = state.products.find((candidate) => Number(candidate.id) === Number(item.productId));
      if (!product) return '';
      const lineTotal = Number(product.price) * item.quantity - Number(item.discountAmount || 0);

      return `
        <div class="cart-item">
          <div class="cart-item-main">
            <div>
              <strong>${product.name}</strong>
              <span class="small-muted">${product.sku} - ${money(product.price)} each</span>
            </div>
            <strong>${money(lineTotal)}</strong>
          </div>
          <div class="cart-controls">
            <input type="number" min="1" max="${product.stock_quantity}" step="1" value="${item.quantity}" data-cart-qty="${product.id}">
            <input type="number" min="0" step="0.01" value="${item.discountAmount}" data-cart-discount="${product.id}" title="Discount">
            <button class="icon-button" data-remove-cart="${product.id}" title="Remove">x</button>
          </div>
        </div>
      `;
    }).join('');
  }

  const totals = getCartTotals();
  const cashReceived = Number($('#cash-received').value || 0);
  const change = Math.max(0, cashReceived - totals.total);

  $('#cart-subtotal').textContent = money(totals.subtotal);
  $('#cart-discount').textContent = money(totals.discount);
  $('#cart-tax').textContent = money(totals.tax);
  $('#cart-total').textContent = money(totals.total);
  $('#cart-change').textContent = money(change);
}

function renderCustomerOptions() {
  const options = state.customers.map((customer) => (
    `<option value="${customer.id}">${customer.full_name}</option>`
  )).join('');

  $('#sale-customer').innerHTML = `<option value="">Walk-in customer</option>${options}`;
}

async function checkout() {
  const totals = getCartTotals();
  const paymentMethod = $('#payment-method').value;
  const payload = {
    customerId: $('#sale-customer').value || null,
    paymentMethod,
    cashReceived: paymentMethod === 'cash' ? Number($('#cash-received').value || 0) : null,
    items: state.cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      discountAmount: item.discountAmount
    }))
  };

  if (!state.cart.length) {
    showToast('Add products before checkout.', 'error');
    return;
  }

  if (paymentMethod === 'cash' && payload.cashReceived < totals.total) {
    showToast('Cash received must cover the total.', 'error');
    return;
  }

  const sale = await api('/sales', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  showToast(`Sale completed: ${sale.invoice_no}`);
  state.cart = [];
  $('#cash-received').value = '';
  await loadBaseData();
  await loadSales();
  renderCart();
  renderReceipt(sale);
  setView('sales');
}

function productPayload() {
  return {
    sku: $('#product-sku').value,
    name: $('#product-name').value,
    categoryId: $('#product-category').value || null,
    price: Number($('#product-price').value || 0),
    cost: Number($('#product-cost').value || 0),
    stockQuantity: Number($('#product-stock').value || 0),
    lowStockThreshold: Number($('#product-low-stock').value || 0),
    isActive: $('#product-active').checked
  };
}

function resetProductForm() {
  $('#product-form').reset();
  $('#product-id').value = '';
  $('#product-active').checked = true;
  $('#product-form-title').textContent = 'Add product';
}

function renderProductTable() {
  const q = $('#products-search')?.value.trim().toLowerCase() || '';
  const products = state.products.filter((product) => (
    !q || product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q)
  ));

  $('#products-table').innerHTML = products.map((product) => `
    <tr>
      <td>${product.sku}</td>
      <td>${product.name}</td>
      <td>${money(product.price)}</td>
      <td>${product.stock_quantity}</td>
      <td><span class="status-pill ${product.is_active ? '' : 'inactive'}">${product.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <button class="secondary-button" data-edit-product="${product.id}">Edit</button>
        <button class="danger-button" data-delete-product="${product.id}">Deactivate</button>
      </td>
    </tr>
  `).join('');
}

function editProduct(id) {
  const product = state.products.find((item) => Number(item.id) === Number(id));
  if (!product) return;

  $('#product-id').value = product.id;
  $('#product-sku').value = product.sku;
  $('#product-name').value = product.name;
  $('#product-category').value = product.category_id || '';
  $('#product-price').value = product.price;
  $('#product-cost').value = product.cost;
  $('#product-stock').value = product.stock_quantity;
  $('#product-low-stock').value = product.low_stock_threshold;
  $('#product-active').checked = product.is_active;
  $('#product-form-title').textContent = 'Edit product';
}

function customerPayload() {
  return {
    fullName: $('#customer-name').value,
    phone: $('#customer-phone').value,
    email: $('#customer-email').value,
    address: $('#customer-address').value
  };
}

function resetCustomerForm() {
  $('#customer-form').reset();
  $('#customer-id').value = '';
  $('#customer-form-title').textContent = 'Add customer';
}

function renderCustomers() {
  const q = $('#customers-search')?.value.trim().toLowerCase() || '';
  const customers = state.customers.filter((customer) => (
    !q
    || customer.full_name.toLowerCase().includes(q)
    || String(customer.phone || '').toLowerCase().includes(q)
    || String(customer.email || '').toLowerCase().includes(q)
  ));

  $('#customers-list').innerHTML = customers.map((customer) => `
    <article class="list-item">
      <div class="list-item-main">
        <div>
          <strong>${customer.full_name}</strong>
          <span class="small-muted">${customer.phone || 'No phone'} ${customer.email ? `- ${customer.email}` : ''}</span>
        </div>
        <div>
          <button class="secondary-button" data-edit-customer="${customer.id}">Edit</button>
          <button class="danger-button" data-delete-customer="${customer.id}">Delete</button>
        </div>
      </div>
    </article>
  `).join('') || '<div class="empty">No customers found.</div>';
}

function editCustomer(id) {
  const customer = state.customers.find((item) => Number(item.id) === Number(id));
  if (!customer) return;

  $('#customer-id').value = customer.id;
  $('#customer-name').value = customer.full_name;
  $('#customer-phone').value = customer.phone || '';
  $('#customer-email').value = customer.email || '';
  $('#customer-address').value = customer.address || '';
  $('#customer-form-title').textContent = 'Edit customer';
}

function renderInventoryProducts() {
  $('#inventory-product').innerHTML = state.products
    .filter((product) => product.is_active)
    .map((product) => `<option value="${product.id}">${product.sku} - ${product.name} (${product.stock_quantity})</option>`)
    .join('');
}

async function loadInventoryMovements() {
  const movements = await api('/inventory/movements');
  $('#inventory-list').innerHTML = movements.map((movement) => `
    <article class="list-item">
      <div class="list-item-main">
        <div>
          <strong>${movement.product_name}</strong>
          <span class="small-muted">${movement.movement_type} - ${new Date(movement.created_at).toLocaleString()}</span>
        </div>
        <strong>${movement.quantity_change > 0 ? '+' : ''}${movement.quantity_change}</strong>
      </div>
      ${movement.note ? `<p class="small-muted">${movement.note}</p>` : ''}
    </article>
  `).join('') || '<div class="empty">No inventory movements yet.</div>';
}

async function loadReports() {
  const report = await api('/reports/summary');

  $('#report-revenue').textContent = money(report.today.revenue);
  $('#report-orders').textContent = report.today.orders;
  $('#report-low-stock-count').textContent = report.lowStock.length;

  $('#top-products-list').innerHTML = report.topProducts.map((product) => `
    <article class="list-item">
      <div class="list-item-main">
        <div>
          <strong>${product.name}</strong>
          <span class="small-muted">${product.quantity_sold} sold</span>
        </div>
        <strong>${money(product.revenue)}</strong>
      </div>
    </article>
  `).join('') || '<div class="empty">No sales yet.</div>';

  $('#low-stock-list').innerHTML = report.lowStock.map((product) => `
    <article class="list-item">
      <div class="list-item-main">
        <div>
          <strong>${product.name}</strong>
          <span class="small-muted">${product.sku}</span>
        </div>
        <span class="status-pill warning">${product.stock_quantity} left</span>
      </div>
    </article>
  `).join('') || '<div class="empty">No low stock products.</div>';

  const maxRevenue = Math.max(...report.salesByDay.map((day) => Number(day.revenue)), 1);
  $('#sales-by-day').innerHTML = report.salesByDay.map((day) => `
    <div class="bar-row">
      <span>${day.day}</span>
      <div class="bar-track"><div class="bar-fill" style="width: ${(Number(day.revenue) / maxRevenue) * 100}%"></div></div>
      <strong>${money(day.revenue)}</strong>
    </div>
  `).join('') || '<div class="empty">No sales in the last 7 days.</div>';
}

async function loadSales() {
  state.sales = await api('/sales');
  $('#sales-list').innerHTML = state.sales.map((sale) => `
    <article class="list-item">
      <div class="list-item-main">
        <div>
          <strong>${sale.invoice_no}</strong>
          <span class="small-muted">${sale.customer_name || 'Walk-in'} - ${new Date(sale.created_at).toLocaleString()}</span>
        </div>
        <div>
          <strong>${money(sale.total)}</strong>
          <button class="secondary-button" data-view-sale="${sale.id}">View</button>
        </div>
      </div>
    </article>
  `).join('') || '<div class="empty">No sales yet.</div>';
}

function renderReceipt(sale) {
  const details = $('#receipt-details');
  details.className = 'receipt';
  details.innerHTML = `
    <div>
      <strong>${sale.invoice_no}</strong>
      <div class="small-muted">${new Date(sale.created_at).toLocaleString()}</div>
      <div class="small-muted">${sale.customer_name || 'Walk-in customer'}</div>
    </div>
    <hr>
    ${sale.items.map((item) => `
      <div class="receipt-line">
        <span>${item.quantity} x ${item.name_snapshot}</span>
        <strong>${money(item.line_total)}</strong>
      </div>
    `).join('')}
    <hr>
    <div class="receipt-line"><span>Subtotal</span><strong>${money(sale.subtotal)}</strong></div>
    <div class="receipt-line"><span>Discount</span><strong>${money(sale.discount_total)}</strong></div>
    <div class="receipt-line"><span>Tax</span><strong>${money(sale.tax_total)}</strong></div>
    <div class="receipt-line"><span>Total</span><strong>${money(sale.total)}</strong></div>
    <div class="receipt-line"><span>Paid by</span><strong>${sale.payment_method}</strong></div>
    <div class="receipt-line"><span>Change</span><strong>${money(sale.change_due)}</strong></div>
  `;
}

function bindEvents() {
  $$('.nav-button').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  $('#product-search').addEventListener('input', renderProducts);
  $('#category-filter').addEventListener('change', renderProducts);
  $('#products-search').addEventListener('input', renderProductTable);
  $('#customers-search').addEventListener('input', renderCustomers);
  $('#cash-received').addEventListener('input', renderCart);
  $('#payment-method').addEventListener('change', () => {
    $('#cash-field').style.display = $('#payment-method').value === 'cash' ? 'grid' : 'none';
    renderCart();
  });

  $('#product-grid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-add-product]');
    if (button) addToCart(button.dataset.addProduct);
  });

  $('#cart-items').addEventListener('input', (event) => {
    const qtyInput = event.target.closest('[data-cart-qty]');
    const discountInput = event.target.closest('[data-cart-discount]');
    const id = qtyInput?.dataset.cartQty || discountInput?.dataset.cartDiscount;
    const item = state.cart.find((cartItem) => Number(cartItem.productId) === Number(id));
    if (!item) return;

    if (qtyInput) item.quantity = Math.max(1, Number.parseInt(qtyInput.value || 1, 10));
    if (discountInput) item.discountAmount = Math.max(0, Number(discountInput.value || 0));
    renderCart();
  });

  $('#cart-items').addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-cart]');
    if (!button) return;
    state.cart = state.cart.filter((item) => Number(item.productId) !== Number(button.dataset.removeCart));
    renderCart();
  });

  $('#clear-cart').addEventListener('click', () => {
    state.cart = [];
    renderCart();
  });

  $('#checkout-button').addEventListener('click', () => run(checkout));
  $('#refresh-pos').addEventListener('click', () => run(loadBaseData));

  $('#product-form').addEventListener('submit', (event) => run(async () => {
    event.preventDefault();
    const id = $('#product-id').value;
    await api(id ? `/products/${id}` : '/products', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(productPayload())
    });
    showToast('Product saved.');
    resetProductForm();
    await loadBaseData();
  }));

  $('#reset-product-form').addEventListener('click', resetProductForm);
  $('#reload-products').addEventListener('click', () => run(loadBaseData));

  $('#products-table').addEventListener('click', (event) => run(async () => {
    const editButton = event.target.closest('[data-edit-product]');
    const deleteButton = event.target.closest('[data-delete-product]');
    if (editButton) editProduct(editButton.dataset.editProduct);
    if (deleteButton) {
      await api(`/products/${deleteButton.dataset.deleteProduct}`, { method: 'DELETE' });
      showToast('Product deactivated.');
      await loadBaseData();
    }
  }));

  $('#customer-form').addEventListener('submit', (event) => run(async () => {
    event.preventDefault();
    const id = $('#customer-id').value;
    await api(id ? `/customers/${id}` : '/customers', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(customerPayload())
    });
    showToast('Customer saved.');
    resetCustomerForm();
    await loadBaseData();
  }));

  $('#reset-customer-form').addEventListener('click', resetCustomerForm);
  $('#reload-customers').addEventListener('click', () => run(loadBaseData));

  $('#customers-list').addEventListener('click', (event) => run(async () => {
    const editButton = event.target.closest('[data-edit-customer]');
    const deleteButton = event.target.closest('[data-delete-customer]');
    if (editButton) editCustomer(editButton.dataset.editCustomer);
    if (deleteButton) {
      await api(`/customers/${deleteButton.dataset.deleteCustomer}`, { method: 'DELETE' });
      showToast('Customer deleted.');
      await loadBaseData();
    }
  }));

  $('#inventory-form').addEventListener('submit', (event) => run(async () => {
    event.preventDefault();
    await api('/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify({
        productId: $('#inventory-product').value,
        movementType: $('#inventory-type').value,
        quantityChange: Number($('#inventory-quantity').value),
        note: $('#inventory-note').value
      })
    });
    showToast('Inventory movement saved.');
    $('#inventory-form').reset();
    await loadBaseData();
    await loadInventoryMovements();
  }));

  $('#reload-inventory').addEventListener('click', () => run(loadInventoryMovements));
  $('#reload-reports').addEventListener('click', () => run(loadReports));
  $('#reload-sales').addEventListener('click', () => run(loadSales));

  $('#sales-list').addEventListener('click', (event) => run(async () => {
    const button = event.target.closest('[data-view-sale]');
    if (!button) return;
    const sale = await api(`/sales/${button.dataset.viewSale}`);
    renderReceipt(sale);
  }));
}

async function run(task) {
  try {
    await task();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function init() {
  bindEvents();
  renderCart();
  await loadBaseData();
  await loadInventoryMovements();
  await loadReports();
  await loadSales();
}

run(init);
