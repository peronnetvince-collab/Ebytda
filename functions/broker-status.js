"use strict";
const {response,methodOnly}=require('./_broker-core');
exports.handler=async(event)=>{
  const stop=methodOnly(event,'GET');if(stop)return stop;
  return response(200,{ok:true,version:'31.0',mode:'PAPER_ONLY',brokerConnected:false,
    broker:'UNDECIDED',liveTradingEnabled:false,autoExecutionEnabled:false,
    authenticBrokerBalance:false,authMode:'DEMO_FRONTEND_ONLY',
    feeEstimateType:'V30_PAPER_PROXY',
    message:'Aucun broker réel n’est relié. Le moteur AutoPilot V30 reste en simulation.'});
};
