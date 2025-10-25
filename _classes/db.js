const { Pool, Client } = require('pg'); // Corrigido 'client' para 'Client' se for usar instâncias separadas
const admin = Client; // Isso parece incorreto, talvez fosse para ser 'new Client(db)'? Vamos manter o original por enquanto.

// Lê a configuração do banco de dados do config.js (que lê o .env)
const { db } = require('../_classes/config');

// Cria o pool de conexões
const pool = new Pool(db);

module.exports = {
  pool,
  admin // Exporta 'admin', embora seu uso pareça incerto no código original
}