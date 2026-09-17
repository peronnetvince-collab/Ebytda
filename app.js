(() => {
'use strict';

const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;

const CONFIG={
  api:'https://api.coingecko.com/api/v3',
  scanMs:15*60*1000,
  positionMs:60*1000,
  universeSize:300,
  startingCapitalUSDC:3000,
  marginPerOrderUSDC:100,
  maxPositions:10,
  // Proxy A/R pour la simulation : Bitget Futures taker 0,12% + eToro crypto CFD 2,00% + proxy XTB 0,50%, moyenne / 3.
  // XTB n'a pas un frais crypto universel fixe : spread, conversion éventuelle et financement varient.
  brokerFees:{bitgetRoundTripPct:0.12,etoroRoundTripPct:2.00,xtbRoundTripProxyPct:0.50},
  feeRoundTripPct:(0.12+2.00+0.50)/3,
  feePerSidePct:((0.12+2.00+0.50)/3)/2,
  stable:new Set(['usdt','usdc','dai','fdusd','usde','usds','pyusd','tusd','usdd','frax','usdp','gusd','eurs','eurc']),
  posKey:'ebyt-da-v5-positions',
  closedKey:'ebyt-da-v5-closed',
  decisionKey:'ebyt-da-v5-decisions',
  creditKey:'ebyt-da-v5-credits',
  usedKey:'ebyt-da-v5-credits-used',
  autoKey:'ebyt-da-v5-autopilot',
  unitKey:'ebyt-da-v5-unit',
  authKey:'ebyt-da-v4-auth',
  authEmailKey:'ebyt-da-v4-auth-email',
  adminEmail:'admin@ebytda.local',
  demoPass:'EBYTDA-ADMIN-2026'
};

const state={
  lang:localStorage.getItem('ebyt-lang')||'fr',
  unit:localStorage.getItem(CONFIG.unitKey)||'usdc',
  view:'home',
  rows:[],ranked:[],market:{},selected:null,chartDays:1,
  nextScan:null,scanTimer:null,countTimer:null,posTimer:null,
  positions:JSON.parse(localStorage.getItem(CONFIG.posKey)||'[]'),
  closed:JSON.parse(localStorage.getItem(CONFIG.closedKey)||'[]'),
  decisions:JSON.parse(localStorage.getItem(CONFIG.decisionKey)||'[]'),
  credits:Number(localStorage.getItem(CONFIG.creditKey)||10000),
  creditsUsed:Number(localStorage.getItem(CONFIG.usedKey)||0),
  autoPilot:localStorage.getItem(CONFIG.autoKey)!=='0',
  auth:localStorage.getItem(CONFIG.authKey)==='1',
  authEmail:localStorage.getItem(CONFIG.authEmailKey)||'',
  fx:{usdcUsd:1,usdcEur:0.85,paxgUsd:4000,paxgEur:3400},
  chart:null,candleSeries:null,lastScanAt:null
};

function toast(m){const e=$('#toast');if(!e)return;e.textContent=m;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),3200)}
function score(v){return Number(v||0).toFixed(2)}
function pct(v,d=2){return Number.isFinite(Number(v))?`${Number(v)>=0?'+':''}${Number(v).toFixed(d)} %`:'—'}
function klass(v){return num(v)>=0?'pos':'neg'}
function seed(s){let x=0;for(const c of String(s))x=(x*31+c.charCodeAt(0))%1009;return(x%1000)/1000}
function avatar(sym){const txt=(sym||'?').toUpperCase().slice(0,3);return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" rx="40" fill="#0e2230"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#f3d77f" font-size="24" font-family="Arial" font-weight="700">${txt}</text></svg>`)}

function usdToUsdc(v){return num(v)/Math.max(state.fx.usdcUsd,0.000001)}
function usdcToUnit(v){
  const x=num(v);
  if(state.unit==='eur')return x*state.fx.usdcEur;
  if(state.unit==='gold')return x*state.fx.usdcUsd/Math.max(state.fx.paxgUsd,1);
  return x;
}
function fmtValue(usdc){
  const v=usdcToUnit(usdc);
  if(state.unit==='eur')return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:Math.abs(v)<1?6:2}).format(v);
  if(state.unit==='gold')return `${v.toLocaleString('fr-FR',{maximumFractionDigits:6})} oz Au`;
  return `${v.toLocaleString('fr-FR',{maximumFractionDigits:Math.abs(v)<1?6:2})} USDC`;
}
function fmtPriceUsd(usd){return fmtValue(usdToUsdc(usd))}
function compactUsd(usd){
  const usdc=usdToUsdc(usd),v=usdcToUnit(usdc);
  if(state.unit==='eur')return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',notation:'compact',maximumFractionDigits:1}).format(v);
  if(state.unit==='gold')return `${v.toLocaleString('fr-FR',{notation:'compact',maximumFractionDigits:2})} oz`;
  return `${new Intl.NumberFormat('fr-FR',{notation:'compact',maximumFractionDigits:1}).format(v)} USDC`;
}

function consumeCredits(n=1){state.credits=Math.max(0,state.credits-n);state.creditsUsed+=n;localStorage.setItem(CONFIG.creditKey,String(state.credits));localStorage.setItem(CONFIG.usedKey,String(state.creditsUsed));renderCredits()}
function renderCredits(){if($('#creditBalance'))$('#creditBalance').textContent=state.credits.toLocaleString('fr-FR');if($('#creditUsed'))$('#creditUsed').textContent=`${state.creditsUsed.toLocaleString('fr-FR')} utilisé(s) • scan 300 = 3 crédits`}

function showHome(){
  state.view='home';$('#publicHome').classList.remove('hidden');$('#privateApp').classList.add('hidden');$('#publicNav').classList.remove('hidden');$('#privateNav').classList.add('hidden');$$('.private-only').forEach(x=>x.classList.add('hidden'));$('#personalSpaceBtn').classList.remove('hidden');
  clearTimeout(state.scanTimer);clearInterval(state.countTimer);clearInterval(state.posTimer);window.scrollTo({top:0,behavior:'smooth'});
}
async function showDashboard(){
  if(!state.auth){openAuth();return}
  state.view='private';$('#publicHome').classList.add('hidden');$('#privateApp').classList.remove('hidden');$('#publicNav').classList.add('hidden');$('#privateNav').classList.remove('hidden');$$('.private-only').forEach(x=>x.classList.remove('hidden'));$('#personalSpaceBtn').classList.add('hidden');renderCredits();renderAutoUI();
  if(!state.rows.length)await scan(false);else{renderAll();loadChart()}
  startPositionTimer();setTimeout(()=>document.getElementById('radar').scrollIntoView({block:'start'}),20);
}
function openAuth(){$('#authModal').classList.add('open');$('#authModal').setAttribute('aria-hidden','false');$('#adminEmail').value=CONFIG.adminEmail;setTimeout(()=>$('#adminPass').focus(),80)}
function closeAuth(){$('#authModal').classList.remove('open');$('#authModal').setAttribute('aria-hidden','true')}
function login(){const email=$('#adminEmail').value.trim().toLowerCase(),pass=$('#adminPass').value;if(email!==CONFIG.adminEmail||pass!==CONFIG.demoPass){toast('Identifiants administrateur invalides.');return}state.auth=true;state.authEmail=email;localStorage.setItem(CONFIG.authKey,'1');localStorage.setItem(CONFIG.authEmailKey,email);closeAuth();toast('Espace personnel déverrouillé.');showDashboard()}
function logout(){state.auth=false;state.authEmail='';localStorage.removeItem(CONFIG.authKey);localStorage.removeItem(CONFIG.authEmailKey);showHome();toast('Session fermée.')}

async function fetchFx(){
  try{
    const r=await fetch(`${CONFIG.api}/simple/price?ids=usd-coin,pax-gold&vs_currencies=usd,eur`);if(!r.ok)throw new Error(r.status);const j=await r.json();
    state.fx={usdcUsd:num(j['usd-coin']?.usd,1),usdcEur:num(j['usd-coin']?.eur,state.fx.usdcEur),paxgUsd:num(j['pax-gold']?.usd,state.fx.paxgUsd),paxgEur:num(j['pax-gold']?.eur,state.fx.paxgEur)};
  }catch(e){}
}
async function fetchMarket300(){
  const q=(page)=>`${CONFIG.api}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false&price_change_percentage=1h,24h,7d,30d`;
  const [r1,r2]=await Promise.all([fetch(q(1),{headers:{accept:'application/json'}}),fetch(q(2),{headers:{accept:'application/json'}})]);
  if(!r1.ok||!r2.ok)throw new Error(`API ${r1.status}/${r2.status}`);
  const [a,b]=await Promise.all([r1.json(),r2.json()]);
  const rows=[...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])].slice(0,CONFIG.universeSize);
  if(rows.length<100)throw new Error('Réponse incomplète');return rows;
}
function demoData(){
  const names=[['bitcoin','btc','Bitcoin'],['ethereum','eth','Ethereum'],['tether','usdt','Tether'],['binancecoin','bnb','BNB'],['solana','sol','Solana'],['usd-coin','usdc','USDC'],['ripple','xrp','XRP'],['dogecoin','doge','Dogecoin'],['cardano','ada','Cardano'],['avalanche-2','avax','Avalanche'],['chainlink','link','Chainlink'],['polkadot','dot','Polkadot'],['tron','trx','TRON'],['litecoin','ltc','Litecoin'],['uniswap','uni','Uniswap'],['internet-computer','icp','Internet Computer'],['near','near','NEAR'],['aptos','apt','Aptos'],['arbitrum','arb','Arbitrum'],['optimism','op','Optimism'],['render-token','render','Render'],['sui','sui','Sui'],['aave','aave','Aave'],['cosmos','atom','Cosmos'],['stellar','xlm','Stellar'],['filecoin','fil','Filecoin'],['injective-protocol','inj','Injective'],['the-graph','grt','The Graph'],['maker','mkr','Maker']];
  while(names.length<300){const i=names.length+1;names.push([`asset-${i}`,`c${i}`,`Crypto ${i}`])}
  return names.map((c,i)=>{const s=seed(c[0]),p=i<5?[65000,3500,1,600,150][i]:Math.max(.03,240/(i+1)*(.6+s)),h=(s-.5)*8,d=(seed(c[1]+'d')-.46)*18,w=(seed(c[1]+'w')-.44)*34,m=(seed(c[1]+'m')-.45)*60;return{id:c[0],symbol:c[1],name:c[2],image:'',current_price:p,market_cap_rank:i+1,market_cap:p*(1.3e9/(i+1)),total_volume:p*(7e7/(i+1))*(1+s*2),price_change_percentage_1h_in_currency:h,price_change_percentage_24h:d,price_change_percentage_7d_in_currency:w,price_change_percentage_30d_in_currency:m,ath_change_percentage:-8-(1-s)*75}})
}
function marketStats(rows){
  const tr=rows.filter(r=>!CONFIG.stable.has(r.symbol));const breadth=tr.length?tr.filter(r=>num(r.price_change_percentage_24h)>=0).length/tr.length*100:50;const btc=rows.find(r=>r.symbol==='btc')||tr[0],eth=rows.find(r=>r.symbol==='eth')||tr[1];const b24=num(btc?.price_change_percentage_24h),e24=num(eth?.price_change_percentage_24h);const avg7=tr.length?tr.reduce((a,r)=>a+num(r.price_change_percentage_7d_in_currency),0)/tr.length:0;const vol=tr.length?tr.reduce((a,r)=>a+Math.abs(num(r.price_change_percentage_24h)),0)/tr.length:0;let label='RANGE / MIXTE',base=60;if(breadth>62&&b24>1){label='RISK-ON';base=80}else if(breadth<38&&b24<-1){label='RISK-OFF';base=42}else if(Math.abs(b24)<.8&&Math.abs(avg7)<2){label='MARCHÉ PLAT';base=55}else if(e24>b24+1&&breadth>55){label='ROTATION ALTCOINS';base=77}if(vol>5)label+=' • VOLATIL';return{breadth,btc,vol,label,base};
}
function scoreAsset(r,m){
  const h1=num(r.price_change_percentage_1h_in_currency),d1=num(r.price_change_percentage_24h),d7=num(r.price_change_percentage_7d_in_currency),d30=num(r.price_change_percentage_30d_in_currency),vmc=num(r.total_volume)/num(r.market_cap,1),rank=num(r.market_cap_rank,300),ath=num(r.ath_change_percentage,-50);
  const momentum=clamp(50+h1*8+d1*2.8+d7*.8),trend=clamp(50+d1*2+d7*1.2+d30*.28),volume=clamp(35+Math.log10(Math.max(vmc,.0001)*10000)*14),stability=clamp(84-Math.abs(d1)*3-Math.max(0,Math.abs(h1)-3)*4),tech=clamp(momentum*.36+trend*.34+volume*.20+stability*.10);
  const capQuality=clamp(94-Math.log10(Math.max(rank,1))*19),liquidity=clamp(35+Math.log10(Math.max(num(r.total_volume),1))*5.3),recovery=clamp(90+ath*.4),fund=clamp(capQuality*.45+liquidity*.35+recovery*.20),quant=clamp(tech*.42+volume*.22+stability*.16+liquidity*.12+recovery*.08);
  const rel=d1-num(m.btc?.price_change_percentage_24h),regime=clamp(m.base+rel*2.4+(m.breadth-50)*.25),accel=clamp(50+h1*10+(d1-h1*4)*3),fomo=clamp(accel*.36+volume*.20+tech*.18+quant*.12+regime*.14),riskPenalty=Math.max(0,Math.abs(d1)-9)*1.4+Math.max(0,Math.abs(h1)-5)*2;
  let ai=clamp(tech*.24+quant*.20+fund*.18+regime*.20+fomo*.18-riskPenalty+(seed(r.id)-.5)*1.2);
  const volPenalty=Math.max(0,Math.abs(d1)-6)*2+Math.max(0,Math.abs(h1)-3)*3;const risk=clamp(ai*.36+quant*.20+regime*.20+fund*.12+liquidity*.12-volPenalty);
  let leverage=1;if(risk>=91&&ai>=88&&fomo>=85)leverage=5;else if(risk>=86&&ai>=84)leverage=4;else if(risk>=80&&ai>=78)leverage=3;else if(risk>=72)leverage=2;if(Math.abs(d1)>10)leverage=Math.min(leverage,3);if(m.label.startsWith('RISK-OFF'))leverage=Math.min(leverage,2);
  let status='neutral',label='NEUTRE';if(ai>=82&&fomo>=78&&regime>=56){status='order';label='ORDRE CONSEILLÉ'}else if(ai>=74&&fomo>=68){status='preorder';label='PRÉ-ORDRE'}else if(ai>=64){status='watch';label='À SURVEILLER'}
  const p=usdToUsdc(num(r.current_price)),stopMove=clamp(4.5/leverage,0.9,3.0),tp1Move=clamp(stopMove*1.6,1.5,5),tp2Move=clamp(stopMove*2.8,2.5,8.5);const entryLow=p*.998,entryHigh=p*1.001;
  const reasons=[];if(momentum>72)reasons.push('momentum en accélération');if(volume>68)reasons.push('liquidité solide');if(quant>75)reasons.push('Quant robuste');if(regime>70)reasons.push('régime favorable');if(rel>1.5)reasons.push('surperformance BTC');if(risk<70)reasons.push('Risk Engine prudent');if(!reasons.length)reasons.push('configuration partielle');
  return{...r,currentPriceUSDC:p,tech,quant,fund,regime,fomo,ai,risk,leverage,status,label,entryLow,entryHigh,stopMove,tp1Move,tp2Move,gains:[tp1Move,tp2Move,tp2Move*1.3],reason:reasons.join(' • ')};
}

function recommendedHorizonMinutes(a){const v=Math.abs(num(a.price_change_percentage_24h));if(a.fomo>=90||v>=10)return 240;if(a.fomo>=82||v>=6)return 720;if(a.ai>=78)return 1440;return 2880}
function horizonLabel(min){if(min<60)return`${min} min`;if(min<1440)return`${min/60} h`;return`${min/1440} j`}
function remainingLabel(ms){if(ms<=0)return'FENÊTRE ARRIVÉE';const mins=Math.ceil(ms/60000);if(mins<60)return`${mins} min`;if(mins<1440)return`${Math.floor(mins/60)} h ${mins%60} min`;return`${Math.floor(mins/1440)} j ${Math.floor((mins%1440)/60)} h`}
function positionByAsset(id){return state.positions.find(p=>p.assetId===id)}
function eligibleManual(a){return state.ranked.slice(0,10).some(x=>x.id===a?.id)}
function rankOf(a){const i=state.ranked.findIndex(x=>x.id===a?.id);return i>=0?i+1:null}
function chooseSide(a){return (num(a.price_change_percentage_24h)<-2&&a.regime<50&&a.tech<52)?'short':'long'}
function autoDecision(a){
  const stats=accountStats();
  if(positionByAsset(a.id))return{action:'HOLD',ok:false,why:'déjà ouvert'};
  if(state.positions.length>=CONFIG.maxPositions)return{action:'FULL',ok:false,why:'10 positions ouvertes'};
  if(stats.freeCapital<CONFIG.marginPerOrderUSDC)return{action:'NO CAPITAL',ok:false,why:'capital libre insuffisant'};
  if(a.ai<68||a.fomo<60)return{action:'WAIT',ok:false,why:'score/FOMO insuffisant'};
  if(a.risk<66)return{action:'RISK BLOCK',ok:false,why:'Risk Score trop faible'};
  if(state.market.label.startsWith('RISK-OFF')&&a.regime<48)return{action:'WAIT',ok:false,why:'régime défavorable'};
  return{action:'AUTO OUVRIR',ok:true,why:`Risk ${score(a.risk)} • levier ${a.leverage}×`};
}

function feeAmount(notionalUSDC,sideCount=1){return num(notionalUSDC)*CONFIG.feePerSidePct/100*sideCount}
function openPositionFromAsset(a,{source='AUTO',broker='AUTO • AVG3',side=null,entryUSDC=null,leverage=null,horizonMinutes=null}={}){
  if(state.positions.length>=CONFIG.maxPositions)return false;
  const stats=accountStats();if(stats.freeCapital<CONFIG.marginPerOrderUSDC)return false;
  if(positionByAsset(a.id))return false;
  const lev=clamp(Math.round(leverage||a.leverage||1),1,5),entry=num(entryUSDC,a.currentPriceUSDC),dir=side||chooseSide(a),margin=CONFIG.marginPerOrderUSDC,notional=margin*lev,qty=notional/entry;
  const stopMove=clamp(4.5/lev,0.9,3.0),tp1Move=clamp(stopMove*1.6,1.5,5),tp2Move=clamp(stopMove*2.8,2.5,8.5);
  const stopPrice=dir==='long'?entry*(1-stopMove/100):entry*(1+stopMove/100),tp1Price=dir==='long'?entry*(1+tp1Move/100):entry*(1-tp1Move/100),tp2Price=dir==='long'?entry*(1+tp2Move/100):entry*(1-tp2Move/100);
  const h=horizonMinutes||recommendedHorizonMinutes(a),opened=new Date(),target=new Date(opened.getTime()+h*60000),entryFee=feeAmount(notional,1);
  const p={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())),assetId:a.id,symbol:a.symbol,name:a.name,image:a.image||'',rank:rankOf(a),source,broker,side:dir,leverage:lev,marginOriginal:margin,remainingMargin:margin,notionalOriginal:notional,qtyOriginal:qty,remainingQty:qty,entryPriceUSDC:entry,currentPriceUSDC:entry,stopPriceUSDC:stopPrice,tp1PriceUSDC:tp1Price,tp2PriceUSDC:tp2Price,stopMovePct:stopMove,tp1MovePct:tp1Move,tp2MovePct:tp2Move,entryFeeRemaining:entryFee,partialGrossUSDC:0,partialFeesUSDC:0,partialNetUSDC:0,tp1Hit:false,openedAt:opened.toISOString(),targetCloseAt:target.toISOString(),horizonMinutes:h,exitWindowNotified:false,entryAi:a.ai,entryFomo:a.fomo,entryRisk:a.risk,lastAi:a.ai,lastFomo:a.fomo,lastRisk:a.risk,maxPnlPct:0,minPnlPct:0,status:'open'};
  state.positions.unshift(p);consumeCredits(1);persistPositions();notifyEvent('EBYTDA • Position ouverte',`${a.symbol.toUpperCase()} ${dir.toUpperCase()} • ${lev}× • 100 USDC • ${source}`);return true;
}

function posCalc(p){
  const cur=num(p.currentPriceUSDC,p.entryPriceUSDC),entry=num(p.entryPriceUSDC),sgn=p.side==='short'?-1:1,grossRemaining=num(p.remainingQty)*(cur-entry)*sgn,exitFeeEstimate=feeAmount(cur*num(p.remainingQty),1),netRemaining=grossRemaining-num(p.entryFeeRemaining)-exitFeeEstimate,totalGross=num(p.partialGrossUSDC)+grossRemaining,totalFees=num(p.partialFeesUSDC)+num(p.entryFeeRemaining)+exitFeeEstimate,totalNet=num(p.partialNetUSDC)+netRemaining,baseMargin=Math.max(num(p.marginOriginal,100),1),pnlPct=totalNet/baseMargin*100,target=new Date(p.targetCloseAt).getTime(),remaining=Math.max(0,target-Date.now());
  return{cur,entry,grossRemaining,exitFeeEstimate,netRemaining,totalGross,totalFees,totalNet,pnlPct,remaining,due:Date.now()>=target};
}
function accountStats(){
  const realizedClosed=state.closed.reduce((a,x)=>a+num(x.netPnlUSDC),0),partialRealized=state.positions.reduce((a,p)=>a+num(p.partialNetUSDC),0),marginUsed=state.positions.reduce((a,p)=>a+num(p.remainingMargin),0),openNet=state.positions.reduce((a,p)=>a+posCalc(p).netRemaining,0),openTotalNet=partialRealized+openNet,totalEquity=CONFIG.startingCapitalUSDC+realizedClosed+openTotalNet,freeCapital=CONFIG.startingCapitalUSDC+realizedClosed+partialRealized+openNet-marginUsed;
  return{realizedClosed,partialRealized,marginUsed,openNet,openTotalNet,totalEquity,freeCapital};
}
function takePartialTP1(p,price){
  if(p.tp1Hit||p.remainingQty<=0)return;
  const closeQty=p.remainingQty*.5,ratio=closeQty/p.remainingQty,sgn=p.side==='short'?-1:1,gross=closeQty*(price-p.entryPriceUSDC)*sgn,entryFeeAlloc=p.entryFeeRemaining*ratio,exitFee=feeAmount(price*closeQty,1),net=gross-entryFeeAlloc-exitFee;
  p.partialGrossUSDC+=gross;p.partialFeesUSDC+=entryFeeAlloc+exitFee;p.partialNetUSDC+=net;p.entryFeeRemaining-=entryFeeAlloc;p.remainingQty-=closeQty;p.remainingMargin*=.5;p.tp1Hit=true;notifyEvent('EBYTDA • TP1 atteint',`${p.symbol.toUpperCase()} : 50 % simulé sécurisé • ${fmtValue(net)} net sur la tranche.`);
}
function closePositionInternal(p,reason,price=null){
  const px=num(price,p.currentPriceUSDC),sgn=p.side==='short'?-1:1,grossRem=p.remainingQty*(px-p.entryPriceUSDC)*sgn,exitFee=feeAmount(px*p.remainingQty,1),grossTotal=p.partialGrossUSDC+grossRem,feesTotal=p.partialFeesUSDC+p.entryFeeRemaining+exitFee,netTotal=grossTotal-feesTotal;
  const closed={...p,status:'closed',closedAt:new Date().toISOString(),exitPriceUSDC:px,closeReason:reason,grossPnlUSDC:grossTotal,feesUSDC:feesTotal,netPnlUSDC:netTotal};
  state.positions=state.positions.filter(x=>x.id!==p.id);state.closed.unshift(closed);state.closed=state.closed.slice(0,500);persistPositions();persistClosed();notifyEvent('EBYTDA • Position clôturée',`${p.symbol.toUpperCase()} • ${reason} • P&L net ${fmtValue(netTotal)}`);return closed;
}
function checkPriceExits(){
  let changed=false;
  for(const p of [...state.positions]){
    const c=posCalc(p),px=c.cur,long=p.side==='long';
    if((long&&px<=p.stopPriceUSDC)||(!long&&px>=p.stopPriceUSDC)){closePositionInternal(p,'STOP LOSS AUTO',px);changed=true;continue}
    if(!p.tp1Hit&&((long&&px>=p.tp1PriceUSDC)||(!long&&px<=p.tp1PriceUSDC))){takePartialTP1(p,px);changed=true}
    if((long&&px>=p.tp2PriceUSDC)||(!long&&px<=p.tp2PriceUSDC)){closePositionInternal(p,'TP2 AUTO',px);changed=true;continue}
    if(!p.exitWindowNotified&&c.remaining>0&&c.remaining<=15*60*1000){p.exitWindowNotified=true;notifyEvent('EBYTDA • Fenêtre de sortie',`${p.symbol.toUpperCase()} : horizon dans ${remainingLabel(c.remaining)} • P&L net ${fmtValue(c.totalNet)}`);changed=true}
    if(c.due){closePositionInternal(p,'HORIZON AUTO',px);changed=true;continue}
    const after=posCalc(p);p.maxPnlPct=Math.max(num(p.maxPnlPct,0),after.pnlPct);p.minPnlPct=Math.min(num(p.minPnlPct,0),after.pnlPct);
  }
  if(changed){persistPositions();persistClosed()}
}
function evaluateScoreExits(){
  for(const p of [...state.positions]){
    const a=state.rows.find(x=>x.id===p.assetId);if(!a)continue;p.lastAi=a.ai;p.lastFomo=a.fomo;p.lastRisk=a.risk;const c=posCalc(p),rank=rankOf(a);
    const deteriorated=a.ai<55||(a.ai<p.entryAi-20&&a.fomo<55)||(a.risk<48&&c.pnlPct<0)||(rank&&rank>120&&c.pnlPct<0);
    if(deteriorated)closePositionInternal(p,'SORTIE IA ANTICIPÉE',p.currentPriceUSDC);
  }
}
function logTop3Decisions(){
  const at=new Date().toISOString();const batch=state.ranked.slice(0,3).map((a,i)=>{const d=autoDecision(a);return{at,rank:i+1,assetId:a.id,symbol:a.symbol,name:a.name,ai:a.ai,fomo:a.fomo,risk:a.risk,leverage:a.leverage,decision:d.action,why:d.why}});
  state.decisions.unshift(...batch);state.decisions=state.decisions.slice(0,300);persistDecisions();
}
function runAutoEntries(){
  if(!state.autoPilot)return;
  for(const a of state.ranked.slice(0,3)){
    const d=autoDecision(a);if(d.ok)openPositionFromAsset(a,{source:'AUTO 15MIN',broker:'AUTO • AVG3'});
  }
}

async function scan(manual=false){
  if(state.view!=='private')return;
  $('#refreshBtn').classList.add('spin');let raw,live=true;
  try{await fetchFx();raw=await fetchMarket300()}catch(e){raw=demoData();live=false;toast('API indisponible : données de démonstration sur 300 actifs.')}
  if(live)consumeCredits(3);
  const m=marketStats(raw);state.market=m;state.rows=raw.map(r=>scoreAsset(r,m)).sort((a,b)=>num(a.market_cap_rank)-num(b.market_cap_rank));state.ranked=state.rows.filter(r=>!CONFIG.stable.has(r.symbol)).sort((a,b)=>b.ai-a.ai);state.selected=state.rows.find(r=>r.id===state.selected?.id)||state.ranked[0];
  // Mark-to-market des positions à partir du scan 300
  for(const p of state.positions){const a=state.rows.find(x=>x.id===p.assetId);if(a)p.currentPriceUSDC=a.currentPriceUSDC}
  evaluateScoreExits();checkPriceExits();logTop3Decisions();runAutoEntries();state.lastScanAt=new Date();scheduleScan();renderAll();await loadChart();$('#refreshBtn').classList.remove('spin');if(manual)toast('Scan 300 recalculé + décisions AutoPilot mises à jour.');
}
function scheduleScan(){clearTimeout(state.scanTimer);clearInterval(state.countTimer);state.nextScan=Date.now()+CONFIG.scanMs;state.scanTimer=setTimeout(()=>scan(false),CONFIG.scanMs);state.countTimer=setInterval(renderCountdown,1000);renderCountdown()}
function renderCountdown(){if(!state.nextScan)return;const sec=Math.max(0,Math.floor((state.nextScan-Date.now())/1000)),mm=Math.floor(sec/60),ss=sec%60;$('#countdown').textContent=`${mm}m ${String(ss).padStart(2,'0')}s`;if($('#scanKpi'))$('#scanKpi').textContent=`${mm}:${String(ss).padStart(2,'0')}`}

function renderAll(){
  const top=state.ranked[0],m=state.market;if(!top)return;$('#marketRegime').textContent=m.label;$('#heroImg').src=top.image||avatar(top.symbol);$('#heroName').textContent=`${top.name} (${top.symbol.toUpperCase()})`;$('#heroPrice').textContent=fmtValue(top.currentPriceUSDC);$('#hero24h').textContent=pct(top.price_change_percentage_24h);$('#hero24h').className=klass(top.price_change_percentage_24h);$('#heroScore').textContent=score(top.ai);$('#heroSignal').textContent=top.label;$('#heroReason').textContent=top.reason;$('#engineTech').textContent=score(top.tech);$('#engineQuant').textContent=score(top.quant);$('#engineFund').textContent=score(top.fund);$('#engineRegime').textContent=score(top.regime);$('#engineFomo').textContent=score(top.fomo);$('#kpiSync').textContent=state.lastScanAt?`Dernier scan ${state.lastScanAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`:'—';renderCredits();renderAutoUI();renderTop3();renderCryptoGrid();renderTop10();renderSelected();renderUniverse();renderPositions();renderDecisions();renderClosed();renderPositionKpis();renderCountdown();updateNotificationState();
}
function renderAutoUI(){if($('#autoPilotToggle'))$('#autoPilotToggle').checked=state.autoPilot;if($('#autoPilotLabel'))$('#autoPilotLabel').textContent=state.autoPilot?'AUTO ON':'AUTO OFF';if($('#feeProxy'))$('#feeProxy').textContent=`${CONFIG.feeRoundTripPct.toFixed(4).replace('.',',')} %`}
function advisoryFor(a,i){const pos=positionByAsset(a.id),d=autoDecision(a);if(pos)return['watch',pos.source.startsWith('AUTO')?`AUTO OUVERT ${pos.leverage}×`:'POSITION OUVERTE'];if(d.ok)return['order','AUTO OUVRIR'];if(d.action==='FULL'||d.action==='NO CAPITAL')return['neutral','CAPITAL / LIMITE'];if(i===0&&a.status==='order')return['order','SIGNAL FORT'];if(i===1)return['preorder','PRÉ-ORDRE'];return['watch',d.action]}
function renderTop3(){
  $('#top3').innerHTML=state.ranked.slice(0,3).map((a,i)=>{const[cls,label]=advisoryFor(a,i),d=autoDecision(a);return`<article class="fcard ${cls}"><div class="fcard-head"><div class="asset"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><small>${a.symbol.toUpperCase()}</small></div></div><button class="rank-btn" data-pick="${a.id}">#${i+1}</button></div><div class="score-line"><div><small>FOMO</small><strong>${score(a.fomo)}</strong></div><span class="status-pill ${cls}">${label}</span></div><p>${a.reason}</p><div class="fmeta"><div><small>IA</small><b>${score(a.ai)}</b></div><div><small>RISK / LEVIER</small><b>${score(a.risk)} • ${a.leverage}×</b></div><div><small>DÉCISION</small><b>${d.action}</b></div></div><button class="order-mini-btn" data-order="${a.id}">ORDRE MANUEL →</button></article>`}).join('');
  $$('[data-pick]',$('#top3')).forEach(b=>b.onclick=()=>selectAsset(b.dataset.pick,true));$$('[data-order]',$('#top3')).forEach(b=>b.onclick=e=>{e.stopPropagation();selectAsset(b.dataset.order,false);openOrder()});
}
function renderCryptoGrid(){
  $('#cryptoGrid100').innerHTML=state.rows.slice(0,300).map(a=>`<button class="crypto-tile ${a.ai>=80?'hot':a.ai>=65?'mid':'low'}" data-gridpick="${a.id}" title="${a.name} • IA ${score(a.ai)}"><span>${a.market_cap_rank||'—'}</span><img src="${a.image||avatar(a.symbol)}"><b>${a.symbol.toUpperCase()}</b><em>${score(a.ai)}</em></button>`).join('');$$('[data-gridpick]').forEach(b=>b.onclick=()=>selectAsset(b.dataset.gridpick,true));
}
function renderTop10(){
  $('#top10Rows').innerHTML=state.ranked.slice(0,10).map((a,i)=>`<tr class="${state.selected?.id===a.id?'selected':''}" data-rowpick="${a.id}"><td><button class="table-rank" data-pick="${a.id}">#${i+1}</button></td><td><div class="asset"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><small>${a.symbol.toUpperCase()}</small></div></div></td><td>${fmtValue(a.currentPriceUSDC)}</td><td class="${klass(a.price_change_percentage_24h)}">${pct(a.price_change_percentage_24h)}</td><td><span class="score-chip ${a.tech>=80?'high':''}">${score(a.tech)}</span></td><td><span class="score-chip ${a.quant>=80?'high':''}">${score(a.quant)}</span></td><td><span class="score-chip ${a.fund>=80?'high':''}">${score(a.fund)}</span></td><td><span class="score-chip ${a.regime>=80?'high':''}">${score(a.regime)}</span></td><td><span class="score-chip ${a.fomo>=80?'high':''}">${score(a.fomo)}</span></td><td><span class="score-chip ${a.ai>=80?'high':''}">${score(a.ai)}</span></td><td><span class="status-pill ${a.status}">${a.label} • ${a.leverage}×</span></td><td><button class="table-order-btn" data-order="${a.id}">ORDRE</button></td></tr>`).join('');
  $$('[data-pick]',$('#top10Rows')).forEach(b=>b.onclick=e=>{e.stopPropagation();selectAsset(b.dataset.pick,true)});$$('[data-order]',$('#top10Rows')).forEach(b=>b.onclick=e=>{e.stopPropagation();selectAsset(b.dataset.order,false);openOrder()});$$('[data-rowpick]').forEach(r=>r.onclick=()=>selectAsset(r.dataset.rowpick,true));
}
function trackStats(a){const p90=num(a.price_change_percentage_30d_in_currency)*2.1,posDays=clamp(48+seed(a.id+'p')*30),vol=clamp(Math.abs(num(a.price_change_percentage_24h))*.22+2.8,1,25),dd=-clamp(Math.abs(num(a.ath_change_percentage))*.35,5,65),cont=clamp(22+seed(a.id+'c')*58);return{p90,posDays,vol,dd,cont}}
function selectAsset(id,scroll=false){const a=state.rows.find(x=>x.id===id)||state.ranked.find(x=>x.id===id);if(!a)return;state.selected=a;renderSelected();renderTop10();renderUniverse();loadChart();if(scroll)document.querySelector('.grid').scrollIntoView({behavior:'smooth',block:'start'})}
function renderSelected(){
  const a=state.selected;if(!a)return;const r=rankOf(a),allowed=eligibleManual(a),tr=trackStats(a);$('#chartImg').src=a.image||avatar(a.symbol);$('#chartName').textContent=a.name;$('#chartSymbol').textContent=a.symbol.toUpperCase();$('#chartPrice').textContent=fmtValue(a.currentPriceUSDC);$('#chartChange').textContent=pct(a.price_change_percentage_24h);$('#chartChange').className=`price-change ${klass(a.price_change_percentage_24h)}`;$('#chartRank').textContent=r?`TOP ${r}`:`Rang marché #${a.market_cap_rank||'—'}`;$('#chartEligibility').textContent=allowed?`✓ TOP ${r} • ordre manuel autorisé`:'Graphique seul • hors TOP 10';$('#chartEligibility').className=`eligibility ${allowed?'yes':''}`;$('#selectedStatus').textContent=`${a.label} • ${r?`TOP ${r}`:`#${a.market_cap_rank||'—'}`}`;$('#selectedScore').textContent=score(a.ai);$('#selTech').textContent=score(a.tech);$('#selQuant').textContent=score(a.quant);$('#selFund').textContent=score(a.fund);$('#selRegime').textContent=score(a.regime);$('#selFomo').textContent=score(a.fomo);$('#selRisk').textContent=score(a.risk);$('#selLeverage').textContent=`${a.leverage}×`;$('#entryZone').textContent=`${fmtValue(a.entryLow)} – ${fmtValue(a.entryHigh)}`;const side=chooseSide(a),stop=side==='long'?a.currentPriceUSDC*(1-a.stopMove/100):a.currentPriceUSDC*(1+a.stopMove/100),tp1=side==='long'?a.currentPriceUSDC*(1+a.tp1Move/100):a.currentPriceUSDC*(1-a.tp1Move/100),tp2=side==='long'?a.currentPriceUSDC*(1+a.tp2Move/100):a.currentPriceUSDC*(1-a.tp2Move/100);$('#stopLevel').textContent=fmtValue(stop);$('#tp1Level').textContent=fmtValue(tp1);$('#tp2Level').textContent=fmtValue(tp2);$('#selectedReason').textContent=`${a.reason}. Risk Engine ${score(a.risk)}/100 • levier virtuel proposé ${a.leverage}×.`;$('#gain1').textContent=pct(a.tp1Move*a.leverage);$('#gain2').textContent=pct(a.tp2Move*a.leverage);$('#gain3').textContent=pct(a.tp2Move*a.leverage*1.25);$('#openOrderBtn').disabled=!allowed;$('#orderEligibilityNote').textContent=allowed?`TOP ${r} : ordre manuel simulé disponible. AutoPilot : ${autoDecision(a).action}.`:'Actif hors TOP 10 : ticket manuel verrouillé.';$('#trkPerf').textContent=pct(tr.p90);$('#trkPos').textContent=`${tr.posDays.toFixed(2)} %`;$('#trkVol').textContent=`${tr.vol.toFixed(2)} %`;$('#trkDD').textContent=`${tr.dd.toFixed(2)} %`;$('#trkCont').textContent=`${tr.cont.toFixed(2)} %`;$('#trkScore').textContent=`${Math.round(a.ai)}/100`;
}
function renderUniverse(){
  const q=$('#search').value.trim().toLowerCase(),f=$('#statusFilter').value,list=state.rows.filter(a=>(!q||a.name.toLowerCase().includes(q)||a.symbol.toLowerCase().includes(q))&&(f==='all'||a.status===f));$('#cryptoRows').innerHTML=list.map(a=>`<tr data-chartpick="${a.id}"><td>${a.market_cap_rank||'—'}</td><td><div class="asset"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><small>${a.symbol.toUpperCase()} ${eligibleManual(a)?'• TOP 10':''}</small></div></div></td><td>${fmtValue(a.currentPriceUSDC)}</td><td class="${klass(a.price_change_percentage_1h_in_currency)}">${pct(a.price_change_percentage_1h_in_currency)}</td><td class="${klass(a.price_change_percentage_24h)}">${pct(a.price_change_percentage_24h)}</td><td class="${klass(a.price_change_percentage_7d_in_currency)}">${pct(a.price_change_percentage_7d_in_currency)}</td><td>${compactUsd(a.total_volume)}</td><td><span class="score-chip">${score(a.tech)}</span></td><td><span class="score-chip">${score(a.quant)}</span></td><td><span class="score-chip">${score(a.fund)}</span></td><td><span class="score-chip">${score(a.regime)}</span></td><td><span class="score-chip">${score(a.fomo)}</span></td><td><span class="score-chip ${a.ai>=80?'high':''}">${score(a.ai)}</span></td><td><span class="status-pill ${a.status}">${a.label} • ${a.leverage}×</span></td></tr>`).join('');$$('[data-chartpick]').forEach(r=>r.onclick=()=>selectAsset(r.dataset.chartpick,true));
}

function ensureChart(){if(state.chart||!window.LightweightCharts)return;state.chart=LightweightCharts.createChart($('#chart'),{layout:{background:{type:'solid',color:'#071019'},textColor:'#8ea1af'},grid:{vertLines:{color:'#10202b'},horzLines:{color:'#10202b'}},rightPriceScale:{borderColor:'#1a2a37'},timeScale:{borderColor:'#1a2a37',timeVisible:true,secondsVisible:false},crosshair:{mode:LightweightCharts.CrosshairMode.Normal}});state.candleSeries=state.chart.addCandlestickSeries({upColor:'#34d399',downColor:'#fb7185',borderUpColor:'#34d399',borderDownColor:'#fb7185',wickUpColor:'#34d399',wickDownColor:'#fb7185'});new ResizeObserver(entries=>{for(const e of entries)state.chart.applyOptions({width:e.contentRect.width,height:e.contentRect.height})}).observe($('#chart'))}
function demoCandles(a,days){const count=days===1?48:days===7?84:days===30?90:120,end=Math.floor(Date.now()/1000),step=Math.floor(days*86400/count),out=[];let p=num(a.current_price,1)*(1-(seed(a.id+'c')-.4)*.08);for(let i=count-1;i>=0;i--){const s=(seed(a.id+i)-.5)*.025,o=p,c=o*(1+s),h=Math.max(o,c)*(1+Math.abs(s)*.5+.002),l=Math.min(o,c)*(1-Math.abs(s)*.5-.002);out.push({time:end-i*step,open:o,high:h,low:l,close:c});p=c}const factor=num(a.current_price,1)/out[out.length-1].close;return out.map(c=>({...c,open:c.open*factor,high:c.high*factor,low:c.low*factor,close:c.close*factor}))}
function chartPriceFromUsd(usd){return usdcToUnit(usdToUsdc(usd))}
async function loadChart(){const a=state.selected;if(!a)return;ensureChart();if(!state.candleSeries)return;$('#chartStatus').textContent='Chargement des bougies…';let candles;try{const r=await fetch(`${CONFIG.api}/coins/${encodeURIComponent(a.id)}/ohlc?vs_currency=usd&days=${state.chartDays}`);if(!r.ok)throw new Error(r.status);const j=await r.json();candles=j.map(x=>({time:Math.floor(x[0]/1000),open:chartPriceFromUsd(x[1]),high:chartPriceFromUsd(x[2]),low:chartPriceFromUsd(x[3]),close:chartPriceFromUsd(x[4])}));if(!candles.length)throw new Error('empty');$('#chartStatus').textContent=`Bougies OHLC • ${state.unit.toUpperCase()}`}catch(e){candles=demoCandles(a,state.chartDays).map(x=>({...x,open:chartPriceFromUsd(x.open),high:chartPriceFromUsd(x.high),low:chartPriceFromUsd(x.low),close:chartPriceFromUsd(x.close)}));$('#chartStatus').textContent='Bougies de démonstration'}state.candleSeries.setData(candles);state.chart.timeScale().fitContent()}

function openOrder(){
  const a=state.selected;if(!state.auth){openAuth();return}if(!eligibleManual(a)){toast('Ordre manuel verrouillé : actif hors TOP 10.');return}if(positionByAsset(a.id)){toast('Une position est déjà ouverte sur cet actif.');return}const stats=accountStats();if(stats.freeCapital<CONFIG.marginPerOrderUSDC||state.positions.length>=CONFIG.maxPositions){toast('Capacité de portefeuille atteinte.');return}const r=rankOf(a),autoH=recommendedHorizonMinutes(a);$('#modalAsset').textContent=`${a.name} (${a.symbol.toUpperCase()})`;$('#modalRank').textContent=`TOP ${r}`;$('#capitalInput').value=100;$('#executionInput').value=num(a.currentPriceUSDC).toPrecision(8).replace(/0+$/,'').replace(/\.$/,'');$('#leverageInput').value=a.leverage;$('#ticketAi').textContent=score(a.ai);$('#ticketFomo').textContent=score(a.fomo);const side=$('#sideSelect').value,stop=side==='short'?a.currentPriceUSDC*(1+a.stopMove/100):a.currentPriceUSDC*(1-a.stopMove/100),tp1=side==='short'?a.currentPriceUSDC*(1-a.tp1Move/100):a.currentPriceUSDC*(1+a.tp1Move/100),tp2=side==='short'?a.currentPriceUSDC*(1-a.tp2Move/100):a.currentPriceUSDC*(1+a.tp2Move/100);$('#ticketStop').textContent=fmtValue(stop);$('#ticketTps').textContent=`${fmtValue(tp1)} / ${fmtValue(tp2)}`;$('#ticketHorizon').textContent=`${horizonLabel(autoH)} (IA)`;$('#ticketFees').textContent=fmtValue(CONFIG.marginPerOrderUSDC*a.leverage*CONFIG.feeRoundTripPct/100);$('#horizonSelect').value='auto';$('#manualCheck').checked=false;$('#confirmOrderBtn').disabled=true;$('#orderModal').classList.add('open');$('#orderModal').setAttribute('aria-hidden','false');
}
function closeOrder(){$('#orderModal').classList.remove('open');$('#orderModal').setAttribute('aria-hidden','true')}
function confirmOrder(){const a=state.selected;if(!eligibleManual(a))return;const entry=num($('#executionInput').value,a.currentPriceUSDC),rawH=$('#horizonSelect').value,h=rawH==='auto'?recommendedHorizonMinutes(a):Number(rawH),ok=openPositionFromAsset(a,{source:'MANUEL',broker:$('#brokerSelect').value,side:$('#sideSelect').value,entryUSDC:entry,leverage:a.leverage,horizonMinutes:h});if(!ok){toast('Impossible d’ouvrir la position : limite, capital ou doublon.');return}closeOrder();renderAll();toast(`${a.symbol.toUpperCase()} : position simulée ouverte.`);document.getElementById('positions').scrollIntoView({behavior:'smooth'})}

function persistPositions(){localStorage.setItem(CONFIG.posKey,JSON.stringify(state.positions))}
function persistClosed(){localStorage.setItem(CONFIG.closedKey,JSON.stringify(state.closed))}
function persistDecisions(){localStorage.setItem(CONFIG.decisionKey,JSON.stringify(state.decisions))}
function renderPositions(){
  if(!state.positions.length){$('#positionsList').innerHTML='<div class="empty">Aucune position ouverte. L’AutoPilot peut ouvrir jusqu’à 3 nouvelles positions par scan si le Risk Engine les valide.</div>';return}
  $('#positionsList').innerHTML=state.positions.map(p=>{const c=posCalc(p),cl=c.totalNet>=0?'profit':'loss';return`<article class="position-card ${cl}"><div class="position-top"><div class="position-title"><img src="${p.image||avatar(p.symbol)}"><div><b>${p.name} • ${p.symbol.toUpperCase()}</b><small>${p.side.toUpperCase()} • ${p.broker} • ${p.leverage}× • ${p.source}</small></div></div><div class="pmetric"><span>Entrée</span><b>${fmtValue(c.entry)}</b></div><div class="pmetric"><span>Actuel</span><b>${fmtValue(c.cur)}</b></div><div class="pmetric"><span>P&amp;L NET</span><b class="pnl-big ${klass(c.totalNet)}">${fmtValue(c.totalNet)}</b></div><div class="pmetric"><span>P&amp;L % marge</span><b class="${klass(c.pnlPct)}">${pct(c.pnlPct)}</b></div><button class="close-btn" data-closepos="${p.id}">CLÔTURER</button></div><div class="position-progress"><div class="progress-track"><div class="progress-bar" style="width:${Math.min(100,Math.max(0,c.pnlPct/(p.tp1MovePct*p.leverage)*100))}%"></div></div><div class="progress-label">TP1 ${p.tp1Hit?'✓ sécurisé 50 %':'en attente'} • horizon ${remainingLabel(c.remaining)}</div></div><div class="perf-indexes"><div><span>MFE max</span><b class="pos">${pct(p.maxPnlPct||0)}</b></div><div><span>MAE min</span><b class="neg">${pct(p.minPnlPct||0)}</b></div><div><span>Frais estimés</span><b>${fmtValue(c.totalFees)}</b></div><div><span>RISK entrée</span><b>${score(p.entryRisk)}</b></div><div><span>Levier</span><b>${p.leverage}×</b></div></div><div class="position-meta"><span>Marge restante ${fmtValue(p.remainingMargin)}</span><span>Notionnel initial ${fmtValue(p.notionalOriginal)}</span><span>Stop ${fmtValue(p.stopPriceUSDC)}</span><span>TP1 ${fmtValue(p.tp1PriceUSDC)}</span><span>TP2 ${fmtValue(p.tp2PriceUSDC)}</span><span class="position-window ${c.due?'due':''}">${c.due?'⚠ FENÊTRE DE SORTIE':'⏱ '+remainingLabel(c.remaining)}</span></div></article>`}).join('');$$('[data-closepos]').forEach(b=>b.onclick=()=>manualClose(b.dataset.closepos));
}
function manualClose(id){const p=state.positions.find(x=>x.id===id);if(!p)return;const c=posCalc(p);if(!confirm(`Clôturer ${p.symbol.toUpperCase()} avec P&L net estimé ${fmtValue(c.totalNet)} ?`))return;closePositionInternal(p,'CLÔTURE MANUELLE',p.currentPriceUSDC);renderAll()}
function renderPositionKpis(){const a=accountStats(),pnl=a.openTotalNet,pctTot=CONFIG.startingCapitalUSDC?pnl/CONFIG.startingCapitalUSDC*100:0;$('#capitalTotal').textContent=fmtValue(a.totalEquity);$('#capitalFree').textContent=fmtValue(a.freeCapital);$('#marginUsed').textContent=fmtValue(a.marginUsed);$('#kpiOpen').textContent=`${state.positions.length} / ${CONFIG.maxPositions}`;$('#kpiCapital').textContent=`Marge ${fmtValue(a.marginUsed)} • capacité ${Math.max(0,CONFIG.maxPositions-state.positions.length)} ordre(s)`;$('#kpiPnl').textContent=fmtValue(pnl);$('#kpiPnl').className=`kpi-value ${klass(pnl)}`;$('#kpiPnlPct').textContent=`${pct(pctTot)} • frais proxy inclus`;$('#kpiPnlPct').className=`kpi-sub ${klass(pctTot)}`;$('#capitalTotalSub').textContent=`Base 3 000 USDC + historique + mark-to-market`;$('#capitalFreeSub').textContent=`Après marge réservée • 10×100 = 2 000 USDC avant P&L réalisé`}
function renderDecisions(){
  const e=$('#decisionList');if(!e)return;if(!state.decisions.length){e.innerHTML='<div class="empty">Aucune décision AutoPilot enregistrée.</div>';return}
  e.innerHTML='<div class="decision-head"><b>Dernières décisions AutoPilot</b><span>Top 3 à chaque scan de 15 min</span></div>'+state.decisions.slice(0,30).map(d=>`<div class="decision-row"><span>${new Date(d.at).toLocaleString()}</span><b>#${d.rank} ${d.name} (${d.symbol.toUpperCase()})</b><span>IA ${score(d.ai)} • FOMO ${score(d.fomo)}</span><span>Risk ${score(d.risk)} • ${d.leverage}×</span><strong>${d.decision}</strong></div>`).join('');
}
function renderClosed(){
  if(!state.closed.length){$('#closedList').innerHTML='<div class="empty">Aucune position clôturée enregistrée.</div>';return}
  $('#closedList').innerHTML=state.closed.map(p=>`<div class="closed-row closed-v5"><span>${new Date(p.closedAt).toLocaleString()}</span><b>${p.name} (${p.symbol.toUpperCase()}) • ${p.leverage}×</b><span>${p.closeReason||'—'}</span><span>Brut ${fmtValue(p.grossPnlUSDC)}</span><span>Frais ${fmtValue(p.feesUSDC)}</span><b class="${klass(p.netPnlUSDC)}">Net ${fmtValue(p.netPnlUSDC)}</b></div>`).join('');
}

async function refreshPositionPrices(manual=false){
  if(!state.positions.length){if(manual)toast('Aucune position ouverte.');return}
  try{await fetchFx();const ids=[...new Set(state.positions.map(p=>p.assetId))];const r=await fetch(`${CONFIG.api}/simple/price?ids=${ids.map(encodeURIComponent).join(',')}&vs_currencies=usd`);if(!r.ok)throw new Error();const j=await r.json();for(const p of state.positions){const usd=num(j[p.assetId]?.usd);if(usd)p.currentPriceUSDC=usdToUsdc(usd)}checkPriceExits();persistPositions();renderPositions();renderPositionKpis();if(manual)toast('Prix des positions actualisés.')}catch(e){if(manual)toast('Actualisation des prix indisponible.')}
}
function startPositionTimer(){clearInterval(state.posTimer);state.posTimer=setInterval(()=>refreshPositionPrices(false),CONFIG.positionMs);refreshPositionPrices(false)}

async function requestNotifications(){if(!('Notification'in window)){toast('Notifications navigateur non prises en charge.');return}if(Notification.permission==='granted'){updateNotificationState();toast('Notifications déjà actives.');return}const perm=await Notification.requestPermission();updateNotificationState();toast(perm==='granted'?'Notifications activées.':'Notifications non autorisées.')}
function updateNotificationState(){const e=$('#notifyState');if(!e)return;const p=('Notification'in window)?Notification.permission:'unsupported';e.textContent=p==='granted'?'ON':p==='denied'?'BLOQUÉ':'OFF';e.className=`kpi-value compact-value ${p==='granted'?'pos':''}`}
function notifyEvent(title,body){toast(`${title.replace('EBYTDA • ','')} — ${body}`);if('Notification'in window&&Notification.permission==='granted'){try{new Notification(title,{body,icon:'assets/ebyt-da-logo.png'})}catch(e){}}}

function setUnit(u){state.unit=u;localStorage.setItem(CONFIG.unitKey,u);$$('[data-unit]').forEach(b=>b.classList.toggle('active',b.dataset.unit===u));if(state.rows.length){renderAll();loadChart()}}
function setLang(l){state.lang=l;localStorage.setItem('ebyt-lang',l);$$('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));renderCredits()}
function toggleAuto(){state.autoPilot=$('#autoPilotToggle').checked;localStorage.setItem(CONFIG.autoKey,state.autoPilot?'1':'0');renderAutoUI();toast(state.autoPilot?'AutoPilot simulé activé.':'AutoPilot arrêté : aucune nouvelle ouverture automatique.')}

$('#logoHomeBtn').onclick=showHome;
$('#personalSpaceBtn').onclick=()=>state.auth?showDashboard():openAuth();
$('#heroPersonalBtn').onclick=()=>state.auth?showDashboard():openAuth();
$('#securityPersonalBtn').onclick=()=>state.auth?showDashboard():openAuth();
$('#learnMoreBtn').onclick=()=>document.getElementById('howItWorks').scrollIntoView({behavior:'smooth'});
$('#logoutBtn').onclick=logout;
$('#loginBtn').onclick=login;
$$('[data-close-auth]').forEach(e=>e.onclick=closeAuth);
$$('[data-public-nav]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.publicNav).scrollIntoView({behavior:'smooth'}));
$$('[data-private-nav]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.privateNav).scrollIntoView({behavior:'smooth'}));
$('#refreshBtn').onclick=()=>scan(true);
$('#refreshPositionsBtn').onclick=()=>refreshPositionPrices(true);
$('#search').oninput=renderUniverse;
$('#statusFilter').onchange=renderUniverse;
$('#openOrderBtn').onclick=openOrder;
$('#manualCheck').onchange=e=>$('#confirmOrderBtn').disabled=!e.target.checked;
$('#confirmOrderBtn').onclick=confirmOrder;
$$('[data-close-order]').forEach(e=>e.onclick=closeOrder);
$('#horizonSelect').onchange=()=>{const a=state.selected,val=$('#horizonSelect').value,min=val==='auto'?recommendedHorizonMinutes(a):Number(val);$('#ticketHorizon').textContent=`${horizonLabel(min)}${val==='auto'?' (IA)':''}`};
$('#sideSelect').onchange=()=>{const a=state.selected;if(!a)return;const side=$('#sideSelect').value,stop=side==='short'?a.currentPriceUSDC*(1+a.stopMove/100):a.currentPriceUSDC*(1-a.stopMove/100),tp1=side==='short'?a.currentPriceUSDC*(1-a.tp1Move/100):a.currentPriceUSDC*(1+a.tp1Move/100),tp2=side==='short'?a.currentPriceUSDC*(1-a.tp2Move/100):a.currentPriceUSDC*(1+a.tp2Move/100);$('#ticketStop').textContent=fmtValue(stop);$('#ticketTps').textContent=`${fmtValue(tp1)} / ${fmtValue(tp2)}`};
$('#notifyBtn').onclick=requestNotifications;
$('#autoPilotToggle').onchange=toggleAuto;
$$('[data-lang]').forEach(b=>b.onclick=()=>setLang(b.dataset.lang));
$$('[data-unit]').forEach(b=>b.onclick=()=>setUnit(b.dataset.unit));
$$('[data-days]').forEach(b=>b.onclick=()=>{$$('[data-days]').forEach(x=>x.classList.toggle('active',x===b));state.chartDays=Number(b.dataset.days);loadChart()});
$('#clearHistoryBtn').onclick=()=>{if(confirm("Vider l'historique des positions clôturées ?")){state.closed=[];state.decisions=[];persistClosed();persistDecisions();renderDecisions();renderClosed();renderPositionKpis()}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAuth();closeOrder()}});
$$('[data-unit]').forEach(b=>b.classList.toggle('active',b.dataset.unit===state.unit));
$$('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===state.lang));
renderAutoUI();showHome();renderCredits();
})();
