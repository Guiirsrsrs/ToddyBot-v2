// events/error.js

module.exports = {

    name: "error", // Evento 'error'
    execute: async (API, error) => { // O segundo parâmetro é o objeto de erro

        console.error('[ERRO GLOBAL CAPTURADO]', error); // Loga o erro na consola

        // Tenta enviar o erro para um canal de log
        const logChannelId = '1155257983450746892'; // ID do canal de logs de erro
        try {
            // Usa API.client que é injetado
            const logChannel = await API.client.channels.fetch(logChannelId).catch(() => null);

            if (logChannel?.send) { // Verifica se pode enviar mensagens
                // ATUALIZAÇÃO v14: API.Discord.MessageEmbed -> API.EmbedBuilder
                const embed = new API.EmbedBuilder()
                    .setColor('#eb4034') // Vermelho para erro
                    .setTitle('❌ Erro Capturado')
                    // Limita o tamanho da stack trace ou mensagem de erro para caber no embed
                    .setDescription(`\`\`\`js\n${error.stack ? String(error.stack).slice(0, 4000) : String(error).slice(0, 4000)}\n\`\`\``)
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] });
            } else {
                 console.warn(`[WARN][EVENT ERROR] Canal de log de erro (${logChannelId}) não encontrado.`);
            }
        } catch (logError) {
             // Se falhar ao logar o erro, apenas loga a falha do log na consola
             console.error('[ERRO][EVENT ERROR] Falha ao enviar log de erro para o canal:', logError);
        }

        // Considerar se deve tomar outras ações em caso de erro,
        // como reiniciar o shard (embora o ShardingManager possa já fazer isso).
    }
}