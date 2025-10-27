module.exports = {

    name: "fail",
    execute: async (API, { interaction, type, desc, sendMe }) => {
        if (!API.logs.falhas) return // Verifica se os logs de falha estão ativos

        try {

            // Handle potential difference between message and interaction author/user
            // (Se o evento for acionado por messageCreate, interaction.author pode existir)
            interaction.author ? interaction.user = interaction.author : null

            // ATUALIZAÇÃO v14: new API.Discord.MessageEmbed() -> new API.EmbedBuilder()
            const embedfail = new API.EmbedBuilder()
            .setColor('#b8312c')
            .setTimestamp()
            .setTitle(`Falha: ${type}`)

            // Ensure interaction.user is defined before accessing properties
            if (interaction.user) {
                embedfail.setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }) });
            }

             // Ensure interaction.channel and interaction.guild are defined for context
             // (Pode faltar se for uma mensagem ou interação em DM, embora o bot pareça focado em guilds)
            if (interaction.channel && interaction.guild) {
                 embedfail.setDescription(`${interaction.user || 'Utilizador Desconhecido'} tentou executar o comando \`/${interaction.commandName || 'Comando Desconhecido'}\` em #${interaction.channel.name}`)
                 .setFooter({ text: interaction.guild.name + " | " + interaction.guild.id, iconURL: interaction.guild.iconURL() })
            } else if (interaction.user) {
                 // Fallback if channel/guild info is missing
                 embedfail.setDescription(`${interaction.user} tentou executar o comando \`/${interaction.commandName || 'Comando Desconhecido'}\``);
            } else {
                 embedfail.setDescription(`Tentativa de execução do comando \`/${interaction.commandName || 'Comando Desconhecido'}\``);
            }

            // Check if interaction is a CommandInteraction and has options before mapping
            // (!interaction.content garante que não é uma mensagem de prefixo antigo)
            if (!interaction.content && interaction.options && typeof interaction.options.map === 'function') { // Check if options exist and have map method
                // Tenta obter as opções formatadas (pode ser complexo dependendo dos tipos de opção)
                // Usar interaction.options.data pode ser mais informativo
                // const optionsString = interaction.options.map(i => `${i.name}: ${i.value}`).join(' ').slice(0, 1000); // Exemplo mais detalhado
                 const optionsString = interaction.options.data.map(opt => `${opt.name}: ${opt.value}`).join('\n').slice(0, 1000); // Outro formato
                if (optionsString) { // Only add field if there are options
                    embedfail.addFields({ name: 'Argumentos', value: `\`\`\`\n${optionsString}\`\`\`` });
                }
            }

            const failObject = { embeds: [embedfail], ephemeral: true }

            // Send log to channel
            // Canal de log hardcoded (1155257983450746892) - pode ser configurável?
            const logChannel = API.client.channels.cache.get('1155257983450746892');
            if (logChannel?.send) { // Verifica se canal existe e pode enviar
                 logChannel.send({ embeds: [embedfail] }).catch(err => API.client.emit('error', err)); // Add error handling
            } else {
                 console.warn(`[WARN][EVENT FAIL] Canal de log de falhas (1155257983450746892) não encontrado.`);
            }

            // Se não for para enviar a mensagem ao utilizador, termina aqui
            if (!sendMe) return

            // Update description if provided (para a mensagem ao utilizador)
            if (desc) embedfail.setDescription(desc) // Substitui a descrição anterior
                               .setFields([]) // Remove campos de argumentos (geralmente não são para o utilizador)
                               .setFooter(null); // Remove footer com ID do servidor

            // Reply or edit reply to the user
            if (interaction.replied || interaction.deferred) { // Check if deferred as well
                 await interaction.editReply({ embeds: [embedfail], ephemeral: true }).catch(err => API.client.emit('error', err)); // Add error handling and ephemeral
            } else {
                  // Tenta responder à interação original
                 await interaction.reply({ embeds: [embedfail], ephemeral: true }).catch(async err => { // Use failObject que inclui ephemeral
                      // Se responder falhar (ex: interação expirou), tenta followUp
                      console.warn(`[WARN][EVENT FAIL] Falha ao responder à interação, tentando followUp...`, err.message);
                      try {
                           await interaction.followUp({ embeds: [embedfail], ephemeral: true });
                      } catch (followUpErr) {
                           console.error(`[ERRO][EVENT FAIL] Falha ao enviar followUp de falha:`, followUpErr);
                           API.client.emit('error', followUpErr);
                      }
                 });
            }
        } catch (error) {
            // Erro dentro do próprio handler de falha
            API.client.emit('error', error)
            console.error('[ERRO GRAVE][EVENT FAIL] Ocorreu um erro dentro do handler de falha:', error)
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