// _classes/api/modules/townExtension.js

// REMOVIDO: const API = require('../index');
// REMOVIDO: const DatabaseManager = API.DatabaseManager;
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
// Convertido de IIFE para uma função 'init' exportada
townExtension.init = async function() {
    // Requer a API DENTRO da função
    const API = require('../index');
    console.log("[TownExtension] Carregando população inicial do banco de dados...".yellow);
    try {
        // Busca todos os documentos que têm 'loc' definido e diferente de 0
        const filter = { loc: { $exists: true, $ne: 0, $in: [1, 2, 3, 4] } };
        // Pega apenas o campo 'loc' para otimizar
        const options = { projection: { loc: 1 } };
        // Acessa API.client.db AQUI
        const townDocs = await API.client.db.findMany('towns', filter, options);

        if (townDocs && townDocs.length > 0) {
            // Zera a população antes de recalcular
            for (const townName in this.population) { // Usa 'this'
                this.population[townName] = 0;
            }
            // Calcula a população
            for (const doc of townDocs) {
                // Usa this
                const townName = this.getTownNameByNum(doc.loc);
                if (townName && this.population.hasOwnProperty(townName)) {
                    this.population[townName]++;
                }
            }
            console.log("[TownExtension] População inicial carregada:".cyan, this.population); // Usa 'this'
        } else {
            console.warn("[TownExtension] Nenhum documento encontrado na coleção 'towns' para calcular população inicial.".yellow);
        }
    } catch (err) {
        console.error("[ERRO][TownExtension] Falha ao carregar população inicial:", err);
        // Não trava o bot, mas a população pode ficar incorreta até ser atualizada
        // Verifica se API.client existe antes de emitir erro
        if (API.client?.emit) API.client.emit('error', new Error(`TownInit Error: ${err.message}`));
    }
};

// --- Funções do Módulo ---

townExtension.getConfig = function() {
    // Retorna a config importada no topo (não precisa da API)
    return config;
};

/**
 * Obtém o número da cidade de um usuário. Se não tiver, atribui uma aleatoriamente.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Número da cidade (1-4).
 */
townExtension.getTownNum = async function(user_id) {
    // Requer a API DENTRO da função
    const API = require('../index');
    const filter = { user_id: user_id };
    // Busca apenas o campo 'loc' (Usa API.client.db)
    const doc = await API.client.db.findOne('towns', filter, { projection: { loc: 1 } });

    let currentLoc = doc?.loc; // Obtém loc se existir

    // Se não tem documento, não tem 'loc' ou 'loc' é 0 (ou inválido), atribui uma nova
    if (!currentLoc || ![1, 2, 3, 4].includes(currentLoc)) {
        // Usa API.utils
        const newLoc = API.utils.random(1, 4);
        console.log(`[TownExtension] Atribuindo cidade ${newLoc} para usuário ${user_id}.`);

        // Tenta atualizar ou inserir a nova localização (Usa API.client.db)
        const updateResult = await API.client.db.updateOne(
            'towns',
            filter, // Filtro pelo user_id
            { $set: { loc: newLoc } }, // Define a nova localização
            { upsert: true } // Cria o documento se não existir
        );

        // Atualiza a contagem de população em memória (apenas se a atualização foi bem-sucedida)
        if (updateResult && (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0)) {
            // Usa 'this'
            const townName = this.getTownNameByNum(newLoc);
            if (townName && this.population.hasOwnProperty(townName)) {
                this.population[townName]++;
                 console.log(`[TownExtension] População de ${townName} atualizada para ${this.population[townName]}.`); // Usa 'this'
            }
        } else {
             console.error(`[ERRO][TownExtension] Falha ao salvar a nova cidade ${newLoc} para usuário ${user_id}.`);
             // Considerar retornar um valor padrão ou lançar erro? Por ora, retorna a newLoc
             if (API.client?.emit) API.client.emit('error', new Error(`TownSet Error user ${user_id}`));
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
townExtension.getPosByTownNum = async function(townNum) {
    // Requer a API DENTRO da função
    const API = require('../index');
    const pos = { x: 0, y: 0 };
    // Usa API.utils
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
    // Chama getTownNum usando 'this' (que vai requerer API internamente)
    const townNum = await this.getTownNum(user_id);
    // Chama getPosByTownNum usando 'this' (que vai requerer API internamente)
    return await this.getPosByTownNum(townNum);
};

/**
 * Obtém o nome da cidade de um usuário. Se não tiver, atribui uma aleatoriamente.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<string>} Nome da cidade.
 */
townExtension.getTownName = async function(user_id) {
    // Chama getTownNum usando 'this'
    const townNum = await this.getTownNum(user_id);
    // Chama getTownNameByNum usando 'this' (não precisa da API)
    return this.getTownNameByNum(townNum);
};

/**
 * Obtém a taxa (tax) aplicável a um usuário (baseado no status MVP).
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} A taxa (2 ou 5).
 */
townExtension.getTownTax = async function(user_id) {
    // Requer a API DENTRO da função
    const API = require('../index');
    // Busca apenas o campo 'mvp' da coleção 'players' (Usa API.client.db)
    const doc = await API.client.db.findOne('players', { user_id: user_id }, { projection: { mvp: 1 } });

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
    // Não precisa da API
    return this._townNames[townNum]; // Usa 'this'
};

/**
 * Converte um nome de cidade (insensível a maiúsculas/minúsculas e acentos) para número.
 * @param {string} name - Nome da cidade.
 * @returns {number} Número da cidade (1-4) ou 0 se inválido.
 */
townExtension.getTownNumByName = function(name) {
    // Não precisa da API
    if (typeof name !== 'string') return 0;
    const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return this._townNumbers[normalizedName] || 0; // Usa 'this'
};

module.exports = townExtension;