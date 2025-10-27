// _classes/api/utils/botUtils.js

// Requer a API DENTRO das funções se necessário
const util = require('util'); // Módulo 'util' do Node.js
require('colors'); // Para logs

const botUtils = {};

/**
 * Clona um objeto profundamente.
 * @param {object} obj - O objeto a ser clonado.
 * @returns {object} Uma cópia profunda do objeto.
 */
botUtils.clone = function(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj; // Retorna primitivos ou null/undefined diretamente
    }
    // Usa JSON.parse(JSON.stringify(obj)) para deep clone simples,
    // mas pode ter problemas com tipos como Date, RegExp, Map, Set, funções.
    // Uma alternativa mais robusta seria usar uma biblioteca como lodash.cloneDeep,
    // ou implementar uma cópia recursiva manual.
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        console.error("[ERRO][botUtils.clone] Falha ao clonar objeto:", e);
        // Fallback para cópia superficial se o clone profundo falhar
        return { ...obj };
    }
};

/**
 * Gera um número inteiro aleatório entre min (inclusive) e max (inclusive).
 * @param {number} min - Valor mínimo.
 * @param {number} max - Valor máximo.
 * @returns {number} Número inteiro aleatório.
 */
botUtils.random = function(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Converte milissegundos para uma string de tempo formatada (ex: "1h 30m 15s").
 * Versão simplificada.
 * @param {number} milliseconds - Tempo em milissegundos.
 * @returns {string} String formatada.
 */
botUtils.ms = function(milliseconds) {
    if (typeof milliseconds !== 'number' || milliseconds < 0) {
        return 'Tempo inválido';
    }
    if (milliseconds === 0) return '0s';

    const seconds = Math.floor((milliseconds / 1000) % 60);
    const minutes = Math.floor((milliseconds / (1000 * 60)) % 60);
    const hours = Math.floor((milliseconds / (1000 * 60 * 60)) % 24);
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (seconds > 0 || result === '') result += `${seconds}s`; // Mostra segundos se for a única unidade ou se houver outras

    return result.trim();
};

/**
 * Verifica se um valor é um número inteiro.
 * @param {*} n - Valor a ser verificado.
 * @returns {boolean} True se for inteiro, false caso contrário.
 */
botUtils.isInt = function(n) {
    // Verifica se é número e se é finito (não NaN, Infinity)
    // e se o resto da divisão por 1 é zero
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n;
};


/**
 * Converte milissegundos para uma string de tempo formatada (ex: "1:30:15" ou "30:15").
 * @param {number} milliseconds - Tempo em milissegundos.
 * @returns {string} String formatada (HH:MM:SS ou MM:SS).
 */
botUtils.ms2 = function(milliseconds) {
     if (typeof milliseconds !== 'number' || milliseconds < 0) {
         return '00:00';
     }
     const totalSeconds = Math.floor(milliseconds / 1000);
     const seconds = String(totalSeconds % 60).padStart(2, '0');
     const totalMinutes = Math.floor(totalSeconds / 60);
     const minutes = String(totalMinutes % 60).padStart(2, '0');
     const hours = Math.floor(totalMinutes / 60);

     if (hours > 0) {
         return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
     } else {
         return `${minutes}:${seconds}`;
     }
 };


/**
 * Embaralha os elementos de um array no local (algoritmo Fisher-Yates).
 * @param {Array<any>} array - O array a ser embaralhado.
 * @returns {Array<any>} O mesmo array, agora embaralhado.
 */
botUtils.shuffleArray = function(array) {
    if (!Array.isArray(array)) return array; // Retorna se não for array
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Troca elementos
    }
    return array;
};

/**
 * Gera uma string representando uma barra de progresso.
 * @param {number} value - Valor atual.
 * @param {number} maxValue - Valor máximo.
 * @param {number} [size=10] - Número de caracteres da barra.
 * @returns {string} String da barra de progresso (ex: "[████░░░░░░]").
 */
botUtils.getProgressBar = (value, maxValue, size = 10) => {
    if (value < 0) value = 0;
    if (maxValue <= 0) maxValue = 1; // Evita divisão por zero
    const percentage = Math.max(0, Math.min(1, value / maxValue)); // Garante percentual entre 0 e 1
    const progress = Math.round(size * percentage);
    const emptyProgress = size - progress;

    const progressText = '█'.repeat(progress); // Caractere cheio
    const emptyProgressText = '░'.repeat(emptyProgress); // Caractere vazio

    return `[${progressText}${emptyProgressText}]`;
};


// Exporta o objeto com as funções utilitárias
module.exports = botUtils;