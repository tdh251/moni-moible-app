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

15. Mua hộ: ghi 300.000 cho Minh từ ví có đủ tiền; ví giảm 300.000, thu/chi tháng không đổi. Nhận hoàn 100.000 vào ví khác, còn chờ 200.000; nhận nốt 200.000, chuyển sang Đã hoàn. Kiểm tra nhóm theo người, tìm kiếm, hạn hoàn, thẻ Tổng quan và lịch sử từng ví. Thử hoàn vượt số còn thiếu, ngày hoàn trước lúc mua, sửa tiền ứng thấp hơn tiền đã hoàn; tất cả phải bị từ chối. Thử sửa/xóa khoản và xóa lần hoàn (hủy và xác nhận); không cho xóa nếu làm âm số dư lịch sử. Bật ẩn tiền và kiểm tra các màn hình mua hộ. Đóng/mở app, xuất/nhập JSON v21 và CSV, xác nhận đầy đủ người mua hộ và các lần hoàn.

16. Công nợ: xác nhận tab Khoản vay đổi thành Công nợ, Giao dịch và form thêm giao dịch không còn loại Mua hộ. Cho Minh vay 500.000 và mua hộ Minh 300.000 → Cần thu có một nhóm Minh, tổng 800.000; đi vay Minh 400.000 phải nằm riêng ở Cần trả, không bù trừ. Thu hồi 100.000 và nhận hoàn 50.000 → tổng cần thu 650.000. Lọc Cho vay/Mua hộ, Chưa thu hết/Đã xong/Tất cả và tìm người/nội dung/ghi chú; thẻ tổng vẫn là tổng trước bộ lọc. Mở từng loại, xem lịch sử và thao tác hoàn/trả. Thử tạo đủ ba loại từ nút Thêm khi đang ở mỗi nhóm, xác nhận quay về đúng chiều công nợ. Thẻ Tiền mua hộ ở Tổng quan mở Cần thu với bộ lọc Mua hộ. Bật ẩn tiền, kiểm tra mọi tổng và từng dòng đều được che; thử tên dài, số tiền lớn, cỡ chữ lớn và màn hình nhỏ.

17. Thu chi hộ: mở Công nợ → Thu chi hộ và tạo hồ sơ chưa có giao dịch. Tiền dự kiến không đổi ví/thống kê. Thử đủ bảy loại bút toán, nhiều lần nhận/chi và nhiều ví. Từ ví 5.000.000, nhận 500.000, chi hộ 450.000, giữ lại 50.000 → ví 5.050.000, thu nhập 50.000; nhận 400.000, chi hộ 450.000, tự chịu 50.000 → ví 4.950.000, chi tiêu 50.000. Không cộng/trừ lần hai.
18. Quyết toán: thử trả/thu toàn bộ, giữ/tự chịu toàn bộ, kết hợp, từng phần và quyết toán sau. Đối chiếu bảng xem trước, ví bị tác động, ngày ghi nhận, danh mục/tag và chênh lệch còn lại. Phải xác nhận tiền thực tế khi có nhận/trả. Double tap không được tạo trùng. Không hoàn tất khi công việc chưa thực hiện hoặc tiền chưa cân bằng. Hồ sơ đã hoàn tất phải mở lại trước khi sửa/hoàn tác; hoàn tác cả lần quyết toán phải gỡ đủ phần dòng tiền và phần thu chi cá nhân.
19. Hủy hồ sơ đang giữ 300.000 và hồ sơ cần thu 500.000: tổng vẫn hiển thị riêng hai chiều, bộ lọc Cần quyết toán vẫn tìm thấy hồ sơ đã hủy còn tiền. Kiểm tra tìm tên/người/nội dung, lọc người/trạng thái/tag/ngày bắt đầu; lịch sử Giao dịch → Thu chi hộ lọc riêng kỳ/ví. Dòng tiền thật phải hiện trong chi tiết từng ví, quyết toán không tiền phải có nhãn rõ và mở lại đúng hồ sơ từ báo cáo/lịch sử.
20. Hoàn tiền nhà bán phải chọn thanh toán gốc và không vượt tổng đã chi; không xóa/sửa khoản gốc khi làm mất tính hợp lệ của hoàn tiền hoặc quyết toán. Hồ sơ có lịch sử không được xóa toàn bộ bằng thao tác xóa hồ sơ trống. Thử xóa bút toán ghi nhầm, hủy xác nhận và xác nhận; các số dư/báo cáo phải được tính lại. Thử ẩn tiền, màn hình nhỏ, font lớn, bàn phím và Back, tiền lớn/tên dài, mất tập trung trong lúc lưu. JSON v22 phải giữ cả hồ sơ, bút toán, nhật ký hoàn tác; nhập v21 không thay đổi tiền cũ. Xuất CSV kiểm tra nhãn dòng tiền và không tính số dư của phần quyết toán.

Ghi lại model máy, phiên bản Android, phiên bản APK và kết quả thực tế trước khi đánh dấu đạt tiêu chí chạy trên Android.

## Redesign Emerald/Forest Green — nghiệm thu trên thiết bị

Trạng thái ngày 24/11/2026: typecheck, lint, 169 test và bundle export Android/iOS đạt. Các mục dưới đây **chưa được chạy trên thiết bị** do công cụ điều khiển giao diện không kết nối được. Không dùng kết quả unit test responsive để thay thế kiểm tra visual.

- [ ] Mở Tổng quan, Giao dịch, Công nợ, Thống kê và Cá nhân tại logical width 320, 360, 375, 390, 412, 430. Đối chiếu 6 ảnh tại `D:\du-an-ca-nhan\ui-moni-app`; kiểm tra không có overflow, nội dung bị FAB/footer che hoặc card tràn lề.
- [ ] Lặp lại với cỡ chữ hệ thống 100%, 150%, 200%; kiểm tra tab label, badge dài, sheet cuộn, nút lưu và hộp xác nhận.
- [ ] Số tiền `999.999.999.999 ₫`, giá trị 0, số âm; tên tài khoản/người dài, tiếng Việt nhiều dấu, tiêu đề giao dịch nhiều dòng. Phải thấy đủ số, không bị ellipsis hoặc bị icon đè.
- [ ] Nhập/sửa thu, chi, chuyển nội bộ, hóa đơn nhiều mục và bản nháp. Bật bàn phím, di chuyển caret giữa chuỗi, mở/đóng thông tin bổ sung, trở lại trường đã nhập. Không mất giá trị hoặc thay đổi cờ không tính số dư.
- [ ] Mở picker ví/danh mục/tag, tìm tiếng Việt không dấu, thêm nhanh danh mục/tag, chọn nhiều tag, đóng bằng Back và vùng ngoài. Mở xác nhận từ menu và từ editor modal; thử cả Hủy và Xác nhận.
- [ ] Mua hộ, hoàn từng phần, vay/cho vay, trả/thu hồi và phụ phí tất toán: số trước/sau phải khớp các service hiện hữu; lưu xong trở về đúng route và bộ lọc.
- [ ] Thu chi hộ: pending/in_progress/fulfilled/cancelled/completed; holding/receivable/balanced. Kiểm tra nhãn công việc và tài chính độc lập, quyết toán tiền thật/giữ lại/tự chịu/kết hợp, hoàn tất và hoàn tác.
- [ ] Thống kê khi rỗng, bằng 0, nhiều danh mục, category tags trùng, tag dài và tổng rất lớn. Tổng ở tâm donut hoặc dưới chart phải đọc đầy đủ; giữ cảnh báo không cộng chồng tag.
- [ ] Tài khoản: tạo, đổi tên, điều chỉnh số dư đầu, lưu trữ/khôi phục; kiểm tra lịch sử thu chi, khoản vay, mua hộ, thu chi hộ.
- [ ] Kéo thả danh mục, đổi icon/màu, lưu trữ/xóa/khôi phục danh mục/tag; kiểm tra hit area và trạng thái selected khi chữ lớn.
- [ ] Ẩn tiền, nhấn giữ mắt rồi thả/hủy chạm; khóa/mở sổ bằng bảo mật thiết bị, background/resume; không lộ tiền sau khi thả mắt.
- [ ] Bật Reduce Motion; kiểm tra điều hướng, chart, sheet và các modal. Kiểm tra screen reader cho icon button, trạng thái loading/disabled và progress.
- [ ] Backup/restore/CSV; kiểm tra không mất dữ liệu hoặc nhân đôi quyết toán. Kiểm tra luồng xóa toàn bộ vẫn yêu cầu gõ chuỗi xác nhận và xác nhận cuối cùng.

Ghi model máy, OS, build, width/fontScale, ảnh chụp và lỗi thực tế vào biên bản. Báo cáo triển khai: `docs/MONI-DESIGN-SYSTEM.md`.
