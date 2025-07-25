const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADMINS_FILE = path.join(__dirname, 'admins.json');

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
      },
      timeout: 10000 // Добавлен таймаут
    });
    res.json(response.data);
  } catch (e) {
    console.error('Ошибка в /balance:', e.response?.data || e.message);
    const errorMessage = e.response?.data?.error || e.message;
    res.status(500).json({ 
      success: false,
      error: typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage
    });
  }
});

app.get('/countries', async (req, res) => {
  try {
    const response = await axios.get('https://5sim.net/v1/guest/prices', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Referer': 'https://5sim.net/',
        'Origin': 'https://5sim.net'
      },
      timeout: 10000
    });
    res.json(response.data);
  } catch (error) {
    console.error('Ошибка при получении стран:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка получения данных'
    });
  }
});

app.post('/buy', async (req, res) => {
  const userId = req.body.user_id || 'local';
  const apiKey = keys[userId];
  if (!apiKey) return res.status(400).json({ 
    success: false,
    error: 'API ключ не найден' 
  });

  const { country, service } = req.body;
  if (!country || !service) return res.status(400).json({ 
    success: false,
    error: 'country и service обязательны' 
  });

  try {
    const operators = ['any', 'virtual', 'mts', 'beeline', 'megafon', 'tele2'];
    let lastError = null;

    for (const operator of operators) {
      try {
        const url = `https://5sim.net/v1/user/buy/activation/${country}/${operator}/${service}`;
        console.log(`Пытаемся купить номер: ${url}`);

        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'Referer': 'https://5sim.net/',
            'Origin': 'https://5sim.net'
          },
          timeout: 15000
        });

        return res.json({
          success: true,
          data: response.data
        });
      } catch (err) {
        lastError = err;
        console.warn(`Ошибка покупки с оператором ${operator}:`, err.response?.data || err.message);
      }
    }

    return res.status(500).json({ 
      success: false,
      error: lastError?.response?.data?.error || lastError?.message || 'Ошибка покупки номера' 
    });

  } catch (e) {
    console.error('Неожиданная ошибка в /buy:', e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

app.post('/order/status', async (req, res) => {
  try {
    const { order_id, user_id } = req.body;
    const apiKey = keys[user_id || 'local'];
    
    if (!apiKey) return res.status(400).json({ error: 'API ключ не найден' });

    const response = await axios.get(`https://5sim.net/v1/user/check/${order_id}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    res.json(response.data);
  } catch (e) {
    console.error('Order status error:', e);
    res.status(500).json({ 
      error: e.response?.data?.message || e.message 
    });
  }
});

app.post('/cancel', async (req, res) => {
  try {
    const { order_id, user_id } = req.body;
    const apiKey = keys[user_id || 'local'];
    
    if (!apiKey) return res.status(400).json({ 
      success: false,
      error: 'API ключ не найден' 
    });

    const response = await axios.get(`https://5sim.net/v1/user/cancel/${order_id}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    // Всегда возвращаем success: true при коде 200
    return res.json({ 
      success: true,
      data: response.data 
    });

  } catch (e) {
    console.error('Cancel error:', e);
    return res.status(500).json({ 
      success: false,
      error: e.response?.data?.message || e.message 
    });
  }
});

app.get('/admins', (req, res) => {
  try {
    const admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read admins' });
  }
});

// Добавление админа
app.post('/admins', (req, res) => {
  const { id, name } = req.body;
  
  try {
    const admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    admins.push({ id, name });
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add admin' });
  }
});

// Удаление админа
app.delete('/admins/:id', (req, res) => {
  const idToRemove = req.params.id;
  
  try {
    let admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    admins = admins.filter(admin => admin.id !== idToRemove);
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove admin' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));

app.listen(PORT, () => {
  console.log(`Backend запущен http://localhost:${PORT}`);
});