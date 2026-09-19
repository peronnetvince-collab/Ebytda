"use strict";
const {fail}=require('./_broker-core');
exports.handler=async()=>fail(403,'REAL_TRADING_DISABLED','EBYTDA V31 refuse tous les ordres réels sans exception.');
