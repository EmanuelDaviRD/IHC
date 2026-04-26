const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/edclaudia_store', {
            // Mongoose 6+ não precisa dessas opções
        });
        console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`❌ Erro MongoDB: ${error.message}`);
        // Fallback para JSON se MongoDB não disponível
        console.log('⚠️  Usando fallback JSON...');
        return null;
    }
};

module.exports = connectDB;
