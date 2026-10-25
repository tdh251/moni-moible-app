# Báo cáo triển khai Moni

Ngày bàn giao: 25/10/2026. Dự án ban đầu là Expo starter SDK 58, có Router/SQLite/SecureStore/Zustand nhưng chưa có nghiệp vụ tài chính. Giữ SDK 58 và một routing root `src/app/`; thay màn hình mẫu bằng ứng dụng.

Cập nhật theo yêu cầu: đổi tên thành Moni (hằng `src/constants/app.ts`), icon M; tài khoản ngay dưới tổng số dư; thêm `ReceiptAdjustments.tsx`, `accounting/receipt.ts`, `accounting/money.ts` cho điều chỉnh tùy tên ±%, tổng thanh toán và phân bổ thống kê. Migration v2 giữ dữ liệu v1; backup v2 đọc được v1; chi tiết và CSV có các dòng điều chỉnh. `npm run check` hiện đạt **44/44 tests**, TypeScript và lint; có test nâng cấp database v1 thật và phục hồi backup v1.

## Tệp tạo hoặc thay đổi

| Nhóm               | Tệp                                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routing, khởi động | `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/onboarding.tsx`                                                                                           |
| Bốn tab            | `src/app/(tabs)/_layout.tsx`, `dashboard.tsx`, `transactions.tsx`, `statistics.tsx`, `settings.tsx`                                                            |
| Tài khoản          | `src/app/accounts/index.tsx`, `new.tsx`, `[id].tsx`                                                                                                            |
| Danh mục           | `src/app/categories/index.tsx`                                                                                                                                 |
| Giao dịch          | `src/app/transaction/new.tsx`, `[id].tsx`, `edit/[id].tsx`, `src/features/transactions/TransactionForm.tsx`                                                    |
| UI và biểu đồ      | `src/components/ui/index.tsx`, `src/components/PeriodFilter.tsx`, `src/features/statistics/Charts.tsx`, `src/theme/index.ts`, `src/utils/format.ts`            |
| Model, dữ liệu     | `src/types/finance.ts`, `src/database/client.ts`, `migrations.ts`, `defaults.ts`, `repository.ts`                                                              |
| Nghiệp vụ          | `src/services/accounting/ledger.ts`, `src/services/backup/validation.ts`, `files.ts`, `src/services/export/csv.ts`                                             |
| Trạng thái         | `src/hooks/finance.tsx`, `src/stores/preferences.ts`; sửa hook starter `src/hooks/use-color-scheme.web.ts` để đạt lint SDK hiện tại                            |
| Kiểm thử           | `tests/finance.test.mjs`                                                                                                                                       |
| Cấu hình           | `package.json`, `package-lock.json`, `app.json`, `eas.json`, `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`                                           |
| Nhận diện          | `assets/brand/icon.png`, `foreground.png`, `monochrome.png`, `scripts/create-brand-assets.ps1`                                                                 |
| Tài liệu           | `README.md`, `IMPLEMENTATION.md`, `docs/BACKUP-FORMAT.md`, `docs/ANDROID-QA.md`, báo cáo này                                                                   |
| Mẫu đã thay thế    | Xóa `src/app/explore.tsx`, `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx`; bỏ npm script reset-project để tránh chạy nhầm script scaffold cũ |

## Chức năng đã triển khai

Onboarding và số dư ban đầu từ 0; cash + nhiều ngân hàng; danh mục phẳng; thu/chi/chuyển nội bộ; hóa đơn nhiều mục; xem/sửa/xóa giao dịch; tài khoản/lịch sử riêng; lưu trữ tài khoản/danh mục; Dashboard dữ liệu thật; lịch sử và bộ lọc; thống kê kỳ/tài khoản, thanh thu chi và donut danh mục; ẩn tiền; khóa sinh trắc học tùy chọn; JSON backup/restore; CSV; khôi phục danh mục mặc định; xóa tài chính với xác nhận mạnh; Cloud chưa thiết lập; icon/splash Moni và profile APK/AAB.

Các thao tác tài chính đi qua repository có hàng đợi và SQL transaction. Kiểm tra toàn bộ lịch sử không âm, không chỉ số dư cuối. Không lưu tổng tài chính độc lập trong Zustand. Backup kiểm tra toàn bộ dữ liệu trước thay thế và rollback khi có lỗi giữa chừng. Form giữ một ID ổn định để chống lưu lại trùng; nếu commit xong nhưng đọc lại lỗi, UI yêu cầu tải lại dữ liệu đã lưu, không ghi lại.

## Lệnh đã thực thi và kết quả

| Lệnh                                                                                                                                                                                   | Kết quả cuối                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npx expo install expo-file-system expo-document-picker expo-sharing expo-local-authentication expo-crypto react-native-svg @expo/vector-icons @react-native-community/datetimepicker` | Đã cài các bản tương thích SDK 58; lượt bị chặn mạng đã chạy lại với quyền mạng được cấp                          |
| `npx expo install eslint eslint-config-expo --dev` và `npx expo install prettier --dev`                                                                                                | Đã cài công cụ kiểm tra/định dạng                                                                                 |
| `npx expo start --offline --port 8085`                                                                                                                                                 | Metro khởi động được, tạo typed routes cho toàn bộ màn hình mới; không có Android để mở app                       |
| `npm run check`                                                                                                                                                                        | Đạt: TypeScript + Expo lint + **44/44 tests**                                                                     |
| `npx expo-doctor`                                                                                                                                                                      | **20/20 kiểm tra đạt**                                                                                            |
| `npx expo install --check` với `EXPO_OFFLINE=1`                                                                                                                                        | Dependency tương thích theo bảng SDK cục bộ; công cụ có lưu ý kiểm tra offline không thay cho kiểm tra trực tuyến |
| `npx expo export --platform android`                                                                                                                                                   | Xuất bundle Android/Hermes vào `dist/` thành công, không phải APK                                                 |
| `git diff --check`                                                                                                                                                                     | Không có lỗi whitespace; có thông báo chuyển LF/CRLF theo Git trên Windows                                        |
| `npm audit --json`                                                                                                                                                                     | Còn 6 cảnh báo high trong chuỗi dependency Expo CLI; xem README. Không áp dụng gợi ý hạ SDK 58 về SDK 44          |
| `powershell -ExecutionPolicy Bypass -File scripts/create-brand-assets.ps1`                                                                                                             | Tạo 3 PNG monogram dùng cho icon/splash                                                                           |
| `npx prettier --write ...`                                                                                                                                                             | Đã định dạng các tệp triển khai                                                                                   |

Các lỗi SQL tham số và lỗi lint/type trong những lượt đầu đã được sửa; không còn lỗi ở lượt `npm run check` cuối. Node báo experimental transform-types và tự nhận ES module cho test; không làm test thất bại.

## Phạm vi bằng chứng kiểm thử

Test dùng **SQLite thật** qua `node:sqlite`, cùng schema và repository với ứng dụng: không phải mock SQL. Có test đóng/mở lại database trên đĩa, FK/cascade, schema mới/lặp lại/version mới hơn, rollback restore có chèn lỗi SQL, mutation đồng thời, sai loại danh mục/tham chiếu, archived references, số dư lùi ngày, tổng hóa đơn và chuyển về đơn giản, các ranh giới kỳ địa phương, lọc tài khoản cả hai chiều, tràn số và CSV formula escaping.

Chưa kiểm thử giao diện, tích hợp `expo-sqlite` native, document picker/sharing và sinh trắc học trên Android. Bundle thành công chỉ xác nhận đóng gói, không chứng minh mọi hành vi native. [Checklist Android](ANDROID-QA.md) cần được thực hiện trên thiết bị.

## Việc chưa làm và blocker

- Chưa tạo APK, chưa cài/chạy Android: môi trường không có adb/emulator; cần điện thoại hoặc emulator và tài khoản/project EAS để build cloud. EAS chưa được đăng nhập/liên kết trong phiên này.
- Supabase chưa triển khai theo phạm vi future phase; không có đồng bộ/login giả.
- Chưa mã hóa database/backup, không có PIN riêng; v1 dùng khóa giao diện qua xác thực hệ điều hành. Web/iOS chưa được kiểm thử; web SQLite chưa cấu hình WASM/headers.
- Cần đánh giá các bản vá dependency Expo CLI trước phát hành. Không tự động đổi major SDK để làm sạch audit.

## Chạy và build tiếp

```sh
npm ci
npx expo start
# Expo Go tương thích SDK 58, hoặc dùng APK preview:
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

Sau build thành công tải/cài APK từ EAS trên Android. Profile preview không cần Metro. Hướng dẫn development build/AAB, schema, backup và prompt tiếp tục nằm trong [README](../README.md).

C?p nh?t ?i?u ch?nh VND: m?i d?ng ch?n % ho?c ti?n nguy?n c? d?u; h? tr? ph?i h?p, s?a v? chuy?n ch? ??, th?ng k? theo t?ng cu?i. Backup xu?t v3, ??c v1/v2; CSV v? chi ti?t th? hi?n ??ng lo?i. Th?m 5 test ki?m tra ti?n c? ??nh, ph?p t?nh k?t h?p, s?a/x?a, d? li?u kh?ng h?p l? v? t??ng th?ch backup. T?ng 44 tests ??t c?ng TypeScript/lint; bundle Android xu?t th?nh c?ng.
