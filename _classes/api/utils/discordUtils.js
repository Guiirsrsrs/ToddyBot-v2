// _classes/api/utils/discordUtils.js

// Requer a API DENTRO das funções que a utilizam
require('colors'); // Para logs

const discordUtils = {};

/**
 * Cria um botão do Discord usando ButtonBuilder.
 * @param {string} customId - ID customizado do botão.
 * @param {'Primary'|'Secondary'|'Success'|'Danger'|'Link'} style - Estilo do botão.
 * @param {string} [label=''] - Texto do botão (obrigatório se não for Link ou não tiver emoji).
 * @param {string|EmojiIdentifierResolvable} [emoji=null] - Emoji para o botão.
 * @param {boolean} [disabled=false] - Se o botão deve estar desabilitado.
 * @param {string} [url=null] - URL (apenas para estilo 'Link').
 * @returns {ButtonBuilder} O objeto ButtonBuilder configurado.
 */
discordUtils.createButton = function(customId, style = 'Primary', label = '', emoji = null, disabled = false, url = null) {
    // Requer a API aqui
    const API = require('../index');
    const button = new API.ButtonBuilder(); // Usa o ButtonBuilder da API

    // Define o estilo (converte string para enum ButtonStyle)
    const buttonStyle = API.ButtonStyle[style] || API.ButtonStyle.Primary;
    button.setStyle(buttonStyle);

    if (buttonStyle === API.ButtonStyle.Link) {
        if (!url) throw new Error("URL é obrigatória para botões de estilo Link.");
        button.setURL(url);
        // Label é opcional para Link se tiver emoji
        if (label) button.setLabel(label);
        // ID customizado não é usado para Link
    } else {
        if (!customId) throw new Error("Custom ID é obrigatório para botões que não são Link.");
        button.setCustomId(customId);
        // Label é obrigatório se não tiver emoji
        if (label) button.setLabel(label);
        else if (!emoji) throw new Error("Label ou Emoji é obrigatório para botões que não são Link.");
    }

    if (emoji) {
        button.setEmoji(emoji);
    }
    if (disabled) {
        button.setDisabled(true);
    }

    return button;
};

/**
 * Cria e formata um EmbedBuilder para mensagens de erro.
 * @param {Interaction} interaction - Objeto da interação (para pegar autor).
 * @param {string} errorMessage - A mensagem de erro a ser exibida.
 * @returns {Promise<EmbedBuilder>} O EmbedBuilder formatado.
 */
discordUtils.sendError = async function(interaction, errorMessage) {
    // Requer a API aqui
    const API = require('../index');
    const embed = new API.EmbedBuilder() // Usa o EmbedBuilder da API
        .setColor('#a60000') // Cor vermelha para erro
        .setDescription(`<:error:736274027756388353> ${errorMessage}`); // Adiciona emoji de erro

    // Tenta definir o autor com base na interação
    if (interaction?.user) {
        embed.setAuthor({
            name: interaction.user.tag,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        });
    } else {
         // Fallback se não houver interaction.user
         embed.setAuthor({ name: "Erro" });
    }

    return embed;
    // NOTA: Esta função apenas CRIA o embed. A responsabilidade de ENVIAR
    // (reply, editReply, followUp) é da função que chamou sendError.
};


/**
 * Encontra um membro em uma guilda pelo ID, menção ou nome/tag (case-insensitive).
 * @param {string} query - ID, menção, nome ou tag do membro.
 * @param {Guild} guild - Objeto da guilda onde procurar.
 * @returns {Promise<GuildMember|null>} O objeto GuildMember encontrado ou null.
 */
discordUtils.findMember = async function(query, guild) {
    if (!query || !guild) return null;
    const queryLower = query.toLowerCase();

    // Tenta por ID
    if (/^\d{17,19}$/.test(query)) { // Verifica se parece um ID
        try {
            // Usa force: false para não buscar na API se não estiver no cache (mais rápido)
            const member = await guild.members.fetch({ user: query, cache: true, force: false }).catch(() => null);
            if (member) return member;
        } catch {} // Ignora erros de ID inválido
    }

    // Tenta por Menção
    const mentionMatch = query.match(/^<@!?(\d{17,19})>$/);
    if (mentionMatch) {
        const userId = mentionMatch[1];
        try {
            const member = await guild.members.fetch({ user: userId, cache: true, force: false }).catch(() => null);
            if (member) return member;
        } catch {}
    }

    // Tenta por Nome ou Tag (busca no cache primeiro)
    let foundMember = guild.members.cache.find(m =>
        m.user.username.toLowerCase().includes(queryLower) ||
        m.user.tag.toLowerCase().includes(queryLower) ||
        (m.nickname && m.nickname.toLowerCase().includes(queryLower))
    );

    if (foundMember) return foundMember;

    // Se não encontrou no cache, tenta buscar na API (pode ser lento)
    try {
         const fetchedMembers = await guild.members.fetch({ query: query, limit: 1 }).catch(() => null);
         if (fetchedMembers && fetchedMembers.size > 0) {
              return fetchedMembers.first();
         }
    } catch (fetchError) {
         console.warn(`[DiscordUtils.findMember] Erro ao buscar membro "${query}" em "${guild.name}":`, fetchError.message);
    }


    return null; // Não encontrado
};

/**
 * Encontra um canal em uma guilda pelo ID, menção ou nome (case-insensitive).
 * @param {string} query - ID, menção ou nome do canal.
 * @param {Guild} guild - Objeto da guilda onde procurar.
 * @returns {GuildChannel|ThreadChannel|null} O objeto do canal encontrado ou null.
 */
discordUtils.findChannel = function(query, guild) {
    if (!query || !guild) return null;
    const queryLower = query.toLowerCase();

    // Tenta por ID
    if (/^\d{17,19}$/.test(query)) {
        const channel = guild.channels.cache.get(query);
        if (channel) return channel;
    }

    // Tenta por Menção
    const mentionMatch = query.match(/^<#(\d{17,19})>$/);
    if (mentionMatch) {
        const channelId = mentionMatch[1];
        const channel = guild.channels.cache.get(channelId);
        if (channel) return channel;
    }

    // Tenta por Nome (apenas no cache)
    const foundChannel = guild.channels.cache.find(c =>
        c.name.toLowerCase().includes(queryLower)
    );

    return foundChannel || null; // Retorna encontrado ou null
};


module.exports = discordUtils;