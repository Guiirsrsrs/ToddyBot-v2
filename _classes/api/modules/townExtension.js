// _classes/api/modules/townExtension.js

const API = require('../index'); // Importa API centralizada
const DatabaseManager = API.DatabaseManager; // Usa a instância do DBManager
const config = require('../../config'); // Importa config se getConfig for usado
require('colors'); // Para logs

const townExtension = {
    // População inicializada em 0, será carregada do DB
    population: {
        'Nishigami': 0,
        'Harotec': 0,
        'Massibi': 0,
        'Tyris': 0
    },
    // Jogos por cidade (mantido)
    games: {
        'Nishigami': ['roleta', 'flip', 'luckycards'],
        'Harotec': ['roleta', 'flip', 'luckycards'],
        'Massibi': ['roleta', 'flip', 'blackjack'],
        'Tyris': ['roleta', 'flip', 'blackjack']
    },
    // Mapeamento número -> nome (mantido)
    _townNames: {
        1: 'Nishigami',
        2: 'Harotec',
        3: 'Massibi',
        4: 'Tyris'
    },
    // Mapeamento nome (lowercase) -> número (mantido)
    _townNumbers: {
        'nishigami': 1,
        'harotec': 2,
        'massibi': 3,
        'tyris': 4
    }
};

// --- Carregamento Inicial da População ---
(async () => {
    console.log("[TownExtension] Carregando população inicial do banco de dados...".yellow);
    try {
        // Busca todos os documentos que têm 'loc' definido e diferente de 0
        const filter = { loc: { $exists: true, $ne: 0, $in: [1, 2, 3, 4] } };
        // Pega apenas o campo 'loc' para otimizar
        const options = { projection: { loc: 1 } };
        const townDocs = await DatabaseManager.findMany('towns', filter, options);

        if (townDocs && townDocs.length > 0) {
            // Zera a população antes de recalcular
            for (const townName in townExtension.population) {
                townExtension.population[townName] = 0;
            }
            // Calcula a população
            for (const doc of townDocs) {
                const townName = townExtension.getTownNameByNum(doc.loc);
                if (townName && townExtension.population.hasOwnProperty(townName)) {
                    townExtension.population[townName]++;
                }
            }
            console.log("[TownExtension] População inicial carregada:".cyan, townExtension.population);
        } else {
            console.warn("[TownExtension] Nenhum documento encontrado na coleção 'towns' para calcular população inicial.".yellow);
        }
    } catch (err) {
        console.error("[ERRO][TownExtension] Falha ao carregar população inicial:", err);
        // Não trava o bot, mas a população pode ficar incorreta até ser atualizada
    }
})();

// --- Funções do Módulo ---

townExtension.getConfig = function() {
    // Retorna a config importada no topo
    return config;
};

/**
 * Obtém o número da cidade de um usuário. Se não tiver, atribui uma aleatoriamente.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Número da cidade (1-4).
 */
townExtension.getTownNum = async function(user_id) {
    const filter = { user_id: user_id };
    // Busca apenas o campo 'loc'
    const doc = await DatabaseManager.findOne('towns', filter, { projection: { loc: 1 } });

    let currentLoc = doc?.loc; // Obtém loc se existir

    // Se não tem documento, não tem 'loc' ou 'loc' é 0 (ou inválido), atribui uma nova
    if (!currentLoc || ![1, 2, 3, 4].includes(currentLoc)) {
        const newLoc = API.utils.random(1, 4); // Usa a função random da API
        console.log(`[TownExtension] Atribuindo cidade ${newLoc} para usuário ${user_id}.`);

        // Tenta atualizar ou inserir a nova localização
        const updateResult = await DatabaseManager.updateOne(
            'towns',
            filter, // Filtro pelo user_id
            { $set: { loc: newLoc } }, // Define a nova localização
            { upsert: true } // Cria o documento se não existir
        );

        // Atualiza a contagem de população em memória (apenas se a atualização foi bem-sucedida)
        if (updateResult && (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0)) {
            const townName = townExtension.getTownNameByNum(newLoc);
            if (townName) {
                townExtension.population[townName]++;
                 console.log(`[TownExtension] População de ${townName} atualizada para ${townExtension.population[townName]}.`);
            }
        } else {
             console.error(`[ERRO][TownExtension] Falha ao salvar a nova cidade ${newLoc} para usuário ${user_id}.`);
             // Considerar retornar um valor padrão ou lançar erro? Por ora, retorna a newLoc
        }
        return newLoc;
    } else {
        // Retorna a localização existente
        return currentLoc;
    }
};

/**
 * Retorna coordenadas aleatórias dentro dos limites de uma cidade.
 * @param {number} townNum - Número da cidade (1-4).
 * @returns {Promise<object>} Objeto com { x, y }.
 */
townExtension.getPosByTownNum = async function(townNum) { // Tornada async para consistência, embora não precise
    const pos = { x: 0, y: 0 };
    switch (townNum) {
        case 1: // Nishigami
            pos.x = API.utils.random(70, 130);
            pos.y = API.utils.random(15, 40);
            break;
        case 2: // Harotec
            pos.x = API.utils.random(1580, 1650);
            pos.y = API.utils.random(60, 90);
            break;
        case 3: // Massibi
            pos.x = API.utils.random(1100, 1150);
            pos.y = API.utils.random(1120, 1150);
            break;
        case 4: // Tyris
            pos.x = API.utils.random(350, 400);
            pos.y = API.utils.random(840, 860);
            break;
        default: // Posição padrão ou erro?
             console.warn(`[TownExtension] getPosByTownNum chamado com número de cidade inválido: ${townNum}`);
             pos.x = API.utils.random(0, 100); // Posição aleatória genérica como fallback
             pos.y = API.utils.random(0, 100);
    }
    return pos;
};

/**
 * Obtém as coordenadas aleatórias da cidade atual de um usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<object>} Objeto com { x, y }.
 */
townExtension.getTownPos = async function(user_id) {
    const townNum = await townExtension.getTownNum(user_id);
    return await townExtension.getPosByTownNum(townNum);
};

/**
 * Obtém o nome da cidade de um usuário. Se não tiver, atribui uma aleatoriamente.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<string>} Nome da cidade.
 */
townExtension.getTownName = async function(user_id) {
    const townNum = await townExtension.getTownNum(user_id); // Reutiliza getTownNum que já atribui se necessário
    return townExtension.getTownNameByNum(townNum); // Usa a função de mapeamento
};

/**
 * Obtém a taxa (tax) aplicável a um usuário (baseado no status MVP).
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} A taxa (2 ou 5).
 */
townExtension.getTownTax = async function(user_id) {
    // Busca apenas o campo 'mvp' da coleção 'players'
    const doc = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { mvp: 1 } });

    // Verifica se tem MVP ativo (assumindo que mvp é timestamp > 0 ou Date > now)
    // Adapte a lógica de verificação do MVP se for diferente
    const hasActiveMvp = doc?.mvp != null && ( (typeof doc.mvp === 'number' && doc.mvp > Date.now()) || (doc.mvp instanceof Date && doc.mvp.getTime() > Date.now()) || doc.mvp === true ); // Adapte conforme necessário

    return hasActiveMvp ? 2 : 5; // Retorna 2 se tiver MVP, 5 caso contrário
};

/**
 * Converte um número de cidade para nome.
 * @param {number} townNum - Número da cidade (1-4).
 * @returns {string|undefined} Nome da cidade ou undefined se inválido.
 */
townExtension.getTownNameByNum = function(townNum) {
    return townExtension._townNames[townNum];
};

/**
 * Converte um nome de cidade (insensível a maiúsculas/minúsculas e acentos) para número.
 * @param {string} name - Nome da cidade.
 * @returns {number} Número da cidade (1-4) ou 0 se inválido.
 */
townExtension.getTownNumByName = function(name) {
    if (typeof name !== 'string') return 0;
    const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return townExtension._townNumbers[normalizedName] || 0; // Retorna 0 se não encontrar
};

module.exports = townExtension;