// Exemplo em bot.js
require('dotenv').config(); // Se usar dotenv
const config = require("./_classes/config"); // Seu arquivo de config
const NisrukshaShardManager = require('./_classes/manager/ShardingManager'); // A nova classe

// Validar config básica aqui se necessário

// Instancia o manager com as configurações
const manager = new NisrukshaShardManager(config);

// Inicia o processo de sharding
manager.connect()
    .then(() => {
        console.log('[Bot] Sharding iniciado com sucesso.');
    })
    .catch(err => {
        console.error('[Bot] Falha fatal ao iniciar sharding:', err);
        process.exit(1);
    });

// Opcional: Manter o processo principal vivo ou adicionar mais lógica aqui
// (Ex: Um servidor web para health checks)