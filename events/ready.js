const trustedguilds = ['693150851396796446'];
require('colors'); // Adicionado require colors se for usar .green

module.exports = {

    name: "ready",
    execute: async (API) => {
        const client = API.client;
        console.log('[READY] Evento Ready iniciado.');

        async function u() {
            try {
                // console.log('[READY] Tentando setar atividade...'); // Log repetitivo, comentado
                // Garante que client.user existe antes de tentar usá-lo
                 if (client.user) {
                     client.user.setActivity(`[${API.version}] Prefixo / | Tempo online: ${API.uptime()}`);
                     // console.log('[READY] Atividade setada.'); // Log repetitivo, comentado
                 } else {
                     console.warn('[READY] client.user ainda não está disponível para setActivity.');
                 }
            } catch (err) {
                console.error('[ERRO][READY] Falha ao setar atividade:', err); // Log de erro específico
                if (API.client && API.client.emit) { API.client.emit('error', err); }
            }
        }
        await u(); // Chamar a função na inicialização

        // Configura intervalos (mantém o código original)
        setInterval(async () => {
            await u(); // Chamar a função u periodicamente
        }, 60000);
        setInterval(async () => {
            try { // Adicionado try-catch para sweep
                 console.log('[SWEEP] Iniciando sweep de mensagens e emojis...');
                 client.sweepMessages(1800);
                 client.emojis.cache.sweep((emoji) => {
                     // Lógica original de sweep de emojis
                     if (!emoji.guild) return true; // Remove emojis sem guild (pode acontecer?)
                     if (emoji.guild.name.includes('Emotes') || trustedguilds.includes(emoji.guild.id)) {
                         return false;
                     }
                     return true;
                 });
                 console.log('[SWEEP] Sweep concluído.');
            } catch(sweepErr) {
                 console.error('[ERRO][SWEEP] Falha durante o sweep:', sweepErr);
            }
        }, 1800000);

        const moment = require('moment');
        moment.suppressDeprecationWarnings = true;

        // --- Carregamento dos Módulos Essenciais ---
        // (Coloque os try-catch aqui para isolar erros específicos de cada módulo)

        console.log('[READY] Carregando API.cacheLists.remember...');
        try {
            // Verifica se a função load existe antes de chamar
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
            // Verifica se o módulo e a função existem antes de chamar
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


        console.log(`\n         Bot iniciado.`.green);
        console.log(`         Versão ${API.version}\n`.green);
        console.log('[READY] Evento Ready concluído.');
    }

}