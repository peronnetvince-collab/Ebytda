"use strict";
const {response,methodOnly,parse,ticket,errorResponse}=require('./_broker-core');
exports.handler=async(event)=>{
  const stop=methodOnly(event,'POST');if(stop)return stop;
  try {
    const input=parse(event),draft=ticket(input);
    const clientOrderId=String(input.clientOrderId||'');
    if(!/^[A-Za-z0-9_-]{12,80}$/.test(clientOrderId))throw new Error('INVALID_CLIENT_ORDER_ID');
    // This endpoint does not persist a server position or contact an exchange.
    return response(200,{ok:true,mode:'PAPER_ONLY',status:'SIMULATED_NOT_EXECUTED',
      simulationId:clientOrderId,at:new Date().toISOString(),
      ticket:draft,brokerOrderId:null,brokerFilledQuantity:null,
      message:'Simulation effectuée. Aucun ordre réel envoyé, aucun solde débité.'});
  } catch(e){return errorResponse(e);}
};
