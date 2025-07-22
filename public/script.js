const API_BASE = 'http://localhost:5000';
const userId = 'local';

// Элементы
const el = {
  apiKeyForm: document.getElementById('apiKeyForm'),
  mainPanel: document.getElementById('mainPanel'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveKeyBtn: document.getElementById('saveKeyBtn'),
  result: document.getElementById('result'),
  status: document.getElementById('status'),
  userInfo: document.getElementById('userInfo'),
  initLog: document.getElementById('initLog'),
  actionLog: document.getElementById('actionLog'),
  buyBtn: document.getElementById('buyBtn'),
  codeBtn: document.getElementById('codeBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  balanceBtn: document.getElementById('balanceBtn'),
  infoBtn: document.getElementById('infoBtn'),
  country: document.getElementById('country'),
  service: document.getElementById('service'),
  quantity: document.getElementById('quantity'),

  // API Key modal
  apiKeyBtn: document.getElementById('apiKeyBtn'),
  apiKeyModal: document.getElementById('apiKeyModal'),
  currentApiKey: document.getElementById('currentApiKey'),
  newApiKeyInput: document.getElementById('newApiKeyInput'),
  updateApiKeyBtn: document.getElementById('updateApiKeyBtn'),
  closeApiKeyModalBtn: document.getElementById('closeApiKeyModalBtn'),
};

// Состояние
let state = {
  apiKey: '',
  currentOrders: [],
  balance: 0,
};

// Очистка API ключа от неподдерживаемых символов (оставляем только ASCII)
function sanitizeApiKey(key) {
  return key.replace(/[^\x20-\x7E]/g, '');
}

// Логирование
function addLog(message, target = 'action') {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">[${timeStr}]</span> ${message}`;
  if (target === 'init') {
    el.initLog.appendChild(entry);
    el.initLog.scrollTop = el.initLog.scrollHeight;
  } else {
    el.actionLog.appendChild(entry);
    el.actionLog.scrollTop = el.actionLog.scrollHeight;
  }
}

// Обновление статуса
function updateStatus(text) {
  el.status.textContent = text;
  addLog(`STATUS: ${text}`);
}

// Показываем результат
function showResult(text, isError = false) {
  el.result.textContent = text;
  el.result.style.borderLeft = isError ? '3px solid #ff5555' : '3px solid #00e0c6';
  addLog(`RESULT: ${text.replace(/\n/g, ' ')}`);
}

// Обновление UI
function updateUI() {
  const hasOrders = state.currentOrders.length > 0;
  el.codeBtn.disabled = !hasOrders;
  el.cancelBtn.disabled = !hasOrders;
  el.infoBtn.disabled = !hasOrders;

  if (hasOrders) {
    updateStatus(`Активных заказов: ${state.currentOrders.length}`);
  } else {
    updateStatus('Готов к работе');
  }
}

// Вспомогательные API вызовы
async function apiPost(path, body) {
  if (!state.apiKey) throw new Error('API ключ не установлен');
  const cleanKey = sanitizeApiKey(state.apiKey);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cleanKey}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let errText = 'Ошибка сервера';
    try {
      const err = await res.json();
      errText = err.error || errText;
    } catch {}
    throw new Error(errText);
  }
  return res.json();
}

async function apiGet(path) {
  if (!state.apiKey) throw new Error('API ключ не установлен');
  const cleanKey = sanitizeApiKey(state.apiKey);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${cleanKey}`
    }
  });
  if (!res.ok) {
    let errText = 'Ошибка сервера';
    try {
      const err = await res.json();
      errText = err.error || errText;
    } catch {}
    throw new Error(errText);
  }
  return res.json();
}

// Сохранение API ключа
async function saveApiKey() {
  let key = el.apiKeyInput.value.trim();
  key = sanitizeApiKey(key);
  if (!key) {
    showResult('❌ Введите корректный API ключ', true);
    return;
  }
  try {
    await apiPost('/init', { user_id: userId, api_key: key });
    state.apiKey = key;
    localStorage.setItem('5sim_api_key', key);
    el.apiKeyForm.classList.add('hidden');
    el.mainPanel.classList.remove('hidden');
    addLog('API ключ сохранен', 'init');
    showResult('🔑 API ключ успешно сохранен');
    await getBalance();
    updateUI();
  } catch (e) {
    showResult(`❌ Ошибка сохранения: ${e.message}`, true);
  }
}

// Покупка номера с учётом количества
async function buyNumber() {
  const country = el.country.value;
  const service = el.service.value;
  const quantity = parseInt(el.quantity.value, 10);

  if (!country) {
    showResult('❌ Выберите страну', true);
    return;
  }
  if (!service) {
    showResult('❌ Выберите сервис', true);
    return;
  }
  if (!quantity || quantity < 1) {
    showResult('❌ Введите корректное количество (минимум 1)', true);
    return;
  }

  el.buyBtn.disabled = true;
  showResult(`⌛ Покупка ${quantity} номера(ов)...`);
  updateStatus('Обработка запроса...');

  try {
    const orders = [];
    for (let i = 0; i < quantity; i++) {
      const res = await fetch(`${API_BASE}/buy`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.apiKey}`  // ВАЖНО: добавляем ключ
        },
        body: JSON.stringify({ country, service, user_id: userId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка покупки');
      }
      const order = await res.json();
      addLog(`✅ Номер куплен: ${order.phone} | Стоимость: ${order.price} руб.`);
      orders.push(order);
      await new Promise(r => setTimeout(r, 500));  // небольшая задержка
    }
    state.currentOrders = orders;
    showResult(`✅ Успешно куплено ${orders.length} номер(ов)`);
  } catch (e) {
    showResult(`❌ Ошибка покупки: ${e.message}`, true);
    updateStatus('Ошибка при покупке');
  } finally {
    el.buyBtn.disabled = false;
    updateUI();
  }
}


// Получение SMS кода
async function getCode() {
  if (state.currentOrders.length === 0) {
    showResult('❌ Нет активных заказов', true);
    return;
  }
  try {
    showResult('⌛ Ожидание SMS...');
    updateStatus('Проверка входящих SMS...');
    const smsList = await apiGet('/code');
    if (smsList.length > 0) {
      const sms = smsList[0];
      showResult(`✅ SMS получено!\nОтправитель: ${sms.sender || 'неизвестен'}\nТекст: ${sms.text || 'пусто'}`);
    } else {
      showResult('📭 Сообщений нет, ожидайте...');
    }
  } catch (e) {
    showResult(`❌ Ошибка получения SMS: ${e.message}`, true);
  }
}

// Отмена заказа
async function cancelOrder() {
  if (state.currentOrders.length === 0) {
    showResult('❌ Нет активных заказов', true);
    return;
  }
  try {
    showResult('⌛ Отмена заказов...');
    updateStatus('Обработка отмены...');
    const res = await apiPost('/cancel', { user_id: userId });
    showResult(`🚫 Заказ(ы) отменен(ы)\nВозврат: ${res.refund} руб.`);
    state.currentOrders = [];
    updateUI();
  } catch (e) {
    showResult(`❌ Ошибка отмены: ${e.message}`, true);
  }
}

// Проверка баланса
async function getBalance() {
  try {
    showResult('⌛ Проверка баланса...');
    updateStatus('Запрос баланса...');
    const profile = await apiPost('/balance', { user_id: userId });
    state.balance = profile.balance;
    showResult(`💵 Баланс: ${profile.balance} руб.\nРейтинг: ${profile.rating}`);
    updateStatus('Баланс обновлен');
  } catch (e) {
    showResult(`❌ Ошибка баланса: ${e.message}`, true);
  }
}

// Получение информации о заказе
async function getOrderInfo() {
  if (state.currentOrders.length === 0) {
    showResult('ℹ️ Нет активных заказов');
    return;
  }
  try {
    showResult('⌛ Получение информации...');
    updateStatus('Запрос информации о заказе...');
    const order = await apiGet('/order');
    showResult(`ℹ️ Заказ #${order.id}\nНомер: ${order.phone}\nСтатус: ${order.status}\nСтоимость: ${order.price}`);
  } catch (e) {
    showResult(`❌ Ошибка получения информации: ${e.message}`, true);
  }
}

// Загрузка стран в селект
async function loadCountries() {
  try {
    const countriesObj = await apiGet('/countries');
    el.country.innerHTML = '';
    const countries = Object.keys(countriesObj); // Ключи — это страны
    for (const c of countries) {
      const option = document.createElement('option');
      option.value = c;
      option.textContent = c.charAt(0).toUpperCase() + c.slice(1); // Сделать с заглавной буквы для красоты
      el.country.appendChild(option);
    }
  } catch (e) {
    showResult(`❌ Ошибка загрузки стран: ${e.message}`, true);
  }
}



// --- Модалка API ключа ---

// Открыть модалку
el.apiKeyBtn.addEventListener('click', () => {
  el.currentApiKey.value = state.apiKey || 'Ключ не установлен';
  el.newApiKeyInput.value = '';
  el.apiKeyModal.classList.remove('hidden');
});

// Закрыть модалку
el.closeApiKeyModalBtn.addEventListener('click', () => {
  el.apiKeyModal.classList.add('hidden');
});

// Обновить API ключ
el.updateApiKeyBtn.addEventListener('click', async () => {
  let newKey = el.newApiKeyInput.value.trim();
  newKey = sanitizeApiKey(newKey);
  if (!newKey) {
    showResult('❌ Введите корректный новый API ключ', true);
    return;
  }
  try {
    await apiPost('/init', { user_id: userId, api_key: newKey });
    state.apiKey = newKey;
    localStorage.setItem('5sim_api_key', newKey);
    showResult('🔑 API ключ обновлен успешно');
    addLog('API ключ обновлен через модальное окно', 'init');
    el.apiKeyModal.classList.add('hidden');
    await getBalance();
    updateUI();
  } catch (e) {
    showResult(`❌ Ошибка обновления ключа: ${e.message}`, true);
  }
});

// Инициализация страницы и UI
async function init() {
  const savedKey = localStorage.getItem('5sim_api_key');
  if (savedKey) {
    state.apiKey = savedKey;
    el.apiKeyInput.value = savedKey;
    el.apiKeyForm.classList.add('hidden');
    el.mainPanel.classList.remove('hidden');
    addLog('API ключ загружен из localStorage', 'init');
    await apiPost('/init', { user_id: userId, api_key: savedKey });
    await loadCountries();
    await getBalance();
    updateUI();
  } else {
    el.apiKeyForm.classList.remove('hidden');
    el.mainPanel.classList.add('hidden');
    updateStatus('Введите API ключ для начала работы');
  }
}

document.addEventListener('DOMContentLoaded', init);


// Обработчики кнопок
el.saveKeyBtn.addEventListener('click', saveApiKey);
el.buyBtn.addEventListener('click', buyNumber);
el.codeBtn.addEventListener('click', getCode);
el.cancelBtn.addEventListener('click', cancelOrder);
el.balanceBtn.addEventListener('click', getBalance);
el.infoBtn.addEventListener('click', getOrderInfo);

init();
