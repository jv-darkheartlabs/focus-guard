(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FocusGuardModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX=4294967295;
function parseAttempt(raw,omitted=false){
 if(omitted)return {attempt:1,fallback:true,reason:'Header omitted; default to attempt 1.'};
 const trimmed=String(raw).replace(/^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g,'');
 if(!/^\+?[0-9]+$/.test(trimmed))return {attempt:1,fallback:true,reason:'Invalid unsigned integer; default to attempt 1.'};
 const value=Number(trimmed);
 if(!Number.isSafeInteger(value)||value<1||value>MAX)return {attempt:1,fallback:true,reason:'Zero or outside the u32 range; default to attempt 1.'};
 return {attempt:value,fallback:false,reason:'Valid positive u32 attempt count.'};
}
function decide(raw,omitted,threshold){
 if(!Number.isInteger(threshold)||threshold<1||threshold>10)throw new RangeError('Demo threshold must be an integer from 1 to 10.');
 const parsed=parseAttempt(raw,omitted);const throttled=parsed.attempt>=threshold;
 return {...parsed,raw:String(raw),omitted:Boolean(omitted),threshold,throttled,status:throttled?429:200,decision:throttled?'throttled':'pass',tars:'disabled'};
}
function initial(){return {total:0,passed:0,throttled:0,history:[]};}
function record(state,result){return {total:state.total+1,passed:state.passed+(result.throttled?0:1),throttled:state.throttled+(result.throttled?1:0),history:[{...result,id:state.total+1},...state.history].slice(0,20)};}
return {parseAttempt,decide,initial,record};
});
