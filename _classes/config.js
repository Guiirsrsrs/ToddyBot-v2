// Este config.js está 100% configurado para ler variáveis de ambiente

// Helper para garantir que a lista de donos seja um array
// Permite que o OWNER_ID no .env seja "id1" ou "id1,id2,id3"
const parseOwners = (envVar) => {
    if (!envVar) return ["422002630106152970"]; // Um padrão de fallback
    return envVar.split(',').map(id => id.trim());
}

module.exports = {
    // --- Configurações Lidas do .env ---
    prefix: process.env.PREFIX || ".",
    owner: parseOwners(process.env.OWNER_ID),

    ip: process.env.APP_IP || "localhost",
    port: parseInt(process.env.APP_PORT, 10) || 80,

    // --- LÊ AS VARIÁVEIS DE AMBIENTE DO BANCO DE DADOS ---
    db: {
        user: process.env.DB_USER,
        host: process.env.DB_HOST, // Será 'db' no docker, 'localhost' fora
        database: process.env.DB_DATABASE,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT, 10) || 5432,
    },

    // --- LÊ AS VARIÁVEIS DE API DE LISTAS ---
    best: {
        token: process.env.BEST_TOKEN || "",
        voteLogs_channel: process.env.BEST_VOTE_LOGS_CHANNEL || ""
    },

    dbl: {
        token: process.env.DBL_TOKEN || "",
        webhookAuthPass: process.env.DBL_WEBHOOK_AUTH_PASS || "",
        voteLogs_channel: process.env.DBL_VOTE_LOGS_CHANNEL || ""
    },
    
    // --- LÊ AS VARIÁVEIS DE AMBIENTE DO BOT ---
    app: {
        token: process.env.BOT_TOKEN,
        secret: process.env.BOT_SECRET,
        id: process.env.BOT_ID,
        callback: "/oauth2/callback", // Configuração estática

        system: {
            timeout: 120000 // Configuração estática
        }
    },

    // --- Configurações Estáticas do Bot (Não precisam estar no .env) ---
    sharding: {
        shardAmount: 'auto'
    },

    modules: {
        cotacao: 20, // em minutos
        discount: 60, // em minutos
        events: {
            channel: "",
            minInterval: 30, // em minutos
            maxInterval: 60,

            race: {
                time: 30 // Tempo para apostas, em minutos
            }
        }
    }
}