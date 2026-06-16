/**
 * Vercel Serverless Function Handler
 * Este arquivo é o entry point para as Serverless Functions da Vercel
 * Importa e exporta a aplicação Express como handler
 */

const app = require('../backend/server');

// Exporta a aplicação Express como handler padrão
module.exports = app;
