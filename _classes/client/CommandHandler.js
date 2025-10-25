// _classes/client/CommandHandler.js

const { Collection, SlashCommandBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const glob = require('glob');
const path = require('path');

class CommandHandler {
    constructor(client, api, options) {
        this.client = client;
        this.API = api;
        this.options = options; // Guardar options para usar no loadSlashCommands
        this.commandsPath = path.join(__dirname, '..', '..', 'commands', '*/*.js'); // Ajuste se necessário
        this.commands = new Collection(); // Coleção para guardar os comandos carregados
    }

    async loadAll() {
        console.log('[CommandHandler] Iniciando carregamento de comandos...');
        try {
            await this.loadCommandFiles();
            console.log(`[CommandHandler] ${this.commands.size} comandos carregados na Collection.`);

            await this.registerSlashCommands();
            console.log(`[CommandHandler] Registro de Slash Commands iniciado.`);

        } catch (error) {
            console.error('[ERRO][CommandHandler] Falha no processo loadAll:', error);
        }
    }

    async loadCommandFiles() {
        const commandFiles = glob.sync(this.commandsPath);
        console.log(`[CommandHandler] Encontrados ${commandFiles.length} arquivos de comando.`);

        for (const file of commandFiles) {
             try {
                if (!file.includes('!')) { // Ignora arquivos template
                    console.log(`[CommandHandler] Processando arquivo: ${file}`);
                    delete require.cache[require.resolve(file)];
                    const command = require(file);

                    if (!command.name || typeof command.execute !== 'function') {
                        console.warn(`[AVISO][CommandHandler] Comando ${file} inválido. Pulando.`);
                        continue;
                    }

                    // Adiciona à coleção interna
                    this.commands.set(command.name, command);

                    // Prepara dados para Slash Command se não existirem
                    if (!command.data) {
                        command.data = new SlashCommandBuilder()
                            .setName(command.name)
                            .setDescription(command.description || 'Sem descrição');
                         // Adicionar lógica de 'options' aqui, se necessário, baseada na estrutura do comando
                    }
                    // Garante nome e descrição
                     if (!command.data.name) command.data.setName(command.name);
                     if (!command.data.description) command.data.setDescription(command.description || 'Sem descrição');

                    console.log(`[CommandHandler] Comando ${command.name} carregado.`);
                }
            } catch (err) {
                console.error(`[ERRO][CommandHandler] Falha ao carregar ${file}:`, err);
            }
        }
        // Disponibiliza a coleção no client principal também (opcional, mas útil)
        this.client.commands = this.commands;
    }

     // Extrai a lógica de obter os JSONs para registro
     _getCommandJsonsForRegistration() {
         const globalCommandsJson = [];
         const serverCommandsJson = []; // Comandos específicos de guilda (STAFF)

         for (const command of this.commands.values()) {
            if (!command.disabled && command.data) { // Verifica se tem 'data' (para slash) e não está desabilitado
                 // Lógica de categoria (simplificada, ajuste conforme sua necessidade)
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


    async registerSlashCommands() {
        console.log('[CommandHandler] Tentando registrar/atualizar Slash Commands...');
        const rest = new REST({ version: '10' }).setToken(this.client.token); // Usa o token do client
        const clientId = this.options.app.id; // Usa o ID das options

        try {
            const { globalCommandsJson, serverCommandsJson } = this._getCommandJsonsForRegistration();

            // --- Registro Global ---
            try {
                console.log(`[CommandHandler] Iniciando registro de ${globalCommandsJson.length} comandos globais (Client ID: ${clientId}).`);
                const globalData = await rest.put(
                    Routes.applicationCommands(clientId),
                    { body: globalCommandsJson },
                );
                console.log(`[CommandHandler] ${globalData.length} comandos globais registrados/atualizados.`);
            } catch (error) {
                 console.error('[ERRO][CommandHandler] Falha ao registrar comandos GLOBAIS:', error);
            }

            // --- Registro Específico da Guilda (STAFF) ---
            const guildId = '693150851396796446'; // Mantenha ou torne configurável
             if (serverCommandsJson.length > 0) {
                 try {
                     console.log(`[CommandHandler] Iniciando registro de ${serverCommandsJson.length} comandos no servidor ${guildId}.`);
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
                 // Opcional: Limpar comandos antigos da guilda
                 // await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            }

             console.log('[CommandHandler] Registro de Slash Commands concluído.');

        } catch (error) {
            console.error('[ERRO][CommandHandler] Falha GERAL no registro de Slash Commands:', error);
        }
    }
}

module.exports = CommandHandler;