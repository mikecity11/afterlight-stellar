const content = document.querySelector('#content');
const options = [
  { id: 'lost-response', title: 'Payment sent. Response lost.', description: 'The ledger confirms the payment. Your app receives a timeout.' },
  { id: 'outage', title: 'A temporary outage', description: 'Submission is unavailable. Does your app recover safely?' },
  { id: 'missing-trustline', title: 'Recipient cannot receive', description: 'A LAB asset payment is rejected because the trustline is missing.' }
];
let scenario = options[0].id, recovery = 'broken', accounts = null, busy = false, report = null;
let history = []; try { history = JSON.parse(localStorage.getItem('afterlight-reports') || '[]'); } catch {}
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const short = value => value.slice(0, 8) + '…' + value.slice(-6);
function draw() {
  const page = location.pathname === '/docs' ? 'docs' : location.pathname === '/about' ? 'about' : 'lab';
  document.querySelectorAll('[data-page]').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  if (page === 'docs') return docs();
  if (page === 'about') return about();
  content.innerHTML = `<div class="intro"><div><div class="eyebrow">Stellar payment recovery lab / v0.1</div><h1>When the response fails,<br><em>did the payment?</em></h1></div><div><p>Break the connection. Follow the money. Find out whether your payment app recovers correctly.</p><span class="pill">Real testnet payments · No real funds</span></div></div>
  <div class="layout"><section class="panel panel-pad"><h2>Design your experiment</h2><p class="small">Choose a failure. Compare recovery behavior.</p>${options.map((o,i)=>`<button class="scenario ${o.id===scenario?'selected':''}" data-scenario="${o.id}" aria-pressed="${o.id===scenario}" ${busy?'disabled':''}><span class="num">SCENARIO 0${i+1}</span><strong>${o.title}</strong><p>${o.description}</p></button>`).join('')}
  <span class="label">Demo application behavior</span><div class="segmented"><button data-mode="broken" class="${recovery==='broken'?'selected':''}" aria-pressed="${recovery==='broken'}" ${busy?'disabled':''}>Broken recovery</button><button data-mode="correct" class="${recovery==='correct'?'selected':''}" aria-pressed="${recovery==='correct'}" ${busy?'disabled':''}>Correct recovery</button></div>
  <button id="run" class="primary" ${busy?'disabled':''}>${busy?'Running experiment…':accounts?'Run experiment ↗':'Create test accounts & run ↗'}</button><div id="status" class="status" role="status">${accounts?`Test accounts ready<br>${short(accounts.source.publicKey)} → ${short(accounts.destination.publicKey)}`:'Two disposable accounts will be funded by Stellar Friendbot.'}</div><div id="error" role="alert"></div>
  <div class="notice">Use disposable test accounts only. The demo sends 1 XLM or 1 LAB. Test account keys stay in this page’s memory and are sent to the server to sign demo transactions.</div></section>
  <section class="panel workspace" aria-live="polite"><div class="workspace-head"><h2>Experiment evidence</h2>${report?`<button class="secondary" id="export">Export JSON ↓</button>`:'<span class="pill">Awaiting run</span>'}</div><div id="evidence">${report?reportHTML(report):`<div class="empty"><div class="orbit"><span>↗</span></div><h3>Trust the ledger. Test the app.</h3><p>Your report will show actual settlement, application status, and every observed transaction.</p></div>`}</div></section></div>
  <div class="below"><article><div class="eyebrow">01 / Inject</div><h3>A failure at the right moment.</h3><p>Drop a response after settlement, interrupt submission, or trigger a real asset rejection.</p></article><article><div class="eyebrow">02 / Recover</div><h3>Watch what the app does next.</h3><p>Compare a new payment with a retry of the original signed transaction.</p></article><article><div class="eyebrow">03 / Verify</div><h3>Evidence over assumptions.</h3><p>Check recipient balances and confirmed transactions against the intended outcome.</p></article></div>
  <section class="history"><div class="eyebrow">Recent runs / saved in this browser</div>${history.slice(0,8).map((r,i)=>`<button class="secondary" data-history="${i}">${esc(r.verdict)} · ${esc(r.scenario)} · ${esc(r.recovery)}</button>`).join('')}</section>`;
  document.querySelectorAll('[data-scenario]').forEach(b=>b.onclick=()=>{scenario=b.dataset.scenario;draw();});
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{recovery=b.dataset.mode;draw();});
  document.querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>{report=history[Number(b.dataset.history)];draw();});
  document.querySelector('#run').onclick = run;
  const exportButton = document.querySelector('#export'); if(exportButton) exportButton.onclick = exportReport;
}
function reportHTML(r) {
  return `<div class="metrics"><div class="metric"><small>Recipient received</small><strong>${Number(r.received).toFixed(2)} <span class="small">${esc(r.asset)}</span></strong></div><div class="metric"><small>Application status</small><strong>${esc(r.applicationStatus)}</strong></div><div class="metric"><small>Recovery verdict</small><strong><span class="badge ${r.verdict==='PASS'?'pass':'fail'}">${esc(r.verdict)}</span></strong></div></div><div class="report-body"><div class="eyebrow">${esc(r.scenario)} / ${esc(r.recovery)}</div>${r.checks.map(c=>`<div class="check"><span style="color:${c.pass?'#61823d':'#b43b3b'}">${c.pass?'✓':'×'}</span><div><strong>${esc(c.name)}</strong><p>${esc(c.detail)}</p></div></div>`).join('')}<div class="timeline"><h3>What happened</h3>${r.events.map(e=>`<div class="event"><strong>${esc(e.title)}</strong><p>${esc(e.detail)}</p></div>`).join('')}</div><h3>Ledger evidence ↗</h3>${r.transactions.length?r.transactions.map(t=>`<a class="tx" href="https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(t.hash)}" target="_blank" rel="noopener noreferrer">${t.successful?'SUCCESS':'REJECTED'} · ${esc(t.hash)} ↗</a>`).join(''):'<p class="small">No confirmed transaction was found for this run.</p>'}<p class="small">Source ${esc(short(r.source))} · Recipient ${esc(short(r.destination))}<br>${esc(r.network)} · ${esc(new Date(r.createdAt).toLocaleString())}</p></div>`;
}
async function api(path, body) {
  const response = await fetch(`/api/${path}`, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(150000) });
  const result = await response.json(); if(!response.ok) throw new Error(result.error || 'Request failed.'); return result;
}
async function run() {
  if(busy)return; busy=true;draw();
  try {
    if(!accounts){ document.querySelector('#status').textContent='Funding disposable accounts on Stellar testnet…'; accounts=await api('setup',{}); }
    document.querySelector('#status').textContent='Submitting payment, applying the fault, and independently checking the ledger…';
    report=await api('run',{sourceSecret:accounts.source.secret,destinationSecret:accounts.destination.secret,scenario,recovery});
    history.unshift(report);history=history.slice(0,20);try{localStorage.setItem('afterlight-reports',JSON.stringify(history));}catch{}
    busy=false;draw();
  } catch(error){busy=false;draw();document.querySelector('#error').innerHTML=`<div class="error">${esc(error.message)}<br>This run is incomplete. No passing result was generated. Before retrying an interrupted run, check the test accounts on Stellar Expert.</div>`;}
}
function exportReport(){const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`afterlight-${report.id}.json`;a.click();URL.revokeObjectURL(url);}
function docs(){content.innerHTML=`<article class="docs"><div class="eyebrow">Developer guide / classic payments</div><h1>Rehearse a failure.<br><em>Keep the evidence.</em></h1><p>Afterlight v0.1 provides a testnet submission adapter and a built-in comparison app. It supports one classic payment per transaction. Soroban contract invocations and full Horizon/RPC drop-in compatibility are not supported yet.</p><h2>1. Build and sign a testnet payment</h2><p>Keep signing inside your own application. Send only the signed XDR to the proxy. Never send real wallet secrets.</p><h2>2. Submit through the fault adapter</h2><pre>const response = await fetch('/api/proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    xdr: signedTransaction.toXDR(),
    scenario: 'lost-response',
    attempt: 1
  })
});</pre><table><thead><tr><th>Scenario</th><th>First attempt</th><th>Recovery attempt</th></tr></thead><tbody><tr><td>lost-response</td><td>Forwards payment; hides success with HTTP 504.</td><td>Normal submission response.</td></tr><tr><td>outage</td><td>HTTP 503 before forwarding.</td><td>Normal submission response.</td></tr><tr><td>missing-trustline</td><td>Real Stellar rejection for the LAB test asset.</td><td>Rejection persists until the underlying issue is corrected.</td></tr></tbody></table><h2>3. Preserve the original transaction</h2><p>A timeout is an unknown outcome. Look up the original transaction hash directly on testnet. If it succeeded, record it as paid. If it is unconfirmed, retry the same signed envelope while it remains valid. Do not create a replacement payment simply because the response was lost.</p><h2>4. Add application assertions</h2><p>Use the exported <code>assess()</code> helper in <code>lib/lab.mjs</code> with your observed app status and ledger evidence. The dashboard’s automatic checks currently cover the bundled demo application; external apps need an adapter for their status and payment identity.</p><pre>import { assess } from './lib/lab.mjs';
const checks = assess({
  scenario: 'lost-response',
  received: 1,
  applicationStatus: 'paid',
  observedTransactions: [{ successful: true }]
});</pre><h2>Scope and limits</h2><ul><li>Only Stellar testnet. Maximum 2 units per proxy payment; assets XLM and LAB.</li><li>Faults affect the connection between the app and adapter. They do not damage or change Stellar consensus.</li><li>Checks cover one isolated payment run. Concurrent unrelated payments can affect balance comparisons.</li><li>HTTP timeouts in the live demo can leave an incomplete run. An incomplete run is never reported as a pass.</li><li>Reports are evidence for tested scenarios, not a security audit or reliability certification.</li></ul></article>`;}
function about(){content.innerHTML=`<article class="docs"><div class="eyebrow">The problem we are building for</div><h1>Money can move.<br><em>The screen can disagree.</em></h1><p>A payment app can lose a network response after a transaction succeeds. If its recovery logic assumes failure and creates another payment, the recipient may receive twice the intended amount.</p><h2>Afterlight tests that uncomfortable middle.</h2><p>We combine controlled connection failures, real Stellar testnet payments, and independent settlement checks. Developers see whether their app’s recovery preserves the original payment and reports the correct outcome.</p><h2>Built from a QA perspective</h2><p>The goal is a practical debugging tool: repeatable scenarios, a readable timeline, transaction links, and exportable reports. Our first release focuses on three classic payment scenarios and a broken-versus-correct demonstration.</p><h2>Why Stellar?</h2><p>Stellar’s transaction hashes, sequence numbers, testnet accounts, asset trustlines, and ledger APIs give each experiment concrete rules and verifiable evidence. The product’s checks are designed around these mechanisms.</p><a href="/lab" class="primary" style="max-width:240px">Open the recovery lab ↗</a></article>`;}
draw();
