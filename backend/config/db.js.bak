const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI não definida no .env");
        
        const conn = await mongoose.connect(process.env.MONGODB_URI);

        return conn;
    } catch (error) {


        return null;
    }
};

module.exports = connectDB;
