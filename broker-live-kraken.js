/* V31.2 MANUAL LIVE KRAKEN — isolated from historical AutoPilot. */
(()=>{'use strict';
  const $=id=>document.getElementById(id);
  let enabled=false,token=null,signature='',lastOrder=null;
  const fields=['v312Asset','v312Quote','v312Side','v312Amount','v312Limit'];
  const selection=()=>{
    const snap=window.EBYTDA_V31_BRIDGE?.snapshot?.();
    const id=$('deskAsset')?.value;
    return snap?.ranked?.find(x=>x.id===id)||snap?.selected||null;
  };
  function ticket(){return {mode:'manual_live',broker:'KRAKEN',type:'LIMIT',
    symbol:$('v312Asset').value.toUpperCase().trim(),quote:$('v312Quote').value,
    side:$('v312Side').value,amountQuote:$('v312Amount').value,
    limitPriceQuote:$('v312Limit').value,
    horizon:document.querySelector('[data-desk-horizon].active')?.dataset.deskHorizon||'DAY'};}
  function sig(){return JSON.stringify(ticket());}
  function reset(){token=null;signature='';$('v312PlaceBtn').disabled=true;
    $('v312Preview').className='desk-preview';
    $('v312Preview').textContent='Ticket modifié : recommencez la prévisualisation sécurisée.';}
  function message(msg,isError=false){$('v312LastResult').textContent=msg;
    $('v312LastResult').className='desk-live-result '+(isError?'error':'success');}
  async function request(name,body){
    const res=await fetch('/.netlify/functions/'+name,{method:'POST',credentials:'same-origin',
      cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});
    const data=await res.json().catch(()=>({ok:false,code:'BAD_SERVER_RESPONSE'}));
    if(!res.ok||!data.ok)throw Error(data.code||'BROKER_ERROR');return data;
  }
  async function status(){
    try{const res=await fetch('/.netlify/functions/broker-kraken-status',{cache:'no-store'});
      if(!res.ok)throw Error('SERVER_OFFLINE');const r=await res.json();enabled=Boolean(r.manualLiveReady);
      $('v312Status').textContent=enabled?'KRAKEN MANUEL • SERVEUR PRÊT':'KRAKEN LIVE • VERROUILLÉ';
      $('v312Status').className=enabled?'badge':'badge desk-disabled';
      $('v312PreviewBtn').disabled=!enabled;
      if($('deskLiveState')){$('deskLiveState').textContent=enabled?'MANUEL DISPONIBLE':'VERROUILLÉS';
      $('deskLiveState').className=enabled?'green':'desk-red';}
      if($('deskBrokerState')&&enabled)$('deskBrokerState').textContent='KRAKEN READY';
      if(!enabled)message('Serveur non configuré. Trading papier V30/V31 et graphique TradingView restent disponibles.',true);
    }catch{enabled=false;$('v312Status').textContent='KRAKEN LIVE • SERVEUR ABSENT';
      $('v312PreviewBtn').disabled=true;message('Démo locale : aucun ordre réel possible. Déployez les Netlify Functions pour configurer le broker.',true);}
  }
  function syncAsset(){const a=selection();if(a?.symbol&&/^[A-Za-z0-9]{2,15}$/.test(a.symbol)){
    const el=$('v312Asset');if(!el.dataset.dirty&&el.value!==a.symbol.toUpperCase()){
      el.value=a.symbol.toUpperCase();reset();}}}
  async function preview(){
    if(!enabled)return;
    const v=ticket(),pw=$('v312Passphrase').value;
    token=null;$('v312PlaceBtn').disabled=true;$('v312PreviewBtn').disabled=true;
    try{
      if(pw.length<20)throw Error('PHRASE_SECRETE_REQUISE');
      const r=await request('broker-kraken-preview',{...v,orderPassphrase:pw});
      $('v312Passphrase').value='';
      token=r.previewToken;signature=sig();lastOrder=r;
      const m=r.market;const box=$('v312Preview');box.className='desk-preview success';
      box.replaceChildren();
      const t=document.createElement('b');t.textContent='✓ Prévisualisation Kraken validée — AUCUN ORDRE ENVOYÉ';box.append(t);
      const g=document.createElement('div');g.className='desk-preview-grid';
      for(const [k,val] of [['Paire',m.pairName],['Achat / Vente',v.side],
        ['Prix LIMIT',Number(v.limitPriceQuote).toLocaleString('fr-FR')+' '+v.quote],
        ['Cours broker',m.priceBroker.toLocaleString('fr-FR')+' '+v.quote],
        ['Quantité',m.quantity],['Valeur estimée',m.estimatedValueQuote.toFixed(2)+' '+v.quote],
        ['Durée / expiration',v.horizon==='DAY'?'Ordre expiré sous 24 h':'Ordre expiré sous 7 jours'],
        ['Stop/TP','NON PLACÉS'],['Ticket valide','45 secondes']]){
        const e=document.createElement('span'),b=document.createElement('b');b.textContent=k+': ';
        e.append(b,document.createTextNode(String(val)));g.append(e);}
      box.append(g);
      $('v312PlaceBtn').disabled=!$('v312Acknowledged').checked;
      message('Prévisualisation validée. Ressaisissez la phrase secrète pour confirmer, avant l’expiration de 45 s.');
    }catch(e){$('v312Passphrase').value='';$('v312Preview').className='desk-preview error';
      $('v312Preview').textContent='Prévisualisation refusée : '+e.message;
      message('Aucun ordre envoyé.',true);
    }finally{$('v312PreviewBtn').disabled=!enabled;}
  }
  async function place(){
    if(!enabled||!token||sig()!==signature||!$('v312Acknowledged').checked)return;
    const pw=$('v312Passphrase').value;
    if(pw.length<20){message('Phrase secrète requise une seconde fois pour confirmer.',true);return;}
    const name=ticket().symbol+' / '+ticket().quote;
    const btn=$('v312PlaceBtn');btn.disabled=true;
    const sentToken=token;token=null; // client never retries the same token
    try{
      if(!window.confirm('CONFIRMATION RÉELLE : transmettre un ordre Spot LIMIT '+ticket().side+' '+name+' sur Kraken ? Sans stop-loss automatique.')){
        message('Ordre réel non transmis. Prévisualisez de nouveau pour reprendre.');return;}
      const r=await request('broker-kraken-place',{previewToken:sentToken,confirm:true,orderPassphrase:pw});
      message('Ordre accepté par Kraken : '+(r.brokerOrderId||r.clientOrderId)+
        '. Son exécution n’est PAS confirmée. Vérifiez les ordres ouverts et les transactions chez Kraken.');
      $('v312Preview').textContent='Ordre soumis : nouvelle prévisualisation nécessaire pour toute autre opération.';
    }catch(e){message(e.message==='ORDER_RESULT_UNCERTAIN'?
       'Statut incertain. Vérifiez Kraken AVANT toute nouvelle tentative ; ne répétez pas cet ordre.':
       'Ordre non confirmé : '+e.message+'. Consultez Kraken avant de recommencer.',true);
    }finally{$('v312Passphrase').value='';}
  }
  function init(){if(!$('v312PreviewBtn'))return;
    fields.forEach(id=>{$(id).addEventListener('input',reset);$(id).addEventListener('change',reset);});
    $('v312Asset').addEventListener('input',()=>{$('v312Asset').dataset.dirty='1';});
    document.querySelectorAll('[data-desk-horizon]').forEach(b=>b.addEventListener('click',reset));
    $('v312Acknowledged').addEventListener('change',()=>{
      $('v312PlaceBtn').disabled=!token||sig()!==signature||!$('v312Acknowledged').checked;});
    $('v312PreviewBtn').addEventListener('click',preview);
    $('v312PlaceBtn').addEventListener('click',place);
    $('deskAsset')?.addEventListener('change',syncAsset);
    document.querySelector('[data-private-nav="tradingDesk"]')?.addEventListener('click',()=>{syncAsset();status();});
    syncAsset();status();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
