# Moni

Ứng dụng Android quản lý tài chính cá nhân bằng tiếng Việt, Expo SDK 58 + React Native 0.88 + TypeScript strict + Expo Router. Dữ liệu ngoại tuyến trong `expo-sqlite`, không cần đăng nhập. Không có giao dịch hoặc số dư mẫu.

## Chạy trên Android

Cần Node.js 24 trở lên (test dùng `node:sqlite`), npm và điện thoại Android. Cài dependency bằng `npm ci` khi checkout mới; mọi thư viện mới phải thêm bằng `npx expo install` để giữ tương thích SDK.

```sh
npm ci
npx expo start
```

Dùng Expo Go tương thích **SDK 58** để quét QR khi runtime có đủ các module. Nếu Expo Go không hỗ trợ đúng SDK/module, dùng APK preview bên dưới hoặc development build. Điện thoại và máy chạy Metro cần kết nối được với nhau. Mã nguồn chỉ có một routing root: `src/app/`.

```sh
npm run typecheck
npm run lint
npm test
# Cả ba bước:
npm run check
# Kiểm tra SDK/config:
npx expo-doctor
# Kiểm tra đóng gói Android (không tạo APK):
npx expo export --platform android
```

Có thể dùng `npx expo start --offline` nếu dependency đã có và không cần truy cập mạng. `npm run android` yêu cầu Android SDK/adb/emulator hoặc thiết bị kết nối qua adb trên máy phát triển.

## Tạo APK cài trực tiếp

`app.json`: Moni – Sổ chi tiêu cá nhân, package minh họa `com.monomoney.personal`, version 1.0.0, versionCode 1. Đổi package sang định danh thuộc sở hữu của bạn trước phát hành Play Store. Icon/splash chữ M nằm trong `assets/brand/`; có script tạo lại trên Windows `scripts/create-brand-assets.ps1`.

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

Khi EAS hỏi, chọn/tạo project Expo của bạn và cho EAS tạo Android keystore. Bước liên kết sẽ bổ sung `extra.eas.projectId` vào cấu hình. Profile `preview` đã dùng `distribution: internal` và `android.buildType: apk`. Tải APK từ đường dẫn của build thành công, mở trên Android và cho phép cài từ nguồn đó. APK preview chạy độc lập, không cần Metro.

```sh
# AAB cho Play Store trong tương lai:
npx eas-cli@latest build --platform android --profile production
```

Để làm development build, trước hết cài module bằng `npx expo install expo-dev-client`, rồi chạy `npx eas-cli@latest build --platform android --profile development`; sau khi cài APK chạy `npx expo start --dev-client`. Không cần tạo/sửa `android/` hoặc `ios/` bằng tay.

**Chưa có APK được build trong phiên triển khai này.** Chưa có đăng nhập/liên kết project EAS và máy không có adb/emulator. Kiểm thử UI Android thực tế theo [checklist](docs/ANDROID-QA.md) trước phát hành.

## Chức năng

- Onboarding: một ví Tiền mặt, tùy chọn nhiều ngân hàng, số dư ban đầu từ 0; lưu trạng thái thiết lập.
- Bốn tab Tổng quan / Giao dịch / Thống kê / Cá nhân; giao diện Minimal Soft, VND, safe areas và bộ chọn ngày/giờ gốc.
- Thêm/đổi tên ngân hàng, xem số dư và lịch sử riêng, lưu trữ/khôi phục ngân hàng có số dư 0. Không xóa tài khoản có lịch sử. Thay số dư ban đầu có luồng riêng và xác nhận.
- Thu tiền, Chi tiền, Chuyển nội bộ; chi đơn giản hoặc hóa đơn nhiều mục, mỗi mục một danh mục phẳng. Chỉnh sửa/xóa và tính lại tác động tài chính.
- Lịch sử nhóm ngày, tìm tiêu đề/ghi chú; lọc loại, tài khoản, danh mục và ngày/tháng/quý/năm. Bộ lọc tài khoản chứa cả hai phía của giao dịch chuyển.
- Dashboard số dư thật, thu chi tháng được chọn, thao tác nhanh, giao dịch gần nhất. Thống kê có cùng kỳ/tài khoản cho tất cả tổng tiền và biểu đồ; thanh thu/chi, donut SVG, danh mục và phần trăm.
- Danh mục thu/chi một cấp: thêm, chỉnh tên/icon/màu, lưu trữ/khôi phục; tham chiếu lịch sử được giữ nguyên.
- Ẩn tiền; khóa ứng dụng tùy chọn bằng sinh trắc học/mã khóa Android, lưu tùy chọn nhỏ trong SecureStore. Khóa lại khi app vào nền.
- JSON sao lưu/khôi phục nguyên tử; xuất CSV qua Android Sharesheet; khôi phục danh mục mặc định có xác nhận; xóa sổ yêu cầu gõ `XÓA TOÀN BỘ` và xác nhận tiếp.
- Cloud luôn hiển thị `Chưa thiết lập`; không có login hay đồng bộ giả.

## Dữ liệu và kiến trúc

- `src/database/migrations.ts`: schema v2; `accounts`, `categories`, `transactions`, `transaction_items`, `settings`. Không có phân cấp danh mục hoặc bảng tổng số dư.
- `accounts`: loại cash/bank, số dư ban đầu, cờ lưu trữ và mốc thời gian. Unique partial index bảo đảm tối đa một ví tiền mặt.
- `categories`: loại income/expense, icon, màu, thứ tự, cờ lưu trữ. Không xóa danh mục được tham chiếu.
- `transactions`: loại, tiêu đề, tiền, tài khoản nguồn/nhận, danh mục, ghi chú, thời điểm phát sinh/tạo/sửa. Chuyển nội bộ không có danh mục; hóa đơn nhiều mục dùng danh mục ở từng mục.
- `transaction_items`: tham chiếu hóa đơn, tên, tiền, danh mục, thứ tự. Khóa ngoại giao dịch có cascade để xóa các mục nguyên tử.
- `settings`: trạng thái onboarding. `PRAGMA user_version` quản lý schema, độc lập với version bản sao lưu.
- `src/database/client.ts`: một kết nối riêng, WAL, foreign_keys ON và busy timeout trước BEGIN. `FinanceRepository` tuần tự hóa **mọi** truy vấn, đọc/ghi trong SQL transaction trên chính kết nối đó. Không query database trực tiếp từ UI.
- `src/services/accounting/ledger.ts`: kiểm tra nghiệp vụ và tính số dư/thống kê dùng chung. Snapshot React chỉ là ảnh đọc lại từ SQLite sau mutation, không phải sổ tài chính độc lập. Zustand chỉ giữ tùy chọn và bộ lọc UI.
- ID mới dùng UUID qua `expo-crypto`. Danh mục mặc định có ID ổn định. Dữ liệu thời gian lưu UTC ISO 8601 có mili giây (`Z`); hiển thị và ranh giới kỳ theo múi giờ thiết bị.

Migration mới phải tăng `SCHEMA_VERSION`, giữ nguyên migration cũ và thêm bước tuần tự trong cùng transaction. Không drop/recreate bảng tài chính để nâng cấp. Database mới tạo migration v1 và danh mục mặc định; không tự tạo số dư/giao dịch. Database có version cao hơn bị từ chối thay vì cố đọc sai schema.

## Quy tắc kế toán

Hóa đơn nhiều mục hỗ trợ tối đa 20 dòng điều chỉnh tùy tên (Chiết khấu, Thuế, Phụ phí...), nhập tỷ lệ âm hoặc dương từ -100% đến +100%, tối đa 2 chữ số thập phân. Mỗi dòng tính trên cùng **tạm tính ban đầu**, không tính lũy tiến. Ví dụ tạm tính 1.000.000 VND, Chiết khấu -5% và Thuế -5% cho tổng thanh toán 900.000 VND; đổi Thuế thành +5% thì tổng là 1.000.000 VND. Từng dòng được làm tròn đến VND gần nhất, nửa đồng làm tròn ra xa 0. Tổng cuối phải lớn hơn 0.

`transactions.adjustments_json` lưu danh sách `{id,name,rate_bps}`; `-500` basis points nghĩa là -5%. Giá gốc từng mục được giữ nguyên; số dư trừ theo tổng sau điều chỉnh. Thống kê phân bổ tổng cuối theo tỷ trọng giá gốc từng mục, dùng phương pháp phần dư lớn nhất để tổng danh mục khớp tuyệt đối từng VND. Khi đổi về chi đơn giản, giữ tổng sau điều chỉnh và bỏ metadata điều chỉnh khi lưu; bản nháp vẫn còn khi đang ở form.

Migration v2 chỉ thêm cột này với mặc định `[]`, giữ nguyên mọi giao dịch cũ. Backup mới dùng version 2; vẫn nhập được version 1. Tên hiển thị đã đổi thành **Moni**, icon chữ H; package Android, deep-link scheme, tên database và định danh `format: monomoney` giữ nguyên để cập nhật trên bản cũ mà không tạo một sổ mới. Dashboard hiển thị tài khoản ngay dưới thẻ tổng số dư, trước các nút ghi giao dịch.

Số dư = số dư ban đầu + tiền vào - tiền ra. Thu cộng tài khoản nhận; chi trừ tài khoản nguồn; chuyển trừ nguồn và cộng đích cùng số tiền. Số dư ban đầu và chuyển nội bộ không tính vào thu/chi. Hóa đơn bị trừ một lần theo tổng; thống kê danh mục dùng tiền của từng mục.

Tiền được lưu dưới dạng INTEGER VND trong giới hạn số nguyên an toàn JavaScript. Nhập tiền chỉ nhận chữ số, không dấu phân cách. Giao dịch phải dương; số dư ban đầu được bằng 0. Tổng tiền cũng được kiểm tra tránh tràn số.

Chính sách số dư: số dư ban đầu tồn tại trước giao dịch đầu tiên. Replay **toàn bộ** giao dịch theo `occurred_at`, `created_at`, rồi `id`; số dư mọi tài khoản không được âm ở bất kỳ bước nào. Hai giao dịch cùng thời điểm dùng thứ tự ổn định này; nếu cần thay đổi thứ tự thực tế hãy sửa giờ phát sinh. Kiểm tra này chạy cả khi thêm lùi ngày, sửa, xóa và đổi số dư ban đầu. Xóa khoản thu đã dùng cho chi sau có thể bị từ chối. Giao dịch có ngày tương lai cũng được tính trong sổ hiện tại; v1 chưa có giao dịch dự kiến tách riêng.

Tài khoản/danh mục lưu trữ vẫn hợp lệ trong lịch sử. Tạo hoặc sửa giao dịch yêu cầu chọn tham chiếu đang hoạt động. Tổng tài sản bao gồm mọi tài khoản, kể cả tài khoản lưu trữ; nếu sửa lịch sử làm tài khoản đã lưu trữ có tiền trở lại, hãy khôi phục tài khoản để sử dụng.

Chuyển hóa đơn nhiều mục về chi đơn giản yêu cầu xác nhận, giữ tổng và chọn một danh mục. Bản nháp mục chi giữ trong bộ nhớ khi còn ở form; chỉ mode đang hiển thị được lưu. Thoát form/đưa app khóa có thể bỏ bản nháp chưa lưu.

## Sao lưu

Cá nhân → Sao lưu & khôi phục → Xuất bản sao lưu, lưu tệp qua trình chia sẻ Android. Khi nhập, chọn JSON hợp lệ, xem số tài khoản/giao dịch và xác nhận thay thế. Mọi dữ liệu được kiểm tra trước, ghi cùng một transaction; lỗi giữa chừng rollback toàn bộ. [Định dạng/version và CSV](docs/BACKUP-FORMAT.md).

JSON gồm toàn bộ dữ liệu tài chính và onboarding, không gồm cài đặt sinh trắc học/hiển thị riêng của thiết bị. SQLite và JSON/CSV không mã hóa. Khóa app là khóa giao diện, không phải mã hóa database. Android OS auto-backup bị tắt; người dùng cần xuất bản sao lưu riêng, đặc biệt trước khi gỡ ứng dụng/xóa dữ liệu thiết bị.

## Kiểm thử và giới hạn

`tests/finance.test.mjs` chạy cùng migration, repository, validator và kế toán với ứng dụng qua SQLite thật của Node. Bao gồm thu/chi/chuyển, hóa đơn, sửa/xóa, tham chiếu lưu trữ, số dư lịch sử, lọc, migration lặp lại, đóng/mở tệp database, kiểm tra backup và rollback khi cố tình gây lỗi giữa restore. Chưa có test UI tự động trên Android.

Sổ được đọc vào bộ nhớ và replay khi mutation; phù hợp sổ cá nhân, chưa tối ưu cho hàng trăm nghìn giao dịch. Web không thuộc phạm vi bàn giao và chưa cấu hình WASM/headers SQLite cho trình duyệt. Android là nền tảng kiểm thử cần hoàn thành; iOS chưa kiểm thử. Chưa có đồng bộ Supabase, mã hóa database/backup, lịch giao dịch dự kiến, nhiều tiền tệ hay khóa PIN riêng.

`npm audit` hiện báo 6 cảnh báo high liên quan chuỗi Expo CLI (`node-forge`, `zod` và package phụ thuộc). Gợi ý tự động hạ Expo về 44 không phù hợp SDK 58; không chạy `audit fix --force`. Cần theo dõi bản vá tương thích của Expo trước phát hành; ứng dụng không dùng các gói CLI này để xử lý sổ tiền khi chạy trên điện thoại.

## Supabase trong giai đoạn sau

Giữ SQLite là nguồn dữ liệu ngoại tuyến. Thêm Supabase auth thật, RLS theo user, outbox thay đổi, tombstone cho xóa và version để phát hiện xung đột. Đồng bộ account/category trước transaction/item; kiểm tra trọn ledger và commit nguyên tử khi áp dụng dữ liệu từ server. Token nhỏ lưu SecureStore. Cần thiết kế giải quyết xung đột tài chính và sao lưu trước khi bật Cloud, không ghi đè âm thầm các giao dịch địa phương.

Báo cáo tệp thay đổi, lệnh và kết quả: [IMPLEMENTATION-REPORT](docs/IMPLEMENTATION-REPORT.md). Tài liệu API đã đối chiếu: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [SQLite SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/), [EAS APK](https://docs.expo.dev/build-reference/apk/).

## Tiếp tục kiểm thử trên thiết bị

Prompt Codex tiếp theo khi đã có Android/EAS:

> Tiếp tục Moni tại workspace này. Đọc README.md, IMPLEMENTATION.md và docs/ANDROID-QA.md. Chạy npm run check và expo-doctor, tạo/cài APK preview qua EAS với tài khoản đã đăng nhập, kiểm tra các luồng theo checklist trên Android thật/emulator. Sửa mọi lỗi phát hiện, ghi lại bằng chứng kiểm tra và cập nhật giới hạn; chỉ báo APK thành công khi build thực sự hoàn tất. Không tạo dữ liệu mẫu trong sổ đang dùng.

Bộ lọc lịch sử hỗ trợ dropdown chọn nhiều tài khoản/danh mục và khoảng tổng tiền giao dịch sau điều chỉnh (gồm hai đầu). Các mục cùng nhóm dùng OR, các nhóm kết hợp AND; không chọn là tất cả. Tiêu đề trống dùng danh mục; hóa đơn dùng danh mục có tổng tiền sau phân bổ lớn nhất, hòa chọn mục xuất hiện trước. Nhãn loại giao dịch rút gọn thành Thu/Chi.


Checkbox Không tính vào số dư: lưu `transactions.exclude_from_balance` (0/1); khi 1 bỏ qua cả tiền vào và ra khi replay số dư, vẫn tính thống kê thu/chi và hiện lịch sử. Có thể sửa lại checkbox; mọi thao tác vẫn kiểm tra số dư lịch sử. Migration schema v3 thêm cột mặc định 0, không đổi dữ liệu cũ. Backup xuất v4, nhập được v1–v3 với mặc định tính vào số dư; bản cũ chứa cờ loại trừ sẽ bị từ chối. CSV thêm cột Không tính vào số dư và lịch sử/chi tiết có nhãn nhận biết.
