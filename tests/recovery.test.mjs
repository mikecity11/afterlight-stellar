import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { assess, submitWithFault, validateEnvelope } from '../lib/lab.mjs';
function envelope(asset = Asset.native(), amount = '1') {
  const pair=Keypair.random(), destination=Keypair.random();
  const tx=new TransactionBuilder(new Account(pair.publicKey(),'0'),{fee:'100',networkPassphrase:Networks.TESTNET}).addOperation(Operation.payment({destination:destination.publicKey(),asset,amount})).setTimeout(120).build();
  tx.sign(pair);return tx.toXDR();
}
test('lost response forwards exactly once and hides confirmation',async()=>{
  let calls=0;
  const result=await submitWithFault({xdr:envelope(),scenario:'lost-response',attempt:1},async()=>{calls++;return {hash:'confirmed',successful:true};});
  assert.equal(calls,1);assert.equal(result.status,504);assert.equal(result.body.hash,undefined);
});
test('outage never forwards the first attempt; recovery forwards',async()=>{
  let calls=0;const submit=async()=>{calls++;return {hash:'confirmed',successful:true};};const xdr=envelope();
  assert.equal((await submitWithFault({xdr,scenario:'outage',attempt:1},submit)).status,503);assert.equal(calls,0);
  assert.equal((await submitWithFault({xdr,scenario:'outage',attempt:2},submit)).status,200);assert.equal(calls,1);
});
test('real rejection is retained, never converted into injected success',async()=>{
  const result=await submitWithFault({xdr:envelope(),scenario:'missing-trustline'},async()=>{throw {response:{status:400,data:{extras:{result_codes:{transaction:'tx_failed',operations:['op_no_trust']}}}}};});
  assert.equal(result.status,400);assert.deepEqual(result.body.codes.operations,['op_no_trust']);
});
test('an unknown upstream result is not classified as confirmed rejection',async()=>{
  const result=await submitWithFault({xdr:envelope(),scenario:'lost-response'},async()=>{throw new Error('socket closed');});
  assert.equal(result.body.unknown,true);assert.equal(result.body.codes,null);
});
test('duplicate settlement fails even if the application reports paid',()=>{
  const checks=assess({scenario:'lost-response',received:2,applicationStatus:'paid',observedTransactions:[{successful:true},{successful:true}]});
  assert.equal(checks[0].pass,false);assert.equal(checks[1].pass,true);assert.equal(checks[2].pass,false);
});
test('a failed transaction is not counted as a successful payment',()=>{
  assert.ok(assess({scenario:'missing-trustline',received:0,applicationStatus:'rejected',observedTransactions:[{successful:false}]}).every(c=>c.pass));
});
test('valid payment and safe same-envelope retry keep the same identity',()=>{
  const xdr=envelope();assert.match(Buffer.from(validateEnvelope(xdr).hash()).toString('hex'), /^[a-f0-9]{64}$/);assert.equal(Buffer.from(validateEnvelope(xdr).hash()).toString('hex'),Buffer.from(validateEnvelope(xdr).hash()).toString('hex'));
});
test('oversized or unsupported payment is rejected before forwarding',()=>{
  assert.throws(()=>validateEnvelope(envelope(Asset.native(),'3')),/no more than 2/);
  assert.throws(()=>validateEnvelope(envelope(new Asset('USD',Keypair.random().publicKey()))),/XLM or/);
});
