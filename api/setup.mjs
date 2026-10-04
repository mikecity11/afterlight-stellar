import { Keypair } from '@stellar/stellar-sdk';
import { fund } from '../lib/lab.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const source = Keypair.random(), destination = Keypair.random();
    await Promise.all([fund(source.publicKey()), fund(destination.publicKey())]);
    res.json({ network: 'testnet', source: { publicKey: source.publicKey(), secret: source.secret() }, destination: { publicKey: destination.publicKey(), secret: destination.secret() } });
  } catch (error) { res.status(502).json({ error: error.message }); }
}
