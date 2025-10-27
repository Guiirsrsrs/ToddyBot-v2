// _classes/ToddyClient.js - VERSÃO SEM MÉTODO start()

const { Client, GatewayIntentBits, IntentsBitField, Collection, AttachmentBuilder } = require('discord.js');
const API = require("./api");
const EventHandler = require('./client/EventHandler');
const CommandHandler = require('./client/CommandHandler');
const DatabaseManager = require('./manager/DatabaseManager');
require('colors');

module.exports = class ToddyClient extends Client {

    constructor(options = {}) {
        const myIntents = new IntentsBitField().add(
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        );

        console.log('[CLIENT CONSTRUCTOR] Chamando super()...');

        // 1. Mescla as 'options' (config) com as opções do Client (intents)
        const mergedOptions = Object.assign({}, options, {
            allowedMentions: { parse: ['users', 'roles'], repliedUser: true },
            intents: myIntents
        });

        // 2. Passa as opções mescladas para o super()
        //    O super() irá automaticamente definir 'this.options' com este objeto mesclado.
        super(mergedOptions);
        
        console.log('[CLIENT CONSTRUCTOR] super() chamado.');

        console.log('[CLIENT CONSTRUCTOR] Validando token...');
        // 3. Valida usando 'this.options' que agora contém tudo (incluindo o token)
        this.validate(this.options); 
        console.log('[CLIENT CONSTRUCTOR] Token validado.');

        // 4. REMOVA a linha que sobrescreve 'this.options'
        // this.options = options; // <-- LINHA REMOVIDA

        this.commands = new Collection(); // Inicializa a coleção de comandos

        console.log('[CLIENT CONSTRUCTOR] Criando DatabaseManager...');
        this.db = new DatabaseManager(this.emit.bind(this)); // Cria instância do DB
        API.db = this.db; // Injеta na API
        console.log('[CLIENT CONSTRUCTOR] DatabaseManager criado e injetado.');

        console.log('[CLIENT CONSTRUCTOR] Instanciando Handlers...');
        this.eventHandler = new EventHandler(this, API); // Instancia EventHandler
        // O 'this.options' (definido pelo super) agora é passado para o handler
        this.commandHandler = new CommandHandler(this, API, this.options); // Instancia CommandHandler
        console.log('[CLIENT CONSTRUCTOR] Handlers instanciados.');

        console.log('[CLIENT CONSTRUCTOR] Configurando API.client e API.Discord...');
        API.client = this; // Injеta o próprio cliente na API
        API.Discord = require('discord.js'); // Exporta discord.js via API
        API.AttachmentBuilder = AttachmentBuilder; // Exporta AttachmentBuilder via API
        console.log('[CLIENT CONSTRUCTOR] API.client e API.Discord configurados.');

        console.log('[CLIENT CONSTRUCTOR] Construtor completo.'.green);
    }
    
    validate(options) {
        let finalToken = options.app?.token;
        const shardingToken = process.env.DISCORD_TOKEN;
        if (!finalToken && shardingToken) {
            finalToken = shardingToken;
        }
        if (!finalToken) {
            console.error('[CLIENT VALIDATE] ERRO CRÍTICO: Token não encontrado!'.red);
            process.exit(1);
        }
        this.token = finalToken;
        console.log(`[CLIENT VALIDATE] Token validado: ...${finalToken.slice(-5)}`.green);
    }

    // REMOVIDO o método start() daqui

    async login() { // Mantém o método login simplificado
        console.log('[CLIENT] Tentando login no Discord...');
        if (!this.token) { throw new Error("Token não definido"); }
        try {
            console.log(`[CLIENT] Usando token: ...${this.token.slice(-5)}`.cyan);
            this.once('ready', () => { // Listener básico para log
                 console.log(`[CLIENT] Evento 'ready' inicial recebido! Logado como ${this.user?.tag}`.magenta);
            });
            await super.login(this.token); // Apenas chama o login original
            console.log('[CLIENT] Chamada super.login() concluída.'.green);
        } catch (err) {
             console.error('[ERRO] Falha ao fazer login no Discord:'.red, err);
             throw err; // Lança o erro para o Bootstrapper tratar
        }
    }

    setupGlobalErrorHandlers() { // Mantém a configuração dos handlers globais
         process.on("uncaughtException", (err, origin) => {
            console.error(`[ERRO GLOBAL] Uncaught Exception:`, err);
            console.error(`[ERRO GLOBAL] Origin:`, origin);
            try { this.emit('error', err); } catch (e){ console.error("Erro ao emitir 'uncaughtException':", e)}
        });
        process.on("unhandledRejection", (reason, promise) => {
            console.error('[ERRO GLOBAL] Unhandled Rejection:', reason);
            console.error('[ERRO GLOBAL] Promise:', promise);
            try { this.emit('error', reason instanceof Error ? reason : new Error(String(reason))); } catch (e){ console.error("Erro ao emitir 'unhandledRejection':", e)}
        });
        console.log('[CLIENT] Handlers de erro global configurados.');
    }

    loadExpressServer(options) { // Mantém o método para iniciar o Express
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
             console.log('[CLIENT] AutoPoster do top.gg não iniciado.'.yellow);
        }
         console.log('[CLIENT] Lógica de loadExpressServer concluída.');
    }
}