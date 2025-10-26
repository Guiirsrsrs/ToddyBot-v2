// _classes/api/modules/frames.js

const { readFileSync } = require('fs');
const path = require('path');
const API = require('../index'); // API centralizada
const DatabaseManager = API.DatabaseManager; // Instância do DBManager

const frames = {
    json: [] // Armazena definições das molduras
};

/**
 * Carrega as definições de molduras do arquivo JSON.
 */
frames.load = function () {
    if (frames.json.length === 0) {
        const jsonPath = path.join(__dirname, '..', '..', '..', '_json/social/frames.json'); // Corrigido ../../../_json/
        try {
            console.log(`[Frames] Carregando molduras de: ${jsonPath}`);
            const jsonString = readFileSync(jsonPath, 'utf8');
            frames.json = JSON.parse(jsonString);
            console.log(`[Frames] ${frames.json.length} molduras carregadas.`);
        } catch (err) {
            console.error(`[ERRO][Frames] Falha ao carregar ou parsear ${jsonPath}:`, err);
            frames.json = [];
            if(API.client?.emit) API.client.emit('error', err);
        }
    }
};

/**
 * Verifica se um utilizador possui uma moldura específica.
 * @param {string} user_id - ID do utilizador.
 * @param {string|number} frameId - ID da moldura.
 * @returns {Promise<boolean>} True se possui, false caso contrário.
 */
frames.has = async function (user_id, frameId) {
    try {
        const filter = { user_id: user_id };
        const options = { projection: { frames: 1 } };
        const playerDoc = await API.client.db.findOne('players', filter, options);
        // Compara como string
        return playerDoc?.frames?.includes(String(frameId)) || false;
    } catch (err) {
        console.error(`[ERRO][Frames] Falha ao verificar moldura ${frameId} para ${user_id}:`, err);
        if(API.client?.emit) API.client.emit('error', err);
        return false;
    }
};

/**
 * Adiciona uma moldura ao inventário do utilizador (no início da lista).
 * @param {string} user_id - ID do utilizador.
 * @param {string|number} frameId - ID da moldura.
 * @returns {Promise<string>} Mensagem de resultado.
 */
frames.add = async function (user_id, frameId) {
    frames.load();
    const frameToAdd = String(frameId);

    if (!frames.get(frameToAdd)) {
        return `Erro: Moldura com ID ${frameToAdd} não encontrada nas definições.`;
    }

    try {
        const alreadyHas = await frames.has(user_id, frameToAdd);
        if (alreadyHas) {
            // Se já tem, talvez chamar reforge ou apenas informar? A lógica antiga informava.
             // Vamos chamar reforge para colocar no início
             return await frames.reforge(user_id, frameToAdd);
            // return `Utilizador já possui a moldura ${frameToAdd}. Usando /reforge para reordenar.`;
        }

        const filter = { user_id: user_id };
        // Usa $push com $position: 0 para adicionar no início do array
        const update = {
             $push: {
                 frames: {
                     $each: [frameToAdd], // Adiciona o item
                     $position: 0      // Na posição 0 (início)
                 }
             }
         };
        const result = await API.client.db.updateOne('players', filter, update, { upsert: true });

        if (result && (result.modifiedCount > 0 || result.upsertedCount > 0)) {
            return `Moldura ${frameToAdd} adicionada com sucesso.`;
        } else {
            console.error(`[ERRO][Frames] Falha ao adicionar moldura ${frameToAdd} para ${user_id}. Resultado:`, result);
            return `Falha ao adicionar moldura ${frameToAdd}.`;
        }
    } catch (err) {
        console.error(`[ERRO][Frames] Falha ao adicionar moldura ${frameToAdd} para ${user_id}:`, err);
        if(API.client?.emit) API.client.emit('error', err);
        return `Erro ao adicionar moldura ${frameToAdd}.`;
    }
};

/**
 * Move uma moldura existente para o início da lista do utilizador (equipando-a).
 * @param {string} user_id - ID do utilizador.
 * @param {string|number} frameId - ID da moldura.
 * @returns {Promise<string>} Mensagem de resultado.
 */
frames.reforge = async function (user_id, frameId) {
    frames.load();
    const frameToReforge = String(frameId);

     if (!frames.get(frameToReforge)) {
        return `Erro: Moldura com ID ${frameToReforge} não encontrada nas definições.`;
    }

    try {
        const currentlyHas = await frames.has(user_id, frameToReforge);
        if (!currentlyHas) {
            return `Utilizador não possui a moldura ${frameToReforge} para reequipar. Use /addframe primeiro.`;
        }

        const filter = { user_id: user_id };

        // Passo 1: Remover a moldura do array (se existir)
        const pullUpdate = { $pull: { frames: frameToReforge } };
        await API.client.db.updateOne('players', filter, pullUpdate); // Executa a remoção

        // Passo 2: Adicionar a moldura de volta no início
        const pushUpdate = {
            $push: {
                frames: {
                    $each: [frameToReforge],
                    $position: 0
                }
            }
        };
        const pushResult = await API.client.db.updateOne('players', filter, pushUpdate); // Adiciona no início (upsert não necessário aqui)

        if (pushResult && pushResult.modifiedCount > 0) {
             // Verificar se o item "0" (sem moldura) precisa ser removido, como na lógica antiga
             // Isso pode ser feito com outro $pull ou ajustando o array antes do $set final
             // await API.client.db.updateOne(filter, { $pull: { frames: '0' } }); // Exemplo

            return `Moldura ${frameToReforge} reequipada com sucesso (movida para o início).`;
        } else {
            console.error(`[ERRO][Frames] Falha ao reequipar (push) moldura ${frameToReforge} para ${user_id}. Resultado:`, pushResult);
            // Pode ter falhado ao remover ou ao adicionar de volta
            return `Falha ao reequipar moldura ${frameToReforge}.`;
        }
    } catch (err) {
        console.error(`[ERRO][Frames] Falha ao reequipar moldura ${frameToReforge} para ${user_id}:`, err);
        if(API.client?.emit) API.client.emit('error', err);
        return `Erro ao reequipar moldura ${frameToReforge}.`;
    }
};

/**
 * Remove uma moldura do inventário do utilizador.
 * @param {string} user_id - ID do utilizador.
 * @param {string|number} frameId - ID da moldura.
 * @returns {Promise<string>} Mensagem de resultado.
 */
frames.remove = async function (user_id, frameId) {
    const frameToRemove = String(frameId);

    try {
        const currentlyHas = await frames.has(user_id, frameToRemove);
        if (!currentlyHas) {
            return `Utilizador não possui a moldura ${frameToRemove}.`;
        }

        const filter = { user_id: user_id };
        const update = { $pull: { frames: frameToRemove } }; // Remove do array
        const result = await API.client.db.updateOne('players', filter, update);

        if (result && result.modifiedCount > 0) {
            return `Moldura ${frameToRemove} removida com sucesso.`;
        } else if (result && result.matchedCount > 0 && result.modifiedCount === 0) {
             console.warn(`[Frames.remove] $pull não modificou, mas 'has' retornou true para ${user_id}, frame ${frameToRemove}`);
             return `Utilizador não possui a moldura ${frameToRemove} (verificado após update).`;
        } else {
            console.error(`[ERRO][Frames] Falha ao remover moldura ${frameToRemove} para ${user_id}. Resultado:`, result);
            return `Falha ao remover moldura ${frameToRemove}.`;
        }
    } catch (err) {
        console.error(`[ERRO][Frames] Falha ao remover moldura ${frameToRemove} para ${user_id}:`, err);
        if(API.client?.emit) API.client.emit('error', err);
        return `Erro ao remover moldura ${frameToRemove}.`;
    }
};

/**
 * Obtém os dados de definição de uma moldura pelo ID.
 * @param {string|number} frameId - ID da moldura.
 * @returns {object|undefined} Objeto com os dados da moldura ou undefined.
 */
frames.get = function (frameId) {
    frames.load();
    const idToFind = String(frameId);
    return frames.json.find(item => String(item.id) === idToFind);
};

// Carrega as definições na inicialização
frames.load();

module.exports = frames;