// _classes/api/utils/botUtils.js

const { EmbedBuilder } = require('discord.js');
const discordJsVersion = require('discord.js').version;
const DatabaseManager = require('../../manager/DatabaseManager'); // Caminho Correto
const dbManager = new DatabaseManager(); // Instância local
const { app } = require('../../config'); // Caminho Correto
const path = require('path'); // Necessário para path.resolve em drawText
const opentype = require("opentype.js"); // Necessário para drawText
require('colors'); // Para logs

const botUtils = {};

// --- Funções Utilitárias ---

botUtils.uptime = function() {
    let uptime = process.uptime(), days = Math.floor((uptime % 31536000) / 86400), hours = Math.floor((uptime % 86400) / 3600), minutes = Math.floor((uptime % 3600) / 60), seconds = Math.round(uptime % 60);
    // Formata a string de uptime
    let parts = [];
    if (days > 0) parts.push(`${days} dia${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hora${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minuto${minutes > 1 ? 's' : ''}`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} segundo${seconds !== 1 ? 's' : ''}`); // Mostra segundos se for a única unidade ou > 0
    return parts.join(', '); // Junta com vírgulas
};

/**
 * Gera um Embed com informações sobre o bot.
 * @param {Client} client - A instância do cliente Discord.
 * @param {object} apiState - Objeto contendo estado da API { lastsave, cmdsexec, playerscmds, cacheLists, version }.
 * @returns {Promise<EmbedBuilder>} Embed com as informações.
 */
botUtils.getBotInfoProperties = async function(client, apiState = {}) { // Adiciona valor padrão para apiState
    // Função interna para formatar bytes
    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes'; // Trata null ou 0
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        // Garante que i esteja dentro dos limites do array
        const index = Math.max(0, Math.min(i, sizes.length - 1));
        return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
    }

    let dbsize = 'N/A';
    try {
        // Tenta obter estatísticas do MongoDB
        const db = await dbManager._getDb(); // Obtém a instância do DB
        if (db) {
            // Verifica se o usuário tem permissão para db.stats() (pode falhar em alguns ambientes)
            const dbStats = await db.stats({ scale: 1 }).catch(() => null); // scale: 1 para bytes
            dbsize = dbStats ? formatBytes(dbStats.storageSize) : 'N/A'; // Usa storageSize
        }
    } catch (dbError) { console.warn("Aviso ao obter tamanho do DB MongoDB:", dbError.message); } // Aviso em vez de erro

    // Busca globals diretamente via dbManager, tratando null
    const globalsObj = await dbManager.findOne('globals', { _id: app.id }) || { totalcmd: 0 };

    const embed = new EmbedBuilder();
    // Garante que client e client.user existem antes de aceder a username
    embed.setTitle(`Bot Status: ${client?.user?.username || 'Nisruksha'}`); // Nome padrão
    embed.setColor('Blue');

    embed.addFields(
        { name: `🕐 Online Há`, value: `\`${botUtils.uptime()}\``, inline: true },
        { name: `💾 Último Save`, value: `\`${apiState.lastsave || 'N/A'}\``, inline: true },
        { name: `📓 Comandos (Sessão/Total)`, value: `\`${apiState.cmdsexec || 0}\` / \`${globalsObj.totalcmd || 0}\``, inline: true }
    );

    // Acessa cacheLists através do apiState, tratando undefined
    const cacheLists = apiState.cacheLists || {};
    const miningLength = cacheLists.waiting?.length('mining') || 0;
    const huntingLength = cacheLists.waiting?.length('hunting') || 0;
    const collectingLength = cacheLists.waiting?.length('collecting') || 0;
    const fishingLength = cacheLists.waiting?.length('fishing') || 0;
    const rememberSize = cacheLists.remember?.get()?.size || 0;

    embed.addFields(
        { name: `👥 Usuários Ativos (Sessão)`, value: `\`${apiState.playerscmds?.length || 0}\``, inline: true },
        { name: `🎮 Atividades Atuais`, value: `Min.: \`${miningLength}\` Caça: \`${huntingLength}\` Col.: \`${collectingLength}\` Pesca: \`${fishingLength}\` Lemb.: \`${rememberSize}\``, inline: true }, // Mais compacto
        { name: `📎 Versões`, value: `Node: \`${process.versions.node}\` D.js: \`v${discordJsVersion}\` Bot: \`v${apiState.version || 'N/A'}\``, inline: true }
    );

    let owner = { tag: 'N/A' };
    try {
        // Busca o owner apenas se o client estiver pronto
        if(client?.isReady()) owner = await client.users.fetch('422002630106152970');
    } catch { /* Ignora erro se não encontrar */ }

    embed.addFields({
        name: `<:list:736274028179750922> Detalhes Técnicos`,
        value: `Ping API: \`${client?.ws?.ping ?? 0} ms\` Memória: \`${formatBytes(process.memoryUsage().rss)}\` DB Size: \`${dbsize}\` Servidores: \`${client?.guilds?.cache?.size ?? 0}\` Fundador: \`${owner.tag}\``,
        inline: false
    });
    embed.setTimestamp();
    return embed;
};


botUtils.random = function(min, max, doubled) {
    min = Number(min); max = Number(max);
    if (isNaN(min) || isNaN(max)) return 0;
    if (doubled) return min + (max - min) * Math.random();
    max = Math.floor(max); min = Math.floor(min);
    if (min > max) [min, max] = [max, min]; // Corrige se min > max
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

botUtils.isInt = function(value) {
    // Verifica null, undefined, string vazia, e se é número finito inteiro
    return value !== null && value !== '' && Number.isFinite(value) && Math.floor(value) === value;
};

botUtils.isOdd = function(n) {
   if (!botUtils.isInt(n)) return false;
   return Math.abs(n % 2) === 1;
};

botUtils.clone = function(obj) {
    // Deep clone simples para objetos serializáveis JSON
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) {
        // Fallback superficial
        if (null == obj || "object" != typeof obj) return obj;
        var copy = obj.constructor();
        for (var attr in obj) { if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr]; }
        return copy;
    }
};

// Função para obter argumentos múltiplos de comandos de MENSAGEM (não slash)
botUtils.getMultipleArgs = function(message, index) { // Alterado para receber 'message'
    // Precisa do prefixo para funcionar corretamente
    const prefix = require('../../config').prefix || '/'; // Obtém prefixo da config
    if (!message || !message.content || typeof index !== 'number' || index < 0 || !message.content.startsWith(prefix)) return "";

    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const commandName = args.shift()?.toLowerCase(); // Remove o nome do comando

    if (index >= args.length) return ""; // Índice fora dos limites dos argumentos
    return args.slice(index).join(" "); // Junta os argumentos a partir do índice
};


// Função para desenhar texto usando opentype (requer caminho relativo correto para fontes)
botUtils.drawText = function (ctx, text, fontSize, fontRelativePath, fontColor, x, y, align = 0) {
    if (!ctx || !text || !fontRelativePath) {
         console.warn("[botUtils.drawText] Contexto, texto ou caminho da fonte faltando.");
         return; // Sai se faltar algo essencial
    }
    try {
        // Resolve caminho absoluto da fonte a partir da RAIZ do projeto
        const fontAbsolutePath = path.resolve(__dirname, '..', '..', '..', fontRelativePath); // Ex: ../../../resources/fonts/MyFont.ttf
        // console.log(`[drawText] Loading font from: ${fontAbsolutePath}`); // Log de depuração

        // Verifica se o arquivo da fonte existe antes de tentar carregar
        if (!fs.existsSync(fontAbsolutePath)) {
            throw new Error(`Arquivo da fonte não encontrado em: ${fontAbsolutePath}`);
        }

        const font = opentype.loadSync(fontAbsolutePath);

        const safeFontSize = Number(fontSize) || 10;
        let safeFontColor = String(fontColor) || '#000000';
        if (!safeFontColor.startsWith("#")) safeFontColor = "#" + safeFontColor;
        let drawX = parseFloat(x) || 0, drawY = parseFloat(y) || 0;

        // --- Lógica de Alinhamento (mantida) ---
        const textPathForBounds = font.getPath(text, 0, 0, safeFontSize);
        const bounds = textPathForBounds.getBoundingBox();
        const width = bounds.x2 - bounds.x1, height = bounds.y2 - bounds.y1;
        const row = Math.floor(align / 3), col = align % 3;
        if (col === 1) drawX -= width / 2; else if (col === 2) drawX -= width;
        if (row === 1) drawY += safeFontSize / 2 - (bounds.y2 + bounds.y1) / 2; // Ajuste vertical para centro (aproximado)
        else if (row === 2) drawY += safeFontSize - bounds.y2; // Ajuste vertical para base (aproximado)
        // Ajuste fino pela linha base (pode ser necessário)
        // drawY -= bounds.y1; // Depende da fonte

        // --- Desenho ---
        const finalPath = font.getPath(text, drawX, drawY, safeFontSize);
        finalPath.fill = safeFontColor;
        finalPath.draw(ctx);

    } catch (error) {
        console.error(`[ERRO][botUtils.drawText] Falha ao desenhar texto "${text}" com fonte ${fontRelativePath}:`, error.message);
        // Fallback (opcional) - Desenha com fonte padrão se opentype falhar
        ctx.fillStyle = String(fontColor) || '#000000';
        ctx.font = `${Number(fontSize) || 10}px sans-serif`;
        // Ajustar alinhamento para fillText (pode ser diferente de opentype)
        if (align === 1 || align === 4 || align === 7) ctx.textAlign = 'center';
        else if (align === 2 || align === 5 || align === 8) ctx.textAlign = 'right';
        else ctx.textAlign = 'left';
        if (align >= 0 && align <= 2) ctx.textBaseline = 'top';
        else if (align >= 3 && align <= 5) ctx.textBaseline = 'middle';
        else ctx.textBaseline = 'bottom';
        ctx.fillText(text, parseFloat(x) || 0, parseFloat(y) || 0);
        // Resetar alinhamento
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic'; // Padrão
    }
};

module.exports = botUtils;