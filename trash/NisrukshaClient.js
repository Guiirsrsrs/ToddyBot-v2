// _classes/ToddyClient.js

const { Client, GatewayIntentBits, IntentsBitField, Collection } = require('discord.js');
const API = require("./api"); // Mantém o require aqui para acesso inicial
const EventHandler = require('./client/EventHandler');
const CommandHandler = require('./client/CommandHandler');
const DatabaseManager = require('./manager/DatabaseManager');

// <<< HANDLERS GLOBAIS MOVIDOS PARA O TOPO >>>
process.on("uncaughtException", (err, origin) => {
    console.error(`[ERRO GLOBAL] Uncaught Exception:`, err); console.error(`[ERRO GLOBAL] Origin:`, origin);
    // Tentativa de emitir o erro se o client já existir na API
    try {
        // Requer a API dentro do handler para pegar a instância mais atualizada
        const CurrentAPI = require("./api");
        if (CurrentAPI.client?.emit) { CurrentAPI.client.emit('error', err); }
    } catch (e){ console.error("Falha ao tentar emitir erro global (uncaughtException):", e)}
});
process.on("unhandledRejection", (reason, promise) => {
    console.error('[ERRO GLOBAL] Unhandled Rejection:', reason); console.error('[ERRO GLOBAL] Promise:', promise);
    try {
        // Requer a API dentro do handler
        const CurrentAPI = require("./api");
        if (CurrentAPI.client?.emit) { CurrentAPI.client.emit('error', reason instanceof Error ? reason : new Error(String(reason))); }
    } catch (e){ console.error("Falha ao tentar emitir erro global (unhandledRejection):", e)}
});
console.log('[CLIENT] Handlers de erro global configurados no topo.');
// <<< FIM DOS HANDLERS GLOBAIS >>>

module.exports = class ToddyClient extends Client {

    constructor(options = {}) {
        // --- CÁLCULO NUMÉRICO DAS INTENTS ---
        // 1. Define as intents desejadas num array
        const desiredIntents = [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        ];

        // 2. Resolve o valor numérico (bitfield) a partir do array
        const intentsBitfield = IntentsBitField.resolve(desiredIntents);
        console.log(`[CLIENT] Intents resolvidas para o bitfield: ${intentsBitfield}`); // Log para verificar o valor

        // 3. Passa o NÚMERO diretamente para o super()
        super({
            allowedMentions: { parse: ['users', 'roles'], repliedUser: true },
            intents: intentsBitfield // Passa o número calculado
        });
        // --- FIM DA ALTERAÇÃO DAS INTENTS ---

        this.options = options;
        this.commands = new Collection();

        console.log('[CLIENT] Iniciando validação...');
        this.validate(options);
        console.log('[CLIENT] Validação concluída.');

        console.log('[CLIENT] Instanciando DatabaseManager...');
        this.db = new DatabaseManager();
        console.log('[CLIENT] DatabaseManager instanciado.');

        // Garante que a API é definida ANTES de carregar módulos dependentes
        API.client = this;
        API.Discord = require('discord.js'); // Pode manter aqui ou mover se causar problemas
        console.log('[CLIENT] Objeto API carregado e client injetado.');

        console.log('[CLIENT] Inicializando módulos da API (Shop, Town)...');
        try {
            API.shopExtension.load();
            API.townExtension.init();
            console.log('[CLIENT] Módulos da API inicializados.');
        } catch (moduleLoadError) {
             console.error("[ERRO FATAL] Falha ao inicializar módulos shop/town:", moduleLoadError);
             // Considerar sair se estes módulos forem críticos? process.exit(1);
        }

        this.eventHandler = new EventHandler(this, API);
        this.commandHandler = new CommandHandler(this, API, this.options);

        // Carrega handlers APÓS inicializar módulos básicos
        this.eventHandler.loadAll();
        this.commandHandler.loadAll(); // CommandHandler pode depender de módulos carregados

        console.log('[CLIENT] Carregando servidor Express...');
        this.loadExpressServer(options);

        console.log('[CLIENT] Construtor concluído.');
    }

    // LÓGICA DE VALIDAÇÃO ROBUSTA
    validate(options) {
        let finalToken = options.app?.token;
        const shardingToken = process.env.DISCORD_TOKEN;
        if (!finalToken && shardingToken) {
            finalToken = shardingToken;
        }

        if (!finalToken) {
            console.error('ERRO CRÍTICO: Token não encontrado na configuração ou no ambiente de Sharding.');
            process.exit(1);
        }
        this.token = finalToken;
    }

    loadExpressServer(options) {
        if (options.ip && options.ip !== 'localhost' && options.dbl?.token) {
            try {
                console.log('[CLIENT] Tentando iniciar AutoPoster do top.gg...');
                const { AutoPoster } = require('topgg-autoposter');
                // Garante que API.client é este client antes de passar para o poster
                if (!API.client || API.client !== this) { API.client = this; }
                const poster = AutoPoster(options.dbl.token, API.client); // Passa API.client atualizado
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

    // CHAMADA DE LOGIN COM LOG DE VERIFICAÇÃO DO TOKEN
    async login() {
        console.log('[CLIENT] Tentando login no Discord...');
        try {
            console.log('[CLIENT] Chamando super.login()...');

            // --- LOG DE VERIFICAÇÃO DO TOKEN ---
            console.log(`[CLIENT DEBUG] Token a ser usado para login: ${typeof this.token === 'string' ? `String terminando com ...${this.token.slice(-6)}` : `Tipo inválido (${typeof this.token})`}`);
            if (typeof this.token !== 'string' || this.token.length < 50) { // Verifica se é string e tem um comprimento razoável
                 console.error('[ERRO CRÍTICO] O token parece inválido ANTES da chamada super.login()!');
                 process.exit(1); // Sai imediatamente se o token parece errado
            }
            // --- FIM DO LOG DE VERIFICAÇÃO ---

            await super.login(this.token); // A chamada que estava a falhar

            console.log('[CLIENT] super.login() retornou.');
            // Garante que API.client está atualizado após o login
            API.client = this;
            console.log('[CLIENT] Login bem-sucedido.');
        } catch (err) {
             // O erro 'bitfield' ou outro erro de login será apanhado aqui
             console.error('[ERRO] Falha ao fazer login no Discord:', err);
             process.exit(1); // Erro no login é crítico, força a saída
        }
        // Os handlers de erro global já estão no topo do arquivo
    }
}