module.exports = {

    name: "messageCreate",
    // ATUALIZAÇÃO v14: O parâmetro de messageCreate é 'message', não 'interaction'
    execute: async (API, message) => {

        const votos = require('../_classes/packages/votos.js');
        // ATUALIZAÇÃO v14: Passando 'message'
        votos.check(message);

        const prefix = "n."

        // ATUALIZAÇÃO v14: interaction.content -> message.content
        if (message.content.startsWith(prefix)) {

            const args = message.content.slice(prefix.length).split(/ +/);
    
            const command = args.shift().toLowerCase();

            let commandfile = API.client.commands.get(command)
            if (commandfile) {
                message.commandName = 'MIGRAÇÃO'
                // ATUALIZAÇÃO v14: Passando 'message' como a propriedade 'interaction' para o 'fail' event
                API.client.emit('fail', { interaction: message, type: 'Atualização', sendMe: true, desc: 'Os comandos do NISRUKSHA foram migrados para **SLASH (/)**\nMencione o bot para entrar no servidor oficial e tirar suas dúvidas!' })
                return true;
            }
        }

        const mentionRegex = new RegExp(`^<@!?${API.client.user.id}>$`);
        
        // ATUALIZAÇÃO v14: interaction.content -> message.content
        if (message.content.match(mentionRegex)) {

            // ATUALIZAÇÃO v14: new API.Discord.MessageEmbed() -> new API.EmbedBuilder()
            const embed = new API.EmbedBuilder()
            .setColor('#36393f')
            // ATUALIZAÇÃO v14: interaction.author -> message.author
            .setAuthor(message.author.tag, message.author.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }))
            .setDescription(`Olá ${message.author}` + ', meu prefixo é `/`, caso precise de ajuda use `/ajuda`')

            // ATUALIZAÇÃO v14: Substituindo API.createButton por ButtonBuilder
            const btn1 = new API.ButtonBuilder()
                .setURL('https://discord.com/invite/jK3eNA5GkM')
                .setStyle(API.ButtonStyle.Link) // Usando o ButtonStyle injetado
                .setLabel('Meu servidor')
                .setEmoji('📨');

            const btn2 = new API.ButtonBuilder()
                .setURL('https://discord.com/oauth2/authorize?client_id=763815343507505183&permissions=388160&scope=bot%20applications.commands')
                .setStyle(API.ButtonStyle.Link)
                .setLabel('Convidar')
                .setEmoji('📩');
            
            const btn3 = new API.ButtonBuilder()
                .setURL('https://top.gg/bot/763815343507505183')
                .setStyle(API.ButtonStyle.Link)
                .setLabel('Vote em mim')
                .setEmoji('🗳');

            // ATUALIZAÇÃO v14: Substituindo API.rowComponents por ActionRowBuilder
            const row = new API.ActionRowBuilder().addComponents(btn1, btn2, btn3);
            
            // ATUALIZAÇÃO v14: interaction.channel.send -> message.channel.send
            return await message.channel.send({ embeds: [embed], components: [row] });
        }
    }
}