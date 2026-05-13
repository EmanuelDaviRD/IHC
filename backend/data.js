const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const dataFile = path.join(__dirname, 'data.json');

let data = {
    users: [],
    products: [],
    orders: [],
    settings: {
        primaryColor: '#c9a96e',
        accentColor: '#7c6fae',
        siteTitle: 'Edcláudia Ribeiro',
        welcomeText: 'Beleza que inspira',
        logoUrl: ''
    }
};

// Carregar dados do arquivo JSON
function loadData() {
    try {
        if (fs.existsSync(dataFile)) {
            data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        } else {
            saveData();
        }
    } catch (err) {
        console.error('Erro ao carregar dados:', err);
    }
}

// Salvar dados em arquivo JSON
function saveData() {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Erro ao salvar dados:', err);
    }
}

// Inicializar dados
loadData();

// ===== PRODUTOS =====
const products = {
    find: (query = {}) => {
        let filtered = data.products;
        if (query.name) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(query.name.toLowerCase()));
        }
        return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    
    findById: (id) => {
        return data.products.find(p => p._id === id);
    },
    
    create: (productData) => {
        const id = Date.now().toString();
        const product = {
            _id: id,
            name: productData.name,
            price: parseFloat(productData.price),
            category: productData.category || 'Outros',
            stock: parseInt(productData.stock) || 0,
            image: productData.image || 'https://picsum.photos/id/100/300/200',
            description: productData.description || '',
            sales: 0,
            featured: productData.featured || false,
            badge: productData.badge || '',
            createdAt: new Date()
        };
        data.products.push(product);
        saveData();
        return product;
    },
    
    findByIdAndUpdate: (id, updateData) => {
        const product = data.products.find(p => p._id === id);
        if (!product) return null;
        Object.assign(product, updateData);
        saveData();
        return product;
    },
    
    findByIdAndDelete: (id) => {
        data.products = data.products.filter(p => p._id !== id);
        saveData();
        return true;
    },
    
    deleteMany: (query) => {
        // Para limpar todos
        data.products = [];
        saveData();
    }
};

// ===== USUÁRIOS =====
const users = {
    find: (query = {}) => {
        let filtered = data.users;
        if (query.email) {
            filtered = filtered.filter(u => u.email === query.email);
        }
        return filtered.map(u => {
            const copy = { ...u };
            delete copy.password;
            return copy;
        });
    },
    
    findOne: (query = {}) => {
        if (query.email) {
            return data.users.find(u => u.email === query.email);
        }
        if (query.role) {
            return data.users.find(u => u.role === query.role);
        }
        return null;
    },
    
    findById: (id) => {
        return data.users.find(u => u._id === id);
    },
    
    create: async (userData) => {
        if (data.users.find(u => u.email === userData.email)) {
            throw new Error('Email já cadastrado');
        }
        const id = Date.now().toString();
        const user = {
            _id: id,
            name: userData.name,
            email: userData.email,
            password: userData.password,
            role: userData.role || 'customer',
            phone: userData.phone || '',
            address: userData.address || '',
            createdAt: new Date()
        };
        data.users.push(user);
        saveData();
        return user;
    },
    
    findByIdAndUpdate: (id, updateData) => {
        const user = data.users.find(u => u._id === id);
        if (!user) return null;
        Object.assign(user, updateData);
        saveData();
        return user;
    }
};

// ===== PEDIDOS =====
const orders = {
    find: (query = {}) => {
        let filtered = data.orders;
        if (query.customerId) {
            filtered = filtered.filter(o => o.customerId === query.customerId);
        }
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    
    findOne: (query = {}) => {
        return data.orders.find(o => 
            (query._id && o._id === query._id) ||
            (query.customerId && o.customerId === query.customerId)
        );
    },
    
    create: (orderData) => {
        const id = Date.now().toString();
        const order = {
            _id: id,
            customerId: orderData.customerId,
            customerEmail: orderData.customerEmail,
            items: orderData.items,
            total: orderData.total,
            address: orderData.address || '',
            paymentMethod: orderData.paymentMethod || 'card',
            status: orderData.status || 'Pendente',
            pixQRCode: orderData.pixQRCode || '',
            mercadoPagoId: orderData.mercadoPagoId || '',
            date: new Date()
        };
        data.orders.push(order);
        saveData();
        return order;
    },
    
    findByIdAndUpdate: (id, updateData) => {
        const order = data.orders.find(o => o._id === id);
        if (!order) return null;
        Object.assign(order, updateData);
        saveData();
        return order;
    },
    
    deleteMany: (query) => {
        if (query._id && query._id.$in) {
            data.orders = data.orders.filter(o => !query._id.$in.includes(o._id));
            saveData();
        }
    }
};

// ===== SETTINGS =====
const settings = {
    findOne: () => {
        return data.settings;
    },
    
    findOneAndUpdate: (query, updateData) => {
        Object.assign(data.settings, updateData);
        saveData();
        return data.settings;
    }
};

// ===== FUNÇÃO PARA INICIALIZAR DADOS =====
async function initializeData() {
    try {
        // Verificar se admin existe
        const adminExists = users.findOne({ role: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await users.create({
                name: 'Admin',
                email: 'admin@edclaudia.com',
                password: hashedPassword,
                role: 'admin'
            });
        }

        // Criar 10 produtos de exemplo se não existir nenhum
        if (data.products.length === 0) {
            const produtosExemplo = [
                {
                    name: 'Shampoo Nutritivo',
                    price: 45.90,
                    category: 'Cabelos',
                    stock: 15,
                    image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&h=300&fit=crop',
                    description: 'Shampoo nutritivo para cabelos secos e danificados',
                    badge: 'bestseller'
                },
                {
                    name: 'Condicionador Premium',
                    price: 52.90,
                    category: 'Cabelos',
                    stock: 12,
                    image: 'https://images.unsplash.com/photo-1599599810694-e3007dc796d7?w=400&h=300&fit=crop',
                    description: 'Condicionador premium com proteínas naturais',
                    badge: 'new'
                },
                {
                    name: 'Máscara Facial Hidratante',
                    price: 68.90,
                    category: 'Rosto',
                    stock: 20,
                    image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&h=300&fit=crop',
                    description: 'Máscara facial com aloe vera e vitamina C',
                    featured: true
                },
                {
                    name: 'Sérum Facial Anti-Idade',
                    price: 89.90,
                    category: 'Rosto',
                    stock: 10,
                    image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&h=300&fit=crop',
                    description: 'Sérum com retinol e ácido hialurônico',
                    badge: 'sale'
                },
                {
                    name: 'Creme Corporal Hidratante',
                    price: 39.90,
                    category: 'Corpo',
                    stock: 25,
                    image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&h=300&fit=crop',
                    description: 'Creme corporal com manteiga de karité',
                    badge: 'bestseller'
                },
                {
                    name: 'Óleo Corporal Aromático',
                    price: 49.90,
                    category: 'Corpo',
                    stock: 18,
                    image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=300&fit=crop',
                    description: 'Óleo corporal com aromas relaxantes',
                    badge: 'new'
                },
                {
                    name: 'Batom Matte Profissional',
                    price: 34.90,
                    category: 'Maquiagem',
                    stock: 30,
                    image: 'https://images.unsplash.com/photo-1596462502278-af60762c3598?w=400&h=300&fit=crop',
                    description: 'Batom matte com longa duração',
                    featured: true
                },
                {
                    name: 'Paleta de Sombras 12 cores',
                    price: 59.90,
                    category: 'Maquiagem',
                    stock: 14,
                    image: 'https://images.unsplash.com/photo-1614730321751-fcc4623d1d6f?w=400&h=300&fit=crop',
                    description: 'Paleta de sombras com pigmentação intensa'
                },
                {
                    name: 'Perfume Floral 100ml',
                    price: 129.90,
                    category: 'Perfumaria',
                    stock: 8,
                    image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&h=300&fit=crop',
                    description: 'Perfume floral com notas de rosas e jasmim',
                    badge: 'bestseller'
                },
                {
                    name: 'Desodorante Natural',
                    price: 29.90,
                    category: 'Higiene',
                    stock: 40,
                    image: 'https://images.unsplash.com/photo-1599599810694-e3007dc796d7?w=400&h=300&fit=crop',
                    description: 'Desodorante natural com 24h de proteção',
                    badge: 'new'
                }
            ];

            for (const produto of produtosExemplo) {
                products.create(produto);
            }
        }
    } catch (err) {
        console.error('Erro ao inicializar dados:', err);
    }
}

module.exports = {
    products,
    users,
    orders,
    settings,
    initializeData,
    saveData,
    getData: () => data
};
