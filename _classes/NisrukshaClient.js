// _classes/NisrukshaClient.js

const { Client, GatewayIntentBits, IntentsBitField, Collection } = require('discord.js');
const API = require("./api");
const EventHandler = require('./client/EventHandler');
const CommandHandler = require('./client/CommandHandler');

module.exports = class NisrukshaClient extends Client {

    constructor(options = {}) {
        const myIntents = new IntentsBitField().add(
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        );

        super({
            allowedMentions: { parse: ['users', 'roles'], repliedUser: true },
            intents: myIntents
        });

        this.options = options;
        this.commands = new Collection();

        console.log('[CLIENT] Iniciando validação...');
        this.validate(options);
        console.log('[CLIENT] Validação concluída.');

        API.client = this;
        API.Discord = require('discord.js');
        console.log('[CLIENT] Objeto API carregado e client injetado.');

        this.eventHandler = new EventHandler(this, API);
        this.commandHandler = new CommandHandler(this, API, this.options);

        this.eventHandler.loadAll();
        this.commandHandler.loadAll();

        console.log('[CLIENT] Carregando servidor Express...');
        this.loadExpressServer(options);

        console.log('[CLIENT] Construtor concluído.');
    }

    // LÓGICA DE VALIDAÇÃO ROBUSTA
    validate(options) {
        // 1. Tenta obter o token da configuração (config.js)
        let finalToken = options.app?.token; 
        
        // 2. Se o token da config for nulo ou vazio, tenta obter do ambiente (injetado pelo ShardingManager)
        const shardingToken = process.env.DISCORD_TOKEN;
        if (!finalToken && shardingToken) {
            finalToken = shardingToken;
        }

        if (!finalToken) {
            console.error('ERRO CRÍTICO: Token não encontrado na configuração ou no ambiente de Sharding.');
            // Se o token for nulo, a chamada ao login falhará, e queremos que o processo morra aqui.
            process.exit(1); 
        }
        this.token = finalToken;
    }

    loadExpressServer(options) {
        if (options.ip && options.ip !== 'localhost' && options.dbl?.token) {
            try {
                console.log('[CLIENT] Tentando iniciar AutoPoster do top.gg...');
                const { AutoPoster } = require('topgg-autoposter');
                if (!API.client) { API.client = this; }
                const poster = AutoPoster(options.dbl.token, API.client);
                 poster.on('posted', (stats) => { console.log(`[TOP.GG] Estatísticas postadas: ${stats.serverCount} servidores.`); });
                 poster.on('error', (err) => { console.error('[ERRO][TOP.GG] Falha ao postar:', err); });
                console.log('[CLIENT] AutoPoster do top.gg iniciado.');
            } catch (err) {
                console.error('[ERRO] Falha ao iniciar AutoPoster do top.gg:', err);
            }
        } else {
             console.log('[CLIENT] AutoPoster do top.gg não iniciado.');
        }
         console.log('[CLIENT] Lógica de loadExpressServer concluída.');
    }

    // CHAMADA DE LOGIN SIMPLIFICADA
    async login() {
        console.log('[CLIENT] Tentando login no Discord...');
        try {
            // Usa o token armazenado em this.token pela função validate()
            // Se this.token for undefined aqui, o validate() deveria ter causado process.exit(1)
            await super.login(this.token); 
            API.client = this;
            console.log('[CLIENT] Login bem-sucedido.');
        } catch (err) {
             console.error('[ERRO] Falha ao fazer login no Discord:', err);
             process.exit(1);
        }

        process.on("uncaughtException", (err, origin) => {
            console.error(`[ERRO GLOBAL] Uncaught Exception:`, err); console.error(`[ERRO GLOBAL] Origin:`, origin);
            if (API.client?.emit) { try { API.client.emit('error', err); } catch (e){ console.error("Emit error:", e)} }
        });
        process.on("unhandledRejection", (reason, promise) => {
            console.error('[ERRO GLOBAL] Unhandled Rejection:', reason); console.error('[ERRO GLOBAL] Promise:', promise);
            if (API.client?.emit) { try { API.client.emit('error', reason instanceof Error ? reason : new Error(String(reason))); } catch (e){ console.error("Emit error:", e)} }
        });
        console.log('[CLIENT] Handlers de erro global configurados.');
    }
}