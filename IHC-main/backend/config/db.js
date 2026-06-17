const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// 🔗 String de conexão (Mude para sua URI do MongoDB Atlas se preferir)
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ihc_store';

// --- SCHEMAS ---
const productSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  stock: { type: Number, required: true },
  image: String,
  description: String,
  sales: { type: Number, default: 0 },
  badge: { type: String, default: '' }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'customer' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' }
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  _id: String,
  user_id: { type: String, ref: 'User', required: true },
  items: { type: Array, required: true },
  total: { type: Number, required: true },
  status: { type: String, default: 'pendente' },
  shipping_address: String,
  payment_method: String,
  coupon_applied: String,
  discount_amount: { type: Number, default: 0 }
}, { timestamps: true });

const settingSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: mongoose.Schema.Types.Mixed
});

// --- MODELS ---
const Product = mongoose.model('Product', productSchema);
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const Setting = mongoose.model('Setting', settingSchema);

async function initializeDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB Connected');
    await seedInitialData();
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
  }
}

async function seedInitialData() {
  const pCount = await Product.countDocuments();
  if (pCount === 0) {
    console.log('📦 Semeando produtos iniciais...');
    const initialProducts = [
      { _id: 'p1', name: 'RTX 4070 Ti Super', price: 5499.9, category: 'Placas de Vídeo', stock: 8, image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=500', description: 'Placa gráfica potente para jogos em 4K.', sales: 18, badge: 'new' },
      { _id: 'p2', name: 'Intel i9-13900K', price: 3899.9, category: 'Processadores', stock: 12, image: 'https://images.unsplash.com/photo-1591405351990-4726e331f141?w=500', description: 'Processador de alta performance para workstation.', sales: 27, badge: 'bestseller' },
      { _id: 'p3', name: 'SSD NVMe 2TB Gen4', price: 899.9, category: 'Armazenamento', stock: 25, image: 'https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=500', description: 'Velocidade extrema para seu sistema.', sales: 35, badge: 'sale' },
      { _id: 'p4', name: 'RAM DDR5 32GB RGB', price: 1299.9, category: 'Memória', stock: 15, image: 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=500', description: 'Estabilidade e beleza para seu setup.', sales: 9, badge: '' },
      { _id: 'p5', name: 'Fonte 850W Gold Modular', price: 749.9, category: 'Energia', stock: 20, image: 'https://images.unsplash.com/photo-1587202395160-244303350328?w=500', description: 'Energia confiável para componentes de ponta.', sales: 5, badge: '' },
      { _id: 'p6', name: 'Gabinete Airflow RGB', price: 499.9, category: 'Gabinetes', stock: 10, image: 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=500', description: 'Excelente refrigeração e design moderno.', sales: 2, badge: 'new' }
    ];
    await Product.insertMany(initialProducts);
  }

  // Verifica se o admin já existe pelo e-mail para evitar duplicatas
  const uCount = await User.countDocuments({ role: 'admin' });
  if (uCount === 0) {
    console.log('👤 Criando administrador padrão...');
    const hashedPwd = bcrypt.hashSync('admin123', 10);
    await User.create({
      _id: 'u-admin',
      name: 'Admin',
      email: 'admin@ihcstore.com',
      password: hashedPwd,
      role: 'admin'
    });
  }
}

const formatDoc = (doc) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.id = obj._id;
  return obj;
};

module.exports = {
  initializeDatabase,
  listProducts: async () => (await Product.find().sort({ sales: -1 })).map(formatDoc),
  getProductById: async (id) => formatDoc(await Product.findById(id)),
  upsertProduct: async (id, data) => formatDoc(await Product.findByIdAndUpdate(id, { $set: data }, { upsert: true, new: true })),
  deleteProduct: async (id) => (await Product.findByIdAndDelete(id)) !== null,
  listUsers: async () => (await User.find({}, '-password')).map(formatDoc),
  findUserByEmail: async (email) => formatDoc(await User.findOne({ email })),
  createUser: async (data) => {
    const user = await User.create({ ...data, _id: data.id || 'u-' + Date.now() });
    return formatDoc(user);
  },
  verifyAdminPassword: async (currentPwd) => {
    const admin = await User.findOne({ role: 'admin' });
    return admin ? await bcrypt.compare(currentPwd, admin.password) : false;
  },
  updateAdminPassword: async (pwd) => {
    const res = await User.updateOne({ role: 'admin' }, { password: pwd });
    return res.modifiedCount > 0;
  },
  listOrders: async () => (await Order.find().sort({ createdAt: -1 })).map(formatDoc),
  listOrdersByCustomer: async (uid) => (await Order.find({ user_id: uid }).sort({ createdAt: -1 })).map(formatDoc),
  getOrderById: async (id) => formatDoc(await Order.findById(id)),
  createOrder: async (data) => {
    const order = await Order.create({ ...data, _id: data.id || 'order-' + Date.now() });
    return formatDoc(order);
  },
  updateOrderStatus: async (id, status) => {
    const res = await Order.updateOne({ _id: id }, { status });
    return res.modifiedCount > 0;
  },
  deleteOrdersBulk: async (ids) => {
    const res = await Order.deleteMany({ _id: { $in: ids } });
    return res.deletedCount;
  },
  getSettings: async () => {
    const rows = await Setting.find();
    const res = {};
    rows.forEach(s => res[s.key] = s.value);
    return res;
  },
  saveSettings: async (data) => {
    await Setting.deleteMany({});
    const entries = Object.entries(data).map(([key, value]) => ({ key, value }));
    await Setting.insertMany(entries);
    return data;
  }
};
