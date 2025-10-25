// Importar DatabaseManager e config se necessário
const DatabaseManager = require('../../manager/DatabaseManager'); // Ajuste o caminho
const dbManager = new DatabaseManager(); // Crie uma instância
// const { app } = require('../../config'); // Se precisar do app id

const dbUtils = {};

dbUtils.setCompanieInfo = async function (user_id, company, string, value, client) { // Pass client for error logging
    try {
        await dbManager.query( // Use a instância dbManager
            `INSERT INTO companies(company_id, user_id) VALUES($1, $2) ON CONFLICT (company_id) DO NOTHING;`,
            [company, user_id]
        );
        const text = `UPDATE companies SET "${string}" = $3 WHERE company_id = $1;`;
        await dbManager.query(text, [company, value]); // Use a instância dbManager
    } catch (err) {
        console.error(`Error in setCompanieInfo (user: ${user_id}, company: ${company}, field: ${string}):`, err.stack);
        if (client && client.emit) { // Check if client exists and has emit
             client.emit('error', err); // Use o client passado para emitir o erro
        }
    }
};

module.exports = dbUtils;