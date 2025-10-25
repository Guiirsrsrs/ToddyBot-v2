// _classes/api/modules/maqExtension.js

const API = require('../index');
const DatabaseManager = API.DatabaseManager; // Usa a instância
require('colors'); // Para logs

// --- Geração de Minérios ---
const ores = {};

/**
 * Gera uma lista de minérios com base na máquina, profundidade e chips equipados.
 * @param {object} maq - Objeto da máquina (do shopExtension).
 * @param {number} profundidade - Profundidade atual da mineração.
 * @param {Array<object>} chips - Array de chips equipados.
 * @returns {Promise<Array<object>>} Array de objetos { oreobj, orechips, chipsstring }.
 */
ores.gen = async function(maq, profundidade, chips = []) { // Adiciona valor padrão para chips
    // Pega a lista mestra de minérios
    const masterOres = API.itemExtension.getObj()?.minerios || [];
    if (masterOres.length === 0) {
        console.warn("[MaqExt.Ores] Lista mestra de minérios vazia!");
        return [];
    }

    // Filtra minérios (a condição original 'if (!5)' foi removida por parecer um erro)
    // Se precisar filtrar 'nomine', adicione a lógica aqui. Ex:
    // const usableOres = filterNoMine ? masterOres.filter(ore => !ore.nomine) : masterOres;
    const usableOres = masterOres;
    const oreCountFactor = 2; // Fator original (maq.tier + oreobj2nomine onde oreobj2nomine era 2)

    // Prepara informações dos chips para fácil acesso
    const activeChipEffects = {};
    for (const chip of chips) {
        if (typeof chip === 'object' && chip.id) { // Verifica se é um objeto chip válido
            const productChip = API.shopExtension.getProduct(chip.id);
            if (productChip?.type === 5 && productChip.typeeffect) {
                const effectKey = `chipe${productChip.typeeffect}`;
                activeChipEffects[effectKey] = {
                    ...chip, // Dados do chip equipado (durabilidade, etc.)
                    icon: productChip.icon,
                    genchipid: effectKey
                };
            }
        }
    }

    // Calcula GTotal (lógica original mantida, usando API.utils.random)
    function calculateGTotal(depth, tier) {
        let gtotal = 225;
        gtotal += (depth * 2);
        // Garante que o segundo random tenha limite >= mínimo
        const randomMax = Math.max(2, Math.round((depth * 2) * 0.76));
        gtotal += API.utils.random(1, API.utils.random(2, randomMax));
        gtotal += (depth * 2) * 2;
        gtotal -= (depth * 2) / (tier + 1); // +1 pois tier é base 0
        return Math.round(gtotal);
    }
    const gTotal = calculateGTotal(profundidade, maq.tier || 0);
    const tierFactor = (maq.tier || 0) * 10;

    let generatedOres = [];
    // Itera até o limite de tier + fator (ou até acabarem os minérios usáveis)
    for (let i = 0; i < (maq.tier || 0) + oreCountFactor && i < usableOres.length; i++) {
        const oreData = usableOres[i];

        if (oreData.name.includes('fragmento')) {
            // Lógica específica para fragmentos (chip 5)
            if (activeChipEffects.chipe5) {
                const amount = API.utils.random(2, 4);
                if (amount > 0) {
                    generatedOres.push({
                        oreobj: { ...oreData, size: amount }, // Adiciona size aqui
                        orechips: { chipe5: activeChipEffects.chipe5 },
                        chipsstring: [activeChipEffects.chipe5.icon]
                    });
                }
            }
        } else {
            // Lógica de cálculo de quantidade (mantida a original, verificar se faz sentido)
            const randomFloatPart = parseFloat(`2.${API.utils.random(6, 9)}${API.utils.random(0, 9)}`);
            let t = Math.round(((oreData.por + 1) / randomFloatPart) * gTotal / 100);
            t += Math.round(((tierFactor / (i + 1)) / 2) * gTotal / 100);
            t *= 23 / 100;
            t = Math.round((oreData.name === 'pedra' ? t * ((maq.tier || 0) + 1) * 1.9 : t) / 2);
            t = Math.max(0, t); // Garante que não seja negativo

            const appliedChipsInfo = []; // Guarda infos dos chips aplicados
            const oreChipsMap = {}; // Guarda dados dos chips aplicados

            // Aplica efeitos dos chips (6, 7, 8)
            if (activeChipEffects.chipe6 && API.utils.random(0, 100) < API.utils.random(1, 10)) {
                t = Math.round(t * 2);
                appliedChipsInfo.push(activeChipEffects.chipe6.icon);
                oreChipsMap.chipe6 = activeChipEffects.chipe6;
            }
            if (activeChipEffects.chipe7 && API.utils.random(0, 100) < API.utils.random(1, 10)) {
                t = Math.round(t / 2);
                appliedChipsInfo.push(activeChipEffects.chipe7.icon);
                oreChipsMap.chipe7 = activeChipEffects.chipe7;
            }
            if (activeChipEffects.chipe8 && API.utils.random(0, 100) < API.utils.random(1, 20)) {
                if (oreData.name === 'pedra' && API.utils.random(0, 100) < API.utils.random(40, 80)) {
                    t = Math.round(t / 4);
                    appliedChipsInfo.push(activeChipEffects.chipe8.icon);
                    oreChipsMap.chipe8 = activeChipEffects.chipe8;
                } else if (oreData.name !== 'pedra' && API.utils.random(0, 100) < API.utils.random(5, 15)) {
                    t = Math.round(t / 2);
                    appliedChipsInfo.push(activeChipEffects.chipe8.icon);
                    oreChipsMap.chipe8 = activeChipEffects.chipe8;
                }
            }

            // Adiciona o minério gerado se a quantidade for maior que 0
            if (t > 0) {
                 generatedOres.push({
                     oreobj: { ...oreData, size: t }, // Adiciona size aqui
                     orechips: oreChipsMap,
                     chipsstring: appliedChipsInfo
                 });
            }
        }
    } // Fim do loop for

    return generatedOres;
};


// --- Gerenciamento do Storage ---
const storage = {
  sizeperlevel: 1000 // Mantido
};

/**
 * Calcula a capacidade máxima do storage com base no nível.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Capacidade máxima.
 */
storage.getMax = async function(user_id) {
    const doc = await DatabaseManager.findOne('storage', { user_id: user_id }, { projection: { storage: 1 } });
    const storageLevel = doc?.storage || 1; // Nível 1 como padrão se não existir
    return storageLevel * storage.sizeperlevel;
};

/**
 * Calcula o tamanho atual ocupado no storage.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Quantidade total de itens no storage.
 */
storage.getSize = async function(user_id) {
    const doc = await DatabaseManager.findOne('storage', { user_id: user_id });
    if (!doc) return 0; // Se não tem documento, tamanho é 0

    let currentSize = 0;
    // Soma os valores de todos os campos, exceto _id e user_id (e storage, se existir como campo)
    for (const key in doc) {
        if (key !== '_id' && key !== 'user_id' && key !== 'storage' && typeof doc[key] === 'number') {
            currentSize += doc[key];
        }
    }
    return currentSize;
};

/**
 * Calcula o preço para upar o storage.
 * @param {string} user_id - ID do usuário.
 * @param {number} levelsToUp - Quantos níveis deseja upar (padrão 1).
 * @param {number} currentMaxSizeOverride - Opcional: Força um tamanho máximo base para cálculo.
 * @returns {Promise<number>} Preço total para o upgrade.
 */
storage.getPrice = async function(user_id, levelsToUp = 1, currentMaxSizeOverride = null) {
    const doc = await DatabaseManager.findOne('storage', { user_id: user_id }, { projection: { storage: 1 } });
    let currentLevel = doc?.storage || 1; // Nível 1 como padrão

    let totalPrice = 0;
    const levels = Math.max(1, levelsToUp); // Garante pelo menos 1 nível

    for (let i = 0; i < levels; i++) {
        let levelForCalc = currentLevel + i;
        let baseMax = currentMaxSizeOverride !== null ? currentMaxSizeOverride : (levelForCalc * storage.sizeperlevel);
        // Lógica de preço original mantida (verificar se faz sentido)
        let priceForLevel = baseMax + (baseMax * 7.8 / 50) * 5.15;
        totalPrice += priceForLevel;
    }

    return Math.round(totalPrice);
};

/**
 * Verifica se o storage está cheio.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<boolean>} True se estiver cheio, false caso contrário.
 */
storage.isFull = async function(user_id) {
  try { // Adiciona try-catch
      const max = await storage.getMax(user_id);
      const size = await storage.getSize(user_id);
      return size >= max;
  } catch (error) {
       console.error(`[ERRO][MaqExt.Storage] Falha ao verificar se storage está cheio para ${user_id}:`, error);
       if(API.client?.emit) API.client.emit('error', error);
       return false; // Assume não cheio em caso de erro? Ou true para prevenir adição?
  }
};


// --- Objeto Principal maqExtension ---
const maqExtension = {
  ores: ores,
  storage: storage, // Aninha o objeto storage aqui
  update: 12, // Mantido
  lastcot: "", // Mantido
  proxcot: 0, // Mantido
  // Taxas de recuperação (mantidas)
  recoverenergy: { 1: 60, 2: 58, 3: 52, 4: 51, 5: 50 },
  recoverstamina: { 1: 30, 2: 29, 3: 28, 4: 28, 5: 25 } // Usado pelo playerUtils, não aqui
};

// --- Funções maqExtension ---

maqExtension.forceCot = async function() {
    // Lógica mantida, mas usa API.utils.random e API.utils.getFormatedDate
    maqExtension.lastcot = API.utils.getFormatedDate(); // Usa utils
    const masterOres = API.itemExtension.getObj()?.minerios || [];

    for (let i = 0; i < masterOres.length; i++) {
         const ore = masterOres[i];
         // Garante que a estrutura de preço exista
         ore.price = ore.price || { min: 1, max: 10, atual: 5, updates: [], ultimoupdate: "" };
         ore.price.updates = ore.price.updates || [];

        if (API.utils.random(0, 100) < 30) { // Usa utils
            const newPrice = API.utils.random(ore.price.min, ore.price.max, true).toFixed(2);
            const priceDiff = Math.abs(ore.price.atual - newPrice).toFixed(2);

            if (priceDiff > 0.001) { // Verifica diferença mínima para evitar updates insignificantes
                 const updateSign = newPrice < ore.price.atual ? "<:down:833837888546275338>" : "<:up:833837888634486794>";
                 ore.price.ultimoupdate = `${updateSign} ${priceDiff}`;
                 ore.price.updates.unshift({ price: newPrice, date: API.utils.getFormatedDate(true) }); // Usa utils
                 ore.price.updates = ore.price.updates.slice(0, 10); // Limita histórico
                 ore.price.atual = parseFloat(newPrice); // Atualiza preço atual
            } else {
                 ore.price.ultimoupdate = ""; // Nenhuma mudança significativa
            }
        } else {
            ore.price.ultimoupdate = ""; // Nenhuma mudança por chance
        }
    }
     // console.log("[MaqExt] Cotação atualizada."); // Log opcional
};


/**
 * Obtém o ID da máquina equipada pelo usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number|null>} ID da máquina ou null.
 */
maqExtension.get = async function(user_id) {
  const doc = await DatabaseManager.findOne('machines', { user_id: user_id }, { projection: { machine: 1 } });
  // Retorna o ID da máquina (pode ser 0 ou número) ou null se não houver doc
  return doc?.machine ?? null; // Usa ?? para retornar null se doc for null ou undefined
};

/**
 * Verifica se o usuário possui uma máquina (ID diferente de 0).
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<boolean>} True se possui máquina, false caso contrário.
 */
maqExtension.has = async function(user_id) {
  const machineId = await maqExtension.get(user_id);
  // Considera que tem máquina se o ID for um número e maior que 0
  return typeof machineId === 'number' && machineId > 0;
};


// --- Sistema de Energia (REFEITO) ---
// Modelo: Armazena currentEnergy e lastUsedTimestamp (ou lastRegenTimestamp)

const MAX_ENERGY_BASE = 100; // Exemplo de energia máxima base (ajuste)
const ENERGY_REGEN_INTERVAL_SECONDS = 60; // Exemplo: 1 energia a cada 60 segundos (ajuste)

/**
 * Obtém a energia atual e máxima do usuário, calculando a regeneração.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<{currentEnergy: number, maxEnergy: number, timeToFullMs: number}>} Energia atual, máxima e tempo para encher.
 */
maqExtension.getEnergy = async function(user_id) {
    const machineDoc = await DatabaseManager.findOne('machines', { user_id: user_id });
    // const playerDoc = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { perm: 1 } }); // Permissão não usada na regen aqui

    // Valores Padrão
    let currentEnergy = 0;
    let lastUpdateTimestamp = Date.now(); // Assume agora se não houver registro
    let baseMaxEnergy = MAX_ENERGY_BASE; // Padrão
    let bonusMaxEnergy = 0;

    if (machineDoc) {
        currentEnergy = machineDoc.currentEnergy ?? baseMaxEnergy; // Começa cheia se não definida
        lastUpdateTimestamp = machineDoc.lastEnergyUpdate ?? Date.now();
        baseMaxEnergy = machineDoc.energymax || MAX_ENERGY_BASE; // Usa valor do DB ou padrão

        // Calcula bônus de energia dos chips
        const equippedChips = machineDoc.slots || [];
        for (const chip of equippedChips) {
             if (typeof chip === 'object' && chip.id) {
                 const productChip = API.shopExtension.getProduct(chip.id);
                 if (productChip?.typeeffect === 1) { // Efeito 1 = Bônus Max Energy
                     bonusMaxEnergy += productChip.sizeeffect || 0;
                 }
             }
        }
    }

    const maxEnergy = baseMaxEnergy + bonusMaxEnergy;

    // Calcula regeneração
    const now = Date.now();
    const secondsPassed = Math.floor((now - lastUpdateTimestamp) / 1000);

    if (secondsPassed > 0) {
        // Obter taxa de regeneração baseada na permissão (lógica antiga)
        const playerDocPermCheck = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { perm: 1 } });
        const permLevel = playerDocPermCheck?.perm || 1; // Padrão 1
        const regenInterval = maqExtension.recoverenergy[permLevel] || ENERGY_REGEN_INTERVAL_SECONDS; // Usa tabela ou padrão

        const energyRegenerated = Math.floor(secondsPassed / regenInterval);

        if (energyRegenerated > 0) {
            currentEnergy = Math.min(maxEnergy, currentEnergy + energyRegenerated);
            // Atualiza o timestamp no DB para evitar recalcular regen já aplicada? Opcional.
            // await DatabaseManager.updateOne('machines', { user_id: user_id }, { $set: { currentEnergy: currentEnergy, lastEnergyUpdate: now } });
            // Se não atualizar aqui, a próxima chamada a `set` ou `remove` deve atualizar.
        }
    }

    // Calcula tempo para ficar cheia
    const energyNeeded = maxEnergy - currentEnergy;
    const playerDocPermCheck = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { perm: 1 } });
    const permLevel = playerDocPermCheck?.perm || 1; // Padrão 1
    const regenInterval = maqExtension.recoverenergy[permLevel] || ENERGY_REGEN_INTERVAL_SECONDS; // Usa tabela ou padrão
    const secondsToFull = energyNeeded > 0 ? energyNeeded * regenInterval : 0;
    const timeToFullMs = Math.max(0, Math.round(secondsToFull * 1000 - (now - lastUpdateTimestamp) % (regenInterval * 1000) )); // Ajusta pelo tempo já passado no ciclo atual


    return {
        currentEnergy: Math.round(currentEnergy), // Arredonda para evitar decimais
        maxEnergy: maxEnergy,
        timeToFullMs: timeToFullMs
    };
};


/**
 * Define a energia atual do usuário e atualiza o timestamp.
 * @param {string} user_id - ID do usuário.
 * @param {number} value - Valor para definir a energia (será limitado pela max).
 */
maqExtension.setEnergy = async function(user_id, value) {
    const { maxEnergy } = await maqExtension.getEnergy(user_id); // Pega max atual
    const energyValue = Math.max(0, Math.min(maxEnergy, Number(value) || 0)); // Limita entre 0 e max

    const filter = { user_id: user_id };
    const update = { $set: { currentEnergy: energyValue, lastEnergyUpdate: Date.now() } };
    await DatabaseManager.updateOne('machines', filter, update, { upsert: true }); // Upsert para criar se não existir
};

/**
 * Remove energia do usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} value - Quantidade a remover (positiva).
 */
maqExtension.removeEnergy = async function(user_id, value) {
    const amountToRemove = Math.max(0, Number(value) || 0); // Garante positivo
    if (amountToRemove === 0) return;

    const { currentEnergy } = await maqExtension.getEnergy(user_id); // Pega energia atualizada
    const newEnergy = Math.max(0, currentEnergy - amountToRemove); // Calcula nova energia

    const filter = { user_id: user_id };
    const update = { $set: { currentEnergy: newEnergy, lastEnergyUpdate: Date.now() } };
    await DatabaseManager.updateOne('machines', filter, update, { upsert: true }); // Salva e atualiza timestamp
};

/**
 * Define a energia MÁXIMA BASE do usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} value - Valor da energia máxima base.
 */
maqExtension.setEnergyMax = async function(user_id, value) {
  const maxValue = Math.max(1, Number(value) || MAX_ENERGY_BASE); // Mínimo 1
  await DatabaseManager.set(user_id, 'machines', 'energymax', maxValue, 'user_id'); // Usa o set genérico
};

// --- Funções Adicionais ---

/**
 * Calcula o número máximo de slots de chip com base no nível e status MVP.
 * @param {number} level - Nível do usuário.
 * @param {boolean} hasMvp - Se o usuário tem MVP.
 * @returns {number} Número máximo de slots.
 */
maqExtension.getSlotMax = function(level, hasMvp) {
    const baseSlots = Math.floor((level || 0) / 6); // Slots ganhos a cada 6 níveis
    let maxSlots = Math.min(5, baseSlots); // Limite de 5 slots

    if (!hasMvp && maxSlots > 4) { // Limite de 4 sem MVP
        maxSlots = 4;
    }
    return Math.max(0, maxSlots); // Garante que não seja negativo
};


/**
 * Calcula a profundidade máxima de mineração.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Profundidade máxima.
 */
maqExtension.getDepth = async function(user_id) {
    const machineDoc = await DatabaseManager.findOne('machines', { user_id: user_id }, { projection: { machine: 1, slots: 1 } });
    const machineId = machineDoc?.machine || 0;
    const equippedChips = machineDoc?.slots || [];

    const machineData = API.shopExtension.getProduct(machineId) || { profundidade: 0 }; // Profundidade base 0 se não tiver máquina
    let bonusDepth = 0;

    for (const chip of equippedChips){
        if (typeof chip === 'object' && chip.id) {
            const productChip = API.shopExtension.getProduct(chip.id);
            if (productChip?.typeeffect === 2) { // Efeito 2 = Profundidade
                bonusDepth += productChip.sizeeffect || 0;
            }
        }
    }
    return (machineData.profundidade || 0) + bonusDepth; // Soma base + bônus
};

/**
 * Obtém o estado de manutenção da máquina do usuário.
 * @param {string} user_id - ID do usuário.
 * @param {boolean} getDefault - (Não usado na versão MongoDB, mas mantido para compatibilidade de chamada).
 * @returns {Promise<object|null>} Objeto com dados de manutenção ou null.
 */
maqExtension.getMaintenance = async function(user_id, getDefault = false) { // getDefault não é mais necessário
    const machineDoc = await DatabaseManager.findOne('machines', { user_id: user_id });
    if (!machineDoc || !machineDoc.machine) return null; // Retorna null se não houver máquina

    const machineProduct = API.shopExtension.getProduct(machineDoc.machine);
    if (!machineProduct) return null; // Retorna null se dados do produto não encontrados

    // Função interna para calcular estado e preço de um componente
    function calculateMaintenance(componentName, priceMultiplier, maxFromProduct, currentFromDoc, invertPercent = false) {
        const maxValue = maxFromProduct || 0;
        // Usa valor do DB ou o máximo como padrão (ou 0 para poluentes)
        let currentValue = currentFromDoc ?? (componentName === 'pollutants' ? 0 : maxValue);
        // Garante que o valor atual esteja dentro dos limites [0, maxValue]
        currentValue = Math.max(0, Math.min(maxValue, currentValue));

        const percent = maxValue > 0 ? parseFloat(((currentValue / maxValue) * 100).toFixed(2)) : 0;
        // Percentual usado para cálculo de preço (pode ser invertido)
        const pricePercentBase = invertPercent ? (100 - percent) : percent;
        // Ajuste específico para pressão baixa
        const effectivePricePercent = (componentName === 'pressure' && percent < 20) ? (100 - percent) : pricePercentBase;

        // Calcula o preço para "consertar" (ir de `effectivePricePercent` para 0% ou 100% dependendo do `invert`)
        // A fórmula original parecia calcular o custo para consertar a parte "faltante" ou "excedente"
        const price = Math.round(((effectivePricePercent / 100 * maxValue) * priceMultiplier) * (machineProduct.tier + 1));

        return [currentValue, maxValue, percent, price];
    }

    const durability = calculateMaintenance("durability", 0.45, machineProduct.durability, machineDoc.durability, false);
    const pressure = calculateMaintenance("pressure", 0.00245, machineProduct.pressure, machineDoc.pressure, false);
    const pollutants = calculateMaintenance("pollutants", 0.00545, machineProduct.pollutants, machineDoc.pollutants, false); // Não inverte, preço baseado no quanto TEM
    const refrigeration = calculateMaintenance("refrigeration", 0.00445, machineProduct.refrigeration, machineDoc.refrigeration, true); // Inverte, preço baseado no quanto FALTA

    return { durability, pressure, pollutants, refrigeration };
};

module.exports = maqExtension;