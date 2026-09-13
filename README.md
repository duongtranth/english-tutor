# English Tutor — TOEIC & IELTS

Ứng dụng web học tiếng Anh với 4 kỹ năng (Từ vựng, Ngữ pháp, Đọc, Nghe), hỗ trợ cả TOEIC và IELTS.

## Kiến trúc

- `server/` — Node.js + Express, cơ sở dữ liệu SQLite (`node:sqlite` built-in), xác thực JWT.
- `client/` — React + Vite, React Router.

## Chạy dự án

### Backend (cổng 4000)

```bash
cd server
npm install
npm run dev
```

### Frontend (cổng 5173)

```bash
cd client
npm install
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`, đăng ký tài khoản mới để bắt đầu.

## Tính năng

- Đăng ký / đăng nhập (JWT)
- Chọn kỳ thi TOEIC hoặc IELTS, lưu theo từng người dùng
- Flashcard từ vựng với hệ thống lặp lại ngắt quãng (Leitner box)
- Trắc nghiệm ngữ pháp có giải thích đáp án
- Bài đọc hiểu với câu hỏi trắc nghiệm
- Bài nghe (dùng Web Speech API để đọc transcript) với câu hỏi trắc nghiệm
- Dashboard theo dõi tiến độ từng kỹ năng

## Mở rộng thêm

- Thêm nhiều từ vựng / câu hỏi / bài đọc / bài nghe trong `server/src/seed.js`
- Thêm audio thật thay vì text-to-speech cho phần Nghe
- Thêm bài thi thử đầy đủ (full mock test) theo cấu trúc thật của TOEIC/IELTS
