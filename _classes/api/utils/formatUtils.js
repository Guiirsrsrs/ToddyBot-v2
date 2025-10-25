const moment = require('moment'); // Mover import do moment para cá
moment.suppressDeprecationWarnings = true;

const formatUtils = {};

formatUtils.ms = function(s) {
    function pad(n, z) { z = z || 2; return ('00' + n).slice(-z); }
    var ms = s % 1000; s = (s - ms) / 1000; var secs = s % 60; s = (s - secs) / 60; var mins = s % 60; var hrs = (s - mins) / 60;
    var days = parseInt(Math.floor(hrs / 24)); hrs = parseInt(hrs % 24); var meses = parseInt(Math.floor(days / 30)); days = parseInt(days % 30);
    return (meses > 0 ? pad(meses) + ' mêses, ' : "") + (days > 0 ? pad(days) + ' dias, ' : "") + (hrs > 0 ? pad(hrs) + ' horas, ' : "") + (mins > 0 ? pad(mins) + ' minutos e ' : "") + (pad(secs) + ' segundos');
};

formatUtils.ms2 = function(s) {
    function pad(n, z) { z = z || 2; return ('00' + n).slice(-z); }
    var ms = s % 1000; s = (s - ms) / 1000; var secs = s % 60; s = (s - secs) / 60; var mins = s % 60; var hrs = (s - mins) / 60;
    var days = parseInt(Math.floor(hrs / 24)); hrs = parseInt(hrs % 24); var meses = parseInt(Math.floor(days / 30)); days = parseInt(days % 30);
    return (meses > 0 ? pad(meses) + 'mo, ' : "") + (days > 0 ? pad(days) + 'd, ' : "") + (hrs > 0 ? pad(hrs) + 'h, ' : "") + (mins > 0 ? pad(mins) + 'm e ' : "") + (pad(secs) + 's');
};

formatUtils.format = function(num) {
    if (typeof num !== 'number' || isNaN(num)) { return '0'; }
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
};

formatUtils.getProgress = function(maxticks, tickchar, seekpos, atual, max, percento) {
    const percentage = atual / max; const progress = Math.round((maxticks * percentage)); const emptyProgress = maxticks - progress;
    if (typeof tickchar == 'object') {
        for (let xii = 0; xii < Object.keys(tickchar).length; xii++) {
            if ( Math.round(percentage*100) >= parseInt(Object.keys(tickchar).reverse()[xii])){
                tickchar = tickchar[Object.keys(tickchar).reverse()[xii]]; break;
            }
        }
    }
    const progressText = tickchar.repeat(progress); const emptyProgressText = seekpos.repeat(emptyProgress);
    const bar = '[' + progressText + emptyProgressText + "] "+ (percento ? Math.round((percentage)*100) + "%" : "(" + atual + "/" + max +")");
    return bar;
};

formatUtils.toNumber = function(x) {
    if (typeof x !== 'string') x = String(x);
    return parseInt(x.replace(/k/gi, '000').replace(/m/gi, '000000').replace(/b/gi, '000000000').replace(/[^0-9]/g, '')) || 0;
};

formatUtils.getFormatedDate = function(onlyhour) {
    const date = moment();
    const buildInput = 'DD/MM/YYYY [|] HH:mm';
    const buildInput2 = 'HH:mm';
    return date.format(onlyhour ? buildInput2 : buildInput);
};

module.exports = formatUtils;