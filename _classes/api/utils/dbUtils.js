// _classes/api/utils/dbUtils.js

const API = require('../index');
// CRIAR INSTÂNCIA LOCAL
const DatabaseManager = new API.DatabaseManager();
require('colors');

const dbUtils = {};

dbUtils.setCompanieInfo = async function (user_id, company_id, field, value, client) {
    if (!user_id || !company_id || typeof field !== 'string' || field === '') {
        console.error(`[ERRO][dbUtils.setCompanieInfo] Parâmetros inválidos.`);
        return null;
    }

    try {
        const filter = { company_id: company_id };
        const update = {
             $set: { [field]: value },
             $setOnInsert: {
                 user_id: user_id,
                 created_at: new Date(),
             }
         };

        const result = await DatabaseManager.updateOne('companies', filter, update, { upsert: true });

        if (!result) {
            console.error(`[ERRO][dbUtils.setCompanieInfo] Operação retornou null.`.red);
            return null;
        }
        
        return result;

    } catch (err) {
        console.error(`[ERRO][dbUtils.setCompanieInfo] (company: ${company_id}, field: ${field}):`.red, err.stack);
        if (client?.emit) { client.emit('error', new Error(`DB Error setCompanieInfo: ${err.message}`)); }
        return null;
    }
};

module.exports = dbUtils;