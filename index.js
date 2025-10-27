// index.js

require("colors");

// Importa as classes
const ToddyClient = require('./_classes/ToddyClient'); // Usa o nome da sua classe
const Bootstrapper = require('./_classes/startup/Bootstrapper');
const config = require("./_classes/config");

// 1. Instancia o cliente (o construtor agora é mais leve)
const client = new ToddyClient(config);

// 2. Cria o Bootstrapper, passando a instância do cliente
const bootstrapper = new Bootstrapper(client);

// 3. Inicia o processo de boot
// O ShardingManager vai iniciar este ficheiro, e o bootstrapper.initialize()
// vai executar a sequência correta (DB -> Eventos -> Comandos (só ficheiros) -> Express -> Login)
bootstrapper.initialize();

// O resto (registo de comandos, etc.) acontece no evento 'ready'