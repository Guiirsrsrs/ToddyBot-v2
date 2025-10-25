// _classes/api/modules/company.js

const API = require('../index');
const DatabaseManager = API.DatabaseManager; // Usa a instância
const fs = require('fs');
const path = require('path');
require('colors'); // Para logs

const debugmode = false; // Mantenha false a menos que esteja depurando

// Objeto principal 'company' que será exportado
const company = {
    // Sub-objetos para organização
    check: {},
    get: {},
    stars: {},
    jobs: {
        explore: { mobs: { obj: {} }, equips: { obj: {} } },
        fish: { update: 5, rods: { obj: {} }, list: { obj: {} } },
        agriculture: { update: 15 },
        process: { update: 40, tools: { obj: {} }, current: [], lastprocess: new Map() }
    },
    // Mapeamentos (mantidos)
    e: { /* ... (mapeamento tipo -> info) ... */ },
    types: { /* ... (mapeamento numero -> nome tipo) ... */ }
};

// --- Funções Stars ---
{
    /**
     * Adiciona score e rendimento à atividade de empresa de um jogador.
     * @param {string} user_id - ID do jogador.
     * @param {string} company_id - ID da empresa.
     * @param {object} options - Opções { score?: number|string, rend?: number|string }.
     */
    company.stars.add = async function(user_id, company_id, options) {
        try {
            const playerDoc = await DatabaseManager.findOne('players', { user_id: user_id });
            const companyDoc = await company.get.companyById(company_id); // Usa a função 'get' refatorada

            if (!playerDoc || !companyDoc) {
                console.warn(`[Company.Stars] Jogador ${user_id} ou Empresa ${company_id} não encontrados.`);
                return;
            }

            // Garante que companyact exista e tenha valores padrão
            let playerCompanyAct = playerDoc.companyact || { score: 0, last: 0, rend: 0 };
            // Converte scores/rends existentes para número para garantir operações corretas
            playerCompanyAct.score = Number(playerCompanyAct.score) || 0;
            playerCompanyAct.rend = Number(playerCompanyAct.rend) || 0;


            const updateCompanyFields = {};
            const updatePlayerFields = {};

            if (options.score) {
                const scoreToAdd = parseFloat(options.score);
                if (!isNaN(scoreToAdd)) {
                    // Atualiza score da empresa (usando $inc)
                    await DatabaseManager.updateOne('companies', { company_id: company_id }, { $inc: { score: scoreToAdd } });
                    // Calcula novo score do jogador
                    playerCompanyAct.score = parseFloat((playerCompanyAct.score + scoreToAdd).toFixed(2));
                }
            }

            if (options.rend) {
                const rendToAdd = parseInt(options.rend);
                if (!isNaN(rendToAdd)) {
                    playerCompanyAct.rend += Math.round(rendToAdd);
                }
            }

            playerCompanyAct.last = Date.now();

            // Atualiza companyact no documento do jogador
            await DatabaseManager.updateOne('players', { user_id: user_id }, { $set: { companyact: playerCompanyAct } });

        } catch (err) {
            console.error(`[ERRO][Company.Stars] Falha ao adicionar stars para ${user_id} na empresa ${company_id}:`, err);
            if(API.client?.emit) API.client.emit('error', err);
        }
    };

    /**
     * Gera um valor aleatório de "score" (estrela).
     * @returns {string} Valor formatado com 2 casas decimais.
     */
    company.stars.gen = function() {
        // Mantida a lógica original, usando API.utils.random
        let x1 = API.utils.random(0, 3);
        let x2 = API.utils.random(2, 6);
        let y = parseFloat('0.' + x1 + '' + x2);
        return y.toFixed(2);
    };
}

// --- Funções Check ---
{
    /**
     * Verifica se um usuário possui uma empresa ativa.
     * @param {string} user_id - ID do usuário.
     * @returns {Promise<boolean>} True se possui empresa, false caso contrário.
     */
    company.check.hasCompany = async function(user_id) {
        try {
            const filter = { user_id: user_id, type: { $exists: true, $ne: 0 } }; // Verifica se type existe e não é 0
            const companyDoc = await DatabaseManager.findOne('companies', filter, { projection: { _id: 1 } }); // Busca apenas _id para eficiência
            return !!companyDoc; // Retorna true se encontrou, false se não
        } catch (err) {
            console.error(`[ERRO][Company.Check] Falha ao verificar se ${user_id} tem empresa:`, err);
            if(API.client?.emit) API.client.emit('error', err);
            return false; // Retorna false em caso de erro
        }
    };

    /**
     * Verifica se um usuário é funcionário de alguma empresa.
     * @param {string} user_id - ID do usuário.
     * @returns {Promise<boolean>} True se for funcionário, false caso contrário.
     */
    company.check.isWorker = async function(user_id) {
        try {
            const playerDoc = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { company: 1 } });
            const currentCompanyId = playerDoc?.company;

            if (!currentCompanyId) {
                return false; // Não está associado a nenhuma empresa
            }

            // Verifica se a empresa associada ainda existe
            const companyExists = await company.get.companyById(currentCompanyId);
            if (!companyExists) {
                // Limpa o campo 'company' do jogador se a empresa não existe mais
                await DatabaseManager.updateOne('players', { user_id: user_id }, { $set: { company: null } });
                console.log(`[Company.Check] Empresa ${currentCompanyId} não encontrada para funcionário ${user_id}. Campo 'company' limpo.`);
                return false;
            }

            return true; // Tem um companyId válido e a empresa existe
        } catch (err) {
             console.error(`[ERRO][Company.Check] Falha ao verificar se ${user_id} é funcionário:`, err);
             if(API.client?.emit) API.client.emit('error', err);
             return false;
        }
    };

    /**
     * Verifica se uma empresa tem vagas abertas.
     * @param {string} company_id - ID da empresa.
     * @returns {Promise<boolean>} True se tem vagas, false caso contrário.
     */
    company.check.hasVacancies = async function(company_id) {
        try {
            const companyDoc = await company.get.companyById(company_id); // Reutiliza a função get
            if (!companyDoc) return false; // Empresa não existe

            return company.check.hasVacanciesByCompany(companyDoc); // Reutiliza a lógica
        } catch (err) {
            console.error(`[ERRO][Company.Check] Falha ao verificar vagas para ${company_id}:`, err);
             if(API.client?.emit) API.client.emit('error', err);
            return false;
        }
    };

    /**
     * Verifica se um documento de empresa (já obtido) indica que há vagas.
     * @param {object} companyDoc - Documento da empresa do MongoDB.
     * @returns {boolean} True se tem vagas, false caso contrário.
     */
    company.check.hasVacanciesByCompany = function(companyDoc) {
         if (!companyDoc || companyDoc.openvacancie === false) {
             return false; // Não existe ou está fechada para vagas
         }
         const currentWorkers = Array.isArray(companyDoc.workers) ? companyDoc.workers.length : 0;
         const maxWorkers = companyDoc.funcmax || 0; // Assume 0 se funcmax não existir
         return currentWorkers < maxWorkers;
    };
}

// --- Funções Get ---
{
    /**
     * Obtém o número máximo de funcionários de uma empresa.
     * @param {string} company_id - ID da empresa.
     * @returns {Promise<number>} Número máximo de funcionários (padrão 3).
     */
    company.get.maxWorkers = async function(company_id) {
        try {
            const companyDoc = await company.get.companyById(company_id);
            return companyDoc?.funcmax || 3; // Retorna funcmax ou 3 como padrão
        } catch (err) {
            console.error(`[ERRO][Company.Get] Falha ao obter maxWorkers para ${company_id}:`, err);
            if(API.client?.emit) API.client.emit('error', err);
            return 3; // Retorna padrão em caso de erro
        }
    };

    /**
     * Obtém o documento completo de uma empresa pelo ID.
     * @param {string} company_id - ID da empresa.
     * @returns {Promise<object|null>} Documento da empresa ou null se não encontrada.
     */
    company.get.companyById = async function(company_id) {
        try {
            const filter = { company_id: company_id };
            const companyDoc = await DatabaseManager.findOne('companies', filter);
            return companyDoc; // Retorna o documento ou null
        } catch (err) {
             console.error(`[ERRO][Company.Get] Falha ao obter empresa por ID ${company_id}:`, err);
             if(API.client?.emit) API.client.emit('error', err);
             return null;
        }
    };

    /**
     * Obtém o objeto User do Discord do dono da empresa.
     * @param {string} company_id - ID da empresa.
     * @returns {Promise<User|null>} Objeto User do Discord ou null.
     */
    company.get.ownerById = async function(company_id) {
        try {
            const filter = { company_id: company_id };
            const options = { projection: { user_id: 1 } }; // Pega apenas user_id
            const companyDoc = await DatabaseManager.findOne('companies', filter, options);

            if (!companyDoc?.user_id) return null; // Não encontrou ou não tem user_id

            // Busca o usuário no Discord
            return await API.client.users.fetch(companyDoc.user_id);
        } catch (err) {
             console.error(`[ERRO][Company.Get] Falha ao obter dono da empresa ${company_id}:`, err);
             // Não emitir erro do Discord aqui, apenas erro do DB se houver
             if (!(err instanceof API.Discord.DiscordAPIError) && API.client?.emit) {
                  API.client.emit('error', err);
             }
             return null;
        }
    };

    /**
     * Obtém o ID da empresa de um usuário (se ele for dono).
     * @param {string} user_id - ID do usuário.
     * @returns {Promise<string|null>} ID da empresa ou null.
     */
    company.get.idByOwner = async function(user_id) {
        try {
            const filter = { user_id: user_id };
            const options = { projection: { company_id: 1 } }; // Pega apenas company_id
            const companyDoc = await DatabaseManager.findOne('companies', filter, options);
            return companyDoc?.company_id || null; // Retorna company_id ou null
        } catch (err) {
             console.error(`[ERRO][Company.Get] Falha ao obter ID da empresa pelo dono ${user_id}:`, err);
             if(API.client?.emit) API.client.emit('error', err);
             return null;
        }
    };

    /**
     * Obtém o documento completo da empresa de um usuário (se ele for dono).
     * @param {string} user_id - ID do usuário.
     * @returns {Promise<object|null>} Documento da empresa ou null.
     */
    company.get.companyByOwnerId = async function(user_id) {
        try {
            const filter = { user_id: user_id };
            const companyDoc = await DatabaseManager.findOne('companies', filter);
            return companyDoc; // Retorna o documento ou null
        } catch (err) {
             console.error(`[ERRO][Company.Get] Falha ao obter empresa pelo dono ${user_id}:`, err);
             if(API.client?.emit) API.client.emit('error', err);
             return null;
        }
    };
}


// --- Lógica de Jobs ---
// (As funções load e get dos JSONs precisam corrigir os caminhos)
// (A lógica de loopProcess precisa ser atualizada para MongoDB)
{
    // Funções load (Exemplo para mobs, replicar para outros)
    const loadJsonData = (subPath, targetObject, logName) => {
        // Usa path.join para criar caminho absoluto e robusto
        const jsonPath = path.join(__dirname, '..', '..', '..', '_json', subPath); // ../../../_json/
        try {
            const jsonString = fs.readFileSync(jsonPath, 'utf8');
            targetObject.obj = JSON.parse(jsonString);
            if (API.debug) console.log(`[Company.Jobs] ${logName} list loaded.`.yellow);
        } catch (err) {
            console.error(`[ERRO][Company.Jobs] Falha ao carregar ${logName} de ${jsonPath}:`, err);
            targetObject.obj = []; // Define como array vazio em caso de erro
             if(API.client?.emit) API.client.emit('error', err);
        }
    };

    // Exploração
    company.jobs.explore.mobs.get = function() {
        if (!company.jobs.explore.mobs.obj || Object.keys(company.jobs.explore.mobs.obj).length === 0) company.jobs.explore.mobs.load();
        return company.jobs.explore.mobs.obj;
    };
    company.jobs.explore.mobs.load = function() { loadJsonData('companies/exploration/mobs.json', company.jobs.explore.mobs, 'Mob'); };

    company.jobs.explore.equips.get = function(level, qnt) { /* ... (lógica mantida, mas usa load corrigido) ... */
        if (!company.jobs.explore.equips.obj || Object.keys(company.jobs.explore.equips.obj).length === 0) company.jobs.explore.equips.load();
        // ... resto da lógica ...
        let equipobj = company.jobs.explore.equips.obj;
        // ... (filtragem, shuffle, etc.)
         let filteredequips = equipobj.filter((r) => level+1 >= r.level).sort(function(a, b){
            return b.level - a.level;
        });

        if (filteredequips.length == 0) return undefined;

        function shuffle(array) {
            var currentIndex = array.length, temporaryValue, randomIndex;
            while (0 !== currentIndex) {
              randomIndex = Math.floor(Math.random() * currentIndex);
              currentIndex -= 1;
              temporaryValue = array[currentIndex];
              array[currentIndex] = array[randomIndex];
              array[randomIndex] = temporaryValue;
            }
            return array;
        }

        filteredequips = filteredequips.slice(0, qnt*2);
        shuffle(filteredequips);
        filteredequips = filteredequips.slice(0, qnt);

        if (API.debug)console.log(`${filteredequips.map(e => e.name).join(', ')}`.yellow);
        for (const r of filteredequips) {
            if(!r.dmg) r.dmg = r.level+1*((120-(r.chance*1.13))*0.75/2);
            r.dmg = Math.round(r.dmg);
        }
        filteredequips.sort((a, b) => b.dmg - a.dmg);
        return filteredequips;
    };
    company.jobs.explore.equips.load = function() { loadJsonData('companies/exploration/equip.json', company.jobs.explore.equips, 'Equip'); };

    // Agricultura (Lógica mantida)
    company.jobs.agriculture.calculatePlantTime = function(plant, adubacao) { /* ... (lógica mantida) ... */
        let ms = 0;
        let seedPerArea = (Math.round(plant.qnt / plant.area)) + 2;
        ms = (200 - adubacao) * seedPerArea * (230000);
        ms += (plant.price * 500000) + 1;
        return Math.round(ms);
     };

    // Pescaria
    company.jobs.formatStars = function(stars) { return '⭐'.repeat(stars); };

    company.jobs.fish.rods.get = function(level) { /* ... (lógica mantida, mas usa load corrigido) ... */
         if (!company.jobs.fish.rods.obj || Object.keys(company.jobs.fish.rods.obj).length === 0) company.jobs.fish.rods.load();
          // ... (lógica de shuffle e retorno)
        function shuffle(array) { /* ... */ }
        let filteredequips = company.jobs.fish.rods.possibilities(level); // Usa a função possibilities
        if (!filteredequips || filteredequips.length === 0) return undefined; // Verifica se possibilities retornou algo
        shuffle(filteredequips);
        return filteredequips[0];
    };
    company.jobs.fish.rods.possibilities = function(level) { /* ... (lógica mantida, mas usa load corrigido) ... */
        if (!company.jobs.fish.rods.obj || Object.keys(company.jobs.fish.rods.obj).length === 0) company.jobs.fish.rods.load();
        let equipobj = company.jobs.fish.rods.obj;
        let filteredequips = equipobj.filter(r => level >= r.level);
        if (filteredequips.length === 0) return undefined;
        filteredequips.sort((a, b) => b.level - a.level);
        return filteredequips.slice(0, 3);
    };
    company.jobs.fish.rods.load = function() { loadJsonData('companies/fish/rods.json', company.jobs.fish.rods, 'Rods'); };

    company.jobs.fish.list.get = function(profundidademin, profundidademax) { /* ... (lógica mantida, mas usa load corrigido) ... */
         if (!company.jobs.fish.list.obj || Object.keys(company.jobs.fish.list.obj).length === 0) company.jobs.fish.list.load();
          let fishobj = company.jobs.fish.list.obj;
          let filteredfish = fishobj.filter(r => r.profundidade >= profundidademin && r.profundidade <= profundidademax)
                                .sort((a, b) => b.profundidade - a.profundidade)
                                .slice(0, 7);
         return filteredfish.length === 0 ? undefined : filteredfish;
    };
    company.jobs.fish.list.load = function() { loadJsonData('companies/fish/mobs.json', company.jobs.fish.list, 'Fish'); };

    // Processamento (Atualização significativa para MongoDB)
    company.jobs.process.tools.load = function() { loadJsonData('companies/process/tools.json', company.jobs.process.tools, 'Process Tools'); };

    company.jobs.process.get = async function() {
        // Busca o array 'processing' do documento 'globals'
        const globalDoc = await DatabaseManager.findOne('globals', { _id: API.id }, { projection: { processing: 1 } }); // Assume que _id é API.id
        return globalDoc?.processing || []; // Retorna o array ou um array vazio
    };
    company.jobs.process.includes = async function(user_id) {
        const list = await company.jobs.process.get();
        return list.includes(user_id);
    };
    company.jobs.process.remove = async function(user_id) {
        // Remove o user_id do array 'processing' em 'globals'
        await DatabaseManager.updateOne('globals', { _id: API.id }, { $pull: { processing: user_id } });
        // Remove da lista em memória também
        const index = company.jobs.process.current.indexOf(user_id);
        if (index > -1) {
            company.jobs.process.current.splice(index, 1);
        }
         company.jobs.process.lastprocess.delete(user_id); // Limpa último timestamp
    };
    company.jobs.process.add = async function(user_id) {
        // Adiciona user_id ao array 'processing' se não existir ($addToSet)
        const updateResult = await DatabaseManager.updateOne('globals', { _id: API.id }, { $addToSet: { processing: user_id } });
        // Se foi adicionado (modifiedCount > 0 ou upserted), inicia o loop
        if (updateResult && (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0 || updateResult.matchedCount > 0 /* já existia mas garante início */) ) {
            if (!company.jobs.process.current.includes(user_id)) {
                 company.jobs.process.loopProcess(user_id);
            }
        }
    };
    company.jobs.process.load = async function() {
        // Carrega a lista de quem estava processando e reinicia os loops
        const processingList = await company.jobs.process.get();
        console.log(`[Company.Process] Carregando ${processingList.length} processos pendentes...`.yellow);
        for (const userId of processingList) {
            if (!company.jobs.process.current.includes(userId)) {
                company.jobs.process.loopProcess(userId);
                if (debugmode) console.log('[Company.Process] Reiniciando loop para:', userId);
            }
        }
        // Iniciar o intervalo de verificação (se necessário, mas a lógica atual parece ok)
        // setInterval(...)
    };

    company.jobs.process.loopProcess = async function(user_id) {
        // Adiciona à lista 'current' se não estiver
        if (!company.jobs.process.current.includes(user_id)) {
            company.jobs.process.current.push(user_id);
            if (debugmode) console.log('[Company.Process] Iniciando loopProcess para:', user_id);
        }

        try {
            // --- Início da lógica de processamento de um ciclo ---
            const playersUtilsDoc = await DatabaseManager.findOne('players_utils', { user_id: user_id });
            const machinesDoc = await DatabaseManager.findOne('machines', { user_id: user_id }); // Precisa buscar machines também

             // Verifica se os documentos necessários existem
             if (!playersUtilsDoc || !machinesDoc) {
                 console.warn(`[Company.Process] Documentos não encontrados para ${user_id}. Removendo do processamento.`);
                 await company.jobs.process.remove(user_id);
                 API.cacheLists.waiting.remove(user_id, 'working');
                 return;
             }

            let processData = playersUtilsDoc.process;

            // Se não há dados de processo, remove
            if (!processData || !Array.isArray(processData.in) || !Array.isArray(processData.tools)) {
                console.warn(`[Company.Process] Dados de processo inválidos para ${user_id}. Removendo.`);
                await company.jobs.process.remove(user_id);
                API.cacheLists.waiting.remove(user_id, 'working');
                return;
            }

            const activeProcesses = processData.in.filter(p => p.fragments?.current > 0);

            if (activeProcesses.length === 0) {
                 console.log(`[Company.Process] Nenhum processo ativo para ${user_id}. Removendo.`);
                 await company.jobs.process.remove(user_id);
                 API.cacheLists.waiting.remove(user_id, 'working');
                 return;
            }

            // Garante que API.shopExtension está carregado
            if (!API.shopExtension) {
                 console.error("[Company.Process] API.shopExtension não está disponível!");
                 // Decide se espera ou para
                 setTimeout(() => company.jobs.process.loopProcess(user_id), 5000); // Tenta novamente em 5s
                 return;
            }

            const machine = API.shopExtension.getProduct(machinesDoc.machine || 0) || { tier: 0 }; // Máquina atual ou padrão

            let processedSomething = false; // Flag para saber se algo foi processado neste ciclo

            for (let i = 0; i < activeProcesses.length; i++) {
                const currentProcess = activeProcesses[i];
                const toolIndex = currentProcess.tool; // 0 ou 1
                const tool = processData.tools[toolIndex];

                 // Verifica se a ferramenta existe
                 if (!tool) {
                      console.warn(`[Company.Process] Ferramenta inválida (índice ${toolIndex}) para ${user_id}. Pulando processo.`);
                      continue; // Pula para o próximo processo ativo
                 }

                let canProcess = false;
                let consumeResource = false;

                // Lógica de consumo e verificação de durabilidade/combustível
                if (toolIndex === 0) { // Ferramenta manual (durabilidade)
                    if (tool.durability?.current > 0) {
                        canProcess = true;
                        if (API.utils.random(0, 100) < 25) { // Chance de consumir durabilidade
                            consumeResource = true;
                            const durabilityLoss = Math.max(1, Math.round(1 * (tool.durability.max || 100) / 100)); // Perde pelo menos 1
                            tool.durability.current = Math.max(0, tool.durability.current - durabilityLoss);
                        }
                    }
                } else if (toolIndex === 1) { // Ferramenta automática (combustível)
                    if (tool.fuel?.current > 0) {
                        canProcess = true;
                        if (API.utils.random(0, 100) < 25) { // Chance de consumir combustível
                             const fuelConsumeRate = tool.fuel.consume || 1; // Padrão 1 se não definido
                             if (tool.fuel.current >= fuelConsumeRate) {
                                  consumeResource = true;
                                  tool.fuel.current -= fuelConsumeRate;
                             } else {
                                  // Não tem combustível suficiente para este ciclo de consumo
                                  canProcess = false; // Não pode processar se não pode consumir
                                  tool.fuel.current = 0; // Zera se consumir mais do que tem
                             }
                        }
                    }
                }

                // Se pode processar este item
                if (canProcess && currentProcess.fragments?.current > 0) {
                    processedSomething = true;
                    currentProcess.fragments.current -= 1; // Processa um fragmento

                    // Adicionar XP à ferramenta
                    tool.toollevel = tool.toollevel || { current: 1, max: 10, exp: 0 }; // Valores padrão
                    tool.toollevel.exp += API.utils.random(30, 130);
                    const expNeededForTool = (tool.toollevel.max ** 2) * 100; // Formula exemplo

                    // Level up da ferramenta
                    if (tool.toollevel.exp >= expNeededForTool) {
                        tool.toollevel.exp -= expNeededForTool; // Ou = 0
                        if (tool.toollevel.current < tool.toollevel.max) {
                            tool.toollevel.current += 1;
                             console.log(`[Company.Process] Ferramenta ${toolIndex} de ${user_id} upou para nível ${tool.toollevel.current}`);
                            // Lógica para trocar ferramenta por uma melhor se atingir nível máximo?
                            // (A lógica original tentava buscar uma nova, vamos simplificar por ora)
                        } else {
                             // Já está no nível máximo, talvez dê um bônus?
                             tool.toollevel.exp = 0; // Zera exp no max level
                        }
                    }


                    // Lógica para chance de Drop (simplificada)
                    const dropChanceCheck = API.utils.random(0, 100) < 35;
                    const potencyCheck = API.utils.random(0, tool.potency?.max || 100) < (tool.potency?.current || 0); // Usa valores padrão

                    if (dropChanceCheck && potencyCheck) {
                        // ... (Lógica para determinar raridade e item do drop - complexa, mantida como exemplo)
                         const gnR = API.utils.random(0, 100, true);
                         let chanceAcc = 0;
                         let selectedRarity = "common"; // Padrão
                         const dropRates = tool.drops || { common: 70, uncommon: 20, rare: 8, epic: 2 }; // Taxas padrão
                         for (const rarity in dropRates) {
                             chanceAcc += dropRates[rarity];
                             if (gnR <= chanceAcc) {
                                 selectedRarity = rarity;
                                 break;
                             }
                         }

                         const allDrops = API.itemExtension.getObj()?.drops?.filter(d => d.levelprocess) || [];
                         let possibleDrops = allDrops.filter(d => d.rarity === selectedRarity && (machinesDoc.level || 1) + 6 >= d.levelprocess);

                         if (possibleDrops.length > 0) {
                              possibleDrops.sort((a, b) => b.levelprocess - a.levelprocess);
                              possibleDrops = possibleDrops.slice(0, 8); // Limita a seleção
                              const droppedItem = possibleDrops[API.utils.random(0, possibleDrops.length - 1)];

                              if (droppedItem) {
                                   currentProcess.drops = currentProcess.drops || [];
                                   const existingDrop = currentProcess.drops.find(d => d.name === droppedItem.name);
                                   if (existingDrop) {
                                        existingDrop.quantia = (existingDrop.quantia || 0) + 1;
                                        existingDrop.size = (existingDrop.size || 0) + (droppedItem.size || 1); // Acumula size? Verificar lógica
                                   } else {
                                        currentProcess.drops.push({ ...droppedItem, quantia: 1, size: (droppedItem.size || 1) });
                                   }
                              }
                         }


                        // Adiciona XP e Score ao processo
                        const xpBase = API.utils.random(6, 25);
                        currentProcess.xpbase = (currentProcess.xpbase || 0) + xpBase;
                        currentProcess.xp = (currentProcess.xp || 0) + Math.round((xpBase * (machine.tier + 1)) / 1.35);
                        currentProcess.score = parseFloat(company.stars.gen()); // Gera novo score a cada drop?
                    }

                } // fim if(canProcess)

            } // fim for(activeProcesses)

            // Verifica se alguma ferramenta ficou sem recurso
            const tool0Broken = processData.tools[0]?.durability?.current <= 0;
            const tool1Empty = processData.tools[1]?.fuel?.current <= 0;

            // Se AMBAS as ferramentas estiverem inutilizáveis, para o processamento
            if (tool0Broken && tool1Empty) {
                 console.log(`[Company.Process] Ambas as ferramentas de ${user_id} estão sem recursos. Parando processo.`);
                 processedSomething = false; // Garante que não vai agendar próximo ciclo
                 await company.jobs.process.remove(user_id);
                 API.cacheLists.waiting.remove(user_id, 'working');
                 // Atualiza o estado final antes de sair
                 await DatabaseManager.updateOne('players_utils', { user_id: user_id }, { $set: { process: processData } });
                 return;
            }

            // Salva as alterações no documento players_utils
            await DatabaseManager.updateOne('players_utils', { user_id: user_id }, { $set: { process: processData } });

            // Se algo foi processado, agenda o próximo ciclo
            if (processedSomething) {
                // Tenta pegar a potência da ferramenta usada no primeiro processo ativo (ou uma padrão)
                const firstActiveProcess = activeProcesses[0];
                const firstTool = processData.tools[firstActiveProcess?.tool] || { potency: { current: 50 } }; // Ferramenta padrão
                const timeToNextCycle = company.jobs.process.calculateTime(firstTool.potency.current, 1);

                if (debugmode) console.log(API.utils.getFormatedDate(true) + ` Processed | ${user_id} | Next in ${API.utils.ms2(timeToNextCycle)}`);

                company.jobs.process.lastprocess.set(user_id, Date.now()); // Atualiza timestamp do último ciclo

                // Agenda o próximo ciclo
                setTimeout(() => { company.jobs.process.loopProcess(user_id); }, timeToNextCycle);

            } else {
                 // Se nada foi processado (ex: sem combustível/durabilidade), remove da lista 'working' mas mantém na 'processing'
                 console.log(`[Company.Process] Nenhum item processado para ${user_id} neste ciclo (sem recursos?).`);
                 API.cacheLists.waiting.remove(user_id, 'working');
                 // Não agenda próximo ciclo automaticamente, talvez precise de intervenção do usuário
                 // Mas mantém na lista `processing` no DB para tentar de novo no próximo `load` ou verificação periódica.
                 company.jobs.process.lastprocess.set(user_id, Date.now()); // Atualiza timestamp mesmo sem processar
                 // Remove da lista 'current' em memória para permitir que a verificação periódica tente reiniciar
                 const currentIdx = company.jobs.process.current.indexOf(user_id);
                 if (currentIdx > -1) company.jobs.process.current.splice(currentIdx, 1);
            }

            // --- Fim da lógica de processamento ---
        } catch (error) {
            console.error(`[ERRO][Company.Process] Falha no loopProcess para ${user_id}:`, error);
            if(API.client?.emit) API.client.emit('error', error);
            // Decide se remove o usuário do processamento ou tenta novamente
            await company.jobs.process.remove(user_id); // Remove para evitar loop de erro
            API.cacheLists.waiting.remove(user_id, 'working');
        }
    };


    company.jobs.process.tools.search = function(level, tooltype) { /* ... (lógica mantida, mas usa load corrigido) ... */
        if (!company.jobs.process.tools.obj || Object.keys(company.jobs.process.tools.obj).length === 0) company.jobs.process.tools.load();
        // Garante que tooltype é um índice válido (0 ou 1)
        const typeIndex = (tooltype === 0 || tooltype === 1) ? tooltype : 0;
        const toolsForType = company.jobs.process.tools.obj?.[typeIndex];
        if (!toolsForType || toolsForType.length === 0) return null; // Retorna null se não houver ferramentas

        // Filtra, ordena e pega a melhor ferramenta para o nível
        const suitableTools = toolsForType.filter(t => level >= t.level).sort((a, b) => b.level - a.level);
        return suitableTools[0] || null; // Retorna a melhor ou null se nenhuma for adequada
    };
    company.jobs.process.translatePotency = function(potency) { /* ... (lógica mantida) ... */
         if (potency < 40) return "Baixa potência";
         if (potency < 70) return "Média potência";
         if (potency < 100) return "Alta potência";
         return "Potência indefinida";
    };
    company.jobs.process.calculateTime = function(potency, qnt) { /* ... (lógica mantida) ... */
        const safePotency = Math.max(1, potency || 1); // Evita divisão por zero ou potência muito baixa
        let ms = qnt * company.jobs.process.update * 1250 * (100 / safePotency); // Invertido? Mais potência = mais rápido? Ajustar fórmula
        // Exemplo: Tempo = Base * Quantidade / Potência
        // let baseTimePerItem = company.jobs.process.update * 10000; // Ajuste
        // let ms = baseTimePerItem * qnt / safePotency;
        return Math.max(1000, Math.round(ms)); // Tempo mínimo de 1 segundo
    };
}


// --- Função Create Company ---
{
    /**
     * Cria uma nova empresa para o usuário.
     * @param {User} member - Objeto User do Discord do criador.
     * @param {object} ob - Objeto com dados da empresa { name, setor, icon, type }.
     * @returns {Promise<string|null>} O ID (código) da empresa criada ou null em caso de falha.
     */
    company.create = async function(member, ob) {
        // Função interna para gerar ID e verificar unicidade
        async function generateUniqueCode() {
            let code;
            let existing = true;
            let attempts = 0;
            const maxAttempts = 10; // Evita loop infinito

            function makeid(length) {
                // ... (função makeid mantida)
                var result = '';
                var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // Simplificado
                var charactersLength = characters.length;
                for ( var i = 0; i < length; i++ ) {
                    result += characters.charAt(Math.floor(Math.random() * charactersLength));
                }
                return result;
            }

            while (existing && attempts < maxAttempts) {
                code = makeid(6);
                const filter = { company_id: code };
                existing = await DatabaseManager.findOne('companies', filter, { projection: { _id: 1 } });
                attempts++;
            }

            if (existing) {
                // Não conseguiu gerar código único após várias tentativas
                throw new Error("Falha ao gerar código único para a empresa após várias tentativas.");
            }
            return code;
        }

        try {
            const companyCode = await generateUniqueCode();
            const townNum = await API.townExtension.getTownNum(member.id); // Requer townExtension atualizado
            const townName = API.townExtension.getTownNameByNum(townNum); // Não precisa ser async

            // Dados do novo documento da empresa
            const newCompanyData = {
                company_id: companyCode,
                user_id: member.id, // Dono
                name: ob.name,
                type: ob.type,
                loc: townNum, // Localização (número da cidade)
                score: 0,
                funcmax: 3, // Máximo de funcionários inicial
                openvacancie: true, // Aberta para vagas por padrão
                workers: [], // Array de funcionários vazio
                created_at: new Date() // Adiciona timestamp de criação
                // Adicionar outros campos padrão se necessário
            };

            // Remove qualquer empresa antiga que o usuário possa ter (se a regra for 1 por usuário)
            await DatabaseManager.deleteOne('companies', { user_id: member.id });

            // Insere a nova empresa
            const insertResult = await DatabaseManager.insertOne('companies', newCompanyData);

            if (!insertResult?.insertedId) {
                throw new Error("Falha ao inserir o documento da nova empresa no banco de dados.");
            }

            // Log de criação (opcional)
            try {
                 const embed = new API.EmbedBuilder()
                     .setTitle(`Nova empresa criada!`)
                     // Usar addFields em vez de addField obsoleto
                     .addFields({ name: 'Informações da Empresa', value: `Fundador: ${member}\nNome: **${ob.name}**\nSetor: **${ob.icon} ${ob.setor.charAt(0).toUpperCase() + ob.setor.slice(1)}**\nLocalização: **${townName}**\nCódigo: **${companyCode}**`})
                     .setColor('#42f57e');
                 const logChannel = API.client.channels.cache.get('747490313765126336'); // Use ID configurável?
                 if (logChannel) await logChannel.send({ embeds: [embed] });
            } catch (logErr) {
                 console.warn("[Company.Create] Falha ao enviar log de criação de empresa:", logErr);
            }

            return companyCode; // Retorna o código da empresa criada

        } catch (err) {
            console.error(`[ERRO][Company.Create] Falha ao criar empresa para ${member.id}:`, err);
            if(API.client?.emit) API.client.emit('error', err);

            // Enviar embed de erro para o canal de log (se aplicável)
             try{
                 const embed = new API.EmbedBuilder()
                    .setDescription(`Falha ao gerar empresa ${ob.type}:${ob.name} para ${member}`)
                    .setColor('#eb4828')
                    .setTimestamp();
                 const logChannel = API.client.channels.cache.get('747490313765126336');
                 if (logChannel) await logChannel.send({ embeds: [embed]});;
             } catch {}

            return null; // Retorna null em caso de falha
        }
    };
}


// --- Recarregar Dados dos JSONs na inicialização ---
company.jobs.explore.mobs.load();
company.jobs.explore.equips.load();
company.jobs.fish.rods.load();
company.jobs.fish.list.load();
company.jobs.process.tools.load();
company.jobs.process.load(); // Carrega lista de processamento pendente


// --- Mapeamentos (preencher com os dados originais) ---
company.e = {
    'agricultura': { tipo: 1, icon: '<:icon1:745663998854430731>', description: '...' },
    'exploração': { tipo: 2, icon: '<:icon2:745663998938316951>', description: '...' },
    'tecnologia': { tipo: 3, icon: '<:icon3:745663998871076904>', description: '...' },
    'hackeamento': { tipo: 4, icon: '<:icon4:745663998887854080>', description: '...' },
    'segurança': { tipo: 5, icon: '<:icon5:745663998900568235>', description: '...' },
    'pescaria': { tipo: 6, icon: '<:icon6:830966666082910228>', description: '...' },
    'processamento': { tipo: 7, icon: '<:icon7:851946616738152478>', description: '...' }
};
company.types = {
    1: 'agricultura', 2: 'exploração', 3: 'tecnologia', 4: 'hackeamento',
    5: 'segurança', 6: 'pescaria', 7: 'processamento'
};


module.exports = company;