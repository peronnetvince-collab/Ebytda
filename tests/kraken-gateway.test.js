'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const crypto=require('node:crypto');
const Module=require('node:module');
const b=require('../functions/_kraken-bridge');
const status=require('../functions/broker-kraken-status');
const preview=require('../functions/broker-kraken-preview');
const place=require('../functions/broker-kraken-place');
const pass='V31-2-cette-phrase-est-un-test-privé';
const salt=crypto.randomBytes(16);
const hash=crypto.scryptSync(pass,salt,64);
const env={EBYTDA_ENABLE_MANUAL_KRAKEN:'true',KRAKEN_SPOT_API_KEY:'test_key',
  KRAKEN_SPOT_API_SECRET:crypto.randomBytes(32).toString('base64'),
  EBYTDA_ORDER_PASSPHRASE_SCRYPT:salt.toString('hex')+':'+hash.toString('hex'),
  EBYTDA_PREVIEW_HMAC_SECRET:'this-only-for-test-hmac-secret-must-be-long',
  EBYTDA_LIVE_MAX_QUOTE:'50'};
const req=raw=>({httpMethod:'POST',headers:{host:'ebyt.test',origin:'https://ebyt.test'},body:JSON.stringify(raw)});
const raw={mode:'manual_live',broker:'KRAKEN',type:'LIMIT',symbol:'BTC',quote:'EUR',side:'BUY',
  horizon:'DAY',amountQuote:20,limitPriceQuote:50000,orderPassphrase:pass};
const data=r=>JSON.parse(r.body);
function mockMarket(url,init={}){
  const path=new URL(url).pathname;
  if(path.endsWith('/AssetPairs'))return Promise.resolve(new Response(JSON.stringify({error:[],result:{XXBTZEUR:{
    wsname:'XBT/EUR',status:'online',base:'XXBT',quote:'ZEUR',lot_decimals:8,
    pair_decimals:1,ordermin:'0.00001',costmin:'1'}}}),{status:200}));
  if(path.endsWith('/Ticker'))return Promise.resolve(new Response(JSON.stringify({error:[],result:{XXBTZEUR:{a:['50100'],b:['49900']}}}),{status:200}));
  if(path.endsWith('/BalanceEx'))return Promise.resolve(new Response(JSON.stringify({error:[],result:{ZEUR:{balance:1000,hold_trade:0},XXBT:{balance:.1,hold_trade:0}}}),{status:200}));
  if(path.endsWith('/AddOrder')){
    const body=new URLSearchParams(init.body);const result=body.get('validate')==='true'?{descr:{order:'validated'}}:{txid:['KRK-ABC-123']};
    return Promise.resolve(new Response(JSON.stringify({error:[],result}),{status:200}));
  }
  throw Error('Unexpected mock fetch '+path);
}
const withEnv=fn=>async()=>{
  const prior={};for(const [k,v] of Object.entries(env)){prior[k]=process.env[k];process.env[k]=v;}
  const original=global.fetch;global.fetch=mockMarket;
  try{await fn();}finally{global.fetch=original;for(const k of Object.keys(env)){
    if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k];}}
};
test('Locked with no broker credentials; no live order',async()=>{
  delete process.env.EBYTDA_ENABLE_MANUAL_KRAKEN;
  assert.equal(b.configured(),false);
  assert.equal(data(await status.handler({httpMethod:'GET'})).manualLiveReady,false);
  const r=await preview.handler(req(raw));assert.equal(r.statusCode,403);
});
test('Only manual EUR/USDC Spot LIMIT; no leverage/USDT/stop; invalid origin rejected',withEnv(async()=>{
  assert.equal(b.configured(),true);assert.equal(b.ownerPassphrase,undefined);
  assert.equal(b.parseOrder(raw).quote,'EUR');
  for(const x of [{type:'MARKET'},{quote:'USDT'},{side:'SHORT'},{stopLossUSDT:49000},
    {amountQuote:51},{amountQuote:1},{symbol:'EUR'}]){
    assert.throws(()=>b.parseOrder({...raw,...x}));}
  assert.equal((await preview.handler(req({...raw,orderPassphrase:'wrong'}))).statusCode,401);
  assert.equal((await preview.handler({...req(raw),headers:{host:'ebyt.test',origin:'https://evil.test'}})).statusCode,403);
}));
test('Server preview uses Kraken assets, spot balances, quote and Kraken validate-only',withEnv(async()=>{
  const r=await preview.handler(req(raw));const x=data(r);
  assert.equal(r.statusCode,200,JSON.stringify(x));
  assert.equal(x.status,'KRAKEN_VALIDATED_NOT_SENT');
  assert.equal(x.market.quantity,'0.00040000');
  assert.equal(x.market.availableQuote,1000);
  assert.equal(b.unseal(x.previewToken).order.quote,'EUR');
}));
test('Order sends only after explicit confirmation; durable idempotency prevents duplicate',withEnv(async()=>{
  const prev=data(await preview.handler(req(raw)));assert.equal(prev.ok,true);
  const no=await place.handler(req({previewToken:prev.previewToken,confirm:false,orderPassphrase:pass}));
  assert.equal(no.statusCode,403);
  const orig=Module._load,ledger=new Map();
  Module._load=function(request,...args){if(request==='@netlify/blobs')return {getStore:()=>({
    setJSON:async(key,v,opts)=>{if(opts?.onlyIfNew&&ledger.has(key))return {modified:false};
    ledger.set(key,v);return {modified:true};}
  })};return orig.call(this,request,...args);};
  try{
    const r=await place.handler(req({previewToken:prev.previewToken,confirm:true,orderPassphrase:pass}));
    const x=data(r);assert.equal(r.statusCode,200,JSON.stringify(x));
    assert.equal(x.status,'SUBMITTED_UNRECONCILED');assert.equal(x.brokerOrderId,'KRK-ABC-123');
    const dupe=await place.handler(req({previewToken:prev.previewToken,confirm:true,orderPassphrase:pass}));
    assert.equal(dupe.statusCode,409);assert.equal(data(dupe).code,'PREVIEW_ALREADY_USED');
  }finally{Module._load=orig;}
}));
test('No live orders when durable ledger is unavailable',withEnv(async()=>{
  const prev=data(await preview.handler(req(raw)));const r=await place.handler(req({previewToken:prev.previewToken,confirm:true,orderPassphrase:pass}));
  // On a plain Node test runtime, @netlify/blobs is absent and no order is transmitted.
  assert.equal(r.statusCode,503);assert.equal(data(r).code,'DURABLE_LEDGER_UNAVAILABLE');
}));
