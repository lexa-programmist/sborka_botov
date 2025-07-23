const API_BASE = 'http://localhost:5000';
const userId = 'local';

// Переопределение window.fetch для проверки формата ответа
const originalFetch = window.fetch;

window.fetch = async function (...args) {
  const response = await originalFetch(...args);

  const contentType = response.headers.get('content-type');

document.addEventListener('DOMContentLoaded', () => {
  if (window.ethereum) {
    try {
      delete window.ethereum;
    } catch (e) {
      console.warn('Не удалось очистить window.ethereum:', e);
    }
  }
  el.refreshOrdersBtn.addEventListener('click', getOrderInfo);
});

  // Проверка: если ответ не JSON, выбрасываем исключение с содержимым ответа
  if (contentType && !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Сервер вернул не JSON: ${text.slice(0, 100)}...`);
  }

  return response;
};

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
  refreshOrdersBtn: document.getElementById('refreshOrdersBtn'),

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
  currentOrderId: null,
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

function updateButtonStates() {
  const hasOrder = !!state.currentOrderId || state.currentOrders.length > 0;
  el.codeBtn.disabled = !hasOrder;
  el.cancelBtn.disabled = !hasOrder;
  el.infoBtn.disabled = !hasOrder;
}

// Показываем результат
function showResult(text, isError = false) {
  el.result.textContent = text;
  el.result.style.borderLeft = isError ? '3px solid #ff5555' : '3px solid #00e0c6';
  addLog(`RESULT: ${text.replace(/\n/g, ' ')}`);
}

// Обновление UI
function updateUI() {
  const hasOrders = state.currentOrderId || state.currentOrders.length > 0;
  el.codeBtn.disabled = !hasOrders;
  el.cancelBtn.disabled = !hasOrders;
  el.infoBtn.disabled = !hasOrders;

  if (hasOrders) {
    updateStatus(`Активных заказов: ${state.currentOrders.length || 1}`);
  } else {
    updateStatus('Готов к работе');
  }
}

// Сохраняем текущие заказы
function saveOrdersToStorage() {
  const ordersToSave = {
    currentOrderId: state.currentOrderId,
    orders: state.currentOrders,
    lastUpdated: new Date().toISOString()
  };
  localStorage.setItem('5sim_active_orders', JSON.stringify(ordersToSave));
}

// Загружаем заказы
function loadOrdersFromStorage() {
  const saved = localStorage.getItem('5sim_active_orders');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      
      // Восстанавливаем ID текущего заказа
      state.currentOrderId = data.currentOrderId || null;
      
      // Восстанавливаем список заказов с проверкой
      state.currentOrders = Array.isArray(data.orders) 
        ? data.orders.filter(order => order && order.id) 
        : [];
      
      if (state.currentOrders.length > 0 || state.currentOrderId) {
        addLog(`Загружено ${state.currentOrders.length} активных заказов`, 'init');
      }
    } catch (e) {
      console.error('Ошибка загрузки заказов:', e);
      localStorage.removeItem('5sim_active_orders');
    }
  }
}

// Вспомогательные API вызовы
async function apiPost(path, body) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.apiKey}`
      },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    console.log('Raw response:', text); // Логируем сырой ответ
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Невалидный JSON: ' + text.slice(0, 100));
    }
  } catch (e) {
    console.error('API Error:', { path, error: e.message });
    throw new Error(e.message.includes('JSON') ? 'Ошибка сервера' : e.message);
  }
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
          'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({ country, service, user_id: userId }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(text.includes('<!DOCTYPE html>') ? 'Сервер вернул HTML-ошибку' : text);
      }

      const result = await res.json();
      
      if (result.success) {
        addLog(`✅ Номер куплен: ${result.data.phone} | Стоимость: ${result.data.price} руб.`);
        orders.push(result.data);
        state.currentOrderId = result.data.id;
        state.currentOrders = orders; // Исправлено: используем result.data
        updateButtonStates();
        await new Promise(r => setTimeout(r, 500));
      } else {
        throw new Error(result.error || 'Ошибка покупки');
      }
    }
    state.currentOrders = orders;
    saveOrdersToStorage();
    await getOrderInfo();
    showResult(`✅ Успешно куплено ${orders.length} номер(ов)`);
    updateButtonStates(); // Убрано ошибочное currentOrderId = data.id
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
  // Собираем все ID заказов
  const orderIds = [];
  if (state.currentOrderId) orderIds.push(state.currentOrderId);
  orderIds.push(...state.currentOrders.map(o => o.id));

  if (orderIds.length === 0) {
    showResult('❌ Нет активных заказов для отмены', true);
    return;
  }

  try {
    showResult(`⌛ Отменяем ${orderIds.length} заказов...`);
    
    // Параллельная отмена всех заказов
    const results = await Promise.allSettled(
      orderIds.map(id => 
        apiPost('/cancel', { order_id: id, user_id: userId })
      )
    );

    // Очищаем состояние независимо от результата
    state.currentOrderId = null;
    state.currentOrders = [];
    localStorage.removeItem('5sim_active_orders');

    // Анализ результатов
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    
    if (successCount > 0) {
      showResult(`✅ Успешно отменено ${successCount} заказов`);
      await getBalance();
    } else {
      showResult('❌ Не удалось отменить заказы', true);
    }
  } catch (e) {
    showResult(`❌ Ошибка: ${e.message}`, true);
  } finally {
    updateUI();
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
  // Проверяем наличие заказов в состоянии
  const activeOrders = [...state.currentOrders];
  if (state.currentOrderId && !activeOrders.some(o => o.id === state.currentOrderId)) {
    activeOrders.push({ id: state.currentOrderId });
  }

  if (activeOrders.length === 0) {
    showResult('ℹ️ Нет активных заказов');
    return;
  }

  try {
    showResult('⌛ Загружаем информацию...');
    updateStatus('Получение данных...');

    let infoText = `ℹ️ Активных заказов: ${activeOrders.length}\n\n`;
    
    // Используем данные из состояния и localStorage
    activeOrders.forEach(order => {
      infoText += `Заказ #${order.id}\n`;
      infoText += `Номер: ${order.phone || order.number || 'не указан'}\n`;
      infoText += `Страна: ${order.country || order.country_name || 'не указана'}\n`;
      infoText += `Сервис: ${order.service || 'не указан'}\n`;
      infoText += `Статус: ${order.status || 'активен'}\n`;
      infoText += `Цена: ${order.price || '0'} руб.\n`;
      
      // Проверяем разные варианты хранения SMS/кода
      if (order.sms) {
        infoText += `SMS: ${order.sms.text || order.sms || 'еще не получено'}\n`;
      } else if (order.code) {
        infoText += `Код: ${order.code}\n`;
      } else if (order.sms_code) {
        infoText += `Код: ${order.sms_code}\n`;
      }
      
      infoText += `----------------\n`;
    });

    // Добавляем время последнего обновления из localStorage
    const savedData = localStorage.getItem('5sim_active_orders');
    if (savedData) {
      try {
        const { lastUpdated } = JSON.parse(savedData);
        if (lastUpdated) {
          infoText += `\nПоследнее обновление: ${new Date(lastUpdated).toLocaleString()}`;
        }
      } catch (e) {
        console.error('Ошибка чтения времени обновления:', e);
      }
    }

    showResult(infoText);
    updateStatus('Информация загружена');
    
  } catch (e) {
    console.error('Ошибка:', e);
    showResult('❌ Ошибка отображения информации', true);
    updateStatus('Ошибка загрузки');
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

// ... (весь предыдущий код остается без изменений до функции verifyActiveOrders)

async function verifyActiveOrders() {
  if (!state.currentOrders.length && !state.currentOrderId) return;

  const validOrders = [];
  
  // Проверяем основной заказ
  if (state.currentOrderId) {
    try {
      const res = await apiPost('/order/status', { order_id: state.currentOrderId });
      if (res.status && res.status !== 'CANCELED') {
        validOrders.push({ 
          id: state.currentOrderId,
          phone: res.phone,
          country: res.country,
          service: res.service,
          status: res.status,
          price: res.price
        });
      }
    } catch (e) {
      console.error('Ошибка проверки заказа:', e);
    }
  }

  // Проверяем список заказов
  for (const order of state.currentOrders) {
    try {
      const res = await apiPost('/order/status', { order_id: order.id });
      if (res.status && res.status !== 'CANCELED') {
        validOrders.push({
          ...order,
          status: res.status // Обновляем статус
        });
      }
    } catch (e) {
      console.error('Ошибка проверки заказа:', e);
    }
  }

  // Обновляем состояние
  state.currentOrders = validOrders;
  state.currentOrderId = validOrders.length ? validOrders[0].id : null;
  
  saveOrdersToStorage();
}

// Инициализация страницы и UI
async function init() {
  const savedKey = localStorage.getItem('5sim_api_key');
  if (savedKey) {
    try {
      state.apiKey = savedKey;
      await verifyActiveOrders();
      el.apiKeyInput.value = savedKey;
      
      await apiPost('/init', { user_id: userId, api_key: savedKey });
      
      el.apiKeyForm.classList.add('hidden');
      el.mainPanel.classList.remove('hidden');
      
      loadOrdersFromStorage();
      await verifyActiveOrders(); // Проверяем актуальность заказов
      
      if (state.currentOrders.length > 0 || state.currentOrderId) {
        await getOrderInfo();
      }
      
      await loadCountries();
      await getBalance();
      updateUI();
      if (state.currentOrders.length > 0 || state.currentOrderId) {
        await getOrderInfo();
      }

    } catch (e) {
      // Если ключ невалидный, показываем форму ввода
      showResult(`❌ Ошибка проверки ключа: ${e.message}`, true);
      el.apiKeyForm.classList.remove('hidden');
      el.mainPanel.classList.add('hidden');
      updateStatus('Введите API ключ для начала работы');
      // Очищаем невалидный ключ
      localStorage.removeItem('5sim_api_key');
      state.apiKey = '';
    }
  } else {
    el.apiKeyForm.classList.remove('hidden');
    el.mainPanel.classList.add('hidden');
    updateStatus('Введите API ключ для начала работы');
  }
}

// Обработчики событий
document.addEventListener('DOMContentLoaded', () => {
  // Удаление ethereum (если нужно)
  if (window.ethereum) {
    try {
      delete window.ethereum;
    } catch (e) {
      console.warn('Не удалось очистить window.ethereum:', e);
    }
  }

  // Инициализация приложения
  init();

  // Обработчики кнопок
  el.saveKeyBtn.addEventListener('click', saveApiKey);
  el.buyBtn.addEventListener('click', buyNumber);
  el.codeBtn.addEventListener('click', getCode);
  el.cancelBtn.addEventListener('click', cancelOrder);
  el.balanceBtn.addEventListener('click', getBalance);
  el.infoBtn.addEventListener('click', getOrderInfo);
});
