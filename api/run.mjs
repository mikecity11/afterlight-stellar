import { runExperiment } from '../lib/lab.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await runExperiment(req.body)); }
  catch (error) { res.status(502).json({ error: 'Experiment could not complete. ' + (error.response?.data?.title || error.message), incomplete: true }); }
}
