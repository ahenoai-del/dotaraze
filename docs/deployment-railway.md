# Размещение DotaRise на Railway — подготовленный вариант

## Решение

Для этапа 1: **один web-сервис DotaRise + одна PostgreSQL Railway**, в одном проекте и регионе. Web-сервис отдаёт React-сборку и `/api` на одном HTTPS-домене. Пример: `https://YOUR-SERVICE.up.railway.app/dashboard`. Дополнительный frontend-сервис, собственный домен и Supabase для этой схемы не требуются.

Это проектное решение для текущей архитектуры, а не оценка тарифов. Цены и расходы в этой задаче не проверялись. Подключение аккаунта/создание платных ресурсов не выполнялись.

## Что уже готово

- Корневой `Dockerfile`: Node 22 build, относительный `/api`, Python 3.12 runtime, non-root user, только готовые static-файлы.
- Корневой `railway.json`: Dockerfile build, `preDeployCommand` для Alembic, `/api/health`, один worker/одна реплика, ограниченные рестарты.
- `.env.railway.example`: только образец переменных без настоящих секретов.
- `.dockerignore`: allowlist исходников backend/frontend. `.env`, локальная БД, Python/Node environments и посторонние файлы пользователя не включаются в образ.
- Приложение поддерживает SPA-маршруты, отдельный кэш assets, no-store для API, Secure cookies и фиксированный Steam callback.
- Локальный аналог раздачи frontend/API проверен на `http://localhost:8001`, пользователь подтвердил настоящий Steam-вход и выход. Docker runtime проверен в GitHub Actions; Railway HTTPS ещё не проверен.

## Публикация исходников

Исходники опубликованы в выбранный пользователем [ahenoai-del/dotaraze](https://github.com/ahenoai-del/dotaraze), ветка `main`. Первый кодовый коммит — `5c5f12805156de6957f87d6f3c0cf31f85ad6b98`; [CI прогон](https://github.com/ahenoai-del/dotaraze/actions/runs/38630508818) успешен по всем трём jobs. Загружены 88 файлов по allowlist. `.env`, база, зависимости и посторонние файлы пользователя не загружались. Локальная ветка `codex/stage1` связана с `origin/main`.

В общей рабочей папке остаются посторонние файлы. **Не используйте `git add .`**. Для проверенного исходного архива доступен `scripts/package-release.py`; содержимое проверяется manifest/SHA-256.

## Настройка Railway

1. Создайте проект и PostgreSQL-сервис, назовите его `Postgres`. Не подключайте Supabase дополнительно.
2. Подключите выбранный GitHub-репозиторий как один web-сервис. Root Directory — корень репозитория; config path — `/railway.json`. Не выбирайте `/backend/railway.json` для основного варианта.
3. Создайте публичный HTTPS-домен web-сервиса через Railway Networking. Используйте именно выданный домен во всех трёх настройках origin ниже; пример — placeholder, не действующий адрес.
4. В Variables web-сервиса задайте значения:

| Переменная | Значение |
|---|---|
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — ссылочная переменная Railway, не публичный URL БД |
| `FRONTEND_URL` | `https://YOUR-SERVICE.up.railway.app` |
| `BACKEND_URL` | Точно то же значение |
| `CORS_ORIGINS` | `["https://YOUR-SERVICE.up.railway.app"]` |
| `COOKIE_SECURE` | `true` |
| `STATIC_DIR` | `/app/static` — также задан в Dockerfile |
| `CLIENT_IP_SOURCE` | `railway`, при соблюдении границы доверия ниже |
| `CACHE_TTL_SECONDS` | `120` |
| `RATE_LIMIT_PER_MINUTE` | `30` |
| `OPENDOTA_API_KEY` | Необязательный серверный ключ; не добавлять префикс VITE_ |

`PORT` назначается Railway, Docker CMD читает его при запуске. `VITE_API_URL=/api` встроен при Docker build; менять API-адрес в браузерной сборке не требуется. Локальный `.env` не загружается в Railway и не копируется в image. Если БД названа иначе, замените `Postgres` в ссылочной переменной её фактическим именем.

5. Оставьте одну реплику. Не включайте auto-sleep для web-сервиса, если ожидаете предсказуемую доступность входа. Проверьте выбранные ресурсы/расходы в своём аккаунте.
6. Запустите deployment: сначала должна пройти миграция, затем приложение и healthcheck. Ошибка pre-deploy должна блокировать выпуск новой версии; не обходите её ручным удалением таблиц.

Railway описывает [pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command) как шаг перед запуском и проверяет готовность по [HTTP healthcheck](https://docs.railway.com/deployments/healthchecks). Поля конфигурации сверены с [Config as Code reference](https://docs.railway.com/config-as-code/reference).

## Proxy и rate limit

Uvicorn запускается с `--no-proxy-headers`: приложение не использует forwarded scheme/host для Steam redirect. Все ссылки строятся по HTTPS origins из конфигурации.

Для адреса клиента Railway [документирует X-Real-IP](https://docs.railway.com/networking/public-networking/specs-and-limits). Режим `CLIENT_IP_SOURCE=railway` — явный opt-in для сервиса, доступного пользователям **только через Railway HTTP ingress**. Не открывайте TCP proxy на порт приложения и не допускайте недоверенные сервисы к его private endpoint: запрос из private network может содержать произвольный X-Real-IP. В этом варианте private network содержит только доверенный web-сервис и БД. Заголовок используется только для rate limit, не для сессий/ACL.

По умолчанию `connection` игнорирует заголовки клиента. Если режим Railway не настроен, все запросы от одного proxy могут разделять один лимит; это нужно проверить на настоящем deployment до публичного запуска. Для другого хостинга нужен его собственный договор доверия proxy, а не включение режима Railway.

## Приёмка после deployment

1. `/api/health` → 200, database connected; `/docs` открывается.
2. `/dashboard` и `/privacy` открываются напрямую и после обновления страницы. Несуществующий `/api/unknown` и `/assets/missing.js` дают 404, а не HTML.
3. Публичный поиск получает настоящие данные OpenDota; источник, время и размер выборки видны. При недоступности источника показывается ошибка.
4. Вход: Steam получает realm и return_to с настоящим HTTPS origin. Пройдите вход самостоятельно на Steam, проверьте `/api/auth/me` → 200 и наличие своего профиля. Пароль не вводится в DotaRise.

   Если публичная история закрыта, статистика может быть недоступна после успешного входа. Кнопка «Выйти» и 200 от `/api/auth/me` подтверждают сессию независимо от доступности матчей.
5. Cookie сессии: Secure, HttpOnly, SameSite=Lax, Path=/api, без Domain. После выхода `/api/auth/me` → 401. Отмена входа возвращает Dashboard с сообщением.
6. Удаление проверяйте только на специально созданном тестовом аккаунте DotaRise, если готовы его удалить; действие отзывает все сессии и не удаляет данные Steam/OpenDota.
7. Проверьте, что разные клиенты не делят один rate limit, а healthcheck остаётся 200 после ограничения пользовательских запросов. При переходе к нескольким репликам сначала нужен общий limiter/cache.
8. Настройте резервное копирование PostgreSQL в аккаунте и проверьте восстановление в отдельную тестовую БД. Наличие config-файла не является подтверждением резервного копирования.

## Откат

Сначала остановите публикацию при неудачном pre-deploy или healthcheck. Для текущих изменений новые миграции не нужны: схема остаётся `0001`. Предыдущую версию web-сервиса можно развернуть повторно, сохранив БД. Не запускайте `alembic downgrade` автоматически: для будущих несовместимых миграций требуется отдельный план и резервная копия.

## Supabase

Не нужен для выбранного варианта: аккаунты, сессии и миграции уже обслуживает FastAPI/PostgreSQL, Supabase Auth/Realtime/Storage не используются. Если в будущем выберете Supabase **вместо** PostgreSQL Railway, поменяется DATABASE_URL и потребуется отдельная проверка TLS, pooler и закрытости таблиц сессий через Data API. Одновременное подключение двух БД не предусмотрено и не выполнено.

## Что остаётся внешним

Локально Docker отсутствует, WSL не запускается; сборка выполнена на GitHub Ubuntu runner. Оба Dockerfile успешно собраны, миграция выполнена внутри image, контейнер запущен с production-конфигурацией и PostgreSQL, `/api/health` и `/dashboard` проверены. Это подтверждено [логами CI](https://github.com/ahenoai-del/dotaraze/actions/runs/38630508818).

Найдена доступная интеграция Railway, но её установка/подключение к аккаунту ещё не подтверждены. Проект Railway, облачная БД и публичный домен не созданы. TLS, настоящий ingress, облачный Steam callback и резервное копирование остаются частью следующего шага после подключения Railway. Успешный CI не означает успешный deployment.
