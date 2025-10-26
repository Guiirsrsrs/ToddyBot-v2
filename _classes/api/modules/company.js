// _classes/api/modules/company.js

// REMOVIDO: const API = require('../index');
// Importa utils diretamente SE ele for usado fora das funções que requerem API
const { utils, debug, format } = require('../utils/botUtils');
const API = require('../index');
const DatabaseManager = new API.DatabaseManager();
const fs = require('fs');
const path = require('path');
require('colors'); // Para logs

/*
    Setores:
    1 - Agricultura
    2 - Exploração
    3 - Pesca
    4 - Processamento
*/

const MAX_LEVEL = 20; // Nível máximo para todos os setores
const LEVEL_MULTIPLIER = 1.2; // Multiplicador de XP para o próximo nível

class company {
    constructor(client) {
        // O construtor geralmente não precisa da API completa imediatamente,
        // mas se precisar de algo da API aqui, adicione o require aqui também.
        this.client = client; // Guarda a instância do client, se necessário
        // Carrega JSONs locais - não precisa da API
        this.sectors = {
            agriculture: {
                id: 1, name: "Agricultura", icon: '839501538356363284',
                seeds: this.loadJson('agriculture', 'seeds.json'),
                xpNeeded: this.calculateXpTable(MAX_LEVEL, 1000)
            },
            exploration: {
                id: 2, name: "Exploração", icon: '839501538308816916',
                equip: this.loadJson('exploration', 'equip.json'),
                mobs: this.loadJson('exploration', 'mobs.json'),
                drops: this.loadJson('exploration', 'drops_monsters.json'),
                xpNeeded: this.calculateXpTable(MAX_LEVEL, 1500)
            },
            fish: {
                id: 3, name: "Pesca", icon: '839501538555854848',
                rods: this.loadJson('fish', 'rods.json'),
                mobs: this.loadJson('fish', 'mobs.json'),
                xpNeeded: this.calculateXpTable(MAX_LEVEL, 1200)
            },
            process: {
                id: 4, name: "Processamento", icon: '839501538421833779',
                tools: this.loadJson('process', 'tools.json'),
                drops: this.loadJson('process', 'drops.json'),
                xpNeeded: this.calculateXpTable(MAX_LEVEL, 800)
            }
        };

        // Adia o carregamento dos jobs para um método init ou para quando for necessário,
        // ou carrega aqui SE não depender da API completa imediatamente.
        // Se this.jobs.process.load() precisar da API, mova a chamada para depois.
        // Vamos assumir que PODE precisar, então carregaremos depois via um método init.
        // this.jobs.process.load(); // Comentado por enquanto
    }

    // Método de inicialização para código que DEPENDE da API estar pronta
    async init() {
         const API = require('../index'); // Necessário se load() usar API.client.db
         await this.jobs.process.load(); // Carrega os jobs de processamento agora
    }


    loadJson(sector, fileName) {
        const p = path.join(__dirname, `../../../_json/companies/${sector}/${fileName}`);
        try {
            return JSON.parse(fs.readFileSync(p, 'utf8'));
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao carregar ${p}:`, err);
            // Tentamos obter a API aqui para emitir o erro, se possível
            try {
                 const API = require('../index');
                 if (API.client?.emit) API.client.emit('error', new Error(`LoadJson Error ${fileName}: ${err.message}`));
            } catch (apiErr) { console.error("Erro ao tentar carregar API para log:", apiErr); }
            return null;
        }
    }

    calculateXpTable(maxLevel, baseXp) {
        let xpTable = {};
        let currentXp = baseXp;
        for (let i = 1; i <= maxLevel; i++) {
            xpTable[i] = Math.floor(currentXp);
            currentXp *= LEVEL_MULTIPLIER;
        }
        return xpTable;
    }

    // --- Métodos de acesso ao Banco de Dados ---

    /**
     * Obtém os dados de uma empresa pelo ID do dono.
     * @param {string} id - ID do dono da empresa.
     * @returns {Promise<object|null>} Dados da empresa ou null.
     */
    async get(id) {
        const API = require('../index'); // Adicionado aqui
        if (!id) return null;
        try {
            let player = await API.client.db.findOne('companies', { _id: id });
            return player;
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao obter empresa ${id}:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyGet: ${err.message}`));
            return null;
        }
    }

    /**
     * Obtém todas as empresas registradas.
     * @returns {Promise<Array<object>>} Array com todas as empresas.
     */
    async getAll() {
        const API = require('../index'); // Adicionado aqui
        try {
            let companies = await API.client.db.findMany('companies', { name: { $exists: true } });
            return companies;
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao obter todas as empresas:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyGetAll: ${err.message}`));
            return [];
        }
    }

    /**
     * Obtém empresas por setor.
     * @param {number} sectorId - ID do setor (1 a 4).
     * @returns {Promise<Array<object>>} Array com empresas do setor.
     */
    async getBySector(sectorId) {
        const API = require('../index'); // Adicionado aqui
        if (!sectorId) return [];
        try {
            let companies = await API.client.db.findMany('companies', { sector: sectorId });
            return companies;
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao obter empresas por setor ${sectorId}:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyGetBySector: ${err.message}`));
            return [];
        }
    }

    /**
     * Obtém os currículos enviados para uma empresa.
     * @param {string} companyId - ID do dono da empresa.
     * @returns {Promise<Array<object>>} Array com currículos.
     */
    async getCurriculums(companyId) {
        const API = require('../index'); // Adicionado aqui
        if (!companyId) return [];
        try {
            let curriculums = await API.client.db.findMany('curriculums', { company_id: companyId });
            return curriculums;
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao obter currículos para ${companyId}:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyGetCurriculums: ${err.message}`));
            return [];
        }
    }

    /**
     * Encontra o currículo de um usuário específico.
     * @param {string} userId - ID do usuário.
     * @returns {Promise<object|null>} O currículo ou null.
     */
    async getCurriculum(userId) {
        const API = require('../index'); // Adicionado aqui
        if (!userId) return null;
        try {
            let curriculum = await API.client.db.findOne('curriculums', { user_id: userId });
            return curriculum;
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao obter currículo de ${userId}:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyGetCurriculum: ${err.message}`));
            return null;
        }
    }

    /**
     * Deleta um currículo.
     * @param {string} userId - ID do usuário.
     * @param {string} companyId - ID da empresa.
     * @returns {Promise<import('mongodb').DeleteResult|null>}
     */
    async deleteCurriculum(userId, companyId) {
        const API = require('../index'); // Adicionado aqui
        if (!userId || !companyId) return null;
        try {
            return await API.client.db.deleteOne('curriculums', { user_id: userId, company_id: companyId });
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao deletar currículo (user: ${userId}, company: ${companyId}):`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyDeleteCurriculum: ${err.message}`));
            return null;
        }
    }

    /**
     * Cria um novo currículo.
     * @param {string} userId - ID do usuário.
     * @param {string} companyId - ID da empresa.
     * @returns {Promise<import('mongodb').InsertOneResult|null>}
     */
    async createCurriculum(userId, companyId) {
        const API = require('../index'); // Adicionado aqui
        if (!userId || !companyId) return null;
        const curriculumData = {
            user_id: userId,
            company_id: companyId,
            sentAt: new Date()
        };
        try {
            return await API.client.db.insertOne('curriculums', curriculumData);
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao criar currículo (user: ${userId}, company: ${companyId}):`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyCreateCurriculum: ${err.message}`));
            return null;
        }
    }

    // --- Lógica de Jobs de Processamento (Setor 4) ---

    jobs = {
        /**
         * Objeto para gerenciar o setor de Processamento (Setor 4).
         * Mantém um cache dos itens sendo processados e atualiza o banco de dados.
         */
        process: {
            // Usa 'this' da classe 'company' para acessar o cache
            // Usa Map() diretamente ou inicializa no construtor da classe 'company'
             processing: new Map(), // Cache de itens em processamento (ID_Global: data)

            /**
             * Obtém o estado atual do processamento global (se está ou não sendo executado).
             * @returns {Promise<boolean>} True se estiver processando, false caso contrário.
             */
            get: async () => {
                 const API = require('../index'); // Adicionado aqui
                 // Usa this da classe externa? Não, precisa ser da API global
                try {
                    // Assume que API.id está disponível globalmente
                    const globalDoc = await API.client.db.findOne('globals', { _id: API.id }, { projection: { processing: 1 } });
                    return globalDoc?.processing || false;
                } catch (err) {
                    console.error("[ERRO][CompanyExt] Falha ao obter status de processamento:", err);
                    if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyGetProcessing: ${err.message}`));
                    return false;
                }
            },

            /**
             * Carrega todos os itens de processamento do banco de dados para o cache local (Map).
             * Chamado na inicialização (agora via init()).
             * USA O 'THIS' DO OBJETO 'process', PRECISA DE AJUSTE OU BIND
             */
             // Ajuste: Passar a instância da classe 'company' ou usar 'this' corretamente
             load: async (companyInstance) => { // Recebe a instância da classe 'company'
                  const API = require('../index'); // Adicionado aqui
                  const thisProcess = companyInstance.jobs.process; // Referência correta ao 'this' do 'process'
                 try {
                     let allProcessing = await API.client.db.findMany('processing', { 'data.type': 'company' });
                     thisProcess.processing.clear(); // Limpa o cache correto
                     allProcessing.forEach(item => {
                         thisProcess.processing.set(item._id, item.data); // Adiciona ao cache correto
                     });
                     // Usa botUtils diretamente importado no topo
                     debug(`[CompanyExt] Carregados ${thisProcess.processing.size} itens de processamento para o cache.`);
                 } catch (err) {
                     console.error("[ERRO][CompanyExt] Falha ao carregar itens de processamento:", err);
                     if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyLoadProcessing: ${err.message}`));
                 }
             },

            /**
             * Atualiza o estado dos itens em processamento.
             * Esta função deve ser chamada por um Ticker (ex: a cada 1 minuto).
             * USA O 'THIS' DO OBJETO 'process'
             */
             update: async (companyInstance) => { // Recebe a instância da classe 'company'
                  const API = require('../index'); // Adicionado aqui
                  const thisProcess = companyInstance.jobs.process; // Referência correta
                 const now = Date.now();
                 let itemsToRemove = [];

                 try {
                     for (const [id, data] of thisProcess.processing.entries()) { // Usa cache correto
                         if (now < data.endAt) continue;

                         const comp = await API.client.db.findOne('companies', { _id: data.company_id });
                         if (comp) {
                             // Usa companyInstance para acessar sectors
                             const dropInfo = companyInstance.sectors.process.drops[data.item_id];
                             if (!dropInfo) {
                                  console.warn(`[CompanyExt] Drop info não encontrado para item ${data.item_id} no processamento ${id}`);
                                  itemsToRemove.push(id); // Remove se o item não existe mais
                                  continue;
                             }
                             const amountProduced = data.amount_in * dropInfo.prod;

                             let currentAmount = comp.storage[dropInfo.item] || 0;
                             comp.storage[dropInfo.item] = currentAmount + amountProduced;

                             await API.client.db.updateOne('companies', { _id: comp._id }, { $set: { storage: comp.storage } });

                             // Usa botUtils importado no topo
                             debug(`[CompanyExt] Processamento concluído para ${comp.name}. Adicionado ${amountProduced} de ${dropInfo.item}.`);
                         } else {
                              console.warn(`[CompanyExt] Empresa ${data.company_id} não encontrada para concluir processamento ${id}. Item será removido.`);
                         }

                         itemsToRemove.push(id);
                     }

                     if (itemsToRemove.length > 0) {
                         for (const id of itemsToRemove) {
                             thisProcess.processing.delete(id); // Remove do cache correto
                         }
                         await API.client.db.deleteMany('processing', { _id: { $in: itemsToRemove } });
                         // Usa botUtils importado no topo
                         debug(`[CompanyExt] Removidos ${itemsToRemove.length} itens de processamento concluídos.`);
                     }

                 } catch (err) {
                     console.error("[ERRO][CompanyExt] Falha durante o update de processamento:", err);
                     if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyUpdateProcessing: ${err.message}`));
                 }
             },

            /**
             * Adiciona um novo item à fila de processamento.
             * @param {object} data - Dados do processamento (company_id, item_id, amount_in, endAt, type: 'company')
             * @returns {Promise<import('mongodb').InsertOneResult|null>}
             * USA O 'THIS' DO OBJETO 'process'
             */
             add: async (companyInstance, data) => { // Recebe a instância
                  const API = require('../index'); // Adicionado aqui
                  const thisProcess = companyInstance.jobs.process; // Referência correta
                 if (!data || data.type !== 'company') return null;

                 try {
                     // Usa API.utils importado diretamente ou via require aqui
                     const genId = require('../utils/botUtils').generateId; // Exemplo de import direto se necessário
                     const newId = genId ? genId() : Date.now().toString(); // Fallback

                     const result = await API.client.db.insertOne('processing', {
                         _id: newId,
                         data: data,
                         endAt: new Date(data.endAt)
                     });

                     if (result?.insertedId) {
                         thisProcess.processing.set(result.insertedId, data); // Adiciona ao cache correto
                         // Usa botUtils importado no topo
                         debug(`[CompanyExt] Novo item de processamento adicionado (ID: ${result.insertedId})`);
                         return result;
                     }
                     return null;
                 } catch (err) {
                     console.error("[ERRO][CompanyExt] Falha ao adicionar item de processamento:", err);
                     if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyAddProcessing: ${err.message}`));
                     return null;
                 }
             }
        }
    };

    // --- Métodos de Criação e Deleção de Empresa ---

    /**
     * Cria uma nova empresa.
     * @param {string} id - ID do dono.
     * @param {string} name - Nome da empresa.
     * @param {number} sector - ID do setor.
     * @returns {Promise<import('mongodb').UpdateResult|null>}
     */
    async create(id, name, sector) {
        const API = require('../index'); // Adicionado aqui
        if (!id || !name || !sector) return null;

        const defaultData = {
            _id: id, name: name, sector: sector, level: 1, xp: 0, money: 0,
            max_workers: 5, workers: [], storage: {}, equipment: {}, plots: {}
        };

        try {
            return await API.client.db.updateOne(
                'companies', { _id: id }, { $set: defaultData }, { upsert: true }
            );
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao criar empresa para ${id}:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyCreate: ${err.message}`));
            return null;
        }
    }

    /**
     * Deleta uma empresa.
     * @param {string} id - ID do dono da empresa.
     * @returns {Promise<import('mongodb').DeleteResult|null>}
     */
    async deleteCompany(id) {
        const API = require('../index'); // Adicionado aqui
        if (!id) return null;
        try {
            await API.client.db.deleteMany('curriculums', { company_id: id });
            return await API.client.db.deleteOne('companies', { _id: id });
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao deletar empresa ${id}:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyDelete: ${err.message}`));
            return null;
        }
    }

    // --- Métodos de Gerenciamento de Trabalhadores ---

    /**
     * Adiciona um trabalhador a uma empresa.
     * @param {string} companyId - ID do dono da empresa.
     * @param {string} userId - ID do trabalhador a adicionar.
     * @returns {Promise<import('mongodb').UpdateResult|null>}
     */
    async addWorker(companyId, userId) {
        const API = require('../index'); // Adicionado aqui
        if (!companyId || !userId) return null;
        try {
            return await API.client.db.updateOne(
                'companies', { _id: companyId }, { $addToSet: { workers: userId } }
            );
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao adicionar worker ${userId} à empresa ${companyId}:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyAddWorker: ${err.message}`));
            return null;
        }
    }

    /**
     * Remove um trabalhador de uma empresa.
     * @param {string} companyId - ID do dono da empresa.
     * @param {string} userId - ID do trabalhador a remover.
     * @returns {Promise<import('mongodb').UpdateResult|null>}
     */
    async removeWorker(companyId, userId) {
        const API = require('../index'); // Adicionado aqui
        if (!companyId || !userId) return null;
        try {
            return await API.client.db.updateOne(
                'companies', { _id: companyId }, { $pull: { workers: userId } }
            );
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao remover worker ${userId} da empresa ${companyId}:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyRemoveWorker: ${err.message}`));
            return null;
        }
    }

    // --- Métodos de Atualização de Dados da Empresa ---

    /**
     * Define um valor específico no documento da empresa.
     * @param {string} id - ID do dono da empresa.
     * @param {string} field - Campo a ser atualizado.
     * @param {*} value - Novo valor.
     * @returns {Promise<import('mongodb').UpdateResult|null>}
     */
    async set(id, field, value) {
        const API = require('../index'); // Adicionado aqui
        if (!id || !field) return null;
        try {
            return await API.client.db.updateOne(
                'companies', { _id: id }, { $set: { [field]: value } }
            );
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao definir ${field} = ${value} para empresa ${id}:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanySet: ${err.message}`));
            return null;
        }
    }

    /**
     * Incrementa um valor numérico no documento da empresa.
     * @param {string} id - ID do dono da empresa.
     * @param {string} field - Campo a ser incrementado.
     * @param {number} value - Valor a adicionar.
     * @returns {Promise<import('mongodb').UpdateResult|null>}
     */
    async increment(id, field, value) {
        const API = require('../index'); // Adicionado aqui
        if (!id || !field || value === 0) return null;
        const incValue = Number(value);
        if (isNaN(incValue)) {
            console.error(`[ERRO][CompanyExt] Tentativa de incremento não numérico: ${value}`);
            return null;
        }

        try {
            return await API.client.db.updateOne(
                'companies', { _id: id }, { $inc: { [field]: incValue } }
            );
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao incrementar ${field} por ${incValue} para empresa ${id}:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyIncrement: ${err.message}`));
            return null;
        }
    }

    /**
     * Salva o documento inteiro da empresa.
     * @param {string} id - ID do dono da empresa.
     * @param {object} data - O objeto completo da empresa a ser salvo.
     * @returns {Promise<import('mongodb').UpdateResult|null>}
     */
    async save(id, data) {
        const API = require('../index'); // Adicionado aqui
        if (!id || !data) return null;
        try {
            // Remove o _id para evitar conflito na atualização se ele estiver presente
            const updateData = { ...data }; // Cria cópia para não modificar o original
            delete updateData._id;
            return await API.client.db.updateOne(
                'companies', { _id: id }, { $set: updateData }
            );
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao salvar dados da empresa ${id}:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanySave: ${err.message}`));
            return null;
        }
    }

    // --- Métodos Específicos de Setores ---

    /**
     * Adiciona XP a uma empresa e lida com o level up.
     * @param {string} id - ID do dono da empresa.
     * @param {object} companyData - Dados atuais da empresa.
     * @param {number} amount - Quantidade de XP a adicionar.
     * @returns {Promise<{levelUp: boolean, oldLevel: number, newLevel: number}>}
     */
    async addXp(id, companyData, amount) {
         const API = require('../index'); // Adicionado aqui (para emitir erro)
        if (!companyData || !amount) return { levelUp: false, oldLevel: companyData?.level || 1, newLevel: companyData?.level || 1 };

        // Usa 'this' para acessar getSectorInfo
        const sectorInfo = this.getSectorInfo(companyData.sector);
        if (!sectorInfo) return { levelUp: false, oldLevel: companyData.level, newLevel: companyData.level };

        const oldLevel = companyData.level;
        if (oldLevel >= MAX_LEVEL) return { levelUp: false, oldLevel: oldLevel, newLevel: oldLevel };

        companyData.xp += amount;
        let xpNeeded = sectorInfo.xpNeeded[oldLevel];
        let levelUp = false;

        while (companyData.xp >= xpNeeded && companyData.level < MAX_LEVEL) {
            companyData.level += 1;
            companyData.xp -= xpNeeded;
            levelUp = true;
            if (companyData.level < MAX_LEVEL) {
                xpNeeded = sectorInfo.xpNeeded[companyData.level];
            } else {
                companyData.xp = 0;
            }
        }

        try {
            await API.client.db.updateOne(
                'companies', { _id: id }, { $set: { level: companyData.level, xp: companyData.xp } }
            );
        } catch (err) {
            console.error(`[ERRO][CompanyExt] Falha ao salvar XP/Level da empresa ${id}:`, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error CompanyAddXp: ${err.message}`));
            // Retorna o estado antes da falha no save? Ou o estado atualizado?
            // Vamos retornar o estado atualizado na memória, mas o DB pode estar inconsistente.
        }

        return { levelUp: levelUp, oldLevel: oldLevel, newLevel: companyData.level };
    }

    /**
     * Obtém as informações do setor pelo ID.
     * @param {number} sectorId - ID do setor.
     * @returns {object|null}
     */
    getSectorInfo(sectorId) {
        // Não precisa da API, usa 'this'
        switch (sectorId) {
            case 1: return this.sectors.agriculture;
            case 2: return this.sectors.exploration;
            case 3: return this.sectors.fish;
            case 4: return this.sectors.process;
            default: return null;
        }
    }
}

// Adaptação para o novo padrão: Exporta a classe, a instância será criada na API.
// A API agora precisa instanciar essa classe: new company(API.client)
module.exports = company;

// Ajuste necessário em _classes/api/index.js:
// Em vez de: company: require('./modules/company'),
// Fazer:
// const CompanyClass = require('./modules/company');
// ... e depois, após API.client ser definido:
// API.company = new CompanyClass(API.client);
// API.company.init(); // Chamar o init após instanciar