const { EmbedBuilder } = require('discord.js'); // Necessário para getBotInfoProperties
const discordJsVersion = require('discord.js').version; // Obter versão do discord.js
// Importar DatabaseManager e config aqui se getBotInfoProperties precisar deles
const DatabaseManager = require('../../manager/DatabaseManager'); // Ajuste o caminho conforme necessário
const dbManager = new DatabaseManager(); // Crie uma instância
const { app } = require('../../config'); // Ajuste o caminho

const botUtils = {};

botUtils.uptime = function() {
    let uptime = process.uptime(), days = Math.floor((uptime % 31536000) / 86400), hours = Math.floor((uptime % 86400) / 3600), minutes = Math.floor((uptime % 3600) / 60), seconds = Math.round(uptime % 60);
    return (days > 0 ? days + " dias, " : "") + (hours > 0 ? hours + " horas, " : "") + (minutes > 0 ? minutes + " minutos, " : "") + (seconds > 0 ? seconds + " segundos" : "");
};

// getBotInfoProperties precisa de acesso a 'API' (ou pelo menos client, version, cacheLists, etc.)
// Vamos passar 'API' como argumento por enquanto, ou refatorar para importar dependências aqui
botUtils.getBotInfoProperties = async function(API) {
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
    }
    let dbsize = 'N/A';
    try {
        const text = `SELECT pg_size_pretty(pg_database_size(current_database()));`;
        const res = await dbManager.query(text); // Use a instância dbManager
        dbsize = res.rows[0]["pg_size_pretty"];
    } catch (dbError) { console.error("Failed to get DB size:", dbError); }

    const globalsObj = await dbManager.get(app.id, 'globals') || { totalcmd: 0 }; // Use a instância dbManager e config

    const embed = new EmbedBuilder();
    embed.setTitle(`(/) ${API.client?.user?.username || 'Bot'}`); // Use API passada
    embed.addField(`🕐 Tempo online`, `\`${API.utils.bot.uptime()}\``, true) // Acessar via API.utils.bot
    embed.addField(`💾 Último save`, `\`${API.lastsave == '' ? 'Não ocorreu':API.lastsave}\``, true)
    embed.addField(`📓 Comandos executados`, `Após iniciar: \`${API.cmdsexec}\`\nTotal: \`${globalsObj.totalcmd}\`\nPlayers após iniciar: \`${API.playerscmds.length}\``, true)

    const miningLength = API.cacheLists?.waiting?.length('mining') || 0;
    const huntingLength = API.cacheLists?.waiting?.length('hunting') || 0;
    const collectingLength = API.cacheLists?.waiting?.length('collecting') || 0;
    const fishingLength = API.cacheLists?.waiting?.length('fishing') || 0;
    const rememberSize = API.cacheLists?.remember?.get()?.size || 0;

    embed.addField(`🪐 População`, `Servidores: \`${API.client?.guilds?.cache?.size || 0}\`\nMinerando: \`${miningLength}\`\nCaçando: \`${huntingLength}\`\nColetando: \`${collectingLength}\`\nPescando: \`${fishingLength}\`\nAguardando: \`${rememberSize}\``, true)
    embed.addField(`📎 Versões`, `Node.js \`${process.versions.node}\`\nDiscord.js \`${discordJsVersion}\`\nNisruksha \`${API.version}\``, true)

    let ownerx = { tag: 'N/A' };
    try { ownerx = await API.client.users.fetch('422002630106152970'); } catch (ownerError) { console.error("Failed to fetch owner:", ownerError); }

    embed.addField(`<:list:736274028179750922> Detalhados`, `Ping: \`${API.client?.ws?.ping || 0} ms\`\nConsumo: \`${formatBytes(process.memoryUsage().rss)}\`\nTamanho da db: \`${dbsize}\`\nFundador: \`${ownerx.tag}\``, true)
    embed.setTimestamp();
    return embed;
};

botUtils.random = function(min, max, doubled) {
    if (doubled) return min + (max - min) * Math.random();
    min = Number(min); max = Number(max);
    if (isNaN(min) || isNaN(max)) return 0;
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

botUtils.isInt = function(value) {
    if (isNaN(value)) { return false; }
    var x = parseFloat(value);
    return (x | 0) === x;
};

botUtils.isOdd = function(n) {
   return Math.abs(n % 2) == 1;
};

botUtils.clone = function(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) {
        if (null == obj || "object" != typeof obj) return obj;
        var copy = obj.constructor();
        for (var attr in obj) { if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr]; }
        return copy;
    }
};

botUtils.getMultipleArgs = function(interaction, index) {
    if (!interaction.content) return "";
    const params = interaction.content.split(/ +/g);
    if (index >= params.length) return "";
    return params.slice(index).join(" ");
};


module.exports = botUtils;