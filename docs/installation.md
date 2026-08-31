# Hướng dẫn cài đặt

## Backend (Core API)

Backend được xây dựng trên **NestJS**, sử dụng **TypeORM** làm ORM và **PostgreSQL** làm cơ sở dữ liệu.

### Yêu cầu hệ thống

- **Node.js:** >= 20.x
- **npm:** >= 9.x
- **Docker** (khuyến nghị, để chạy PostgreSQL cục bộ) hoặc một instance PostgreSQL >= 14 sẵn có

### Các bước cài đặt

```bash
cd services/flashcards-api

# 1. Khởi động PostgreSQL bằng Docker
docker compose up -d

# 2. Cài đặt dependencies
npm install

# 3. Cấu hình biến môi trường
cp .env.example .env
# Điền: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, GOOGLE_CLIENT_ID (tuỳ chọn)

# 4. Chạy migration
npm run migration:run

# 5. Khởi động server (chế độ dev, tự reload)
npm run start:dev
```

API mặc định chạy tại `http://localhost:3001/api/v1`.

### Kiểm thử

```bash
npm test        # unit test (vitest)
npm run build   # build production
```

### Ghi chú xác thực

Endpoint xác thực hỗ trợ cả hai kiểu client:

- **Web:** đăng nhập trả về cookie httpOnly (`credentials: "include"`).
- **Client API khác (không dùng trình duyệt):** đăng nhập cũng trả về `accessToken`/`refreshToken` trong JSON body, client tự lưu an toàn và gửi kèm header `Authorization: Bearer <token>`.

## Frontend (Web App)

Giao diện Web được phát triển bằng **Next.js** (App Router) kết hợp **Tailwind CSS**.

### Yêu cầu hệ thống

- **Node.js:** >= 20.x
- **npm:** >= 9.x
- Backend NestJS phải đang chạy (mặc định tại `http://localhost:3001`)

### Các bước cài đặt

```bash
cd apps/flashcards-web

# 1. Cài đặt dependencies
npm install

# 2. Cấu hình biến môi trường
cp .env.example .env.local
# Điền: NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# 3. Khởi động dev server
npm run dev
```

Web app mặc định chạy tại `http://localhost:3000`.

### Kiểm thử & build

```bash
npx tsc --noEmit   # kiểm tra kiểu dữ liệu
npm run lint       # eslint
npm run build      # build production (Turbopack)
```
