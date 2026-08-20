# ads-scraper

Збір і актуалізація `app-ads.txt`: щотижня картка в App Store / Google Play (видавець, сайт), щодня файл `https://[домен]/app-ads.txt`.

Архітектура: [`docs/architecture.md`](docs/architecture.md). Ідентифікатори додатків уже є; сервіс їх не відкриває каталогом, а освіжає. Читання — SQL (`apps.bundle_id` → `domains.body`), HTTP API немає.

Три незалежні контури (один образ, різний `CONTOUR`): **ios** (Apple Lookup), **android** (HTML Play), **appads** (GET файлу).

## Швидкий старт

Потрібні Node 20+ і Docker.

```bash
docker compose up -d postgres redis
npm install
npm run db:migrate
npm run seed
```

Seed кладе демо-набір (iOS — числові Apple ID, Android — package name). Свої id — `INSERT` у `apps`.

Мінімум для iOS + daily (три термінали):

```bash
CONTOUR=ios npm run scheduler
CONTOUR=ios npm run worker:store
npm run worker:appads
```

Android — окремі процеси з `CONTOUR=android`. Усе разом: `docker compose up --build` (три планувальники + три воркери).

Тести (без живого стору): `npm test`.

## Env

Дефолти в [`.env.example`](.env.example). Головне:

| Змінна | Навіщо |
|---|---|
| `CONTOUR` | `ios` / `android` / `appads` (планувальник і стор-воркер) |
| `SCHEDULER_BATCH_SIZE` / `SCHEDULER_INTERVAL` | швидкість наливу в Redis |
| `STORE_INTERVAL` / `APP_ADS_INTERVAL` | тиждень / доба від останнього успіху |
| `QUEUE_LEASE` | не пушити той самий рядок, поки він «у черзі» |
| `WORKER_CONCURRENCY` | iOS — бажане число id (округляється до батча Lookup); інакше число слотів |
| `LOOKUP_BATCH_SIZE` | id в одному Lookup, дефолт 50 |
| `PROXY_URL` | опційно, окремо на контур; кілька URL через кому або один шлюз зі своїм пулом IP |
| `STORE_COUNTRY` | storefront Lookup / Play, дефолт `us` |

429 і капча не зсувають тижневе вікно — лише `available_at` + backoff.
