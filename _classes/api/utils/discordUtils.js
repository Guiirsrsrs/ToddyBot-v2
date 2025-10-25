const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, SelectMenuBuilder, ButtonStyle } = require('discord.js');

const discordUtils = {};

discordUtils.sendError = async function (interaction, s, usage) {
    const embedError = new EmbedBuilder()
        .setColor('#b8312c')
        .setDescription('<:error:736274027756388353> ' + s);
    if (interaction.user) {
         embedError.setAuthor(interaction.user.tag, interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }));
    }
    if (usage) {
        embedError.addField('Exemplo de uso', "\n`/" + usage + "`");
    }
    return embedError;
};

discordUtils.createButton = function(id, style, label, emoji, disabled = false) {
    let button = new ButtonBuilder();
    if (style.toUpperCase() === 'LINK') {
        button.setURL(id.toString());
        button.setStyle(ButtonStyle.Link);
    } else {
        button.setCustomId(id.toString());
        switch (style.toUpperCase()) {
            case 'PRIMARY': button.setStyle(ButtonStyle.Primary); break;
            case 'SECONDARY': button.setStyle(ButtonStyle.Secondary); break;
            case 'SUCCESS': button.setStyle(ButtonStyle.Success); break;
            case 'DANGER': button.setStyle(ButtonStyle.Danger); break;
            default: button.setStyle(ButtonStyle.Secondary);
        }
    }
    if (label) button.setLabel(label);
    if (emoji) button.setEmoji(emoji);
    if (disabled) button.setDisabled(true);
    return button;
};

discordUtils.createMenu = function({ id, placeholder, min, max }, options) {
    let menu = new SelectMenuBuilder()
        .setCustomId(id)
        .setPlaceholder(placeholder || 'Selecione uma opção')
        .setMinValues(min || 1)
        .setMaxValues(max || 1);
    const formattedOptions = options.map(opt => ({
        label: opt.label,
        value: opt.value,
        description: opt.description,
        emoji: opt.emoji,
        default: opt.default
    }));
    if (formattedOptions.length > 0) {
        menu.addOptions(formattedOptions);
    }
    return menu;
};

discordUtils.rowComponents = function(arr) {
    if (!arr || arr.length === 0) return null;
    let btnRow = new ActionRowBuilder();
    const validComponents = arr.filter(component => component);
    if (validComponents.length > 0) {
        btnRow.addComponents(validComponents);
        return btnRow;
    }
    return null;
};

module.exports = discordUtils;