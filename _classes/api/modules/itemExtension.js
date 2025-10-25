// _classes/api/modules/itemExtension.js

const API = require('../index');
const DatabaseManager = API.DatabaseManager; // Usa a instância
const path = require('path');
require('colors');

const itemExtension = {
  // obj será preenchido por shopExtension.loadItens() -> API.itemExtension.obj = ...
  obj: {}
};

// --- Funções Auxiliares ---

// Normaliza o nome do item para ser usado como chave no MongoDB
// Remove caracteres problemáticos (., $) e espaços (opcional)
function normalizeItemNameForKey(name) {
    if (typeof name !== 'string') return null;
    // Remove " e espaços, substitui . por _ (pontos não são permitidos no início das chaves)
    // Cuidado se itens diferentes puderem resultar na mesma chave normalizada!
    return name.replace(/"/g, '').replace(/\./g, '_').replace(/ /g, '_').toLowerCase();
    // Alternativa mais segura: Usar um subdocumento/array `items: [{ name: "Nome Original", quantity: 5 }, ...]`
    // Mas para manter a estrutura similar à SQL, vamos usar chaves dinâmicas por enquanto.
}


// --- Funções Principais ---

itemExtension.getObj = function() {
  // Retorna o objeto carregado externamente (geralmente por shopExtension)
  return itemExtension.obj;
};

// Verifica se um item com nome/displayname existe na lista mestra
itemExtension.exists = function(itemName) {
    const masterList = itemExtension.getObj();
    if (!masterList || typeof masterList !== 'object') return false;

    const normalizedItemName = String(itemName).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    // Itera sobre as categorias de itens (minerios, drops, etc.)
    for (const category in masterList) {
        if (Array.isArray(masterList[category])) {
            for (const item of masterList[category]) {
                const normName = item.name?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                const normDisplayName = item.displayname?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

                if (normName === normalizedItemName || (normDisplayName && normDisplayName === normalizedItemName)) {
                    return true; // Encontrado
                }
            }
        }
    }
    return false; // Não encontrado
};

/**
 * Adiciona itens ao inventário do jogador, respeitando limites da mochila.
 * @param {Interaction} interaction - Objeto da interação (usado para user_id).
 * @param {Array<object>} itemsToGive - Array de objetos item { name, size, ... }.
 * @returns {Promise<{descartados: Array, colocados: Array}>} Itens que foram descartados e colocados.
 */
itemExtension.give = async function(interaction, itemsToGive) {
    const user_id = interaction.user.id;
    let descartados = [];
    let colocados = [];
    const updates = {}; // Operações de atualização para o MongoDB ($inc ou $set)

    try {
        // 1. Obter dados da mochila e inventário atual
        const utilsDoc = await DatabaseManager.findOne('players_utils', { user_id: user_id }, { projection: { backpack: 1 } });
        const storageDoc = await DatabaseManager.findOne('storage', { user_id: user_id }) || { user_id: user_id }; // Documento padrão se não existir

        const backpackId = utilsDoc?.backpack || 0; // ID da mochila ou padrão
        const backpack = API.shopExtension.getProduct(backpackId) || { customitem: { itensmax: 100, typesmax: 10 } }; // Mochila padrão

        const maxStack = backpack.customitem.itensmax || 100;
        const maxTypes = backpack.customitem.typesmax || 10;

        // Calcula quantos tipos de item o usuário já tem (excluindo user_id)
        const currentTypes = Object.keys(storageDoc).filter(key => key !== 'user_id' && key !== '_id' && storageDoc[key] > 0).length;
        let potentialNewTypes = 0; // Contador para novos tipos nesta leva

        // 2. Iterar pelos itens a serem dados
        for (const item of itemsToGive) {
            const itemKey = normalizeItemNameForKey(item.name);
            if (!itemKey) {
                console.warn(`[ItemExt.give] Nome de item inválido encontrado: ${item.name}. Descartando.`);
                descartados.push({ ...item, reason: "Nome inválido" });
                continue;
            }

            const amountToAdd = Math.max(1, parseInt(item.size) || 1); // Quantidade a adicionar
            const currentAmount = storageDoc[itemKey] || 0; // Quantidade atual no inventário
            let spaceAvailable = maxStack - currentAmount; // Espaço na pilha
            let isNewType = currentAmount <= 0; // É um tipo novo se não tiver nada dele?

             // Verifica limite de tipos
             if (isNewType && (currentTypes + potentialNewTypes >= maxTypes)) {
                  console.log(`[ItemExt.give] Limite de tipos (${maxTypes}) atingido para ${user_id}. Descartando ${item.name}.`);
                  descartados.push({ ...item, reason: `Limite de ${maxTypes} tipos atingido` });
                  continue; // Pula para o próximo item
             }

            // Verifica limite de pilha
            if (spaceAvailable <= 0) {
                 console.log(`[ItemExt.give] Pilha cheia (${maxStack}) para ${item.name} no inventário de ${user_id}. Descartando.`);
                 descartados.push({ ...item, reason: `Pilha de ${maxStack} cheia` });
                 continue; // Pula para o próximo item
            }

            // Calcula quanto realmente pode ser adicionado
            const amountThatFits = Math.min(amountToAdd, spaceAvailable);

            // Adiciona a operação de atualização
            if (!updates.$inc) updates.$inc = {};
            updates.$inc[itemKey] = amountThatFits; // Usa $inc para adicionar

             // Marca como colocado (mesmo que parcialmente)
             colocados.push({ ...item, added: amountThatFits });

             // Se era um tipo novo, incrementa o contador
             if (isNewType) {
                 potentialNewTypes++;
             }

            // Se não coube tudo, adiciona o restante aos descartados
            if (amountThatFits < amountToAdd) {
                const discardedAmount = amountToAdd - amountThatFits;
                console.log(`[ItemExt.give] Pilha cheia (${maxStack}) para ${item.name}. Descartando ${discardedAmount}.`);
                descartados.push({ ...item, size: discardedAmount, reason: `Pilha de ${maxStack} cheia` });
            }
        } // Fim do loop for

        // 3. Executar a atualização no banco de dados (se houver algo para atualizar)
        if (Object.keys(updates).length > 0 && (updates.$inc && Object.keys(updates.$inc).length > 0)) {
             await DatabaseManager.updateOne('storage', { user_id: user_id }, updates, { upsert: true });
        } else {
             console.log(`[ItemExt.give] Nenhuma atualização necessária no DB para ${user_id}.`);
        }

    } catch (err) {
        console.error(`[ERRO][ItemExt.give] Falha ao dar itens para ${user_id}:`, err);
        if(API.client?.emit) API.client.emit('error', err);
        // Em caso de erro, assume que tudo foi descartado? Ou lança o erro?
        descartados = itemsToGive.map(item => ({ ...item, reason: "Erro interno" })); // Marca tudo como descartado
        colocados = []; // Zera os colocados
    }

    return { descartados, colocados };
};


/**
 * Obtém a definição de um item pelo nome ou displayname.
 * @param {string} itemName - Nome ou displayname do item.
 * @returns {object|undefined} Objeto de definição do item ou undefined.
 */
itemExtension.get = function(itemName) {
    const masterList = itemExtension.getObj();
    if (!masterList || typeof masterList !== 'object') return undefined;

    const normalizedItemName = String(itemName).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    for (const category in masterList) {
        if (Array.isArray(masterList[category])) {
            for (const item of masterList[category]) {
                const normName = item.name?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                const normDisplayName = item.displayname?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

                if (normName === normalizedItemName || (normDisplayName && normDisplayName === normalizedItemName)) {
                    return { ...item }; // Retorna uma cópia do objeto
                }
            }
        }
    }
    return undefined; // Não encontrado
};

/**
 * Adiciona uma quantidade de um item ao inventário do usuário.
 * @param {string} user_id - ID do usuário.
 * @param {string} itemName - Nome do item (será normalizado para chave).
 * @param {number} value - Quantidade a adicionar (positiva).
 */
itemExtension.add = async function(user_id, itemName, value) {
    const itemKey = normalizeItemNameForKey(itemName);
    const amount = Math.max(0, Number(value) || 0); // Garante positivo e número
    if (!itemKey || amount <= 0) return; // Não faz nada se inválido
    await DatabaseManager.increment(user_id, "storage", itemKey, amount, 'user_id');
};

/**
 * Define a quantidade exata de um item no inventário do usuário.
 * @param {string} user_id - ID do usuário.
 * @param {string} itemName - Nome do item (será normalizado para chave).
 * @param {number} value - Quantidade exata (>= 0).
 */
itemExtension.set = async function(user_id, itemName, value) {
    const itemKey = normalizeItemNameForKey(itemName);
    const amount = Math.max(0, Number(value) || 0); // Garante >= 0 e número
    if (!itemKey) return;
    await DatabaseManager.set(user_id, "storage", itemKey, amount, 'user_id');
};

// REMOVIDO: itemExtension.loadToStorage - Não aplicável ao MongoDB

/**
 * Obtém os chips (peças) que um usuário possui no inventário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<Array<object>>} Array de objetos chip com a propriedade 'size' adicionada.
 */
itemExtension.getChips = async function(user_id) {
    const shopObj = API.shopExtension.getShopObj(); // Lista de todos os produtos
    const storageDoc = await DatabaseManager.findOne('storage', { user_id: user_id });
    let ownedChips = [];

    if (!shopObj || !storageDoc) return []; // Retorna vazio se não houver loja ou storage

    // Itera sobre as categorias da loja para encontrar chips (type == 5)
    for (const category in shopObj) {
        if (Array.isArray(shopObj[category])) {
            for (const product of shopObj[category]) {
                if (product.type === 5) { // É um chip?
                    const chipKey = `piece:${product.id}`; // Chave no documento storage
                    const quantity = storageDoc[chipKey]; // Quantidade no storage
                    if (quantity > 0) {
                        ownedChips.push({ ...product, size: quantity }); // Adiciona à lista com a quantidade
                    }
                }
            }
        }
    }
    return ownedChips;
};

/**
 * Obtém os chips equipados por um usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<Array<object>>} Array de objetos chip equipados (pode ser vazio).
 */
itemExtension.getEquippedChips = async function(user_id) {
  try {
      const machineDoc = await DatabaseManager.findOne('machines', { user_id: user_id }, { projection: { slots: 1 } });
      const chips = machineDoc?.slots || []; // Pega o array 'slots' ou um array vazio

      // Calcula durabilitypercent para cada chip (se necessário)
      for (const chip of chips) {
          if (typeof chip === 'object' && chip.id) { // Verifica se é um objeto chip válido
               const productInfo = API.shopExtension.getProduct(chip.id);
               if (productInfo?.durability > 0) { // Verifica se tem durabilidade
                   chip.durabilitypercent = Math.max(0, Math.min(100, (chip.durability / productInfo.durability) * 100));
               } else {
                   chip.durabilitypercent = 100; // Ou 0 se não tiver durabilidade?
               }
          }
      }
      return chips;
  } catch (error) {
       console.error(`[ERRO][ItemExt] Falha ao obter chips equipados para ${user_id}:`, error);
       if(API.client?.emit) API.client.emit('error', error);
       return []; // Retorna vazio em caso de erro
  }

};

/**
 * Desequipa um chip de um slot específico.
 * @param {string} user_id - ID do usuário.
 * @param {number} slotIndex - Índice do slot a desequipar (base 0).
 * @returns {Promise<Array<object>|null>} O novo array de chips equipados ou null em caso de falha.
 */
itemExtension.unequipChip = async function(user_id, slotIndex) {
  try {
    let currentChips = await itemExtension.getEquippedChips(user_id); // Pega os chips atuais
    if (slotIndex < 0 || slotIndex >= currentChips.length || !currentChips[slotIndex]) {
        console.warn(`[ItemExt] Tentativa de desequipar slot inválido ${slotIndex} para ${user_id}.`);
        return currentChips; // Retorna os chips atuais sem alteração
    }

    const chipToUnequip = currentChips[slotIndex];

    // Remove o chip do array
    currentChips.splice(slotIndex, 1);

    // Atualiza o array 'slots' no documento 'machines'
    const filter = { user_id: user_id };
    const update = currentChips.length > 0 ? { $set: { slots: currentChips } } : { $unset: { slots: 1 } }; // Remove o campo se ficar vazio
    await DatabaseManager.updateOne('machines', filter, update);

    // Adiciona de volta ao storage SE a durabilidade estiver 100% (ou outra condição?)
    // A lógica original verificava == 100, mantendo isso:
    if (chipToUnequip.durabilitypercent === 100) {
        const chipKey = `piece:${chipToUnequip.id}`;
        await DatabaseManager.increment(user_id, 'storage', chipKey, 1, 'user_id');
    } else {
         console.log(`[ItemExt] Chip ${chipToUnequip.id} desequipado por ${user_id} com durabilidade < 100%. Não retornou ao storage.`);
    }

    return currentChips; // Retorna o array atualizado

  } catch (error) {
    console.error(`[ERRO][ItemExt] Falha ao desequipar chip no slot ${slotIndex} para ${user_id}:`, error);
     if(API.client?.emit) API.client.emit('error', error);
    return null; // Retorna null em caso de erro
  }
};

/**
 * Desequipa TODOS os chips de um usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<boolean>} True se bem-sucedido, false caso contrário.
 */
itemExtension.unequipAllChips = async function(user_id) {
  try {
    let currentChips = await itemExtension.getEquippedChips(user_id);
    if (currentChips.length === 0) return true; // Nada a fazer

    const storageUpdates = {}; // Para incrementar múltiplos itens no storage de uma vez

    for (const chip of currentChips){
      // Adiciona de volta ao storage se durabilidade 100%
      if (chip.durabilitypercent === 100) {
          const chipKey = `piece:${chip.id}`;
          if (!storageUpdates.$inc) storageUpdates.$inc = {};
          storageUpdates.$inc[chipKey] = (storageUpdates.$inc[chipKey] || 0) + 1;
      }
    }

    // Limpa o array 'slots' no documento 'machines'
    const filter = { user_id: user_id };
    const update = { $unset: { slots: 1 } }; // Remove o campo 'slots'
    await DatabaseManager.updateOne('machines', filter, update);

    // Atualiza o storage (se houver chips para retornar)
    if (storageUpdates.$inc && Object.keys(storageUpdates.$inc).length > 0) {
         await DatabaseManager.updateOne('storage', filter, storageUpdates, { upsert: true }); // Upsert para garantir que o doc storage exista
    }

    console.log(`[ItemExt] Todos os chips foram desequipados para ${user_id}.`);
    return true;

  } catch (error) {
     console.error(`[ERRO][ItemExt] Falha ao desequipar todos os chips para ${user_id}:`, error);
     if(API.client?.emit) API.client.emit('error', error);
     return false;
  }
};

/**
 * Remove durabilidade dos chips equipados.
 * @param {string} user_id - ID do usuário.
 * @param {number} amountToRemove - Quantidade de durabilidade a remover.
 * @returns {Promise<boolean>} True se bem-sucedido, false caso contrário.
 */
itemExtension.removeChipsDurability = async function(user_id, amountToRemove) {
  if (amountToRemove <= 0) return true; // Nada a remover

  try {
    const machineDoc = await DatabaseManager.findOne('machines', { user_id: user_id }, { projection: { slots: 1 } });
    let currentChips = machineDoc?.slots || [];
    if (currentChips.length === 0) return true; // Nenhum chip equipado

    let changed = false;
    // Itera e remove durabilidade, marcando se houve mudança
    const updatedChips = currentChips.map(chip => {
        if (typeof chip === 'object' && chip.durability > 0) { // Verifica se é chip e tem durabilidade
             const newDurability = Math.max(0, chip.durability - amountToRemove);
             if (newDurability !== chip.durability) {
                  changed = true;
                  return { ...chip, durability: newDurability }; // Retorna chip com durabilidade atualizada
             }
        }
        return chip; // Retorna chip inalterado
    }).filter(chip => !(typeof chip === 'object' && chip.durability <= 0)); // Remove chips com durabilidade 0 ou menor

    // Se houve mudança no array de chips (remoção ou alteração de durabilidade)
    if (changed || updatedChips.length !== currentChips.length) {
         const filter = { user_id: user_id };
         const update = updatedChips.length > 0 ? { $set: { slots: updatedChips } } : { $unset: { slots: 1 } }; // Remove o campo se vazio
         await DatabaseManager.updateOne('machines', filter, update);
         console.log(`[ItemExt] Durabilidade de chips removida (${amountToRemove}) para ${user_id}.`);
    }

    return true;

  } catch (error) {
    console.error(`[ERRO][ItemExt] Falha ao remover durabilidade de chips para ${user_id}:`, error);
    if(API.client?.emit) API.client.emit('error', error);
    return false;
  }
};

/**
 * Equipa uma peça (chip) no próximo slot disponível.
 * @param {string} user_id - ID do usuário.
 * @param {object} piece - Objeto da peça a ser equipada (deve conter 'id', 'durability', etc.).
 * @returns {Promise<boolean>} True se equipou, false caso contrário (ex: slots cheios).
 */
itemExtension.givePiece = async function(user_id, piece) {
   try {
       const machineDoc = await DatabaseManager.findOne('machines', { user_id: user_id }, { projection: { slots: 1, level: 1 } }); // Pega level também
       const playerDoc = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { mvp: 1 } }); // Pega mvp status

       if (!machineDoc) return false; // Precisa ter registro em machines

       const currentSlots = machineDoc.slots || [];
       const currentLevel = machineDoc.level || 1;
       const hasMvp = playerDoc?.mvp != null; // Adapte a lógica de verificação do MVP

       const maxSlots = API.maqExtension.getSlotMax(currentLevel, hasMvp); // Calcula max slots

       if (currentSlots.length >= maxSlots) {
            console.log(`[ItemExt] Slots cheios (${maxSlots}) para ${user_id}. Não foi possível equipar ${piece.id}.`);
            return false; // Slots cheios
       }

       // Adiciona a peça ao array de slots usando $push
       const filter = { user_id: user_id };
       const update = { $push: { slots: piece } };
       await DatabaseManager.updateOne('machines', filter, update, { upsert: true }); // Upsert caso 'machines' não exista
       console.log(`[ItemExt] Peça ${piece.id} equipada para ${user_id}.`);
       return true;

   } catch (error) {
        console.error(`[ERRO][ItemExt] Falha ao equipar peça ${piece.id} para ${user_id}:`, error);
        if(API.client?.emit) API.client.emit('error', error);
        return false;
   }
};

/**
 * Traduz a string de raridade para um emoji.
 * @param {string} rarity - Nome da raridade (lowercase).
 * @returns {string} Emoji correspondente.
 */
itemExtension.translateRarity = function(rarity) {
    // Mantida como antes
    switch(String(rarity).toLowerCase()) {
        case "uncommon": return "<:incomum:852302869888630854>";
        case "rare": return "<:raro:852302870074359838>";
        case "epic": return "<:epico:852302869628715050>";
        case "lendary": return "<:lendario:852302870144745512>"; // Corrigido: Legendary
        case "mythic": return "<:mitico:852302869746548787>";
        default: return "<:comum:852302869889155082>";
    }
};

/**
 * Obtém o inventário (storage) de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {boolean} filtered - Se true, retorna apenas itens com quantidade > 0.
 * @param {boolean} lengthOnly - Se true, retorna apenas a contagem de tipos de itens.
 * @returns {Promise<Array<object>|number>} Array de objetos item com 'size'/'qnt' ou a contagem.
 */
itemExtension.getInv = async function(user_id, filtered = false, lengthOnly = false) {
    try {
        const storageDoc = await DatabaseManager.findOne('storage', { user_id: user_id });
        const masterItemList = itemExtension.getObj()?.drops || []; // Pega a lista mestra de drops/itens
        let inventoryItems = [];

        if (!storageDoc) { // Se não tem storage, inventário está vazio
            return lengthOnly ? 0 : [];
        }

        // Itera sobre a lista mestra para verificar o que o usuário tem
        for (const masterItem of masterItemList) {
            const itemKey = normalizeItemNameForKey(masterItem.name);
            if (!itemKey) continue; // Pula itens mestres inválidos

            const quantity = storageDoc[itemKey]; // Pega a quantidade do storage

            if (quantity > 0) {
                 // Cria uma cópia do item mestre e adiciona a quantidade
                 inventoryItems.push({
                     ...masterItem,
                     size: quantity, // Adiciona 'size'
                     qnt: quantity   // Adiciona 'qnt' (redundante?)
                 });
            } else if (!filtered) {
                 // Se não for filtrado, adiciona com quantidade 0
                  inventoryItems.push({
                      ...masterItem,
                      size: 0,
                      qnt: 0
                  });
            }
        }

        // Adicionar lógica para 'pieces' (chips) se eles não estiverem em masterItemList.drops
         const shopObj = API.shopExtension.getShopObj();
         for (const category in shopObj) {
             if (Array.isArray(shopObj[category])) {
                 for (const product of shopObj[category]) {
                     if (product.type === 5) { // É um chip?
                          // Verifica se já não foi adicionado pela lista de drops
                          if (!inventoryItems.some(invItem => invItem.id === product.id)) {
                               const chipKey = `piece:${product.id}`;
                               const quantity = storageDoc[chipKey];
                               if (quantity > 0) {
                                    inventoryItems.push({ ...product, size: quantity, qnt: quantity });
                               } else if (!filtered) {
                                    inventoryItems.push({ ...product, size: 0, qnt: 0 });
                               }
                          }
                     }
                 }
             }
         }


        if (lengthOnly) {
            // Conta apenas os itens com quantidade > 0 se filtered for true
            return filtered ? inventoryItems.filter(item => item.qnt > 0).length : inventoryItems.length;
        }

        return filtered ? inventoryItems.filter(item => item.qnt > 0) : inventoryItems; // Retorna o array

    } catch (err) {
        console.error(`[ERRO][ItemExt] Falha ao obter inventário para ${user_id}:`, err);
        if(API.client?.emit) API.client.emit('error', err);
        return lengthOnly ? 0 : []; // Retorna vazio/0 em caso de erro
    }
};

module.exports = itemExtension;