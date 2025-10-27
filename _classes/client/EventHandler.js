// _classes/client/EventHandler.js

const glob = require('glob');
const path = require('path');
require('colors'); // Para logs

class EventHandler {
    constructor(client, api) {
        this.client = client;
        this.API = api; // API centralizada
        this.eventsPath = path.join(__dirname, '..', '..', 'events', '*.js'); // Caminho para ../../events/*.js
    }

    loadAll() {
        console.log('[EventHandler] Carregando eventos...'.yellow);
        const eventFiles = glob.sync(this.eventsPath);
        console.log(`[EventHandler] Encontrados ${eventFiles.length} arquivos de eventos.`);

        for (const file of eventFiles) {
            try {
                console.log(`[EventHandler] Tentando carregar evento: ${path.basename(file)}`);
                // Limpa cache para permitir recarregamento se necessário
                delete require.cache[require.resolve(file)];
                const event = require(file);

                // Valida se o evento tem nome e função execute
                if (!event.name || typeof event.execute !== 'function') {
                    console.warn(`[AVISO][EventHandler] Evento ${file} inválido (sem nome ou execute). Pulando.`);
                    continue;
                }

                // Determina se o evento deve ser 'once' ou 'on'
                const eventMethod = event.once ? 'once' : 'on';

                // Registra o listener no cliente
                // Usa (...args) => event.execute(this.API, ...args) para passar a API
                // e todos os argumentos originais do evento para a função execute.
                this.client[eventMethod](event.name, (...args) => {
                    try {
                         // Passa a API e os argumentos do evento
                         event.execute(this.API, ...args);
                    } catch (executeError) {
                         console.error(`[ERRO][EventHandler] Falha ao EXECUTAR evento ${event.name} de ${path.basename(file)}:`, executeError);
                         // Emite um erro global se a execução falhar
                         if(this.API.client?.emit) this.API.client.emit('error', executeError);
                    }
                });

                console.log(`[EventHandler] Evento ${event.name} (${path.basename(file)}) carregado.`);

            } catch (err) {
                console.error(`[ERRO][EventHandler] Falha ao CARREGAR evento ${file}:`, err);
                 if(this.API.client?.emit) this.API.client.emit('error', err);
            }
        }
        console.log('[EventHandler] Carregamento de eventos concluído.'.green);
    }
}

module.exports = EventHandler;