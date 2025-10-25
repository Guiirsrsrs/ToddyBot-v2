// _classes/api/modules/crateExtension.js

const API = require('../index'); // API centralizada
const DatabaseManager = API.DatabaseManager; // Instância
const fs = require('fs');
const path = require('path');
require('colors');

const crateExtension = {
    obj: {} // Armazena definições das caixas (do crates.json)
};

// Função shuffle (mantida)
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

/**
 * Carrega as definições de caixas do arquivo JSON.
 */
crateExtension.load = async function() { // Tornada async para consistência, embora não precise
    // Corrigir caminho relativo
    const jsonPath = path.join(__dirname, '..', '..', '..', '_json/crates.json'); // ../../../_json/
    try {
        console.log(`[CrateExt] Carregando definições de caixas de: ${jsonPath}`);
        const jsonString = fs.readFileSync(jsonPath, 'utf8');
        crateExtension.obj = JSON.parse(jsonString);
        console.log(`[CrateExt] ${Object.keys(crateExtension.obj).length} tipos de caixa carregados.`);
    } catch (err) {
        console.error(`[ERRO][CrateExt] Falha ao carregar ou parsear ${jsonPath}:`, err);
        crateExtension.obj = {}; // Define como vazio em caso de erro
        if(API.client?.emit) API.client.emit('error', err);
        // Considerar se deve parar o bot se as caixas não puderem ser carregadas
        // process.exit(1);
        return; // Retorna para indicar falha no carregamento
    }

    // REMOVIDO: Loop ALTER TABLE - não necessário para MongoDB

    // Função makeid e bloco chkda (mantidos como estavam, mas podem ser removidos se não usados)
    function makeid(length) {
        var result = '';
        var characters = 'ABCDEFGHI8917423*/ 71-+JK848*/132-*LMNOPQRSTUVWXYZ01234567890123458*-*074 -/*1274-/*67890123456789-=S D-S[=324-*/-*-+48/-+65-*4/-+012345678901234567890123456789';
        var charactersLength = characters.length;
        for ( var i = 0; i < length; i++ ) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }
    /*
     const chkda = require('../../config') // Corrigir caminho se reativado
     if (chkda.dbl.voteLogs_channel != "777972678069714956" || !chkda.owner.includes('422002630106152970') || !(["763815343507505183", "726943606761324645"].includes(API.client?.user?.id))) {
         console.log(makeid(API.utils.random(200, 2500))) // Usa API.utils.random
         // return process.exit() // Cuidado ao usar process.exit aqui
     }
    */
};

/**
 * Obtém as caixas que um utilizador possui.
 * @param {string} user_id - ID do utilizador.
 * @returns {Promise<Array<object>>} Array de objetos { id, name, quantity } das caixas possuídas.
 */
crateExtension.getCrates = async function(user_id) {
    let ownedCrates = [];
    try {
        const filter = { user_id: user_id };
        // Busca o documento storage inteiro, pois as chaves são dinâmicas (crate:*)
        const storageDoc = await DatabaseManager.findOne('storage', filter);

        if (storageDoc) {
            // Itera sobre as definições de caixas carregadas
            for (const crateId in crateExtension.obj) {
                const crateKey = `crate:${crateId}`; // Chave no documento MongoDB
                const quantity = storageDoc[crateKey]; // Quantidade no storage

                if (quantity > 0) {
                     const crateData = crateExtension.obj[crateId]; // Pega dados da definição
                     ownedCrates.push({
                         id: crateId,
                         name: crateData?.name || `Caixa ${crateId}`, // Nome da definição ou padrão
                         icon: crateData?.icon || '📦', // Ícone ou padrão
                         quantity: quantity
                     });
                }
            }
        }
    } catch (err) {
        console.error(`[ERRO][CrateExt] Falha ao obter caixas para ${user_id}:`, err);
        if(API.client?.emit) API.client.emit('error', err);
    }
    return ownedCrates; // Retorna array (pode ser vazio)
};

/**
 * Determina a(s) recompensa(s) ao abrir uma caixa.
 * @param {string|number} crateId - ID da caixa a ser aberta.
 * @param {number} size - Quantidade de recompensas a gerar (padrão 1).
 * @returns {Array<object>} Array com os objetos de recompensa.
 */
crateExtension.getReward = function(crateId, size = 1) { // Adiciona valor padrão para size
    crateExtension.load(); // Garante que as definições estão carregadas
    let rewards = [];
    const idStr = String(crateId);
    const crateData = crateExtension.obj[idStr];

    if (!crateData) {
        console.warn(`[CrateExt.getReward] Definição não encontrada para caixa ID: ${idStr}`);
        return []; // Retorna array vazio se a caixa não existe
    }

    const numberOfRewards = Math.max(1, size); // Garante pelo menos uma recompensa

    for (let i = 0; i < numberOfRewards; i++) {
        let reward = null;
        const rewardsDefinition = crateData.rewards;

        // Verifica se a recompensa é uma string (drop aleatório) ou um array (lista definida)
        if (typeof rewardsDefinition === 'string' && rewardsDefinition.toLowerCase() === 'random_drop') {
            const allDrops = API.itemExtension.getObj()?.drops || [];
            if (allDrops.length > 0) {
                // Seleciona um drop aleatório da lista mestra
                const shuffledDrops = shuffle([...allDrops]); // Copia e embaralha
                const randomDrop = shuffledDrops[API.utils.random(0, shuffledDrops.length - 1)]; // Usa API.utils.random
                if (randomDrop) {
                     // Ajusta o formato da recompensa (ex: adiciona tipo, garante size)
                     reward = { ...randomDrop, type: 5, size: randomDrop.size || 1 }; // Assume type 5 para drops
                }
            } else {
                 console.warn(`[CrateExt.getReward] 'random_drop' especificado, mas lista de drops vazia.`);
            }
        } else if (Array.isArray(rewardsDefinition)) {
            // Lógica de seleção baseada em chance (mantida)
            const chanceRoll = API.utils.random(1, 100); // Rola de 1 a 100
            let cumulativeChance = 0;
            // Ordena por chance para garantir consistência se houver sobreposição (opcional)
            const sortedRewards = [...rewardsDefinition].sort((a, b) => (a.chance || 0) - (b.chance || 0));

            for (const potentialReward of sortedRewards) {
                cumulativeChance += potentialReward.chance || 0;
                if (chanceRoll <= cumulativeChance) {
                    reward = { ...potentialReward }; // Seleciona a recompensa
                    // Garante que a recompensa tenha 'size' se não for definido
                    if (reward.size === undefined) reward.size = 1;
                    break; // Sai do loop após encontrar a recompensa
                }
            }
             if (!reward) {
                  console.warn(`[CrateExt.getReward] Não foi possível selecionar recompensa baseada em chance para caixa ${idStr}. Verifique as chances.`);
                  // Selecionar o último item como fallback? Ou nenhum?
                  // reward = { ...sortedRewards[sortedRewards.length - 1], size: 1 };
             }
        } else {
             console.warn(`[CrateExt.getReward] Formato de 'rewards' inválido para caixa ID: ${idStr}`);
        }

        // Adiciona a recompensa encontrada (ou null) ao array
        if (reward) {
             rewards.push(reward);
        }
    } // Fim do loop for (size)

    return rewards; // Retorna o array de recompensas
};


/**
 * Adiciona caixas ao inventário de um utilizador.
 * @param {string} user_id - ID do utilizador.
 * @param {string|number} crateId - ID da caixa a dar.
 * @param {number} quantity - Quantidade de caixas a dar.
 * @returns {Promise<boolean>} True se a operação foi tentada, false se dados inválidos.
 */
crateExtension.give = async function(user_id, crateId, quantity) {
    const idStr = String(crateId);
    const amount = Math.max(0, Number(quantity) || 0); // Garante >= 0 e número

    if (!crateExtension.obj[idStr] || amount <= 0) { // Verifica se a caixa existe nas definições e quantidade é válida
        console.warn(`[CrateExt.give] Tentativa de dar caixa inválida (ID: ${idStr}) ou quantidade zero para ${user_id}.`);
        return false;
    }

    const crateKey = `crate:${idStr}`; // Chave no documento MongoDB
    const filter = { user_id: user_id };
    const update = { $inc: { [crateKey]: amount } }; // Usa $inc para adicionar

    try {
        await DatabaseManager.updateOne('storage', filter, update, { upsert: true }); // Upsert cria o doc storage se não existir
        // console.log(`[CrateExt.give] ${amount}x caixa(s) ${idStr} adicionada(s) para ${user_id}.`); // Log opcional
        return true;
    } catch (err) {
        console.error(`[ERRO][CrateExt] Falha ao dar caixa ${idStr} para ${user_id}:`, err);
        if(API.client?.emit) API.client.emit('error', err);
        return false;
    }
};

// Carrega as definições na inicialização do módulo
crateExtension.load();

module.exports = crateExtension;