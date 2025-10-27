// events/ready.js

const config = require('../_classes/config');
require('colors');
// const { ActivityType } = require('discord.js'); // Descomente se usar ActivityType.Watching

module.exports = {

    name: "ready",
    once: true,

    execute: async (API) => {
        const client = API.client;

        console.log(`[READY] Shard ${client.shard?.ids[0] ?? 0} conectado como ${client.user?.tag ?? 'Utilizador Desconhecido'}`.green); // Adicionado fallback para user?.tag

        // Define atividade
        try {
            // Garante que client.user existe antes de chamar setActivity
            if (client.user) {
                client.user.setActivity({
                    name: `/ajuda | Shard ${client.shard?.ids[0] ?? 0}`,
                    type: 3 // Watching
                    // type: ActivityType.Watching // Alternativa
                });
                console.log(`[READY] Atividade definida para shard ${client.shard?.ids[0] ?? 0}.`);
            } else {
                 console.warn(`[WARN][READY] client.user não disponível ao definir atividade para shard ${client.shard?.ids[0] ?? 0}.`.yellow);
            }
        } catch (activityError) {
             console.error(`[ERRO][READY] Falha ao definir atividade para shard ${client.shard?.ids[0] ?? 0}:`, activityError);
        }

        // Carrega estado de eventos e cotação
        try {
             console.log(`[READY] Carregando estado dos eventos para shard ${client.shard?.ids[0] ?? 0}...`);
             await API.events.load();
             console.log(`[READY] Estado dos eventos carregado para shard ${client.shard?.ids[0] ?? 0}.`);

             console.log(`[READY] Carregando cotação para shard ${client.shard?.ids[0] ?? 0}...`);
             await API.maqExtension.loadCot();
             console.log(`[READY] Cotação carregada para shard ${client.shard?.ids[0] ?? 0}.`);
        } catch (loadError) {
             console.error(`[ERRO FATAL][READY] Falha ao carregar dados (eventos/cotação) no ready para shard ${client.shard?.ids[0] ?? 0}:`, loadError);
        }

        // ----> NOVO: Registar comandos slash DEPOIS do bot estar pronto <----
        try {
            // Acede ao commandHandler através do client injetado na API
            if (API.client?.commandHandler?.registerSlashCommands) {
                 console.log(`[READY] Iniciando registo de Slash Commands para shard ${client.shard?.ids[0] ?? 0}...`.cyan);
                 // Chama a função que agora SÓ regista os comandos
                 await API.client.commandHandler.registerSlashCommands();
                 console.log(`[READY] Registo de Slash Commands concluído para shard ${client.shard?.ids[0] ?? 0}.`.cyan);
            } else {
                 console.error(`[ERRO][READY] CommandHandler ou registerSlashCommands não encontrado em API.client!`.red);
            }
        } catch (registerError) {
             console.error(`[ERRO][READY] Falha ao registar Slash Commands no evento ready para shard ${client.shard?.ids[0] ?? 0}:`, registerError);
             // Não parar o bot, mas registar o erro
        }

        console.log(`[READY] Shard ${client.shard?.ids[0] ?? 0} está totalmente pronto!`.cyan.bold);
    }
}