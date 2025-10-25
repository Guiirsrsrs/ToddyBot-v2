// _classes/api/utils/dbUtils.js

const DatabaseManager = require('../../manager/DatabaseManager'); // Caminho Correto
const dbManager = new DatabaseManager(); // Instância local
require('colors'); // Para logs

const dbUtils = {};

/**
 * Define ou atualiza um campo específico em um documento da coleção 'companies'.
 * Garante que 'user_id' e 'created_at' sejam definidos na criação via upsert.
 * @param {string} user_id - ID do dono (usado no $setOnInsert).
 * @param {string} company_id - ID da empresa (chave primária para filtro).
 * @param {string} field - Nome do campo a ser atualizado (deve ser validado!).
 * @param {*} value - Novo valor para o campo.
 * @param {Client} client - Instância do cliente Discord (para log de erros).
 * @returns {Promise<import('mongodb').UpdateResult|null>} Resultado da operação ou null em caso de erro.
 */
dbUtils.setCompanieInfo = async function (user_id, company_id, field, value, client) {
    // Validar entradas básicas
    if (!user_id || !company_id || typeof field !== 'string' || field === '') {
        console.error(`[ERRO][dbUtils.setCompanieInfo] Parâmetros inválidos: user_id, company_id e field (string não vazia) são obrigatórios.`);
        return null;
    }

    // --- Validação Opcional Rigorosa do Campo (IMPORTANTE PARA SEGURANÇA) ---
    /*
    const allowedCompanyFields = [
        'name', 'loc', 'type', 'score', 'funcmax', 'openvacancie',
        'workers', 'description', // Adicione outros campos que podem ser definidos por esta função
    ];
    if (!allowedCompanyFields.includes(field)) {
        console.error(`[ERRO][dbUtils.setCompanieInfo] Tentativa de atualizar campo não permitido: ${field}`.red);
        if (client?.emit) client.emit('error', new Error(`Tentativa de atualizar campo inválido via setCompanieInfo: ${field}`));
        return null; // Não executa a atualização
    }
    */
   // --- Fim da Validação Opcional ---

    try {
        const filter = { company_id: company_id }; // Filtro principal
        const update = {
             $set: { [field]: value }, // Define/Atualiza o campo específico
             // Define 'user_id' e 'created_at' APENAS se o documento for CRIADO (upsert)
             $setOnInsert: {
                 user_id: user_id,
                 created_at: new Date(),
                 // Adicione outros valores padrão $setOnInsert aqui, se aplicável
                 // Ex: score: 0, workers: [], funcmax: 3, openvacancie: true
             }
         };

        // Executa a operação updateOne com upsert habilitado
        const result = await dbManager.updateOne('companies', filter, update, { upsert: true });

        // Verifica o resultado da operação
        if (!result) {
            // Isso geralmente indica um erro na chamada ao dbManager.updateOne
            console.error(`[ERRO][dbUtils.setCompanieInfo] Operação updateOne retornou null para ${company_id}, field ${field}.`.red);
            return null;
        } else if (!(result.modifiedCount > 0 || result.upsertedId)) { // Verifica se modificou OU inseriu (upsertedId)
            // Log apenas se a operação foi reconhecida mas nada mudou/foi inserido
            // Isso pode ser normal se o valor já era o mesmo
            if (result.acknowledged && result.matchedCount > 0) {
                 // console.warn(`[dbUtils.setCompanieInfo] Update não modificou documento para ${company_id}, field ${field} (valor pode já ser o mesmo).`.grey);
            } else if (result.acknowledged && result.matchedCount === 0 && !result.upsertedId) {
                 // Situação estranha: upsert era true, mas não encontrou e não inseriu?
                 console.error(`[ERRO][dbUtils.setCompanieInfo] Upsert falhou para ${company_id}, field ${field}.`.red);
            } else if (!result.acknowledged) {
                 console.error(`[ERRO][dbUtils.setCompanieInfo] Operação updateOne não foi reconhecida pelo DB para ${company_id}, field ${field}.`.red);
            }
        } else {
             // Log de sucesso opcional
             // if (result.upsertedId) console.log(`[dbUtils.setCompanieInfo] Documento para ${company_id} criado com campo '${field}'.`.green);
             // else console.log(`[dbUtils.setCompanieInfo] Campo '${field}' atualizado para ${company_id}.`.green);
        }
        return result; // Retorna o resultado da operação

    } catch (err) {
        console.error(`[ERRO][dbUtils.setCompanieInfo] (company: ${company_id}, field: ${field}):`.red, err.stack);
        if (client?.emit) { client.emit('error', new Error(`DB Error setCompanieInfo: ${err.message}`)); }
        return null; // Retorna null em caso de erro
    }
};

module.exports = dbUtils;