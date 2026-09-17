(() => {
'use strict';

const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;

const CONFIG={
  api:'https://api.coingecko.com/api/v3',
  scanMs:15*60*1000,
  positionMs:15*1000,
  universeSize:300,
  startingCapitalUSDC:3000,
  marginPerOrderUSDC:100,
  maxPositions:15,
  minPositions:3,
  maxHorizonMinutes:5*24*60,
  minAiExitMinutes:240,
  severeExitMinMinutes:60,
  reentryCooldownMinutes:6*60,
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
  demoPass:'EBYTDA-ADMIN-2026',
  v8ResetKey:'ebyt-da-v8-clean-reset-done',
  maxNewEntriesPerScan:6,
  mandatoryTop1RiskFloor:43,
  mandatoryTop1EdgeFloor:0.8,
  riskProfile:'AI-MANAGED',
  newEntryDrawdownPausePct:6
};

// V9 : aucune remise à zéro automatique. Le portefeuille et l'historique restent cumulatifs.

const state={
  lang:localStorage.getItem('ebyt-lang')||'fr',
  unit:(localStorage.getItem(CONFIG.unitKey)||'usdt')==='usdc'?'usdt':(localStorage.getItem(CONFIG.unitKey)||'usdt'),
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
  chart:null,candleSeries:null,lastScanAt:null,liveMarket:false,dataMode:'INIT',lastApiError:''
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
  return `${v.toLocaleString('fr-FR',{maximumFractionDigits:Math.abs(v)<1?6:2})} USDT`;
}
function fmtPriceUsd(usd){return fmtValue(usdToUsdc(usd))}
function compactUsd(usd){
  const usdc=usdToUsdc(usd),v=usdcToUnit(usdc);
  if(state.unit==='eur')return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',notation:'compact',maximumFractionDigits:1}).format(v);
  if(state.unit==='gold')return `${v.toLocaleString('fr-FR',{notation:'compact',maximumFractionDigits:2})} oz`;
  return `${new Intl.NumberFormat('fr-FR',{notation:'compact',maximumFractionDigits:1}).format(v)} USDT`;
}

function consumeCredits(n=1){state.credits=Math.max(0,state.credits-n);state.creditsUsed+=n;localStorage.setItem(CONFIG.creditKey,String(state.credits));localStorage.setItem(CONFIG.usedKey,String(state.creditsUsed));renderCredits()}
function renderCredits(){if($('#creditBalance'))$('#creditBalance').textContent=state.credits.toLocaleString('fr-FR');if($('#creditUsed'))$('#creditUsed').textContent=`${state.creditsUsed.toLocaleString('fr-FR')} utilisé(s) • scan 300 = 3 crédits`}


const UI_TRANSLATIONS=[
  ['Dashboard','Dashboard'],['Positions','Positions'],['Top 300','Top 300'],['Historique','History'],
  ['CRÉDITS DISPONIBLES','AVAILABLE CREDITS'],['ACTIFS SCANNÉS','SCANNED ASSETS'],['CAPITAL TOTAL NET','NET TOTAL CAPITAL'],['CAPITAL DISPONIBLE','AVAILABLE CAPITAL'],['MARGE ENGAGÉE','COMMITTED CAPITAL'],['POSITIONS OUVERTES','OPEN POSITIONS'],['P&L CUMULÉ','CUMULATIVE P&L'],['P&L RÉALISÉ','REALIZED P&L'],['P&L LATENT','UNREALIZED P&L'],['PROCHAIN SCAN','NEXT SCAN'],['ALERTES AUTO','AUTO ALERTS'],
  ['Moteur automatique sur 300 cryptos • AI MANAGED','Automated engine across 300 cryptos • AI MANAGED'],
  ['Meilleure synthèse parmi les 300 cryptos','Best synthesis across 300 cryptos'],['Du signal brut au FOMO IA','From raw signal to AI FOMO'],['Top 3 — consensus IA LONG / SHORT','Top 3 — AI LONG / SHORT consensus'],['Vue en liste du Top 300','Top 300 list view'],['Historique des positions clôturées','Closed positions history']
];
function applyLanguage(){
  const en=state.lang==='en';
  const nodes=$$('h1,h2,h3,.kpi-label,.menu-item,.eyebrow,button,.public-menu-item');
  for(const el of nodes){
    const text=(el.textContent||'').trim();
    for(const [fr,enText] of UI_TRANSLATIONS){
      if(text===fr||text===enText){el.textContent=en?enText:fr;break}
    }
  }
  const intro=$('#radar .intro p');if(intro)intro.textContent=en?'Top 300 market caps • AI scan every 15 min • LONG + SHORT • positions held up to 5 days • 3 to 15 positions • 100 USDT without leverage':'300 plus grosses capitalisations • scan IA toutes les 15 min • LONG + SHORT • positions conservées jusqu’à 5 jours • 3 à 15 positions • 100 USDT sans levier';
  if($('#notifyBtn'))$('#notifyBtn').textContent=en?'Enable notifications':'Activer notifications';
}

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


function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function fetchWithTimeout(url,options={},timeoutMs=9000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...options,signal:controller.signal})}
  finally{clearTimeout(timer)}
}
async function fetchJsonRetry(url,options={},retries=1){
  let err;
  for(let i=0;i<=retries;i++){
    try{
      const r=await fetchWithTimeout(url,options,9000);
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return await r.json();
    }catch(e){err=e;if(i<retries)await sleep(900+500*i)}
  }
  throw err;
}

async function fetchFx(){
  try{
    const j=await fetchJsonRetry(`${CONFIG.api}/simple/price?ids=tether,pax-gold&vs_currencies=usd,eur`,{headers:{accept:'application/json'}},1);
    state.fx={usdcUsd:num(j['tether']?.usd,1),usdcEur:num(j['tether']?.eur,state.fx.usdcEur),paxgUsd:num(j['pax-gold']?.usd,state.fx.paxgUsd),paxgEur:num(j['pax-gold']?.eur,state.fx.paxgEur)};
  }catch(e){state.lastApiError=String(e?.message||e)}
}
async function fetchMarket300(){
  const q=(page)=>`${CONFIG.api}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false&price_change_percentage=1h,24h,7d,30d`;
  const a=await fetchJsonRetry(q(1),{headers:{accept:'application/json'}},1);
  await sleep(350);
  const b=await fetchJsonRetry(q(2),{headers:{accept:'application/json'}},1);
  const rows=[...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])].slice(0,CONFIG.universeSize);
  if(rows.length<250)throw new Error(`Réponse marché incomplète (${rows.length}/300)`);
  return rows;
}
function demoData(){
  const names=[['bitcoin','btc','Bitcoin'],['ethereum','eth','Ethereum'],['tether','usdt','Tether'],['binancecoin','bnb','BNB'],['solana','sol','Solana'],['usd-coin','usdc','USDC'],['ripple','xrp','XRP'],['dogecoin','doge','Dogecoin'],['cardano','ada','Cardano'],['avalanche-2','avax','Avalanche'],['chainlink','link','Chainlink'],['polkadot','dot','Polkadot'],['tron','trx','TRON'],['litecoin','ltc','Litecoin'],['uniswap','uni','Uniswap'],['internet-computer','icp','Internet Computer'],['near','near','NEAR'],['aptos','apt','Aptos'],['arbitrum','arb','Arbitrum'],['optimism','op','Optimism'],['render-token','render','Render'],['sui','sui','Sui'],['aave','aave','Aave'],['cosmos','atom','Cosmos'],['stellar','xlm','Stellar'],['filecoin','fil','Filecoin'],['injective-protocol','inj','Injective'],['the-graph','grt','The Graph'],['maker','mkr','Maker']];
  while(names.length<300){const i=names.length+1;names.push([`asset-${i}`,`c${i}`,`Crypto ${i}`])}
  return names.map((c,i)=>{const s=seed(c[0]),p=i<5?[65000,3500,1,600,150][i]:Math.max(.03,240/(i+1)*(.6+s)),h=(s-.5)*8,d=(seed(c[1]+'d')-.46)*18,w=(seed(c[1]+'w')-.44)*34,m=(seed(c[1]+'m')-.45)*60;return{id:c[0],symbol:c[1],name:c[2],image:'',current_price:p,market_cap_rank:i+1,market_cap:p*(1.3e9/(i+1)),total_volume:p*(7e7/(i+1))*(1+s*2),price_change_percentage_1h_in_currency:h,price_change_percentage_24h:d,price_change_percentage_7d_in_currency:w,price_change_percentage_30d_in_currency:m,ath_change_percentage:-8-(1-s)*75}})
}
function marketStats(rows){
  const tr=rows.filter(r=>!CONFIG.stable.has(r.symbol));
  const breadth=tr.length?tr.filter(r=>num(r.price_change_percentage_24h)>=0).length/tr.length*100:50;
  const btc=rows.find(r=>r.symbol==='btc')||tr[0],eth=rows.find(r=>r.symbol==='eth')||tr[1];
  const b24=num(btc?.price_change_percentage_24h),e24=num(eth?.price_change_percentage_24h);
  const avg7=tr.length?tr.reduce((a,r)=>a+num(r.price_change_percentage_7d_in_currency),0)/tr.length:0;
  const vol=tr.length?tr.reduce((a,r)=>a+Math.abs(num(r.price_change_percentage_24h)),0)/tr.length:0;
  let label='RANGE / MIXTE',base=60;
  if(breadth>62&&b24>1){label='RISK-ON';base=80}
  else if(breadth<38&&b24<-1){label='RISK-OFF';base=42}
  else if(Math.abs(b24)<.8&&Math.abs(avg7)<2){label='MARCHÉ PLAT';base=55}
  else if(e24>b24+1&&breadth>55){label='ROTATION ALTCOINS';base=77}
  if(vol>5)label+=' • VOLATIL';
  return{breadth,btc,eth,b24,e24,avg7,vol,label,base};
}
function scoreAsset(r,m){
  const h1=num(r.price_change_percentage_1h_in_currency),d1=num(r.price_change_percentage_24h),d7=num(r.price_change_percentage_7d_in_currency),d30=num(r.price_change_percentage_30d_in_currency),vmc=num(r.total_volume)/num(r.market_cap,1),rank=num(r.market_cap_rank,300),ath=num(r.ath_change_percentage,-50);
  const volume=clamp(35+Math.log10(Math.max(vmc,.0001)*10000)*14),stability=clamp(88-Math.abs(d1)*2.2-Math.max(0,Math.abs(h1)-3)*3.2);
  const capQuality=clamp(94-Math.log10(Math.max(rank,1))*19),liquidity=clamp(35+Math.log10(Math.max(num(r.total_volume),1))*5.3),recovery=clamp(90+ath*.4),fund=clamp(capQuality*.45+liquidity*.35+recovery*.20);
  const longMomentum=clamp(50+h1*8+d1*2.8+d7*.8),shortMomentum=clamp(50-h1*8-d1*2.8-d7*.8);
  const longTrend=clamp(50+d1*2+d7*1.2+d30*.28),shortTrend=clamp(50-d1*2-d7*1.2-d30*.28);
  const longTech=clamp(longMomentum*.36+longTrend*.34+volume*.20+stability*.10),shortTech=clamp(shortMomentum*.36+shortTrend*.34+volume*.20+stability*.10);
  const longQuant=clamp(longTech*.42+volume*.22+stability*.16+liquidity*.12+recovery*.08),shortQuant=clamp(shortTech*.42+volume*.22+stability*.16+liquidity*.12+recovery*.08);
  const rel=d1-num(m.b24,0),longRegime=clamp(m.base+rel*2.4+(m.breadth-50)*.25),shortRegime=clamp((100-m.base)+(-rel)*2.2+(50-m.breadth)*.35+Math.max(0,-num(m.b24))*2.2);
  const longAccel=clamp(50+h1*10+(d1-h1*4)*3),shortAccel=clamp(50-h1*10-(d1-h1*4)*3);
  const longFomo=clamp(longAccel*.36+volume*.20+longTech*.18+longQuant*.12+longRegime*.14),shortFomo=clamp(shortAccel*.36+volume*.20+shortTech*.18+shortQuant*.12+shortRegime*.14);
  const riskPenalty=Math.max(0,Math.abs(d1)-11)*1.1+Math.max(0,Math.abs(h1)-6)*1.6;
  const longAi=clamp(longTech*.24+longQuant*.20+fund*.18+longRegime*.20+longFomo*.18-riskPenalty+(seed(r.id)-.5)*.8);
  const shortAi=clamp(shortTech*.24+shortQuant*.20+fund*.18+shortRegime*.20+shortFomo*.18-riskPenalty+(seed(r.id+'s')-.5)*.8);
  const preferredSide=shortAi>longAi?'short':'long';
  const tech=preferredSide==='short'?shortTech:longTech,quant=preferredSide==='short'?shortQuant:longQuant,regime=preferredSide==='short'?shortRegime:longRegime,fomo=preferredSide==='short'?shortFomo:longFomo,ai=preferredSide==='short'?shortAi:longAi;
  const volPricePct=clamp(Math.abs(h1)*.9+Math.abs(d1)*.32+Math.abs(d7)*.08+1.25,1.6,10.5);
  const volPenalty=Math.max(0,volPricePct-6)*3;
  const risk=clamp(ai*.36+quant*.20+regime*.20+fund*.12+liquidity*.12-volPenalty);
  const leverage=1; // V14 : aucun levier
  const directionEdge=Math.abs(longAi-shortAi);
  let status='neutral',label='NEUTRE';if(ai>=80&&fomo>=73&&regime>=52){status='order';label='ORDRE CONSEILLÉ'}else if(ai>=72&&fomo>=62){status='preorder';label='PRÉ-ORDRE'}else if(ai>=62){status='watch';label='À SURVEILLER'}
  const p=usdToUsdc(num(r.current_price));
  const stopMove=0,tp1Move=0,tp2Move=0;
  const entryLow=p*.997,entryHigh=p*1.002;
  const reasons=[preferredSide.toUpperCase()];
  if((preferredSide==='long'?longMomentum:shortMomentum)>72)reasons.push('momentum directionnel fort');if(volume>68)reasons.push('liquidité solide');if(quant>75)reasons.push('Quant robuste');if(regime>70)reasons.push('régime cohérent');if(directionEdge>10)reasons.push('avantage directionnel net');if(volPricePct>6.5)reasons.push('volatilité élevée — surveillance IA renforcée');if(risk<70)reasons.push('Risk Engine prudent');
  const opportunityScore=clamp(ai*.70+fomo*.22+risk*.08);
  return{...r,currentPriceUSDC:p,tech,quant,fund,regime,fomo,ai,risk,leverage,status,label,preferredSide,longAi,shortAi,longTech,shortTech,longRegime,shortRegime,longFomo,shortFomo,directionEdge,opportunityScore,volatilityPricePct:volPricePct,entryLow,entryHigh,stopMove,tp1Move,tp2Move,gains:[tp1Move,tp2Move,tp2Move*1.25],reason:reasons.join(' • ')};
}
function recommendedHorizonMinutes(a){
  const v=num(a.volatilityPricePct,4),structural=(a.quant+a.fund+a.regime)/3;
  if(a.ai>=90&&a.fomo>=88&&v>=6)return 360;       // 6 h : mouvement très rapide
  if(a.ai>=86&&a.fomo>=80)return 720;             // 12 h
  if(a.ai>=81&&structural>=76)return 1440;         // 1 j
  if(structural>=72&&a.risk>=72)return 2880;       // 2 j
  if(a.ai>=72)return 4320;                         // 3 j
  return 5760;                                    // 4 j, max absolu géré à 5 j
}
function horizonLabel(min){if(min<60)return`${min} min`;if(min<1440)return`${Number(min/60).toFixed(min%60?1:0)} h`;return`${Number(min/1440).toFixed(min%1440?1:0)} j`}
function remainingLabel(ms){if(ms<=0)return'FENÊTRE ARRIVÉE';const mins=Math.ceil(ms/60000);if(mins<60)return`${mins} min`;if(mins<1440)return`${Math.floor(mins/60)} h ${mins%60} min`;return`${Math.floor(mins/1440)} j ${Math.floor((mins%1440)/60)} h`}
function positionByAsset(id){return state.positions.find(p=>p.assetId===id)}
function eligibleManual(a){return state.ranked.slice(0,10).some(x=>x.id===a?.id)}
function rankOf(a){const i=state.ranked.findIndex(x=>x.id===a?.id);return i>=0?i+1:null}
function chooseSide(a){return a?.preferredSide==='short'?'short':'long'}
function recentClosedForAsset(id){return state.closed.find(x=>x.assetId===id&&Date.now()-new Date(x.closedAt).getTime()<CONFIG.reentryCooldownMinutes*60000)}
function entryRiskPause(){
  const s=accountStats();
  const ddPct=CONFIG.startingCapitalUSDC?Math.min(0,(s.totalEquity-CONFIG.startingCapitalUSDC)/CONFIG.startingCapitalUSDC*100):0;
  return {paused:ddPct<=-CONFIG.newEntryDrawdownPausePct,ddPct};
}
function autoDecision(a){
  const stats=accountStats(),side=chooseSide(a),guard=entryRiskPause();
  if(guard.paused)return{action:'RISK PAUSE',ok:false,side,why:`drawdown portefeuille ${guard.ddPct.toFixed(2)} %`};
  if(positionByAsset(a.id))return{action:'HOLD',ok:false,side,why:'position déjà ouverte — suivi, pas de reset'};
  if(recentClosedForAsset(a.id))return{action:'COOLDOWN',ok:false,side,why:'réentrée bloquée 6 h après clôture'};
  if(state.positions.length>=CONFIG.maxPositions)return{action:'FULL',ok:false,side,why:'15 positions ouvertes'};
  if(stats.freeCapital<CONFIG.marginPerOrderUSDC)return{action:'NO CAPITAL',ok:false,side,why:'capital libre insuffisant'};
  if(a.ai<68||a.fomo<58)return{action:'WAIT',ok:false,side,why:'consensus/FOMO insuffisant'};
  if(a.risk<60)return{action:'RISK BLOCK',ok:false,side,why:'Risk Score trop faible'};
  if(a.directionEdge<2.5&&a.ai<78)return{action:'WAIT',ok:false,side,why:'direction LONG/SHORT trop indécise'};
  return{action:`AUTO ${side.toUpperCase()}`,ok:true,side,why:`IA ${score(a.ai)} • Risk ${score(a.risk)} • sans levier`};
}

function mandatoryTop1Decision(a){
  const stats=accountStats(),side=chooseSide(a),guard=entryRiskPause();
  if(guard.paused)return{ok:false,action:'RISK PAUSE',side,why:`drawdown portefeuille ${guard.ddPct.toFixed(2)} %`};
  if(!a)return{ok:false,action:'NO CANDIDATE',side:'long',why:'aucun candidat'};
  if(positionByAsset(a.id))return{ok:false,action:'HOLD',side,why:'position déjà ouverte'};
  if(recentClosedForAsset(a.id))return{ok:false,action:'COOLDOWN',side,why:'cooldown actif'};
  if(state.positions.length>=CONFIG.maxPositions)return{ok:false,action:'FULL',side,why:'15 positions ouvertes'};
  if(stats.freeCapital<CONFIG.marginPerOrderUSDC)return{ok:false,action:'NO CAPITAL',side,why:'capital libre insuffisant'};
  if(!Number.isFinite(num(a.currentPriceUSDC))||num(a.currentPriceUSDC)<=0)return{ok:false,action:'INVALID PRICE',side,why:'prix invalide'};
  if(a.risk<CONFIG.mandatoryTop1RiskFloor)return{ok:false,action:'HARD RISK BLOCK',side,why:`Risk ${score(a.risk)} < ${CONFIG.mandatoryTop1RiskFloor}`};
  if(a.directionEdge<CONFIG.mandatoryTop1EdgeFloor)return{ok:false,action:'NO EDGE',side,why:'direction trop indécise'};
  return{ok:true,action:`TOP1 AUTO ${side.toUpperCase()}`,side,why:`meilleur candidat disponible • IA ${score(a.ai)} • FOMO ${score(a.fomo)} • Risk ${score(a.risk)}`};
}

function feeAmount(notionalUSDC,sideCount=1){return num(notionalUSDC)*CONFIG.feePerSidePct/100*sideCount}
function openPositionFromAsset(a,{source='AUTO',broker='AUTO • AVG3',side=null,entryUSDC=null,horizonMinutes=null}={}){
  if(state.positions.length>=CONFIG.maxPositions)return false;
  const stats=accountStats();if(stats.freeCapital<CONFIG.marginPerOrderUSDC)return false;
  if(positionByAsset(a.id)||recentClosedForAsset(a.id))return false;
  const entry=num(entryUSDC,a.currentPriceUSDC),dir=side||chooseSide(a),margin=CONFIG.marginPerOrderUSDC,notional=margin,qty=notional/entry;
  const h=clamp(horizonMinutes||recommendedHorizonMinutes(a),60,CONFIG.maxHorizonMinutes),opened=new Date(),target=new Date(opened.getTime()+h*60000),maxClose=new Date(opened.getTime()+CONFIG.maxHorizonMinutes*60000),entryFee=feeAmount(notional,1);
  const pos={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())),strategyVersion:'V14-AI-MANAGED',assetId:a.id,symbol:a.symbol,name:a.name,image:a.image||'',rank:rankOf(a),source,broker,side:dir,leverage:1,marginOriginal:margin,remainingMargin:margin,notionalOriginal:notional,qtyOriginal:qty,remainingQty:qty,entryPriceUSDC:entry,currentPriceUSDC:entry,volatilityEntryPct:num(a.volatilityPricePct),entryFeeRemaining:entryFee,partialGrossUSDC:0,partialFeesUSDC:0,partialNetUSDC:0,tp1Hit:false,openedAt:opened.toISOString(),targetCloseAt:target.toISOString(),maxCloseAt:maxClose.toISOString(),horizonMinutes:h,extensionCount:0,lastExtensionMinutes:0,exitWindowNotified:false,minAiExitAt:new Date(opened.getTime()+CONFIG.minAiExitMinutes*60000).toISOString(),entryAi:a.ai,entryFomo:a.fomo,entryRisk:a.risk,entryDirectionEdge:a.directionEdge,lastAi:a.ai,lastFomo:a.fomo,lastRisk:a.risk,maxPnlPct:0,minPnlPct:0,status:'open',exitMode:'AI_DYNAMIC'};
  state.positions.unshift(pos);consumeCredits(1);persistPositions();notifyEvent('EBYTDA • Position ouverte',`${a.symbol.toUpperCase()} ${dir.toUpperCase()} • 100 USDT • sans levier • horizon ${horizonLabel(h)}`);return true;
}

function posCalc(p){
  const cur=num(p.currentPriceUSDC,p.entryPriceUSDC),entry=num(p.entryPriceUSDC),sgn=p.side==='short'?-1:1,grossRemaining=num(p.remainingQty)*(cur-entry)*sgn,exitFeeEstimate=feeAmount(cur*num(p.remainingQty),1),netRemaining=grossRemaining-num(p.entryFeeRemaining)-exitFeeEstimate,totalGross=num(p.partialGrossUSDC)+grossRemaining,totalFees=num(p.partialFeesUSDC)+num(p.entryFeeRemaining)+exitFeeEstimate,totalNet=num(p.partialNetUSDC)+netRemaining,baseMargin=Math.max(num(p.marginOriginal,100),1),pnlPct=totalNet/baseMargin*100,target=new Date(p.targetCloseAt).getTime(),remaining=Math.max(0,target-Date.now());
  return{cur,entry,grossRemaining,exitFeeEstimate,netRemaining,totalGross,totalFees,totalNet,pnlPct,remaining,due:Date.now()>=target};
}
function theoreticalOutcomes(p){return{stopNet:null,tp2Net:null};}

function accountStats(){
  const realizedClosed=state.closed.reduce((a,x)=>a+num(x.netPnlUSDC),0),partialRealized=state.positions.reduce((a,p)=>a+num(p.partialNetUSDC),0),realizedTotal=realizedClosed+partialRealized,marginUsed=state.positions.reduce((a,p)=>a+num(p.remainingMargin),0),unrealizedOpen=state.positions.reduce((a,p)=>a+posCalc(p).netRemaining,0),cumulativePnl=realizedTotal+unrealizedOpen,totalEquity=CONFIG.startingCapitalUSDC+cumulativePnl,freeCapital=CONFIG.startingCapitalUSDC+realizedTotal-marginUsed;
  return{realizedClosed,partialRealized,realizedTotal,marginUsed,unrealizedOpen,openNet:unrealizedOpen,openTotalNet:cumulativePnl,cumulativePnl,totalEquity,freeCapital};
}
function takePartialTP1(p,price){return;}
function closePositionInternal(p,reason,price=null){
  const px=num(price,p.currentPriceUSDC),sgn=p.side==='short'?-1:1,grossRem=p.remainingQty*(px-p.entryPriceUSDC)*sgn,exitFee=feeAmount(px*p.remainingQty,1),grossTotal=p.partialGrossUSDC+grossRem,feesTotal=p.partialFeesUSDC+p.entryFeeRemaining+exitFee,netTotal=grossTotal-feesTotal;
  const closed={...p,status:'closed',closedAt:new Date().toISOString(),exitPriceUSDC:px,closeReason:reason,grossPnlUSDC:grossTotal,feesUSDC:feesTotal,netPnlUSDC:netTotal};
  state.positions=state.positions.filter(x=>x.id!==p.id);state.closed.unshift(closed);state.closed=state.closed.slice(0,1500);persistPositions();persistClosed();notifyEvent('EBYTDA • Position clôturée',`${p.symbol.toUpperCase()} ${p.side.toUpperCase()} • ${reason} • P&L net ${fmtValue(netTotal)}`);
  // Le capital du dashboard est calculé à partir de l'historique clôturé + P&L latent restant : la clôture nourrit donc immédiatement le cumul.
  return closed;
}
function favorableContinuation(p,a,c){if(!a)return false;const sideScore=p.side==='short'?num(a.shortAi):num(a.longAi),oppositeScore=p.side==='short'?num(a.longAi):num(a.shortAi),continuation=sideScore*.45+num(a.fomo)*.22+num(a.regime)*.18+num(a.quant)*.15;return sideScore>=oppositeScore&&continuation>=66&&num(a.risk)>=52;}
function extendHorizonOrClose(p){const now=Date.now(),maxAt=new Date(p.maxCloseAt||new Date(p.openedAt).getTime()+CONFIG.maxHorizonMinutes*60000).getTime(),c=posCalc(p),a=state.rows.find(x=>x.id===p.assetId);if(now>=maxAt){closePositionInternal(p,'HORIZON MAX 5 JOURS',p.currentPriceUSDC);return true}if(!favorableContinuation(p,a,c)){closePositionInternal(p,'HORIZON IA — CONTINUATION INSUFFISANTE',p.currentPriceUSDC);return true}const sideScore=p.side==='short'?num(a.shortAi):num(a.longAi);let add=240;if(sideScore>=86&&a.fomo>=78&&c.pnlPct>=0)add=1440;else if(sideScore>=80&&a.fomo>=70)add=720;else if(c.pnlPct>=0)add=480;const room=Math.max(0,Math.floor((maxAt-now)/60000));add=Math.max(1,Math.min(add,room));if(add<=1&&room<=1){closePositionInternal(p,'HORIZON MAX 5 JOURS',p.currentPriceUSDC);return true}p.targetCloseAt=new Date(now+add*60000).toISOString();p.extensionCount=num(p.extensionCount)+1;p.lastExtensionMinutes=add;p.exitWindowNotified=false;persistPositions();notifyEvent('EBYTDA • Horizon prolongé',`${p.symbol.toUpperCase()} ${p.side.toUpperCase()} : +${horizonLabel(add)} • consensus encore favorable`);return false;}
function refillCorePositionsFromCachedRanking(){if(!state.autoPilot||state.positions.length>=CONFIG.minPositions||!state.ranked.length)return;let guard=0;while(state.positions.length<CONFIG.minPositions&&guard<CONFIG.universeSize&&accountStats().freeCapital>=CONFIG.marginPerOrderUSDC){const a=state.ranked[guard++];if(!a||positionByAsset(a.id)||recentClosedForAsset(a.id))continue;const d=mandatoryTop1Decision(a);if(!d.ok)continue;openPositionFromAsset(a,{source:'AUTO CORE • REFILL',broker:'AUTO • AVG3',side:d.side,horizonMinutes:recommendedHorizonMinutes(a)});}}
function checkPriceExits(){let changed=false;for(const p of [...state.positions]){const c=posCalc(p);if(!p.exitWindowNotified&&c.remaining>0&&c.remaining<=15*60*1000){p.exitWindowNotified=true;notifyEvent('EBYTDA • Fenêtre de revue',`${p.symbol.toUpperCase()} ${p.side.toUpperCase()} : horizon dans ${remainingLabel(c.remaining)} • P&L ${fmtValue(c.totalNet)}`);changed=true}if(c.due){const closed=extendHorizonOrClose(p);changed=true;if(closed)continue}if(state.positions.find(x=>x.id===p.id)){const after=posCalc(p);p.maxPnlPct=Math.max(num(p.maxPnlPct,0),after.pnlPct);p.minPnlPct=Math.min(num(p.minPnlPct,0),after.pnlPct)}}if(changed){persistPositions();persistClosed();refillCorePositionsFromCachedRanking()}}
function evaluateScoreExits(){for(const p of [...state.positions]){const a=state.rows.find(x=>x.id===p.assetId);if(!a)continue;p.lastAi=a.ai;p.lastFomo=a.fomo;p.lastRisk=a.risk;const c=posCalc(p),ageMin=(Date.now()-new Date(p.openedAt).getTime())/60000,sideAi=p.side==='short'?num(a.shortAi):num(a.longAi),oppositeAi=p.side==='short'?num(a.longAi):num(a.shortAi),continuation=sideAi*.44+num(a.fomo)*.22+num(a.regime)*.18+num(a.quant)*.16;const hardReversal=ageMin>=CONFIG.severeExitMinMinutes&&oppositeAi>=84&&oppositeAi-sideAi>=18&&sideAi<46&&c.pnlPct<0;const momentumBroken=ageMin>=CONFIG.minAiExitMinutes&&sideAi<50&&continuation<52&&c.pnlPct<0&&oppositeAi>sideAi+10;const exceptionalFastGain=ageMin>=15&&c.pnlPct>=8&&continuation<68;const secureStrongGain=ageMin>=60&&c.pnlPct>=5&&continuation<61;const matureGain=ageMin>=CONFIG.minAiExitMinutes&&c.pnlPct>=2.5&&continuation<56;if(hardReversal)closePositionInternal(p,'SORTIE IA — RETOURNEMENT FORT',p.currentPriceUSDC);else if(momentumBroken)closePositionInternal(p,'SORTIE IA — MOMENTUM CASSÉ',p.currentPriceUSDC);else if(exceptionalFastGain)closePositionInternal(p,'PRISE DE GAIN IA — MOUVEMENT RAPIDE',p.currentPriceUSDC);else if(secureStrongGain)closePositionInternal(p,'PRISE DE GAIN IA — CONTINUATION FAIBLE',p.currentPriceUSDC);else if(matureGain)closePositionInternal(p,'CLOSING IA — GAIN À SÉCURISER',p.currentPriceUSDC)}refillCorePositionsFromCachedRanking();}
function logTop3Decisions(){
  const at=new Date().toISOString();const batch=state.ranked.slice(0,3).map((a,i)=>{const d=autoDecision(a);return{at,rank:i+1,assetId:a.id,symbol:a.symbol,name:a.name,side:d.side||chooseSide(a),ai:a.ai,fomo:a.fomo,risk:a.risk,leverage:a.leverage,horizonMinutes:recommendedHorizonMinutes(a),decision:d.action,why:d.why}});
  state.decisions.unshift(...batch);state.decisions=state.decisions.slice(0,1200);persistDecisions();
}
function runAutoEntries(){if(!state.autoPilot)return;if(state.positions.length>=CONFIG.maxPositions)return;if(accountStats().freeCapital<CONFIG.marginPerOrderUSDC)return;let opened=0;const openedThisCycle=new Set();while(state.positions.length<CONFIG.minPositions&&state.positions.length<CONFIG.maxPositions&&accountStats().freeCapital>=CONFIG.marginPerOrderUSDC){let candidate=null,decision=null;for(const a of state.ranked){if(openedThisCycle.has(a.id)||positionByAsset(a.id)||recentClosedForAsset(a.id))continue;const d=mandatoryTop1Decision(a);if(!d.ok)continue;candidate=a;decision=d;break}if(!candidate)break;if(!openPositionFromAsset(candidate,{source:'AUTO CORE • 15MIN',broker:'AUTO • AVG3',side:decision.side,horizonMinutes:recommendedHorizonMinutes(candidate)}))break;opened++;openedThisCycle.add(candidate.id);state.decisions.unshift({at:new Date().toISOString(),rank:rankOf(candidate),assetId:candidate.id,symbol:candidate.symbol,name:candidate.name,side:decision.side,ai:candidate.ai,fomo:candidate.fomo,risk:candidate.risk,leverage:1,horizonMinutes:recommendedHorizonMinutes(candidate),decision:`CORE ${decision.side.toUpperCase()}`,why:'noyau minimum de 3 positions • '+decision.why})}for(const a of state.ranked){if(state.positions.length>=CONFIG.maxPositions||opened>=CONFIG.maxNewEntriesPerScan)break;if(openedThisCycle.has(a.id)||positionByAsset(a.id)||recentClosedForAsset(a.id))continue;const d=autoDecision(a);if(!d.ok)continue;const crowded=state.positions.length>=10,extraStrong=crowded?(a.ai>=82&&a.fomo>=72&&a.risk>=66&&a.directionEdge>=5):(a.ai>=75&&a.fomo>=64&&a.risk>=58&&a.directionEdge>=3);if(!extraStrong)continue;if(openPositionFromAsset(a,{source:'AUTO OPPORTUNITY • 15MIN',broker:'AUTO • AVG3',side:d.side,horizonMinutes:recommendedHorizonMinutes(a)})){opened++;openedThisCycle.add(a.id);state.decisions.unshift({at:new Date().toISOString(),rank:rankOf(a),assetId:a.id,symbol:a.symbol,name:a.name,side:d.side,ai:a.ai,fomo:a.fomo,risk:a.risk,leverage:1,horizonMinutes:recommendedHorizonMinutes(a),decision:`AUTO ${d.side.toUpperCase()}`,why:d.why})}}state.decisions=state.decisions.slice(0,1500);persistDecisions();if(opened>0){const s=accountStats();toast(`AutoPilot : ${opened} ouverture(s) • ${state.positions.length}/${CONFIG.maxPositions} positions • capital dispo ${fmtValue(s.freeCapital)}`)}else if(state.positions.length<CONFIG.minPositions)toast(`AutoPilot : ${state.positions.length}/${CONFIG.minPositions} positions — aucun autre candidat valide.`);}

async function scan(manual=false){
  if(state.view!=='private')return;
  const refresh=$('#refreshBtn');if(refresh)refresh.classList.add('spin');
  let raw=null,live=true;
  try{
    await fetchFx();
    raw=await fetchMarket300();
    state.liveMarket=true;state.dataMode='LIVE';state.lastApiError='';
  }catch(e){
    live=false;state.liveMarket=false;state.dataMode='DEMO';state.lastApiError=String(e?.message||e);
    raw=demoData();
    toast('CoinGecko indisponible : affichage de secours actif. Aucun nouvel ordre AUTO ne sera ouvert sur des données de démonstration.');
  }
  try{
    if(live)consumeCredits(3);
    const m=marketStats(raw);state.market=m;
    state.rows=raw.map(r=>scoreAsset(r,m)).sort((a,b)=>num(a.market_cap_rank)-num(b.market_cap_rank));
    state.ranked=state.rows.filter(r=>!CONFIG.stable.has(r.symbol)).sort((a,b)=>b.opportunityScore-a.opportunityScore);
    state.selected=state.rows.find(r=>r.id===state.selected?.id)||state.ranked[0]||null;

    for(const p of state.positions){
      const a=state.rows.find(x=>x.id===p.assetId);if(!a)continue;
      p.currentPriceUSDC=a.currentPriceUSDC;
      p.strategyVersion='V15-AI-MANAGED';p.leverage=1;
      p.marginOriginal=CONFIG.marginPerOrderUSDC;p.remainingMargin=CONFIG.marginPerOrderUSDC;
      p.notionalOriginal=CONFIG.marginPerOrderUSDC;
      p.qtyOriginal=CONFIG.marginPerOrderUSDC/Math.max(num(p.entryPriceUSDC,1),1e-12);
      p.remainingQty=p.qtyOriginal;
      p.tp1Hit=false;p.partialGrossUSDC=0;p.partialFeesUSDC=0;p.partialNetUSDC=0;
      p.entryFeeRemaining=feeAmount(CONFIG.marginPerOrderUSDC,1);
      p.exitMode='AI_DYNAMIC';
      p.stopPriceUSDC=null;p.tp1PriceUSDC=null;p.tp2PriceUSDC=null;p.stopMovePct=0;p.tp1MovePct=0;p.tp2MovePct=0;
      const opened=new Date(p.openedAt||Date.now()).getTime();
      if(!p.maxCloseAt)p.maxCloseAt=new Date(opened+CONFIG.maxHorizonMinutes*60000).toISOString();
      if(!p.targetCloseAt)p.targetCloseAt=new Date(opened+recommendedHorizonMinutes(a)*60000).toISOString();
      p.minAiExitAt=new Date(opened+CONFIG.minAiExitMinutes*60000).toISOString();
      p.lastAi=a.ai;p.lastFomo=a.fomo;p.lastRisk=a.risk;
    }
    persistPositions();

    evaluateScoreExits();
    checkPriceExits();
    logTop3Decisions();
    if(live)runAutoEntries();
    state.lastScanAt=new Date();
    scheduleScan();
    renderAll();applyLanguage();
    if(state.selected)await loadChart();
    if(manual)toast(live?'Scan LIVE des 300 cryptos recalculé.':'Scan de secours affiché — AutoPilot suspendu faute de données LIVE.');
  }catch(e){
    console.error('EBYTDA scan engine error',e);
    toast(`Erreur moteur : ${e?.message||e}`);
  }finally{
    if(refresh)refresh.classList.remove('spin');
  }
}

function scheduleScan(){clearTimeout(state.scanTimer);clearInterval(state.countTimer);state.nextScan=Date.now()+CONFIG.scanMs;state.scanTimer=setTimeout(()=>scan(false),CONFIG.scanMs);state.countTimer=setInterval(renderCountdown,1000);renderCountdown()}
function renderCountdown(){if(!state.nextScan)return;const sec=Math.max(0,Math.floor((state.nextScan-Date.now())/1000)),mm=Math.floor(sec/60),ss=sec%60;$('#countdown').textContent=`${mm}m ${String(ss).padStart(2,'0')}s`;if($('#scanKpi'))$('#scanKpi').textContent=`${mm}:${String(ss).padStart(2,'0')}`}

function renderAll(){
  const top=state.ranked[0],m=state.market;if(!top)return;$('#marketRegime').textContent=`${state.liveMarket?'LIVE':'DEMO'} • ${m.label}`;$('#heroImg').src=top.image||avatar(top.symbol);$('#heroName').textContent=`${top.name} (${top.symbol.toUpperCase()})`;$('#heroPrice').textContent=fmtValue(top.currentPriceUSDC);$('#hero24h').textContent=pct(top.price_change_percentage_24h);$('#hero24h').className=klass(top.price_change_percentage_24h);$('#heroScore').textContent=score(top.ai);$('#heroSignal').textContent=top.label;$('#heroReason').textContent=top.reason;$('#engineTech').textContent=score(top.tech);$('#engineQuant').textContent=score(top.quant);$('#engineFund').textContent=score(top.fund);$('#engineRegime').textContent=score(top.regime);$('#engineFomo').textContent=score(top.fomo);$('#kpiSync').textContent=state.lastScanAt?`Dernier scan ${state.lastScanAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`:'—';renderCredits();renderAutoUI();renderTop3();renderCryptoGrid();renderTop10();renderSelected();renderUniverse();renderPositions();renderDecisions();renderClosed();renderPositionKpis();renderCountdown();updateNotificationState();
}
function renderAutoUI(){if($('#autoPilotToggle'))$('#autoPilotToggle').checked=state.autoPilot;if($('#autoPilotLabel'))$('#autoPilotLabel').textContent=state.autoPilot?'AUTO ON':'AUTO OFF';if($('#feeProxy'))$('#feeProxy').textContent=`${CONFIG.feeRoundTripPct.toFixed(4).replace('.',',')} %`}
function advisoryFor(a,i){const pos=positionByAsset(a.id),d=autoDecision(a);if(pos)return['watch',pos.source.startsWith('AUTO')?'AUTO OUVERT':'POSITION OUVERTE'];if(d.ok)return['order','AUTO OUVRIR'];if(d.action==='FULL'||d.action==='NO CAPITAL')return['neutral','CAPITAL / LIMITE'];if(i===0&&a.status==='order')return['order','SIGNAL FORT'];if(i===1)return['preorder','PRÉ-ORDRE'];return['watch',d.action]}
function renderTop3(){
  $('#top3').innerHTML=state.ranked.slice(0,3).map((a,i)=>{const[cls,label]=advisoryFor(a,i),d=autoDecision(a),side=d.side||chooseSide(a);return`<article class="fcard ${cls}"><div class="fcard-head"><div class="asset"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><small>${a.symbol.toUpperCase()}</small></div></div><button class="rank-btn" data-pick="${a.id}">#${i+1}</button></div><div class="score-line"><div><small>FOMO</small><strong>${score(a.fomo)}</strong></div><span class="side-badge ${side}">${side.toUpperCase()}</span><span class="status-pill ${cls}">${label}</span></div><p>${a.reason}</p><div class="fmeta"><div><small>IA / EDGE</small><b>${score(a.ai)} • ${score(a.directionEdge)}</b></div><div><small>RISK / MISE</small><b>${score(a.risk)} • 100 USDT</b></div><div><small>HORIZON</small><b>${horizonLabel(recommendedHorizonMinutes(a))}</b></div></div><button class="order-mini-btn" data-order="${a.id}">ORDRE MANUEL →</button></article>`}).join('');
  $$('[data-pick]',$('#top3')).forEach(b=>b.onclick=()=>selectAsset(b.dataset.pick,true));$$('[data-order]',$('#top3')).forEach(b=>b.onclick=e=>{e.stopPropagation();selectAsset(b.dataset.order,false);openOrder()});
}
function renderCryptoGrid(){
  const rows=state.rows.slice(0,300);
  $('#cryptoGrid100').innerHTML=`<div class="crypto-list-scroll"><table class="crypto-list-table"><thead><tr><th>#</th><th>Actif</th><th>Prix</th><th>24H</th><th>Tech</th><th>Quant</th><th>Régime</th><th>FOMO</th><th>IA</th><th>Sens</th><th>Statut</th><th>Action</th></tr></thead><tbody>${rows.map((a,i)=>{const side=chooseSide(a), status=a.label||a.status; return `<tr class="${state.selected?.id===a.id?'active':''}" data-gridpick="${a.id}" title="${a.name} • ${side.toUpperCase()} • IA ${score(a.ai)}"><td class="rank-cell">${a.market_cap_rank||i+1}</td><td><div class="asset-line"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><small>${a.symbol.toUpperCase()}</small></div></div></td><td class="price-cell">${fmtValue(a.currentPriceUSDC)}</td><td class="chg-cell ${klass(a.price_change_percentage_24h)}">${pct(a.price_change_percentage_24h)}</td><td><span class="score-chip ${a.tech>=80?'high':''}">${score(a.tech)}</span></td><td><span class="score-chip ${a.quant>=80?'high':''}">${score(a.quant)}</span></td><td><span class="score-chip ${a.regime>=80?'high':''}">${score(a.regime)}</span></td><td><span class="score-chip ${a.fomo>=80?'high':''}">${score(a.fomo)}</span></td><td><span class="score-chip ${a.ai>=80?'high':''}">${score(a.ai)}</span></td><td><span class="side-badge ${side}">${side.toUpperCase()}</span></td><td><span class="status-pill ${a.status}">${status}</span></td><td><button class="tiny-order" data-listorder="${a.id}">Charger</button></td></tr>`}).join('')}</tbody></table></div>`;
  $$('[data-gridpick]').forEach(r=>r.onclick=e=>{if(e.target.closest('[data-listorder]')) return; selectAsset(r.dataset.gridpick,true)});
  $$('[data-listorder]').forEach(b=>b.onclick=e=>{e.stopPropagation();selectAsset(b.dataset.listorder,true)});
}
function renderTop10(){
  $('#top10Rows').innerHTML=state.ranked.slice(0,10).map((a,i)=>{const side=chooseSide(a);return`<tr class="${state.selected?.id===a.id?'selected':''}" data-rowpick="${a.id}"><td><button class="table-rank" data-pick="${a.id}">#${i+1}</button></td><td><div class="asset"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><small>${a.symbol.toUpperCase()}</small></div></div></td><td>${fmtValue(a.currentPriceUSDC)}</td><td class="${klass(a.price_change_percentage_24h)}">${pct(a.price_change_percentage_24h)}</td><td><span class="score-chip ${a.tech>=80?'high':''}">${score(a.tech)}</span></td><td><span class="score-chip ${a.quant>=80?'high':''}">${score(a.quant)}</span></td><td><span class="score-chip ${a.fund>=80?'high':''}">${score(a.fund)}</span></td><td><span class="score-chip ${a.regime>=80?'high':''}">${score(a.regime)}</span></td><td><span class="score-chip ${a.fomo>=80?'high':''}">${score(a.fomo)}</span></td><td><span class="score-chip ${a.ai>=80?'high':''}">${score(a.ai)}</span></td><td><span class="side-badge ${side}">${side.toUpperCase()}</span></td><td><span class="status-pill ${a.status}">${a.label}</span></td><td><button class="table-order-btn" data-order="${a.id}">ORDRE</button></td></tr>`}).join('');
  $$('[data-pick]',$('#top10Rows')).forEach(b=>b.onclick=e=>{e.stopPropagation();selectAsset(b.dataset.pick,true)});$$('[data-order]',$('#top10Rows')).forEach(b=>b.onclick=e=>{e.stopPropagation();selectAsset(b.dataset.order,false);openOrder()});$$('[data-rowpick]').forEach(r=>r.onclick=()=>selectAsset(r.dataset.rowpick,true));
}
function trackStats(a){const p90=num(a.price_change_percentage_30d_in_currency)*2.1,posDays=clamp(48+seed(a.id+'p')*30),vol=clamp(Math.abs(num(a.price_change_percentage_24h))*.22+2.8,1,25),dd=-clamp(Math.abs(num(a.ath_change_percentage))*.35,5,65),cont=clamp(22+seed(a.id+'c')*58);return{p90,posDays,vol,dd,cont}}
function selectAsset(id,scroll=false){const a=state.rows.find(x=>x.id===id)||state.ranked.find(x=>x.id===id);if(!a)return;state.selected=a;renderSelected();renderTop10();renderUniverse();loadChart();if(scroll)document.querySelector('.grid').scrollIntoView({behavior:'smooth',block:'start'})}
function renderSelected(){const a=state.selected;if(!a)return;const r=rankOf(a),allowed=eligibleManual(a),tr=trackStats(a),side=chooseSide(a),sideAi=side==='short'?a.shortAi:a.longAi,oppositeAi=side==='short'?a.longAi:a.shortAi,continuation=sideAi*.44+a.fomo*.22+a.regime*.18+a.quant*.16;$('#chartImg').src=a.image||avatar(a.symbol);$('#chartName').textContent=a.name;$('#chartSymbol').textContent=`${a.symbol.toUpperCase()} • ${side.toUpperCase()}`;$('#chartPrice').textContent=fmtValue(a.currentPriceUSDC);$('#chartChange').textContent=pct(a.price_change_percentage_24h);$('#chartChange').className=`price-change ${klass(a.price_change_percentage_24h)}`;$('#chartRank').textContent=r?`TOP ${r}`:`Rang marché #${a.market_cap_rank||'—'}`;$('#chartEligibility').textContent=allowed?`✓ TOP ${r} • ordre manuel autorisé`:'Graphique seul • hors TOP 10';$('#chartEligibility').className=`eligibility ${allowed?'yes':''}`;$('#selectedStatus').textContent=`${side.toUpperCase()} • ${a.label} • ${r?`TOP ${r}`:`#${a.market_cap_rank||'—'}`}`;$('#selectedScore').textContent=score(a.ai);$('#selTech').textContent=score(a.tech);$('#selQuant').textContent=score(a.quant);$('#selFund').textContent=score(a.fund);$('#selRegime').textContent=score(a.regime);$('#selFomo').textContent=score(a.fomo);$('#selRisk').textContent=score(a.risk);if($('#selLeverage'))$('#selLeverage').textContent='100 USDT';$('#entryZone').textContent=`${fmtValue(a.entryLow)} – ${fmtValue(a.entryHigh)}`;$('#stopLevel').textContent='Aucun stop fixe';$('#tp1Level').textContent='Closing IA';$('#tp2Level').textContent='5 jours max';$('#selectedReason').textContent=`${a.reason}. Pas de stop-loss ni take-profit fixe. Horizon IA ${horizonLabel(recommendedHorizonMinutes(a))}; réévaluation toutes les 15 min.`;$('#gain1').textContent=score(sideAi);$('#gain2').textContent=score(continuation);$('#gain3').textContent=sideAi>=oppositeAi?'HOLD / SURVEILLER':'RISQUE DE RETOURNEMENT';$('#openOrderBtn').disabled=!allowed;$('#orderEligibilityNote').textContent=allowed?`TOP ${r} : ${side.toUpperCase()} • 100 USDT • sans levier • closing IA dynamique.`:'Actif hors TOP 10 : ticket manuel verrouillé.';$('#trkPerf').textContent=pct(tr.p90);$('#trkPos').textContent=`${tr.posDays.toFixed(2)} %`;$('#trkVol').textContent=`${tr.vol.toFixed(2)} %`;$('#trkDD').textContent=`${tr.dd.toFixed(2)} %`;$('#trkCont').textContent=`${tr.cont.toFixed(2)} %`;$('#trkScore').textContent=`${Math.round(a.ai)}/100`;}
function renderUniverse(){
  const q=$('#search').value.trim().toLowerCase(),f=$('#statusFilter').value,list=state.rows.filter(a=>(!q||a.name.toLowerCase().includes(q)||a.symbol.toLowerCase().includes(q))&&(f==='all'||a.status===f));$('#cryptoRows').innerHTML=list.map(a=>{const side=chooseSide(a);return`<tr data-chartpick="${a.id}"><td>${a.market_cap_rank||'—'}</td><td><div class="asset"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><small>${a.symbol.toUpperCase()} ${eligibleManual(a)?'• TOP 10':''}</small></div></div></td><td>${fmtValue(a.currentPriceUSDC)}</td><td class="${klass(a.price_change_percentage_1h_in_currency)}">${pct(a.price_change_percentage_1h_in_currency)}</td><td class="${klass(a.price_change_percentage_24h)}">${pct(a.price_change_percentage_24h)}</td><td class="${klass(a.price_change_percentage_7d_in_currency)}">${pct(a.price_change_percentage_7d_in_currency)}</td><td>${compactUsd(a.total_volume)}</td><td><span class="score-chip">${score(a.tech)}</span></td><td><span class="score-chip">${score(a.quant)}</span></td><td><span class="score-chip">${score(a.fund)}</span></td><td><span class="score-chip">${score(a.regime)}</span></td><td><span class="score-chip">${score(a.fomo)}</span></td><td><span class="score-chip ${a.ai>=80?'high':''}">${score(a.ai)}</span></td><td><span class="side-badge ${side}">${side.toUpperCase()}</span></td><td><span class="status-pill ${a.status}">${a.label}</span></td></tr>`}).join('');$$('[data-chartpick]').forEach(r=>r.onclick=()=>selectAsset(r.dataset.chartpick,true));
}

function ensureChart(){if(state.chart||!window.LightweightCharts)return;state.chart=LightweightCharts.createChart($('#chart'),{layout:{background:{type:'solid',color:'#071019'},textColor:'#8ea1af'},grid:{vertLines:{color:'#10202b'},horzLines:{color:'#10202b'}},rightPriceScale:{borderColor:'#1a2a37'},timeScale:{borderColor:'#1a2a37',timeVisible:true,secondsVisible:false},crosshair:{mode:LightweightCharts.CrosshairMode.Normal}});state.candleSeries=state.chart.addCandlestickSeries({upColor:'#34d399',downColor:'#fb7185',borderUpColor:'#34d399',borderDownColor:'#fb7185',wickUpColor:'#34d399',wickDownColor:'#fb7185'});new ResizeObserver(entries=>{for(const e of entries)state.chart.applyOptions({width:e.contentRect.width,height:e.contentRect.height})}).observe($('#chart'))}
function demoCandles(a,days){const count=days===1?48:days===7?84:days===30?90:120,end=Math.floor(Date.now()/1000),step=Math.floor(days*86400/count),out=[];let p=num(a.current_price,1)*(1-(seed(a.id+'c')-.4)*.08);for(let i=count-1;i>=0;i--){const s=(seed(a.id+i)-.5)*.025,o=p,c=o*(1+s),h=Math.max(o,c)*(1+Math.abs(s)*.5+.002),l=Math.min(o,c)*(1-Math.abs(s)*.5-.002);out.push({time:end-i*step,open:o,high:h,low:l,close:c});p=c}const factor=num(a.current_price,1)/out[out.length-1].close;return out.map(c=>({...c,open:c.open*factor,high:c.high*factor,low:c.low*factor,close:c.close*factor}))}
function chartPriceFromUsd(usd){return usdcToUnit(usdToUsdc(usd))}
async function loadChart(){const a=state.selected;if(!a)return;ensureChart();if(!state.candleSeries)return;$('#chartStatus').textContent='Chargement des bougies…';let candles;try{const r=await fetch(`${CONFIG.api}/coins/${encodeURIComponent(a.id)}/ohlc?vs_currency=usd&days=${state.chartDays}`);if(!r.ok)throw new Error(r.status);const j=await r.json();candles=j.map(x=>({time:Math.floor(x[0]/1000),open:chartPriceFromUsd(x[1]),high:chartPriceFromUsd(x[2]),low:chartPriceFromUsd(x[3]),close:chartPriceFromUsd(x[4])}));if(!candles.length)throw new Error('empty');$('#chartStatus').textContent=`Bougies OHLC • ${(state.unit==='usdt'?'USDT':state.unit.toUpperCase())}`}catch(e){candles=demoCandles(a,state.chartDays).map(x=>({...x,open:chartPriceFromUsd(x.open),high:chartPriceFromUsd(x.high),low:chartPriceFromUsd(x.low),close:chartPriceFromUsd(x.close)}));$('#chartStatus').textContent='Bougies de démonstration'}state.candleSeries.setData(candles);state.chart.timeScale().fitContent()}

function openOrder(){const a=state.selected;if(!state.auth){openAuth();return}if(!eligibleManual(a)){toast('Ordre manuel verrouillé : actif hors TOP 10.');return}if(positionByAsset(a.id)){toast('Une position est déjà ouverte sur cet actif.');return}const stats=accountStats();if(stats.freeCapital<CONFIG.marginPerOrderUSDC||state.positions.length>=CONFIG.maxPositions){toast('Capacité de portefeuille atteinte.');return}const r=rankOf(a),autoH=recommendedHorizonMinutes(a);$('#modalAsset').textContent=`${a.name} (${a.symbol.toUpperCase()})`;$('#modalRank').textContent=`TOP ${r}`;$('#capitalInput').value=100;$('#executionInput').value=num(a.currentPriceUSDC).toPrecision(8).replace(/0+$/,'').replace(/\.$/,'');$('#sideSelect').value=chooseSide(a);$('#ticketAi').textContent=score(a.ai);$('#ticketFomo').textContent=score(a.fomo);$('#ticketStop').textContent=score(a.risk);$('#ticketTps').textContent='IA dynamique';$('#ticketHorizon').textContent=`${horizonLabel(autoH)} (IA)`;$('#ticketFees').textContent=fmtValue(CONFIG.marginPerOrderUSDC*CONFIG.feeRoundTripPct/100);$('#horizonSelect').value='auto';$('#manualCheck').checked=false;$('#confirmOrderBtn').disabled=true;$('#orderModal').classList.add('open');$('#orderModal').setAttribute('aria-hidden','false');}
function closeOrder(){$('#orderModal').classList.remove('open');$('#orderModal').setAttribute('aria-hidden','true')}
function confirmOrder(){const a=state.selected;if(!eligibleManual(a))return;const entry=num($('#executionInput').value,a.currentPriceUSDC),rawH=$('#horizonSelect').value,h=rawH==='auto'?recommendedHorizonMinutes(a):Number(rawH),ok=openPositionFromAsset(a,{source:'MANUEL',broker:$('#brokerSelect').value,side:$('#sideSelect').value,entryUSDC:entry,horizonMinutes:h});if(!ok){toast('Impossible d’ouvrir la position : limite, capital ou doublon.');return}closeOrder();renderAll();toast(`${a.symbol.toUpperCase()} : position simulée ouverte • 100 USDT • sans levier.`);document.getElementById('positions').scrollIntoView({behavior:'smooth'});}

function persistPositions(){localStorage.setItem(CONFIG.posKey,JSON.stringify(state.positions))}
function persistClosed(){localStorage.setItem(CONFIG.closedKey,JSON.stringify(state.closed))}
function persistDecisions(){localStorage.setItem(CONFIG.decisionKey,JSON.stringify(state.decisions))}
function renderPositions(){const box=$('#positionsList');if(!box)return;if(!state.positions.length){box.innerHTML='<div class="empty">AutoPilot actif : au prochain scan de 15 min, le moteur constituera au moins 3 positions de 100 USDT, sans levier.</div>';return}const head=`<div class="live-order-head v14"><div>Actif</div><div>Sens</div><div>Mise</div><div>Entrée</div><div>Cours live</div><div>Horizon</div><div>Temps restant</div><div>P&L net live</div><div>Momentum</div><div>Continuation</div><div>Décision IA</div><div>Action</div></div>`;const rows=state.positions.map(p=>{const c=posCalc(p),a=state.rows.find(x=>x.id===p.assetId),target=new Date(p.targetCloseAt),cl=c.totalNet>=0?'profit':'loss',sideAi=a?(p.side==='short'?num(a.shortAi):num(a.longAi)):num(p.lastAi),oppositeAi=a?(p.side==='short'?num(a.longAi):num(a.shortAi)):0,continuation=a?(sideAi*.44+num(a.fomo)*.22+num(a.regime)*.18+num(a.quant)*.16):num(p.lastAi);let decision='HOLD';if(c.due)decision='REVUE HORIZON';else if(sideAi<50&&oppositeAi>sideAi+10)decision='SURVEILLER SORTIE';else if(c.pnlPct>=5&&continuation<61)decision='GAIN À SÉCURISER';else if(c.pnlPct>0)decision='LAISSER COURIR';const statusClass=decision.includes('SORTIE')||decision.includes('SÉCURISER')?'risk':c.pnlPct>0?'win':'';return `<div class="live-order-row v14 ${cl}"><div><div class="live-order-asset"><img src="${p.image||avatar(p.symbol)}"><div><b>${p.name} (${p.symbol.toUpperCase()})</b><small>${p.source} • ${p.broker}</small></div></div></div><div class="live-cell"><span>Sens</span><b><span class="side-badge ${p.side}">${p.side.toUpperCase()}</span></b></div><div class="live-cell"><span>Mise</span><b>100 USDT</b></div><div class="live-cell"><span>Entrée</span><b>${fmtValue(c.entry)}</b></div><div class="live-cell"><span>Live</span><b>${fmtValue(c.cur)}</b></div><div class="live-cell"><span>Horizon IA</span><b>${horizonLabel(num(p.horizonMinutes,240))}</b></div><div class="live-cell"><span>Reste</span><b>${remainingLabel(c.remaining)}</b></div><div class="live-cell"><span>P&L net</span><b class="big ${klass(c.totalNet)}">${fmtValue(c.totalNet)}<br>${pct(c.pnlPct)}</b></div><div class="live-cell"><span>Momentum</span><b>${score(sideAi)}</b></div><div class="live-cell"><span>Continuation</span><b>${score(continuation)}</b></div><div><span class="order-status ${statusClass}">${decision}</span></div><div><button class="live-close-btn" data-closepos="${p.id}">CLÔTURER</button></div></div><div class="order-detail-row"><span>Aucun stop fixe</span><span>Aucun TP fixe</span><span>MFE <b class="pos">${pct(p.maxPnlPct||0)}</b></span><span>MAE <b class="neg">${pct(p.minPnlPct||0)}</b></span><span>Clôture cible <b>${target.toLocaleString()}</b></span><span>Dernier consensus <b>IA ${score(p.lastAi)} • FOMO ${score(p.lastFomo)} • Risk ${score(p.lastRisk)}</b></span></div>`;}).join('');box.innerHTML=head+rows;$$('[data-closepos]',box).forEach(b=>b.onclick=()=>manualClose(b.dataset.closepos));}

function manualClose(id){
  const p=state.positions.find(x=>x.id===id);if(!p)return;
  const c=posCalc(p);
  if(!confirm(`Clôturer ${p.symbol.toUpperCase()} ${p.side.toUpperCase()} maintenant ? P&L net courant ${fmtValue(c.totalNet)}`))return;
  closePositionInternal(p,'CLÔTURE MANUELLE',p.currentPriceUSDC);
  renderAll();
}

function renderPositionKpis(){const a=accountStats(),pnl=a.cumulativePnl,pctTot=CONFIG.startingCapitalUSDC?pnl/CONFIG.startingCapitalUSDC*100:0;$('#capitalTotal').textContent=fmtValue(a.totalEquity);$('#capitalFree').textContent=fmtValue(a.freeCapital);$('#marginUsed').textContent=fmtValue(a.marginUsed);$('#kpiOpen').textContent=`${state.positions.length} / ${CONFIG.maxPositions}`;$('#kpiCapital').textContent=`Marge ${fmtValue(a.marginUsed)} • capacité ${Math.max(0,CONFIG.maxPositions-state.positions.length)} ordre(s)`;$('#kpiPnl').textContent=fmtValue(pnl);$('#kpiPnl').className=`kpi-value ${klass(pnl)}`;$('#kpiPnlPct').textContent=`${pct(pctTot)} • réalisé + latent • frais inclus`;$('#kpiPnlPct').className=`kpi-sub ${klass(pctTot)}`;if($('#realizedPnl')){$('#realizedPnl').textContent=fmtValue(a.realizedTotal);$('#realizedPnl').className=`kpi-value ${klass(a.realizedTotal)}`;}if($('#unrealizedPnl')){$('#unrealizedPnl').textContent=fmtValue(a.unrealizedOpen);$('#unrealizedPnl').className=`kpi-value ${klass(a.unrealizedOpen)}`;}$('#capitalTotalSub').textContent=`3 000 USDT + P&L cumulé depuis le premier ordre`;$('#capitalFreeSub').textContent=`Cash disponible = 3 000 + réalisé - marge bloquée • 100 USDT par position`;}
function renderDecisions(){
  const e=$('#decisionList');if(!e)return;if(!state.decisions.length){e.innerHTML='<div class="empty">Aucune décision AutoPilot enregistrée.</div>';return}
  e.innerHTML='<div class="decision-head"><b>Dernières décisions AutoPilot</b><span>Décisions et ouvertures à chaque scan de 15 min</span></div>'+state.decisions.slice(0,30).map(d=>`<div class="decision-row"><span>${new Date(d.at).toLocaleString()}</span><b>#${d.rank} ${d.name} (${d.symbol.toUpperCase()})</b><span><span class="side-badge ${d.side||'long'}">${(d.side||'long').toUpperCase()}</span> • IA ${score(d.ai)} • FOMO ${score(d.fomo)}</span><span>Risk ${score(d.risk)} • H ${horizonLabel(num(d.horizonMinutes,0))}</span><strong>${d.decision}</strong></div>`).join('');
}

function formatDuration(ms){
  const mins=Math.max(1,Math.round(ms/60000));
  if(mins<60)return `${mins} min`;
  const h=Math.floor(mins/60), m=mins%60;
  if(h<24)return `${h} h${m?` ${m} min`:''}`;
  const d=Math.floor(h/24), rh=h%24;
  return `${d} j${rh?` ${rh} h`:''}`;
}
function renderHistorySummary(){
  const box=$('#historySummary');if(!box)return;
  const a=accountStats(),closed=state.closed,total=closed.length,wins=closed.filter(x=>num(x.netPnlUSDC)>0).length,losses=total-wins,winRate=total?wins/total*100:0;
  const fees=closed.reduce((s,x)=>s+num(x.feesUSDC),0),avg=total?a.realizedClosed/total:0;
  box.innerHTML=[
    ['Réalisé',fmtValue(a.realizedClosed),`${total} clôturé(s)`],
    ['Latent',fmtValue(a.unrealizedOpen),`${state.positions.length} ouverte(s)`],
    ['Cumulé',fmtValue(a.cumulativePnl),`Capital ${fmtValue(a.totalEquity)}`],
    ['Win rate',`${winRate.toFixed(1)} %`,`${wins} gain / ${losses} perte`],
    ['Frais',fmtValue(fees),'déduits du net'],
    ['Trade moyen',fmtValue(avg),'sur positions clôturées']
  ].map(x=>`<div class="history-stat"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('');
}
function renderClosed(){
  renderHistorySummary();
  if(!state.closed.length){$('#closedList').innerHTML='<div class="empty">Historique remis à zéro pour la V8. Les prochaines clôtures seront cumulées ici.</div>';return}
  $('#closedList').innerHTML=state.closed.map(p=>{
    const net=num(p.netPnlUSDC),opened=new Date(p.openedAt||p.closedAt),closedAt=new Date(p.closedAt),dur=Math.max(1,Math.round((closedAt-opened)/60000));
    return `<div class="closed-card-v8 ${net>=0?'win':'loss'}"><span>${closedAt.toLocaleString()}</span><b>${p.name} (${p.symbol.toUpperCase()}) • ${(p.side||'—').toUpperCase()}</b><span>${p.closeReason||'—'}</span><span>Entrée ${fmtValue(p.entryPriceUSDC)}</span><span>Sortie ${fmtValue(p.exitPriceUSDC)}</span><span>${dur<60?dur+' min':(dur/60).toFixed(1)+' h'}</span><b class="${klass(net)}">Net ${fmtValue(net)}</b></div>`;
  }).join('');
}

async function refreshPositionPrices(manual=false){
  if(!state.positions.length){renderPositions();renderPositionKpis();if(manual)toast('Aucune position ouverte.');return}
  try{
    await fetchFx();
    const ids=[...new Set(state.positions.map(p=>p.assetId))];
    const j=await fetchJsonRetry(`${CONFIG.api}/simple/price?ids=${ids.map(encodeURIComponent).join(',')}&vs_currencies=usd`,{headers:{accept:'application/json'}},1);
    for(const p of state.positions){const usd=num(j[p.assetId]?.usd);if(usd)p.currentPriceUSDC=usdToUsdc(usd)}
    checkPriceExits();persistPositions();renderPositions();renderPositionKpis();renderClosed();
    if(manual)toast('Prix LIVE des positions actualisés.');
  }catch(e){if(manual)toast('Prix LIVE indisponibles momentanément — dernières valeurs conservées.');}
}
function startPositionTimer(){clearInterval(state.posTimer);state.posTimer=setInterval(()=>refreshPositionPrices(false),CONFIG.positionMs);refreshPositionPrices(false)}

async function requestNotifications(){if(!('Notification'in window)){toast('Notifications navigateur non prises en charge.');return}if(Notification.permission==='granted'){updateNotificationState();toast('Notifications déjà actives.');return}const perm=await Notification.requestPermission();updateNotificationState();toast(perm==='granted'?'Notifications activées.':'Notifications non autorisées.')}
function updateNotificationState(){const e=$('#notifyState');if(!e)return;const p=('Notification'in window)?Notification.permission:'unsupported';e.textContent=p==='granted'?'ON':p==='denied'?'BLOQUÉ':'OFF';e.className=`kpi-value compact-value ${p==='granted'?'pos':''}`}
function notifyEvent(title,body){toast(`${title.replace('EBYTDA • ','')} — ${body}`);if('Notification'in window&&Notification.permission==='granted'){try{new Notification(title,{body,icon:'assets/ebyt-da-logo.png'})}catch(e){}}}

function setUnit(u){if(u==='usdc')u='usdt';state.unit=u;localStorage.setItem(CONFIG.unitKey,u);$$('[data-unit]').forEach(b=>b.classList.toggle('active',b.dataset.unit===u));if(state.rows.length){renderAll();loadChart()}}
function setLang(l){state.lang=l;localStorage.setItem('ebyt-lang',l);$$('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));applyLanguage();renderCredits();if(state.rows.length)renderAll()}
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
$('#sideSelect').onchange=()=>{const a=state.selected;if(!a)return;$('#ticketTps').textContent='IA dynamique';$('#ticketStop').textContent=score(a.risk);};
$('#notifyBtn').onclick=requestNotifications;
$('#autoPilotToggle').onchange=toggleAuto;
$$('[data-lang]').forEach(b=>b.onclick=()=>setLang(b.dataset.lang));
$$('[data-unit]').forEach(b=>b.onclick=()=>setUnit(b.dataset.unit));
$$('[data-days]').forEach(b=>b.onclick=()=>{$$('[data-days]').forEach(x=>x.classList.toggle('active',x===b));state.chartDays=Number(b.dataset.days);loadChart()});
if($('#clearHistoryBtn'))$('#clearHistoryBtn').onclick=()=>toast('Historique protégé en V6 : le cumul est conservé.');
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAuth();closeOrder()}});
$$('[data-unit]').forEach(b=>b.classList.toggle('active',b.dataset.unit===state.unit));
$$('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===state.lang));
renderAutoUI();showHome();renderCredits();applyLanguage();
})();
