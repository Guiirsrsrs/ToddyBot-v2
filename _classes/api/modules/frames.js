// _classes/api/modules/frames.js

const API = require('../index'); // API centralizada (contém API.db)
const fs = require('fs');
const path = require('path');
require('colors'); // Para logs

const frames = {
    obj: {}, // Objeto para armazenar as molduras carregadas
};

/**
 * Carrega as definições das molduras do JSON.
 */
frames.load = function() {
    const framesJsonPath = path.join(__dirname, '..', '..', '..', '_json/social/frames.json'); // Caminho para ../../../_json/social/frames.json
    console.log(`[Frames] Carregando definições de molduras de: ${framesJsonPath}`.yellow);
    try {
        const jsonString = fs.readFileSync(framesJsonPath, 'utf8');
        this.obj = JSON.parse(jsonString);
        console.log(`[Frames] ${Object.keys(this.obj).length} molduras carregadas.`);
    } catch (err) {
        console.error(`[ERRO][Frames] Falha ao carregar ou parsear ${framesJsonPath}:`, err);
        this.obj = {}; // Define como vazio em caso de erro
        if (API.client?.emit) API.client.emit('error', err);
    }
};

/**
 * Obtém os dados de uma moldura específica pelo ID.
 * @param {string|number} frameId - ID da moldura.
 * @returns {object|null} Objeto da moldura ou null se não encontrada.
 */
frames.get = function(frameId) {
    // Acessa this.obj que foi carregado pela função load()
    return this.obj[frameId] || null;
};

/**
 * Retorna o objeto com todas as molduras carregadas.
 * @returns {object}
 */
frames.getObj = function() {
    return this.obj;
};

/**
 * Verifica se uma moldura com o ID existe.
 * @param {string|number} frameId - ID da moldura.
 * @returns {boolean}
 */
frames.check = function(frameId) {
    return this.obj.hasOwnProperty(frameId);
};

/**
 * Obtém as molduras que um usuário possui.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<Array<string|number>>} Array com os IDs das molduras possuídas.
 */
frames.getOwned = async function(user_id) {
    // ALTERADO: Usando API.db
    const doc = await API.db.findOne('players_utils', { user_id: user_id }, { projection: { framesOwned: 1 } });
    return doc?.framesOwned || []; // Retorna array vazio se não existir
};

/**
 * Adiciona uma moldura à coleção de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {string|number} frameId - ID da moldura a adicionar.
 * @returns {Promise<boolean>} True se a moldura foi adicionada com sucesso ou já existia.
 */
frames.add = async function(user_id, frameId) {
    if (!this.check(frameId)) {
        console.warn(`[Frames] Tentativa de adicionar moldura inexistente (${frameId}) para ${user_id}.`);
        return false;
    }
    const filter = { user_id: user_id };
    // Usa $addToSet para garantir que a moldura só seja adicionada se ainda não existir no array
    const update = { $addToSet: { framesOwned: frameId } };
    try {
        // ALTERADO: Usando API.db
        const result = await API.db.updateOne('players_utils', filter, update, { upsert: true }); // Cria o doc se não existir
        // Retorna true mesmo se modifiedCount for 0 (caso a moldura já exista, $addToSet não modifica)
        return !!result;
    } catch (err) {
        console.error(`[ERRO][Frames.add] Falha ao adicionar moldura ${frameId} para ${user_id}:`, err);
        if (API.client?.emit) API.client.emit('error', err);
        return false;
    }
};

/**
 * Remove uma moldura da coleção de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {string|number} frameId - ID da moldura a remover.
 * @returns {Promise<boolean>} True se a moldura foi removida com sucesso.
 */
frames.remove = async function(user_id, frameId) {
    const filter = { user_id: user_id };
    // Usa $pull para remover a moldura do array
    const update = { $pull: { framesOwned: frameId } };
    try {
        // ALTERADO: Usando API.db
        const result = await API.db.updateOne('players_utils', filter, update);
        return result && result.modifiedCount > 0;
    } catch (err) {
        console.error(`[ERRO][Frames.remove] Falha ao remover moldura ${frameId} de ${user_id}:`, err);
        if (API.client?.emit) API.client.emit('error', err);
        return false;
    }
};

/**
 * Define a moldura equipada por um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {string|number|null} frameId - ID da moldura a equipar, ou null para desequipar.
 * @returns {Promise<boolean>} True se a operação foi bem-sucedida.
 */
frames.setEquipped = async function(user_id, frameId) {
    // Verifica se o usuário possui a moldura (se não for null)
    if (frameId !== null && frameId !== undefined) {
        const owned = await this.getOwned(user_id);
        if (!owned.includes(frameId)) {
             console.warn(`[Frames] Tentativa de equipar moldura ${frameId} não possuída por ${user_id}.`);
             return false; // Não permite equipar moldura não possuída
        }
    }

    const filter = { user_id: user_id };
    // Define o campo frameEquipped (ou remove se frameId for null)
    const update = frameId !== null && frameId !== undefined
        ? { $set: { frameEquipped: frameId } }
        : { $unset: { frameEquipped: "" } }; // $unset para remover o campo

    try {
        // ALTERADO: Usando API.db
        const result = await API.db.updateOne('players_utils', filter, update, { upsert: true }); // Cria o doc se não existir
        return !!result;
    } catch (err) {
        console.error(`[ERRO][Frames.setEquipped] Falha ao equipar moldura ${frameId} para ${user_id}:`, err);
        if (API.client?.emit) API.client.emit('error', err);
        return false;
    }
};

/**
 * Obtém a moldura equipada por um usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<string|number|null>} ID da moldura equipada ou null.
 */
frames.getEquipped = async function(user_id) {
    // ALTERADO: Usando API.db
    const doc = await API.db.findOne('players_utils', { user_id: user_id }, { projection: { frameEquipped: 1 } });
    return doc?.frameEquipped || null; // Retorna null se não houver ou o campo não existir
};

// Carrega as molduras quando o módulo é importado
frames.load();

module.exports = frames;