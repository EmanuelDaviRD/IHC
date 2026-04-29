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
const Settings = require("./models/Settings");
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

connectDB().then(async () => { 
    await seedAdmin(); 
}).catch(err => {
    console.error("❌ Erro ao conectar no MongoDB:", err.message);
});

app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "frontend", "landing.html")); });
app.get("/loja", (req, res) => { res.sendFile(path.join(__dirname, "frontend", "index.html")); });
app.get("/admin", (req, res) => { res.sendFile(path.join(__dirname, "frontend", "admin.html")); });

app.get("/produtos", async (req, res) => {
    try {
        res.json(await Product.find().sort({ createdAt: -1 }));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/produtos", authenticate, isAdmin, async (req, res) => {
    try {
        const { name, price, category, stock, image, description, badge } = req.body;
        if (!name || !price) return res.status(400).json({ error: "Nome e preço são obrigatórios" });
        const p = new Product({ name, price: parseFloat(price), category: category || "Outros", stock: parseInt(stock) || 0, image, description: description || "", badge: badge || "" });
        await p.save();
        res.status(201).json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/produtos/:id", authenticate, isAdmin, async (req, res) => {
    try {
        const fields = ['name', 'price', 'category', 'stock', 'image', 'description', 'badge'];
        const updateData = {};
        
        fields.forEach(field => {
            if (req.body[field] !== undefined) updateData[field] = req.body[field];
        });

        const updated = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!updated) return res.status(404).json({ error: "Produto não encontrado" });
        res.json(updated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/produtos/:id", authenticate, isAdmin, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Produto removido" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: "Dados incompletos" });
        if (await User.findOne({ email })) return res.status(400).json({ error: "Email já cadastrado" });
        const u = new User({ name, email, password: await bcrypt.hash(password, 10), role: "customer" });
        await u.save();
        const token = jwt.sign({ id: u._id, email: u.email, role: u.role, name: u.name }, SECRET, { expiresIn: "7d" });
        res.json({ token, user: { id: u._id, name: u.name, email: u.email, role: u.role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const u = await User.findOne({ email });
        if (!u || !(await bcrypt.compare(password, u.password))) return res.status(401).json({ error: "Credenciais inválidas" });
        const token = jwt.sign({ id: u._id, email: u.email, role: u.role, name: u.name }, SECRET, { expiresIn: "7d" });
        res.json({ token, user: { id: u._id, name: u.name, email: u.email, role: u.role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/pedidos", authenticate, async (req, res) => {
    try {
        const { items, total, address, paymentMethod } = req.body;
        if (!items || !total) return res.status(400).json({ error: "Dados incompletos" });
        for (const item of items) {
            const prod = await Product.findById(item.id);
            if (!prod) return res.status(400).json({ error: "Produto não encontrado" });
            if (prod.stock < item.qty) return res.status(400).json({ error: `Estoque insuficiente para ${prod.name}` });
        }
        const o = new Order({ customerId: req.user.id, customerEmail: req.user.email, items, total, address, paymentMethod, status: "Pendente" });
        await o.save();
        for (const item of items) await Product.findByIdAndUpdate(item.id, { $inc: { sales: item.qty, stock: -item.qty } });
        res.status(201).json(o);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/pedidos/usuario", authenticate, async (req, res) => {
    try {
        res.json(await Order.find({ customerId: req.user.id }).sort({ date: -1 }));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/pedidos", authenticate, isAdmin, async (req, res) => {
    try {
        res.json(await Order.find().sort({ date: -1 }).populate('customerId', 'name email'));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/pedidos/bulk", authenticate, isAdmin, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "IDs inválidos" });
        }
        await Order.deleteMany({ _id: { $in: ids } });
        res.json({ message: `${ids.length} pedido(s) removido(s)` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/pedidos/:id/status", authenticate, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const o = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!o) return res.status(404).json({ error: "Pedido não encontrado" });
        res.json(o);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/admin/change-password", authenticate, isAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: "Dados incompletos" });

        const u = await User.findById(req.user.id);
        if (!u || !(await bcrypt.compare(currentPassword, u.password))) {
            return res.status(401).json({ error: "Senha atual incorreta" });
        }

        u.password = await bcrypt.hash(newPassword, 10);
        await u.save();
        res.json({ message: "Senha alterada com sucesso" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/upload", authenticate, isAdmin, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Nenhuma imagem enviada" });

        const cloudUrl = await uploadToCloudinary(req.file.path);
        
        if (!cloudUrl) {
            throw new Error("Falha ao salvar imagem na nuvem. Verifique suas credenciais do Cloudinary.");
        }

        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.json({ imageUrl: cloudUrl });

    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: err.message });
    }
});

app.get("/usuarios", authenticate, isAdmin, async (req, res) => {
    try {
        res.json(await User.find().select('-password'));
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
        const s = await Settings.findOne();
        res.json(s || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/settings", authenticate, isAdmin, async (req, res) => {
    try {
        const { primaryColor, accentColor, siteTitle, welcomeText, logoUrl } = req.body;
        await Settings.findOneAndUpdate({}, { primaryColor, accentColor, siteTitle, welcomeText, logoUrl }, { upsert: true });
        res.json({ message: "Configurações salvas" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use(express.static(path.join(__dirname, "frontend"), {
    fallthrough: true // Permite que rotas não encontradas sigam para o fallback do SPA
}));

// Garante que arquivos inexistentes na pasta uploads não retornem o index.html
app.use("/uploads", (req, res) => res.status(404).json({ error: "Arquivo não encontrado" }));

// Proteção para rotas de API não encontradas
app.use(['/produtos', '/pedidos', '/usuarios', '/settings', '/login', '/register'], (req, res) => {
    res.status(404).json({ error: "Rota de API não encontrada" });
});

// Fallback para o frontend (SPA)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Online na porta ${PORT}`);
    console.log(`💾 Banco de Dados: MongoDB Ativo`);
    console.log(`📁 Modo: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📱 Destino WhatsApp: 5588981078835`);
});
