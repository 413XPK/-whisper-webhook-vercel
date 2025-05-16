export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  res.status(200).json({ message: 'Transcribe route is working!' });
}
