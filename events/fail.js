module.exports = {

    name: "fail",
    execute: async (API, { interaction, type, desc, sendMe }) => {
        if (!API.logs.falhas) return

        try {

            // Handle potential difference between message and interaction author/user
            interaction.author ? interaction.user = interaction.author : null 
            
            // ATUALIZAÇÃO v14: new API.Discord.MessageEmbed() -> new API.EmbedBuilder()
            const embedfail = new API.EmbedBuilder() 
            .setColor('#b8312c')
            .setTimestamp()
            .setTitle(`Falha: ${type}`)
            // Ensure interaction.user is defined before accessing properties
            if (interaction.user) {
                embedfail.setAuthor(interaction.user.tag, interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }));
            }
             // Ensure interaction.channel and interaction.guild are defined
            if (interaction.channel && interaction.guild) {
                 embedfail.setDescription(`${interaction.user} tentou executar o comando \`/${interaction.commandName}\` em #${interaction.channel.name}`)
                 .setFooter(interaction.guild.name + " | " + interaction.guild.id, interaction.guild.iconURL())
            } else if (interaction.user) {
                // Fallback if channel/guild info is missing
                embedfail.setDescription(`${interaction.user} tentou executar o comando \`/${interaction.commandName}\``);
            }
    
            // Check if interaction is a CommandInteraction and has options before mapping
            if (!interaction.content && interaction.options && typeof interaction.options.map === 'function') { // Check if options exist and have map method
                const optionsString = interaction.options.map(i => i.value).join(' ').slice(0, 1000);
                if (optionsString) { // Only add field if there are options
                    embedfail.addField('Argumentos', `\`\`\`\n${optionsString}\`\`\``);
                }
            }
            
            const failObject = { embeds: [embedfail], ephemeral: true }
    
            // Send log to channel
            const logChannel = API.client.channels.cache.get('1155257983450746892');
            if (logChannel) {
                logChannel.send({ embeds: [embedfail] }).catch(err => API.client.emit('error', err)); // Add error handling
            }
    
            if (!sendMe) return
    
            // Update description if provided, but keep the embed object consistent
            if (desc) embedfail.setDescription(desc) 
    
            // Reply or edit reply to the user
            if (interaction.replied || interaction.deferred) { // Check if deferred as well
                 await interaction.editReply({ embeds: [embedfail], ephemeral: true }).catch(err => API.client.emit('error', err)); // Add error handling and ephemeral
            } else {
                 await interaction.reply({ ...failObject }).catch(err => API.client.emit('error', err)); // Use failObject which includes ephemeral
            }
        } catch (error) {
            API.client.emit('error', error)
            console.log(error)
             // Try to inform the user about the error during fail handling
            try {
                 if (interaction && !(interaction.replied || interaction.deferred)) {
                     await interaction.reply({ content: 'Ocorreu um erro ao processar a falha do comando.', ephemeral: true }).catch();
                 } else if (interaction) {
                      await interaction.followUp({ content: 'Ocorreu um erro ao processar a falha do comando.', ephemeral: true }).catch();
                 }
            } catch {}
        }

    }
}