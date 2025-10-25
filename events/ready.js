const trustedguilds = ['693150851396796446'];
require('colors'); // Adicionado require colors se for usar .green
const { ActivityType } = require('discord.js'); // ATUALIZAÇÃO v14: Importar ActivityType

module.exports = {

    name: "ready",
    execute: async (API) => {
        const client = API.client;
        console.log('[READY] Evento Ready iniciado.');

        async function u() {
            try {
                 if (client.user) {
                     // ATUALIZAÇÃO v14: setActivity agora requer um objeto com 'name' e 'type'
                     client.user.setActivity({
                         name: `[${API.version}] Prefixo / | Tempo online: ${API.uptime()}`,
                         type: ActivityType.Playing // Ou Watching, Listening, Competing
                     });
                 } else {
                     console.warn('[READY] client.user ainda não está disponível para setActivity.');
                 }
            } catch (err) {
                console.error('[ERRO][READY] Falha ao setar atividade:', err); // Log de erro específico
                if (API.client && API.client.emit) { API.client.emit('error', err); }
            }
        }
        await u(); // Chamar a função na inicialização

        // Configura intervalos
        setInterval(async () => {
            await u(); // Chamar a função u periodicamente
        }, 60000);

        // ATUALIZAÇÃO v14: Remover sweepMessages e emojis.cache.sweep
        /*
         setInterval(async () => {
             try {
                 console.log('[SWEEP] Iniciando sweep...'); // Simplificado
                 // client.sweepMessages(1800); // Removido
                 // client.emojis.cache.sweep(...) // Removido
                 console.log('[SWEEP] Sweep (automático v14) concluído.'); // Nota sobre v14
             } catch(sweepErr) {
                 console.error('[ERRO][SWEEP] Falha durante o sweep:', sweepErr);
             }
         }, 1800000);
         */
         // O intervalo acima foi comentado/removido pois as funções não existem mais.

        const moment = require('moment');
        moment.suppressDeprecationWarnings = true;

        // --- Carregamento dos Módulos Essenciais ---
        // (Coloque os try-catch aqui para isolar erros específicos de cada módulo)

        console.log('[READY] Carregando API.cacheLists.remember...');
        try {
             if (API.cacheLists && API.cacheLists.remember && typeof API.cacheLists.remember.load === 'function') {
                await API.cacheLists.remember.load();
                console.log('[READY] API.cacheLists.remember carregado.');
            } else {
                 console.warn('[AVISO][READY] API.cacheLists.remember.load não encontrado.');
            }
        } catch (err) {
            console.error('[ERRO] Falha ao carregar API.cacheLists.remember:', err);
             if (API.client && API.client.emit) { API.client.emit('error', err); }
        }


        console.log('[READY] Carregando API.company.jobs.process...');
        try {
             if (API.company && API.company.jobs && API.company.jobs.process && typeof API.company.jobs.process.load === 'function') {
                await API.company.jobs.process.load();
                console.log('[READY] API.company.jobs.process carregado.');
            } else {
                 console.warn('[AVISO][READY] API.company.jobs.process.load não encontrado.');
            }
        } catch (err) {
            console.error('[ERRO] Falha ao carregar API.company.jobs.process:', err);
             if (API.client && API.client.emit) { API.client.emit('error', err); }
        }

        console.log('[READY] Carregando API.shopExtension...');
        try {
             if (API.shopExtension && typeof API.shopExtension.load === 'function') {
                await API.shopExtension.load();
                console.log('[READY] API.shopExtension carregado.');
            } else {
                 console.warn('[AVISO][READY] API.shopExtension.load não encontrado.');
            }
        } catch (err) {
            console.error('[ERRO] Falha ao carregar API.shopExtension:', err);
             if (API.client && API.client.emit) { API.client.emit('error', err); }
        }

        console.log('[READY] Carregando API.events...');
        try {
             if (API.events && typeof API.events.load === 'function') {
                await API.events.load();
                console.log('[READY] API.events carregado.');
            } else {
                 console.warn('[AVISO][READY] API.events.load não encontrado.');
            }
        } catch (err) {
            console.error('[ERRO] Falha ao carregar API.events:', err);
            if (API.client && API.client.emit) { API.client.emit('error', err); }
        }

        // --- ADICIONADO: Carregar crateExtension ---
        console.log('[READY] Carregando API.crateExtension...');
        try {
            if (API.crateExtension && typeof API.crateExtension.load === 'function') {
                await API.crateExtension.load();
                console.log('[READY] API.crateExtension carregado.');
            } else {
                console.warn('[AVISO][READY] API.crateExtension.load não encontrado. O módulo foi carregado corretamente?');
            }
        } catch (err) {
            console.error('[ERRO] Falha ao carregar API.crateExtension:', err);
             if (API.client && API.client.emit) { API.client.emit('error', err); }
        }
        // --- FIM DA ADIÇÃO ---


        console.log(`\n        Bot iniciado.`.green);
        console.log(`        Versão ${API.version}\n`.green);
        console.log('[READY] Evento Ready concluído.');
    }

}