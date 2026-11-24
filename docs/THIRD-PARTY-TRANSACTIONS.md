# Thu chi hộ — thiết kế, vận hành và kiểm thử

## Tổng quan và phạm vi

Module mới hoạt động trong ứng dụng Expo SDK 58 / React Native hiện có, dùng SQLite ngoại tuyến và Expo Router. Truy cập qua **Công nợ → Thu chi hộ**, thẻ **Thu chi hộ** trên Tổng quan hoặc bộ lọc **Giao dịch → Thu chi hộ**.

Hỗ trợ tạo/sửa hồ sơ; nhiều người, nhiều lần nhận/chi, nhiều tài khoản; bảy loại bút toán; quyết toán từng phần hoặc toàn phần; giữ lại thành thu nhập/tự chịu thành chi tiêu; hoàn tất, hủy và mở lại; sửa/xóa bút toán ghi nhầm và hoàn tác toàn bộ một lần quyết toán. Có tìm/lọc người, công việc, tài chính, tag và kỳ ngày bắt đầu. Tổng cần thu và giữ hộ được cộng riêng từng hồ sơ, kể cả hồ sơ hủy còn tiền cần xử lý.

Phần mua hộ đơn giản và vay/cho vay đã tồn tại được giữ nguyên. Không tự chuyển đổi, sao chép hoặc phân loại lại dữ liệu cũ. Không có dữ liệu mẫu được thêm vào sổ thật.

## Các quyết định kiến trúc

- Giữ nguyên nguồn số dư `accountBalances`: dòng tiền của `third_party_entries` được chiếu vào cùng cơ chế phát lại lịch sử với giao dịch, vay và mua hộ cũ. Không duy trì một số dư thứ hai, không điều chỉnh số dư ban đầu hoặc tạo tài khoản ảo.
- Bảy loại bút toán: `receive`, `payment`, `refund`, `reimbursement`, `payment_refund`, `settlement_income`, `settlement_expense`. Năm loại đầu có tài khoản và dòng tiền, không phải thu chi cá nhân. Hai loại cuối có danh mục, không có tài khoản/dòng tiền.
- Hai loại quyết toán cá nhân được chiếu thành các dòng báo cáo trong `personalReportTransactions`, không chèn thêm giao dịch thu/chi thường vào bảng `transactions`. Ngày `occurred_at` của quyết toán là kỳ ghi nhận báo cáo. Danh mục/tag được dùng chung với hệ thống hiện có.
- Bút toán không tiền không gán tài khoản thật. Vì vậy báo cáo tổng/danh mục/tag bao gồm chúng; bộ lọc một ví chỉ bao gồm các khoản gắn với ví đó, không tự quy khoản quyết toán không tiền vào ví bất kỳ. Lịch sử hồ sơ và Giao dịch → Thu chi hộ luôn có thể xem bút toán không tiền khi không lọc ví.
- Trạng thái công việc (`pending`, `in_progress`, `fulfilled`, `completed`, `cancelled`) độc lập với trạng thái tài chính được tính từ chênh lệch. Cân bằng tiền không tự hoàn tất. Chỉ hoàn tất sau khi công việc đã thực hiện hoặc đã hủy và chênh lệch bằng 0. Hồ sơ hoàn tất phải mở lại trước khi sửa tài chính.
- Mỗi mutation đi qua hàng đợi và transaction của `FinanceRepository`. `revision` của hồ sơ phát hiện dữ liệu chỉnh sửa cũ. Một lần quyết toán gộp phần tiền thật và phần cá nhân trong cùng transaction. Mã yêu cầu và nhật ký tồn tại sau hoàn tác bảo đảm retry không lặp dòng tiền.
- Sửa/xóa lịch sử phải phát lại toàn bộ số dư và kiểm tra các bút toán phụ thuộc. Hoàn nhà bán bắt buộc chọn thanh toán gốc trong cùng hồ sơ; tổng hoàn không vượt tiền gốc. Bút toán của một lần quyết toán không được sửa/xóa lẻ; hoàn tác cả lần rồi ghi lại nội dung đúng.
- Chỉ xóa hồ sơ trống chưa có bút toán/nhật ký. Với hồ sơ có lịch sử, dùng Hủy nghiệp vụ; lịch sử và nghĩa vụ tài chính không bị xóa. Bút toán ghi nhầm riêng lẻ vẫn có thể xóa có xác nhận nếu không phá tính hợp lệ của lịch sử.

Công thức duy nhất ở `thirdPartyBalance`:

```text
chênh lệch = nhận trước + thu lại + nhà bán hoàn - chi hộ - trả lại - giữ lại + tự chịu
đang giữ hộ = max(chênh lệch, 0)
cần thu = max(-chênh lệch, 0)
dòng tiền thật = chênh lệch + thu nhập cá nhân - chi tiêu cá nhân
```

Tất cả số tiền là số nguyên VND an toàn JavaScript. Các tổng được kiểm tra bằng `safeAdd`; không lưu tổng hợp trùng lặp trên hồ sơ.

## Thay đổi source code

Các file mới:

- `src/types/third-party.ts`: kiểu hồ sơ, bút toán, yêu cầu và nhật ký quyết toán.
- `src/services/third-party.ts`: công thức, validation, replay công nợ và phép chiếu dòng tiền/báo cáo.
- `src/services/third-party-list.ts`: tìm/lọc hồ sơ và lịch sử dùng chung, có thể kiểm thử độc lập.
- `src/database/third-party.ts`: ghi dữ liệu, kiểm tra revision, trạng thái, quyết toán và hoàn tác trong transaction được truyền từ repository.
- `src/features/third-party/ThirdPartyCaseForm.tsx`: form hồ sơ và metadata không tác động tiền.
- `src/features/third-party/ThirdPartyEntryForm.tsx`: thêm/sửa/xóa bút toán, chọn tài khoản/danh mục/tag/thanh toán gốc.
- `src/features/third-party/ThirdPartySettlementForm.tsx`: phương án quyết toán, xác nhận tiền thật, xem trước và hoàn tất.
- `src/features/third-party/ThirdPartyEntryRow.tsx`: nhãn dòng tiền/phi tiền mặt và liên kết truy vết.
- `src/features/third-party/ThirdPartyHistory.tsx`: lịch sử có phân trang hiển thị bằng FlatList, bộ lọc kỳ/ví/tìm kiếm.
- `src/app/third-party/index.tsx`, `new.tsx`, `[id].tsx`, `edit/[id].tsx`, `entry/new.tsx`, `entry/edit/[id].tsx`, `settle/[id].tsx`: bảy route của module.
- `tests/third-party.test.mjs`: kiểm thử công thức và tích hợp SQLite.

Các file hiện có được sửa trong đợt này:

- `src/types/finance.ts`: ba collection tùy chọn cho tương thích ledger cũ.
- `src/database/migrations.ts`, `src/database/repository.ts`: migration 22, snapshot và các phương thức module; bảo toàn tham chiếu danh mục/tag, backup/restore/reset theo thứ tự foreign key.
- `src/services/accounting/ledger.ts`: dòng tiền mới tham gia kiểm tra số dư; báo cáo dùng phép chiếu quyết toán.
- `src/services/backup/validation.ts`, `src/services/export/csv.ts`: JSON v22, kiểm tra đầy đủ và xuất bút toán CSV.
- `src/services/transaction-list.ts`, `src/components/ui/index.tsx`: dòng báo cáo quyết toán mở đúng hồ sơ, có nhãn không tính số dư.
- `src/app/(tabs)/dashboard.tsx`, `loans.tsx`, `transactions.tsx`, `settings.tsx`, `src/app/accounts/[id].tsx`: các lối vào, số tổng hợp, bộ lọc, lịch sử tài khoản và thông tin khôi phục.
- `package.json`: chạy thêm bộ kiểm thử module; không thêm dependency.
- `tests/finance.test.mjs`: cập nhật kỳ vọng version mới từ 21 sang 22, giữ nguyên các kiểm tra nghiệp vụ cũ.
- `README.md`, `docs/BACKUP-FORMAT.md`, `docs/ANDROID-QA.md`: hướng dẫn và kiểm tra thủ công.

Các thay đổi chưa commit có sẵn trước đợt này không được hoàn tác hoặc ghi đè bằng phiên bản HEAD.

## Database, migration và tương thích

Migration 22 chỉ thêm ba bảng và index:

| Bảng | Mục đích |
|---|---|
| `third_party_cases` | Metadata, trạng thái công việc, thời điểm, revision; không lưu số dư |
| `third_party_entries` | Bút toán có loại, tiền, tài khoản hoặc danh mục, tag, thời điểm, thứ tự và các liên kết |
| `third_party_settlements` | Nhật ký yêu cầu quyết toán và thời điểm hoàn tác để chống trùng |

Foreign key dùng RESTRICT, không cascade xóa lịch sử. Index phục vụ người/trạng thái/thời gian, hồ sơ, tài khoản, danh mục và các liên kết thanh toán/quyết toán. Không sửa migration cũ, không backfill bảng giao dịch/mua hộ/vay và không chạy migration trên sổ thật trong phiên triển khai. Migration được chạy trong các database kiểm thử mới và bản sao dữ liệu thử nghiệm v21.

Backup xuất v22, tiếp tục đọc v1–v21 với collection thu chi hộ mặc định rỗng. Bản cũ khai báo version dưới 22 nhưng chứa thu chi hộ bị từ chối. Restore kiểm tra tất cả tham chiếu, công nợ, journal và số dư trước khi ghi; toàn bộ thay thế chạy nguyên tử. Bút toán phi tiền mặt và journal hoàn tác được giữ trong JSON.

Trước khi cập nhật trên điện thoại, xuất JSON ở **Cá nhân → Sao lưu & khôi phục** và giữ bản trước nâng cấp ở nơi riêng. Nếu cần rollback ứng dụng, dùng bản sao sổ trước nâng cấp và build cũ trong một môi trường khôi phục riêng đã kiểm tra; không hạ `user_version`, không xóa bảng trên sổ đang sử dụng. Build cũ sẽ từ chối database v22. Không có down-migration tự động; dữ liệu Thu chi hộ mới sẽ không có trong backup trước nâng cấp. Ưu tiên bản vá tiếp theo để giữ toàn bộ dữ liệu mới.

## Hướng dẫn sử dụng

1. Mở **Công nợ → Thu chi hộ → Thêm**, nhập tên/người/ngày; tiền dự kiến, hạn, mô tả, tag, ghi chú là tùy chọn. Lưu hồ sơ chưa phát sinh tiền được.
2. Trong chi tiết chọn **Thêm bút toán**. Chọn Nhận tiền trước hoặc Thanh toán hộ và ví thực tế. Chỉ xác nhận khi dòng tiền đã phát sinh. Có thể ghi nhiều lần trên nhiều ví.
3. Dùng Nhận lại tiền ứng, Trả lại tiền thừa hoặc Nhà bán hoàn tiền theo tình huống. Nhà bán hoàn tiền phải liên kết một khoản thanh toán gốc.
4. Chọn **Quyết toán**: trả/thu tiền thật, giữ lại/tự chịu, hoặc kết hợp/từng phần. Nhập số tiền, ví cho phần tiền thật, danh mục/tag cho phần cá nhân. Xác nhận tiền thật đã nhận/trả và kiểm tra bảng xem trước. **Quyết toán sau** không ghi thêm gì.
5. Đánh dấu công việc **Đã thực hiện / giao đồ**. Khi chênh lệch bằng 0 có thể **Hoàn tất hồ sơ**. Hồ sơ hủy vẫn giữ tiền cần thu/trả; có thể tiếp tục quyết toán.
6. Khi cần sửa hồ sơ hoàn tất, chọn **Mở lại hồ sơ** trong menu. Nhấn bút toán thường để sửa/xóa ghi nhầm. Với một lần quyết toán, dùng **Hoàn tác lần quyết toán**; hệ thống kiểm tra lại mọi phụ thuộc trước khi gỡ.

Ví dụ kiểm chứng: nhận 500.000, chi hộ 450.000, giữ 50.000 → ví tăng thực 50.000 và thu nhập 50.000. Nhận 400.000, chi hộ 450.000, tự chịu 50.000 → ví giảm thực 50.000 và chi tiêu 50.000. Không có dòng tiền thứ hai khi phân loại thành thu/chi cá nhân.

## Kiểm thử và giới hạn kiểm chứng

Baseline trước sửa: 135 bài kiểm thử tài chính hiện có đạt. Sau tích hợp, 135 bài cũ và 31 bài mới đạt (166/166). Bộ mới bao phủ 24 tình huống được yêu cầu (một số tình huống ghép trong cùng bài) và thêm các kiểm tra:

- Số dư từng tài khoản, thu/chi, công nợ, trạng thái tài chính và bất biến công thức.
- Nhận/chi nhiều lần, hoàn nhà bán toàn phần/từng phần, nhiều ví và hai hồ sơ không bù trừ.
- Quyết toán phi tiền mặt, kết hợp/từng phần, chặn vượt giới hạn, hoàn tác và thay đổi lịch sử phụ thuộc.
- Mô phỏng lỗi sau khi đã chèn một phần của quyết toán để xác nhận rollback cả dòng tiền, journal và trạng thái.
- Retry/double submit, cạnh tranh revision và retry sau hoàn tác không tạo lại tiền.
- Báo cáo khác kỳ, danh mục, tag; bảo toàn tham chiếu khi lưu trữ danh mục/tag.
- Migration v21 với dữ liệu thu/chi/chuyển/vay/mua hộ và tag; so sánh snapshot, số dư, báo cáo trước/sau.
- JSON cũ/mới, backup hỏng/thiếu bút toán, lỗi giữa restore, CSV và đóng/mở SQLite thật.
- Lọc người/trạng thái/ngày/tag, số tiền không hợp lệ, âm ví trong lịch sử, tài khoản đã lưu trữ, tham chiếu khác hồ sơ và reset có foreign key.

Đã chạy TypeScript strict, Expo lint và export Android/iOS thành công trong môi trường triển khai. Không có adb/emulator hay hạ tầng UI/E2E trong repository; chưa xác nhận giao diện trên điện thoại thật và chưa tạo APK/EAS build. Checklist thủ công bổ sung ở `docs/ANDROID-QA.md` phải được thực hiện trước phát hành. Database trên điện thoại của người dùng không truy cập được trong môi trường này; kiểm tra migration dùng SQLite thử nghiệm chứa dữ liệu đại diện, không giả nhận là đã kiểm tra sổ thật trên thiết bị.

Ứng dụng chưa có ngân sách, tài sản ròng, đa tiền tệ, nhiều người dùng hay đồng bộ cloud; không thêm cơ chế giả cho những phần đó. Cơ chế khóa sinh trắc học/mã khóa sẵn có tiếp tục bao quanh toàn bộ ứng dụng. Các cảnh báo Node về experimental type stripping/module type và NO_COLOR của Metro đã tồn tại, không phải lỗi test.
