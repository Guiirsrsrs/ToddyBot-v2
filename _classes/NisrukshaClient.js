const Discord = require('discord.js');
const fs = require('fs');
const API = require("./api.js");
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const glob = require('glob');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = class NisrukshaClient extends Discord.Client {

    constructor(options = {}) {
        super({
            allowedMentions: { parse: ['users', 'roles'], repliedUser: true },
            intents: ['GUILDS', 'GUILD_MESSAGE_REACTIONS', 'GUILD_MESSAGES']
        });

        this.options = options; // Corrigido: atribuir options

        console.log('[CLIENT] Iniciando validação...');
        this.validate(options);
        console.log('[CLIENT] Validação concluída.');

        console.log('[CLIENT] Carregando eventos...');
        this.loadEvents(); // Já sabemos que esta funciona

        console.log('[CLIENT] Carregando módulos...');
        this.loadModules();
        console.log('[CLIENT] Módulos carregados.'); // Este log pode não aparecer se o erro estiver em loadModules

        console.log('[CLIENT] Carregando comandos...');
        this.loadCommands(options);
        // Não adicione log *depois* de loadCommands, pois ele é assíncrono internamente

        console.log('[CLIENT] Carregando servidor Express...');
        this.loadExpressServer(options);
        console.log('[CLIENT] Servidor Express carregado.');

        API.client = this;
        console.log('[CLIENT] Construtor concluído.');
    }


    validate(options) {
        if (!options.app.token) {
            console.log('Token not found in config.js');
            process.exit();
        }
        this.token = options.app.token;
    }

    loadModules() {
        API.client = this;
        API.Discord = Discord;

        const files = glob.sync(__dirname + '/modules/*.js');
        console.log(`[CLIENT] Encontrados ${files.length} arquivos de módulos para carregar.`); // Log adicionado

        for (const file of files) {
            console.log(`[CLIENT] Tentando carregar módulo: ${file}`); // Log adicionado
            try { // Adicionado try...catch
                let eventFunction = require(file.replace('.js', ''));
                const eventName = file.replace('.js', '').replace(__dirname.replace(/\\/g, '/') + '/modules/', "");
                API[eventName] = eventFunction;
                console.log(`[CLIENT] Módulo ${eventName} carregado com sucesso.`); // Log adicionado
            } catch (err) {
                console.error(`[ERRO] Falha ao carregar o módulo ${file}:`, err);
                // Você pode querer decidir se o bot deve parar se um módulo essencial falhar
                // process.exit(1);
            }
        }

        console.log('[CLIENT] Tentando carregar _classes/db.js...'); // Log adicionado
        try { // Adicionado try...catch
            API.db = require('./db.js');
            console.log('[CLIENT] _classes/db.js carregado com sucesso.'); // Log adicionado
        } catch (err) {
            console.error('[ERRO] Falha ao carregar _classes/db.js:', err);
            process.exit(1); // db é essencial
        }

        API.client = this;
        // O log `[MÓDULOS] Carregados` será impresso pelo console.log após a chamada desta função no construtor
    }

    loadEvents() {
        fs.readdir("./events/", (err, files) => {
            if (err) {
                console.error('[ERRO] Falha ao ler a pasta de eventos:', err); // Log de erro melhorado
                return;
            }
            console.log(`[CLIENT] Encontrados ${files.length} arquivos de eventos para carregar.`); // Log adicionado
            files.forEach(file => {
                console.log(`[CLIENT] Tentando carregar evento: ${file}`); // Log adicionado
                try { // Adicionado try...catch
                    let eventFunction = require(`../events/${file}`);
                    if (eventFunction.name != 'ready') this.on(eventFunction.name, (...args) => eventFunction.execute(API, ...args));
                    else this.once(eventFunction.name, (...args) => eventFunction.execute(API, ...args));
                    console.log(`[CLIENT] Evento ${eventFunction.name} (${file}) carregado.`); // Log adicionado
                } catch (err) {
                    console.error(`[ERRO] Falha ao carregar o evento ${file}:`, err);
                }
            });
            console.log(`[EVENTOS] Carregados`.green); // Este log já existia e funciona
        });
    }


    loadCommands(options) {
        (async () => {
            console.log('[CLIENT] Iniciando processo assíncrono de loadCommands...'); // Log adicionado
            try {
                console.log('[CLIENT] Verificando/Buscando application owner...'); // Log adicionado
                if (!this.application?.owner) await this.application?.fetch();
                console.log('[CLIENT] Application owner verificado/buscado.'); // Log adicionado

                console.log('[CLIENT] Obtendo JSON dos comandos...'); // Log adicionado
                const commandsObject = await this.getCommandsJson(); // Removido await desnecessário
                this.commands = commandsObject.commandsCollection;
                console.log(`[CLIENT] ${this.commands.size} comandos prefixados carregados na Collection.`); // Log adicionado

                await this.loadSlashCommands({ id: options.app.id });

                console.log(`[COMANDOS] Carregamento iniciado (slash commands são assíncronos)`.green); // Este log já existia

            } catch (error) {
                console.error('[ERRO] Falha no processo loadCommands:', error);
            }
        })();
    }

    async getCommandsJson() { // Tornada async
        const files = glob.sync(__dirname + '/../commands/*/*.js');
        console.log(`[CLIENT] Encontrados ${files.length} arquivos na pasta commands.`); // Log adicionado
        const commandsCollection = new Discord.Collection();
        const globalCommandsJson = [];
        const serverCommandsJson = [];
        for (const file of files) {
            try {
                if (!file.includes('!')) { // Ignora arquivos template
                    console.log(`[CLIENT] Processando arquivo de comando: ${file}`); // Log adicionado
                    let command = require(file.replace('.js', ''));
                    commandsCollection.set(command.name, command);
                    console.log(`[CLIENT] Comando ${command.name} adicionado à collection.`); // Log adicionado

                    if (!command.disabled) {
                        // A lógica de helpExtension e SlashCommandBuilder precisa ser verificada
                        if (API.helpExtension && typeof API.helpExtension.addCommand === 'function') {
                           API.helpExtension.addCommand(command);
                        } else {
                           // console.warn(`[AVISO] API.helpExtension não encontrado ou inválido ao carregar comando ${command.name}`);
                           // Comentado para reduzir verbosidade, descomente se necessário
                        }

                        if (!command.data) {
                            command.data = new SlashCommandBuilder();
                        }
                        // Verifica se setName já foi chamado (pode causar erro se chamado duas vezes)
                        try {
                           command.data.setName(command.name);
                        } catch (e) {
                           // Ignora o erro se o nome já estiver definido
                           if (!e.message.includes('Command name already set')) {
                              throw e; // Relança outros erros
                           }
                        }

                        let categorystring;
                        if (command.category == 'none' && !command.companytype) categorystring = 'STAFF';
                        else if (command.category == 'none' && command.companytype > 0) categorystring = 'TRABALHO';
                        else if (command.category == 'none' && command.companytype == -1) categorystring = 'EVENTO';
                        else categorystring = command.category;

                         // Verifica se setDescription já foi chamado
                        try {
                           command.data.setDescription(categorystring + (command.description == 'none' ? '' : ' | ' + command.description));
                        } catch (e) {
                           if (!e.message.includes('Command description already set')) {
                              throw e;
                           }
                        }

                        // Tratamento para opções (simplificado, expanda se necessário)
                        if (command.options && Array.isArray(command.options)) {
                           command.options.forEach(option => {
                               // Adicione lógica real para diferentes tipos de opções aqui
                               // Exemplo básico para string:
                               if (!command.data.options.some(o => o.name === option.name)) {
                                  command.data.addStringOption(opt =>
                                      opt.setName(option.name).setDescription(option.description || 'Sem descrição').setRequired(option.required || false)
                                  );
                               }
                           });
                        }


                        if (categorystring == 'STAFF') serverCommandsJson.push(command.data.toJSON());
                        else globalCommandsJson.push(command.data.toJSON());
                        console.log(`[CLIENT] Comando ${command.name} adicionado ao JSON para registro (Global ou Servidor).`); // Log adicionado
                    } else {
                         console.log(`[CLIENT] Comando ${command.name} desabilitado, pulando.`); // Log adicionado
                    }
                }
            } catch (err) {
                console.log(`[ERRO] Houve um erro ao carregar o comando ${file}`);
                console.log(err.stack);
            }
        }
        console.log(`[CLIENT] Processados ${files.length} arquivos de comando. Retornando JSONs.`); // Log adicionado
        return { globalCommandsJson, serverCommandsJson, commandsCollection };
    }


    async loadSlashCommands({ force = false, id }) {
        console.log('[CLIENT] Tentando carregar/atualizar Slash Commands...'); // Log adicionado
        const rest = new REST({ version: '9' }).setToken(this.token);

        try { // Adicionado try...catch abrangente
            const { globalCommandsJson, serverCommandsJson } = await this.getCommandsJson();
            console.log(`[CLIENT] Obtido JSON para ${globalCommandsJson.length} comandos globais e ${serverCommandsJson.length} comandos de servidor.`);

            console.log(force ? '[CLIENT] Forçando atualização de slash commands...' : '[CLIENT] Verificando necessidade de atualização de slash commands...');

            // Obter comandos existentes para comparar
             console.log('[CLIENT] Buscando comandos globais existentes...'); // Log adicionado
            const currentGlobalCommands = await rest.get(Routes.applicationCommands(id));
             console.log(`[CLIENT] Encontrados ${currentGlobalCommands.length} comandos globais existentes.`); // Log adicionado

            // ID do servidor de teste/staff hardcoded no código original
            const guildId = '693150851396796446';
            console.log(`[CLIENT] Buscando comandos existentes no servidor ${guildId}...`); // Log adicionado
            const currentGuildCommands = await rest.get(Routes.applicationGuildCommands(id, guildId));
            console.log(`[CLIENT] Encontrados ${currentGuildCommands.length} comandos existentes no servidor ${guildId}.`); // Log adicionado


            // Comparação simples (pode ser aprimorada para verificar mudanças reais)
            const needsGlobalUpdate = force || globalCommandsJson.length !== currentGlobalCommands.length;
            const needsGuildUpdate = force || serverCommandsJson.length !== currentGuildCommands.length;

            if (needsGuildUpdate) {
                console.log(`[CLIENT] Atualizando comandos no servidor ${guildId}...`);
                await rest.put(
                    Routes.applicationGuildCommands(id, guildId),
                    { body: serverCommandsJson },
                );
                console.log(`[CLIENT] ${serverCommandsJson.length} comandos de servidor atualizados.`);
            } else {
                 console.log(`[CLIENT] Comandos no servidor ${guildId} já estão atualizados.`);
            }

            if (needsGlobalUpdate) {
                console.log('[CLIENT] Atualizando comandos globais...');
                await rest.put(
                    Routes.applicationCommands(id),
                    { body: globalCommandsJson },
                );
                console.log(`[CLIENT] ${globalCommandsJson.length} comandos globais atualizados.`);
            } else {
                 console.log('[CLIENT] Comandos globais já estão atualizados.');
            }
             console.log('[CLIENT] Verificação/atualização de Slash Commands concluída.');

        } catch (error) {
            console.error('[ERRO] Falha ao carregar/atualizar Slash Commands:', error);
            // Considerar se o bot deve parar ou continuar sem slash commands atualizados
        }
    }


    loadExpressServer(options) {
        // Verifica se as opções necessárias existem antes de tentar usá-las
        if (options.ip && options.ip !== 'localhost' && options.dbl && options.dbl.token) {
            try { // Adicionado try...catch
                console.log('[CLIENT] Tentando iniciar AutoPoster do top.gg...'); // Log adicionado
                const { AutoPoster } = require('topgg-autoposter');
                 if (!API.client) { // Garante que API.client esteja definido
                     console.warn('[AVISO] API.client não definido ao iniciar AutoPoster. Tentando atribuir this.');
                     API.client = this;
                 }
                AutoPoster(options.dbl.token, API.client);
                console.log('[CLIENT] AutoPoster do top.gg iniciado.'); // Log adicionado
            } catch (err) {
                console.error('[ERRO] Falha ao iniciar AutoPoster do top.gg:', err);
            }
        } else {
             console.log('[CLIENT] AutoPoster do top.gg não iniciado (IP é localhost ou token DBL ausente).'); // Log adicionado
        }
        // Adicione aqui a inicialização do servidor Express se ela existir em outro lugar
         console.log('[CLIENT] Lógica de loadExpressServer concluída (AutoPoster verificado).'); // Log adicionado
    }

    async login(token = this.token) {
        console.log('[CLIENT] Tentando login no Discord...'); // Log adicionado
        try {
            await super.login(token); // Adicionado await
            API.client = this; // Garante que API.client seja este cliente
            console.log('[CLIENT] Login bem-sucedido.'); // Log adicionado
        } catch (err) { // Corrigido para pegar o erro
             console.error('[ERRO] Falha ao fazer login no Discord:', err);
             process.exit(1); // Falha no login é crítico
        }

        // Configuração dos handlers de erro global
        process.on("uncaughtException", (err) => {
            console.error('[ERRO GLOBAL] Uncaught Exception:', err);
            if (API.client && API.client.emit) { // Verifica se client existe e tem 'emit'
                 try { API.client.emit('error', err); } catch {} // Evita erro se emit falhar
            }
        });
        process.on("unhandledRejection", (err) => {
            console.error('[ERRO GLOBAL] Unhandled Rejection:', err);
             if (API.client && API.client.emit) { // Verifica se client existe e tem 'emit'
                 try { API.client.emit('error', err); } catch {} // Evita erro se emit falhar
            }
        });
        console.log('[CLIENT] Handlers de erro global configurados.'); // Log adicionado
    }
}