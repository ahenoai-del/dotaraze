# DotaRise

[![DotaRise checks](https://github.com/ahenoai-del/dotaraze/actions/workflows/ci.yml/badge.svg)](https://github.com/ahenoai-del/dotaraze/actions/workflows/ci.yml)

Исходники: [ahenoai-del/dotaraze](https://github.com/ahenoai-del/dotaraze). Первая публикация этапа 1 проверена в [GitHub Actions](https://github.com/ahenoai-del/dotaraze/actions/runs/38630508818): backend, frontend и Docker container — success.

Рабочая локальная версия платформы аналитики Dota 2: публичный поиск игрока, Steam OpenID, до 100 последних доступных матчей, показатели, статистика героев, адаптивный Dashboard и Meta Lab с настоящими агрегатами OpenDota.

По решению пользователя размещение на Railway отложено: разработка продолжается локально. После завершённого этапа 1 добавлена первая версия **Meta Lab**. Подготовленная схема Railway сохраняется: один web-сервис (frontend + API) и PostgreSQL Railway; Supabase не требуется. [Размещение](docs/deployment-railway.md) · [Meta Lab: возможности и методика](docs/meta-lab.md).

**Стек:** React 19, TypeScript, Vite, Tailwind CSS 4, компонент Button по схеме shadcn/ui + Radix Slot, React Router, TanStack Query, Recharts; Python 3.12, FastAPI, Pydantic, SQLAlchemy 2, Alembic, HTTPX, PostgreSQL.

## Быстрый доступ в этой рабочей папке

При разработке созданы `.venv`, `frontend/node_modules`, `.env` и отдельная локальная база в `.local/postgres`. Эти файлы исключены из Git. На момент проверки работали:

- [Dashboard](http://localhost:5173/dashboard)
- [Демо с явно вымышленными данными](http://localhost:5173/dashboard?demo=1)
- [Настоящий публичный профиль](http://localhost:5173/dashboard?player=70388657)
- [Документация API](http://localhost:8000/docs)
- [Проверка состояния](http://localhost:8000/api/health)
- [Собранное приложение с одного адреса — проверка схемы Railway](http://localhost:8001/dashboard)
- [Meta Lab — локальная мета героев](http://localhost:8001/meta)

Для запуска последнего варианта из корня выполните `.\scripts\start-production-preview.ps1`. Он собирает frontend с относительным `/api`, применяет миграции и запускает приложение на порту 8001. Это локальный HTTP-preview, а не проверка облачного HTTPS. Настройки действуют только в процессе скрипта; `.env` не изменяется. При занятом порту используйте `-Port 8002`.

Если процессы остановлены, откройте два окна PowerShell в корне проекта:

```powershell
# Первое окно, backend с миграциями
.\scripts\start-backend.ps1
```

```powershell
# Второе окно, frontend
.\scripts\start-frontend.ps1
```

Для созданного здесь отдельного кластера PostgreSQL используется порт **55432** и существующие бинарные файлы PostgreSQL 14.1. Существующая служба другой программы на 5433 не изменялась. После перезапуска Windows базу можно поднять так:

```powershell
.\scripts\local-postgres.ps1 -BinDirectory 'D:\Libs\PolynomLib\Templates\LocalBase\bin' -Action start
# Состояние / остановка: -Action status / -Action stop
```

Этот путь относится только к текущему компьютеру. Для новой установки используйте инструкции ниже. Для коммерческого размещения используйте поддерживаемую обновлённую версию PostgreSQL, а не бинарные файлы сторонней программы.

## Новая установка на Windows 10/11

### 1. Программное обеспечение

Установите [Python 3.12](https://www.python.org/downloads/windows/), [Node.js LTS](https://nodejs.org/) (проверено на Node 22), [PostgreSQL](https://www.postgresql.org/download/windows/) (рекомендуется 16+) и [Git](https://git-scm.com/downloads/win). Альтернатива локальной установке PostgreSQL — Docker Desktop с Compose.

Все команды ниже выполняются в PowerShell из корня репозитория, если не указан переход в другую папку. Используется `npm.cmd`, чтобы политика выполнения PowerShell не блокировала `npm.ps1`.

Для установки на другом компьютере сначала получите исходники:

```powershell
git clone https://github.com/ahenoai-del/dotaraze.git
Set-Location dotaraze
```

```powershell
py -3.12 --version
node --version
npm.cmd --version
git --version
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-lock.txt
Copy-Item .env.example .env
Set-Location frontend
npm.cmd ci
npx.cmd playwright install chromium --only-shell
Set-Location ..
```

Активация окружения не обязательна: команды используют полный относительный путь к Python. Если нужна активация: `.\.venv\Scripts\Activate.ps1`. `requirements.txt` содержит диапазоны прямых зависимостей, `requirements-lock.txt` — проверенные зафиксированные версии, `package-lock.json` — зависимости frontend.

### 2. PostgreSQL

**Вариант A: Docker Desktop.** Перед первым запуском задайте свой пароль; он будет использован Compose:

```powershell
$env:POSTGRES_PASSWORD = 'replace-with-your-local-password'
docker compose up -d db
docker compose ps
```

В `.env` укажите такой же пароль в `DATABASE_URL`. Compose по умолчанию доступен только на `127.0.0.1:5432`. Значение `dotarise` в примере — только для локальной разработки. Не используйте его в production.

**Вариант B: установленный PostgreSQL.** Откройте SQL Shell или укажите путь к `psql.exe` (скорректируйте версию и порт):

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -h localhost -p 5432 -U postgres
```

Внутри SQL Shell выполните SQL, заменив пароль:

```sql
CREATE ROLE dotarise LOGIN PASSWORD 'replace-with-your-local-password';
CREATE DATABASE dotarise OWNER dotarise;
```

После этого выйдите через `\q`. Не используйте существующую базу другой программы. В приложении не нужны права superuser; отдельный владелец своей базы достаточен для миграций.

### 3. Переменные окружения

Корневой `.env` читают backend и Vite. **Только переменные с префиксом `VITE_` попадают в браузер. Никогда не добавляйте этот префикс к секретам.** `.env` не коммитится.

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://user:password@host:port/database` |
| `FRONTEND_URL` | Origin frontend, локально `http://localhost:5173` |
| `BACKEND_URL` | Origin backend, локально `http://localhost:8000` |
| `CORS_ORIGINS` | JSON-массив, например `["http://localhost:5173"]` |
| `COOKIE_SECURE` | `false` только локально по HTTP, `true` по HTTPS |
| `ENVIRONMENT` | `development`, `test`, `production` |
| `OPENDOTA_BASE_URL` | По умолчанию `https://api.opendota.com/api` |
| `OPENDOTA_API_KEY` | Необязательный ключ OpenDota, только на сервере |
| `CACHE_TTL_SECONDS` | По умолчанию 120 |
| `RATE_LIMIT_PER_MINUTE` | По умолчанию 30 на адрес соединения |
| `CLIENT_IP_SOURCE` | `connection` локально; `railway` только при эксклюзивном Railway HTTP ingress (см. документ размещения) |
| `STATIC_DIR` | Необязательный абсолютный путь к собранному `frontend/dist`; без него backend работает как API |
| `VITE_API_URL` | Адрес API для браузера, локально `http://localhost:8000/api` |

При отсутствии `VITE_API_URL` используется относительный `/api`; Vite dev server проксирует его в локальный backend. В production Dockerfile значение `/api` задано явно. Vite env из корневого `.env` не включается в Docker-контекст.

Если пароль содержит `@`, `:`, `/`, `%` или другие специальные символы, кодируйте его как компонент URL. Для localhost используйте одно и то же имя в адресах: не смешивайте `localhost` и `127.0.0.1` в браузере — cookies и разрешённые origins различаются.

**Supabase:** используйте PostgreSQL connection string из своего проекта с `sslmode=require`; `postgres://` и `postgresql://` автоматически переводятся на драйвер psycopg. Для миграций используйте direct connection или session pooler; при IPv4-only подключении может потребоваться session pooler. Supabase anon/service-role key для backend не нужен. Не выдавайте frontend доступ к таблицам `accounts`, `sessions`, `login_states`; храните их в закрытой серверной базе/схеме или отключите их выдачу через Supabase Data API. RLS-политики Data API не заменяют защиту серверного соединения. Supabase в этой среде не проверялся.

### 4. Миграции и запуск

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m alembic current
..\.venv\Scripts\python.exe -m alembic check
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --no-proxy-headers --no-access-log
```

Во втором окне:

```powershell
Set-Location frontend
npm.cmd run dev
```

Откройте [localhost:5173](http://localhost:5173). Для поиска достаточно Dota Friend ID или Steam ID64. Steam vanity URL и поиск по имени в этапе 1 не поддерживаются. Пример публичного Dota ID: `70388657`; доступность его истории зависит от OpenDota.

Steam-вход не требует Web API key: кнопка ведёт на Steam, а callback `BACKEND_URL/api/auth/steam/callback` проверяется сервером. Пользователь вводит пароль только на Steam. **Ручная локальная приёмка завершена: пользователь подтвердил успешный вход и выход через настоящий Steam-аккаунт на localhost:8001.** Для повторной проверки откройте [собранный Dashboard](http://localhost:8001/dashboard), войдите и выполните выход. Ожидаемый контракт API: `/api/auth/me` → 200 после входа и 401 после выхода; он проверен автоматическими тестами. После размещения эту приёмку нужно повторить на облачном HTTPS-домене.

При отмене, истёкшем состоянии или ошибке проверки Steam пользователь возвращается в Dashboard с понятным сообщением и кнопкой повторного входа. Параметры assertion, state и произвольные return URL не выводятся на frontend. Ошибочные и повторные callback не создают сессию.

## Проверки

Основные backend-тесты не требуют сети и PostgreSQL: изолированные тестовые сессии используют SQLite в памяти. Боевая конфигурация приложения остаётся PostgreSQL.

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m pytest -q
# Проверить также настоящую мигрированную PostgreSQL из .env:
$env:RUN_POSTGRES_TESTS = '1'
..\.venv\Scripts\python.exe -m pytest -q
Remove-Item Env:RUN_POSTGRES_TESTS
Set-Location ..\frontend
npm.cmd run build
npm.cmd run test:e2e -- --workers=2
```

Стандартные браузерные тесты проверяют состояния интерфейса на изолированных ответах API; live-тесты по умолчанию пропускаются. Отдельный запуск с настоящим backend и интернетом (backend и БД должны работать):

```powershell
$env:RUN_LIVE_TESTS = '1'
npm.cmd run test:e2e -- tests/live.spec.ts --workers=1
Remove-Item Env:RUN_LIVE_TESTS
```

Для сквозной проверки **собранного** приложения вместо Vite (preview на 8001 должен работать):

```powershell
$env:RUN_LIVE_TESTS = '1'
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:8001'
$env:LIVE_API_URL = 'http://localhost:8001/api'
npm.cmd run test:e2e -- --workers=1
Remove-Item Env:RUN_LIVE_TESTS,Env:PLAYWRIGHT_BASE_URL,Env:LIVE_API_URL
```

Проверка только настоящего перехода в Steam, без авторизации (из корня):

```powershell
.\.venv\Scripts\python.exe scripts\probe-steam.py --origin http://localhost:8001
```

Единый локальный запуск стандартных проверок из корня: `.\scripts\test.ps1`. В GitHub Actions выполняются сборка frontend, browser-тесты, PostgreSQL, миграции, backend-тесты, сборка двух Docker-образов и запуск объединённого контейнера. [Первый прогон](https://github.com/ahenoai-del/dotaraze/actions/runs/38630508818) завершился успешно: 56 backend-тестов, 10 browser-тестов, 2 opt-in live-теста намеренно пропущены в CI; ранее они прошли локально с настоящим OpenDota.

Архив исходников без локальной БД, зависимостей, `.env` и посторонних файлов можно собрать из корня:

```powershell
.\.venv\Scripts\python.exe scripts\package-release.py
```

Результат — `.local/releases/dotarise-stage1-source.zip` и manifest с SHA-256 каждого исходника. Скрипт использует allowlist проекта, проверяет пути, UTF-8 и известные маркеры секретов, затем проверяет CRC и хэши содержимого архива. Это архив исходников, не готовый Docker image. Не используйте `git add .` в общей папке: там остаются посторонние файлы пользователя.

Фактические результаты проверки и оставшиеся ограничения: [docs/stage1-status.md](docs/stage1-status.md). Подробности расчётов и архитектуры: [docs/architecture.md](docs/architecture.md).

## Сборка и Railway

```powershell
Set-Location frontend
npm.cmd run build
npm.cmd run preview
```

Готовый frontend находится в `frontend/dist`. Настройте SPA fallback: все отсутствующие маршруты должны возвращать `index.html`. В `public/_redirects` есть правило для хостингов, поддерживающих этот формат. `VITE_API_URL` задаётся **при сборке**. Vite dev server не предназначен для production.

Основной вариант: корневые `Dockerfile` и `railway.json` собирают frontend на Node 22, переносят только готовые файлы в Python 3.12 image и запускают FastAPI от непривилегированного пользователя. `preDeployCommand` применяет миграции перед запуском сервиса. Health endpoint исключён из пользовательского rate limit. `/dashboard` и `/privacy` поддерживают SPA fallback; отсутствующие API, assets и скрытые файлы не подменяются HTML. Хэшированные assets кэшируются, HTML перепроверяется, API не сохраняется в браузерном кэше.

Инструкции с переменными, доменом, приёмкой и откатом: [docs/deployment-railway.md](docs/deployment-railway.md). Для отдельного backend остаются `backend/Dockerfile` и `backend/railway.json`; это альтернативная схема, а не второй обязательный сервис приложения. В обеих конфигурациях один worker/одна реплика. Docker отсутствует локально, но оба образа успешно собраны в GitHub Actions, объединённый контейнер запущен и проверен с PostgreSQL. Репозиторий опубликован, локальная ветка `codex/stage1` связана с `origin/main`. Railway ещё не развёрнут: интеграция найдена, её установка и подключение требуют действия пользователя. Проверка Docker в CI не заменяет проверку Railway HTTPS/ingress.

Production env: `ENVIRONMENT=production`, `COOKIE_SECURE=true`, HTTPS URL frontend/backend, точный `CORS_ORIGINS`. Для cookie-авторизации используйте домены одного site, например `app.example.com` и `api.example.com`, либо reverse proxy `/api`; произвольные несвязанные домены будут ограничены SameSite=Lax. Настройте TLS, доверенные proxy, rate limit на edge и резервное копирование БД. Данные сессий не должны попадать в access-логи: предусмотренный запуск использует `--no-access-log`.

В подготовленной схеме frontend и API имеют **одинаковый HTTPS origin**, поэтому отдельные домены не требуются. Uvicorn не доверяет forwarded headers; URL для Steam берутся из проверенной конфигурации. `CLIENT_IP_SOURCE=railway` использует один валидный `X-Real-IP` только как ключ rate limit и только при явно настроенной границе доверия Railway; никогда не как доказательство авторизации. Без этой настройки ключом остаётся адрес соединения. `/api/health` не расходует лимит.

## Типичные проблемы

| Симптом | Что проверить |
|---|---|
| `py -3.12` не найден | Установите именно Python 3.12 с Python Launcher, откройте новое окно PowerShell |
| PowerShell блокирует `npm.ps1` | Используйте `npm.cmd` / `npx.cmd`; для Python — прямой путь из `.venv` |
| Блокируются `.ps1` проекта | Запускайте приведённые команды вручную; менять системную политику выполнения не обязательно |
| Ошибка доступа при создании `.venv` | Проверьте доступ к папке и `%TEMP%`; при уже созданном окружении повторите `.\.venv\Scripts\python.exe -m ensurepip --upgrade` |
| Нет соединения с БД | Сервис/контейнер, правильный порт, имя базы, пароль и `DATABASE_URL`; выполните миграции |
| Ошибка `spawn EPERM` у Vite/Playwright | Среда запрещает дочерние процессы; разрешите штатные инструменты сборки в своей среде. Это ограничение среды, а не ошибка TypeScript |
| Playwright не находит Chromium | В `frontend` выполните `npx.cmd playwright install chromium --only-shell` |
| Порт занят | Не завершайте чужие процессы; выберите другой порт и согласованно обновите URL/CORS/Steam callback; Vite настроен на строгий порт 5173 |
| 404 профиля / пустая история | Профиль может отсутствовать в OpenDota. Включите в Dota 2 общедоступную историю матчей и дождитесь индексации; старые данные могут остаться недоступны |
| 429 от DotaRise | Подождите минуту; обновления не выполняются в бесконечном цикле |
| 503 / лимит OpenDota | Проверьте сеть и доступность API, подождите; при необходимости настройте серверный OpenDota key |
| Вход не сохраняется | Точное совпадение localhost/домена, корректный HTTPS/Secure, один site, разрешённый CORS origin и credential cookies |
| Старые данные после обновления | Кэш живёт до 120 секунд; кнопка обновляет запрос, но не обходит серверный TTL |
| Нет изображений героев | Проверьте доступ к CDN Valve; таблица и расчёты не зависят от изображений |

В фиксированных версиях тестовая Starlette выдаёт предупреждение о будущем переходе с HTTPX на HTTPX2. На выполнение проверок это не влияет; замена клиента требует отдельного обновления зависимостей.

## Структура и ограничения этапа

```text
frontend/src/
  app/           маршруты и обвязка
  components/    навигация, UI-примитивы, диалог аккаунта
  features/      Dashboard, графики, метрики, история, demo fixtures
  hooks/         запросы TanStack Query
  pages/         Dashboard и политика данных
  services/      HTTP-клиент
  styles/        дизайн-токены и адаптивные стили
  types/         контракт API
backend/
  app/api/       HTTP-маршруты
  app/core/      настройки, БД, лимиты, ошибки
  app/models/    SQLAlchemy-модели
  app/schemas/   контракты Pydantic
  app/services/  Steam, OpenDota, расчёты, ID
  app/repositories/  аккаунты и сессии
  alembic/       миграции
  tests/         unit, API, security, opt-in PostgreSQL
docs/            архитектура и состояние этапа
scripts/         запуск и проверки в PowerShell
```

История ограничена 100 доступными significant-матчами, а не всеми матчами аккаунта. Фильтры относятся только к загруженной истории. MMR не выдумывается, отсутствующие показатели отображаются как «—». Источник и время выборки доступны на Dashboard. Вымышленные данные используются только в тестах и явно включённом demo-режиме.

Кэш и rate limiter находятся в памяти одного процесса. Meta Lab реализован: паблики / про-сцена / Turbo, доступные ранговые срезы, Winrate, явно обозначенная оценка Pickrate, фильтры, график, детали героев, локальный пул и справочник патчей. Период и патч выборки heroStats не известны, сравнение меты до/после патча пока не реализовано. AI Coach, Challenges, Community, Telegram и Pro остаются будущими модулями. Для масштабирования нужны общий rate limit/cache и проверка выбранной инфраструктуры. Локальный Steam-вход и выход подтверждены пользователем.

DotaRise — независимый проект. Dota 2, Steam и изображения героев принадлежат Valve. Данные предоставляет [OpenDota](https://www.opendota.com/); условия использования источников нужно учитывать при публикации.
