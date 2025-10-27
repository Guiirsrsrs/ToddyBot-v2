// _classes/api/modules/company.js

const API = require('../index');
// REMOVIDO: Instância local do DatabaseManager
// const DatabaseManager = new API.DatabaseManager(); 
require('colors');

// Carregar dados JSON estáticos das empresas
const companyData = {
    seeds: require('../../../_json/companies/agriculture/seeds.json'),
    explorationDrops: require('../../../_json/companies/exploration/drops_monsters.json'),
    explorationEquip: require('../../../_json/companies/exploration/equip.json'),
    explorationMobs: require('../../../_json/companies/exploration/mobs.json'),
    fishMobs: require('../../../_json/companies/fish/mobs.json'),
    fishRods: require('../../../_json/companies/fish/rods.json'),
    processDrops: require('../../../_json/companies/process/drops.json'),
    processTools: require('../../../_json/companies/process/tools.json'),
};

const company = {};

// --- Configurações e Dados Estáticos ---
company.e = { "Agricultura": { icon: '🌾' }, "Exploração": { icon: '🌎' }, "Pesca": { icon: '🎣' }, "Processamento": { icon: '🔨' } };
company.types = { 1: "Agricultura", 2: "Exploração", 3: "Pesca", 4: "Processamento" };
company.max = { workers: 10, storage: 50, landplots: 10 };
company.prices = {
    // (Preços de upgrade e criação)
    create: 500000,
    storage: { base: 25000, increase: 1.15 }, // Preço = base * (increase ^ (level-1))
    worker: { base: 75000, increase: 1.25 }
};
company.cooldowns = {
    work: 60 * 60, // 1 hora
    process: 3 * 60 * 60, // 3 horas
};

// --- Sub-módulos ---
company.get = {};
company.check = {};
company.create = {};
company.delete = {};
company.upgrade = {};
company.work = {};
company.utils = {};

// --- Funções 'get' (Leitura do DB) ---

/**
 * Obtém os dados de uma empresa pelo ID do dono (user_id).
 * @param {string} user_id - ID do usuário dono.
 * @returns {Promise<object|null>} Documento da empresa ou null.
 */
company.get.companyByOwnerId = async function(user_id) {
    // ALTERADO: Usando API.db
    return await API.db.findOne('companies', { user_id: user_id });
};

/**
 * Obtém os dados de uma empresa pelo seu ID único (company_id).
 * @param {string} company_id - ID da empresa.
 * @returns {Promise<object|null>} Documento da empresa ou null.
 */
company.get.companyById = async function(company_id) {
    // ALTERADO: Usando API.db
    return await API.db.findOne('companies', { company_id: company_id });
};

/**
 * Obtém os dados de um trabalhador pelo ID do usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<object|null>} Documento 'players' (com projeção) ou null.
 */
company.get.workerById = async function(user_id) {
    // ALTERADO: Usando API.db e método 'get'
    // O 'get' do DatabaseManager já retorna o documento 'players'
    const workerData = await API.db.get(user_id, 'players'); 
    if (workerData && workerData.company) {
        return workerData; // Retorna o pobj
    }
    return null;
};

/**
 * Lista todas as empresas de um determinado tipo.
 * @param {number} type - Tipo da empresa (1-4).
 * @returns {Promise<Array<object>>} Array de documentos das empresas.
 */
company.get.companiesByType = async function(type) {
    // ALTERADO: Usando API.db
    return await API.db.findMany('companies', { type: type });
};

/**
 * Obtém os dados estáticos (JSON) de um tipo de empresa.
 * @param {number} type - Tipo da empresa (1-4).
 * @returns {object} Objeto com os dados JSON.
 */
company.get.dataByType = function(type) {
    switch (type) {
        case 1: // Agricultura
            return { seeds: companyData.seeds };
        case 2: // Exploração
            return { drops: companyData.explorationDrops, equip: companyData.explorationEquip, mobs: companyData.explorationMobs };
        case 3: // Pesca
            return { mobs: companyData.fishMobs, rods: companyData.fishRods };
        case 4: // Processamento
            return { drops: companyData.processDrops, tools: companyData.processTools };
        default:
            return {};
    }
};

// --- Funções 'check' (Validação) ---

/**
 * Verifica se um usuário já possui uma empresa.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<boolean>}
 */
company.check.hasCompany = async function(user_id) {
    // ALTERADO: Usando API.db
    const doc = await API.db.findOne('companies', { user_id: user_id }, { projection: { _id: 1 } });
    return !!doc; // Retorna true se 'doc' não for nulo
};

/**
 * Verifica se um usuário é funcionário de alguma empresa.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<boolean>}
 */
company.check.isWorker = async function(user_id) {
    // ALTERADO: Usando API.db e método 'get'
    const workerData = await API.db.get(user_id, 'players'); // Busca pobj
    return !!workerData?.company; // Retorna true se pobj.company existir
};

// --- Funções 'create' e 'delete' (Escrita no DB) ---

/**
 * Cria uma nova empresa.
 * @param {string} user_id - ID do dono.
 * @param {string} name - Nome da empresa.
 * @param {number} type - Tipo da empresa (1-4).
 * @returns {Promise<object|null>} O documento da empresa criada ou null.
 */
company.create.newCompany = async function(user_id, name, type) {
    const newCompanyId = new API.ObjectId().toString(); // Gera um ID único do MongoDB
    const companyDoc = {
        _id: new API.ObjectId(),
        company_id: newCompanyId,
        user_id: user_id,
        name: name,
        type: type,
        created_at: new Date(),
        level: 1,
        xp: 0,
        money: 0,
        max_workers: 3,
        max_storage: 100,
        workers: [], // Array de IDs de usuários
        storage: [], // Array de itens
        // Campos específicos por tipo
        ...(type === 1 && { landplots: 1, lands: [] }), // Agricultura
        ...(type === 4 && { process: [] }), // Processamento
    };

    try {
        // ALTERADO: Usando API.db
        const result = await API.db.insertOne('companies', companyDoc);
        if (result && result.insertedId) {
            return companyDoc; // Retorna o documento recém-criado
        }
        return null;
    } catch (err) {
        console.error(`[ERRO][company.create.newCompany] Falha ao inserir empresa para ${user_id}:`.red, err);
        if (API.client?.emit) API.client.emit('error', err);
        return null;
    }
};

/**
 * Deleta uma empresa.
 * @param {string} company_id - ID da empresa.
 * @returns {Promise<boolean>} True se deletado com sucesso.
 */
company.delete.company = async function(company_id) {
    try {
        // ALTERADO: Usando API.db
        const result = await API.db.deleteOne('companies', { company_id: company_id });
        return result && result.deletedCount > 0;
    } catch (err) {
        console.error(`[ERRO][company.delete.company] Falha ao deletar ${company_id}:`.red, err);
        if (API.client?.emit) API.client.emit('error', err);
        return false;
    }
};

// --- Funções de 'upgrade' (Modificação no DB) ---

/**
 * Calcula o custo de um upgrade (trabalhadores ou estoque).
 * @param {string} type - 'worker' ou 'storage'.
 * @param {number} currentLevel - Nível atual (ex: pobj.max_workers).
 * @returns {number} Custo do upgrade.
 */
company.upgrade.getPrice = function(type, currentLevel) {
    let base, increase, level;
    if (type === 'worker') {
        base = company.prices.worker.base;
        increase = company.prices.worker.increase;
        level = currentLevel - company.max.workers; // Nível relativo
    } else { // storage
        base = company.prices.storage.base;
        increase = company.prices.storage.increase;
        level = (currentLevel / 10) - company.max.storage; // Nível relativo
    }
    level = Math.max(0, level); // Garante que não seja negativo
    return Math.floor(base * Math.pow(increase, level));
};

/**
 * Realiza o upgrade de trabalhadores.
 * @param {string} company_id - ID da empresa.
 * @param {number} currentMax - Nível atual.
 * @param {number} cost - Custo do upgrade.
 * @returns {Promise<boolean>}
 */
company.upgrade.workers = async function(company_id, currentMax, cost) {
    if (currentMax >= 10) return false; // Limite máximo
    const filter = { company_id: company_id };
    const update = { 
        $inc: { 
            max_workers: 1, 
            money: -cost // Subtrai o custo do caixa da empresa
        } 
    };
    // ALTERADO: Usando API.db
    const result = await API.db.updateOne('companies', filter, update);
    return result && result.modifiedCount > 0;
};

/**
 * Realiza o upgrade de armazenamento.
 * @param {string} company_id - ID da empresa.
 * @param {number} currentMax - Nível atual.
 * @param {number} cost - Custo do upgrade.
 * @returns {Promise<boolean>}
 */
company.upgrade.storage = async function(company_id, currentMax, cost) {
    if (currentMax >= 50) return false; // Limite máximo
    const filter = { company_id: company_id };
    const update = { 
        $inc: { 
            max_storage: 10, // Aumenta de 10 em 10
            money: -cost // Subtrai o custo do caixa da empresa
        } 
    };
    // ALTERADO: Usando API.db
    const result = await API.db.updateOne('companies', filter, update);
    return result && result.modifiedCount > 0;
};


// --- Funções de 'work' (Lógica de trabalho) ---
// (Estas funções são mais complexas e envolvem múltiplos acessos ao DB)

/**
 * Adiciona um trabalhador a uma empresa.
 * @param {string} user_id - ID do usuário (trabalhador).
 * @param {string} company_id - ID da empresa.
 * @returns {Promise<boolean>}
 */
company.work.addWorker = async function(user_id, company_id) {
    const filter = { company_id: company_id };
    const update = { $push: { workers: user_id } }; // Adiciona ID ao array 'workers'
    
    // ALTERADO: Usando API.db
    const companyResult = await API.db.updateOne('companies', filter, update);
    
    if (companyResult && companyResult.modifiedCount > 0) {
        // Agora atualiza o pobj (players)
        // ALTERADO: Usando API.db.set
        await API.db.set(user_id, 'players', 'company', company_id, 'user_id');
        return true;
    }
    return false;
};

/**
 * Remove um trabalhador de uma empresa.
 * @param {string} user_id - ID do usuário (trabalhador).
 * @param {string} company_id - ID da empresa.
 * @returns {Promise<boolean>}
 */
company.work.removeWorker = async function(user_id, company_id) {
    const filter = { company_id: company_id };
    const update = { $pull: { workers: user_id } }; // Remove ID do array 'workers'
    
    // ALTERADO: Usando API.db
    const companyResult = await API.db.updateOne('companies', filter, update);
    
    if (companyResult && companyResult.modifiedCount > 0) {
        // Agora atualiza o pobj (players)
        // ALTERADO: Usando API.db.set
        await API.db.set(user_id, 'players', 'company', null, 'user_id'); // Define como null
        return true;
    }
    // Caso o trabalhador não esteja no array mas precise ser removido do pobj
    // ALTERADO: Usando API.db.set
    await API.db.set(user_id, 'players', 'company', null, 'user_id');
    return true; // Retorna true mesmo se ele já não estava no array
};


// --- Funções 'utils' (Utilitários) ---

/**
 * Adiciona XP a uma empresa.
 * @param {string} company_id - ID da empresa.
 * @param {number} xpToAdd - Quantidade de XP.
 * @returns {Promise<void>}
 */
company.utils.addXp = async function(company_id, xpToAdd) {
    const filter = { company_id: company_id };
    const update = { $inc: { xp: xpToAdd } };
    // ALTERADO: Usando API.db
    await API.db.updateOne('companies', filter, update, { upsert: false }); // Não criar se não existir
};

/**
 * Adiciona dinheiro ao caixa da empresa.
 * @param {string} company_id - ID da empresa.
 * @param {number} moneyToAdd - Quantidade de dinheiro.
 * @returns {Promise<void>}
 */
company.utils.addMoney = async function(company_id, moneyToAdd) {
    const filter = { company_id: company_id };
    const update = { $inc: { money: moneyToAdd } };
    // ALTERADO: Usando API.db
    await API.db.updateOne('companies', filter, update, { upsert: false });
};

/**
 * Remove dinheiro do caixa da empresa.
 * @param {string} company_id - ID da empresa.
 * @param {number} moneyToRemove - Quantidade.
 * @returns {Promise<void>}
 */
company.utils.removeMoney = async function(company_id, moneyToRemove) {
    await company.utils.addMoney(company_id, -moneyToRemove); // Reutiliza addMoney com valor negativo
};

/**
 * Adiciona um item ao armazenamento da empresa.
 * @param {string} company_id - ID da empresa.
 * @param {object} item - Objeto do item a ser adicionado.
 * @returns {Promise<boolean>}
 */
company.utils.addItem = async function(company_id, item) {
    const filter = { company_id: company_id };
    const update = { $push: { storage: item } };
    // ALTERADO: Usando API.db
    const result = await API.db.updateOne('companies', filter, update);
    return result && result.modifiedCount > 0;
};

/**
 * Remove um item do armazenamento da empresa (requer lógica mais complexa,
 * pois $pull pode remover múltiplos itens iguais).
 * Esta função é simplificada e pode precisar de ajustes para itens não únicos.
 * @param {string} company_id - ID da empresa.
 * @param {object} item - Objeto do item a ser removido.
 * @returns {Promise<boolean>}
 */
company.utils.removeItem = async function(company_id, item) {
    const filter = { company_id: company_id };
    // CUIDADO: $pull remove TODAS as instâncias que batem com o objeto.
    // Para remover apenas um, seria necessária uma lógica de aggregate ou findAndModify.
    // Assumindo que o objeto 'item' é único ou que remover todos é o desejado.
    const update = { $pull: { storage: item } };
    // ALTERADO: Usando API.db
    const result = await API.db.updateOne('companies', filter, update);
    return result && result.modifiedCount > 0;
};

module.exports = company;