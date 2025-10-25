// _classes/api/index.js

// --- Core Imports ---
const { prefix, owner, token, ip, app } = require("../config"); // Caminho: ../config
const version = require('../../package.json').version; // Caminho: ../../package.json
const DatabaseManager = require('../manager/DatabaseManager'); // Caminho: ../manager/DatabaseManager
const dbManagerInstance = new DatabaseManager(); // Instância do Manager
const discordJS = require('discord.js'); // Importa o discord.js inteiro

// --- Discord.js Builders & Components ---
const {
    EmbedBuilder, ButtonBuilder, ActionRowBuilder, SelectMenuBuilder, ButtonStyle, Collection
} = discordJS; // Extrai builders do discordJS

// --- Utility Modules Imports ---
const botUtils = require('./utils/botUtils');
const dbUtils = require('./utils/dbUtils');
const discordUtils = require('./utils/discordUtils');
const formatUtils = require('./utils/formatUtils');

// --- System Modules Imports ---
const modules = {
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
    townExtension: require('./modules/townExtension')
    // Adicione outros módulos aqui se necessário
};

// --- API Object Construction ---
// Usar 'let' permite modificar/adicionar propriedades depois (como client)
let API = {
    // --- Core Info & Config ---
    prefix, owner, token, ip, app, version, id: app.id,

    // --- Bot State & Logs ---
    debug: false,
    logs: { cmds: true, falhas: true },
    lastsave: '',
    cmdsexec: 0,
    playerscmds: [],

    // --- String Constants ---
    money: 'moedas', moneyemoji: '<:moneybag:736290479406317649>',
    money2: 'cristais', money2emoji: '<:estilhas:743176785986060390>',
    money3: 'fichas', money3emoji: '<:ficha:741827151879471115>',
    tp: { name: 'pontos temporais', emoji: '<:tp:841870541274087455>' },
    mastery: { name: 'pontos de maestria', emoji: '🔰' },

    // --- Core Components ---
    DatabaseManager: dbManagerInstance, // Instância do DB Manager (MongoDB)
    // db: require('../db'), // Conexão MongoDB gerenciada via connectDB() - Não exportar diretamente?
    client: null, // Será definido pelo NisrukshaClient
    Discord: discordJS, // Exporta o discord.js inteiro para compatibilidade/acesso a tipos

    // --- Discord.js Builders & Components ---
    EmbedBuilder, ButtonBuilder, ActionRowBuilder, SelectMenuBuilder, ButtonStyle, Collection,

    // --- Utility Functions (Grouped & Direct Access) ---
    utils: {
        bot: botUtils,
        db: dbUtils,
        discord: discordUtils,
        format: formatUtils,
        // Atalhos comuns (mantidos para conveniência)
        ms: formatUtils.ms,
        ms2: formatUtils.ms2,
        format: formatUtils.format,
        getProgress: formatUtils.getProgress,
        toNumber: formatUtils.toNumber,
        getFormatedDate: formatUtils.getFormatedDate,
        random: botUtils.random,
        clone: botUtils.clone,
        sendError: discordUtils.sendError,
        createButton: discordUtils.createButton,
        createMenu: discordUtils.createMenu,
        rowComponents: discordUtils.rowComponents,
        // Adicionar editOrReply aqui também?
        editOrReply: discordUtils.editOrReply, // Certifique-se que foi exportado em discordUtils.js
    },

    // --- System Modules ---
    ...modules, // Espalha todos os módulos importados (API.eco, API.company, etc.)

    // --- Funções Específicas com Contexto (Wrappers) ---
    // Wrapper para getBotInfoProperties
    getBotInfoProperties: async () => { // Tornar async se botUtils.getBotInfoProperties for async
        // Coleta o estado atual necessário
        const currentState = {
            lastsave: API.lastsave,
            cmdsexec: API.cmdsexec,
            playerscmds: API.playerscmds,
            cacheLists: API.cacheLists, // Passa o módulo inteiro
            version: API.version
        };
        // Chama a função passando o client e o estado
        // Garante que API.client esteja definido antes de chamar
        if (!API.client) {
            console.warn("[API.getBotInfoProperties] Chamado antes do API.client ser definido.");
            // Retornar um embed padrão ou lançar erro?
            return new EmbedBuilder().setTitle("Bot Status").setDescription("Aguardando inicialização...");
        }
        return await botUtils.getBotInfoProperties(API.client, currentState); // Usa await
    },
    // Wrapper para setCompanieInfo
    setCompanieInfo: (user_id, company_id, field, value) => {
        // Chama a função passando o client
        // Garante que API.client esteja definido
        if (!API.client) {
             console.warn("[API.setCompanieInfo] Chamado antes do API.client ser definido. Erro pode não ser emitido.");
        }
        return dbUtils.setCompanieInfo(user_id, company_id, field, value, API.client);
    },

};

module.exports = API;