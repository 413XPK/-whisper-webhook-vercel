import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'No video URL provided' });
  }

  const tempPath = path.join(tmpdir(), `video_${Date.now()}.webm`);

  try {
    // Download video
    const response = await fetch(url);
    const dest = fs.createWriteStream(tempPath);
    await new Promise((resolve, reject) => {
      response.body.pipe(dest);
      response.body.on('error', reject);
      dest.on('finish', resolve);
    });

    // Upload to OpenAI Whisper
    const whisperRes = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: (() => {
          const form = new FormData();
          form.append('file', fs.createReadStream(tempPath));
          form.append('model', 'whisper-1');
          return form;
        })(),
      }
    );

    const data = await whisperRes.json();
    fs.unlinkSync(tempPath); // Clean up

    if (!whisperRes.ok) {
      return res.status(500).json({ error: data });
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
