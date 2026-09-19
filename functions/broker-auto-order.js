"use strict";
const {fail}=require('./_broker-core');
exports.handler=async()=>fail(403,'AUTO_TRADING_DISABLED','EBYTDA V31 refuse toute exécution automatique réelle.');
