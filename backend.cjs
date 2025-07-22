const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const keysFile = path.join(__dirname, 'keys.json');
let keys = {};

function loadKeys() {
  if (fs.existsSync(keysFile)) {
    try {
      keys = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
      console.log('API ключи загружены из keys.json');
    } catch {
      console.error('Ошибка парсинга keys.json');
      keys = {};
    }
  }
}
loadKeys();

function saveKeys() {
  fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2), 'utf8');
}

app.post('/init', (req, res) => {
  const { user_id, api_key } = req.body;
  if (!user_id || !api_key) return res.status(400).json({ error: 'user_id и api_key обязательны' });

  keys[user_id] = api_key;
  saveKeys();

  res.json({ status: 'OK' });
});

app.post('/balance', async (req, res) => {
  const userId = req.body.user_id || 'local';
  const apiKey = keys[userId];
  if (!apiKey) return res.status(400).json({ error: 'API ключ не найден' });

  try {
    const response = await axios.get('https://5sim.net/v1/user/profile', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Referer': 'https://5sim.net/',
        'Origin': 'https://5sim.net'
      }
    });
    res.json(response.data);
  } catch (e) {
    console.error('Ошибка в /balance:', e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data?.error || e.message });
  }
});

app.get('/countries', async (req, res) => {
  try {
    const response = await axios.get('https://5sim.net/v1/guest/prices', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Referer': 'https://5sim.net/',
        'Origin': 'https://5sim.net'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Ошибка при получении стран:', error.response?.data || error.message);
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

// Эндпоинт покупки номера
app.post('/buy', async (req, res) => {
  const userId = req.body.user_id || 'local';
  const apiKey = keys[userId];
  if (!apiKey) return res.status(400).json({ error: 'API ключ не найден' });

  const { country, service } = req.body;
  if (!country || !service) return res.status(400).json({ error: 'country и service обязательны' });

  try {
    const url = `https://5sim.net/v1/user/buy/activation/${country}/${service}/`;

    // Делаем POST запрос (как в боте)
    const response = await axios.post(url, null, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Referer': 'https://5sim.net/',
        'Origin': 'https://5sim.net'
      }
    });

    return res.json(response.data);
  } catch (e) {
    console.error('Ошибка покупки в /buy:', e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data?.error || e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend запущен http://localhost:${PORT}`);
});
