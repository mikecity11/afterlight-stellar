import { Account, Asset, BASE_FEE, Horizon, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';

export const HORIZON = 'https://horizon-testnet.stellar.org';
export const FRIEND = 'https://friendbot.stellar.org';
export const server = new Horizon.Server(HORIZON);
export const scenarios = ['lost-response', 'outage', 'missing-trustline'];

export async function fund(publicKey) {
  const response = await fetch(`${FRIEND}/?addr=${encodeURIComponent(publicKey)}`, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`Testnet funding unavailable (${response.status}). Try again shortly.`);
}

export function validateEnvelope(xdr) {
  if (typeof xdr !== 'string' || xdr.length > 16000) throw new Error('A signed testnet payment XDR is required.');
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  if (tx.innerTransaction || tx.operations.length !== 1 || tx.operations[0].type !== 'payment') throw new Error('This version accepts one classic payment operation per transaction.');
  const op = tx.operations[0];
  if (!Number.isFinite(Number(op.amount)) || Number(op.amount) <= 0 || Number(op.amount) > 2) throw new Error('Test payments must be greater than zero and no more than 2 units.');
  if (op.asset.isNative() === false && op.asset.code !== 'LAB') throw new Error('Use XLM or the LAB test asset.');
  if (!tx.signatures.length) throw new Error('Sign the testnet transaction first.');
  return tx;
}

export async function submitWithFault({ xdr, scenario, attempt = 1 }, submit = tx => server.submitTransaction(tx)) {
  if (!scenarios.includes(scenario)) throw new Error('Unknown scenario.');
  const tx = validateEnvelope(xdr);
  if (scenario === 'outage' && attempt === 1) return { status: 503, body: { error: 'Injected outage before forwarding. No transaction was submitted.', injected: true } };
  try {
    const result = await submit(tx);
    if (scenario === 'lost-response' && attempt === 1) return { status: 504, body: { error: 'Injected response loss after upstream success. Settlement status is unknown to your app.', injected: true } };
    return { status: 200, body: { hash: result.hash, successful: result.successful, ledger: result.ledger } };
  } catch (error) {
    const upstream = error.response?.data || error.response;
    const codes = upstream?.extras?.result_codes;
    return { status: error.response?.status === 504 ? 504 : 400, body: { error: codes ? 'Stellar rejected this payment.' : 'Upstream submission did not return a confirmed result.', codes: codes || null, unknown: !codes } };
  }
}

export async function buildPayment(secret, destination, asset = Asset.native()) {
  const pair = Keypair.fromSecret(secret);
  const account = await server.loadAccount(pair.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination, asset, amount: '1' })).setTimeout(120).build();
  tx.sign(pair);
  return tx;
}

export async function lookup(hash) {
  try { return await server.transactions().transaction(hash).call(); }
  catch (error) { if (error.response?.status === 404) return null; throw error; }
}

export function assess({ scenario, received, applicationStatus, observedTransactions }) {
  const expected = scenario === 'missing-trustline' ? 0 : 1;
  const transferCorrect = Math.abs(received - expected) < 0.0000001;
  const expectedStatus = expected === 0 ? 'rejected' : 'paid';
  const statusCorrect = applicationStatus === expectedStatus;
  return [
    { name: 'Recipient receives the intended amount', pass: transferCorrect, detail: `Expected ${expected}; observed ${received.toFixed(7)}.` },
    { name: 'Application agrees with the ledger', pass: statusCorrect, detail: `App: ${applicationStatus}. Expected: ${expectedStatus}.` },
    { name: 'No second successful payment', pass: observedTransactions.filter(t => t.successful).length <= expected, detail: `${observedTransactions.filter(t => t.successful).length} successful payment(s) recorded.` }
  ];
}

export async function runExperiment({ sourceSecret, destinationSecret, scenario, recovery }) {
  if (!scenarios.includes(scenario) || !['broken', 'correct'].includes(recovery)) throw new Error('Select a valid scenario and recovery mode.');
  const source = Keypair.fromSecret(sourceSecret), destination = Keypair.fromSecret(destinationSecret);
  if (source.publicKey() === destination.publicKey()) throw new Error('Use distinct test accounts.');
  const events = [], transactions = [];
  const log = (title, detail) => events.push({ title, detail, at: new Date().toISOString() });
  const before = await server.loadAccount(destination.publicKey());
  const nativeBefore = Number(before.balances.find(b => b.asset_type === 'native').balance);
  const asset = scenario === 'missing-trustline' ? new Asset('LAB', source.publicKey()) : Asset.native();
  const tx = await buildPayment(sourceSecret, destination.publicKey(), asset);
  log('Payment signed', `1 ${asset.code}; transaction ${Buffer.from(tx.hash()).toString('hex')}`);
  let reply = await submitWithFault({ xdr: tx.toXDR(), scenario, attempt: 1 });
  log(`Application receives HTTP ${reply.status}`, reply.body.error || 'Payment confirmed.');
  let applicationStatus = reply.status === 200 ? 'paid' : 'failed';
  if (reply.status === 400 && reply.body.codes) applicationStatus = recovery === 'correct' ? 'rejected' : 'failed';
  if ([503, 504].includes(reply.status)) {
    if (recovery === 'correct') {
      applicationStatus = 'pending';
      log('Recovery preserves the payment identity', 'Look up the original hash; only resubmit the same signed envelope if unconfirmed.');
      const found = await lookup(Buffer.from(tx.hash()).toString('hex'));
      if (found?.successful) applicationStatus = 'paid';
      else if (found && !found.successful) applicationStatus = 'rejected';
      else {
        reply = await submitWithFault({ xdr: tx.toXDR(), scenario, attempt: 2 });
        applicationStatus = reply.status === 200 ? 'paid' : reply.body.codes ? 'rejected' : 'pending';
        log(`Safe retry receives HTTP ${reply.status}`, reply.body.error || 'Original payment confirmed.');
      }
    } else if (scenario === 'lost-response') {
      log('Broken recovery creates a replacement', 'A fresh sequence number creates another executable payment.');
      const replacement = await buildPayment(sourceSecret, destination.publicKey(), asset);
      reply = await submitWithFault({ xdr: replacement.toXDR(), scenario, attempt: 2 });
      const found = await lookup(Buffer.from(replacement.hash()).toString('hex'));
      if (found) transactions.push({ hash: found.hash, successful: found.successful, ledger: found.ledger });
      applicationStatus = reply.status === 200 ? 'paid' : 'failed';
    } else log('Broken recovery stops', 'The app labels a temporary outage as a final payment failure.');
  }
  const original = await lookup(Buffer.from(tx.hash()).toString('hex'));
  if (original) transactions.unshift({ hash: original.hash, successful: original.successful, ledger: original.ledger });
  const after = await server.loadAccount(destination.publicKey());
  const received = scenario === 'missing-trustline' ? Number(after.balances.find(b => b.asset_code === 'LAB' && b.asset_issuer === source.publicKey())?.balance || 0) : Number(after.balances.find(b => b.asset_type === 'native').balance) - nativeBefore;
  const checks = assess({ scenario, received, applicationStatus, observedTransactions: transactions });
  log('Independent ledger check complete', `${received.toFixed(7)} ${asset.code} received; application status ${applicationStatus}.`);
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), network: 'Stellar Testnet', scenario, recovery, amount: 1, asset: asset.code, source: source.publicKey(), destination: destination.publicKey(), received, applicationStatus, transactions, events, checks, verdict: checks.every(c => c.pass) ? 'PASS' : 'FAIL' };
}
