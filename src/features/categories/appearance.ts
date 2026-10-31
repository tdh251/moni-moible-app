import type Ionicons from '@expo/vector-icons/Ionicons';

type CategoryIconName = keyof typeof Ionicons.glyphMap;
interface IconGroup {
  name: string;
  icons: { name: CategoryIconName; label: string }[];
}
export const categoryIconGroups: IconGroup[] = [
  {
    name: 'Ăn uống',
    icons: [
      { name: 'restaurant-outline', label: 'Ăn uống' },
      { name: 'cafe-outline', label: 'Cà phê' },
      { name: 'fast-food-outline', label: 'Đồ ăn nhanh' },
      { name: 'pizza-outline', label: 'Pizza' },
      { name: 'beer-outline', label: 'Bia' },
      { name: 'wine-outline', label: 'Rượu' },
      { name: 'ice-cream-outline', label: 'Kem' },
      { name: 'nutrition-outline', label: 'Rau củ thực phẩm' },
    ],
  },
  {
    name: 'Mua sắm',
    icons: [
      { name: 'bag-outline', label: 'Túi mua sắm' },
      { name: 'basket-outline', label: 'Giỏ siêu thị' },
      { name: 'cart-outline', label: 'Xe đẩy mua hàng' },
      { name: 'storefront-outline', label: 'Cửa hàng Shopee' },
      { name: 'shirt-outline', label: 'Áo quần thời trang' },
      { name: 'glasses-outline', label: 'Kính mắt' },
      { name: 'watch-outline', label: 'Đồng hồ' },
      { name: 'diamond-outline', label: 'Trang sức' },
    ],
  },
  {
    name: 'Nhà cửa',
    icons: [
      { name: 'home-outline', label: 'Nhà cửa' },
      { name: 'bed-outline', label: 'Giường phòng ngủ' },
      { name: 'tv-outline', label: 'Tivi' },
      { name: 'bulb-outline', label: 'Đèn điện' },
      { name: 'water-outline', label: 'Tiền nước' },
      { name: 'flame-outline', label: 'Bếp gas' },
      { name: 'hammer-outline', label: 'Sửa chữa' },
      { name: 'construct-outline', label: 'Dụng cụ gia dụng' },
    ],
  },
  {
    name: 'Di chuyển',
    icons: [
      { name: 'bus-outline', label: 'Xe buýt' },
      { name: 'car-outline', label: 'Ô tô taxi' },
      { name: 'bicycle-outline', label: 'Xe đạp' },
      { name: 'walk-outline', label: 'Đi bộ' },
      { name: 'train-outline', label: 'Tàu hỏa' },
      { name: 'subway-outline', label: 'Tàu điện metro' },
      { name: 'boat-outline', label: 'Tàu thuyền' },
      { name: 'airplane-outline', label: 'Máy bay vé bay' },
    ],
  },
  {
    name: 'Sức khỏe',
    icons: [
      { name: 'medkit-outline', label: 'Y tế thuốc' },
      { name: 'medical-outline', label: 'Bệnh viện khám bệnh' },
      { name: 'fitness-outline', label: 'Sức khỏe' },
      { name: 'heart-outline', label: 'Trái tim' },
      { name: 'pulse-outline', label: 'Nhịp tim' },
      { name: 'bandage-outline', label: 'Băng y tế' },
      { name: 'thermometer-outline', label: 'Nhiệt kế' },
      { name: 'barbell-outline', label: 'Tập gym thể hình' },
    ],
  },
  {
    name: 'Học tập',
    icons: [
      { name: 'school-outline', label: 'Trường học học phí' },
      { name: 'book-outline', label: 'Sách' },
      { name: 'library-outline', label: 'Thư viện' },
      { name: 'pencil-outline', label: 'Bút văn phòng phẩm' },
      { name: 'calculator-outline', label: 'Máy tính cầm tay' },
      { name: 'language-outline', label: 'Ngoại ngữ' },
      { name: 'desktop-outline', label: 'Máy tính để bàn' },
      { name: 'laptop-outline', label: 'Laptop' },
    ],
  },
  {
    name: 'Giải trí',
    icons: [
      { name: 'game-controller-outline', label: 'Chơi game' },
      { name: 'musical-notes-outline', label: 'Âm nhạc' },
      { name: 'headset-outline', label: 'Tai nghe' },
      { name: 'film-outline', label: 'Phim ảnh' },
      { name: 'ticket-outline', label: 'Vé sự kiện' },
      { name: 'camera-outline', label: 'Chụp ảnh' },
      { name: 'football-outline', label: 'Bóng đá thể thao' },
      { name: 'color-palette-outline', label: 'Hội họa nghệ thuật' },
    ],
  },
  {
    name: 'Du lịch',
    icons: [
      { name: 'map-outline', label: 'Bản đồ du lịch' },
      { name: 'compass-outline', label: 'La bàn khám phá' },
      { name: 'location-outline', label: 'Địa điểm' },
      { name: 'earth-outline', label: 'Quốc tế' },
      { name: 'sunny-outline', label: 'Nắng biển nghỉ dưỡng' },
      { name: 'umbrella-outline', label: 'Ô dù' },
      { name: 'snow-outline', label: 'Tuyết mùa đông' },
      { name: 'trail-sign-outline', label: 'Dã ngoại cắm trại' },
    ],
  },
  {
    name: 'Gia đình',
    icons: [
      { name: 'people-outline', label: 'Gia đình bạn bè' },
      { name: 'person-outline', label: 'Cá nhân' },
      { name: 'happy-outline', label: 'Trẻ em' },
      { name: 'paw-outline', label: 'Thú cưng' },
      { name: 'flower-outline', label: 'Hoa làm đẹp' },
      { name: 'leaf-outline', label: 'Cây xanh' },
      { name: 'ribbon-outline', label: 'Kỷ niệm' },
      { name: 'balloon-outline', label: 'Sinh nhật tiệc' },
    ],
  },
  {
    name: 'Tài chính',
    icons: [
      { name: 'wallet-outline', label: 'Ví tiền' },
      { name: 'cash-outline', label: 'Tiền mặt thu nhập' },
      { name: 'card-outline', label: 'Thẻ ngân hàng' },
      { name: 'business-outline', label: 'Ngân hàng' },
      { name: 'trending-up-outline', label: 'Đầu tư chứng khoán' },
      { name: 'pie-chart-outline', label: 'Tiết kiệm ngân sách' },
      { name: 'receipt-outline', label: 'Hóa đơn' },
      { name: 'gift-outline', label: 'Quà tặng tiền thưởng' },
    ],
  },
  {
    name: 'Công việc',
    icons: [
      { name: 'briefcase-outline', label: 'Công việc tiền lương' },
      { name: 'calendar-outline', label: 'Lịch công tác' },
      { name: 'time-outline', label: 'Thời gian' },
      { name: 'call-outline', label: 'Điện thoại' },
      { name: 'mail-outline', label: 'Thư bưu điện' },
      { name: 'print-outline', label: 'In ấn' },
      { name: 'cloud-outline', label: 'Dịch vụ lưu trữ' },
      { name: 'code-slash-outline', label: 'Phần mềm công nghệ' },
    ],
  },
  {
    name: 'Khác',
    icons: [
      { name: 'ellipsis-horizontal-outline', label: 'Khác' },
      { name: 'star-outline', label: 'Ngôi sao' },
      { name: 'sparkles-outline', label: 'Lấp lánh' },
      { name: 'trophy-outline', label: 'Giải thưởng' },
      { name: 'key-outline', label: 'Chìa khóa thuê nhà' },
      { name: 'shield-checkmark-outline', label: 'Bảo hiểm' },
      { name: 'cube-outline', label: 'Đồ vật kiện hàng' },
      { name: 'extension-puzzle-outline', label: 'Sở thích' },
    ],
  },
];

export const categoryPalette = [
  { color: '#287D68', label: 'Xanh ngọc' },
  { color: '#729B84', label: 'Xanh lá dịu' },
  { color: '#7C9470', label: 'Xanh ô liu' },
  { color: '#15803D', label: 'Xanh lá đậm' },
  { color: '#16A34A', label: 'Xanh lá tươi' },
  { color: '#65A30D', label: 'Xanh mạ' },
  { color: '#0D9488', label: 'Xanh ngọc sáng' },
  { color: '#0E7490', label: 'Xanh cổ vịt' },
  { color: '#648DAB', label: 'Xanh trời dịu' },
  { color: '#0284C7', label: 'Xanh biển' },
  { color: '#2563EB', label: 'Xanh dương' },
  { color: '#1E40AF', label: 'Xanh dương đậm' },
  { color: '#4F46E5', label: 'Chàm' },
  { color: '#7C3AED', label: 'Tím violet' },
  { color: '#9333EA', label: 'Tím tươi' },
  { color: '#9B7FA7', label: 'Tím dịu' },
  { color: '#A21CAF', label: 'Tím hồng' },
  { color: '#DB2777', label: 'Hồng sen' },
  { color: '#E11D48', label: 'Hồng đỏ' },
  { color: '#C4868D', label: 'Hồng đất' },
  { color: '#B76553', label: 'Cam đất' },
  { color: '#DC2626', label: 'Đỏ' },
  { color: '#9F1239', label: 'Đỏ rượu' },
  { color: '#EA580C', label: 'Cam đậm' },
  { color: '#F97316', label: 'Cam tươi' },
  { color: '#D97706', label: 'Hổ phách' },
  { color: '#D4A457', label: 'Vàng cát' },
  { color: '#CA8A04', label: 'Vàng nghệ' },
  { color: '#854D0E', label: 'Nâu vàng' },
  { color: '#92400E', label: 'Nâu gỗ' },
  { color: '#78350F', label: 'Nâu cà phê' },
  { color: '#829187', label: 'Xám xanh' },
  { color: '#64748B', label: 'Xám đá' },
  { color: '#475569', label: 'Xám đậm' },
  { color: '#19382C', label: 'Xanh rêu đậm' },
  { color: '#334155', label: 'Than chì' },
];

export function normalizeIconSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi-VN')
    .trim();
}
