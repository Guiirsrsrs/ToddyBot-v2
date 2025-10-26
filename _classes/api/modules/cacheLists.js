// _classes/api/modules/cacheLists.js

const API = require("../index"); // API centralizada
const DatabaseManager = API.DatabaseManager; // Instância do DBManager
require('colors'); // Para logs

// --- Objeto Waiting (Em memória, sem alterações no DB) ---
const waiting = {};
const waitingmap = new Map();
{
    waiting.get = function(list) {
        if (!waitingmap.has(list)) {
            waitingmap.set(list, {
                current: [],
                links: new Map() // Map para armazenar { user_id: interaction.url }
            });
        }
        return waitingmap.get(list);
    };

    waiting.length = function(list) {
        const map = waiting.get(list);
        return map.current.length;
    };

    // Atualiza o Map interno, não o DB
    waiting.update = function(list, value) {
        // Garante que a lista existe no map antes de setar
        waiting.get(list);
        waitingmap.set(list, value);
        // API.updateBotInfo(); // Descomentar se necessário
    };

    waiting.includes = function(user_id, list) {
        const map = waiting.get(list);
        return map.current.includes(user_id);
    };

    waiting.getLink = function(user_id, list) {
        const map = waiting.get(list);
        // Retorna a URL armazenada ou undefined
        return map.links.get(user_id);
    };

    waiting.remove = function(user_id, list) {
        const map = waiting.get(list);
        const index = map.current.indexOf(user_id);
        if (index > -1) {
            map.current.splice(index, 1);
            map.links.delete(user_id); // Remove a URL associada
        }
        // Não chama update pois modifica o map diretamente
        // waiting.update(list, map); // Desnecessário se a referência é a mesma
    };

    waiting.add = function(user_id, interaction, list) {
        const map = waiting.get(list);
        if (!map.current.includes(user_id)) {
            map.current.push(user_id);
            // Armazena a URL da interação (se disponível)
            if (interaction && interaction.url) {
                 map.links.set(user_id, interaction.url);
            }
        }
        // Não chama update
        // waiting.update(list, map); // Desnecessário
    };
}


// --- Objeto Remember (Interage com DB) ---
const remember = {};
// Mapa em memória para gerenciar timers e estado atual
const remembermap = new Map(); // { user_id: { memberid, energia: { channelid, active }, estamina: { channelid, active } } }
{
    remember.get = function() { return remembermap; };

    /**
     * Função recursiva com setTimeout para verificar energia/estamina e notificar.
     * Chamada por remember.load().
     */
    remember.loadold = async function(type, user_id, channel) {
        let currentValue;
        let maxValue;
        let timeToFullMs = 0; // Tempo em ms até ficar cheio

        try {
            switch (type) {
                case "energia":
                    // Usa a função getEnergy atualizada
                    const energyInfo = await API.maqExtension.getEnergy(user_id);
                    currentValue = energyInfo.currentEnergy;
                    maxValue = energyInfo.maxEnergy;
                    timeToFullMs = energyInfo.timeToFullMs;
                    break;
                case "estamina":
                    // Usa as funções de stamina atualizadas
                    currentValue = await API.playerUtils.stamina.get(user_id);
                    maxValue = 1000; // Máximo de stamina (ajuste se necessário)
                    timeToFullMs = await API.playerUtils.stamina.time(user_id);
                    break;
                default:
                    console.warn(`[Remember] Tipo desconhecido em loadold: ${type}`);
                    return; // Sai se o tipo for inválido
            }

            // Garante que os valores são numéricos
            currentValue = Number(currentValue) || 0;
            maxValue = Number(maxValue) || 0;
            timeToFullMs = Number(timeToFullMs) || 0;


            // Se já está cheio ou mais
            if (currentValue >= maxValue) {
                 // Verifica se ainda está ativo no map em memória antes de remover e notificar
                if (remember.includes(user_id, type)) {
                    console.log(`[Remember] ${type} cheio para ${user_id}. Notificando canal ${channel.id}.`.cyan);
                    // Tenta enviar a mensagem
                    try {
                        await channel.send({ content: `🔁 | <@${user_id}> Sua **${type}** está cheia! (${currentValue}/${maxValue})` });
                    } catch (sendError) {
                         console.error(`[ERRO][Remember] Falha ao enviar notificação de ${type} para canal ${channel.id}:`, sendError);
                         // Considerar remover o lembrete mesmo se falhar ao notificar?
                    }
                    // Remove o lembrete do map e salva no DB
                    remember.remove(user_id, type);
                }
                return; // Para a recursão para este tipo/usuário
            } else {
                // Se não está cheio, agenda a próxima verificação
                // Adiciona um pequeno buffer (ex: 1 segundo) ao tempo
                const nextCheckDelay = Math.max(1000, timeToFullMs + 1000); // Mínimo 1s de delay
                 if (remember.includes(user_id, type)) { // Verifica novamente se ainda deve lembrar antes de agendar
                    // console.log(`[Remember] Agendando próxima verificação de ${type} para ${user_id} em ${API.utils.ms2(nextCheckDelay)}`);
                    setTimeout(() => {
                         // Verifica mais uma vez antes de executar, caso tenha sido removido enquanto esperava
                         if (remember.includes(user_id, type)) {
                              remember.loadold(type, user_id, channel);
                         } else {
                              console.log(`[Remember] Lembrete de ${type} para ${user_id} removido durante timeout. Cancelando verificação.`);
                         }
                    }, nextCheckDelay);
                 } else {
                      console.log(`[Remember] Lembrete de ${type} para ${user_id} removido antes de agendar próximo check.`);
                 }
            }

        } catch (error) {
            console.error(`[ERRO][Remember] Falha em loadold (${type}, ${user_id}):`, error);
            // Remove o lembrete se ocorrer um erro grave para evitar loops
             if (remember.includes(user_id, type)) {
                remember.remove(user_id, type);
             }
             if(API.client?.emit) API.client.emit('error', error);
        }
    };


    /**
     * Carrega os lembretes do banco de dados para a memória e inicia os timers.
     */
    remember.load = async function() {
        console.log("[Remember] Carregando lembretes do banco de dados...".yellow);
        try {
            // Busca o documento globals pelo ID do bot
            const filter = { _id: API.id }; // Assumindo que API.id é o ID correto do bot no DB
            const options = { projection: { remember: 1 } }; // Pega apenas o campo remember
            const globalDoc = await API.client.db.findOne('globals', filter, options);

            const remindersFromDb = globalDoc?.remember; // Deve ser um array de objetos

            if (!remindersFromDb || !Array.isArray(remindersFromDb)) {
                console.log("[Remember] Nenhum lembrete encontrado no banco de dados ou formato inválido.");
                return;
            }

            // Limpa o mapa em memória antes de carregar
            remembermap.clear();

            // Carrega os lembretes do DB para o mapa em memória
            for (const reminderData of remindersFromDb) {
                if (reminderData && reminderData.memberid) {
                    remembermap.set(reminderData.memberid, reminderData);
                }
            }
            console.log(`[Remember] ${remembermap.size} lembretes carregados do DB para a memória.`);

            // Inicia os timers para os lembretes ativos
            let activeTimers = 0;
            for (const reminder of remembermap.values()) {
                 const userId = reminder.memberid;
                 // Inicia timer para Energia
                 if (reminder.energia?.active && reminder.energia.channelid) {
                     try {
                         // Tenta buscar o canal. Se falhar, desativa o lembrete.
                         const channel = await API.client.channels.fetch(reminder.energia.channelid).catch(() => null);
                         if (channel) {
                             activeTimers++;
                             remember.loadold("energia", userId, channel); // Inicia a verificação
                         } else {
                              console.warn(`[Remember] Canal ${reminder.energia.channelid} (Energia) não encontrado para ${userId}. Desativando lembrete.`);
                              reminder.energia.active = false; // Desativa se o canal não for encontrado
                         }
                     } catch (fetchError) {
                          console.error(`[ERRO][Remember] Falha ao buscar canal ${reminder.energia.channelid} (Energia) para ${userId}:`, fetchError);
                          reminder.energia.active = false;
                     }
                 }
                 // Inicia timer para Stamina
                 if (reminder.estamina?.active && reminder.estamina.channelid) {
                      try {
                         const channel = await API.client.channels.fetch(reminder.estamina.channelid).catch(() => null);
                         if (channel) {
                             activeTimers++;
                             remember.loadold("estamina", userId, channel); // Inicia a verificação
                         } else {
                              console.warn(`[Remember] Canal ${reminder.estamina.channelid} (Estamina) não encontrado para ${userId}. Desativando lembrete.`);
                              reminder.estamina.active = false;
                         }
                     } catch (fetchError) {
                          console.error(`[ERRO][Remember] Falha ao buscar canal ${reminder.estamina.channelid} (Estamina) para ${userId}:`, fetchError);
                          reminder.estamina.active = false;
                     }
                 }

                 // Se ambos foram desativados (ex: canais não encontrados), remove do mapa
                 if (!reminder.energia?.active && !reminder.estamina?.active) {
                      remembermap.delete(userId);
                 }
            }

            console.log(`[Remember] ${activeTimers} timers de lembrete iniciados.`);
            // Salva o estado atual (com lembretes desativados se canais não foram encontrados)
            await remember.save();

        } catch (error) {
             console.error('[ERRO][Remember] Falha fatal ao carregar lembretes:', error);
             if(API.client?.emit) API.client.emit('error', error);
        }
    };


    /**
     * Salva o estado atual do `remembermap` (em memória) no banco de dados.
     */
    remember.save = async function() {
        try {
            // Converte os valores do Map (objetos de lembrete) em um array
            const remindersArray = Array.from(remembermap.values());
            const filter = { _id: API.id }; // Filtro pelo ID do bot
            const update = { $set: { remember: remindersArray } }; // Define o campo 'remember' com o array
            await API.client.db.updateOne('globals', filter, update, { upsert: true }); // Cria o doc globals se não existir
            // console.log(`[Remember] ${remindersArray.length} lembretes salvos no banco de dados.`); // Log opcional
        } catch (error) {
             console.error('[ERRO][Remember] Falha ao salvar lembretes no banco de dados:', error);
             if(API.client?.emit) API.client.emit('error', error);
        }
    };

    /**
     * Verifica se um lembrete específico está ativo para um usuário (no mapa em memória).
     * @param {string} user_id - ID do usuário.
     * @param {string} type - Tipo de lembrete ('energia' ou 'estamina').
     * @returns {boolean}
     */
    remember.includes = function(user_id, type) {
        const reminderData = remembermap.get(user_id);
        return !!(reminderData && reminderData[type]?.active); // Verifica se existe e está ativo
    };

    /**
     * Adiciona ou ativa um lembrete para um usuário.
     * @param {string} user_id - ID do usuário.
     * @param {string} channelid - ID do canal para notificação.
     * @param {string} type - Tipo de lembrete ('energia' ou 'estamina').
     */
    remember.add = async function(user_id, channelid, type) { // Tornada async para usar loadold
        // Obtém ou cria o objeto de lembrete no mapa
        let userData = remembermap.get(user_id);
        if (!userData) {
            userData = { memberid: user_id };
            remembermap.set(user_id, userData);
        }

        // Define ou atualiza os dados para o tipo específico
        userData[type] = {
            channelid: channelid,
            active: true // Sempre ativa ao adicionar
        };

        console.log(`[Remember] Lembrete de ${type} adicionado/ativado para ${user_id} no canal ${channelid}.`);

        // Salva o estado atualizado no DB
        await remember.save();

        // Tenta buscar o canal e iniciar o timer imediatamente
        try {
            const channel = await API.client.channels.fetch(channelid).catch(() => null);
            if (channel) {
                console.log(`[Remember] Iniciando timer para o lembrete recém-adicionado (${type}, ${user_id}).`);
                remember.loadold(type, user_id, channel); // Inicia a verificação/timer
            } else {
                 console.warn(`[Remember] Canal ${channelid} não encontrado ao adicionar lembrete (${type}, ${user_id}). O lembrete está salvo, mas o timer não iniciará até o próximo load.`);
                 // Desativar aqui ou deixar para o próximo load tratar? Deixar salvo por enquanto.
                 // userData[type].active = false;
                 // await remember.save();
            }
        } catch (fetchError) {
             console.error(`[ERRO][Remember] Falha ao buscar canal ${channelid} ao adicionar lembrete (${type}, ${user_id}):`, fetchError);
             // userData[type].active = false; // Desativa em caso de erro
             // await remember.save();
        }
    };


    /**
     * Remove ou desativa um lembrete para um usuário.
     * @param {string} user_id - ID do usuário.
     * @param {string} type - Tipo de lembrete ('energia' ou 'estamina').
     */
    remember.remove = async function(user_id, type) { // Tornada async para save()
        const userData = remembermap.get(user_id);

        // Se o usuário existe no mapa e o tipo específico está ativo
        if (userData && userData[type]?.active) {
            console.log(`[Remember] Desativando lembrete de ${type} para ${user_id}.`);
            userData[type].active = false; // Apenas desativa

            // Se o usuário não tem mais nenhum lembrete ativo, remove-o completamente do mapa
            if (!userData.energia?.active && !userData.estamina?.active) {
                console.log(`[Remember] Removendo ${user_id} do mapa pois não há lembretes ativos.`);
                remembermap.delete(user_id);
            }

            // Salva o estado atualizado no DB
            await remember.save();
        } else {
             console.log(`[Remember] Lembrete de ${type} já estava inativo ou não existia para ${user_id}.`);
        }
    };

} // Fim do bloco remember


// Exporta os objetos principais
module.exports = {
    waiting,
    remember,
    // Os arrays rememberenergy e rememberstamina parecem não ser mais usados com a lógica do remembermap
    // rememberenergy: [], // Remover se não usado
    // rememberstamina: [] // Remover se não usado
};