const Database = require("../_classes/manager/DatabaseManager");
const DatabaseManager = new Database();

module.exports = {

    name: "guildDelete",
    execute: async (API, guild) => {

        // Check if guild object is valid before proceeding
        if (!guild || !guild.name || !guild.id) {
            console.warn('[WARN] guildDelete event triggered with incomplete guild object.');
            return;
        }

        const client = API.client;
        //const Discord = API.Discord; // Not needed anymore

        API.client.dbset(guild.id, 'servers', 'lastcmd', 0, 'server_id');

        let owner = { id: 'N/A', tag: 'N/A'}; // Default values
        try {
            // Check if ownerId exists before fetching
            if (guild.ownerId) {
                owner = await API.client.users.fetch(guild.ownerId);
            } else {
                 console.warn(`[WARN] Could not fetch owner for guild ${guild.name} (${guild.id}) - ownerId unavailable.`);
            }
        } catch (fetchError) {
             console.error(`[ERROR] Failed to fetch owner for guild ${guild.name} (${guild.id}):`, fetchError);
             API.client.emit('error', fetchError); // Log the error
        }

        // ATUALIZAÇÃO v14: new Discord.MessageEmbed() -> new API.EmbedBuilder()
        const embed = new API.EmbedBuilder();
        embed.setDescription(`Saiu de um servidor: ${guild.name} | ${guild.id}\nOwner: ${owner.id} (${owner.tag})`) // Member count might be unavailable on guildDelete
        .setColor('#eb4634');

        const logChannel = client.channels.cache.get('1155257983450746892');
        if (logChannel) {
             logChannel.send({ embeds: [embed] }).catch(err => API.client.emit('error', err)); // Add error handling
        } else {
             console.warn('[WARN] Log channel for guildDelete not found.');
        }
    }
}