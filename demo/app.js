'use strict';
const M=window.FocusGuardModel;
const $=id=>document.getElementById(id);
let state=M.initial();
function announce(text){$('announcement').textContent=text;}
function renderResult(r){
 $('result-title').textContent=r.throttled?'Throttled · 429':'Passed · sample 200';
 $('result-title').className=r.throttled?'throttle':'pass';
 $('result-summary').textContent=r.reason;
 $('flow-read').textContent=r.omitted?'Header omitted':`Raw value: ${JSON.stringify(r.raw)}`;
 $('flow-compare').textContent=`${r.attempt} ${r.throttled?'≥':'<'} ${r.threshold}`;
 $('flow-path').textContent=r.throttled?'Local overload response; request stops here.':'Continue to fictional upstream; sample 200 response.';
 $('details').hidden=false;$('effective').textContent=r.attempt;$('guard').textContent=r.decision;$('metric').textContent=r.attempt;$('metadata').textContent=String(r.throttled);
}
function renderHistory(){
 $('total').textContent=state.total;$('passed').textContent=state.passed;$('throttled').textContent=state.throttled;
 const body=$('history');body.replaceChildren();
 if(!state.history.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=6;td.className='empty';td.textContent='Your fictional requests will appear here.';tr.append(td);body.append(tr);return;}
 for(const r of state.history){const tr=document.createElement('tr');for(const [i,value] of [`#${r.id}`,r.omitted?'(omitted)':JSON.stringify(r.raw),r.attempt,r.threshold,r.decision,r.status].entries()){const td=document.createElement('td');td.textContent=value;if(i===4)td.className=r.throttled?'throttle':'pass';tr.append(td);}body.append(tr);}
}
$('threshold').addEventListener('input',()=>{$('threshold-value').textContent=$('threshold').value;});
$('omit').addEventListener('change',()=>{$('attempt').disabled=$('omit').checked;});
for(const button of document.querySelectorAll('[data-preset]'))button.addEventListener('click',()=>{$('omit').checked=false;$('attempt').disabled=false;$('attempt').value=button.dataset.preset==='threshold'?$('threshold').value:button.dataset.preset==='invalid'?'abc':'1';announce('Sample header selected. Send the request to evaluate it.');});
$('request-form').addEventListener('submit',event=>{event.preventDefault();const r=M.decide($('attempt').value,$('omit').checked,Number($('threshold').value));state=M.record(state,r);renderResult(r);renderHistory();announce(`Request ${state.total}: ${r.decision}. Effective attempt ${r.attempt}, threshold ${r.threshold}, sample status ${r.status}.`);});
$('reset').addEventListener('click',()=>{state=M.initial();$('request-form').reset();$('attempt').disabled=false;$('threshold-value').textContent='3';$('result-title').textContent='Waiting for a request';$('result-title').className='';$('result-summary').textContent='Choose a threshold and send a sample to see the decision.';$('flow-read').textContent='No request yet';$('flow-compare').textContent='attempt ≥ threshold → throttle';$('flow-path').textContent='Pass to sample upstream or return local 429';$('details').hidden=true;renderHistory();announce('Lab reset. Threshold 3, header 1, all counters cleared.');});
