// _classes/startup/Bootstrapper.js

require('colors');
const API = require('../api/index'); // Importa a API para aceder aos módulos necessários

class Bootstrapper {
    /**
     * @param {import('../ToddyClient')} client A instância do cliente Discord a ser inicializada.
     */
    constructor(client) {
        if (!client) {
            throw new Error("[Bootstrapper] Instância do cliente não fornecida!");
        }
        this.client = client;
    }

    /**
     * Executa a sequência de inicialização priorizada.
     */
    async initialize() {
        console.log('[BOOTSTRAPPER] Iniciando sequência de boot priorizada...'.yellow);

        try {
            // --- PRIORIDADE 1: CONECTAR SERVIÇOS CENTRAIS (DB) ---
            console.log('[BOOTSTRAPPER-P1] Conectando ao Banco de Dados...');
            // Acede ao db através da instância do cliente
            if (!this.client.db?.connect) throw new Error("DatabaseManager (client.db.connect) não está disponível.");
            await this.client.db.connect();
            console.log('[BOOTSTRAPPER-P1] Banco de Dados conectado com sucesso.'.green);

            // --- PRIORIDADE 2: CARREGAR MÓDULOS ESSENCIAIS (Eventos e Ficheiros de Comando) ---
            console.log('[BOOTSTRAPPER-P2] Carregando Handlers de Eventos...');
            if (!this.client.eventHandler?.loadAll) throw new Error("EventHandler (client.eventHandler.loadAll) não está disponível.");
            this.client.eventHandler.loadAll(); // Carrega ficheiros de evento e regista listeners
            console.log('[BOOTSTRAPPER-P2] Eventos carregados.');

            console.log('[BOOTSTRAPPER-P2] Carregando arquivos de Comando...');
            if (!this.client.commandHandler?.loadCommandFiles) throw new Error("CommandHandler (client.commandHandler.loadCommandFiles) não está disponível.");
            this.client.commandHandler.loadCommandFiles(); // APENAS carrega ficheiros para memória
            console.log('[BOOTSTRAPPER-P2] Arquivos de Comando carregados.');

            // --- PRIORIDADE 3: INICIAR SERVIÇOS EXTERNOS (Express) ---
            console.log('[BOOTSTRAPPER-P3] Iniciando Servidor Express (Top.gg)...');
            // Chama o método diretamente na instância do cliente
            if (typeof this.client.loadExpressServer !== 'function') throw new Error("Método client.loadExpressServer não encontrado.");
            this.client.loadExpressServer(this.client.options); // Passa as opções do cliente
            console.log('[BOOTSTRAPPER-P3] Servidor Express iniciado.');

            // --- PRIORIDADE 4: LOGIN NO DISCORD ---
            console.log('[BOOTSTRAPPER-P4] Realizando login no Discord...');
            // Chama o método de login na instância do cliente
            if (typeof this.client.login !== 'function') throw new Error("Método client.login não encontrado.");
            await this.client.login(); // O login() agora só faz super.login()
            console.log('[BOOTSTRAPPER-P4] Login iniciado. Aguardando evento READY...'.cyan);

            // Configura handlers de erro globais APÓS o início do login
            // (Pode ser movido para depois do 'ready' se necessário)
            if (typeof this.client.setupGlobalErrorHandlers !== 'function') throw new Error("Método client.setupGlobalErrorHandlers não encontrado.");
            this.client.setupGlobalErrorHandlers();

            // O resto da inicialização (registo de comandos, load de cotação/eventos)
            // acontecerá DENTRO do evento 'ready', que é carregado pelo eventHandler.

        } catch (err) {
            console.error('[ERRO FATAL BOOTSTRAPPER] Falha ao inicializar o bot:'.red, err);
            process.exit(1); // Encerra o processo se a inicialização falhar
        }
    }
}

module.exports = Bootstrapper;