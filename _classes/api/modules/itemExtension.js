// _classes/api/modules/itemExtension.js

// Requer a API DENTRO das funções que a utilizam
require('colors'); // Para logs

const itemExtension = {
    // obj será preenchido pela função loadItens em shopExtension.js
    obj: {
        minerios: [],
        drops: []
    }
};

/**
 * Obtém os dados de um item (minério ou drop) pelo ID.
 * @param {string|number} itemId - ID do item (pode ser número para minério ou string para drop).
 * @returns {object|null} Objeto do item ou null se não encontrado.
 */
itemExtension.get = function(itemId) {
    // Não precisa da API aqui, usa this.obj carregado
    const idString = String(itemId); // Compara como string

    // Procura em minérios
    // Usa === para comparação de tipo (embora idString seja string, p.id pode ser número no JSON)
    const minerio = this.obj.minerios.find(p => String(p.id) === idString);
    if (minerio) return minerio;

    // Procura em drops (que inclui outros tipos)
    const drop = this.obj.drops.find(p => String(p.id) === idString);
    if (drop) return drop;

    // Caso especial: Verifica se é uma peça (chip) pelo formato "piece:ID"
    if (idString.startsWith('piece:')) {
        // Requer a API aqui para acessar shopExtension
        const API = require('../index');
        const pieceId = idString.split(':')[1];
        // Presume que shopExtension.getProduct retorna a definição da peça
        const pieceData = API.shopExtension?.getProduct(pieceId);
        if (pieceData && pieceData.type === 5) { // Confirma que é tipo 5 (chip/peça)
            return pieceData;
        }
    }

    return null; // Não encontrado
};


/**
 * Retorna o objeto completo com todas as definições de itens carregadas.
 * @returns {object}
 */
itemExtension.getObj = function() {
    // Não precisa da API aqui
    return this.obj;
};

/**
 * Verifica se um item com o ID existe.
 * @param {string|number} itemId - ID do item.
 * @returns {boolean}
 */
itemExtension.check = function(itemId) {
    // Reutiliza a função get()
    return !!this.get(itemId);
};

/**
 * Adiciona itens ao inventário de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {string|number} itemId - ID do item.
 * @param {number} qnt - Quantidade a adicionar.
 * @returns {Promise<boolean>} True se a operação foi bem-sucedida.
 */
itemExtension.add = async function(user_id, itemId, qnt) {
    // Requer a API aqui para acesso ao DB
    const API = require('../index');
    const itemData = this.get(itemId); // Pega dados do item para validar
    if (!itemData) {
        console.warn(`[ItemExt] Tentativa de adicionar item inexistente (${itemId}) para ${user_id}.`);
        return false;
    }
    const amount = Number(qnt) || 0;
    if (amount <= 0) return true; // Não adiciona quantidade zero ou negativa, mas não é um erro

    const filter = { user_id: user_id };
    try {
        // 1. Encontra o inventário atual
        // ALTERADO: Usando API.db
        const doc = await API.db.findOne('players_utils', filter, { projection: { inventory: 1 } });
        const currentInventory = doc?.inventory || []; // Padrão array vazio

        // 2. Procura se o item já existe no inventário
        const itemIndex = currentInventory.findIndex(i => i.id === itemId);

        let update;
        if (itemIndex > -1) {
            // Se existe, usa $inc para adicionar à quantidade
            // Precisamos do caminho exato do elemento no array
            const fieldPath = `inventory.${itemIndex}.qnt`;
            update = { $inc: { [fieldPath]: amount } };
        } else {
            // Se não existe, usa $push para adicionar o novo item
            update = { $push: { inventory: { id: itemId, qnt: amount } } };
        }

        // 3. Atualiza o banco de dados
        // ALTERADO: Usando API.db
        const result = await API.db.updateOne('players_utils', filter, update, { upsert: true }); // Cria doc se não existir
        return !!result;

    } catch (err) {
        console.error(`[ERRO][ItemExt.add] Falha ao adicionar item ${itemId} (${amount}x) para ${user_id}:`, err);
        if (API.client?.emit) API.client.emit('error', err);
        return false;
    }
};

/**
 * Remove itens do inventário de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {string|number} itemId - ID do item.
 * @param {number} qnt - Quantidade a remover.
 * @returns {Promise<boolean>} True se a operação foi bem-sucedida (tinha itens suficientes).
 */
itemExtension.remove = async function(user_id, itemId, qnt) {
    // Requer a API aqui para acesso ao DB
    const API = require('../index');
    const amountToRemove = Number(qnt) || 0;
    if (amountToRemove <= 0) return true; // Não remove quantidade zero ou negativa

    const filter = { user_id: user_id, 'inventory.id': itemId }; // Filtra pelo usuário E pelo item no array

    try {
        // 1. Encontra o documento e o item específico
        // ALTERADO: Usando API.db
        const doc = await API.db.findOne('players_utils', filter, { projection: { inventory: { $elemMatch: { id: itemId } } } });

        if (!doc || !doc.inventory || doc.inventory.length === 0) {
            // console.warn(`[ItemExt.remove] Item ${itemId} não encontrado no inventário de ${user_id}.`);
            return false; // Item não encontrado
        }

        const currentItem = doc.inventory[0]; // $elemMatch retorna um array com no máximo 1 elemento
        const currentQnt = currentItem.qnt;

        if (currentQnt < amountToRemove) {
            // console.warn(`[ItemExt.remove] Quantidade insuficiente de ${itemId} para ${user_id} (tem ${currentQnt}, precisa ${amountToRemove}).`);
            return false; // Quantidade insuficiente
        }

        let update;
        if (currentQnt === amountToRemove) {
            // Se a quantidade for exata, remove o item do array
            update = { $pull: { inventory: { id: itemId } } };
        } else {
            // Se não, apenas decrementa a quantidade
            // Aqui usamos o filtro original com 'inventory.id' para garantir que estamos atualizando o item correto
            update = { $inc: { 'inventory.$.qnt': -amountToRemove } };
        }

        // 3. Atualiza o banco de dados
        // ALTERADO: Usando API.db
        const result = await API.db.updateOne({ user_id: user_id, 'inventory.id': itemId }, update);
        return result && result.modifiedCount > 0;

    } catch (err) {
        console.error(`[ERRO][ItemExt.remove] Falha ao remover item ${itemId} (${amountToRemove}x) de ${user_id}:`, err);
        if (API.client?.emit) API.client.emit('error', err);
        return false;
    }
};


/**
 * Obtém o inventário completo de um usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<Array<object>>} Array com os itens do inventário [{id: '...', qnt: ...}].
 */
itemExtension.getInv = async function(user_id) {
    // Requer a API aqui para acesso ao DB
    const API = require('../index');
    // ALTERADO: Usando API.db
    const doc = await API.db.findOne('players_utils', { user_id: user_id }, { projection: { inventory: 1 } });
    // Filtra itens com quantidade zero ou negativa, caso existam por algum erro
    return doc?.inventory?.filter(item => item.qnt > 0) || [];
};

/**
 * Define os chips equipados em uma máquina.
 * @param {string} user_id - ID do usuário.
 * @param {Array<string|number>} equippedChips - Array com os IDs dos chips equipados (ou array vazio).
 * @returns {Promise<boolean>} True se a operação foi bem-sucedida.
 */
itemExtension.setEquipped = async function(user_id, equippedChips) {
    // Requer a API aqui para acesso ao DB
    const API = require('../index');
    const filter = { user_id: user_id };
    // Garante que é um array
    const chipsToSet = Array.isArray(equippedChips) ? equippedChips : [];
    // Define o campo 'slots' (ou remove se o array for vazio)
    const update = chipsToSet.length > 0
        ? { $set: { slots: chipsToSet } }
        : { $unset: { slots: "" } }; // $unset para remover o campo

    try {
        // ALTERADO: Usando API.db
        const result = await API.db.updateOne('machines', filter, update, { upsert: true }); // Cria o doc se não existir
        return !!result;
    } catch (err) {
        console.error(`[ERRO][ItemExt.setEquipped] Falha ao definir chips para ${user_id}:`, err);
        if (API.client?.emit) API.client.emit('error', err);
        return false;
    }
};

/**
 * Obtém os chips equipados por um usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<Array<string|number>>} Array com IDs dos chips equipados.
 */
itemExtension.getEquipped = async function(user_id) {
    // Requer a API aqui para acesso ao DB
    const API = require('../index');
    // ALTERADO: Usando API.db
    const doc = await API.db.findOne('machines', { user_id: user_id }, { projection: { slots: 1 } });
    return doc?.slots || []; // Retorna array vazio se não houver
};

/**
 * Desequipa todos os chips de um usuário (remove o campo 'slots').
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<boolean>} True se a operação foi bem-sucedida.
 */
itemExtension.unequipAllChips = async function(user_id) {
    // Requer a API aqui para acesso ao DB
    const API = require('../index');
    const filter = { user_id: user_id };
    const update = { $unset: { slots: "" } }; // Remove o campo 'slots'

    try {
        // ALTERADO: Usando API.db
        // Não usa upsert aqui, só remove se o documento existir
        const result = await API.db.updateOne('machines', filter, update);
        // Retorna true mesmo se modifiedCount for 0 (caso o campo já não existisse)
        return !!result;
    } catch (err) {
        console.error(`[ERRO][ItemExt.unequipAllChips] Falha ao desequipar chips para ${user_id}:`, err);
        if (API.client?.emit) API.client.emit('error', err);
        return false;
    }
};


// Note: A função load() para this.obj é chamada pelo shopExtension.js
// Não precisa ser chamada aqui novamente.

module.exports = itemExtension;