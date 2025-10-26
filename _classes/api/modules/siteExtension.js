// _classes/api/modules/siteExtension.js

const siteExtension = {}
const API = require("../index");

siteExtension.log = async function (id, action) {

    let member = await API.client.users.fetch(id)

    // ATUALIZAÇÃO v14: API.Discord.MessageEmbed -> API.EmbedBuilder
    const embed = new API.EmbedBuilder()
    embed.setTitle('<:info:736274028515295262> Informações de ação')
    embed.setDescription(`
Usuário acionador: ${member} | ${member.tag} | ${member.id}
Ação executada: ${action}
    `).setColor('#5d7fc7')

    API.client.channels.cache.get('773223319603904522').send({ embeds: [embed]});
}

module.exports = siteExtension