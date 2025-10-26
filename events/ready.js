// events/ready.js (Com inicialização completa)

module.exports = {
    name: 'ready',
    once: true, // Garante que roda apenas uma vez por shard
    async execute(client, API_inicial) { // Recebe o client e a API mínima (se passada pelo handler)
        const shardId = client.shard?.ids[0] ?? 'N/A';
        console.log(`[Ready - Shard ${shardId}] Evento 'ready' disparado! Online como ${client.user.tag}. Iniciando componentes...`);

        try {
            // --- 1. INSTANCIAR DB MANAGER ---
            console.log(`[Ready - Shard ${shardId}] Instanciando DatabaseManager...`);
            const DatabaseManager = require('../_classes/manager/DatabaseManager'); // Carrega a classe
            client.db = new DatabaseManager(); // Instancia e anexa ao client
            console.log(`[Ready - Shard ${shardId}] DatabaseManager instanciado.`);

            // --- 2. CARREGAR/ATUALIZAR API COMPLETA ---
            console.log(`[Ready - Shard ${shardId}] Carregando/Atualizando API completa...`);
            // Recarrega a API para garantir que tem todas as dependências
            // (Assume que a versão simplificada da API foi usada antes, se não, ajusta)
            const API = require("../_classes/api"); // Carrega a API completa AGORA
            client.API = API; // Anexa a API completa ao client
            API.client = client; // Garante que a API tem a referência correta ao client (com client.db)
            API.Discord = require('discord.js'); // Garante que DiscordJS está na API
            console.log(`[Ready - Shard ${shardId}] API completa carregada e client injetado.`);

            // --- 3. INICIALIZAR MÓDULOS DA API ---
            console.log(`[Ready - Shard ${shardId}] Inicializando módulos da API (Shop, Town, etc.)...`);
            // Agora estes módulos podem usar API.client.db com segurança
            await API.shopExtension.load(); // Usa await se for async
            await API.townExtension.init(); // Usa await se for async
            // Adiciona inicialização do Company (lembra que é classe)
            // if (API.CompanyClass) { // Verifica se a classe foi carregada na API
            //     API.company = new API.CompanyClass(client);
            //     await API.company.init();
            //     console.log(`[Ready - Shard ${shardId}] Módulo Company inicializado.`);
            // }
            // Adiciona outros módulos aqui se precisarem de init()
            console.log(`[Ready - Shard ${shardId}] Módulos da API inicializados.`);

            // --- 4. CARREGAR RESTANTE DOS EVENTOS E COMANDOS ---
            console.log(`[Ready - Shard ${shardId}] Instanciando e carregando CommandHandler e outros Eventos...`);
            // Recria ou atualiza os handlers com a API completa
            const EventHandler = require('../_classes/client/EventHandler');
            const CommandHandler = require('../_classes/client/CommandHandler');

            // Reinstancia ou atualiza os handlers no client
            client.eventHandler = new EventHandler(client, API);
            client.commandHandler = new CommandHandler(client, API, client.options);

            // Carrega os outros eventos (exceto 'ready' que já estamos a executar)
            client.eventHandler.loadAll(true); // Passa true para skipReady (se a função suportar)
            // Carrega os comandos
            await client.commandHandler.loadAll(); // Usa await se for async
            console.log(`[Ready - Shard ${shardId}] Handlers carregados.`);

            // --- 5. CARREGAR SERVIDOR EXPRESS ---
            console.log(`[Ready - Shard ${shardId}] Carregando servidor Express...`);
            // Recria a função aqui ou chama um método se existir no client
            if (typeof client.loadExpressServer === 'function') { // Verifica se o método existe (se não foi removido)
                 client.loadExpressServer(client.options);
            } else { // Recria a lógica aqui se necessário
                 const options = client.options;
                 if (options.ip && options.ip !== 'localhost' && options.dbl?.token) {
                     try { /* ... lógica do AutoPoster ... */ } catch (err) { /* ... */ }
                 } else { console.log(`[Ready - Shard ${shardId}] AutoPoster não iniciado.`); }
                 console.log(`[Ready - Shard ${shardId}] Lógica Express concluída.`);
            }

            // --- 6. DEFINIR ACTIVITY ---
            console.log(`[Ready - Shard ${shardId}] Definindo activity...`);
            const guildCount = client.guilds?.cache?.size ?? 0;
            const activityString = `${API.prefix}help | ${guildCount} Servers`;
            client.user.setActivity(activityString, { type: 'PLAYING' });
            console.log(`[Ready - Shard ${shardId}] Activity definida: "${activityString}"`);

            // --- FINALIZAÇÃO ---
            console.log(`[Ready - Shard ${shardId}] Bot ${client.user.tag} está totalmente pronto e operacional.`);

        } catch (err) {
            console.error(`[ERRO CRÍTICO no Ready - Shard ${shardId}] Falha ao inicializar componentes:`, err);
            // Considera desligar o shard se a inicialização falhar criticamente
            // process.exit(1);
        }
    },
};