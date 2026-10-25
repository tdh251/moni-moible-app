# Moni JSON backup v3

Phiên bản xuất hiện tại là **2**, vẫn nhận bản sao lưu v1 của tên app cũ. Giá trị `format: "monomoney"` giữ nguyên để tương thích dữ liệu. V2 thêm `transactions.adjustments_json`: chuỗi JSON của tối đa 20 dòng `{id, name, rate_bps}`. Ví dụ chuỗi `[{"id":"discount","name":"Chiết khấu","rate_bps":-500}]` nghĩa là giảm 5%. V1 không có dòng điều chỉnh; khi nhập dùng `[]`. App cũ chỉ biết v1 sẽ từ chối v2 thay vì tính sai số tiền.

Tiền từng mục là giá gốc; `transactions.amount` bằng tạm tính cộng mọi điều chỉnh đã làm tròn đến VND. Các tỷ lệ tính độc lập trên tạm tính ban đầu. Validator tính lại tổng và từ chối tỷ lệ sai, tổng không dương hoặc parent amount không khớp. CSV thêm dòng `Điều chỉnh`, cột `Điều chỉnh (%)` và `Số tiền phân bổ VND` (giá trị sau phân bổ cho từng mục). Tổng cột phân bổ của các mục khớp tổng giao dịch, không cộng tiếp các dòng điều chỉnh vào tổng parent.

```json
{
  "format": "monomoney",
  "version": 3,
  "exported_at": "2026-10-25T00:00:00.000Z",
  "data": {
    "onboarded": true,
    "accounts": [],
    "categories": [],
    "transactions": [],
    "items": []
  }
}
```

Đây là minh họa cấu trúc, không phải tệp hợp lệ để nhập: bản sao lưu `onboarded: true` phải có đúng một tài khoản tiền mặt. Mỗi mảng dùng nguyên các trường của bảng tương ứng trong `src/types/finance.ts`; `items` tương ứng bảng `transaction_items`. `is_archived` là số 0/1, số tiền là số nguyên VND an toàn, tham chiếu tùy loại giao dịch là ID hoặc `null`. Thời gian UTC ISO 8601 có mili giây và `Z`.

Bao gồm toàn bộ tài khoản (kể cả lưu trữ), số dư ban đầu, danh mục, giao dịch, mục hóa đơn, ID, thời gian và trạng thái onboarding. Cài đặt hiển thị/khóa là thông tin riêng của thiết bị, nằm trong SecureStore và không được nhập từ tệp. Không có token Cloud trong v1.

Nhập tệp giới hạn 20 MB và 100.000 hàng mỗi mảng. Kiểm tra định dạng/version, kiểu trường, ID duy nhất, tham chiếu, loại danh mục, tổng hóa đơn, số nguyên, ngày giờ và tính không âm của số dư toàn bộ lịch sử **trước khi xóa dữ liệu hiện tại**. Nếu hợp lệ và người dùng xác nhận, xóa và chèn toàn bộ trong một SQL transaction. Lỗi giữa chừng sẽ rollback. Bản sao lưu không được merge với sổ hiện tại.

JSON và CSV không mã hóa. Android Sharesheet cho phép gửi/lưu vào ứng dụng do người dùng chọn. Người dùng cần xuất và cất giữ bản sao lưu; không có sao lưu Cloud tự động. Tệp xuất tạm nằm trong cache ứng dụng và có thể bị hệ điều hành dọn. Sau khi chia sẻ, hãy kiểm tra tệp đã được lưu ở vị trí đích.

CSV dùng UTF-8 có BOM, dấu phẩy và CRLF. Một dòng giao dịch chứa tổng tiền; các dòng `Mục chi` tiếp theo chỉ chứa tên, tiền và danh mục từng mục. Khi cộng tổng CSV, dùng cột `Số tiền VND` ở dòng giao dịch; không cộng tiếp cột tiền mục. Giá trị văn bản có thể mở đầu công thức bảng tính được thêm dấu nháy đơn để tránh thực thi công thức. CSV chỉ dùng xuất báo cáo, không dùng khôi phục.


Checkbox Không tính vào số dư: lưu `transactions.exclude_from_balance` (0/1); khi 1 bỏ qua cả tiền vào và ra khi replay số dư, vẫn tính thống kê thu/chi và hiện lịch sử. Có thể sửa lại checkbox; mọi thao tác vẫn kiểm tra số dư lịch sử. Migration schema v3 thêm cột mặc định 0, không đổi dữ liệu cũ. Backup xuất v4, nhập được v1–v3 với mặc định tính vào số dư; bản cũ chứa cờ loại trừ sẽ bị từ chối. CSV thêm cột Không tính vào số dư và lịch sử/chi tiết có nhãn nhận biết.
