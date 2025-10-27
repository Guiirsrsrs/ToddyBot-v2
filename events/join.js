// events/join.js

module.exports = {

    name: "guildCreate", // Evento quando o bot entra num servidor
    execute: async (API, guild) => {

        console.log(`[EVENT JOIN] Bot entrou no servidor: ${guild.name} (ID: ${guild.id})`);

        // Tenta obter o dono do servidor (pode falhar se o bot não tiver permissões)
        let ownerTag = 'Não disponível';
        try {
            const owner = await guild.fetchOwner();
            if (owner) {
                ownerTag = owner.user.tag;
            }
        } catch (err) {
            console.warn(`[EVENT JOIN] Não foi possível obter o dono do servidor ${guild.id}:`, err.message);
        }

        // ALTERADO: Usando API.db.set diretamente
        // Cria ou atualiza o registo do servidor na base de dados
        try {
            await API.db.set(guild.id, 'servers', 'server_name', guild.name, 'server_id');
            // Você pode querer adicionar mais campos aqui ao criar/atualizar,
            // por exemplo, usando updateOne com $set e $setOnInsert:
            /*
            await API.db.updateOne('servers',
                { server_id: guild.id }, // Filtro
                {
                    $set: { server_name: guild.name, member_count: guild.memberCount }, // Atualiza sempre
                    $setOnInsert: { // Define apenas na criação
                        joined_at: new Date(),
                        owner_id: guild.ownerId,
                        owner_tag: ownerTag,
                        status: 0 // Status inicial (ex: 0 = OK, 1 = Não permitido, 2 = Banido)
                    }
                },
                { upsert: true } // Opção upsert
            );
            */
            console.log(`[EVENT JOIN] Servidor ${guild.id} registado/atualizado na base de dados.`);
        } catch (dbError) {
             console.error(`[ERRO][EVENT JOIN] Falha ao registar/atualizar servidor ${guild.id} na base de dados:`, dbError);
             if(API.client?.emit) API.client.emit('error', dbError);
        }

        // Envia log para um canal específico (se configurado)
        const logChannelId = '768465691547271168'; // ID do canal de logs
        try {
            const logChannel = await API.client.channels.fetch(logChannelId).catch(() => null);
            if (logChannel?.send) { // Verifica se pode enviar mensagens
                // ATUALIZAÇÃO v14: API.Discord.MessageEmbed -> API.EmbedBuilder
                const embed = new API.EmbedBuilder()
                    .setColor('#42f560') // Verde
                    .setTitle('🎉 Novo Servidor 🎉')
                    .addFields(
                         { name: 'Servidor', value: `${guild.name} (\`${guild.id}\`)`, inline: true },
                         { name: 'Membros', value: `${guild.memberCount}`, inline: true },
                         { name: 'Dono', value: `${ownerTag} (\`${guild.ownerId}\`)`, inline: true },
                    )
                    .setTimestamp();

                 if (guild.iconURL()) {
                     embed.setThumbnail(guild.iconURL({ dynamic: true }));
                 }

                await logChannel.send({ embeds: [embed] });
            }
        } catch (logError) {
             console.error(`[ERRO][EVENT JOIN] Falha ao enviar log de entrada no servidor ${guild.id}:`, logError);
             // Não emitir erro global por falha no log?
        }
    }
}