// _classes/api/modules/badges.js

const { readFileSync } = require('fs');
const path = require('path'); // Importar path
const API = require('../index'); // Importar API centralizada
const DatabaseManager = API.DatabaseManager; // Usar a instância

const badges = {
    json: [] // Armazena os dados dos emblemas carregados do JSON
};

/**
 * Carrega os dados dos emblemas do arquivo JSON para a memória.
 */
badges.load = function () {
    // Só carrega se ainda não foi carregado
    if (badges.json.length === 0) {
        // Corrigir caminho relativo para o JSON
        const jsonPath = path.join(__dirname, '..', '..', '..', '_json/social/badges.json'); // ../../../_json/
        try {
            console.log(`[Badges] Carregando emblemas de: ${jsonPath}`);
            const jsonString = readFileSync(jsonPath, 'utf8');
            badges.json = JSON.parse(jsonString);
            console.log(`[Badges] ${badges.json.length} emblemas carregados.`);
        } catch (err) {
            console.error(`[ERRO][Badges] Falha ao carregar ou parsear ${jsonPath}:`, err);
            badges.json = []; // Define como vazio em caso de erro
            if(API.client?.emit) API.client.emit('error', err);
        }
    }
};

/**
 * Verifica se um utilizador possui um emblema específico.
 * @param {string} user_id - ID do utilizador.
 * @param {string|number} badgeId - ID do emblema a verificar.
 * @returns {Promise<boolean>} True se o utilizador possui o emblema, false caso contrário.
 */
badges.has = async function (user_id, badgeId) {
    try {
        const filter = { user_id: user_id };
        const options = { projection: { badges: 1 } }; // Busca apenas o campo badges
        const playerDoc = await DatabaseManager.findOne('players', filter, options);

        // Verifica se o documento existe, se tem o array 'badges' e se o array inclui o ID
        // Converte badgeId para string para comparação consistente
        return playerDoc?.badges?.includes(String(badgeId)) || false;
    } catch (err) {
        console.error(`[ERRO][Badges] Falha ao verificar emblema ${badgeId} para ${user_id}:`, err);
        if(API.client?.emit) API.client.emit('error', err);
        return false; // Assume que não tem em caso de erro
    }
};

/**
 * Adiciona um emblema a um utilizador.
 * @param {string} user_id - ID do utilizador.
 * @param {string|number} badgeId - ID do emblema a adicionar.
 * @returns {Promise<string>} Mensagem indicando o resultado.
 */
badges.add = async function (user_id, badgeId) {
    badges.load(); // Garante que os emblemas estão carregados (para get)
    const badgeToAdd = String(badgeId); // Garante que é string

    // Verifica se o emblema existe na definição
    if (!badges.get(badgeToAdd)) {
        return `Erro: Emblema com ID ${badgeToAdd} não encontrado nas definições.`;
    }

    try {
        const alreadyHas = await badges.has(user_id, badgeToAdd);
        if (alreadyHas) {
            return `Utilizador já possui o emblema ${badgeToAdd}.`;
        }

        const filter = { user_id: user_id };
        // Usa $addToSet para adicionar ao array 'badges' apenas se não existir
        const update = { $addToSet: { badges: badgeToAdd } };
        const result = await DatabaseManager.updateOne('players', filter, update, { upsert: true }); // upsert cria o doc se não existir

        if (result && (result.modifiedCount > 0 || result.upsertedCount > 0)) {
            return `Emblema ${badgeToAdd} adicionado com sucesso.`;
        } else if (result && result.matchedCount > 0 && result.modifiedCount === 0) {
             // Isso pode acontecer se $addToSet não modificar porque o item já estava lá (corrida?)
             // Mas o 'has' já deveria ter pego isso. Log para investigar se ocorrer.
             console.warn(`[Badges.add] $addToSet não modificou, mas 'has' retornou false para ${user_id}, badge ${badgeToAdd}`);
             return `Utilizador já possui o emblema ${badgeToAdd} (verificado após update).`;
        }
        else {
            console.error(`[ERRO][Badges] Falha ao adicionar emblema ${badgeToAdd} para ${user_id}. Resultado:`, result);
            return `Falha ao adicionar emblema ${badgeToAdd}.`;
        }
    } catch (err) {
        console.error(`[ERRO][Badges] Falha ao adicionar emblema ${badgeToAdd} para ${user_id}:`, err);
        if(API.client?.emit) API.client.emit('error', err);
        return `Erro ao adicionar emblema ${badgeToAdd}.`;
    }
};

/**
 * Remove um emblema de um utilizador.
 * @param {string} user_id - ID do utilizador.
 * @param {string|number} badgeId - ID do emblema a remover.
 * @returns {Promise<string>} Mensagem indicando o resultado.
 */
badges.remove = async function (user_id, badgeId) {
    const badgeToRemove = String(badgeId); // Garante que é string

    try {
        const currentlyHas = await badges.has(user_id, badgeToRemove);
        if (!currentlyHas) {
            return `Utilizador não possui o emblema ${badgeToRemove}.`;
        }

        const filter = { user_id: user_id };
        // Usa $pull para remover todas as ocorrências do emblema do array 'badges'
        const update = { $pull: { badges: badgeToRemove } };
        const result = await DatabaseManager.updateOne('players', filter, update); // Não precisa de upsert aqui

        if (result && result.modifiedCount > 0) {
            return `Emblema ${badgeToRemove} removido com sucesso.`;
        } else if (result && result.matchedCount > 0 && result.modifiedCount === 0) {
             // Documento encontrado, mas $pull não removeu (já não estava lá?)
             console.warn(`[Badges.remove] $pull não modificou, mas 'has' retornou true para ${user_id}, badge ${badgeToRemove}`);
             return `Utilizador não possui o emblema ${badgeToRemove} (verificado após update).`;
        }
        else {
             console.error(`[ERRO][Badges] Falha ao remover emblema ${badgeToRemove} para ${user_id}. Resultado:`, result);
            return `Falha ao remover emblema ${badgeToRemove}.`;
        }
    } catch (err) {
        console.error(`[ERRO][Badges] Falha ao remover emblema ${badgeToRemove} para ${user_id}:`, err);
        if(API.client?.emit) API.client.emit('error', err);
        return `Erro ao remover emblema ${badgeToRemove}.`;
    }
};

/**
 * Obtém os dados de definição de um emblema pelo ID.
 * @param {string|number} badgeId - ID do emblema.
 * @returns {object|undefined} Objeto com os dados do emblema ou undefined se não encontrado.
 */
badges.get = function (badgeId) {
    badges.load(); // Garante que os dados JSON estão carregados
    const idToFind = String(badgeId);
    return badges.json.find(item => String(item.id) === idToFind); // Compara como strings
};


// Carrega os emblemas na inicialização do módulo
badges.load();

module.exports = badges;