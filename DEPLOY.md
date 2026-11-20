# Deploy Sidequest to Vercel

## Куда безопасно вставить OpenAI API key

Ключ вводится **только в Vercel → ваш проект → Settings → Environment Variables**:

- Name: `OPENAI_API_KEY`
- Value: ваш ключ OpenAI
- Type: **Secret** (в старом интерфейсе — Sensitive)
- Environment: **Production**. Если нужен работающий preview, отдельно включите Preview.

Нажмите Save, затем **Deployments → последний деплой → Redeploy**. Новый ключ применяется только к новым деплоям. Не вставляйте ключ в GitHub, код, `vercel.json`, браузерную консоль или чат. Не используйте префиксы `NEXT_PUBLIC_` или `VITE_`.

При первом импорте репозитория ключ также можно добавить в секции Environment Variables перед Deploy. Без ключа интерфейс откроется, а AI-шаги покажут понятную ошибку настройки.

## Первый деплой

1. В Vercel выберите Add New → Project → Import Git Repository → `anna-saklakova/gtm-hackaton`.
2. Framework Preset: **Other**, Root Directory: корень репозитория. Build Command: `npm run build`, Output Directory: `dist`, Node.js: **24.x**. Конфигурация уже есть в `vercel.json`.
3. Добавьте `OPENAI_API_KEY` как Secret и нажмите Deploy.
4. Откройте опубликованный URL и пройдите сценарий от идеи до первого шага. `/api/health` показывает только факт настройки ключа, не значение.

`MODEL_FAST` и `MODEL_RESEARCH` необязательны: по умолчанию `gpt-5.4-mini` и `gpt-6.2-astra`. `SESSION_SECRET` — необязательный отдельный случайный секрет шифрования; если не задан, ключ шифрования сессий выводится из OpenAI-ключа. При смене соответствующего секрета старые сессии завершаются.

## Как работает облачная версия

Фронтенд собирается в `dist` по списку из трёх публичных файлов. `.env`, серверные файлы и тестовые результаты в него не копируются. API запускается как Vercel Function, с лимитом времени 300 секунд для веб-поиска.

Сессия хранится в зашифрованном токене в sessionStorage вкладки; сервер проверяет целостность и срок действия при каждом шаге. Это позволяет продолжать работу после холодного запуска функции и между экземплярами Vercel без БД. Клиент не может менять состояние, ответы или счётчики внутри токена. Ключ OpenAI в токен не записывается. Сессия действует до 6 часов. Локальная версия сохраняет прогресс в `.sidequest-local/sessions.json` (исключён из Git), восстанавливает его после перезапуска и не завершает сессии автоматически.

Ограничения MVP: защита от одновременных запросов, повторов и коротких всплесков запросов работает внутри одного экземпляра функции. Это не глобальная квота: токены можно переиспользовать, а запросы могут попасть на разные экземпляры. Для личного демо используйте Vercel Deployment Protection; для публичного трафика нужны общее хранилище лимитов и отдельная защита от злоупотреблений. Использование AI расходует баланс API.

Официальные инструкции: [environment variable types](https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types), [managing variables and redeploy](https://vercel.com/docs/environment-variables/managing-environment-variables), [Node runtime](https://vercel.com/docs/functions/runtimes/node-js).
