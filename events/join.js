const Database = require("../_classes/manager/DatabaseManager");
const DatabaseManager = new Database();

module.exports = {

    name: "guildCreate",
    execute: async (API, guild) => {
        const client = API.client;
        //const Discord = API.Discord; // Não é mais necessário aqui

        const sv = await DatabaseManager.get(guild.id, 'servers', 'server_id');
        
        if (sv.status == 2) {

            guild.leave()
            
            // ATUALIZAÇÃO v14: new API.Discord.MessageEmbed() -> new API.EmbedBuilder()
            const embedcmd = new API.EmbedBuilder()
            .setColor('#b8312c')
            .setTimestamp()
            .setTitle(`Falha: servidor banido`)
            .setDescription(`Bot tentou entrar no servidor ${guild.name}`)
            .setFooter(guild.name + " | " + guild.id, guild.iconURL())
            .setAuthor(guild.name, guild.iconURL())

            const logChannel = API.client.channels.cache.get('1155257983450746892');
            if (logChannel) {
                logChannel.send({ embeds: [embedcmd] }).catch(err => API.client.emit('error', err)); // Add error handling
            }
            
            return;
        }
        
        let owner = await API.client.users.fetch(guild.ownerId)
        
        // ATUALIZAÇÃO v14: new Discord.MessageEmbed() -> new API.EmbedBuilder()
        const embed = new API.EmbedBuilder();
        embed.setDescription(`Novo servidor: ${guild.name} | ${guild.id}\nOwner: <@${owner.id}> (${owner.tag})\nMembros ${guild.memberCount}`)
        .setColor('#55eb34')

        const logChannel = API.client.channels.cache.get('1155257983450746892');
        if (logChannel) {
             logChannel.send({ embeds: [embed] }).catch(err => API.client.emit('error', err)); // Add error handling
        }

        DatabaseManager.set(guild.id, 'servers', 'lastcmd', Date.now(), 'server_id')

    }
}