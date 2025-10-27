// _classes/api/index.js

// Importa e reexporta o DatabaseManager para fácil acesso
const DatabaseManager = require('../manager/DatabaseManager');

// Carrega todos os módulos e utilitários
const API = {
    // Gestor de Base de Dados (Instância será injetada pelo ToddyClient)
    db: null, // Será preenchido pelo client.start()
    DatabaseManager: DatabaseManager, // Exporta a classe para referência (se necessário)

    // Módulos principais (carregados na ordem ou alfabeticamente)
    badges: require('./modules/badges'),
    cacheLists: require('./modules/cacheLists'),
    company: require('./modules/company'),
    crateExtension: require('./modules/crateExtension'),
    eco: require('./modules/eco'),
    events: require('./modules/events'),
    frames: require('./modules/frames'),
    helpExtension: require('./modules/helpExtension'),
    img: require('./modules/img'),
    itemExtension: require('./modules/itemExtension'),
    maqExtension: require('./modules/maqExtension'),
    playerUtils: require('./modules/playerUtils'),
    shopExtension: require('./modules/shopExtension'),
    siteExtension: require('./modules/siteExtension'),
    townExtension: require('./modules/townExtension'),

    // Utilitários
    utils: {
        ...require('./utils/botUtils'),     // Funções gerais (random, ms, clone, etc.)
        ...require('./utils/dbUtils'),      // Funções específicas de DB (setCompanieInfo)
        discord: require('./utils/discordUtils'), // Funções do Discord (createButton, findMember, etc.)
        format: require('./utils/formatUtils'), // Funções de formatação (format, getProgress, etc.) - Renomeado para evitar conflito com botUtils.format
    },

    // Referências (serão injetadas pelo ToddyClient)
    client: null,
    Discord: null, // Módulo discord.js
    // Adiciona constantes úteis (Exemplo)
    money: 'nisruk',
    moneyemoji: '<:nisruk:770051774305861643>',
    money2: 'Cristal',
    money2emoji: '<:cristal:770051774015905793>',
    money3: 'Ficha',
    money3emoji: '<:ficha:770051773950689330>',
    tp: {
        name: 'Ponto Temporal',
        emoji: '<:pt:807671407284715540>'
    },
    ObjectId: require('mongodb').ObjectId, // Exporta ObjectId para uso fácil
    getConfig: () => require('../config'), // Função para obter config atualizada
    id: require('../config').app.id // ID da aplicação (bot)
};

// --- Funções Globais Simplificadas (Wrappers para DatabaseManager) ---
// Adiciona os wrappers dbget, dbset, dbincrement diretamente na API
// para manter a compatibilidade com o código antigo que usava API.client.dbget, etc.
// Estes agora usarão API.db (a instância centralizada).

API.dbget = async (id, collectionName, idField = 'user_id') => {
    // Garante que API.db está disponível
    if (!API.db) {
        console.error("[ERRO FATAL API.dbget] API.db não inicializado!".red);
        return null; // Ou lançar erro
    }
    return await API.db.get(id, collectionName, idField);
};

API.dbset = async (id, collectionName, field, value, idField = 'user_id') => {
    if (!API.db) {
        console.error("[ERRO FATAL API.dbset] API.db não inicializado!".red);
        return null;
    }
    return await API.db.set(id, collectionName, field, value, idField);
};

API.dbincrement = async (id, collectionName, field, value, idField = 'user_id') => {
    if (!API.db) {
        console.error("[ERRO FATAL API.dbincrement] API.db não inicializado!".red);
        return null;
    }
    return await API.db.increment(id, collectionName, field, value, idField);
};


// Inicializa módulos que precisam de carregamento pós-API (se houver)
// Ex: Se algum módulo dependesse de outro já carregado na API
// API.moduleX.initialize(API);

console.log('[API Index] Módulos e Utilitários carregados e exportados.');

module.exports = API;