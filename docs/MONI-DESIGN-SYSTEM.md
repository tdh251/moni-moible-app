# Moni — UI/UX redesign và design system

Ngày thực hiện: 24/11/2026. Nền tảng: Expo SDK 58, React Native 0.88, React 19.3, Expo Router.

## Phạm vi và tham chiếu

Đã triển khai trực tiếp trong ứng dụng mobile, gồm màn chính, màn chi tiết, biểu mẫu, bộ lọc, trình chọn, xác nhận và các trạng thái dùng chung. Các route và nghiệp vụ hiện hữu được giữ lại. Những thay đổi Thu chi hộ và Công nợ đã có trong workspace trước redesign tiếp tục được bảo toàn.

Đã xem đủ 6 ảnh PNG tại `D:\du-an-ca-nhan\ui-moni-app`:

| Ảnh | Nội dung tham chiếu |
| --- | --- |
| `71b17b86-cf19-4572-ae70-b42d09d282e9.png` | Tổng quan, số dư, tài khoản |
| `04c75e8c-940d-4f24-81e0-14fff60cd532.png` | Danh sách giao dịch, kỳ, tìm kiếm |
| `41c3fd84-1051-479f-80ee-77ffaa74f141.png` | Biểu mẫu giao dịch |
| `c3418384-f0a8-4397-bb48-965077ab670b.png` | Khoản vay, tổng nợ, trạng thái |
| `d333ecdd-e002-4b41-9f81-e7794fa41cb2.png` | Chi tiết khoản vay |
| `5c00039e-c02c-497d-8ff8-e122536fb627.png` | Thống kê, biểu đồ, danh mục |

Áp dụng nền mint nhẹ ở góc phải, hero Forest Green, bề mặt trắng, icon pastel, số tiền căn phải và thanh tab bo tròn. Bố cục được làm gọn hơn ảnh tham chiếu theo yêu cầu trong tài liệu. Không sao chép số tiền, tên tài khoản hoặc ngày tháng trong ảnh vào dữ liệu sản phẩm. Tab vẫn mang tên **Công nợ**, bao gồm khoản vay, mua hộ và liên kết Thu chi hộ hiện hữu.

## Design system

Nguồn token: `src/theme/index.ts`. Dùng font hệ thống để giữ hỗ trợ tiếng Việt, font scaling và hiệu năng; không thêm dependency hoặc tải font ngoài.

| Nhóm | Token / giá trị chính |
| --- | --- |
| Thương hiệu | `primary #16765D`, `light #E2F1E8`, `brandMuted #F0F7F3` |
| Hero | `heroStart #1C6C55`, `heroMiddle #145B46`, `heroEnd #0D3D30` |
| Bề mặt | `background #F5F7F5`, `card #FFFFFF`, `surfaceSecondary #EEF2EF` |
| Chữ | `text #1D2D25`, `muted #5D6D64`, `placeholder #69786F` |
| Chữ trên hero | `onDark #F7FCF9`, `onDarkMuted #D6E9DE` |
| Thu / chi | `income #147455`, `expense #AA4B39`, kèm nền semantic nhạt |
| Chuyển tiền | `transfer #4F6888`, `transferLight #EBF0F7` |
| Cảnh báo / nguy hiểm | `warning #875A18`, `danger #B63636`, kèm nền semantic nhạt |
| Typography | Page 28/36, detail 23/30, section 18/26, card 16/24, body 15/22, label 13/20, caption 12/18 |
| Số tiền | Thường 18/26; hero 34/44, 28 trên màn hẹp; tabular numerals |
| Spacing | 4, 8, 12, 16, 20, 24, 32, 40 |
| Radius | Icon 12, input/button 14, card 18, hero 26, sheet 28 |
| Elevation | Shadow nhẹ cho card, hero, FAB và sheet; không tạo nhiều lớp card lồng nhau |
| Layout | Lề màn hình 16; content tối đa 720; touch target chung 48; chips/segment tối thiểu 44 |

Ứng dụng hiện dùng light mode. Không thêm chế độ tối khi chưa có toàn bộ bảng màu và kiểm thử cho chế độ đó. Token semantic giúp mở rộng về sau. Splash native tiếp tục dùng tài sản thương hiệu và cấu hình hiện có; không thay đổi cấu hình build, định danh ứng dụng hoặc môi trường.

## Thành phần dùng lại

| Thành phần | Vai trò |
| --- | --- |
| `ScreenContainer`, `AppHeader`, `ScreenBackdrop` | Header gọn, nền mint, safe area, tránh bàn phím, footer hành động |
| `AppCard`, `SectionHeader` | Phân nhóm nội dung và hành động phụ |
| `HeroCard`, `SummaryCard`, `AccountRow`, `MoneyRow` | Hiển thị số liệu thật với phân cấp và căn tiền thống nhất |
| `Field`, `SearchField`, `AmountInput` | Focus/error/hint, tìm kiếm compact, nhập tiền nổi bật |
| `PrimaryButton`, `SecondaryButton`, `FormActions` | Pressed, disabled, loading; lưu cố định ở footer |
| `StatusBadge`, `ProgressBar` | Trạng thái có nhãn và tiến độ có thông tin accessibility |
| `Disclosure` | Thu gọn trường phụ; giữ component con mounted để bảo toàn giá trị đang nhập |
| `BottomSheet`, `Dropdown`, `ActionMenu` | Trình chọn, tìm kiếm, danh sách ảo hóa và hành động trong sheet |
| `ConfirmationProvider` | Xác nhận theo theme, trả về Promise như hợp đồng hiện hữu, hỗ trợ hủy/Back |
| `EmptyState`, `LoadingState` | Empty state gọn và skeleton tĩnh; không hiển thị số tiền giả |

Thông báo lỗi/thành công, yêu cầu quyền, sinh trắc học và date picker native tiếp tục dùng giao diện nền tảng. Không thêm luồng đăng ký/đăng nhập tài khoản hoặc chức năng cloud giả.

## Bao phủ màn hình

| Màn / route | Thay đổi trình bày |
| --- | --- |
| Tổng quan | Hero số dư thật, giữ hành vi nhấn giữ mắt để xem khi đang ẩn tiền; lối ghi giao dịch/chuyển nội bộ; tài khoản; tổng thu chi tháng; công nợ và giao dịch gần đây |
| Giao dịch | Header compact, tìm kiếm có icon, điều hướng kỳ, filter sheet, hàng giao dịch dạng card; giữ đủ tab đã ghi/bản nháp/thu chi hộ |
| Giao dịch mới / sửa / mở nháp | Số tiền trước, tài khoản tiếp theo; thông tin phụ mở rộng; giữ hóa đơn nhiều mục, phân loại, điều chỉnh, tag và cờ không tính số dư |
| Chi tiết giao dịch | Phần đầu kiểu biên nhận, icon danh mục, số tiền, nhãn loại; thông tin và hành động hiện hữu giữ nguyên |
| Danh sách bản nháp | Nhãn trạng thái rõ, menu thao tác và các giá trị nháp hiện hữu |
| Công nợ / thêm công nợ | Tổng cần thu/cần trả, breakdown thật, tìm kiếm, loại công nợ mở rộng, trạng thái có nhãn; chooser hiện hữu dùng component mới |
| Chi tiết vay / cho vay | Hero còn nợ/cần thu, tiến độ đúng tổng hiện hữu, tiền gốc/phí/tổng, thông tin khoản vay và nút thanh toán |
| Vay / cho vay / trả nợ / thu hồi | Tiền nổi bật, người liên quan, tài khoản, ngày/ghi chú và kỳ hạn/chi phí thu gọn; lịch nhắc và guard giữ nguyên |
| Lịch sử trả nợ / thu hồi | Nhóm danh sách trong một card; tổng tiền và phí căn phải, giữ xác nhận xóa |
| Mua hộ: danh sách / tạo / sửa / hoàn / chi tiết | Hero số còn chờ, badge, tìm kiếm, tiền trước, nhóm ngày/ghi chú, các route cũ tiếp tục hoạt động |
| Thu chi hộ: danh sách | Hero cần thu và đang giữ hộ, bộ lọc nâng cao thu gọn, tách nhãn trạng thái công việc/tài chính |
| Thu chi hộ: hồ sơ / tạo / sửa | Hero chênh lệch, tổng hợp tài chính, thông tin hồ sơ mở rộng; tạo hồ sơ không bị hiểu là dòng tiền |
| Thu chi hộ: thêm / sửa bút toán | Chọn nghiệp vụ qua dropdown, tiền nổi bật, nhãn phân biệt dòng tiền thật và thu chi cá nhân |
| Thu chi hộ: quyết toán | Hero tiền đang giữ/cần thu, phương thức, xem trước và số dư dự kiến; giữ xác nhận đã thực nhận/thực trả, hoàn tất và chống lưu trùng |
| Lịch sử thu chi hộ | Tìm kiếm, kỳ, tài khoản và hàng bút toán có nhãn rõ |
| Thống kê | Tổng thu/chi, chênh lệch, bộ lọc phụ mở rộng, thanh so sánh mảnh, donut thích ứng số lớn/cỡ chữ, legend và báo cáo tag |
| Tài khoản: danh sách / tạo / chi tiết / đổi tên / số dư đầu | Danh sách ảo hóa, hero tổng và số dư từng ví; biểu mẫu, modal và lịch sử theo theme |
| Danh mục / tag / tạo nhanh trong form | Danh sách, editor, tìm icon/tag, palette, nhãn đã chọn và hành động; giữ kéo thả, lưu trữ, khôi phục, xóa |
| Cá nhân | Nhóm tài chính, hiển thị, bảo mật, backup/restore/CSV và dữ liệu; giữ nguyên các callback và xác nhận gõ để xóa toàn bộ |
| Onboarding | Giới thiệu gọn, nhập tiền mặt/ngân hàng, số tiền nổi bật, nút bắt đầu ở footer |
| Loading / lỗi / không tìm thấy / khóa ứng dụng | Dùng layout, typography, button và trạng thái chung; hành vi xác thực không đổi |

Các file route mỏng tiếp tục gọi cùng form/component; không tạo bản sao giao diện riêng cho màn sửa, mở nháp hay thanh toán.

## Responsive và accessibility đã xử lý trong code

- `responsiveLayout` dùng width và fontScale: chuyển cột tiền/card tổng sang full width khi dưới 390 hoặc fontScale trên 1.3; hero compact khi dưới 360.
- Không đặt `numberOfLines` cho số tiền, không rút gọn giá trị bằng K/M và không tắt font scaling. Số dài có thể xuống dòng để giữ đủ giá trị.
- Tên tài khoản, nội dung giao dịch, tag và nhãn lựa chọn có thể wrap; chip giới hạn theo chiều rộng cha.
- Tab label dùng Text có thể wrap; chiều cao thanh tab tăng theo cỡ chữ lớn và bottom safe area.
- Donut đặt tổng ở giữa khi đủ chỗ. Với tổng lớn hoặc chữ lớn, tổng nằm dưới vòng tròn để không ép vào lỗ giữa.
- Footer biểu mẫu, sheet và nút lưu xử lý safe area/keyboard; danh sách cuộn có padding cho FAB.
- AmountInput giữ raw string và callback hiện hữu; không format lại value giữa lúc gõ để tránh ảnh hưởng caret.
- Giữ reduced motion cho điều hướng, sheet, modal trình chọn, chart và các thành phần chuyển động hiện hữu.
- Nút có role, label và trạng thái; badge có chữ, không biểu diễn trạng thái chỉ bằng màu.

Đây là các thay đổi trong triển khai. Các mục trên chưa được xác minh bằng ảnh chụp giao diện chạy trên thiết bị.

## Kiểm tra đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Baseline trước redesign | TypeScript và lint đạt; 166/166 test nghiệp vụ đạt |
| `npx tsc --noEmit` | Đạt |
| `npx expo lint --no-cache -- --cache-location .expo/cache/eslint/redesign-final` | Đạt, không lỗi/cảnh báo lint |
| `npm test` | 169/169 đạt: 166 test tài chính hiện hữu và 3 test design system |
| Android export | Đạt; `.expo/redesign-android`, Hermes bundle ~5.3 MB |
| iOS export | Đạt; `.expo/redesign-ios`, Hermes bundle ~5.1 MB |
| SHA-256 so với baseline | 34/34 tệp được bảo vệ giữ nguyên, không có tệp lệch hash |

Test mới tại `tests/ui-design.test.mjs` kiểm tra tương phản chữ thông thường trên các cặp token đang dùng, chữ trên các điểm màu gradient đạt tối thiểu 4.5:1; và chính sách responsive tại 320/360/375/390/412/430 với fontScale 1, 1.5, 2. Test này không đo pixel, layout thực tế hoặc xác nhận toàn ứng dụng đạt WCAG.

Export là kiểm tra biên dịch bundle, không phải APK/IPA đã ký hoặc kết quả chạy trên thiết bị.

## Bảo toàn nghiệp vụ và dữ liệu

Snapshot SHA-256 được lấy trước redesign cho các tệp hiện hữu trong `src/services`, `src/database`, `src/types`, các test nghiệp vụ, `src/hooks/finance.tsx` và `src/stores/preferences.ts`. Sau triển khai, cả 34 tệp trong snapshot giữ nguyên byte.

Không thêm migration, không đổi schema, quy tắc số dư, công nợ, phân bổ hóa đơn, quyết toán, backup, restore, CSV, lưu nháp, ngày giờ hoặc xác thực trong đợt redesign. Không sửa database thật và không đưa dữ liệu mẫu vào nguồn sản phẩm. Các số trên dashboard/chart tiếp tục lấy từ service hiện hữu. Các handler lưu/xóa, xác nhận và guard tài chính tiếp tục được sử dụng.

Workspace đã có thay đổi chưa commit khi bắt đầu. Không hoàn tác các thay đổi trước đó; vì vậy `git diff` so với HEAD còn bao gồm tính năng Công nợ/Thu chi hộ của các bước trước.

## Kiểm tra trực tiếp còn cần thực hiện

Công cụ computer-use không kết nối được native pipe và không có browser khả dụng trong phiên này. Vì vậy chưa có screenshot thực tế, kiểm tra cảm ứng hoặc nghiệm thu visual trên Android/iOS. Bộ ảnh tham chiếu đã được xem; không coi đó là ảnh chụp bản build mới.

Checklist đầy đủ được bổ sung trong `docs/ANDROID-QA.md`. Cần chạy các luồng tại 320/360/375/390/412/430, font 100/150/200%, bàn phím mở, giá trị `999.999.999.999 ₫`, tên tiếng Việt dài; kiểm tra bấm/Back/modal, caret, giữ mắt, kéo danh mục, sinh trắc học và vòng đời ứng dụng. Không đánh dấu các mục này đạt trước khi chạy thực tế. Chất lượng trực quan cuối cùng vẫn cần bước nghiệm thu đó.

## Tệp triển khai chính

- `src/theme/{index,responsive}.ts`, `src/hooks/useResponsiveLayout.ts`.
- `src/components/ui/{index,primitives,BottomSheet,Dropdown,ActionMenu,ConfirmationProvider,confirmation,FormActions,SegmentedControl,FloatingActionButton}.tsx/ts`, `src/components/PeriodFilter.tsx`.
- Các màn chính trong `src/app/(tabs)`, layout root, onboarding, accounts và các màn chi tiết transaction/loan/purchase/third-party.
- Biểu mẫu/danh sách trong `src/features/{transactions,loans,debts,purchases,third-party,categories,tags,statistics}`.
- `tests/ui-design.test.mjs`, script test trong `package.json` và checklist QA.

Tài liệu API đã đối chiếu: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo docs index](https://docs.expo.dev/llms.txt), [Expo Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [React Navigation bottom tabs](https://reactnavigation.org/docs/bottom-tab-navigator/), [React Native TextInput](https://reactnative.dev/docs/textinput).
