// _classes/config.js
require("dotenv").config(); // Carrega variáveis de ambiente do arquivo .env

module.exports = {
    // IDs dos proprietários do bot
    owner: ["422002630106152970"],

    // Prefixo (útil se ainda houver comandos de mensagem ou como fallback)
    prefix: "/",

    // Configurações da aplicação Discord
    app: {
        token: process.env.DISCORD_TOKEN || "SEU_TOKEN_AQUI", // Token do Bot (prioriza variável de ambiente)
        id: process.env.DISCORD_CLIENT_ID || "SEU_CLIENT_ID_AQUI", // ID do Cliente/Aplicação (prioriza variável de ambiente)
    },

    // --- REMOVIDO: Configuração antiga do PostgreSQL/Knex ---
    // db: { ... },

    // +++ ADICIONADO: Configuração do MongoDB +++
    mongodb: {
        // String de conexão URI do MongoDB
        // Exemplos:
        //   - Local: "mongodb://localhost:27017"
        //   - Docker Compose (serviço chamado 'mongo'): "mongodb://mongo:27017"
        //   - Atlas: "mongodb+srv://<usuario>:<senha>@<cluster-url>/"
        uri: process.env.MONGODB_URI || "mongodb+srv://guiifarias34_db_user:x0rI5uRZxsYMQcqf@cluster0.nvdchx6.mongodb.net/?appName=Cluster0", // Prioriza variável de ambiente

        // Nome do banco de dados a ser utilizado
        databaseName: process.env.MONGODB_DB_NAME || "nisruksha_bot_db", // Prioriza variável de ambiente
    },

    // Configurações de Sharding
    sharding: {
        shardAmount: "auto", // Quantidade de shards ('auto' calcula automaticamente, ou use um número)
    },

    // Configurações do Top.gg (se aplicável)
    dbl: {
        token: process.env.TOPGG_TOKEN || null, // Token do Top.gg (prioriza variável de ambiente)
    },

    // Configurações do Servidor Web (se aplicável, para /vote, health checks, etc.)
    ip: process.env.SERVER_IP || "localhost", // IP onde o servidor Express (se houver) escutará
    port: process.env.PORT || 3000, // Porta para o servidor Express

    // Configurações de Módulos (Exemplo - Mantenha as suas configurações existentes)
    modules: {
        events: {
            channel: process.env.EVENTS_CHANNEL_ID || "SEU_CANAL_DE_EVENTOS_ID", // ID do canal para anúncios de eventos
            minInterval: 60, // Intervalo mínimo entre eventos (em minutos)
            maxInterval: 180, // Intervalo máximo entre eventos (em minutos)
            race: {
                time: 15 // Duração das apostas na corrida (em minutos)
            }
        },
        cotacao: 60, // Intervalo da cotação (em minutos)
        discount: 120, // Intervalo dos descontos na loja (em minutos)
        // Adicione outras configurações de módulos aqui...
    }
};