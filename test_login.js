// test_minimal_login.js
require('dotenv').config(); // Para carregar o token do .env
require('colors'); // Para logs coloridos

// Importa apenas o necessário do discord.js
const { Client, GatewayIntentBits, IntentsBitField } = require('discord.js');

console.log('--- Teste de Login Mínimo ---'.yellow);

// Obtém o token diretamente do ambiente (como o ShardingManager faz)
const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.error('ERRO: Token DISCORD_TOKEN não encontrado no ficheiro .env!'.red);
    process.exit(1);
} else {
    console.log(`Token encontrado (termina com ...${token.slice(-5)})`.green);
}

// Define as mesmas intents que o seu NisrukshaClient usa
const myIntents = new IntentsBitField().add(
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
);

console.log('Intents definidos:', myIntents.toArray());

// Cria um cliente Discord básico
const client = new Client({
    intents: myIntents
    // Não adicionamos allowedMentions aqui para simplificar
});

console.log('Cliente Discord criado. Tentando fazer login...'.cyan);

// Evento 'ready' para saber se o login funcionou
client.once('ready', () => {
    console.log(`--- SUCESSO! --- Login realizado como ${client.user.tag}`.green.bold);
    client.destroy(); // Desconecta após o teste
    process.exit(0); // Sai com sucesso
});

// Evento 'error' para capturar erros durante o login ou conexão
client.on('error', (error) => {
    console.error('--- ERRO NO CLIENTE DISCORD ---'.red.bold, error);
});

// Tenta fazer o login
client.login(token).catch(err => {
    console.error('--- ERRO AO CHAMAR LOGIN() ---'.red.bold, err);
    process.exit(1); // Sai com erro se o login() falhar imediatamente
});

console.log('Chamada client.login() efetuada. Aguardando eventos...');