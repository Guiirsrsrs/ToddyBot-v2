// index.js

require("colors")

// Iniciar client
const NisrukshaClient = require('./_classes/NisrukshaClient')
const config = require("./_classes/config")

// Apenas instancie o cliente (shard). O ShardingManager fará o login.
const client = new NisrukshaClient(config)