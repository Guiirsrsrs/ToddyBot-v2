// _classes/api/index.js

// --- Core Imports ---
const { prefix, owner, token, ip, app } = require("../config");
const version = require('../../package.json').version;
const DatabaseManager = require('../manager/DatabaseManager'); // IMPORTA A CLASSE, NÃO CRIA INSTÂNCIA
const discordJS = require('discord.js');

// --- Discord.js Builders & Components ---
const {
    EmbedBuilder, ButtonBuilder, ActionRowBuilder, SelectMenuBuilder, ButtonStyle, Collection
} = discordJS;

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
};

// --- API Object Construction ---
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
    DatabaseManager: DatabaseManager, // EXPORTA A CLASSE, NÃO A INSTÂNCIA
    client: null,
    Discord: discordJS,

    // --- Discord.js Builders & Components ---
    EmbedBuilder, ButtonBuilder, ActionRowBuilder, SelectMenuBuilder, ButtonStyle, Collection,

    // --- Utility Functions ---
    utils: {
        bot: botUtils,
        db: dbUtils,
        discord: discordUtils,
        format: formatUtils,
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
        editOrReply: discordUtils.editOrReply,
    },

    // --- System Modules ---
    ...modules,

    // --- Funções Específicas com Contexto (Wrappers) ---
    getBotInfoProperties: async () => {
        const currentState = {
            lastsave: API.lastsave,
            cmdsexec: API.cmdsexec,
            playerscmds: API.playerscmds,
            cacheLists: API.cacheLists,
            version: API.version
        };
        
        if (!API.client) {
            console.warn("[API.getBotInfoProperties] Chamado antes do API.client ser definido.");
            return new EmbedBuilder().setTitle("Bot Status").setDescription("Aguardando inicialização...");
        }
        return await botUtils.getBotInfoProperties(API.client, currentState);
    },
    
    setCompanieInfo: (user_id, company_id, field, value) => {
        if (!API.client) {
             console.warn("[API.setCompanieInfo] Chamado antes do API.client ser definido.");
        }
        return dbUtils.setCompanieInfo(user_id, company_id, field, value, API.client);
    },
};

module.exports = API;