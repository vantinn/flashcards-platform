# Kiến trúc Hệ thống

Hệ thống **Flashcard Learning Platform** dùng chung **một backend duy nhất** cho client Web, đảm bảo dữ liệu và nghiệp vụ luôn nhất quán:

```text
Next.js (Web) ──►  NestJS API  ──►  TypeORM  ──►  PostgreSQL
```

## Các thành phần

1. **NestJS API** (`services/flashcards-api`) — trung tâm điều phối dữ liệu và xác thực duy nhất. Xác thực bằng JWT (access token 15 phút + refresh token 30 ngày) qua cookie httpOnly; hỗ trợ thêm `Authorization: Bearer` cho các client API khác nếu cần.
2. **TypeORM + PostgreSQL** — lưu trữ `User`, `FlashcardSet`, `Flashcard`, `StudySession`, `StudyProgress`. Toàn bộ migration được quản lý qua TypeORM CLI.
3. **Next.js Web App** (`apps/flashcards-web`) — App Router, Server/Client Components, Tailwind CSS.

## Xác thực

- Đăng ký/đăng nhập bằng email + mật khẩu (bcrypt hash).
- Middleware/Guard dùng chung một `JwtStrategy` hỗ trợ cả cookie và Bearer header.

## Mô hình dữ liệu

Hợp đồng dữ liệu (field, kiểu dữ liệu, ý nghĩa) giống hệt nhau giữa backend entity và Web `types/flashcard.ts`, để tránh tình trạng cùng một khái niệm nhưng có ý nghĩa khác nhau giữa các tầng.

| Model | Ý nghĩa |
| :--- | :--- |
| `User` | Tài khoản người dùng |
| `FlashcardSet` | Một bộ thẻ ghi nhớ (có tiêu đề, mô tả, chế độ hiển thị private/unlisted/public) |
| `Flashcard` | Một thẻ ghi nhớ (mặt trước/mặt sau) thuộc về một `FlashcardSet` |
| `StudySession` | Một phiên học một bộ thẻ |
| `StudyProgress` | Mức độ ghi nhớ (new/learning/mastered) của người dùng với từng thẻ |
