# Mini Village Sim

Эта мини-игра симулирует жизнь маленькой деревни в реальном времени. Вся логика написана на JavaScript и выполняется прямо в браузере. Игрок может наблюдать за жителями, которые строят дома, собирают ресурсы и взаимодействуют между собой.

Каждый дом вмещает до пяти жителей, но поселенцы предпочитают жить не более чем по двое в одном доме. Если свободных домов для такого расселения не остаётся, строители начинают возводить новые, что увеличивает спрос на древесину.

## Запуск

Перед первым запуском установите зависимости:

```
npm install
```

Затем запустите игру локально командой:

```
npm start
```

После этого откройте `http://localhost:8080` в браузере. Также можно открыть `index.html` напрямую, но Web Worker могут работать не во всех браузерах.
Для работы звуков убедитесь, что необходимые аудиофайлы находятся в папке
`assets/`.

## Структура проекта

- `index.html` – основная HTML‑страница с подключением скриптов и канвасом для рендера.
- `main.js` – код интерфейса и отрисовки.
- `sim.worker.js` – ядро симуляции, работающее в Web Worker.
- `style.css` – минимальные стили для игры.
- `ai/` – модули искусственного интеллекта NPC.
- `data/` – константы и настройки (JSON).
- `ecs/` – простой менеджер сущностей.
- `events/` – небольшой EventEmitter.
- `assets/` – папка для графики и звуков. Поместите сюда файлы `birth.wav`,
  `death.wav` и `build.wav`.

Игра не требует сборки или сторонних зависимостей – достаточно открыть `index.html`.

## Тесты

Для запуска тестов используется Jest. Убедитесь, что зависимости установлены, затем выполните:

```
npm test
```

Тесты используют флаг `--experimental-vm-modules`, поэтому Node.js версии 18 и выше подходит без дополнительной настройки.
