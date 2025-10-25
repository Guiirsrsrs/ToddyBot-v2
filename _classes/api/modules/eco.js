// _classes/api/modules/eco.js

// Importar API centralizada e DatabaseManager (ajustar caminhos se necessário)
const API = require('../index');
const DatabaseManager = API.DatabaseManager; // Usar a instância já criada
const fs = require('fs');
const path = require('path');
const insertLine = require('insert-line');

// --- Sistema de Pontos Temporais (TP) ---
const tp = {};

// Função auxiliar para gerar código aleatório
function randomString(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

/**
 * Obtém ou cria os dados de convite para um usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<object>} Objeto com dados de convite { code, qnt, points, usedinvite }.
 */
tp.get = async function (user_id) {
    const filter = { user_id: user_id };
    let doc = await DatabaseManager.findOne('players_utils', filter);

    let inviteData = doc?.invite; // Tenta obter os dados existentes

    if (!inviteData) {
        // Gera um novo código único (simplificado, pode haver colisões raras)
        let newCode = randomString(6);
        // Em um cenário real, você verificaria se o código já existe antes de atribuir

        inviteData = {
            code: newCode,
            qnt: 0,
            points: 0,
            usedinvite: false
        };

        // Salva os novos dados no banco de dados
        await DatabaseManager.updateOne('players_utils', filter, { $set: { invite: inviteData } }, { upsert: true });

        // Retorna os dados recém-criados
        return inviteData;
    }

    // Retorna os dados existentes
    return inviteData;
};

/**
 * Verifica se um código de convite existe e retorna o ID do dono.
 * @param {string} code - Código de convite.
 * @returns {Promise<{exists: boolean, owner: string|null}>}
 */
tp.check = async function (code) {
    // Busca otimizada diretamente pelo código
    const filter = { 'invite.code': code }; // Busca dentro do subdocumento 'invite'
    const doc = await DatabaseManager.findOne('players_utils', filter, { projection: { user_id: 1 } }); // Pega apenas o user_id

    if (doc) {
        return { exists: true, owner: doc.user_id };
    } else {
        return { exists: false, owner: null };
    }
};

/**
 * Adiciona pontos temporais a um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} pointsToAdd - Quantidade de pontos a adicionar.
 */
tp.add = async function (user_id, pointsToAdd) {
    const filter = { user_id: user_id };
    const value = Number(pointsToAdd) || 0;
    // Garante que o campo 'invite' exista antes de incrementar 'points'
    // Poderia ser feito com pipelines de agregação, mas $inc com upsert geralmente cria a estrutura.
    // Vamos garantir que 'invite' exista primeiro (get faz isso)
    await tp.get(user_id);
    await DatabaseManager.updateOne('players_utils', filter, { $inc: { 'invite.points': value } }, { upsert: true });
};

/**
 * Remove pontos temporais de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} pointsToRemove - Quantidade de pontos a remover.
 */
tp.remove = async function (user_id, pointsToRemove) {
    // Adiciona o valor negativo usando a função add
    await tp.add(user_id, -(Number(pointsToRemove) || 0));
};

/**
 * Define a quantidade exata de pontos temporais de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} pointsValue - Quantidade exata de pontos.
 */
tp.set = async function (user_id, pointsValue) {
    const filter = { user_id: user_id };
    const value = Number(pointsValue) || 0;
    // Garante que o campo 'invite' exista
    await tp.get(user_id);
    await DatabaseManager.updateOne('players_utils', filter, { $set: { 'invite.points': value } }, { upsert: true });
};


// --- Sistema de Banco ---
const bank = {};

/**
 * Obtém o saldo do banco de um usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Saldo do banco (padrão 0).
 */
bank.get = async function (user_id) {
    const doc = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { bank: 1 } });
    return doc?.bank || 0; // Retorna 0 se doc ou bank não existir
};

/**
 * Adiciona dinheiro ao banco de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} moneyToAdd - Quantidade a adicionar.
 */
bank.add = async function (user_id, moneyToAdd) {
    await DatabaseManager.increment(user_id, 'players', 'bank', moneyToAdd, 'user_id');
};

/**
 * Remove dinheiro do banco de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} moneyToRemove - Quantidade a remover.
 */
bank.remove = async function (user_id, moneyToRemove) {
    await DatabaseManager.increment(user_id, 'players', 'bank', -moneyToRemove, 'user_id');
};

/**
 * Define o saldo exato do banco de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} moneyValue - Saldo exato.
 */
bank.set = async function (user_id, moneyValue) {
    const value = parseInt(moneyValue) || 0; // Garante que é inteiro
    await DatabaseManager.set(user_id, 'players', 'bank', value, 'user_id');
};


// --- Sistema de Cristais (Points) ---
const points = {};

/**
 * Obtém a quantidade de cristais de um usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Quantidade de cristais (padrão 0).
 */
points.get = async function (user_id) {
    const doc = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { points: 1 } });
    return doc?.points || 0;
};

/**
 * Adiciona cristais a um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} pointsToAdd - Quantidade a adicionar.
 */
points.add = async function (user_id, pointsToAdd) {
    await DatabaseManager.increment(user_id, 'players', 'points', pointsToAdd, 'user_id');
};

/**
 * Remove cristais de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} pointsToRemove - Quantidade a remover.
 */
points.remove = async function (user_id, pointsToRemove) {
    await DatabaseManager.increment(user_id, 'players', 'points', -pointsToRemove, 'user_id');
};

/**
 * Define a quantidade exata de cristais de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} pointsValue - Quantidade exata.
 */
points.set = async function (user_id, pointsValue) {
    await DatabaseManager.set(user_id, 'players', 'points', Number(pointsValue) || 0, 'user_id');
};


// --- Sistema de Moedas (Money) ---
const money = {};

/**
 * Obtém a quantidade de moedas de um usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Quantidade de moedas (padrão 0).
 */
money.get = async function (user_id) {
    const doc = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { money: 1 } });
    return doc?.money || 0;
};

/**
 * Adiciona moedas a um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} moneyToAdd - Quantidade a adicionar.
 */
money.add = async function (user_id, moneyToAdd) {
    await DatabaseManager.increment(user_id, 'players', 'money', moneyToAdd, 'user_id');
};

/**
 * Adiciona moedas ao saldo global (geralmente conta do bot).
 * @param {number} moneyToAdd - Quantidade a adicionar.
 */
money.globaladd = async function (moneyToAdd) {
    // Assumindo que API.id é o ID do bot
    await money.add(API.id, moneyToAdd);
};

/**
 * Remove moedas de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} moneyToRemove - Quantidade a remover.
 */
money.remove = async function (user_id, moneyToRemove) {
    await DatabaseManager.increment(user_id, 'players', 'money', -moneyToRemove, 'user_id');
};

/**
 * Remove moedas do saldo global (geralmente conta do bot).
 * @param {number} moneyToRemove - Quantidade a remover.
 */
money.globalremove = async function (moneyToRemove) {
    // Assumindo que API.id é o ID do bot
    await money.remove(API.id, moneyToRemove);
};

/**
 * Define a quantidade exata de moedas de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} moneyValue - Quantidade exata.
 */
money.set = async function (user_id, moneyValue) {
    const value = parseInt(Math.round(moneyValue)) || 0; // Garante que é inteiro
    await DatabaseManager.set(user_id, 'players', 'money', value, 'user_id');
};


// --- Sistema de Fichas (Token) ---
const token = {};

/**
 * Obtém a quantidade de fichas de um usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Quantidade de fichas (padrão 0).
 */
token.get = async function (user_id) {
    const doc = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { token: 1 } });
    return doc?.token || 0;
};

/**
 * Adiciona fichas a um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} tokenToAdd - Quantidade a adicionar.
 */
token.add = async function (user_id, tokenToAdd) {
    await DatabaseManager.increment(user_id, 'players', 'token', tokenToAdd, 'user_id');
};

/**
 * Remove fichas de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} tokenToRemove - Quantidade a remover.
 */
token.remove = async function (user_id, tokenToRemove) {
    await DatabaseManager.increment(user_id, 'players', 'token', -tokenToRemove, 'user_id');
};

/**
 * Define a quantidade exata de fichas de um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} tokenValue - Quantidade exata.
 */
token.set = async function (user_id, tokenValue) {
    await DatabaseManager.set(user_id, 'players', 'token', Number(tokenValue) || 0, 'user_id');
};


// --- Objeto Principal Exportado ---
const eco = {
    money,
    points,
    token,
    bank,
    tp
};


// --- Funções de Histórico (Sistema de Arquivos Local) ---
// (Mantidas como antes, pois não usam o banco de dados principal)

const historyBaseDir = path.resolve(__dirname, '..', '..', '..', '_localdata/profiles/'); // Caminho base

eco.createHistoryDir = function(user_id) {
    const userDir = path.join(historyBaseDir, user_id);
    const filePath = path.join(userDir, 'history.yml');
    const initialContent = `<t:${Math.round(Date.now() / 1000)}:R> Conta criada`; // Usar timestamp Discord

    try {
        if (!fs.existsSync(historyBaseDir)) { fs.mkdirSync(historyBaseDir, { recursive: true }); }
        if (!fs.existsSync(userDir)) { fs.mkdirSync(userDir, { recursive: true }); }
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, initialContent, 'utf8');
        }
    } catch (err) {
        console.error(`[Histórico] Erro ao criar diretório/arquivo para ${user_id}:`, err);
         if (API.client?.emit) API.client.emit('error', err);
    }
};

eco.getHistory = function (user_id, n) {
    const fpath = path.join(historyBaseDir, user_id, 'history.yml');
    eco.createHistoryDir(user_id); // Garante que existe

    try {
        const content = fs.readFileSync(fpath, 'utf8');
        const lines = content.split('\n');

        if (n && API.utils.isInt(n) && n > 0 && n <= lines.length) {
            // Retorna a linha específica (índice n-1)
             return lines[n - 1].replace(/<nl>/g , "\n"); // Substitui <nl> se houver
        } else {
            // Retorna as 5 primeiras linhas ou menos se não houver 5
            return lines.slice(0, 5).join("\n").replace(/<nl>/g , "\n");
        }
    } catch (err) {
        console.error(`[Histórico] Erro ao ler histórico para ${user_id}:`, err);
        if (API.client?.emit) API.client.emit('error', err);
        return n ? 'Erro ao ler linha específica.' : 'Erro ao ler histórico.'; // Retorna mensagem de erro
    }
};

eco.addToHistory = async function (user_id, arg) {
    eco.createHistoryDir(user_id); // Garante que existe
    const fpath = path.join(historyBaseDir, user_id, 'history.yml');
    // Escapa novas linhas no argumento para evitar corromper o YML (se aplicável)
    const safeArg = String(arg).replace(/\n/g, '<nl>');
    const content = `<t:${Math.round(Date.now() / 1000)}:R> ${safeArg}`; // Usa timestamp Discord

    try {
        // Usa insert-line para adicionar no topo (linha 1)
        await insertLine(fpath).content(content).at(1);
    } catch (err) {
        console.error(`[Histórico] Erro ao adicionar ao histórico para ${user_id}:`, err);
         if (API.client?.emit) API.client.emit('error', err);
    }
};

module.exports = eco;