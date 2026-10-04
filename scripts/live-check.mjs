import { Keypair } from '@stellar/stellar-sdk';
import { fund, runExperiment } from '../lib/lab.mjs';
const source=Keypair.random(), destination=Keypair.random();
console.log('Funding disposable Stellar testnet accounts.');
await Promise.all([fund(source.publicKey()),fund(destination.publicKey())]);
for(const scenario of ['lost-response','outage','missing-trustline']) {
  for(const recovery of ['broken','correct']) {
    const r=await runExperiment({sourceSecret:source.secret(),destinationSecret:destination.secret(),scenario,recovery});
    console.log(JSON.stringify({scenario,recovery,verdict:r.verdict,received:r.received,applicationStatus:r.applicationStatus,transactions:r.transactions}));
    const expected=recovery==='correct'?'PASS':'FAIL';
    if(r.verdict!==expected) throw new Error(`Unexpected ${r.verdict}: ${scenario}/${recovery}`);
  }
}
