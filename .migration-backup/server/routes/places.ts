import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

router.get('/api/places/autocomplete', async (req, res) => {
  try {
    const { input } = req.query;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    console.log('Fetching places for input:', input);

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      input.toString()
    )}&types=address&components=country:us&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json() as { predictions: any[]; status: string };

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Places API Error:', data);
      throw new Error(`Places API returned status: ${data.status}`);
    }

    console.log('Places API response:', data.predictions.length, 'results');
    res.json(data.predictions || []);
  } catch (error) {
    console.error('Places API Error:', error);
    res.status(500).json({ error: 'Failed to fetch place predictions' });
  }
});

export default router;