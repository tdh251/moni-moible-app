# Kiểm tra trên Android trước khi phát hành

Các bài test tự động dùng SQLite thật qua Node 24 và cùng migration/repository với ứng dụng. Chúng **không** thay thế chạy UI trên Android. Máy triển khai hiện không có adb/emulator, chưa tạo APK.

1. Tạo APK preview theo README, cài trên Android. Kiểm tra màn hình nhỏ, bàn phím số và nút Back.
2. Onboarding: tiền mặt 0; thêm ngân hàng 1.000.000; đóng/mở app và xác nhận không onboarding lại.
3. Ghi thu vào tiền mặt 500.000; chi 100.000; chuyển 200.000 từ tiền mặt sang ngân hàng. Tổng tài sản phải là 1.400.000; thu 500.000 và chi 100.000.
4. Chi nhiều mục từ ngân hàng: 180.000 Ăn uống, 120.000 Gia dụng, 50.000 Ăn uống. Tổng bị trừ 350.000 một lần; thống kê Ăn uống 230.000 và Gia dụng 120.000 cho hóa đơn đó.
5. Sửa từng loại giao dịch; đổi tài khoản; sửa các mục, chuyển về chi đơn giản; kiểm tra số dư và thống kê. Thử số tiền vượt số dư và chuyển cùng tài khoản.
6. Thử ghi chi trước ngày có khoản thu đủ tiền; thử xóa/giảm khoản thu đã dùng cho khoản chi sau. Phải bị từ chối, không để lại một phần dữ liệu.
7. Lọc lịch sử theo tên/ghi chú, loại, tài khoản, danh mục, ngày/tháng/quý/năm. Giao dịch chuyển phải hiện ở cả tài khoản nguồn và nhận.
8. Lưu trữ ngân hàng: phải chuyển về 0 trước. Lưu trữ danh mục đã dùng; lịch sử/thống kê phải giữ nguyên. Khôi phục rồi dùng lại.
9. Xuất JSON qua Android Sharesheet vào nơi lưu riêng, xuất CSV và mở bằng ứng dụng bảng tính. Nhập JSON, hủy xác nhận, rồi xác nhận để kiểm tra cả hai nhánh.
10. Nhập tệp JSON hỏng, thiếu tham chiếu, tiền âm, tổng hóa đơn sai: phải từ chối mà không đổi dữ liệu cũ.
11. Bật ẩn số tiền; đóng/mở app. Bật khóa với thiết bị đã đăng ký sinh trắc học; đưa app vào nền, mở lại, thử hủy và thử thành công. Kiểm tra mã khóa Android dự phòng và thiết bị không có cảm biến.
12. Xóa dữ liệu: yêu cầu gõ đúng `XÓA TOÀN BỘ` và xác nhận lần nữa. Sau đó phải trở lại onboarding. Khôi phục từ bản sao lưu đã xuất.

13. Kiểm tra launcher/onboarding/Cá nhân có tên Moni, icon M; Dashboard có Tiền mặt và từng ngân hàng ngay dưới tổng số dư, trước nhóm thao tác giao dịch.
14. Hóa đơn tạm tính 1.000.000: thêm “Chiết khấu” -5 và “Thuế” -5 → tổng 900.000; đổi Thuế thành +5 → tổng 1.000.000. Xóa dòng, đổi tên/tỷ lệ, thử `-2,5`, tỷ lệ ngoài ±100, tổng không dương, số dư không đủ. Lưu/mở lại/sửa và kiểm tra thống kê danh mục cộng đúng tổng cuối. Xuất/nhập v2 rồi kiểm tra các dòng còn nguyên; nhập bản v1 cũ và kiểm tra dữ liệu được giữ.

Ghi lại model máy, phiên bản Android, phiên bản APK và kết quả thực tế trước khi đánh dấu đạt tiêu chí chạy trên Android.
