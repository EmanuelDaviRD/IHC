const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI não definida no .env");
        
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`❌ Erro de Conexão MongoDB: ${error.message}`);
        console.log('⚠️  Usando fallback JSON...');
        return null;
    }
};

module.exports = connectDB;
