// _classes/api/index.js

const { prefix, owner, token, ip, app } = require("../config"); // Ajustado para ../config
const version = require('../../package.json').version; // Ajustado para ../../package.json
const DatabaseManager = require('../manager/DatabaseManager'); // Ajustado
const dbManagerInstance = new DatabaseManager();

// Import Builders from discord.js
const {
    EmbedBuilder, ButtonBuilder, ActionRowBuilder, SelectMenuBuilder, ButtonStyle, Collection // Adicionado Collection
} = require('discord.js');

// Import Utility Modules
const botUtils = require('./utils/botUtils');
const dbUtils = require('./utils/dbUtils');
const discordUtils = require('./utils/discordUtils');
const formatUtils = require('./utils/formatUtils');

// Import System Modules (adjust path if you moved the modules folder)
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
    // Adicione mais módulos conforme necessário
};

const API = {
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
    DatabaseManager: dbManagerInstance, // Use instance
    db: require('../db'), // Knex instance - Ajustado
    client: null, // To be set by NisrukshaClient
    Discord: require('discord.js'), // Export discord.js itself if needed, but prefer builders

    // --- Discord.js Builders & Components ---
    EmbedBuilder, ButtonBuilder, ActionRowBuilder, SelectMenuBuilder, ButtonStyle, Collection,

    // --- Utility Functions (Grouped) ---
    utils: {
        bot: botUtils,
        db: dbUtils,
        discord: discordUtils,
        format: formatUtils,
        // Add direct access to common utils for convenience?
        ms: formatUtils.ms,
        ms2: formatUtils.ms2,
        format: formatUtils.format,
        getProgress: formatUtils.getProgress,
        toNumber: formatUtils.toNumber,
        getFormatedDate: formatUtils.getFormatedDate,
        random: botUtils.random,
        // ... add others as needed
    },

    // --- System Modules ---
    ...modules,

    // --- Funções que precisam do contexto 'API' ---
    // Pass 'API' para getBotInfoProperties ou refatorar para importar dependências diretamente
    getBotInfoProperties: () => botUtils.getBotInfoProperties(API),
    // Pass client para setCompanieInfo
    setCompanieInfo: (user_id, company, string, value) => dbUtils.setCompanieInfo(user_id, company, string, value, API.client),

    // --- Manter funções auxiliares de alto nível que usam outros módulos ---
    // Exemplo: Se createButton precisasse de algo do eco module (improvável)
    createButton: discordUtils.createButton,
    createMenu: discordUtils.createMenu,
    rowComponents: discordUtils.rowComponents,
    sendError: discordUtils.sendError,
    clone: botUtils.clone // Expor clone diretamente
};

module.exports = API;