// events/leave.js

// REMOVIDO: Instância local do DatabaseManager não é necessária
// const Database = require("../_classes/manager/DatabaseManager");
// const DatabaseManager = new Database();
require('colors'); // Adicionado para logs

module.exports = {

    name: "guildDelete", // Evento quando o bot sai/é removido de um servidor
    execute: async (API, guild) => {

        // Check if guild object is valid before proceeding
        // (guild pode ser parcial no evento guildDelete)
        if (!guild || !guild.id) {
            console.warn('[WARN][EVENT LEAVE] guildDelete event triggered with incomplete guild object (missing ID).'.yellow);
            // Tenta logar o ID se disponível, mesmo que outras propriedades faltem
            if(guild?.id) console.log(`[EVENT LEAVE] Bot saiu do servidor ID: ${guild.id}`);
            return;
        }

        console.log(`[EVENT LEAVE] Bot saiu do servidor: ${guild.name || 'Nome Indisponível'} (ID: ${guild.id})`);

        const client = API.client;

        // Atualiza o campo 'lastcmd' na base de dados (ou outra lógica de "limpeza")
        try {
            // ALTERADO: Usando API.db.set diretamente
            await API.db.set(guild.id, 'servers', 'lastcmd', 0, 'server_id');
            // Considerar definir um status 'left' ou remover o documento do servidor?
            // Exemplo: await API.db.updateOne('servers', { server_id: guild.id }, { $set: { status: 3, left_at: new Date() } });
            // Exemplo: await API.db.deleteOne('servers', { server_id: guild.id });
            console.log(`[EVENT LEAVE] Campo 'lastcmd' atualizado para servidor ${guild.id}.`);
        } catch (dbError) {
             console.error(`[ERRO][EVENT LEAVE] Falha ao atualizar servidor ${guild.id} na base de dados:`, dbError);
             if(client?.emit) client.emit('error', dbError);
        }

        // Tenta obter o dono (pode já não estar disponível)
        let ownerTag = 'N/A';
        let ownerId = guild.ownerId || 'N/A'; // Pega o ID se disponível
        // Não tentar fetchOwner no guildDelete pois pode falhar/não estar disponível
        // Apenas usa o ownerId se existir no objeto 'guild' parcial

        // Envia log para um canal específico (se configurado)
        const logChannelId = '1155257983450746892'; // ID do canal de logs (verificar se é o correto)
        try {
            // Usa client.channels.fetch para garantir que o canal existe
            const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
            if (logChannel?.send) {
                // ATUALIZAÇÃO v14: new Discord.MessageEmbed() -> new API.EmbedBuilder()
                const embed = new API.EmbedBuilder()
                    .setColor('#eb4634') // Vermelho
                    .setTitle('❌ Saída de Servidor')
                    .setDescription(`Saiu de: **${guild.name || 'Nome Indisponível'}** (\`${guild.id}\`)`)
                    .addFields({ name: 'Dono ID', value: `\`${ownerId}\``, inline: true })
                    // Member count geralmente não está disponível no guildDelete
                    // .addFields({ name: 'Membros (na saída?)', value: `${guild.memberCount || 'N/A'}`, inline: true })
                    .setTimestamp();

                 if (guild.iconURL()) {
                     embed.setThumbnail(guild.iconURL({ dynamic: true }));
                 }

                await logChannel.send({ embeds: [embed] });
            } else {
                 console.warn(`[WARN][EVENT LEAVE] Canal de log (${logChannelId}) não encontrado.`.yellow);
            }
        } catch (logError) {
             console.error(`[ERRO][EVENT LEAVE] Falha ao enviar log de saída do servidor ${guild.id}:`, logError);
             // Não emitir erro global por falha no log?
        }
    }
}