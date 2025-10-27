// _classes/client/CommandHandler.js

const { Collection, SlashCommandBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const glob = require('glob');
const path = require('path');
require('colors'); // Adicionado

class CommandHandler {
    constructor(client, api, options) {
        this.client = client;
        this.API = api;
        this.options = options;
        this.commandsPath = path.join(__dirname, '..', '..', 'commands', '*/*.js');
        this.commands = new Collection();
    }

    // ALTERADO: Renomeado de loadAll para loadCommandFiles
    // Esta função APENAS carrega os ficheiros para a coleção
    loadCommandFiles() {
        console.log('[CommandHandler] Iniciando carregamento de arquivos de comando...'.yellow);
        try {
            const commandFiles = glob.sync(this.commandsPath);
            console.log(`[CommandHandler] Encontrados ${commandFiles.length} arquivos de comando.`);

            for (const file of commandFiles) {
                try {
                    // Ignora ficheiros template (lógica mantida)
                    if (!file.includes('!')) {
                        // console.log(`[CommandHandler] Processando arquivo: ${file}`); // Log opcional
                        delete require.cache[require.resolve(file)];
                        const command = require(file);

                        if (!command.name || typeof command.execute !== 'function') {
                            console.warn(`[AVISO][CommandHandler] Comando ${file} inválido. Pulando.`);
                            continue;
                        }

                        this.commands.set(command.name, command);

                        // Prepara dados para Slash Command (lógica mantida)
                        if (!command.data) {
                            command.data = new SlashCommandBuilder()
                                .setName(command.name)
                                .setDescription(command.description || 'Sem descrição');
                            // Adicionar lógica de 'options' aqui se necessário
                        }
                        if (!command.data.name) command.data.setName(command.name);
                        if (!command.data.description) command.data.setDescription(command.description || 'Sem descrição');

                        // console.log(`[CommandHandler] Comando ${command.name} carregado.`); // Log opcional
                    }
                } catch (err) {
                    console.error(`[ERRO][CommandHandler] Falha ao carregar ${file}:`, err);
                    if(this.API.client?.emit) this.API.client.emit('error', err); // Emite erro
                }
            }
            // Disponibiliza a coleção no client principal
            this.client.commands = this.commands;
            console.log(`[CommandHandler] ${this.commands.size} comandos carregados na Collection.`);

        } catch (error) {
            console.error('[ERRO][CommandHandler] Falha no processo loadCommandFiles:', error);
             if(this.API.client?.emit) this.API.client.emit('error', error); // Emite erro
        }
    }

     // Mantém a função _getCommandJsonsForRegistration como estava
     _getCommandJsonsForRegistration() {
         const globalCommandsJson = [];
         const serverCommandsJson = [];
         for (const command of this.commands.values()) {
            if (!command.disabled && command.data) {
                 let isStaffCommand = (command.category == 'none' && !command.companytype) || command.category === 'STAFF';
                 if (isStaffCommand) {
                     serverCommandsJson.push(command.data.toJSON());
                 } else {
                     globalCommandsJson.push(command.data.toJSON());
                 }
             }
         }
         console.log(`[CommandHandler] Preparado JSON para ${globalCommandsJson.length} comandos globais e ${serverCommandsJson.length} de servidor.`);
         return { globalCommandsJson, serverCommandsJson };
     }


    // Esta função AGORA SÓ regista os comandos, não carrega ficheiros
    async registerSlashCommands() {
         // Verifica se já temos comandos carregados
         if (this.commands.size === 0) {
              console.warn("[CommandHandler] Nenhum comando carregado na memória para registar.".yellow);
              // Tentar carregar ficheiros agora? Ou assumir que loadCommandFiles já correu?
              // Vamos assumir que loadCommandFiles já correu.
              // Se this.commands estiver vazio, _getCommandJsons... retornará arrays vazios, o que é seguro.
         }

        console.log('[CommandHandler] Tentando registrar/atualizar Slash Commands...'.cyan);
        // Verifica se o token e o ID estão disponíveis (devem estar se o cliente estiver pronto)
        if (!this.client.token || !this.options.app?.id) {
             console.error("[ERRO][CommandHandler] Token ou Client ID não disponíveis para registar comandos!".red);
             return;
        }
        const rest = new REST({ version: '10' }).setToken(this.client.token);
        const clientId = this.options.app.id;
        const guildId = '1153704546351190158'; // Guilda de Staff

        try {
            const { globalCommandsJson, serverCommandsJson } = this._getCommandJsonsForRegistration();

            // --- Registo Global ---
            if (globalCommandsJson.length > 0) {
                 try {
                     console.log(`[CommandHandler] Iniciando registo de ${globalCommandsJson.length} comandos globais (Client ID: ${clientId}).`);
                     const globalData = await rest.put(
                         Routes.applicationCommands(clientId),
                         { body: globalCommandsJson },
                     );
                     console.log(`[CommandHandler] ${globalData.length} comandos globais registrados/atualizados.`);
                 } catch (error) {
                      console.error('[ERRO][CommandHandler] Falha ao registrar comandos GLOBAIS:', error);
                      // Não parar tudo, tentar registar os de guilda
                 }
            } else {
                 console.log("[CommandHandler] Nenhum comando global para registar.");
                 // Opcional: Limpar comandos globais antigos? (CUIDADO)
                 // await rest.put(Routes.applicationCommands(clientId), { body: [] });
            }


            // --- Registo Específico da Guilda (STAFF) ---
             if (serverCommandsJson.length > 0) {
                 try {
                     console.log(`[CommandHandler] Iniciando registo de ${serverCommandsJson.length} comandos no servidor ${guildId}.`);
                     const guildData = await rest.put(
                         Routes.applicationGuildCommands(clientId, guildId),
                         { body: serverCommandsJson },
                     );
                     console.log(`[CommandHandler] ${guildData.length} comandos registrados/atualizados no servidor ${guildId}.`);
                 } catch (error) {
                     console.error(`[ERRO][CommandHandler] Falha ao registrar comandos no SERVIDOR ${guildId}:`, error);
                 }
            } else {
                 console.log(`[CommandHandler] Nenhum comando específico para registrar em ${guildId}.`);
                 // Opcional: Limpar comandos antigos da guilda (CUIDADO)
                 // await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            }

             console.log('[CommandHandler] Registo de Slash Commands concluído.'.green);

        } catch (error) {
            console.error('[ERRO GERAL][CommandHandler] Falha no registo de Slash Commands:', error);
            if(this.API.client?.emit) this.API.client.emit('error', error); // Emite erro
        }
    }
}

module.exports = CommandHandler;