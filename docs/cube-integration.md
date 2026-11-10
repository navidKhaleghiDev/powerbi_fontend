# راهنمای اتصال به Cube

در برنامه، پنل **پیکربندی** و سپس صفحه **نمای کلی** را باز کنید. فرم اتصال در کارت **داده‌های Cube** قرار دارد.

## استفاده از رابط کاربری

۱. نشانی API را وارد کنید؛ برای اجرای محلی معمولاً `http://localhost:4000/cubejs-api/v1` است.

۲. اگر Cube در حالت توسعه محلی اجرا می‌شود، توکن را خالی بگذارید. در سایر محیط‌ها، توکن API معتبر وارد کنید؛ هرگز مقدار `CUBEJS_API_SECRET` را در فرانت‌اند قرار ندهید.

۳. دکمه **آزمایش اتصال و دریافت معیارها** را بزنید. برنامه با متد `meta()` مدل‌های قابل دسترسی را از Cube دریافت می‌کند. موفقیت این مرحله به معنی دریافت اطلاعات مدل است؛ برای تأیید دریافت داده مرحله بعد را انجام دهید.

۴. از فهرست **معیار**، معیار واقعی مدل خودتان را انتخاب کنید. برنامه با متد `load()` مقدار آن را دریافت و نمایش می‌دهد. دیگر به مدل نمونه `LineItems` نیاز نیست.

۵. برای درخواست دوباره داده، **تازه‌سازی** را بزنید. تازه‌بودن کش فرانت‌اند یک دقیقه است؛ دریافت دوره‌ای خودکار فعال نیست و این تنظیم کش سمت Cube را حذف نمی‌کند.

تنظیمات اتصال و توکن فقط در حافظه این کارت نگهداری می‌شوند. با خروج از صفحه یا بارگذاری مجدد باید اتصال را دوباره آزمایش کنید. توکن در localStorage ذخیره نمی‌شود. مقادیر اولیه فرم می‌توانند از متغیرهای محیطی Vite گرفته شوند.

## مقادیر اولیه اختیاری

در فایل `.env` ریشه پروژه:

```env
VITE_CUBE_API_URL=http://localhost:4000/cubejs-api/v1
VITE_CUBE_TOKEN=
```

پس از تغییر فایل محیطی، `pnpm dev` را دوباره اجرا کنید. متغیرهای Vite در مرورگر قابل مشاهده هستند؛ secret امضای Cube را در آن‌ها قرار ندهید.

## محدوده این اتصال

مسیر داده: **رابط کاربری ← API سرویس Cube ← معیار مدل ← مقدار نمایش‌داده‌شده**.

این فرم اتصال به سرور موجود را تنظیم می‌کند. نصب Cube، تعریف مدل‌ها و اتصال Cube به دیتابیس در سمت سرور انجام می‌شود. سایر پنل‌های فضای کاری به‌صورت خودکار از این اتصال داده نمی‌گیرند.

یک معیار بدون بُعد فقط یک مقدار برمی‌گرداند. نمودار روند نیاز به بُعد زمانی واقعی مدل، بازه زمانی و دانه‌بندی دارد.

## Local Docker Compose stack

The root `docker-compose.yml` starts the frontend, Cube.js, and the model-management API against an existing PostgreSQL database. It does not create or alter the database.

1. Copy `.env.compose.example` to `.env.compose`. Set the database credentials and a random management key with at least 24 characters. Keep the ignored `.env.compose` file private; use a read-only database account where possible.
2. Start the stack with `docker compose --env-file .env.compose up --build -d`.
3. Open the app at `http://localhost:8080`. Cube's API is available at `http://localhost:4000`; model files are stored in `cube/model`.
4. Stop the services with `docker compose --env-file .env.compose down`. This does not remove model files.

This is a local development setup: Cube development mode is enabled for schema discovery, and the published ports are limited to loopback. Do not expose it publicly or use it as a production authentication boundary. Cube loads model files from `cube/model`, mounted at its default `/cube/conf/schema` directory. The physical table browser works without models, but measures and queries require models created in the model builder. See the Docker Compose section in the root README for details.

## بررسی خطاها

- خطای شبکه: بررسی کنید Cube اجرا شده و نشانی آن از مرورگر قابل دسترسی است. localhost به رایانه‌ای اشاره می‌کند که مرورگر روی آن اجرا می‌شود.
- خطای احراز هویت: توکن معتبر و تنظیمات محیط Cube را بررسی کنید.
- خطای CORS: در سرور Cube دسترسی مبدأ فرانت‌اند را مجاز کنید.
- فهرست معیار خالی: مدل‌ها و مجوزهای Cube را بررسی کنید.
- خطای دریافت مقدار: ممکن است اطلاعات مدل قابل دسترسی باشد اما اجرای درخواست روی منبع داده شکست بخورد؛ پیام خطا و لاگ سرور را بررسی کنید.

## ساخت درخواست و نمایش نتیجه

بعد از دریافت اطلاعات مدل، از بخش «درخواست داده از Cube» معیار و در صورت نیاز بُعد گروه‌بندی را انتخاب کنید. می‌توانید یک فیلتر برابری روی همان بُعد و محدودیت ۱ تا ۱۰۰۰ ردیف تعیین کنید. «اجرای درخواست / تازه‌سازی» درخواست را ارسال می‌کند. JSON درخواست و جدول نتیجه در همان بخش نمایش داده می‌شوند. پیش‌نویس‌های محلی تا زمان اعمال روی سرور، در فهرست معیارهای قابل درخواست ظاهر نمی‌شوند.

### Environment-only SPA connection

The overview uses `VITE_CUBE_API_URL` and `VITE_CUBE_TOKEN` automatically; there is no connection form. Set them in `.env` and restart Vite. Rebuild the SPA when changing production values. No request is made when the URL is unset; the UI displays an unavailable-configuration message. An empty token is supported for a Cube development server.

`VITE_` values are visible in the browser bundle. Only use a Cube token intended for browser access; never put a Cube API signing secret here.
