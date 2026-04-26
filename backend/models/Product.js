const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, default: 'Outros' },
    stock: { type: Number, default: 0 },
    image: { type: String, default: 'https://picsum.photos/id/100/300/200' },
    description: { type: String, default: '' },
    sales: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    badge: { type: String, default: '' }, // 'bestseller', 'new', 'sale'
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
