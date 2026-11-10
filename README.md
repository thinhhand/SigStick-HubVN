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
3. **3 Chế độ gửi Sticker 1 chạm**:
   - **Copy PNG (`Ctrl + V`)**: Chạm vào bất kỳ sticker nào để copy thẳng định dạng `image/png` vào Clipboard và dán ngay vào khung chat Zalo PC / Messenger Web.
   - **Chia sẻ sang App (Web Share API Level 2)**: Mở Native Share Sheet trên iOS / Android để bắn thẳng file `.gif` hoặc `.png` vào ứng dụng Zalo hoặc Messenger.
   - **Phòng Studio & Chế chữ Meme**: Xem trước sticker trực tiếp trên giao diện mô phỏng khung chat Zalo / Messenger Dark Mode, bật **viền trắng Die-cut**, đổi màu nền hoặc gắn **Caption Meme tiếng Việt** trước khi Copy/Chia sẻ.
4. **Cá nhân hóa & Tải trọn bộ ZIP**:
   - Lưu **Sticker Yêu thích**, **Bộ Sticker đã lưu** và **Lịch sử sử dụng gần đây** ngay trên trình duyệt (`localStorage`).
   - Hỗ trợ tải xuống toàn bộ gói sticker dưới dạng file nén `.zip` (chọn định dạng `.png` hoặc `.gif`).

## 🚀 Cách chạy ứng dụng

```bash
cd C:\Users\srdbp04\.gemini\antigravity\scratch\sigstick-clone
npm run dev
```

Sau đó mở trình duyệt tại địa chỉ: `http://localhost:3000`
