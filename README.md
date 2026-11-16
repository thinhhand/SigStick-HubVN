# SigStick Hub VN — Kho Sticker cho Zalo, Messenger & Telegram

Ứng dụng Web / PWA clone hệ sinh thái **SigStick** (`https://api.sigstick.com`), được thiết kế tối ưu để người dùng tìm kiếm, chế chữ Meme và gửi Sticker siêu tốc qua **Zalo**, **Messenger**, **Telegram**, **Discord** trên cả Máy tính (PC) và Điện thoại (iOS / Android).

## ✨ Tính năng nổi bật

1. **Tích hợp đầy đủ API từ SigStick (`https://api.sigstick.com`)**:
   - Khám phá các bộ Sticker **Thịnh hành (Trending)**, **Tải nhiều nhất (Top)**, **Mới cập nhật (New)** theo từng khu vực (`vn`, `jp`, `kr`, `us`).
   - Duyệt **Bộ sưu tập chọn lọc (Featured Collections)** theo chủ đề.
   - Tìm kiếm đa luồng kết hợp từ khóa, thẻ tag, bộ liên quan, gợi ý từ khóa realtime (`suggestions`) và hỗ trợ **dán trực tiếp đường dẫn `sigstick.com/pack/...` hoặc Pack ID**.
2. **Tự động chuyển đổi định dạng Sticker cho Zalo & Messenger**:
   - SigStick lưu trữ sticker dưới dạng `.webp` và `APNG` (Animated PNG) vốn dễ bị lỗi đứng hình hoặc thành file đính kèm khi dán vào Zalo / Messenger.
   - Endpoint `/api/sticker/convert` tự động giải mã từng frame của **Animated WebP** (qua `sharp`) và **Multi-frame APNG** (qua `upng-js` + `gifenc`) sang **PNG trong suốt** và **Ảnh động `.gif` lặp vô hạn**.
3. **Tối ưu tốc độ & Bộ nhớ đệm (In-memory LRU Cache)**:
   - Hệ thống đệm bộ nhớ trực tiếp trên Server giúp các sticker đã chuyển đổi được phản hồi tức thì (< 5ms).
   - Thiết lập header `Cache-Control` dài hạn (`immutable`, `stale-while-revalidate`) giúp trình duyệt tải siêu tốc.
4. **Chia sẻ 1 chạm đa nền tảng (Messenger & Zalo)**:
   - **Chia sẻ sang App (Web Share API Level 2)**: 1 chạm mở bảng chia sẻ để gửi thẳng file `.gif` động hoặc `.png` trong suốt vào **Messenger**, **Zalo**, **Telegram** trên iOS & Android.
   - **Copy PNG (`Ctrl + V`)**: Copy sticker tách nền trong suốt vào Clipboard để dán tức thì trên Messenger Web và Zalo PC.
   - **Xem & Tải trọn bộ**: Xem trước sticker động, tùy chỉnh độ phân giải Max Ultra HD (1024px) / Chuẩn (512px) và tải trọn gói ZIP.
5. **Đăng nhập Google & Lưu Sticker Yêu thích riêng**:
   - Tích hợp **Google OAuth (NextAuth.js)**: Đăng nhập an toàn, tiện lợi chỉ với 1 click.
   - **Đồng bộ đám mây (Cloud Sync)**: Lưu danh sách Sticker yêu thích và Bộ sưu tập đã lưu riêng cho từng tài khoản Google, tự động đồng bộ khi chuyển đổi giữa điện thoại và máy tính.
   - Hỗ trợ hoạt động linh hoạt: Không bắt buộc đăng nhập (vẫn lưu tạm qua LocalStorage như trước), tự động gộp (merge) danh sách khi đăng nhập Google.

## 🚀 Cách chạy ứng dụng

1. Tạo file `.env.local` từ mẫu `.env.example`:
```bash
cp .env.example .env.local
```
Điền `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (từ Google Cloud Console) và `AUTH_SECRET`.

2. Khởi chạy ứng dụng:
```bash
npm run dev
```

Sau đó mở trình duyệt tại địa chỉ: `http://localhost:3000`

## 👤 Tác giả & Bản quyền

- **Tác giả**: **Đặng Ngọc Thịnh**
- **Bản quyền**: © Đặng Ngọc Thịnh. Mọi quyền được bảo lưu.
