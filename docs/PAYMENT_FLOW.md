# Thanh toán tiền mặt và chuyển khoản BIDV (theo KLCN)

## Nguồn cấu hình

Đã đối chiếu trực tiếp từ `toanhuynh040805-crypto/KhoaLuan_AppQuanLyQuanAn_Toan`,
file `QuanAnBackend/Services/ReceiptProfile.cs` (21/11/2026):

- Ngân hàng: **BIDV**, BIN **970418**.
- Chủ tài khoản: **HUYNH DUC TOAN**.
- Số tài khoản nhận: **5811704638**.
- Chi nhánh: **BIDV - PGD Phú Phong**.
- Tạo VietQR theo chuẩn EMVCo/napas và URL `img.vietqr.io`.

Code tương đương nằm ở `backend/src/services/paymentBank.js`. Không kết nối đến cơ sở dữ liệu SQL Server/KLCN; sử dụng lại **cấu hình tài khoản nhận tiền**, không dùng nguồn số dư hoặc xác nhận giao dịch KLCN.

Khi đổi tài khoản, có thể cấu hình biến môi trường trong `.env` tại thư mục gốc:

```dotenv
PAYMENT_BANK_NAME=BIDV
PAYMENT_BANK_BIN=970418
PAYMENT_BANK_ACCOUNT=5811704638
PAYMENT_BANK_HOLDER=HUYNH DUC TOAN
PAYMENT_BANK_BRANCH=BIDV - PGD Phú Phong
```

Các biến trên là thông tin tài khoản **nhận** để hiển thị cho khách và mã QR; không chứa mật khẩu ngân hàng, token hay khóa bí mật.

## Thu ngân nhận tiền tại bàn

1. Đăng nhập `thungan@quanan.vn` (mẫu sau seed).
2. Vào `/staff/tables` → chọn bàn đang phục vụ.
3. Món đã được bếp và phục vụ đánh dấu hoàn thành. Nhân viên phục vụ trả quyền thao tác Redis của phiên bàn.
4. Bấm **Thu tiền toàn bộ hóa đơn**, hệ thống tính tổng tiền các lượt món chưa thanh toán trong `TableSession`.
5. **Tiền mặt:** nhập tiền khách đưa; backend bắt buộc đủ tiền và tính lại số thối trên máy chủ.
6. **Chuyển khoản:** hiển thị VietQR BIDV với **đúng số tiền phải thu** và mã nội dung riêng `TTBAN<sessionId>`. Thu ngân mở ứng dụng ngân hàng, xác nhận tiền đã về, nhập mã giao dịch thực nhận, đánh dấu đã đối chiếu.
7. Backend tạo `PaymentReceipt` trong MongoDB, ghi người nhận/giờ/phương thức, đánh dấu toàn bộ các `Order` thuộc hóa đơn đã thanh toán và cập nhật `TableSession.paymentState=paid`.
8. Thu ngân bấm **Kết thúc phiên & trả bàn**. Khi đã thanh toán, không được thêm/chỉnh món hoặc tự chuyển phiên bàn.

**Không được bấm xác nhận chuyển khoản khi chỉ thấy ảnh giao dịch hoặc lời thông báo từ khách.** Phải đối chiếu tiền thực nhận trên tài khoản ngân hàng quán.

## Thanh toán cho đơn khách đặt từ Web

1. Khách đặt món, chọn `Tiền mặt` hoặc `Chuyển khoản BIDV (VietQR)`.
2. Đơn chuyển khoản hiển thị QR tại **Đơn của tôi**; khách có thể sao chép số tài khoản, số tiền và mã `TTDON<orderId>`.
3. Đơn vẫn ở trạng thái **Chưa thanh toán** sau khi quét.
4. Thu ngân vào **Vận hành → Đơn hàng → Thu tiền / VietQR**, đối chiếu giao dịch thực tế và xác nhận.
5. Đơn được cập nhật `paymentStatus=paid`, `paymentMethod`, `paymentReceipt` và thời gian thanh toán.

## API

| Endpoint | Quyền | Tác dụng |
|---|---|---|
| `GET /api/payments/session/:id/quote` | staff, cashier, admin | Bảng tạm tính bàn và VietQR |
| `POST /api/payments/session/:id/confirm` | cashier, admin | Thu tiền toàn bộ phiên bàn |
| `GET /api/payments/order/:id/quote` | chủ đơn, cashier, admin | Bảng tạm tính đơn lẻ và VietQR |
| `POST /api/payments/order/:id/confirm` | cashier, admin | Thu tiền đơn lẻ |

Ví dụ tiền mặt:

```json
{
  "method": "cash",
  "expectedAmount": 220000,
  "cashReceived": 300000,
  "requestId": "b4364eb0-8ef9-493f-8ba1-7dba114585c9"
}
```

Ví dụ xác nhận tiền chuyển khoản sau **khi đã đối chiếu tiền thực nhận**:

```json
{
  "method": "bank-transfer",
  "expectedAmount": 220000,
  "bankVerifiedManually": true,
  "bankTransactionRef": "MA_GIAO_DICH_THUC_NHAN",
  "requestId": "5ca35e60-e2b1-41e2-b2de-2b8171463711"
}
```

Mọi giá trị phải được server tính và kiểm tra lại, không tin số tiền hoặc xác nhận chỉ từ frontend. Redis khóa thao tác xác nhận, MongoDB `PaymentReceipt` có unique index theo hóa đơn + mã giao dịch ngân hàng; nếu request bị lặp, backend trả biên nhận cũ thay vì thu tiền lần hai.

## Giới hạn quan trọng

**Chưa kết nối API ngân hàng/webhook xác thực giao dịch.** Hệ thống chỉ tạo QR và ghi nhận phiếu thu sau khi **thu ngân xác minh thủ công**. Đây không phải xác thực tiền vào tài khoản tự động, không được hiển thị “thành công” chỉ vì QR đã được tạo hoặc quét.

Phần này chưa xử lý thanh toán hỗn hợp, thanh toán từng phần, đặt cọc, đối soát sổ phụ tự động hay hoàn tiền. Với môi trường sử dụng thật cần tích hợp nhà cung cấp có chữ ký webhook, cơ chế phân quyền riêng và kiểm thử giao dịch cạnh tranh. 
