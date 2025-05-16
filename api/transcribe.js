import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import FormData from 'form-data';

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const body = Buffer.concat(buffers).toString();
    const { url } = JSON.parse(body);

    if (!url) {
      console.error('❌ No URL provided');
      return res.status(400).json({ error: 'Missing URL' });
    }

    console.log('📥 Downloading from URL:', url);
    const tmpFile = path.join(tmpdir(), `video-${Date.now()}.webm`);
    const response = await fetch(url);

    if (!response.ok) {
      console.error('❌ Failed to download video:', await response.text());
      return res.status(400).json({ error: 'Failed to download video' });
    }

    const dest = fs.createWriteStream(tmpFile);
    await new Promise((resolve, reject) => {
      response.body.pipe(dest);
      response.body.on('error', reject);
      dest.on('finish', resolve);
    });

    const formData = new FormData();
    formData.append('file', fs.createReadStream(tmpFile));
    formData.append('model', 'whisper-1');

    console.log('📤 Uploading to Whisper API...');
    const whisper = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    const result = await whisper.json();
    fs.unlinkSync(tmpFile);

    if (!whisper.ok) {
      console.error('❌ Whisper Error:', result);
      return res.status(500).json({ error: result });
    }

    console.log('✅ Whisper Response:', result);
    res.status(200).json(result);
  } catch (err) {
    console.error('🔥 Server Error:', err);
    res.status(500).json({ error: err.message });
  }
}
