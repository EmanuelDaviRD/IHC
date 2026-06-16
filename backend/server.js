const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const axios = require('axios');
require('dotenv').config();

const { uploadToCloudinary } = require('./config/cloudinary');
const {
  listProducts,
  upsertProduct,
  deleteProduct,
  listUsers,
  findUserByEmail,
  createUser,
  updateAdminPassword,
  listOrders,
  listOrdersByCustomer,
  createOrder,
  deleteOrdersBulk,
  updateOrderStatus,
  getSettings,
  saveSettings
} = require('./config/localData');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'LOCAL_JWT_SECRET_CHANGE_ME';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Token inválido' });
  }
}

function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  next();
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'landing.html')));
app.get('/loja', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'admin.html')));

app.get('/produtos', (req, res) => {
  try {
    res.json(listProducts());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/produtos', authenticate, isAdmin, (req, res) => {
  try {
    const { name, price, category, stock, image, description, badge } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: 'Nome e preço são obrigatórios' });

    const created = upsertProduct(null, {
      name,
      price,
      category,
      stock,
      image,
      description,
      badge
    });

    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/produtos/:id', authenticate, isAdmin, (req, res) => {
  try {
    const fields = ['name', 'price', 'category', 'stock', 'image', 'description', 'badge'];
    const body = {};
    fields.forEach(f => {
      if (req.body[f] !== undefined) body[f] = req.body[f];
    });

    const updated = upsertProduct(req.params.id, body);
    if (!updated) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/produtos/:id', authenticate, isAdmin, (req, res) => {
  try {
    const ok = deleteProduct(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ message: 'Produto removido' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Dados incompletos' });

    const created = createUser({ name, email, password });
    if (!created) return res.status(400).json({ error: 'Email já cadastrado' });

    const token = jwt.sign({ id: created.id, email: created.email, role: created.role, name: created.name }, SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: created.id, name: created.name, email: created.email, role: created.role } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const u = findUserByEmail(email);
    if (!u || u.password !== password) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = jwt.sign({ id: u.id, email: u.email, role: u.role, name: u.name }, SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/pedidos', authenticate, (req, res) => {
  try {
    const { items, total, address, paymentMethod } = req.body;
    if (!items || !total) return res.status(400).json({ error: 'Dados incompletos' });

    const normalizedItems = items.map(it => ({
      id: it.id || it._id,
      name: it.name,
      price: it.price,
      qty: it.qty,
      image: it.image
    }));

    const result = createOrder({
      customerId: req.user.id,
      customerEmail: req.user.email,
      items: normalizedItems,
      total,
      address,
      paymentMethod
    });

    if (!result.ok) return res.status(400).json({ error: result.error });
    res.status(201).json(result.order);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/pedidos/usuario', authenticate, (req, res) => {
  try {
    res.json(listOrdersByCustomer(req.user.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/pedidos', authenticate, isAdmin, (req, res) => {
  try {
    res.json(listOrders());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/pedidos/bulk', authenticate, isAdmin, (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs inválidos' });

    const removed = deleteOrdersBulk(ids);
    res.json({ message: `${removed} pedido(s) removido(s)` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/pedidos/:id/status', authenticate, isAdmin, (req, res) => {
  try {
    const { status } = req.body;
    const updated = updateOrderStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/admin/change-password', authenticate, isAdmin, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Dados incompletos' });

    const result = updateAdminPassword(req.user.id, currentPassword, newPassword);
    if (!result.ok) return res.status(401).json({ error: result.error });

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/upload', authenticate, isAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });

    const cloudUrl = await uploadToCloudinary(req.file.path);
    if (!cloudUrl) throw new Error('Falha ao salvar imagem na nuvem. Verifique suas credenciais do Cloudinary.');

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.json({ imageUrl: cloudUrl });
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: e.message });
  }
});

app.get('/usuarios', authenticate, isAdmin, (req, res) => {
  try {
    res.json(listUsers());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/admin-check', authenticate, isAdmin, (req, res) => res.json({ admin: true }));

app.get('/cep/:cep', async (req, res) => {
  try {
    const cep = req.params.cep.replace(/\D/g, '');
    if (cep.length !== 8) return res.status(400).json({ error: 'CEP inválido' });
    const r = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
    if (r.data.erro) return res.status(404).json({ error: 'CEP não encontrado' });
    res.json(r.data);
  } catch {
    res.status(500).json({ error: 'Erro ao consultar CEP' });
  }
});

app.get('/settings', (req, res) => {
  try {
    res.json(getSettings() || {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/settings', authenticate, isAdmin, (req, res) => {
  try {
    const { primaryColor, accentColor, siteTitle, welcomeText, logoUrl } = req.body;
    saveSettings({ primaryColor, accentColor, siteTitle, welcomeText, logoUrl });
    res.json({ message: 'Configurações salvas' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(express.static(path.join(__dirname, 'frontend'), { fallthrough: true }));
app.use('/uploads', (req, res) => res.status(404).json({ error: 'Arquivo não encontrado' }));

app.use(['/produtos', '/pedidos', '/usuarios', '/settings', '/login', '/register'], (req, res) => {
  res.status(404).json({ error: 'Rota de API não encontrada' });
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Vercel Serverless Functions: não pode usar app.listen()
// Exporta a aplicação como módulo
module.exports = app;

// Para desenvolvimento local, descomentar abaixo:
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
