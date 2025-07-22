const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');

const app = express();
const PORT = 5000;

// Включение CORS и JSON парсера
app.use(cors());
app.use(express.json());

// Логирование запросов в файл api.log
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'api.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));

// ВАЖНО: замените на свой реальный API ключ от 5sim
const API_KEY = 'ваш_api_ключ_от_5sim';

// Маршрут для покупки номера
app.post('/buy-number', async (req, res) => {
  const { country, operator, service } = req.body;

  if (!country || !operator || !service) {
    return res.status(400).json({
      success: false,
      error: 'Укажите country, operator и service',
    });
  }

  try {
    const response = await axios.get(
      `https://5sim.net/v1/user/buy/activation/${country}/${operator}/${service}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Ошибка 5sim API:', error.response?.data || error.message);

    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
