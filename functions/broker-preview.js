"use strict";
const {response,methodOnly,parse,ticket,errorResponse}=require('./_broker-core');
exports.handler=async(event)=>{
  const stop=methodOnly(event,'POST');if(stop)return stop;
  try {return response(200,{ok:true,ticket:ticket(parse(event)),submitted:false});}
  catch(e){return errorResponse(e);}
};
