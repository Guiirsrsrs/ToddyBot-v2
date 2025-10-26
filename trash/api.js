const { prefix, owner, token, ip, app } = require("../_classes/config");
const version = require('../package.json').version;
const Database = require('./manager/DatabaseManager');
const DatabaseManager = new Database();

// ATUALIZAÇÃO v14: Importar builders e ButtonStyle
const {
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    SelectMenuBuilder,
    ButtonStyle
} = require('discord.js');

// ATUALIZAÇÃO v14: Remover imports antigos
// const { MessageActionRow, MessageButton, MessageSelectMenu } = require('discord.js')

// ATUALIZAÇÃO v14: Centralizar imports dos módulos
const modules = {
    badges: require('./api/modules/badges.js'),
    cacheLists: require('./api/modules/cacheLists.js'),
    company: require('./api/modules/company.js'),
    crateExtension: require('./api/modules/crateExtension.js'),
    eco: require('./api/modules/eco.js'),
    events: require('./api/modules/events.js'),
    frames: require('./api/modules/frames.js'),
    helpExtension: require('./api/modules/helpExtension.js'),
    img: require('./api/modules/img.js'),
    itemExtension: require('./api/modules/itemExtension.js'),
    maqExtension: require('./api/modules/maqExtension.js'),
    playerUtils: require('./api/modules/playerUtils.js'),
    shopExtension: require('./api/modules/shopExtension.js'),
    siteExtension: require('./api/modules/siteExtension.js'),
    townExtension: require('./api/modules/townExtension.js')
};

const API = {
    // Basic Config & Info
    prefix,
    owner,
    token,
    ip,
    app,
    version,
    id: app.id,

    // Bot State & Logs
    debug: false,
    logs: {
        cmds: true,
        falhas: true
    },
    lastsave: '',
    cmdsexec: 0,
    playerscmds: [],

    // String Constants
    money: 'moedas',
    moneyemoji: '<:moneybag:736290479406317649>',
    money2: 'cristais',
    money2emoji: '<:estilhas:743176785986060390>',
    money3: 'fichas',
    money3emoji: '<:ficha:741827151879471115>',
    tp: {
        name: 'pontos temporais',
        emoji: '<:tp:841870541274087455>'
    },
    mastery: {
        name: 'pontos de maestria',
        emoji: '🔰'
    },

    // Database Manager
    DatabaseManager: DatabaseManager, // Expor a instância do DB Manager
    db: require('./db.js'), // Manter acesso direto ao knex se necessário

    // ATUALIZAÇÃO v14: Expor Builders diretamente
    EmbedBuilder: EmbedBuilder,
    ButtonBuilder: ButtonBuilder,
    ActionRowBuilder: ActionRowBuilder,
    SelectMenuBuilder: SelectMenuBuilder,
    ButtonStyle: ButtonStyle,

    // ATUALIZAÇÃO v14: Anexar módulos importados
    ...modules,

    // Client and Discord object will be added by NisrukshaClient constructor
    client: null,
    Discord: null // ATUALIZAÇÃO v14: Será preenchido pelo Client, mas deve ser evitado
};

// --- Utility Functions --- (Mantidas como antes, exceto as que usam componentes)

API.ms = function(s) {
    function pad(n, z) {
        z = z || 2;
        return ('00' + n).slice(-z);
    }

    var ms = s % 1000;
    s = (s - ms) / 1000;
    var secs = s % 60;
    s = (s - secs) / 60;
    var mins = s % 60;
    var hrs = (s - mins) / 60;

    var days = parseInt(Math.floor(hrs / 24));
    hrs = parseInt(hrs % 24);

    var meses = parseInt(Math.floor(days / 30));
    days = parseInt(days % 30);

    return (meses > 0 ? pad(meses) + ' mêses, ' : "") + (days > 0 ? pad(days) + ' dias, ' : "") + (hrs > 0 ? pad(hrs) + ' horas, ' : "") + (mins > 0 ? pad(mins) + ' minutos e ' : "") + (pad(secs) + ' segundos')
}

API.ms2 = function(s) {
    function pad(n, z) {
        z = z || 2;
        return ('00' + n).slice(-z);
    }

    var ms = s % 1000;
    s = (s - ms) / 1000;
    var secs = s % 60;
    s = (s - secs) / 60;
    var mins = s % 60;
    var hrs = (s - mins) / 60;

    var days = parseInt(Math.floor(hrs / 24));
    hrs = parseInt(hrs % 24);

    var meses = parseInt(Math.floor(days / 30));
    days = parseInt(days % 30);

    return (meses > 0 ? pad(meses) + 'mo, ' : "") + (days > 0 ? pad(days) + 'd, ' : "") + (hrs > 0 ? pad(hrs) + 'h, ' : "") + (mins > 0 ? pad(mins) + 'm e ' : "") + (pad(secs) + 's')
}

API.getProgress = function(maxticks, tickchar, seekpos, atual, max, percento) {
    
    const percentage = atual / max;
    const progress = Math.round((maxticks * percentage));
    const emptyProgress = maxticks - progress;

    if (typeof tickchar == 'object') {
        for (xii = 0; xii < Object.keys(tickchar).length; xii++) {
            if ( Math.round(percentage*100) >= parseInt(Object.keys(tickchar).reverse()[xii])){
                tickchar = tickchar[Object.keys(tickchar).reverse()[xii]]
                break;
            }
        }
    }

    const progressText = tickchar.repeat(progress);
    const emptyProgressText = seekpos.repeat(emptyProgress);

    const bar = '[' + progressText + emptyProgressText + "] "+ (percento ? Math.round((percentage)*100) + "%" : "(" + atual + "/" + max +")") ;
    return bar;
}

API.isInt = function(value) {
    if (isNaN(value)) {
        return false;
    }
    var x = parseFloat(value);
    return (x | 0) === x;
}

API.format = function(num) {
    // Handle potential non-numeric input gracefully
    if (typeof num !== 'number' || isNaN(num)) {
        return '0'; // Or handle as appropriate
    }
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.')
}

API.sendError = async function (interaction, s, usage) {
    // ATUALIZAÇÃO v14: Use API.EmbedBuilder
    const embedError = new API.EmbedBuilder()
        .setColor('#b8312c')
        .setDescription('<:error:736274027756388353> ' + s)
        // Ensure interaction.user exists before accessing properties
        if (interaction.user) {
             embedError.setAuthor(interaction.user.tag, interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }))
        }
    if (usage) {
        embedError.addField('Exemplo de uso', "\n`/" + usage + "`")
    }

    return embedError
}

API.uptime = function() {
    let uptime = process.uptime(),
        days = Math.floor((uptime % 31536000) / 86400),
        hours = Math.floor((uptime % 86400) / 3600),
        minutes = Math.floor((uptime % 3600) / 60),
        seconds = Math.round(uptime % 60),
        uptimestring = (days > 0 ? days + " dias, " : "") + (hours > 0 ? hours + " horas, " : "") + (minutes > 0 ? minutes + " minutos, " : "") + (seconds > 0 ? seconds + " segundos" : "")
    return uptimestring;
    
}

API.random = function(min, max, doubled) {
    if (doubled) return min + (max - min) * Math.random();
    // Ensure min and max are numbers
    min = Number(min);
    max = Number(max);
    if (isNaN(min) || isNaN(max)) return 0; // Or handle error
    return Math.floor(Math.random() * (max - min + 1)) + min; // Corrected calculation for inclusive range
}


API.isOdd = function(n) {
   return Math.abs(n % 2) == 1;
}

API.getBotInfoProperties = async function() {

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
    }

    let dbsize = 'N/A';
    try {
        const text =  `SELECT pg_size_pretty(pg_database_size(current_database()));`; // Use current_database()
        const res = await API.client.dbquery(text);
        dbsize = res.rows[0]["pg_size_pretty"];
    } catch (dbError) {
        console.error("Failed to get DB size:", dbError);
    }


    const globalsObj = await API.client.dbget(app.id, 'globals') || { totalcmd: 0 }; // Default if not found

    // ATUALIZAÇÃO v14: Use API.EmbedBuilder
    const embed = new API.EmbedBuilder();
    embed.setTitle(`(/) ${API.client.user ? API.client.user.username : 'Bot'}`); // Check if client.user exists

    embed.addField(`🕐 Tempo online`, `\`${API.uptime()}\``, true)

    embed.addField(`💾 Último save`, `\`${API.lastsave == '' ? 'Não ocorreu':API.lastsave}\``, true)

    embed.addField(`📓 Comandos executados`, `Após iniciar: \`${API.cmdsexec}\`\nTotal: \`${globalsObj.totalcmd}\`\nPlayers após iniciar: \`${API.playerscmds.length}\``, true)

    // Ensure cacheLists functions exist before calling
    const miningLength = API.cacheLists && typeof API.cacheLists.waiting?.length === 'function' ? API.cacheLists.waiting.length('mining') : 0;
    const huntingLength = API.cacheLists && typeof API.cacheLists.waiting?.length === 'function' ? API.cacheLists.waiting.length('hunting') : 0;
    const collectingLength = API.cacheLists && typeof API.cacheLists.waiting?.length === 'function' ? API.cacheLists.waiting.length('collecting') : 0;
    const fishingLength = API.cacheLists && typeof API.cacheLists.waiting?.length === 'function' ? API.cacheLists.waiting.length('fishing') : 0;
    const rememberSize = API.cacheLists && typeof API.cacheLists.remember?.get === 'function' ? API.cacheLists.remember.get().size : 0;

    embed.addField(`🪐 População`, `Servidores: \`${API.client.guilds?.cache?.size || 0}\`\nMinerando: \`${miningLength}\`\nCaçando: \`${huntingLength}\`\nColetando: \`${collectingLength}\`\nPescando: \`${fishingLength}\`\nAguardando: \`${rememberSize}\``, true)

    // ATUALIZAÇÃO v14: Use API.Discord.version (will be set by client)
    embed.addField(`📎 Versões`, `Node.js \`${process.versions.node}\`\nDiscord.js \`${API.Discord ? API.Discord.version : 'N/A'}\`\nNisruksha \`${API.version}\``, true)

    let ownerx = { tag: 'N/A' };
    try {
        ownerx = await API.client.users.fetch('422002630106152970');
    } catch (ownerError) {
        console.error("Failed to fetch owner:", ownerError);
    }


    embed.addField(`<:list:736274028179750922> Detalhados`, `Ping: \`${API.client.ws?.ping || 0} ms\`\nConsumo: \`${formatBytes(process.memoryUsage().rss)}\`\nTamanho da db: \`${dbsize}\`\nFundador: \`${ownerx.tag}\``, true)
    
    embed.setTimestamp()
    
    return embed
}

API.setCompanieInfo = async function (user_id, company, string, value) {
    try {
        // Ensure the company row exists or insert it
        await API.client.dbquery(
            `INSERT INTO companies(company_id, user_id) VALUES($1, $2) ON CONFLICT (company_id) DO NOTHING;`, // Assume company_id is unique key
            [company, user_id]
        );

        // Update the specific field
        // IMPORTANT: Avoid string interpolation for column names if possible. If 'string' comes from user input, VALIDATE IT STRICTLY.
        // Assuming 'string' is a safe, known column name here.
        const text = `UPDATE companies SET "${string}" = $3 WHERE company_id = $1;`; // Use company_id as primary key for update
        await API.client.dbquery(text, [company, value]);

    } catch (err) {
        console.error(`Error in setCompanieInfo (user: ${user_id}, company: ${company}, field: ${string}):`, err.stack);
        API.client.emit('error', err);
    }
};


API.toNumber = function(x) {
    if (typeof x !== 'string') x = String(x); // Convert to string first
    return parseInt(x.replace(/k/gi, '000').replace(/m/gi, '000000').replace(/b/gi, '000000000').replace(/[^0-9]/g, '')) || 0; // Remove non-digits, fallback to 0
}


API.getFormatedDate = function(onlyhour) {
    let result
    const moment = require('moment')
    moment.suppressDeprecationWarnings = true;
    // Use moment-timezone for reliable timezone handling if needed
    // const date = moment().tz("America/Sao_Paulo");
    const date = moment(); // Simpler if server time is correct
    const buildInput = 'DD/MM/YYYY [|] HH:mm'
    const buildInput2 = 'HH:mm'
    result = date.format(onlyhour ? buildInput2 : buildInput)
    return result;
}

API.getMultipleArgs = function(interaction, index) {
    // This function assumes interaction.content, which is only available for message commands
    // For slash commands, you need interaction.options.getString('optionName') etc.
    if (!interaction.content) return ""; // Return empty for slash commands or missing content
    const params = interaction.content.split(/ +/g); // Use space as delimiter
    if (index >= params.length) return ""; // Index out of bounds
    return params.slice(index).join(" "); // Join args from index onwards
}


// ATUALIZAÇÃO v14: Re-implement using ButtonBuilder and ButtonStyle
API.createButton = function(id, style, label, emoji, disabled = false) { // Default disabled to false
    let button = new API.ButtonBuilder();

    // Set Custom ID or URL based on style
    if (style.toUpperCase() === 'LINK') {
        button.setURL(id.toString());
        button.setStyle(API.ButtonStyle.Link); // Use the imported ButtonStyle
    } else {
        button.setCustomId(id.toString());
        // Map string style to ButtonStyle enum
        switch (style.toUpperCase()) {
            case 'PRIMARY': button.setStyle(API.ButtonStyle.Primary); break;
            case 'SECONDARY': button.setStyle(API.ButtonStyle.Secondary); break;
            case 'SUCCESS': button.setStyle(API.ButtonStyle.Success); break;
            case 'DANGER': button.setStyle(API.ButtonStyle.Danger); break;
            default: button.setStyle(API.ButtonStyle.Secondary); // Default to Secondary
        }
    }

    if (label) button.setLabel(label); // Set label only if provided
    if (emoji) button.setEmoji(emoji);
    if (disabled) button.setDisabled(true);

    return button;
}

// ATUALIZAÇÃO v14: Use SelectMenuBuilder
API.createMenu = function({ id, placeholder, min, max }, options) {
    let menu = new API.SelectMenuBuilder()
        .setCustomId(id)
        .setPlaceholder(placeholder || 'Selecione uma opção') // Default placeholder
        .setMinValues(min || 1) // Default min 1
        .setMaxValues(max || 1); // Default max 1

    // Ensure options are correctly formatted for v14 addOptions
    const formattedOptions = options.map(opt => ({
        label: opt.label,
        value: opt.value,
        description: opt.description, // Optional
        emoji: opt.emoji, // Optional
        default: opt.default // Optional
    }));

    if (formattedOptions.length > 0) {
        menu.addOptions(formattedOptions);
    }


    return menu;
}

// ATUALIZAÇÃO v14: Use ActionRowBuilder
API.rowComponents = function(arr) {
    if (!arr || arr.length === 0) return null; // Return null for empty array

    let btnRow = new API.ActionRowBuilder();

    // Filter out any null/undefined items just in case
    const validComponents = arr.filter(component => component);

    if (validComponents.length > 0) {
        btnRow.addComponents(validComponents);
        return btnRow;
    }

    return null; // Return null if no valid components after filtering
}


API.clone = function(obj) {
    // Basic deep clone for JSON-serializable objects
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        // Fallback for non-serializable objects (might not be a true deep clone)
        if (null == obj || "object" != typeof obj) return obj;
        var copy = obj.constructor();
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
        }
        return copy;
    }

}

module.exports = API;