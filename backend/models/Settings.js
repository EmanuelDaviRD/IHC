const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    primaryColor: { type: String, default: '#c9a96e' },
    accentColor: { type: String, default: '#7c6fae' },
    siteTitle: { type: String, default: 'Edcláudia Ribeiro' },
    welcomeText: { type: String, default: 'Beleza que inspira' },
    logoUrl: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Settings', SettingsSchema);
