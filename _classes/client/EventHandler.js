// _classes/client/EventHandler.js

const fs = require('fs');
const path = require('path');

class EventHandler {
    constructor(client, api) {
        this.client = client;
        this.API = api;
        this.eventsPath = path.join(__dirname, '..', '..', 'events'); // Ajuste o caminho se necessário
    }

    loadAll() {
        console.log('[EventHandler] Carregando eventos...');
        fs.readdir(this.eventsPath, (err, files) => {
            if (err) {
                console.error('[ERRO][EventHandler] Falha ao ler a pasta de eventos:', err);
                return;
            }

            const eventFiles = files.filter(file => file.endsWith('.js'));
            console.log(`[EventHandler] Encontrados ${eventFiles.length} arquivos de eventos.`);

            eventFiles.forEach(file => {
                const filePath = path.join(this.eventsPath, file);
                console.log(`[EventHandler] Tentando carregar evento: ${file}`);
                try {
                    delete require.cache[require.resolve(filePath)]; // Limpar cache
                    const event = require(filePath);

                    if (!event.name || typeof event.execute !== 'function') {
                        console.warn(`[AVISO][EventHandler] Evento ${file} inválido (sem nome ou execute). Pulando.`);
                        return;
                    }

                    // Usa 'this.API' que foi passado no construtor
                    if (event.name !== 'ready') {
                        this.client.on(event.name, (...args) => event.execute(this.API, ...args));
                    } else {
                        // Garante que o evento 'ready' só rode uma vez por inicialização
                        this.client.once(event.name, (...args) => event.execute(this.API, ...args));
                    }
                    console.log(`[EventHandler] Evento ${event.name} (${file}) carregado.`);
                } catch (err) {
                    console.error(`[ERRO][EventHandler] Falha ao carregar o evento ${file}:`, err);
                }
            });
            console.log(`[EventHandler] Carregamento de eventos concluído.`);
        });
    }
}

module.exports = EventHandler;