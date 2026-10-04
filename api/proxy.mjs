import { submitWithFault } from '../lib/lab.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  res.setHeader('Cache-Control', 'no-store');
  try { const result = await submitWithFault(req.body); res.status(result.status).json(result.body); }
  catch (error) { res.status(400).json({ error: error.message }); }
}
