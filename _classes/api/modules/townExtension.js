// _classes/api/modules/townExtension.js

// Requer a API DENTRO das funções que a utilizam
require('colors'); // Para logs

const townExtension = {
    // Posições X, Y para cada localização (simplificado)
    pos: {
        1: { x: 140, y: 155 }, // Vila Principal
        2: { x: 250, y: 250 }, // Localização 2
        3: { x: 350, y: 100 }, // Localização 3
        4: { x: 450, y: 300 }  // Localização 4
    }
};

/**
 * Move um jogador para uma nova localização.
 * @param {string} user_id - ID do usuário.
 * @param {number} locNum - Número da localização de destino (1-4).
 * @returns {Promise<boolean>} True se a movimentação foi bem-sucedida.
 */
townExtension.move = async function(user_id, locNum) {
    // Requer a API aqui
    const API = require('../index');
    const targetLocation = Number(locNum);

    // Validação básica da localização
    if (!targetLocation || targetLocation < 1 || targetLocation > 4) {
        console.warn(`[TownExt] Tentativa de mover ${user_id} para localização inválida (${locNum}).`);
        return false;
    }

    try {
        // Atualiza a localização no documento 'players'
        // ALTERADO: Usando API.db.set
        const result = await API.db.set(user_id, 'players', 'location', targetLocation, 'user_id');
        // A função set do DatabaseManager retorna o resultado do updateOne
        return result && (result.modifiedCount > 0 || result.upsertedCount > 0 || result.matchedCount > 0); // Considera sucesso se algo foi modificado, inserido ou encontrado (mesmo sem modificar)
    } catch (err) {
        console.error(`[ERRO][TownExt.move] Falha ao mover ${user_id} para localização ${targetLocation}:`, err);
        if (API.client?.emit) API.client.emit('error', err);
        return false;
    }
};

/**
 * Obtém a localização atual de um jogador.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Número da localização atual (padrão 1).
 */
townExtension.getLocation = async function(user_id) {
    // Requer a API aqui
    const API = require('../index');
    try {
        // ALTERADO: Usando API.db.findOne
        const doc = await API.db.findOne('players', { user_id: user_id }, { projection: { location: 1 } });
        return doc?.location || 1; // Retorna 1 se não encontrado ou campo não existir
    } catch (err) {
        console.error(`[ERRO][TownExt.getLocation] Falha ao obter localização para ${user_id}:`, err);
        if (API.client?.emit) API.client.emit('error', err);
        return 1; // Retorna localização padrão em caso de erro
    }
};

/**
 * Obtém as coordenadas (X, Y) de uma localização.
 * @param {number} locNum - Número da localização.
 * @returns {Promise<{x: number, y: number}>} Objeto com coordenadas ou posição padrão.
 */
townExtension.getPosByTownNum = async function(locNum) {
    // Não precisa da API aqui, usa this.pos
    const location = Number(locNum);
    if (this.pos[location]) {
        return this.pos[location];
    } else {
        console.warn(`[TownExt] Posição não encontrada para localização ${locNum}. Usando padrão.`);
        return this.pos[1]; // Retorna posição da Vila Principal como padrão
    }
};

module.exports = townExtension;