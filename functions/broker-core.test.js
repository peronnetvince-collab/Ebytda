'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const core=require('../functions/_broker-core');
const status=require('../functions/broker-status');
const preview=require('../functions/broker-preview');
const paper=require('../functions/broker-paper-order');
const live=require('../functions/broker-live-order');
const auto=require('../functions/broker-auto-order');
const ticket={mode:'paper',broker:'UNDECIDED',symbol:'BTC',side:'BUY',horizon:'DAY',type:'MARKET',amountUSDT:100,referencePriceUSDT:50000,stopLossUSDT:48000,takeProfitUSDT:54000};
const get={httpMethod:'GET',headers:{host:'test.local',origin:'https://test.local'}};
const post=(body)=>({httpMethod:'POST',headers:{host:'test.local',origin:'https://test.local'},body:JSON.stringify(body)});
const body=r=>JSON.parse(r.body);
test('server hard locks all live and auto requests',async()=>{
  assert.equal(core.LIVE_TRADING_ENABLED,false);
  for(const fn of [live.handler,auto.handler]) {
    for (const method of ['GET','POST']) {
      const r=await fn({...post({...ticket,mode:'live'}),httpMethod:method});
      assert.equal(r.statusCode,403);assert.equal(body(r).liveTradingEnabled,false);
    }
  }
});
test('status explicitly identifies missing broker and demo authentication',async()=>{
  const r=await status.handler(get);assert.equal(r.statusCode,200);
  assert.equal(body(r).brokerConnected,false);
  assert.equal(body(r).liveTradingEnabled,false);
  assert.equal(body(r).authMode,'DEMO_FRONTEND_ONLY');
});
test('paper preview validated; no fill, fees and quantity estimates',async()=>{
  const r=await preview.handler(post(ticket));assert.equal(r.statusCode,200);
  const t=body(r).ticket;assert.equal(t.quantityEstimate,.002);assert.ok(t.feeEstimateUSDT>0);
  assert.equal(t.stopsPlaced,false);assert.equal(t.brokerConnected,false);
});
test('paper order responds SIMULATED_NOT_EXECUTED and no broker id',async()=>{
  const r=await paper.handler(post({...ticket,clientOrderId:'paper_test_123456789'}));
  assert.equal(r.statusCode,200);
  assert.equal(body(r).status,'SIMULATED_NOT_EXECUTED');
  assert.equal(body(r).brokerOrderId,null);
});
test('real mode rejected even via paper endpoints',async()=>{
  for(const fn of [paper.handler,preview.handler]) {
    const r=await fn(post({...ticket,mode:'live',clientOrderId:'paper_test_123456789'}));
    assert.equal(r.statusCode,403);
  }
});
test('bad amount, stop, side, credentials and cross-origin rejected',async()=>{
  const bad=[{amountUSDT:10000000},{stopLossUSDT:51000},{side:'SHORT'},{secret:'oops'},
    {referencePriceUSDT:'-12'},{horizon:'MONTH'},{symbol:'BTC/USDT'}];
  for (const b of bad) {
    const r=await preview.handler(post({...ticket,...b}));assert.notEqual(r.statusCode,200,JSON.stringify(b));
  }
  const cross=await preview.handler({...post(ticket),headers:{host:'test.local',origin:'https://evil.test'}});
  assert.equal(cross.statusCode,403);
});
test('method restrictions and no cross-origin access response headers',async()=>{
  const r=await paper.handler(get);assert.equal(r.statusCode,405);
  const s=await status.handler(get);
  assert.equal(s.headers['Cache-Control'],'no-store, private, max-age=0');
  assert.equal(Object.hasOwn(s.headers,'Access-Control-Allow-Origin'),false);
});
