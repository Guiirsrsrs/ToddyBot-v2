module.exports = {

    name: "error",
    execute: async (API, err) => {

        //const Discord = API.Discord; // Não é mais necessário aqui
        let channel = API.client.channels.cache.get('1155257983450746892')
        
        // ATUALIZAÇÃO v14: new Discord.MessageEmbed() -> new API.EmbedBuilder()
        const embed = new API.EmbedBuilder()
            .setColor('#b8312c')
            .setTitle('<:error:736274027756388353> Um erro foi encontrado')
            .setDescription(`\`\`\`js\n${err.stack ? err.stack.slice(0, 1000) : err}\`\`\``)

        if (channel) {
            try {
                await channel.send({ embeds: [embed]}).catch();
            } catch {
                
            }
        }

    }
}