# Lịch nhắc khoản vay / cho vay

Chọn ngày trong tháng và giờ nhắc (00:00–23:59) khi tạo khoản có kỳ hạn hoặc trong Chi tiết khoản vay → Lịch nhắc hàng tháng. Trong màn hình chi tiết, thay đổi ngày hoặc giờ được tự động lưu ngay; chọn “Không nhắc hằng tháng” để tắt ngay. Khi tạo khoản mới, lịch được lưu cùng khoản vay. Giờ được hiểu theo múi giờ hiện tại trên thiết bị. Tháng thiếu ngày đã chọn dùng ngày cuối tháng. Dừng nhắc khi tất toán hoặc hết kỳ hạn.

SQLite schema v19 thêm `loans.payment_time_minutes`: số phút từ đầu ngày, số nguyên 0–1439, mặc định 540 (09:00) cho dữ liệu cũ. Ngày và giờ được cập nhật trong cùng một giao dịch SQLite; không thay đổi số dư. Khi sửa giờ, lịch thông báo cũ được hủy và thay bằng lịch mới.

Backup JSON xuất v19, tiếp tục đọc v1–v18 với giờ mặc định 09:00 nếu thiếu trường này. Bản có giờ tùy chọn nhưng khai phiên bản cũ bị từ chối, tránh khôi phục sai giờ. Giờ không hợp lệ bị từ chối trước khi thay dữ liệu.

Thông báo cần quyền của hệ điều hành. Thiết bị lưu tối đa 60 thông báo sắp tới; mở Moni định kỳ để bổ sung. Android có thể trì hoãn thông báo theo chế độ tiết kiệm pin; lịch dùng cơ chế best effort hiện có.

Nút xóa trong chi tiết là biểu tượng thùng rác cạnh tên khoản vay, có nhãn trợ năng và hộp xác nhận trước khi xóa khoản vay cùng các lần trả / thu hồi.
