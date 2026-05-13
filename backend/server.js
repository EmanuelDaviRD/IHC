const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require("multer");
const axios = require("axios");
require("dotenv").config();

const { products: Product, users: User, orders: Order, settings: Settings, initializeData } = require("./data");
const { uploadToCloudinary } = require("./config/cloudinary");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
    console.warn("⚠️ JWT_SECRET não configurada no .env");
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

// Inicializar dados
// Called in startServer()

// ===== ROTAS =====
app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "frontend", "landing.html")); });
app.get("/loja", (req, res) => { res.sendFile(path.join(__dirname, "frontend", "index.html")); });
app.get("/admin", (req, res) => { res.sendFile(path.join(__dirname, "frontend", "admin.html")); });

// ===== PRODUTOS =====
app.get("/produtos", (req, res) => {
    try {
        res.json(Product.find());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/produtos", authenticate, isAdmin, (req, res) => {
    try {
        const { name, price, category, stock, image, description, badge } = req.body;
        if (!name || price === undefined) return res.status(400).json({ error: "Nome e preço são obrigatórios" });

        const parsedPrice = parseFloat(price);
        const parsedStock = parseInt(stock) || 0;

        if (isNaN(parsedPrice) || parsedPrice < 0) return res.status(400).json({ error: "Preço inválido" });
        if (isNaN(parsedStock) || parsedStock < 0) return res.status(400).json({ error: "Estoque inválido" });

        const p = Product.create({ name, price: parsedPrice, category: category || "Outros", stock: parsedStock, image, description: description || "", badge: badge || "" });
        res.status(201).json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/produtos/:id", authenticate, isAdmin, (req, res) => {
    try {
        const fields = ['name', 'price', 'category', 'stock', 'image', 'description', 'badge'];
        const updateData = {};

        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field === 'price') {
                    const val = parseFloat(req.body[field]);
                    if (isNaN(val) || val < 0) return; // Skip invalid price
                    updateData[field] = val;
                } else if (field === 'stock') {
                    const val = parseInt(req.body[field]);
                    if (isNaN(val) || val < 0) return; // Skip invalid stock
                    updateData[field] = val;
                } else {
                    updateData[field] = req.body[field];
                }
            }
        });

        const updated = Product.findByIdAndUpdate(req.params.id, updateData);
        if (!updated) return res.status(404).json({ error: "Produto não encontrado" });
        res.json(updated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/produtos/:id", authenticate, isAdmin, (req, res) => {
    try {
        Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Produto removido" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== AUTENTICAÇÃO =====
app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: "Dados incompletos" });
        if (User.findOne({ email })) return res.status(400).json({ error: "Email já cadastrado" });
        const u = await User.create({ name, email, password: await bcrypt.hash(password, 10), role: "customer" });
        const token = jwt.sign({ id: u._id, email: u.email, role: u.role, name: u.name }, SECRET, { expiresIn: "7d" });
        res.json({ token, user: { id: u._id, name: u.name, email: u.email, role: u.role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/login", (req, res) => {
    try {
        const { email, password } = req.body;
        const u = User.findOne({ email });
        if (!u) return res.status(401).json({ error: "Credenciais inválidas" });
        bcrypt.compare(password, u.password, (err, isMatch) => {
            if (err || !isMatch) return res.status(401).json({ error: "Credenciais inválidas" });
            const token = jwt.sign({ id: u._id, email: u.email, role: u.role, name: u.name }, SECRET, { expiresIn: "7d" });
            res.json({ token, user: { id: u._id, name: u.name, email: u.email, role: u.role } });
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== PEDIDOS =====
app.post("/pedidos", authenticate, (req, res) => {
    try {
        const { items, total, address, paymentMethod } = req.body;
        if (!items || !total) return res.status(400).json({ error: "Dados incompletos" });
        for (const item of items) {
            const prod = Product.findById(item.id);
            if (!prod) return res.status(400).json({ error: "Produto não encontrado" });
            if (prod.stock < item.qty) return res.status(400).json({ error: `Estoque insuficiente para ${prod.name}` });
        }
        const o = Order.create({ customerId: req.user.id, customerEmail: req.user.email, items, total, address, paymentMethod, status: "Pendente" });
        for (const item of items) {
            const prod = Product.findById(item.id);
            if (prod) {
                prod.sales = (prod.sales || 0) + item.qty;
                prod.stock -= item.qty;
                Product.findByIdAndUpdate(item.id, prod);
            }
        }
        res.status(201).json(o);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/pedidos/usuario", authenticate, (req, res) => {
    try {
        res.json(Order.find({ customerId: req.user.id }));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/pedidos", authenticate, isAdmin, (req, res) => {
    try {
        res.json(Order.find());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/pedidos/bulk", authenticate, isAdmin, (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "IDs inválidos" });
        }
        Order.deleteMany({ _id: { $in: ids } });
        res.json({ message: `${ids.length} pedido(s) removido(s)` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/pedidos/:id/status", authenticate, isAdmin, (req, res) => {
    try {
        const { status } = req.body;
        const o = Order.findByIdAndUpdate(req.params.id, { status });
        if (!o) return res.status(404).json({ error: "Pedido não encontrado" });
        res.json(o);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== ADMIN =====
app.put("/admin/change-password", authenticate, isAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: "Dados incompletos" });

        const u = User.findById(req.user.id);
        if (!u) return res.status(404).json({ error: "Usuário não encontrado" });
        
        bcrypt.compare(currentPassword, u.password, async (err, isMatch) => {
            if (err || !isMatch) return res.status(401).json({ error: "Senha atual incorreta" });
            
            u.password = await bcrypt.hash(newPassword, 10);
            User.findByIdAndUpdate(req.user.id, u);
            res.json({ message: "Senha alterada com sucesso" });
        });
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

app.get("/usuarios", authenticate, isAdmin, (req, res) => {
    try {
        res.json(User.find());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/admin-check", authenticate, isAdmin, (req, res) => { res.json({ admin: true }); });

// ===== CEP =====
app.get("/cep/:cep", (req, res) => {
    try {
        const cep = req.params.cep.replace(/\D/g, '');
        if (cep.length !== 8) return res.status(400).json({ error: "CEP inválido" });
        axios.get(`https://viacep.com.br/ws/${cep}/json/`).then(r => {
            if (r.data.erro) return res.status(404).json({ error: "CEP não encontrado" });
            res.json(r.data);
        }).catch(() => res.status(500).json({ error: "Erro ao consultar CEP" }));
    } catch { res.status(500).json({ error: "Erro ao consultar CEP" }); }
});

// ===== SETTINGS =====
app.get("/settings", (req, res) => {
    try {
        res.json(Settings.findOne());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/settings", authenticate, isAdmin, (req, res) => {
    try {
        const { primaryColor, accentColor, siteTitle, welcomeText, logoUrl } = req.body;
        const s = Settings.findOneAndUpdate({}, { primaryColor, accentColor, siteTitle, welcomeText, logoUrl });
        res.json({ message: "Configurações salvas" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== STATIC FILES =====
app.use(express.static(path.join(__dirname, "frontend"), {
    fallthrough: true
}));

app.use("/uploads", (req, res) => res.status(404).json({ error: "Arquivo não encontrado" }));

app.use(['/produtos', '/pedidos', '/usuarios', '/settings', '/login', '/register'], (req, res) => {
    res.status(404).json({ error: "Rota de API não encontrada" });
});

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

async function startServer() {
    await initializeData();
    app.listen(PORT, () => {
        console.log(`✅ Servidor rodando na porta ${PORT}`);
        console.log(`📍 Admin: admin@edclaudia.com / admin123`);
    });
}

startServer();
