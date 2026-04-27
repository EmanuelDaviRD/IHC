const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require("multer");
const axios = require("axios");
require("dotenv").config();

const connectDB = require("./config/db");
const User = require("./models/User");
const Product = require("./models/Product");
const Order = require("./models/Order");
const { uploadToCloudinary } = require("./config/cloudinary");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
    console.warn("⚠️ JWT_SECRET não definido. Usando padrão para desenvolvimento.");
}

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, path.join(__dirname, "uploads")); },
    filename: (req, file, cb) => {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const DB_PATH = path.join(__dirname, "database.json");
let useMongo = false;

function readDB() {
    if (!fs.existsSync(DB_PATH)) {
        const initialData = {
            users: [{ id: 1, name: "Admin", email: "admin@edclaudia.com", password: "$2b$10$2FCGMLcWsnDzyw/AzZx7Ouqyf3rA2kpQnU1pZuph8utwCQbgWeL3m", role: "admin" }],
            products: [
                { id: 1, name: "Ekos Castanha Hidratante", price: 59.9, category: "Natura", stock: 20, image: "https://picsum.photos/id/20/300/200", description: "Hidratação intensa.", sales: 12 },
                { id: 2, name: "Malbec Perfume", price: 139.9, category: "O Boticário", stock: 15, image: "https://picsum.photos/id/12/300/200", description: "Fragrância amadeirada.", sales: 25 },
                { id: 3, name: "Luna Feminino Avon", price: 69.9, category: "Avon", stock: 30, image: "https://picsum.photos/id/26/300/200", description: "Suave e feminino.", sales: 8 },
                { id: 4, name: "Chronos Anti-Idade", price: 89.9, category: "Natura", stock: 10, image: "https://picsum.photos/id/29/300/200", description: "Creme facial.", sales: 5 }
            ],
            orders: [],
            settings: {}
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    return JSON.parse(fs.readFileSync(DB_PATH));
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token não fornecido" });
    const token = authHeader.split(" ")[1];
    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch {
        return res.status(403).json({ error: "Token inválido" });
    }
}

function isAdmin(req, res, next) {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Acesso negado" });
    next();
}

async function seedAdmin() {
    try {
        const adminExists = await User.findOne({ role: "admin" });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash("admin123", 10);
            const admin = new User({
                name: "Admin",
                email: "admin@edclaudia.com",
                password: hashedPassword,
                role: "admin"
            });
            await admin.save();
            console.log("👤 Admin padrão criado no MongoDB: admin@edclaudia.com / admin123");
        }
    } catch (err) { console.error("❌ Erro ao criar admin inicial:", err.message); }
}

connectDB().then(async conn => { 
    if (conn) { useMongo = true; await seedAdmin(); }
}).catch(err => {
    console.error("❌ Erro ao conectar no MongoDB:", err.message);
});

app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "frontend", "landing.html")); });
app.get("/loja", (req, res) => { res.sendFile(path.join(__dirname, "frontend", "index.html")); });
app.get("/admin", (req, res) => { res.sendFile(path.join(__dirname, "frontend", "admin.html")); });

app.get("/produtos", async (req, res) => {
    try {
        if (useMongo) return res.json(await Product.find().sort({ createdAt: -1 }));
        res.json(readDB().products);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/produtos", authenticate, isAdmin, async (req, res) => {
    try {
        const { name, price, category, stock, image, description, badge } = req.body;
        if (!name || !price) return res.status(400).json({ error: "Nome e preço são obrigatórios" });
        if (useMongo) {
            const p = new Product({ name, price: parseFloat(price), category: category || "Outros", stock: parseInt(stock) || 0, image: image || "https://picsum.photos/id/100/300/200", description: description || "", badge: badge || "" });
            await p.save();
            return res.status(201).json(p);
        }
        const db = readDB();
        const p = { id: Date.now(), name, price: parseFloat(price), category: category || "Outros", stock: parseInt(stock) || 0, image: image || "https://picsum.photos/id/100/300/200", description: description || "", sales: 0, badge: badge || "" };
        db.products.push(p);
        writeDB(db);
        res.status(201).json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/produtos/:id", authenticate, isAdmin, async (req, res) => {
    try {
        const { name, price, category, stock, image, description, badge } = req.body;
        if (useMongo) {
            const updateData = {};
            if (name !== undefined) updateData.name = name;
            if (price !== undefined) updateData.price = parseFloat(price);
            if (category !== undefined) updateData.category = category;
            if (stock !== undefined) updateData.stock = parseInt(stock);
            if (image !== undefined) updateData.image = image;
            if (description !== undefined) updateData.description = description;
            if (badge !== undefined) updateData.badge = badge;
            const updated = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
            if (!updated) return res.status(404).json({ error: "Produto não encontrado" });
            return res.json(updated);
        }
        const db = readDB();
        const idx = db.products.findIndex(p => p.id == req.params.id);
        if (idx === -1) return res.status(404).json({ error: "Produto não encontrado" });
        db.products[idx] = { ...db.products[idx], name, price: price !== undefined ? parseFloat(price) : db.products[idx].price, category, stock: stock !== undefined ? parseInt(stock) : db.products[idx].stock, image, description, badge };
        writeDB(db);
        res.json(db.products[idx]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/produtos/:id", authenticate, isAdmin, async (req, res) => {
    try {
        if (useMongo) {
            await Product.findByIdAndDelete(req.params.id);
            return res.json({ message: "Produto removido" });
        }
        const db = readDB();
        db.products = db.products.filter(p => p.id != req.params.id);
        writeDB(db);
        res.json({ message: "Produto removido" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: "Dados incompletos" });
        if (useMongo) {
            if (await User.findOne({ email })) return res.status(400).json({ error: "Email já cadastrado" });
            const u = new User({ name, email, password: await bcrypt.hash(password, 10), role: "customer" });
            await u.save();
            const token = jwt.sign({ id: u._id, email: u.email, role: u.role, name: u.name }, SECRET, { expiresIn: "7d" });
            return res.json({ token, user: { id: u._id, name: u.name, email: u.email, role: u.role } });
        }
        const db = readDB();
        if (db.users.find(u => u.email === email)) return res.status(400).json({ error: "Email já cadastrado" });
        const u = { id: Date.now(), name, email, password: await bcrypt.hash(password, 10), role: "customer" };
        db.users.push(u);
        writeDB(db);
        const token = jwt.sign({ id: u.id, email: u.email, role: u.role, name: u.name }, SECRET, { expiresIn: "7d" });
        res.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (useMongo) {
            const u = await User.findOne({ email });
            if (!u || !(await bcrypt.compare(password, u.password))) return res.status(401).json({ error: "Credenciais inválidas" });
            const token = jwt.sign({ id: u._id, email: u.email, role: u.role, name: u.name }, SECRET, { expiresIn: "7d" });
            return res.json({ token, user: { id: u._id, name: u.name, email: u.email, role: u.role } });
        }
        const db = readDB();
        const u = db.users.find(u => u.email === email);
        if (!u || !(await bcrypt.compare(password, u.password))) return res.status(401).json({ error: "Credenciais inválidas" });
        const token = jwt.sign({ id: u.id, email: u.email, role: u.role, name: u.name }, SECRET, { expiresIn: "7d" });
        res.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/pedidos", authenticate, async (req, res) => {
    try {
        const { items, total, address, paymentMethod } = req.body;
        if (!items || !total) return res.status(400).json({ error: "Dados incompletos" });
        if (useMongo) {
            for (const item of items) {
                const prod = await Product.findById(item.id);
                if (!prod) return res.status(400).json({ error: "Produto não encontrado" });
                if (prod.stock < item.qty) return res.status(400).json({ error: `Estoque insuficiente para ${prod.name}` });
            }
            const o = new Order({ customerId: req.user.id, customerEmail: req.user.email, items, total, address, paymentMethod, status: "Pendente" });
            await o.save();
            for (const item of items) await Product.findByIdAndUpdate(item.id, { $inc: { sales: item.qty, stock: -item.qty } });
            return res.status(201).json(o);
        }
        const db = readDB();
        for (const item of items) {
            const prod = db.products.find(p => p.id == item.id);
            if (!prod) return res.status(400).json({ error: `Produto ${item.id} não encontrado` });
            if (prod.stock < item.qty) return res.status(400).json({ error: `Estoque insuficiente para ${prod.name}` });
        }
        const o = { id: Date.now(), customerId: req.user.id, customerEmail: req.user.email, items, total, address, paymentMethod, status: "Pendente", date: new Date().toISOString() };
        db.orders.push(o);
        items.forEach(item => { const p = db.products.find(p => p.id == item.id); if (p) { p.sales = (p.sales || 0) + item.qty; p.stock -= item.qty; } });
        writeDB(db);
        res.status(201).json(o);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/pedidos/usuario", authenticate, async (req, res) => {
    try {
        if (useMongo) return res.json(await Order.find({ customerId: req.user.id }).sort({ date: -1 }));
        res.json(readDB().orders.filter(o => o.customerId == req.user.id));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/pedidos", authenticate, isAdmin, async (req, res) => {
    try {
        if (useMongo) return res.json(await Order.find().sort({ date: -1 }).populate('customerId', 'name email'));
        res.json(readDB().orders);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/pedidos/bulk", authenticate, isAdmin, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "IDs inválidos" });
        }
        if (useMongo) {
            await Order.deleteMany({ _id: { $in: ids } });
            return res.json({ message: `${ids.length} pedido(s) removido(s)` });
        }
        const db = readDB();
        db.orders = db.orders.filter(o => !ids.includes(String(o.id)));
        writeDB(db);
        res.json({ message: `${ids.length} pedido(s) removido(s)` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/pedidos/:id/status", authenticate, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (useMongo) {
            const o = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
            return res.json(o);
        }
        const db = readDB();
        const o = db.orders.find(o => o.id == req.params.id);
        if (o) { o.status = status; writeDB(db); }
        res.json(o);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/upload", authenticate, isAdmin, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Nenhuma imagem enviada" });
        const cloudUrl = await uploadToCloudinary(req.file.path);
        
        if (cloudUrl) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.json({ imageUrl: cloudUrl });
        }
        res.json({ imageUrl: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}` });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Erro no processamento da imagem" });
    }
});

app.get("/usuarios", authenticate, isAdmin, async (req, res) => {
    try {
        if (useMongo) return res.json(await User.find().select('-password'));
        res.json(readDB().users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/admin-check", authenticate, isAdmin, (req, res) => { res.json({ admin: true }); });

app.get("/cep/:cep", async (req, res) => {
    try {
        const cep = req.params.cep.replace(/\D/g, '');
        if (cep.length !== 8) return res.status(400).json({ error: "CEP inválido" });
        const r = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
        if (r.data.erro) return res.status(404).json({ error: "CEP não encontrado" });
        res.json(r.data);
    } catch { res.status(500).json({ error: "Erro ao consultar CEP" }); }
});

app.get("/settings", async (req, res) => {
    try {
        if (useMongo) {
            const Settings = require("./models/Settings");
            const s = await Settings.findOne();
            return res.json(s || {});
        }
        res.json(readDB().settings || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/settings", authenticate, isAdmin, async (req, res) => {
    try {
        const { primaryColor, accentColor, siteTitle, welcomeText, logoUrl } = req.body;
        if (useMongo) {
            const Settings = require("./models/Settings");
            await Settings.findOneAndUpdate({}, { primaryColor, accentColor, siteTitle, welcomeText, logoUrl }, { upsert: true });
            return res.json({ message: "Configurações salvas" });
        }
        const db = readDB();
        db.settings = { primaryColor, accentColor, siteTitle, welcomeText, logoUrl };
        writeDB(db);
        res.json({ message: "Configurações salvas" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use(express.static(path.join(__dirname, "frontend"), { index: false }));

app.use((req, res) => {
    const apiPrefixes = ['/produtos', '/pedidos', '/register', '/login', '/upload', '/usuarios', '/admin-check', '/cep', '/settings', '/uploads'];
    const isApi = apiPrefixes.some(prefix => req.path.startsWith(prefix));
    const isFile = req.path.includes('.');
    
    if (isApi || isFile) return res.status(404).json({ error: "Recurso não encontrado" });
    
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📄 Landing: http://localhost:${PORT}/`);
    console.log(`🛒 Loja: http://localhost:${PORT}/loja`);
    console.log(`👑 Admin: http://localhost:${PORT}/admin`);
    console.log(`💾 Banco: ${useMongo ? 'MongoDB' : 'JSON (fallback)'}`);
    console.log(`📱 Checkout: 100% via WhatsApp`);
});
