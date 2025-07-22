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

const keysFile = path.join(__dirname, 'keys.json');
let keys = {};

// Загрузка ключей
function loadKeys() {
  if (fs.existsSync(keysFile)) {
    try {
      keys = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
      console.log('API keys loaded');
    } catch (e) {
      console.error('Error loading keys:', e.message);
      keys = {};
    }
  }
}
loadKeys();

// Сохранение ключей
function saveKeys() {
  fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2), 'utf8');
}

// Проверка API ключа
function validateApiKey(apiKey) {
  if (!apiKey || apiKey.length < 30) {
    return false;
  }
  return true;
}

// Универсальный обработчик ошибок API
async function make5simRequest(method, url, apiKey, data = null) {
  try {
    const config = {
      method,
      url: `https://5sim.net/v1${url}`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
      },
      timeout: 15000
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('5sim API error:', error.message);
    let errorMessage = 'API error';
    
    if (error.response) {
      // Пытаемся извлечь сообщение об ошибке из HTML
      if (typeof error.response.data === 'string' && error.response.data.includes('<html')) {
        errorMessage = 'Service unavailable (HTML response)';
      } else {
        errorMessage = error.response.data?.error || error.response.statusText;
      }
    } else {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
}

// Маршруты
app.post('/init', (req, res) => {
  const { user_id, api_key } = req.body;
  
  if (!user_id || !api_key || !validateApiKey(api_key)) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid user_id or API key' 
    });
  }

  keys[user_id] = api_key;
  saveKeys();

  res.json({ success: true });
});

app.post('/balance', async (req, res) => {
  const userId = req.body.user_id || 'local';
  const apiKey = keys[userId];
  
  if (!apiKey) {
    return res.status(400).json({ 
      success: false,
      error: 'API key not found' 
    });
  }

  const result = await make5simRequest('get', '/user/profile', apiKey);
  
  if (result.success) {
    res.json({ 
      success: true,
      data: result.data 
    });
  } else {
    res.status(500).json({ 
      success: false,
      error: result.error 
    });
  }
});

app.get('/countries', async (req, res) => {
  try {
    const response = await axios.get('https://5sim.net/v1/guest/prices', {
      timeout: 10000
    });
    res.json({ 
      success: true,
      data: response.data 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to get countries' 
    });
  }
});

app.post('/buy', async (req, res) => {
  const userId = req.body.user_id || 'local';
  const apiKey = keys[userId];
  const { country, service } = req.body;

  if (!apiKey) {
    return res.status(400).json({ 
      success: false,
      error: 'API key not found' 
    });
  }

  const operators = ['any', 'virtual', 'mts', 'beeline', 'megafon', 'tele2'];
  let lastError = 'Все операторы вернули ошибку';

  for (const operator of operators) {
    try {
      const response = await axios({
        method: 'get',
        url: `https://5sim.net/v1/user/buy/activation/${country}/${operator}/${service}`,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        timeout: 10000,
        transformResponse: [], // Отключаем автоматический парсинг
        responseType: 'text' // Получаем сырой ответ
      });

      // Проверяем, начинается ли ответ с {
      if (response.data.trim().startsWith('{')) {
        try {
          const data = JSON.parse(response.data);
          return res.json({
            success: true,
            data: data
          });
        } catch (e) {
          lastError = 'Невалидный JSON от сервера';
          continue;
        }
      } else {
        lastError = 'Сервер вернул HTML вместо JSON';
        continue;
      }
    } catch (error) {
      lastError = error.response?.data || error.message;
      continue;
    }
  }

  return res.status(500).json({
    success: false,
    error: lastError
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});