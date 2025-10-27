// _classes/manager/DatabaseManager.js
const { connectDB } = require('../db'); // Importa a função de conexão do MongoDB
const API = require('../api'); // Importa a API centralizada (para acesso ao client para emitir erros)
require('colors'); // Para logs coloridos

class DatabaseManager {
    constructor() {
        this.db = null; // Instância do banco de dados será armazenada aqui
        this.connectionPromise = null; // Para garantir que a conexão seja feita apenas uma vez
    }

    /**
     * NOVO MÉTODO: Força a conexão inicial e aguarda.
     * Usado pelo client.start() para garantir que o DB esteja pronto.
     * @returns {Promise<import('mongodb').Db>}
     */
    async connect() {
        if (this.db) {
            return this.db;
        }
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        // A lógica em _getDb() já é perfeita para conectar,
        // então vamos apenas chamá-la e aguardá-la.
        try {
            await this._getDb();
            console.log("[DBManager] Conexão explícita (connect()) bem-sucedida.".cyan);
            return this.db;
        } catch (err) {
            console.error("[DBManager] Falha na conexão explícita (connect()):".red, err);
            throw err; // Lança o erro para o client.start() parar o boot
        }
    }


    /**
     * Garante que a conexão com o banco de dados esteja estabelecida e retorna a instância.
     * @private
     * @returns {Promise<import('mongodb').Db>} Instância do banco de dados MongoDB.
     */
    async _getDb() {
        if (this.db) {
            return this.db;
        }
        if (this.connectionPromise) {
            // Se já existe uma promessa de conexão, aguarda ela terminar
            try {
                 await this.connectionPromise;
                 // Verifica se a conexão foi realmente estabelecida
                 if (!this.db) throw new Error("A promessa de conexão anterior falhou.");
                 return this.db;
            } catch (err) {
                 console.error("[DBManager] Erro ao aguardar promessa de conexão existente:".red, err);
                 this.connectionPromise = null; // Reseta para tentar novamente
                 // Lança o erro novamente ou tenta reconectar
                 throw err; // Ou process.exit(1);
            }
        }

        // Cria e aguarda a nova promessa de conexão
        this.connectionPromise = connectDB();
        try {
            this.db = await this.connectionPromise;
            console.log("[DBManager] Conexão com MongoDB obtida pelo Manager.".cyan);
            return this.db;
        } catch (err) {
            console.error("[DBManager] Erro fatal ao obter conexão com MongoDB no Manager:".red, err);
            this.connectionPromise = null; // Reseta a promessa em caso de erro
            // Decide se deve sair ou apenas lançar o erro
            // process.exit(1); // Descomente para sair se a conexão inicial falhar
            throw err; // Lança o erro para quem chamou saber
        }
    }

    // --- Métodos CRUD Genéricos ---

    /**
     * Encontra um único documento em uma coleção.
     * @param {string} collectionName - Nome da coleção.
     * @param {object} filter - Critérios de busca (ex: { user_id: '123' }).
     * @param {object} options - Opções adicionais do MongoDB findOne (ex: { projection: { money: 1 } }).
     * @returns {Promise<object|null>} O documento encontrado ou null.
     */
    async findOne(collectionName, filter = {}, options = {}) {
        try {
            const db = await this._getDb();
            const result = await db.collection(collectionName).findOne(filter, options);
            return result; // Retorna o documento ou null
        } catch (err) {
            console.error(`[DBManager] Erro em findOne (${collectionName}, filter: ${JSON.stringify(filter)}):`.red, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error findOne ${collectionName}: ${err.message}`));
            return null; // Retorna null em caso de erro para evitar crashar a aplicação
        }
    }

    /**
     * Encontra múltiplos documentos em uma coleção.
     * @param {string} collectionName - Nome da coleção.
     * @param {object} filter - Critérios de busca (ex: { level: { $gt: 10 } }).
     * @param {object} options - Opções adicionais do MongoDB find (ex: { sort: { level: -1 }, limit: 10 }).
     * @returns {Promise<Array<object>>} Um array com os documentos encontrados (pode ser vazio).
     */
     async findMany(collectionName, filter = {}, options = {}) {
        try {
            const db = await this._getDb();
            const cursor = db.collection(collectionName).find(filter, options);
            return await cursor.toArray();
        } catch (err) {
            console.error(`[DBManager] Erro em findMany (${collectionName}, filter: ${JSON.stringify(filter)}):`.red, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error findMany ${collectionName}: ${err.message}`));
            return []; // Retorna array vazio em caso de erro
        }
    }

    /**
     * Atualiza um único documento ou o cria se não existir (upsert).
     * @param {string} collectionName - Nome da coleção.
     * @param {object} filter - Critérios para encontrar o documento.
     * @param {object} update - Operações de atualização do MongoDB (ex: { $set: { money: 100 } }, { $inc: { xp: 10 } }).
     * @param {object} options - Opções adicionais do MongoDB updateOne (padrão: { upsert: true }).
     * @returns {Promise<import('mongodb').UpdateResult|null>} Resultado da operação ou null em caso de erro.
     */
    async updateOne(collectionName, filter, update, options = { upsert: true }) {
        try {
            const db = await this._getDb();
            const result = await db.collection(collectionName).updateOne(filter, update, options);
            return result;
        } catch (err) {
            console.error(`[DBManager] Erro em updateOne (${collectionName}, filter: ${JSON.stringify(filter)}, update: ${JSON.stringify(update)}):`.red, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error updateOne ${collectionName}: ${err.message}`));
            return null; // Retorna null em caso de erro
        }
    }

    /**
     * Atualiza múltiplos documentos que correspondem ao filtro.
     * @param {string} collectionName - Nome da coleção.
     * @param {object} filter - Critérios para encontrar os documentos.
     * @param {object} update - Operações de atualização do MongoDB.
     * @param {object} options - Opções adicionais do MongoDB updateMany.
     * @returns {Promise<import('mongodb').UpdateResult|null>} Resultado da operação ou null em caso de erro.
     */
    async updateMany(collectionName, filter, update, options = {}) {
        try {
            const db = await this._getDb();
            const result = await db.collection(collectionName).updateMany(filter, update, options);
            return result;
        } catch (err) {
            console.error(`[DBManager] Erro em updateMany (${collectionName}, filter: ${JSON.stringify(filter)}, update: ${JSON.stringify(update)}):`.red, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error updateMany ${collectionName}: ${err.message}`));
            return null;
        }
    }

    /**
     * Insere um único documento em uma coleção.
     * @param {string} collectionName - Nome da coleção.
     * @param {object} doc - O documento a ser inserido.
     * @param {object} options - Opções adicionais do MongoDB insertOne.
     * @returns {Promise<import('mongodb').InsertOneResult|null>} Resultado da operação ou null em caso de erro.
     */
     async insertOne(collectionName, doc, options = {}) {
        try {
            const db = await this._getDb();
            const result = await db.collection(collectionName).insertOne(doc, options);
            return result;
        } catch (err) {
            console.error(`[DBManager] Erro em insertOne (${collectionName}):`.red, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error insertOne ${collectionName}: ${err.message}`));
            return null;
        }
    }

    /**
     * Insere múltiplos documentos em uma coleção.
     * @param {string} collectionName - Nome da coleção.
     * @param {Array<object>} docs - Array de documentos a serem inseridos.
     * @param {object} options - Opções adicionais do MongoDB insertMany.
     * @returns {Promise<import('mongodb').InsertManyResult|null>} Resultado da operação ou null em caso de erro.
     */
    async insertMany(collectionName, docs, options = {}) {
        if (!Array.isArray(docs) || docs.length === 0) return null; // Não insere array vazio
        try {
            const db = await this._getDb();
            const result = await db.collection(collectionName).insertMany(docs, options);
            return result;
        } catch (err) {
            console.error(`[DBManager] Erro em insertMany (${collectionName}):`.red, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error insertMany ${collectionName}: ${err.message}`));
            return null;
        }
    }

     /**
      * Deleta um único documento que corresponde ao filtro.
      * @param {string} collectionName - Nome da coleção.
      * @param {object} filter - Critérios para encontrar o documento a ser deletado.
      * @param {object} options - Opções adicionais do MongoDB deleteOne.
      * @returns {Promise<import('mongodb').DeleteResult|null>} Resultado da operação ou null em caso de erro.
      */
     async deleteOne(collectionName, filter, options = {}) {
         try {
             const db = await this._getDb();
             const result = await db.collection(collectionName).deleteOne(filter, options);
             return result;
         } catch (err) {
             console.error(`[DBManager] Erro em deleteOne (${collectionName}, filter: ${JSON.stringify(filter)}):`.red, err);
             if (API.client?.emit) API.client.emit('error', new Error(`DB Error deleteOne ${collectionName}: ${err.message}`));
             return null;
         }
     }

    /**
     * Deleta múltiplos documentos que correspondem ao filtro.
     * @param {string} collectionName - Nome da coleção.
     * @param {object} filter - Critérios para encontrar os documentos a serem deletados.
     * @param {object} options - Opções adicionais do MongoDB deleteMany.
     * @returns {Promise<import('mongodb').DeleteResult|null>} Resultado da operação ou null em caso de erro.
     */
    async deleteMany(collectionName, filter, options = {}) {
        try {
            const db = await this._getDb();
            const result = await db.collection(collectionName).deleteMany(filter, options);
            return result;
        } catch (err) {
            console.error(`[DBManager] Erro em deleteMany (${collectionName}, filter: ${JSON.stringify(filter)}):`.red, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error deleteMany ${collectionName}: ${err.message}`));
            return null;
        }
    }

    /**
     * Executa uma agregação no MongoDB.
     * @param {string} collectionName - Nome da coleção.
     * @param {Array<object>} pipeline - O pipeline de agregação.
     * @param {object} options - Opções adicionais do MongoDB aggregate.
     * @returns {Promise<Array<object>>} Um array com os resultados da agregação.
     */
    async aggregate(collectionName, pipeline = [], options = {}) {
        try {
            const db = await this._getDb();
            const cursor = db.collection(collectionName).aggregate(pipeline, options);
            return await cursor.toArray();
        } catch (err) {
            console.error(`[DBManager] Erro em aggregate (${collectionName}):`.red, err);
            if (API.client?.emit) API.client.emit('error', new Error(`DB Error aggregate ${collectionName}: ${err.message}`));
            return []; // Retorna array vazio em caso de erro
        }
    }

    // --- Métodos Adaptados da Interface Antiga ---
    // (Estes métodos serão usados pela API, ex: API.db.get, API.db.set)

    /**
     * Obtém um documento por ID (geralmente user_id ou server_id).
     * Retorna null se não encontrado. O código chamador deve lidar com a criação de padrão.
     * @param {string|number} id - O ID a ser buscado.
     * @param {string} collectionName - Nome da coleção.
     * @param {string} idField - Nome do campo que armazena o ID (padrão: 'user_id').
     * @returns {Promise<object|null>} O documento encontrado ou null.
     */
    async get(id, collectionName, idField = 'user_id') {
         // Considere converter 'id' para o tipo correto se necessário (ex: Number(id))
         const filter = { [idField]: id };
         const doc = await this.findOne(collectionName, filter);
         if (!doc) {
             // Não retorna mais objeto padrão aqui. Código chamador decide.
             // console.warn(`[DBManager] Documento não encontrado para ${idField}=${id} em ${collectionName}. Retornando null.`);
             return null;
         }
         return doc;
    }

     /**
      * Define o valor de um campo específico em um documento, criando o documento se não existir.
      * @param {string|number} id - O ID do documento.
      * @param {string} collectionName - Nome da coleção.
      * @param {string} field - O nome do campo a ser definido.
      * @param {*} value - O valor a ser definido no campo.
      * @param {string} idField - Nome do campo que armazena o ID (padrão: 'user_id').
      * @returns {Promise<import('mongodb').UpdateResult|null>} Resultado da operação ou null em caso de erro.
      */
     async set(id, collectionName, field, value, idField = 'user_id') {
         // Considere converter 'id' para o tipo correto se necessário
         const filter = { [idField]: id };
         const update = { $set: { [field]: value } };
         // upsert: true é o padrão para updateOne nesta classe
         return await this.updateOne(collectionName, filter, update);
     }

     /**
      * Incrementa (ou decrementa) o valor numérico de um campo, criando o documento se não existir.
      * @param {string|number} id - O ID do documento.
      * @param {string} collectionName - Nome da coleção.
      * @param {string} field - O nome do campo numérico a ser incrementado.
      * @param {number} value - O valor a ser adicionado (pode ser negativo para decrementar).
      * @param {string} idField - Nome do campo que armazena o ID (padrão: 'user_id').
      * @returns {Promise<import('mongodb').UpdateResult|null>} Resultado da operação ou null em caso de erro.
      */
     async increment(id, collectionName, field, value, idField = 'user_id') {
         // Considere converter 'id' para o tipo correto se necessário
         const filter = { [idField]: id };
         const incrementValue = Number(value); // Garante que é um número
         if (isNaN(incrementValue)) {
             console.error(`[DBManager] Tentativa de incrementar campo '${field}' com valor não numérico '${value}' em ${collectionName} para ID ${id}. Ignorando.`);
             return null; // Ou lançar um erro mais específico
         }
         const update = { $inc: { [field]: incrementValue } };
         // upsert: true é o padrão para updateOne nesta classe
         return await this.updateOne(collectionName, filter, update);
     }
}

module.exports = DatabaseManager;