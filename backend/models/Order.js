const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerEmail: { type: String, required: true },
    items: [{
        id: Number,
        name: String,
        price: Number,
        qty: Number,
        image: String
    }],
    total: { type: Number, required: true },
    address: { type: String, default: '' },
    paymentMethod: { type: String, default: 'card' },
    status: { type: String, enum: ['Pendente', 'Aprovado', 'Enviado', 'Entregue', 'Cancelado'], default: 'Pendente' },
    pixQRCode: { type: String, default: '' }, // PIX Mercado Pago
    mercadoPagoId: { type: String, default: '' },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
