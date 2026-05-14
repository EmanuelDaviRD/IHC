const { readJSON, writeJSON, uuidLike } = require('./localStorage');

const FILES = {
  users: 'users.json',
  products: 'products.json',
  orders: 'orders.json',
  settings: 'settings.json',
  counters: 'counters.json'
};

function getDefaultSeedProducts() {
  return [
    {
      id: 'p1',
      name: 'Perfume Floral Luxo',
      price: 129.9,
      category: 'Novidades',
      stock: 25,
      image: 'https://ibb.co/6rXfK8d',
      description: 'Fragrância marcante com toque floral e elegante.',
      sales: 18,
      badge: 'new'
    },
    {
      id: 'p2',
      name: 'Creme Hidratante Brilho',
      price: 59.9,
      category: 'Natura',
      stock: 40,
      image: 'https://ibb.co/7Jg3w8s',
      description: 'Hidratação intensa com acabamento luminoso.',
      sales: 27,
      badge: 'bestseller'
    },
    {
      id: 'p3',
      name: 'Desodorante Kit Proteção',
      price: 79.9,
      category: 'Kits',
      stock: 12,
      image: 'https://ibb.co/2g8QmYH',
      description: 'Kit com proteção diária e fragrância suave.',
      sales: 35,
      badge: 'sale'
    },
    {
      id: 'p4',
      name: 'Kit Presentes Glam',
      price: 149.9,
      category: 'Kits',
      stock: 7,
      image: 'https://ibb.co/4Jt9p2w',
      description: 'Presente completo para impressionar.',
      sales: 42,
      badge: 'bestseller'
    },
    {
      id: 'p5',
      name: 'Óleo Corporal Seda',
      price: 69.9,
      category: 'O Boticário',
      stock: 20,
      image: 'https://ibb.co/1mRz9yS',
      description: 'Nutrição profunda e sensação de seda.',
      sales: 9,
      badge: ''
    },
    {
      id: 'p6',
      name: 'Sabonete Líquido Perfumado',
      price: 34.9,
      category: 'Acessórios',
      stock: 60,
      image: 'https://ibb.co/Z6K4p1T',
      description: 'Limpeza suave com perfume delicioso.',
      sales: 6,
      badge: ''
    },
    {
      id: 'p7',
      name: 'Loção Pós Banho Relax',
      price: 54.9,
      category: 'Avon',
      stock: 9,
      image: 'https://ibb.co/0ZbHq6n',
      description: 'Toque relaxante e maciez prolongada.',
      sales: 15,
      badge: 'sale'
    },
    {
      id: 'p8',
      name: 'Hidratante Mãos Aroma',
      price: 24.9,
      category: 'Acessórios',
      stock: 100,
      image: 'https://ibb.co/v4d3YQn',
      description: 'Hidratação para o dia a dia, com aroma delicado.',
      sales: 4,
      badge: ''
    },
    {
      id: 'p9',
      name: 'Perfume Elegance 100ml',
      price: 199.9,
      category: 'Outros',
      stock: 5,
      image: 'https://ibb.co/C0f5g2K',
      description: 'Elegância em cada borrifada. Ideal para ocasiões especiais.',
      sales: 52,
      badge: 'bestseller'
    },
    {
      id: 'p10',
      name: 'Kit Cuidados Essenciais',
      price: 109.9,
      category: 'Outros',
      stock: 18,
      image: 'https://ibb.co/tp7w7rN',
      description: 'Rotina essencial de cuidado com sensação premium.',
      sales: 21,
      badge: 'new'
    }
  ];
}

function seedIfEmpty() {
  const products = readJSON(FILES.products, null);
  if (!products || !Array.isArray(products) || products.length === 0) {
    writeJSON(FILES.products, getDefaultSeedProducts());
  }

  const users = readJSON(FILES.users, null);
  if (!users || !Array.isArray(users) || users.length === 0) {
    writeJSON(FILES.users, [
      {
        id: 'u-admin',
        name: 'Admin',
        email: 'admin@edclaudia.com',
        password: 'admin123',
        role: 'admin',
        phone: '',
        address: '',
        createdAt: new Date().toISOString()
      }
    ]);
  }

  const settings = readJSON(FILES.settings, null);
  if (!settings || typeof settings !== 'object' || !Object.keys(settings).length) {
    writeJSON(FILES.settings, {
      primaryColor: '#c9a96e',
      accentColor: '#7c6fae',
      siteTitle: 'Edcláudia Ribeiro',
      welcomeText: 'Beleza que inspira',
      logoUrl: ''
    });
  }

  const orders = readJSON(FILES.orders, null);
  if (!orders || !Array.isArray(orders)) writeJSON(FILES.orders, []);
}

seedIfEmpty();

function listProducts() {
  const products = readJSON(FILES.products, []);
  return products.sort((a, b) => (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)));
}

function upsertProduct(id, body) {
  const products = readJSON(FILES.products, []);

  if (!id) {
    const newP = {
      id: uuidLike(),
      name: body.name,
      price: Number(body.price),
      category: body.category || 'Outros',
      stock: Number(body.stock || 0),
      image: body.image,
      description: body.description || '',
      badge: body.badge || '',
      sales: Number(body.sales || 0),
      createdAt: new Date().toISOString()
    };
    products.push(newP);
    writeJSON(FILES.products, products);
    return newP;
  }

  const idx = products.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return null;

  const updated = {
    ...products[idx],
    ...['name', 'price', 'category', 'stock', 'image', 'description', 'badge'].reduce((acc, k) => {
      if (body[k] !== undefined) acc[k] = k === 'price' ? Number(body[k]) : k === 'stock' ? Number(body[k]) : body[k];
      return acc;
    }, {})
  };

  if (updated.price !== undefined) updated.price = Number(updated.price);
  if (updated.stock !== undefined) updated.stock = Number(updated.stock);

  products[idx] = updated;
  writeJSON(FILES.products, products);
  return updated;
}

function deleteProduct(id) {
  const products = readJSON(FILES.products, []);
  const before = products.length;
  const next = products.filter(p => String(p.id) !== String(id));
  writeJSON(FILES.products, next);
  return before !== next.length;
}

function listUsers() {
  return readJSON(FILES.users, []).map(u => ({ ...u, password: undefined }));
}

function findUserByEmail(email) {
  return readJSON(FILES.users, []).find(u => u.email === email) || null;
}

function findUserById(id) {
  return readJSON(FILES.users, []).find(u => String(u.id) === String(id)) || null;
}

function createUser({ name, email, password }) {
  const users = readJSON(FILES.users, []);
  if (users.some(u => u.email === email)) return null;
  const newU = {
    id: uuidLike(),
    name,
    email,
    password,
    role: 'customer',
    phone: '',
    address: '',
    createdAt: new Date().toISOString()
  };
  users.push(newU);
  writeJSON(FILES.users, users);
  return newU;
}

function updateAdminPassword(adminId, currentPassword, newPassword) {
  const users = readJSON(FILES.users, []);
  const idx = users.findIndex(u => String(u.id) === String(adminId));
  if (idx === -1) return { ok: false, error: 'Usuário não encontrado' };
  if (users[idx].password !== currentPassword) return { ok: false, error: 'Senha atual incorreta' };
  users[idx].password = newPassword;
  writeJSON(FILES.users, users);
  return { ok: true };
}

function listOrders() {
  const orders = readJSON(FILES.orders, []);
  return orders.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function listOrdersByCustomer(customerId) {
  return listOrders().filter(o => String(o.customerId) === String(customerId));
}

function createOrder({ customerId, customerEmail, items, total, address, paymentMethod }) {
  const products = readJSON(FILES.products, []);

  for (const item of items) {
    const prod = products.find(p => String(p.id) === String(item.id));
    if (!prod) return { ok: false, error: 'Produto não encontrado' };
    if (prod.stock < item.qty) return { ok: false, error: `Estoque insuficiente para ${prod.name}` };
  }

  for (const item of items) {
    const prod = products.find(p => String(p.id) === String(item.id));
    prod.stock = Number(prod.stock) - Number(item.qty);
    prod.sales = Number(prod.sales || 0) + Number(item.qty);
  }
  writeJSON(FILES.products, products);

  const orders = readJSON(FILES.orders, []);
  const newOrder = {
    id: uuidLike(),
    customerId,
    customerEmail,
    items,
    total: Number(total),
    address: address || '',
    paymentMethod: paymentMethod || 'card',
    status: 'Pendente',
    date: new Date().toISOString()
  };

  orders.push(newOrder);
  writeJSON(FILES.orders, orders);
  return { ok: true, order: newOrder };
}

function deleteOrdersBulk(ids) {
  const orders = readJSON(FILES.orders, []);
  const set = new Set(ids.map(String));
  const next = orders.filter(o => !set.has(String(o.id)));
  writeJSON(FILES.orders, next);
  return orders.length - next.length;
}

function updateOrderStatus(orderId, status) {
  const orders = readJSON(FILES.orders, []);
  const idx = orders.findIndex(o => String(o.id) === String(orderId));
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], status };
  writeJSON(FILES.orders, orders);
  return orders[idx];
}

function getSettings() {
  return readJSON(FILES.settings, {});
}

function saveSettings(newSettings) {
  writeJSON(FILES.settings, newSettings);
  return newSettings;
}

module.exports = {
  listProducts,
  upsertProduct,
  deleteProduct,
  listUsers,
  findUserByEmail,
  findUserById,
  createUser,
  updateAdminPassword,
  listOrders,
  listOrdersByCustomer,
  createOrder,
  deleteOrdersBulk,
  updateOrderStatus,
  getSettings,
  saveSettings
};

