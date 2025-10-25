// _classes/db.js

const { MongoClient, ServerApiVersion } = require('mongodb');
const config = require('./config'); // Importa a configuração
require('colors'); // Para usar .green e .red nos logs

const uri = config.mongodb.uri;
const dbName = config.mongodb.databaseName;

// Cria um novo MongoClient com opções recomendadas
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1, // Usa a versão estável da API do Servidor
    strict: true,
    deprecationErrors: true,
  },
});

let dbInstance = null; // Variável para armazenar a instância do banco de dados (singleton)
let connectionPromise = null; // Para evitar múltiplas tentativas de conexão simultâneas

/**
 * Conecta ao MongoDB e retorna a instância do banco de dados.
 * Usa um padrão singleton para garantir que a conexão seja feita apenas uma vez.
 * @returns {Promise<Db>} A instância do banco de dados do MongoDB.
 */
async function connectDB() {
  // Se a instância já existe, retorna-a imediatamente.
  if (dbInstance) {
    return dbInstance;
  }

  // Se uma conexão já está em andamento, aguarda sua conclusão.
  if (connectionPromise) {
    return connectionPromise;
  }

  // Inicia uma nova promessa de conexão.
  connectionPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('[MongoDB] Conectando ao banco de dados...'.yellow);
      await client.connect();

      // Confirma a conexão enviando um ping (melhor prática)
      await client.db("admin").command({ ping: 1 });
      console.log("[MongoDB] Ping confirmado. Conectado com sucesso ao servidor!".green);

      dbInstance = client.db(dbName); // Armazena a instância do DB para uso futuro
      resolve(dbInstance);
    } catch (err) {
      console.error('[MongoDB] ERRO FATAL ao conectar ao banco de dados:'.red, err);
      connectionPromise = null; // Reseta a promessa em caso de erro
      reject(err);
      process.exit(1); // Encerra o processo se a conexão inicial falhar
    }
  });

  return connectionPromise;
}

/**
 * Retorna a instância do MongoClient (útil para transações ou outras operações avançadas).
 * @returns {MongoClient} A instância do cliente MongoDB.
 */
function getClient() {
    return client;
}

// Lida com o fechamento da conexão ao encerrar o processo do bot
const gracefulShutdown = async (signal) => {
    if (client && client.topology && client.topology.isConnected()) {
        console.log(`[MongoDB] Recebido ${signal}. Fechando conexão com o banco de dados...`.yellow);
        await client.close();
        console.log('[MongoDB] Conexão fechada.'.green);
    }
    process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Exporta as funções para serem usadas em outros módulos
module.exports = {
    connectDB,
    getClient,
};