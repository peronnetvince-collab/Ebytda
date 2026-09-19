"use strict";

// V31 HARD STOP. This is not an environment switch and is intentionally not configurable.
// No execution-capable broker adapter or API credential reader exists in this release.
const LIVE_TRADING_ENABLED = false;
const PAPER_MIN_USDT = 10;
const PAPER_MAX_USDT = 1000;
const DEMO_FEE_PCT = 0.43666666665; // One side of V30's paper fee proxy (0.873333% roundtrip).

function response(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    },
    body: JSON.stringify(payload),
  };
}
function fail(status, code, message) {return response(status,{ok:false,code,message,liveTradingEnabled:false});}
function methodOnly(event, method) {
  if (event.httpMethod !== method) return fail(405,'METHOD_NOT_ALLOWED',`Méthode ${method} requise.`);
  const origin = event.headers?.origin || event.headers?.Origin;
  const host = event.headers?.host || event.headers?.Host || event.headers?.['x-forwarded-host'];
  if (origin && host) {
    try {
      if (new URL(origin).host.toLowerCase() !== String(host).toLowerCase())
        return fail(403,'ORIGIN_DENIED','Origine différente du site.');
    } catch {return fail(403,'ORIGIN_DENIED','Origine invalide.');}
  }
  return null;
}
function parse(event) {
  if ((event.body||'').length > 16000) throw new Error('TICKET_TOO_LARGE');
  let obj;
  try {obj=JSON.parse(event.body||'{}');} catch {throw new Error('INVALID_JSON');}
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('INVALID_PAYLOAD');
  const forbidden = ['apikey','apisecret','secret','passphrase','password','credential','privatekey','mnemonic','seedphrase','access_token'];
  if (Object.keys(obj).some(k => forbidden.some(s => k.replace(/[_-]/g,'').toLowerCase().includes(s.replace(/[_-]/g,'')))))
    throw new Error('SECRETS_NOT_ACCEPTED');
  return obj;
}
function positive(v, min, max, label) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') throw new Error(`INVALID_${label}`);
  const n=Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`INVALID_${label}`);
  return n;
}
function ticket(raw) {
  if (raw.mode !== 'paper') throw new Error('REAL_TRADING_DISABLED');
  const symbol=String(raw.symbol||'').toUpperCase();
  if (!/^[A-Z0-9]{2,15}$/.test(symbol)) throw new Error('INVALID_SYMBOL');
  if (!['BUY','SELL'].includes(raw.side)) throw new Error('INVALID_SIDE');
  if (!['DAY','WEEK'].includes(raw.horizon)) throw new Error('INVALID_HORIZON');
  if (!['MARKET','LIMIT'].includes(raw.type)) throw new Error('INVALID_ORDER_TYPE');
  if (!['UNDECIDED','KRAKEN','BINANCE','COINBASE','OTHER'].includes(raw.broker)) throw new Error('INVALID_BROKER');
  const amountUSDT=positive(raw.amountUSDT,PAPER_MIN_USDT,PAPER_MAX_USDT,'AMOUNT');
  const referencePriceUSDT=positive(raw.referencePriceUSDT,0.000000001,1e12,'PRICE');
  const limitPriceUSDT=raw.type==='LIMIT'?positive(raw.limitPriceUSDT,0.000000001,1e12,'LIMIT_PRICE'):null;
  const previewPriceUSDT=limitPriceUSDT||referencePriceUSDT;
  const stopLossUSDT=(raw.stopLossUSDT===null||raw.stopLossUSDT===undefined||raw.stopLossUSDT==='')?null:positive(raw.stopLossUSDT,0.000000001,1e12,'STOP');
  const takeProfitUSDT=(raw.takeProfitUSDT===null||raw.takeProfitUSDT===undefined||raw.takeProfitUSDT==='')?null:positive(raw.takeProfitUSDT,0.000000001,1e12,'TARGET');
  if (raw.side==='BUY') {
    if (stopLossUSDT !== null && stopLossUSDT >= previewPriceUSDT) throw new Error('STOP_MUST_BE_BELOW_ENTRY');
    if (takeProfitUSDT !== null && takeProfitUSDT <= previewPriceUSDT) throw new Error('TARGET_MUST_BE_ABOVE_ENTRY');
  }
  if (raw.side==='SELL' && (stopLossUSDT !== null||takeProfitUSDT !== null)) throw new Error('SELL_HAS_NO_STOPS_IN_V31');
  const quantityEstimate=amountUSDT/previewPriceUSDT;
  const feeEstimateUSDT=amountUSDT*DEMO_FEE_PCT/100;
  return {
    symbol,side:raw.side,horizon:raw.horizon,type:raw.type,broker:raw.broker,
    amountUSDT,referencePriceUSDT,limitPriceUSDT,previewPriceUSDT,
    stopLossUSDT,takeProfitUSDT,quantityEstimate,feeEstimateUSDT,
    previewStatus:'PAPER_ONLY',priceSource:'EBYTDA_CLIENT_REFERENCE',
    executionPriceGuaranteed:false,brokerConnected:false,
    stopsPlaced:false,liveTradingEnabled:LIVE_TRADING_ENABLED,
  };
}
function errorResponse(e) {
  const code=String(e?.message||'INVALID_TICKET');
  if (code==='REAL_TRADING_DISABLED') return fail(403,code,'Trading réel désactivé : seules les simulations sont autorisées.');
  return fail(400,code,'Ticket invalide ou incompatible avec les règles de simulation V31.');
}
module.exports={LIVE_TRADING_ENABLED,PAPER_MIN_USDT,PAPER_MAX_USDT,DEMO_FEE_PCT,response,fail,methodOnly,parse,ticket,errorResponse};
