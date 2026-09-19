/* EBYTDA V31 BROKER CONNECT — ADDITIVE ONLY, SERVER DENIES LIVE ORDERS. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const bridge=()=>window.EBYTDA_V31_BRIDGE?.snapshot?.()||{selected:null,ranked:[],liveMarket:false};
  const KEY='ebyt-v31-broker-paper-log';
  let horizon='DAY',lastPreview=null,lastTicketSignature='',serverAvailable=false,busy=false;
  let currentAssetId='',paperLog=[];
  try {const t=JSON.parse(localStorage.getItem(KEY)||'[]');paperLog=Array.isArray(t)?t.slice(0,100):[];} catch {paperLog=[];}
  const asNumber=v=>Number(v);
  const asMoney=n=>Number(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDT';
  const asPrice=n=>Number(n).toLocaleString('fr-FR',{maximumFractionDigits:10});
  const hasPrice=a=>Number.isFinite(Number(a?.price))&&Number(a?.price)>0;
  function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3600);}
  function selected(){const s=bridge();return s.ranked.find(a=>a.id===currentAssetId)|| (s.selected?.id===currentAssetId?s.selected:null);}
  function invalidate(){lastPreview=null;lastTicketSignature='';$('deskPaperButton').disabled=true;$('deskPreview').className='desk-preview';$('deskPreview').textContent='Ticket modifié. Prévisualisez à nouveau pour enregistrer une simulation.';}
  function syncAssetChoices(){
    const s=bridge(),list=s.ranked.slice(0,10);
    if(s.selected && !list.some(a=>a.id===s.selected.id))list.push(s.selected);
    const old=$('deskAsset').value;
    const key=list.map(a=>a.id).join('|');
    if($('deskAsset').dataset.key===key)return;
    $('deskAsset').dataset.key=key;
    $('deskAsset').replaceChildren();
    if(!list.length){const opt=new Option('Aucun scan — saisie manuelle BTC','DEMO:BTC');$('deskAsset').add(opt);currentAssetId='DEMO:BTC';$('deskPickInfo').textContent='Aucun scan chargé : BTC est un symbole d’essai. Saisissez un prix de référence.';return;}
    for(const a of list){const opt=new Option(`${a.symbol.toUpperCase()} — ${a.name} • IA ${Number(a.ai).toFixed(1)}`,a.id);$('deskAsset').add(opt);}
    const next=list.some(a=>a.id===old)?old:list[0].id;
    $('deskAsset').value=next; currentAssetId=next;
    pickAsset(next);
  }
  function pickAsset(id){
    currentAssetId=id;$('deskAsset').value=id;
    const a=selected();
    if(a && hasPrice(a)){
      $('deskPrice').value=Number(a.price).toPrecision(10).replace(/\.?0+$/,'');
      $('deskQuoteStatus').textContent=bridge().liveMarket?'EBYTDA LIVE':'SOURCE NON LIVE';
      $('deskQuoteStatus').className=bridge().liveMarket?'green':'gold';
      $('deskPickInfo').textContent=`${a.name} (${a.symbol.toUpperCase()}) — score IA ${Number(a.ai).toFixed(2)}. Le prix est une référence EBYTDA, pas une cotation du broker.`;
      $('deskAssetScore').textContent=`IA ${Number(a.ai).toFixed(1)} • ${a.signal||'—'}`;
      if(/^[A-Z0-9]{2,15}$/.test(a.symbol.toUpperCase())){$('deskWidgetSymbol').value=a.symbol.toUpperCase()+'USDT';$('deskChartTitle').textContent=a.symbol.toUpperCase()+' / USDT';}
    } else {
      $('deskQuoteStatus').textContent='PRIX MANUEL';$('deskQuoteStatus').className='gold';
      $('deskPickInfo').textContent='Saisissez un prix de référence USDT (aucune cotation disponible).';
    }
    invalidate();
    scheduleChartRefresh();
  }
  function ticket(){
    const a=selected();
    const sym=(a?.symbol||'BTC').toUpperCase();
    return {
      mode:'paper', broker:$('deskBroker').value, symbol:sym,side:$('deskSide').value,
      horizon,type:$('deskType').value,amountUSDT:$('deskAmount').value,
      referencePriceUSDT:$('deskPrice').value,limitPriceUSDT:$('deskType').value==='LIMIT'?$('deskLimit').value:null,
      stopLossUSDT:$('deskStop').value||null,takeProfitUSDT:$('deskTarget').value||null,
    };
  }
  function localValidate(x){
    if(x.mode!=='paper')throw Error('Ordre réel refusé.');
    if(!/^[A-Z0-9]{2,15}$/.test(x.symbol))throw Error('Symbole non valide.');
    if(!['BUY','SELL'].includes(x.side))throw Error('Sens non valide.');
    if(!['DAY','WEEK'].includes(x.horizon))throw Error('Horizon non valide.');
    if(!['MARKET','LIMIT'].includes(x.type))throw Error('Type d’ordre non valide.');
    if(!['UNDECIDED','KRAKEN','BINANCE','COINBASE','OTHER'].includes(x.broker))throw Error('Broker non valide.');
    const amount=Number(x.amountUSDT),p=Number(x.referencePriceUSDT);
    if(!x.amountUSDT||!Number.isFinite(amount)||amount<10||amount>1000)throw Error('Montant papier : 10 à 1 000 USDT.');
    if(!x.referencePriceUSDT||!Number.isFinite(p)||p<=0)throw Error('Prix de référence positif requis.');
    const lp=x.type==='LIMIT'?Number(x.limitPriceUSDT):null;
    if(x.type==='LIMIT'&&(!x.limitPriceUSDT||!Number.isFinite(lp)||lp<=0))throw Error('Prix limite positif requis.');
    const entry=lp||p;
    const stop=x.stopLossUSDT===null?null:Number(x.stopLossUSDT);
    const target=x.takeProfitUSDT===null?null:Number(x.takeProfitUSDT);
    if(stop!==null&&(!Number.isFinite(stop)||stop<=0))throw Error('Stop indicatif non valide.');
    if(target!==null&&(!Number.isFinite(target)||target<=0))throw Error('Objectif indicatif non valide.');
    if(x.side==='BUY'&&stop!==null&&stop>=entry)throw Error('Pour ACHAT, stop sous le prix simulé.');
    if(x.side==='BUY'&&target!==null&&target<=entry)throw Error('Pour ACHAT, objectif au-dessus du prix simulé.');
    if(x.side==='SELL'&&(stop!==null||target!==null))throw Error('Pour VENTE SPOT, laissez stop/objectif vides dans cette V31.');
    return {symbol:x.symbol,side:x.side,horizon:x.horizon,type:x.type,broker:x.broker,
      amountUSDT:amount,referencePriceUSDT:p,limitPriceUSDT:lp,previewPriceUSDT:entry,
      stopLossUSDT:stop,takeProfitUSDT:target,quantityEstimate:amount/entry,
      feeEstimateUSDT:amount*.43666666665/100,
      previewStatus:'PAPER_ONLY',executionPriceGuaranteed:false,brokerConnected:false,stopsPlaced:false,liveTradingEnabled:false};
  }
  async function post(name,payload){
    if(!serverAvailable)throw new Error('SERVER_OFFLINE');
    const res=await fetch('/.netlify/functions/'+name,{method:'POST',credentials:'same-origin',
      headers:{'content-type':'application/json','accept':'application/json'},cache:'no-store',body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>null);
    if(!res.ok||!data?.ok)throw Error(data?.code||'SERVER_REJECTED');
    return data;
  }
  async function checkServer(){
    try {
      const res=await fetch('/.netlify/functions/broker-status',{cache:'no-store',credentials:'same-origin'});
      if(!res.ok)throw Error('SERVER_OFFLINE');
      const data=await res.json();
      if(!data.ok||data.liveTradingEnabled!==false||data.brokerConnected!==false)throw Error('STATUS_UNSAFE');
      serverAvailable=true;
      $('deskBackendState').textContent='SERVER TEST DISPONIBLE';
      $('deskBackendState').className='badge';
    } catch {
      serverAvailable=false;
      $('deskBackendState').textContent='TEST LOCAL • SANS SERVER';
      $('deskBackendState').className='badge desk-disabled';
    }
  }
  function signature(t){return JSON.stringify(t);}
  async function preview(){
    if(busy)return;busy=true;$('deskPreviewButton').disabled=true;
    const raw=ticket(),sig=signature(raw);lastPreview=null;$('deskPaperButton').disabled=true;
    try {
      const valid=localValidate(raw);
      const reply=serverAvailable?await post('broker-preview',raw):{ticket:valid};
      const t=reply.ticket;
      if(t.liveTradingEnabled!==false || t.brokerConnected!==false)throw Error('SECURITY_STOP');
      lastPreview=t;lastTicketSignature=sig;
      const div=$('deskPreview');div.className='desk-preview success';div.replaceChildren();
      const top=document.createElement('div');top.textContent=serverAvailable?'✓ Prévisualisation contrôlée côté serveur • PAPER':'✓ Aperçu local hors ligne • PAPER (aucun serveur)';div.append(top);
      const grid=document.createElement('div');grid.className='desk-preview-grid';
      const entries=[['Actif',t.symbol+'/USDT'],['Sens / Horizon',t.side+' / '+t.horizon],
        ['Montant',asMoney(t.amountUSDT)],['Prix indicatif',asPrice(t.previewPriceUSDT)+' USDT'],
        ['Quantité estimée',asPrice(t.quantityEstimate)],['Frais estimés / côté',asMoney(t.feeEstimateUSDT)],
        ['Stops / TP','Indicatifs, jamais placés'],['Exécution réelle','DÉSACTIVÉE']];
      for(const [k,v] of entries){const cell=document.createElement('span');
        const b=document.createElement('b');b.textContent=k+': ';const txt=document.createTextNode(v);cell.append(b,txt);grid.append(cell);}
      div.append(grid);
      $('deskPaperButton').disabled=!$('deskConfirmPaper').checked;
    }catch(e){const div=$('deskPreview');div.className='desk-preview error';div.textContent='Prévisualisation refusée : '+String(e.message||e);}
    finally{busy=false;$('deskPreviewButton').disabled=false;}
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify(paperLog.slice(0,100)));}catch{toast('Journal local non disponible dans ce navigateur.');}}
  function renderLog(){
    $('deskCount').textContent=String(paperLog.length);
    const box=$('deskJournal');box.replaceChildren();
    if(!paperLog.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=8;td.textContent='Aucun ordre papier V31.';tr.append(td);box.append(tr);return;}
    for(const p of paperLog.slice(0,100)){
      const tr=document.createElement('tr');
      const vals=[new Date(p.at).toLocaleString('fr-FR'),p.ticket.symbol,p.ticket.side,
        p.ticket.horizon,asMoney(p.ticket.amountUSDT),asPrice(p.ticket.previewPriceUSDT),
        asPrice(p.ticket.quantityEstimate),p.status];
      for(const v of vals){const td=document.createElement('td');td.textContent=v;tr.append(td);}box.append(tr);
    }
  }
  async function paper(){
    if(busy||!lastPreview||!$('deskConfirmPaper').checked||lastTicketSignature!==signature(ticket()))return;
    busy=true;$('deskPaperButton').disabled=true;
    const raw=ticket(),clientOrderId='paper_'+Date.now()+'_'+Math.random().toString(36).slice(2,12);
    if(paperLog.some(x=>x.id===clientOrderId)){busy=false;return;}
    try {
      localValidate(raw);
      const result=serverAvailable?await post('broker-paper-order',{...raw,clientOrderId}):
        {status:'SIMULATED_LOCAL_ONLY',simulationId:clientOrderId,at:new Date().toISOString(),ticket:localValidate(raw)};
      if(!['SIMULATED_NOT_EXECUTED','SIMULATED_LOCAL_ONLY'].includes(result.status)||result.ticket?.liveTradingEnabled!==false)throw Error('PAPER_STATUS_INVALID');
      paperLog.unshift({id:result.simulationId,at:result.at,ticket:result.ticket,status:serverAvailable?'SIMULÉ • SERVER':'SIMULÉ • LOCAL'});
      paperLog=paperLog.slice(0,100);save();renderLog();
      lastPreview=null;lastTicketSignature='';$('deskConfirmPaper').checked=false;
      $('deskPreview').className='desk-preview success';
      $('deskPreview').textContent='Ordre papier simulé et journalisé. Aucune transmission à un exchange. Aucun mouvement de fonds.';
      toast('Ordre papier V31 simulé — aucun ordre réel envoyé.');
    }catch(e){$('deskPreview').className='desk-preview error';$('deskPreview').textContent='Simulation non enregistrée : '+String(e.message||e);}
    finally{busy=false;}
  }
  function useSelected(){const x=bridge().selected;if(!x){toast('Sélectionnez une crypto dans le TOP 200 EBYTDA.');return;}
    syncAssetChoices();if(!$('deskAsset').querySelector('option[value="'+CSS.escape(x.id)+'"]')){
      const opt=new Option(`${x.symbol.toUpperCase()} — ${x.name}`,x.id);$('deskAsset').add(opt);
    }pickAsset(x.id);toast('Actif EBYTDA repris dans le ticket V31.');}
  function useTop(){const a=bridge().ranked[0];if(!a){toast('En attente du scan Top 200.');return;}syncAssetChoices();pickAsset(a.id);}
  let chartLoaded=false,chartReloadTimer=null;
  function chartSelection(){
    const symbol=$('deskWidgetSymbol').value.toUpperCase().trim();
    const exchange=$('deskWidgetExchange').value;
    const interval=$('deskWidgetInterval').value;
    if(!/^[A-Z0-9]{4,24}$/.test(symbol))throw Error('Paire graphique invalide (ex. BTCUSDT).');
    if(!['BINANCE','BITGET','KRAKEN','COINBASE'].includes(exchange))throw Error('Place graphique non reconnue.');
    if(!['15','60','240','D'].includes(interval))throw Error('Intervalle non reconnu.');
    return {symbol,exchange,interval};
  }
  function tradingViewUrl(){
    const {symbol,exchange,interval}=chartSelection();
    const url=new URL('https://www.tradingview.com/chart/');
    url.searchParams.set('symbol',exchange+':'+symbol);
    url.searchParams.set('interval',interval);
    return url.toString();
  }
  function widget(){
    let opts;
    try{opts=chartSelection();}catch(e){toast(e.message);return;}
    const frame=$('deskWidgetContainer');frame.replaceChildren();frame.classList.remove('hidden');$('deskWidgetPlaceholder').classList.add('hidden');
    const wrap=document.createElement('div');wrap.className='tradingview-widget-container';
    const w=document.createElement('div');w.className='tradingview-widget-container__widget';wrap.append(w);
    const script=document.createElement('script');script.async=true;
    script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.textContent=JSON.stringify({autosize:true,symbol:opts.exchange+':'+opts.symbol,interval:opts.interval,
      timezone:'Europe/Paris',theme:'dark',style:'1',locale:'fr',enable_publishing:false,
      allow_symbol_change:true,hide_top_toolbar:false,hide_legend:false,save_image:false,
      calendar:false,support_host:'https://www.tradingview.com'});
    script.onerror=()=>{
      frame.replaceChildren();frame.classList.add('hidden');$('deskWidgetPlaceholder').classList.remove('hidden');
      $('deskWidgetPlaceholder').querySelector('strong').textContent='TradingView indisponible dans la page';
      $('deskWidgetPlaceholder').querySelector('span').textContent='Utilisez « Ouvrir TradingView » ou vérifiez les bloqueurs de scripts et votre connexion.';
      chartLoaded=false;
      toast('Widget tiers indisponible. Vous pouvez ouvrir TradingView dans un autre onglet.');
    };
    wrap.append(script);frame.append(wrap);
    $('deskChartTitle').textContent=opts.exchange+':'+opts.symbol+' • TradingView';
    chartLoaded=true;
  }
  function scheduleChartRefresh(){
    if(!chartLoaded)return;
    clearTimeout(chartReloadTimer);
    chartReloadTimer=setTimeout(widget,300);
  }
  function openTradingView(){
    try{
      const url=tradingViewUrl();
      // The URL is constructed exclusively from validated inputs and a fixed official origin.
      window.open(url,'_blank','noopener,noreferrer');
    }catch(e){toast(e.message);}
  }
  function init(){
    if(!$('tradingDesk'))return;
    const nav=document.querySelector('[data-private-nav="tradingDesk"]');
    nav?.addEventListener('click',()=>{syncAssetChoices();checkServer();if(!chartLoaded)setTimeout(widget,100);});
    $('sendSelectedToDesk')?.addEventListener('click',()=>{useSelected();nav?.click();$('tradingDesk').scrollIntoView({behavior:'smooth',block:'start'});});
    $('deskAsset').addEventListener('change',e=>pickAsset(e.target.value));
    $('deskUseSelected').addEventListener('click',useSelected);
    $('deskUseTop').addEventListener('click',useTop);
    document.querySelectorAll('[data-desk-horizon]').forEach(b=>b.addEventListener('click',()=>{
      horizon=b.dataset.deskHorizon;document.querySelectorAll('[data-desk-horizon]').forEach(x=>x.classList.toggle('active',x===b));invalidate();
    }));
    $('deskType').addEventListener('change',()=>{$('deskLimitField').classList.toggle('hidden',$('deskType').value!=='LIMIT');invalidate();});
    document.querySelectorAll('.desk-form input,.desk-form select').forEach(x=>{
      if(['deskAsset','deskType'].includes(x.id))return;
      x.addEventListener('input',invalidate);x.addEventListener('change',invalidate);
    });
    $('deskConfirmPaper').addEventListener('change',()=>{$('deskPaperButton').disabled=busy||!lastPreview||lastTicketSignature!==signature(ticket())||!$('deskConfirmPaper').checked;});
    $('deskPreviewButton').addEventListener('click',preview);
    $('deskPaperButton').addEventListener('click',paper);
    $('deskLoadWidget').addEventListener('click',widget);
    $('deskOpenTradingView').addEventListener('click',openTradingView);
    ['deskWidgetExchange','deskWidgetInterval'].forEach(id=>$(id).addEventListener('change',scheduleChartRefresh));
    $('deskWidgetSymbol').addEventListener('change',scheduleChartRefresh);
    $('deskClearJournal').addEventListener('click',()=>{if(!confirm('Effacer uniquement le journal papier V31 ? Le portefeuille V30 sera conservé.'))return;paperLog=[];save();renderLog();toast('Journal papier V31 effacé.');});
    renderLog();syncAssetChoices();checkServer();
    const timer=setInterval(()=>{if(!document.hidden&&document.querySelector('#privateApp:not(.hidden)'))syncAssetChoices();},5000);
    window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
