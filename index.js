require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');

process.on('uncaughtException', (err) => console.error('❌ Lỗi nghiêm trọng:', err.message));
process.on('unhandledRejection', (err) => console.error('❌ Lỗi Promise:', err.message));

const token = process.env.BOT_TOKEN || 'MISSING_TOKEN';
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swc';
const claudeApiKey = process.env.CLAUDE_API_KEY || 'MISSING_KEY';

const bot = new TelegramBot(token, {
    polling: token !== 'MISSING_TOKEN' ? {
        params: { allowed_updates: JSON.stringify(["message", "callback_query", "chat_member", "my_chat_member"]) }
    } : false
});
const claude = new Anthropic({ apiKey: claudeApiKey });
bot.on("polling_error", (msg) => console.log("⚠️ Lỗi Polling:", msg.message));
bot.on("error", (msg) => console.log("⚠️ Lỗi chung:", msg.message));

// ==========================================================
// HẰNG SỐ & LIÊN KẾT
// ==========================================================
const ADMIN_ID = process.env.ADMIN_ID || '507318519';
const GROUP_USERNAME = '@swc_capital_chat';

const SWC_FIELD_URL = 'https://swcpass.com/swc-field/';
const SWC_PASS_URL = 'https://swcpass.com/swc-field/#pricing';
const ROAD_1M_URL = 'https://swcpass.com/rm1/';
const ATLAS_URL = 'https://swcpass.com/atlas/';
const VIDEO_MOBILE = 'https://www.youtube.com/watch?v=SEB7RJrutxg';
const VIDEO_PC = 'https://www.youtube.com/watch?v=gy_sxh9WCCM';

const IMG_MAIN = 'https://photos.app.goo.gl/6SC4mNCBawpMfMgj6';
const IMG_PASS = 'https://photos.app.goo.gl/cbECmeni7rhuBAst5';
const IMG_HANG = 'https://photos.app.goo.gl/yZU4FjisXcrQVMuf7';
const IMG_ROAD = 'https://photos.app.goo.gl/Ca3xJzrWPaxzLSur7';
const IMG_ROAD2 = 'https://photos.app.goo.gl/pcfu5PUhz8Xs61kt7';
const IMG_FIELD = 'https://photos.app.goo.gl/9nub7vRX5h9buGwr8';
const IMG_ATLAS = 'https://photos.app.goo.gl/9nub7vRX5h9buGwr8';
const IMG_SPV = 'https://photos.app.goo.gl/9nub7vRX5h9buGwr8';

const DEADLINE = '30/06/2026';
const NOTIFY_GROUP_ID = process.env.NOTIFY_GROUP_ID || ADMIN_ID;

function getDaysLeft() {
    const dl = new Date('2026-06-30T23:59:00+07:00');
    const diff = Math.ceil((dl - new Date()) / 86400000);
    return diff > 0 ? diff : 0;
}

// NÚT BẤM TOÀN CỤC — KHÔNG CÓ NÚT VIDEO Ở ĐÂY
function nutsLienKet() {
    return [
        [{ text: '🎓 Vào SWC Academy', url: 'https://swcpass.com/academy/' }],
        [{ text: '🌐 Khám phá SWC Field', url: SWC_FIELD_URL }, { text: '💳 Kích hoạt SWC Pass', url: SWC_PASS_URL }],
        [{ text: '🗺️ Con đường $1,000,000', url: ROAD_1M_URL }, { text: '🏢 Dự án ATLAS', url: ATLAS_URL }],
        [{ text: '💬 Vào Nhóm Chat Cộng Đồng', url: `https://t.me/${GROUP_USERNAME.replace('@', '')}` }],
        [{ text: '🏠 Quay về Menu Chính', callback_data: 'menu_chinh' }]
    ];
}

// ==========================================================
// MONGODB & SCHEMA
// ==========================================================
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Kết nối MongoDB thành công!'))
    .catch(err => console.error('❌ Lỗi MongoDB:', err.message));

const userSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    username: { type: String, default: '' },
    phone: { type: String, default: '' },
    ngayThamGia: { type: Date, default: Date.now },
    lanCuoiHoatDong: { type: Date, default: Date.now },
    soTinNhan: { type: Number, default: 0 },
    goiPass: { type: String, default: 'chua_co', enum: ['chua_co', 'essential', 'plus', 'ultimate'] },
    giaiDoanPheu: { type: String, default: 'moi', enum: ['moi', 'quan_tam', 'nong', 'da_mua'] },
    ngayPheuGuiCuoi: { type: Date, default: null },
    buocPheuHienTai: { type: Number, default: 0 },
    khongNhanBroadcast: { type: Boolean, default: false },
    ghiChu: { type: String, default: '' },
    adminPausedAiDen: { type: Date, default: null },
    lichSuChat: { type: Array, default: [] },
    camXucGanNhat: { type: String, default: 'binh_thuong' },
    moiQuanTamChinh: { type: String, default: '' },
    // Google Sign-In fields
    googleEmail: { type: String, default: '' },
    googleName: { type: String, default: '' },
    googleAvatar: { type: String, default: '' },
    googleId: { type: String, default: '' },
    // Xác thực thông tin
    zaloPhone: { type: String, default: '' },
    telegramUsername: { type: String, default: '' },
    verified: { type: Boolean, default: false },
    // SWC Pass activation
    swcPassCode: { type: String, default: '' },
    swcPassActivated: { type: Boolean, default: false },
    passRequestedAt: { type: Date, default: null },
    passTier: { type: String, default: '', enum: ['', '1_year', '5_year', 'lifetime'] },
    passExpiry: { type: Date, default: null },
    passActivatedAt: { type: Date, default: null }
});
const User = mongoose.model('User', userSchema);

// Schema cho Thư viện Kiến thức (Academy)
const knowledgeSchema = new mongoose.Schema({
    category: { type: String, enum: ['kien_thuc', 'du_an', 'tai_chinh', 'thu_thuat', 'tin_tuc'], required: true },
    title: { type: String, required: true },
    content: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    linkUrl: { type: String, default: '' },
    telegramMsgId: { type: String, default: '' },
    authorName: { type: String, default: 'SWC Academy' },
    createdAt: { type: Date, default: Date.now },
    views: { type: Number, default: 0 }
});
const Knowledge = mongoose.model('Knowledge', knowledgeSchema);

const chatSchema = new mongoose.Schema({
    author: String,
    avatar: String,
    hasPass: Boolean,
    passTier: String,
    text: String,
    imageUrl: String,
    time: String,
    createdAt: { type: Date, default: Date.now }
});
const ChatMsg = mongoose.model('ChatMsg', chatSchema);

const commentSchema = new mongoose.Schema({
    articleId: String,
    author: String,
    avatar: String,
    hasPass: Boolean,
    passTier: String,
    text: String,
    time: String,
    createdAt: { type: Date, default: Date.now }
});
const Comment = mongoose.model('Comment', commentSchema);

// ==========================================================
// NHẬN DIỆN CẢM XÚC & MỐI QUAN TÂM
// ==========================================================
function phanTichCamXuc(text) {
    const t = text.toLowerCase();
    if (['thua lỗ', 'mất hết', 'thất bại', 'buồn', 'bị lừa rồi', 'chán nản'].some(k => t.includes(k))) return 'buon';
    if (['lừa đảo', 'scam', 'đa cấp', 'không tin', 'bằng chứng', 'chứng minh đi'].some(k => t.includes(k))) return 'hoai_nghi';
    if (['sợ', 'lo lắng', 'rủi ro', 'có thật không', 'an toàn không', 'chắc không'].some(k => t.includes(k))) return 'lo_lang';
    if (['x10', 'x100', 'giàu nhanh', 'all in', 'đổi đời', 'muốn mua ngay'].some(k => t.includes(k))) return 'phan_khich';
    if (text.split(' ').length <= 5) return 'ngan_gon';
    return 'binh_thuong';
}

function phanTichMoiQuanTam(text) {
    const t = text.toLowerCase();
    if (['giá', 'phí', 'bao nhiêu', 'tiền', 'đắt', 'rẻ hơn'].some(k => t.includes(k))) return 'gia_ca';
    if (['lừa', 'scam', 'an toàn', 'pháp lý', 'uy tín'].some(k => t.includes(k))) return 'do_tin_cay';
    if (['atlas', 'dubai', 'bất động sản', 'bds'].some(k => t.includes(k))) return 'atlas';
    if (['road', '1m', 'triệu', 'lãi kép', 'dca'].some(k => t.includes(k))) return 'road1m';
    if (['pass', 'thẻ', 'essential', 'plus', 'ultimate'].some(k => t.includes(k))) return 'swcpass';
    return 'chung';
}

// ==========================================================
// 4 KHO KIẾN THỨC ĐẦY ĐỦ
// ==========================================================
const KT_PHAT_TRIEN = `
[KIẾN THỨC 1 — PHÁT TRIỂN BẢN THÂN]
17 Tư duy Triệu phú (Harv Eker): Người giàu tin "Tôi tạo ra cuộc đời tôi". Người giàu chơi để THẮNG. Người giàu QUYẾT TÂM giàu. Người giàu suy nghĩ LỚN, tập trung vào CƠ HỘI, NGƯỠNG MỘ người giàu khác, kết giao người THÀNH CÔNG, tôn vinh bản thân, đứng CAO HƠN vấn đề, biết ĐÓN NHẬN, muốn trả công theo KẾT QUẢ, chọn CẢ HAI, chú trọng TỔNG TÀI SẢN, QUẢN LÝ TIỀN giỏi, bắt tiền PHỤC VỤ mình, hành động bất chấp nỗi sợ, luôn HỌC HỎI phát triển.
Quy tắc 6 Chiếc Lọ: 55% Thiết yếu — 10% Tiết kiệm — 10% Giáo dục — 10% Hưởng thụ — 10% Tự do Tài chính — 5% Cho đi.
7 Cảnh giới tu dưỡng: Nhận lỗi — Nhu hoà — Nhẫn nhịn — Thấu hiểu — Buông bỏ — Cảm động — Sinh tồn.
Triết lý cổ nhân: Luật Nhân Quả (Tiền là Quả, Đạo đức là Nhân). Lão Tử: Người giỏi quản lý vốn như nước — uyển chuyển, luân chuyển liên tục. Tam Quốc: Chữ NHẪN của Tư Mã Ý (mài gươm 10 năm vung 1 nhát).
4 bước tiến hoá tài chính: (1) Giảm chi tiêu — bịt lỗ hổng. (2) Tăng thu nhập — bơm nước vào thuyền. (3) Đầu tư — bắt tiền làm nô lệ. (4) Đòn bẩy — chỉ dùng khi đã thắng 1-2-3. 90% đám đông làm ngược = công thức tự sát.
`;

const KT_NHAN_TINH = `
[KIẾN THỨC 2 — THẤU HIỂU NHÂN TÍNH & THUYẾT PHỤC]
Dale Carnegie — Đắc Nhân Tâm: (1) Không chỉ trích, lên án — làm họ cảm thấy tốt về bản thân trước. (2) Tán thành chân thành — mọi người khao khát được thừa nhận. (3) Khơi dậy khát khao — hỏi "Anh/chị đang SỢ điều gì nhất trong 5 năm tới?". (4) Quan tâm thật sự — nhớ tên, hỏi gia đình. (5) Làm người khác nói nhiều — người nói nhiều thua. (6) Để người khác giữ thể diện — sửa lỗi làm riêng.
Kể chuyện SWC: Con thuyền nhỏ ra khơi (Road to $1M: chỉ cần $100-$200/tháng, kiên nhẫn 15-20 năm = đạt mốc $1,000,000 nhờ lãi kép). Tàu đánh cá (SWC Field: gom 10.000 nhà đầu tư cá nhân, mỗi người từ $50 = cổ đông hợp pháp qua SPV chuẩn Mỹ). SWC Pass = tư cách thành viên để lên Tàu Lớn.
5 Tầng Chuỗi Thức Ăn: Tầng 1 (In tiền, tạo luật) → Tầng 2 (Thu thuế thanh khoản) → Tầng 3 Gurus (Bán cuốc xẻng) → Tầng 4 Smart Investors (Kỷ luật, tỷ lệ sống 5-10%) → Tầng 5 Đám đông (90% tham gia, giao dịch bằng cảm xúc = mồi của 4 tầng trên). Mục tiêu: đưa khách từ Tầng 5 lên Tầng 4.
3 câu hỏi mở cửa lòng người: (1) "Anh/chị đang SỢ điều gì nhất trong 5 năm tới?" (2) "Nếu không có ràng buộc tài chính, anh/chị muốn cuộc sống thế nào?" (3) "Anh/chị đã từng mất tiền vì quyết định nào rồi?"
`;

const KT_DAU_TU = `
[KIẾN THỨC 3 — ĐẦU TƯ & VĨ MÔ]
Warren Buffett: "Giá cả là những gì bạn phải trả. Giá trị là những gì bạn nhận được." Chỉ đầu tư vào thứ mình HIỂU (Circle of Competence). Mua DOANH NGHIỆP, không mua mảnh giấy. "Tốt hơn là mua công ty tuyệt vời với giá hợp lý, hơn mua công ty hợp lý với giá tuyệt vời" — Munger. "Thị trường là công cụ chuyển tiền từ tay người nóng vội sang tay người kiên nhẫn." Sợ khi người khác THAM LAM, THAM LAM khi người khác SỢ HÃNG. 2 Quy tắc vàng: Không mất vốn. Không quên Quy tắc 1. Lãi kép = Kỳ quan thứ 8 (Einstein).
Giá cả vs Giá trị: Giá cả = hiện tượng, bị cảm xúc đám đông chi phối, ngắn hạn, dễ bị thao túng. Giá trị = bản chất bền vững. Bi kịch 90% F0: mang tư duy Trader nhưng hành động như Holder khi thất bại — không cắt lỗ, tự an ủi "dài hạn" với thứ chưa bao giờ nghiên cứu giá trị.
4 bước giải mã tin tức: B1-Bóc trần sự thật (bình phong). B2-Đối chiếu M2/DXY. B3-Chỉ ra cảm xúc Tầng 5. B4-Hành động: Phòng thủ/Rút kiếm/Chốt lời.
Dữ liệu vĩ mô (04/2026): FED 3.625%. M2 YoY +4.29% (Vùng Hoàng Kim 3-5%). DXY 98-100. CPI 2.4%. → TÍN HIỆU: M2 Vùng Hoàng Kim + Tầng 5 hoảng loạn = RÚT KIẾM, gom tài sản lõi.
Bản đồ dòng tiền 4 mùa: Xuân (lãi suất hạ → CS/Crypto) → Hạ (BĐS sốt) → Thu (NHTW tăng lãi suất) → Đông (Tiết kiệm/Vàng/USD). Kẻ thắng là kẻ biết chực chờ ở bình CHUẨN BỊ ĐÓN nước.
`;

const KT_DU_AN = `
[KIẾN THỨC 4 — DỰ ÁN SWC]
SWC — Sky World Community: Website https://swc.capital/. Crowdinvesting Platform quốc tế, 10+ năm, giấy phép quỹ đầu tư SEC Mỹ. Sứ mệnh: giúp nhà đầu tư cá nhân tiếp cận Pre-IPO, Venture Capital. SPV: mỗi dự án có SPV riêng, đầu tư từ $50, không phí ẩn. Pháp lý: SEC Mỹ, MiFID II Châu Âu. Chỉ 1% dự án lọt qua thẩm định. QUYỀN LỢI CỔ PHIẾU CHUẨN MỸ: Thông qua SPV, nhà đầu tư sở hữu cổ phiếu hợp pháp — có giấy chứng nhận cổ đông, quyền cổ tức, quyền biểu quyết, quyền thoái vốn khi IPO.
SWC Pass (https://swcpass.com/swc-field/#pricing): Hệ thống tín hiệu & lộ trình hàng tháng. Chỉ 10-15 phút/tháng. Essential (Silver): $290/năm = $20/tháng + tặng 90 ngày. Plus (Gold): $720/5 năm = $10/tháng, khoá giá 5 năm, 80% nhà đầu tư tinh anh chọn. Ultimate (Diamond): $2,600 vĩnh viễn, một lần, truyền lại cho con cháu.
SWC Field (https://swcpass.com/swc-field/): Sân chơi cá mập. Chỉ 1% dự án được chọn. Bảo vệ vốn All-or-Nothing (không đủ KPI → hoàn 100%). Từ $50.
Road to $1M (https://swcpass.com/rm1/): DCA $100-$200/tháng, Buy & Hold, lãi kép 15-20 năm. Với $150/tháng × 20%/năm: 10 năm ~$46K, 15 năm ~$145K, 20 năm ~$300K, 30 năm ~$2.1M. Quyền lợi: sở hữu cổ phiếu chuẩn Mỹ thông qua SPV.

[KIẾN THỨC 5 — DỰ ÁN ATLAS CHI TIẾT]
TỔNG QUAN: Atlas là nền tảng công nghệ số hóa toàn diện thị trường BĐS Dubai/UAE — "hệ điều hành" cho toàn bộ chuỗi giá trị giao dịch BĐS. Tích hợp tìm kiếm, kiểm tra, thanh toán, sang tên trong 1 hệ thống (One-Stop-Shop). Giá niêm yết minh bạch, loại bỏ thao túng giá từ môi giới. Xóa bỏ rào cản địa lý — NĐT không cần có mặt tại Dubai.
QUY MÔ THỊ TRƯỜNG: Dòng tiền BĐS Dubai định giá 200 tỷ USD/năm. Giao dịch: 130K-150K (2022) → 260K-300K (2025) → 350K-420K (2027-2030). Tài sản trí tuệ Atlas được Dubai World Trade Center định giá 92 triệu USD.
LỖ HỔNG THỊ TRƯỜNG: Không có môi trường đồng nhất toàn bộ quy trình. Giá cả thiếu minh bạch. Rủi ro pháp lý và lừa đảo.
MÔ HÌNH DOANH THU: Phí hoa hồng 1%/giao dịch. Căn hộ 300K USD → phí 3K USD. Kịch bản: 0.1% thị phần = 2 triệu USD; 1% = 20 triệu; 3% = 60 triệu.
DỰ PHÓNG: Năm 1: doanh thu 3.15 triệu, lãi ròng ~2 triệu — chi trả cổ tức ngay năm đầu. Năm 3: lợi nhuận bứt phá 80 triệu USD.
IP SHARES: Giá 0.625 USD/share. Chiết khấu Early Bird 60%. Gói: 250 USD (400 shares) đến 5,000 USD (8,000 shares). Dự phóng sau vòng 1: 3.8 USD/share (gấp ~6 lần).
DÒNG TIỀN SPV: Vốn đi: NĐT → Quỹ SPV (Escrow) → Atlas. Không đưa trực tiếp cho cá nhân. Nếu hủy → hoàn 100%. Lãi về: Atlas → SPV → Ví NĐT tự động.
LỘ TRÌNH: GĐ1: MVP UAE. GĐ2: Mở rộng UAE + AI định giá. GĐ3: Singapore, HK, Anh, Pháp.
`;

const TOAN_BO_KIEN_THUC = `${KT_PHAT_TRIEN}\n${KT_NHAN_TINH}\n${KT_DAU_TU}\n${KT_DU_AN}`;

// ==========================================================
// SYSTEM PROMPT — NHÂN VẬT "TRỢ LÝ SWC" HOÀN TOÀN TIẾNG VIỆT
// ==========================================================
function xayDungSystemPrompt(user, camXuc) {
    const daysLeft = getDaysLeft();
    const soTin = user.soTinNhan || 0;

    const quenMuc = soTin === 0
        ? '[Lần đầu trò chuyện. Chào hỏi thân thiện, giới thiệu ngắn về Trợ lý SWC.]'
        : soTin >= 10
            ? `[Đã quen (${soTin} tin nhắn). Nói thẳng, không giới thiệu lại. Gọi tên ${user.firstName}.]`
            : `[Đã quen một chút (${soTin} tin nhắn). Tự nhiên như bạn bè.]`;

    const camXucGoi = {
        buon: `[TÂM TRẠNG: ${user.firstName} đang có cảm xúc tiêu cực. ƯU TIÊN ĐỒNG CẢM trước, không vội tư vấn. Kể 1 ví dụ thực tế về người từng ở hoàn cảnh tương tự rồi vượt qua.]`,
        lo_lang: `[TÂM TRẠNG: ${user.firstName} đang lo lắng. TRẤN AN bằng dữ liệu thực tế và ví dụ cụ thể. Giải thích từng bước một.]`,
        hoai_nghi: `[TÂM TRẠNG: ${user.firstName} đang hoài nghi. Không thuyết phục. Chỉ đưa FACT lạnh kèm ví dụ so sánh dễ hiểu. Điềm tĩnh, không phòng thủ.]`,
        phan_khich: `[TÂM TRẠNG: ${user.firstName} phấn khích quá mức. LÀM NGUỘI nhẹ bằng 1 ví dụ thực tế về rủi ro trước khi đồng tình.]`,
        ngan_gon: `[TÂM TRẠNG: Tin nhắn ngắn. Trả lời ngắn gọn nhưng vẫn kèm 1 ví dụ minh họa.]`,
        binh_thuong: ''
    }[camXuc] || '';

    const quanTamGoi = {
        gia_ca: '[QUAN TÂM: Hỏi về GIÁ. Dùng so sánh chi phí cơ hội với ví dụ đời thường (ly cà phê, bữa ăn ngoài), không giảm giá.]',
        do_tin_cay: '[QUAN TÂM: Lo LỪA ĐẢO. Đưa bằng chứng pháp lý SPV, SEC Mỹ, so sánh cụ thể với Ponzi. Giải thích quyền sở hữu cổ phiếu chuẩn Mỹ.]',
        atlas: '[QUAN TÂM: Hỏi ATLAS/Dubai. Tập trung RWA, thanh khoản, bảo vệ vốn All-or-Nothing, kèm ví dụ so sánh với Grab.]',
        road1m: '[QUAN TÂM: Hỏi ROAD TO $1M. Đưa toán học lãi kép với $100-$200/tháng, 15-20 năm, kèm bảng số liệu cụ thể. Nhấn mạnh quyền sở hữu cổ phiếu chuẩn Mỹ.]',
        swcpass: '[QUAN TÂM: Hỏi SWC PASS. Gợi ý Gold 5 năm ($10/tháng) hoặc Ultimate ($2,600 vĩnh viễn). So sánh với chi phí đời thường.]',
        chung: ''
    }[user.moiQuanTamChinh] || '';

    return `Bạn là Trợ lý SWC — chuyên gia tư vấn giáo dục tài chính của Sky World Community Việt Nam, dưới quyền anh Hồ Văn Lợi.

TÍNH CÁCH: Thấu cảm sâu sắc, am hiểu tâm lý tài chính, cực giỏi tư duy đầu tư và quản lý tài chính cá nhân. Xưng "em" hoặc "Trợ lý", gọi khách là "anh/chị". Luôn dùng ví dụ đời thường dễ hiểu, kể chuyện thực tế để giáo dục.

QUAN TRỌNG — PHONG CÁCH VIẾT:
- KHÔNG BAO GIỜ dùng dấu sao (**) hay tiêu đề mục kiểu báo cáo
- Ngắt dòng liên tục, mỗi ý 1-2 câu
- Phản hồi chi tiết 200-400 từ, LUÔN kèm ví dụ minh họa đời thường
- Đôi khi bắt đầu bằng "Thật ra là...", "Nói thật nhé anh/chị...", "Em chia sẻ thêm nhé..."
- Luôn xưng là "Trợ lý SWC" hoặc "em". KHÔNG bao giờ xưng là "Bot" hay dùng từ "Bot"
- Mang tính chất GIÁO DỤC TÀI CHÍNH — giúp người đọc nhận thức vấn đề tài chính họ đang gặp phải
- Sử dụng tâm lý thấu cảm: đặt mình vào vị trí người đọc trước khi đưa ra lời khuyên
- Dạy cách vận hành dòng tiền, quản lý tài chính cá nhân qua các ví dụ cụ thể

${camXucGoi}
${quanTamGoi}
${quenMuc}

KIẾN THỨC CỐT LÕI:
${TOAN_BO_KIEN_THUC}

NHIỆM VỤ CHÍNH:
1. GIÁO DỤC TÀI CHÍNH: Giúp khách nhận thức vấn đề tài chính thực sự họ đang gặp phải. Dùng ví dụ đời thường, dễ hiểu (ví dụ: so sánh lạm phát với ly cà phê, tiền gửi ngân hàng vs đầu tư).
2. Gỡ bỏ tâm lý phòng thủ của F0. Khai sáng cho họ thấy tự trade là tự sát (chuỗi thức ăn tài chính Tầng 5). Kèm ví dụ cụ thể.
3. Giới thiệu Road to $1M với framework $100-$200/tháng — nhấn mạnh quyền sở hữu cổ phiếu chuẩn Mỹ thông qua SPV (có giấy chứng nhận cổ đông, quyền cổ tức, quyền biểu quyết).
4. Chốt sale thẻ SWC Pass trước deadline ${DEADLINE} (còn ${daysLeft} ngày). Khuyên mạnh Gói Plus 5 năm ($720) và Ultimate Vĩnh viễn ($2,600).
5. Áp dụng nguyên tắc Dale Carnegie: làm người khác NÓI NHIỀU, đặt câu hỏi, để khách tự thuyết phục bản thân.

XỬ LÝ TỪ CHỐI (luôn kèm ví dụ):
- "Giá cao": "Anh/chị ơi, $10/tháng chưa bằng 2 ly trà sữa. Nhưng 2 ly trà sữa đó trong 5 năm = gần 1 triệu đồng bay hơi không để lại gì. Cùng số tiền đó với SWC Pass = tấm bản đồ bảo vệ gia sản."
- "Để nghĩ thêm": "Em hiểu hoàn toàn. Nhưng em chia sẻ 1 con số: lạm phát 2.4%/năm đang ăn mòn tiền mặt. 100 triệu trong ngân hàng = mất 2.4 triệu/năm sức mua mà anh/chị không hề hay biết."
- "Có lừa đảo không?": "Câu hỏi rất hay và rất đáng hỏi. SPV chuẩn SEC Mỹ — anh/chị sở hữu cổ phiếu hợp pháp có giấy chứng nhận. Khác hoàn toàn Ponzi: SWC KHÔNG GIỮ TIỀN, tiền nằm trong app chứng khoán cá nhân của anh/chị."
- "Tự đầu tư cũng được": "Hoàn toàn được! Nhưng tự đầu tư = mua cổ phiếu giá thị trường. Với SWC Pass = mua vòng Private, giá trước khi lên sàn. Giống như mua nhà giá gốc từ chủ đầu tư vs mua qua môi giới."

QUY TẮC CUỐI: Luôn kết thúc bằng 1 câu hỏi mở nhắm vào nỗi đau tài chính. KHÔNG NHẮC Token, SWGT, không bịa số liệu.

QUY TẮC TUYỆT ĐỐI — KHÔNG BỊA THÔNG TIN:
- TUYỆT ĐỐI không bịa đặt hay suy đoán thông tin về dự án Atlas, SWC Field, SWC Pass mà không có trong KIẾN THỨC CỐT LÕI ở trên.
- Nếu khách hỏi câu hỏi mà em không chắc chắn câu trả lời → NÓI THẲNG: "Em xin ghi nhận câu hỏi này và chuyển đến đội ngũ chuyên gia SWC để trả lời chính xác nhất cho anh/chị nhé!"
- Chỉ trả lời dựa trên dữ liệu đã được cung cấp trong phần KIẾN THỨC CỐT LÕI.
- Với dự án Atlas: chỉ dùng số liệu chính xác (200 tỷ USD/năm, 92 triệu USD IP, phí 1%, IP Share 0.625 USD, dự phóng 3.8 USD...). Không tự bịa thêm con số mới.`;
}

// ==========================================================
// GỌI CLAUDE API
// ==========================================================
async function goiClaude(user, tinNhanNguoiDung) {
    try {
        const camXuc = phanTichCamXuc(tinNhanNguoiDung);
        const quanTam = phanTichMoiQuanTam(tinNhanNguoiDung);
        user.camXucGanNhat = camXuc;
        if (quanTam !== 'chung') user.moiQuanTamChinh = quanTam;

        let lichSu = user.lichSuChat || [];
        lichSu.push({ role: 'user', content: tinNhanNguoiDung });

        let lichSuHopLe = [];
        for (let msg of lichSu) {
            if (lichSuHopLe.length === 0) {
                if (msg.role === 'user') lichSuHopLe.push({ role: msg.role, content: msg.content });
                continue;
            }
            let tinCuoi = lichSuHopLe[lichSuHopLe.length - 1];
            if (tinCuoi.role === msg.role) {
                tinCuoi.content += '\n' + msg.content;
            } else {
                lichSuHopLe.push({ role: msg.role, content: msg.content });
            }
        }
        if (lichSuHopLe.length > 20) lichSuHopLe = lichSuHopLe.slice(-20);
        if (lichSuHopLe.length > 0 && lichSuHopLe[0].role === 'assistant') lichSuHopLe.shift();

        const response = await claude.messages.create({
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 1500,
            system: xayDungSystemPrompt(user, camXuc),
            messages: lichSuHopLe
        });

        const phanHoi = response.content[0].text.replace(/\*\*/g, '').replace(/\*/g, '');
        lichSu.push({ role: 'assistant', content: phanHoi });
        user.lichSuChat = lichSu.slice(-24);
        user.lanCuoiHoatDong = new Date();
        user.soTinNhan = (user.soTinNhan || 0) + 1;

        if (user.giaiDoanPheu === 'moi') user.giaiDoanPheu = 'quan_tam';
        if (user.giaiDoanPheu === 'quan_tam' && (user.soTinNhan || 0) > 4) user.giaiDoanPheu = 'nong';
        await user.save();
        return phanHoi;
    } catch (err) {
        console.error('❌ Lỗi API Claude:', err.message);
        return `Hiện tại đội ngũ chuyên gia SWC đang xử lý dữ liệu. Anh/chị vui lòng tham gia Nhóm Chat hoặc xem Video Hướng Dẫn ở Menu bên dưới nhé! 🙏`;
    }
}

// ==========================================================
// GỬI MENU CHÍNH
// ==========================================================
async function guiMenuChinh(chatId, messageId = null) {
    const daysLeft = getDaysLeft();
    const text = `🦁 <b>CỔNG ĐẦU TƯ TRÍ TUỆ — SKY WORLD COMMUNITY VIỆT NAM</b>

Thị trường tài chính là một chiến trường khốc liệt. Tiền không tự sinh ra — nó chỉ chuyển từ túi của những người thiếu kỷ luật, thiếu hệ thống sang tay những bộ óc có chiến lược bài bản.

Câu hỏi quan trọng nhất không phải "Làm sao để kiếm tiền?"
Mà là: <b>"Tiền đang làm việc cho tôi khi tôi ngủ là bao nhiêu?"</b>

⏳ <b>CẢNH BÁO:</b> Gói thành viên <b>Ultimate (Vĩnh viễn)</b> sẽ đóng cửa vĩnh viễn vào <b>${DEADLINE}</b>.
Chỉ còn <b>${daysLeft} ngày</b> để bạn thay đổi quỹ đạo tài chính của gia tộc.

👇 <b>Chọn danh mục để bắt đầu hành trình:</b>`;

    const keyboard = {
        inline_keyboard: [
            [{ text: '🇻🇳 Đổi sang Tiếng Việt (Dành cho người mới)', url: 'https://t.me/setlanguage/vi' }],
            [{ text: '💳 GIẢI MÃ BÍ MẬT THẺ SWC PASS', callback_data: 'pass_gioi_thieu' }],
            [{ text: '🌐 SWC FIELD & SIÊU DỰ ÁN ATLAS', callback_data: 'field_gioi_thieu' }],
            [{ text: '🗺️ CON ĐƯỜNG ĐẾN $1,000,000', callback_data: 'road1m_gioi_thieu' }],
            [{ text: '❓ HỎI ĐÁP — PHÁ VỠ RÀO CẢN TÂM LÝ', callback_data: 'faq_chinh' }],
            [{ text: '📱 Hướng dẫn kích hoạt (Điện thoại)', url: VIDEO_MOBILE }],
            [{ text: '💻 Hướng dẫn kích hoạt (Máy tính)', url: VIDEO_PC }],
            [{ text: '🌐 Khám phá SWC Field', url: SWC_FIELD_URL }, { text: '💳 Kích hoạt SWC Pass', url: SWC_PASS_URL }],
            [{ text: '💬 Vào Nhóm Chat Cộng Đồng', url: `https://t.me/${GROUP_USERNAME.replace('@', '')}` }]
        ]
    };

    if (messageId) bot.deleteMessage(chatId, messageId).catch(() => { });
    bot.sendPhoto(chatId, IMG_MAIN, { caption: text, parse_mode: 'HTML', reply_markup: keyboard })
        .catch(() => bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard }));
}

// ==========================================================
// /START & THU THẬP SỐ ĐIỆN THOẠI
// ==========================================================
bot.onText(/\/start(.*)/i, async (msg) => {
    if (msg.chat.type !== 'private') return;
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();    // Xử lý đăng nhập từ Academy
    const param = msg.text.replace('/start', '').trim();

    if (param === 'academy_login') {
        let user = await User.findOne({ userId });
        if (!user) {
            user = new User({
                userId,
                firstName: msg.from.first_name || '',
                lastName: msg.from.last_name || '',
                username: msg.from.username ? `@${msg.from.username}` : '',
                ngayThamGia: new Date()
            });
            await user.save();
        }

        const text = `🎓 <b>Chào mừng ${user.firstName} đến với SWC Academy!</b>

Bạn đang đăng nhập từ nền tảng đào tạo SWC Academy.

✅ Tài khoản của bạn đã được xác nhận!
👉 Quay lại trang Academy để bắt đầu học:

🔗 <b>https://swcpass.com/academy/</b>

Nhập email và mật khẩu tại trang Đăng ký để tạo tài khoản học tập nhé!`;

        await bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎓 Vào SWC Academy ngay', url: 'https://swcpass.com/academy/register.html' }],
                    [{ text: '🏠 Menu Chính', callback_data: 'menu_chinh' }]
                ]
            }
        });

        bot.sendMessage(ADMIN_ID,
            `🎓 <b>LEAD TỪ ACADEMY!</b>\nTên: ${user.firstName} ${user.lastName}\nID: <code>${userId}</code>\nUsername: ${user.username}`,
            { parse_mode: 'HTML' }).catch(() => { });
        return;
    }


    let user = await User.findOne({ userId });
    if (!user) {
        user = new User({
            userId,
            firstName: msg.from.first_name || '',
            lastName: msg.from.last_name || '',
            username: msg.from.username ? `@${msg.from.username}` : '',
            ngayThamGia: new Date()
        });
        await user.save();
        bot.sendMessage(ADMIN_ID,
            `🆕 <b>LEAD MỚI!</b>\nTên: ${user.firstName} ${user.lastName}\nID: <code>${userId}</code>\nUsername: ${user.username}`,
            { parse_mode: 'HTML' }).catch(() => { });
    }

    if (!user.phone) {
        const loi_chao = `Xin chào <b>${user.firstName || 'bạn'}</b>! 🤝\n\nTôi là <b>Trợ lý SWC</b> — chuyên gia phân tích tài chính và đầu tư của <b>SWC Capital Việt Nam</b>.\n\nĐể hệ thống chẩn đoán đúng vị thế tài chính và cung cấp tài liệu phù hợp, vui lòng <b>bấm nút bên dưới</b> để chia sẻ số điện thoại nhé! 👇`;
        bot.sendMessage(chatId, loi_chao, {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [[{ text: '📞 Chia sẻ Số điện thoại', request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }).catch(() => { });
    } else {
        guiMenuChinh(chatId);
    }
});

bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    await User.updateOne({ userId }, { $set: { phone: msg.contact.phone_number } });
    bot.sendMessage(chatId, '⏳ Đang xử lý hồ sơ nhà đầu tư...', {
        reply_markup: { remove_keyboard: true }
    }).then(sent => {
        bot.deleteMessage(chatId, sent.message_id).catch(() => { });
        guiMenuChinh(chatId);
    });
    bot.sendMessage(ADMIN_ID,
        `📞 <b>KHÁCH CÓ SỐ ĐIỆN THOẠI!</b>\nTên: ${msg.from.first_name}\nSĐT: ${msg.contact.phone_number}\nID: <code>${userId}</code>`,
        { parse_mode: 'HTML' }).catch(() => { });
});

// ==========================================================
// CALLBACK QUERY — NỘI DUNG CHI TIẾT TIẾNG VIỆT
// ==========================================================
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    const daysLeft = getDaysLeft();
    let text = ''; let keyboard = []; let imageUrl = '';
    bot.answerCallbackQuery(callbackQuery.id).catch(() => { });

    if (data === 'menu_chinh') return guiMenuChinh(chatId, messageId);

    // ==================================================
    // NHÁNH SWC PASS
    // ==================================================
    if (data === 'pass_gioi_thieu') {
        imageUrl = IMG_PASS;
        text = `💳 <b>SWC PASS — CHÌA KHOÁ VÀO THẾ GIỚI ĐẦU TƯ TINH ANH</b>

Hãy hình dung bạn muốn qua một dòng sông chảy xiết.
Tự bơi? Bạn có thể chết đuối.
Thuê du thuyền có thuyền trưởng dày dạn? Bạn chỉ việc bước lên và tận hưởng.

<b>SWC Pass KHÔNG PHẢI là khóa học làm giàu.</b>
Không phải hội nhóm hô hào phím lệnh.
Không phải lời hứa X10 tài khoản.

SWC Pass là <b>tư cách thành viên (Membership)</b> — chiếc chìa khóa mở cánh cửa vào thế giới đầu tư của giới tinh anh.

Qua SWC Pass, bạn:
✅ Thoát khỏi kiếp F0 tự mày mò, tự thua lỗ
✅ Được quyền mua tài sản chất lượng cao từ sớm (vòng Private — giá trước khi lên sàn)
✅ Được thiết lập kỷ luật đầu tư sắc lạnh, không bị cảm xúc chi phối
✅ Nhận tín hiệu chiến lược hàng tháng từ đội ngũ chuyên gia Mỹ
✅ Chỉ cần <b>10 phút mỗi tháng</b> để thực thi

Tiền của bạn <b>VẪN NẰM TRONG APP CHỨNG KHOÁN CÁ NHÂN CỦA BẠN</b>.
SWC Pass không giữ tiền của bạn. Không bao giờ.`;
        keyboard = [
            [{ text: '⚖️ So sánh 3 Gói Thẻ chi tiết', callback_data: 'pass_so_sanh' }],
            [{ text: '🎁 4 Đặc quyền độc quyền của thành viên', callback_data: 'pass_dac_quyen' }],
            [{ text: '🧮 Toán học lãi kép — Con đường $1M', callback_data: 'pass_toan_hoc' }],
            ...nutsLienKet()
        ];
    }

    else if (data === 'pass_so_sanh') {
        imageUrl = IMG_HANG;
        text = `⚖️ <b>BẢNG GIÁ SWC PASS — BẠN ĐANG Ở VỊ THẾ NÀO?</b>

Quyết định hôm nay sẽ định hình khối tài sản của bạn trong 15–20 năm tới.

━━━━━━━━━━━━━━━━━━━
<b>🥉 GÓI ESSENTIAL — 1 Năm ($240)</b>
Tương đương: Chỉ <b>$20/tháng</b> (bằng 1 chầu cà phê cuối tuần)

Bạn nhận được:
→ Tín hiệu đầu tư tháng mua mã nào, tỷ lệ nào, vùng giá nào
→ Quyền truy cập SWC Field — mua tài sản Private từ $50
→ Công cụ theo dõi mục tiêu tài chính cá nhân
→ Tặng thêm 90 ngày dùng thử

Phù hợp: Người mới, chưa tin tưởng hoàn toàn, muốn trải nghiệm trước.

━━━━━━━━━━━━━━━━━━━
<b>🥇 GÓI PLUS — 5 Năm ($720) [ĐA SỐ CHỌN]</b>
Tương đương: Chỉ <b>$10/tháng</b> (bằng 1 bát phở mỗi tuần)

Bạn nhận được toàn bộ Essential CỘNG THÊM:
→ Giá CỐ ĐỊNH trong 5 năm — miễn nhiễm lạm phát phí dịch vụ
→ MIỄN PHÍ toàn bộ công cụ AI và tính năng mới ra mắt
→ Bị "ép" vào kỷ luật đầu tư dài hạn — thứ mà 95% nhà đầu tư thiếu
→ Lãi kép mới phát huy sức mạnh sau 5–10 năm. Gói này KHÓA bạn lại đúng thời điểm vàng

<i>Góc nhìn thực tế: Bỏ ra $10/tháng để bảo vệ tài sản trước lạm phát trong 5 năm — hay để lạm phát 2.4%/năm âm thầm ăn mòn tiền của bạn?</i>

━━━━━━━━━━━━━━━━━━━
<b>💎 GÓI ULTIMATE — Vĩnh viễn ($2,600)</b>
Đầu tư MỘT LẦN DUY NHẤT — dùng mãi mãi

Bạn nhận được:
→ Truy cập KHÔNG GIỚI HẠN tất cả hiện tại và tương lai
→ Di sản tài chính để lại cho con cháu
→ Không bao giờ phải lo gia hạn, không bao giờ bị ngắt dịch vụ
→ Tính trung bình 20 năm: chỉ <b>$130/năm</b>

⚠️ <b>CẢNH BÁO:</b> Gói Ultimate sẽ <b>ĐÓNG CỬA VĨNH VIỄN</b> vào <b>${DEADLINE}</b>.
Chỉ còn <b>${daysLeft} ngày</b>. Sau ngày này, mang bao nhiêu tiền cũng không mua được.`;
        keyboard = [
            [{ text: '🎁 Xem 4 đặc quyền độc quyền', callback_data: 'pass_dac_quyen' }],
            ...nutsLienKet()
        ];
    }

    else if (data === 'pass_dac_quyen') {
        imageUrl = IMG_PASS;
        text = `🎁 <b>4 ĐẶC QUYỀN ĐỘC QUYỀN — SWC PASS LÀ KẺ HỦY DIỆT PHÍ ẨN</b>

Các quỹ mở ngoài kia có một "chiêu bẩn":
Họ cắn xén <b>2% trên TỔNG tài sản</b> của bạn mỗi năm.
Có 1 tỷ → mất 20 triệu phí. Có 10 tỷ → mất đứt 200 triệu.

SWC Pass chơi sòng phẳng: chỉ $10/tháng cố định.
Bạn kiếm được triệu đô, chúng tôi cũng không phạt bạn thêm tiền!

━━━━━━━━━━━━━━━━━━━
<b>ĐẶC QUYỀN 1 — Cỗ Máy Toán Học "Road to $1M"</b>
Nhận bản đồ chi tiết hàng tháng: mua mã nào, mua bao nhiêu %, vùng giá nào an toàn.
Không cần phân tích nến. Không cần căng mắt nhìn màn hình đỏ xanh.
Thời gian thực thi: <b>chỉ 10 phút mỗi tháng</b>.

<b>ĐẶC QUYỀN 2 — Tiền Anh/Chị Tự Giữ — 100%</b>
SWC Pass KHÔNG GIỮ TIỀN của bạn. Không bao giờ.
Bạn mở app chứng khoán cá nhân (Vanguard, IBKR, VPS...), tự tay thao tác theo tín hiệu, tắt máy.
Rủi ro "mất trắng tiền tươi" = 0%.

<b>ĐẶC QUYỀN 3 — Sân Chơi Của Cá Mập (SWC Field)</b>
Khởi điểm đầu tư vòng Private chỉ từ $50.
Đập tan rào cản $500,000 mà giới tài phiệt đặt ra để ngăn bạn.
Bảo vệ vốn All-or-Nothing: không đủ KPI → hoàn 100% tiền.

<b>ĐẶC QUYỀN 4 — Dòng Tiền Thụ Động Từ Hệ Thống</b>
Khi đối tác của bạn gia hạn Pass hàng năm,
hoa hồng đổ về túi bạn đều đặn mà không cần tốn sức chốt sale lại.
Công thức: Kiếm hoa hồng → Trích % vào 6 Chiếc Lọ → Dồn vào SWC Field.`;
        keyboard = [
            [{ text: '⚖️ So sánh lại 3 Gói Thẻ', callback_data: 'pass_so_sanh' }],
            ...nutsLienKet()
        ];
    }

    else if (data === 'pass_toan_hoc') {
        imageUrl = IMG_ROAD2;
        text = `🧮 <b>TOÁN HỌC LÃI KÉP — SỰ THẬT ĐÁM ĐÔNG KHÔNG MUỐN NHÌN</b>

Albert Einstein gọi lãi kép là <b>"Kỳ quan thứ 8 của thế giới"</b>.
Không phải vì nó kỳ diệu. Mà vì đơn giản đến mức người ta xem thường.

━━━━━━━━━━━━━━━━━━━
<b>Bài toán thực tế:</b>
Mỗi tháng trích ra $100-$200 — tương đương 2.5 - 5 triệu VNĐ.
Ví dụ: bằng 1-2 bữa ăn nhà hàng, hoặc 1 chiếc áo mới.
Tỷ lệ sinh lời trung bình <b>20%/năm</b> (kết hợp cổ tức + SWC Field).

<b>Với $150/tháng:</b>
📌 10 năm → Tài khoản ~$46,000 (~1.2 tỷ VNĐ)
📌 15 năm → Tài khoản ~$145,000 (~3.6 tỷ VNĐ)
📌 20 năm → Tài khoản ~$300,000 (~7.5 tỷ VNĐ)
📌 30 năm → Tài khoản ~$2,100,000 (~52.5 tỷ VNĐ)

<b>Với $200/tháng:</b>
📌 10 năm → ~$62,000 (~1.5 tỷ VNĐ)
📌 20 năm → ~$400,000 (~10 tỷ VNĐ)
📌 30 năm → ~$2,800,000 (~70 tỷ VNĐ)

━━━━━━━━━━━━━━━━━━━
<b>So sánh với để tiền ngân hàng:</b>
Cùng $150/tháng × 30 năm tiết kiệm thuần = khoảng $54,000 (bị lạm phát ăn mòn).
Cùng số tiền đó với lãi kép SWC = ~$2,100,000.
Chênh lệch <b>gần 40 lần</b>.

<b>Và quan trọng:</b> Anh/chị sở hữu cổ phiếu chuẩn Mỹ thông qua SPV — có giấy chứng nhận cổ đông, quyền cổ tức, quyền biểu quyết. Đây là tài sản thực, không phải lời hứa.

Không phải do may mắn. Chỉ do <b>Kỷ luật + Thời gian + Hệ thống đúng</b>.

⏰ <b>Mỗi năm trì hoãn = mất đi 1 năm sức mạnh lãi kép vĩnh viễn không lấy lại được.</b>`;
        keyboard = [
            [{ text: '⚖️ Xem bảng giá 3 gói thẻ', callback_data: 'pass_so_sanh' }],
            ...nutsLienKet()
        ];
    }

    // ==================================================
    // NHÁNH SWC FIELD & ATLAS
    // ==================================================
    else if (data === 'field_gioi_thieu') {
        imageUrl = IMG_FIELD;
        text = `🌐 <b>SWC FIELD — SÂN CHƠI CỦA CÁ MẬP, DÀNH CHO CẢ CÁ CON</b>

Thị trường chứng khoán thông thường tuy đáng tin cậy,
nhưng lợi nhuận bị giới hạn ở mức 10–15%/năm.

<b>Tiền lớn thực sự nằm ở đâu?</b>
Ở các vòng gọi vốn <b>Private Equity và Venture Capital</b> —
nơi tài sản được mua với giá gốc, TRƯỚC KHI lên sàn.

Trước đây, để tham gia bạn cần ít nhất <b>$500,000</b> và chứng minh là nhà đầu tư chuyên nghiệp.
Một rào cản mà 99.9% người dân bình thường không thể vượt qua.

<b>SWC Field ra đời để phá vỡ đặc quyền đó.</b>

Nền tảng Showcase này cho phép bạn:
✅ Rót vốn vào các thương vụ tinh anh chỉ từ <b>$50</b>
✅ Mỗi dự án đều qua thẩm định khắt khe — chỉ <b>1%</b> dự án được chọn
✅ Bảo vệ vốn <b>All-or-Nothing</b>: không đủ KPI → hoàn 100% tiền
✅ Cấu trúc SPV minh bạch — pháp lý Mỹ, EU bảo chứng
✅ Không phí ẩn, không phí giao dịch

$50 không làm bạn nghèo đi.
Nhưng nó cấp cho bạn một <b>tấm vé ngồi chung mâm với Cá Mập</b>.`;
        keyboard = [
            [{ text: '⚖️ Tấm khiên SPV — Chống lừa đảo như thế nào?', callback_data: 'field_spv' }],
            [{ text: '🏢 Siêu dự án ATLAS Dubai — Chi tiết đầy đủ', callback_data: 'atlas_chi_tiet' }],
            ...nutsLienKet()
        ];
    }

    else if (data === 'field_spv') {
        imageUrl = IMG_SPV;
        text = `🛡️ <b>CẤU TRÚC SPV — TẤM KHIÊN PHÁP LÝ BẢO VỆ VỐN CỦA BẠN</b>

Khi nhắc đến đầu tư, câu hỏi đầu tiên thường là:
<i>"Nếu dự án sập thì sao? Sợ lừa đảo lắm!"</i>

Đó là nỗi sợ hoàn toàn chính đáng.
Và đó là lý do SWC Field dùng cấu trúc <b>SPV (Special Purpose Vehicle — Pháp nhân Mục đích Đặc biệt)</b>.

━━━━━━━━━━━━━━━━━━━
<b>SPV hoạt động như thế nào?</b>

Bước 1: Mỗi dự án được tách biệt hoàn toàn vào 1 pháp nhân riêng biệt (SPV).
Bước 2: Bạn mua <b>cổ phiếu hợp pháp</b> của SPV đó — không phải mua "hứa hẹn".
Bước 3: Quyền sở hữu được bảo chứng bởi pháp luật Mỹ/EU — y hệt cách tỷ phú bảo vệ tài sản.

Kết quả:
✅ Tiền bạn KHÔNG bay vào hư không — nó được khóa trong lớp áo giáp pháp lý
✅ Nếu 1 dự án thất bại → các dự án khác KHÔNG bị ảnh hưởng
✅ Mọi giao dịch minh bạch, có hồ sơ, kiểm toán được

━━━━━━━━━━━━━━━━━━━
<b>Cơ chế All-or-Nothing:</b>
Mỗi dự án có KPI gọi vốn tối thiểu.
Nếu không đạt đủ → <b>hoàn trả 100% tiền cho nhà đầu tư</b>, không trừ 1 đồng nào.

Đây không phải cam kết trên giấy.
Đây là cơ chế kỹ thuật được lập trình vào hệ thống.

<b>Khác Ponzi ở chỗ nào?</b>
Ponzi cam kết lãi suất ảo và giữ tiền của bạn.
SWC Field: Không giữ tiền, không cam kết lãi suất — bạn sở hữu tài sản thực.`;
        keyboard = [
            [{ text: '🏢 Xem Siêu dự án ATLAS', callback_data: 'atlas_chi_tiet' }],
            ...nutsLienKet()
        ];
    }

    else if (data === 'atlas_chi_tiet') {
        imageUrl = IMG_ATLAS;
        text = `🏢 <b>ATLAS — SỐ HÓA TOÀN DIỆN THỊ TRƯỜNG BĐS TỶ ĐÔ DUBAI</b>

Thị trường BĐS UAE (Dubai) đạt quy mô <b>200 tỷ USD dòng tiền/năm</b>, với tốc độ tăng trưởng giao dịch gấp đôi mỗi 3-4 năm (130K giao dịch năm 2022 → dự báo 350K-420K giao dịch giai đoạn 2027-2030).

Nhưng thị trường này vẫn đang vận hành <b>phân mảnh và tiềm ẩn nhiều rủi ro</b>.

━━━━━━━━━━━━━━━━━━━
<b>ATLAS là gì?</b>
Nền tảng công nghệ — "hệ điều hành" tiên phong chuẩn hóa toàn bộ chuỗi giá trị giao dịch BĐS Dubai. Tích hợp <b>tìm kiếm → kiểm tra → thanh toán → sang tên</b> trong 1 hệ thống duy nhất (One-Stop-Shop).

<b>3 lỗ hổng Atlas giải quyết:</b>
🔴 Không có môi trường đồng nhất — buộc qua môi giới với chính sách giá thiếu minh bạch
🔴 Khách hàng bị bất ngờ về giá chốt cuối cùng — bị thao túng giá bởi bên thứ ba
🔴 Rủi ro giấy tờ pháp lý và lừa đảo truyền thống kìm hãm dòng tiền đầu tư

<b>3 giải pháp cốt lõi:</b>
✅ Giá niêm yết minh bạch trên nền tảng — loại bỏ hoàn toàn thao túng giá
✅ Xóa bỏ rào cản địa lý — NĐT không cần có mặt tại Dubai để giao dịch
✅ Bảo vệ tuyệt đối — ngăn chặn rủi ro giấy phép và lừa đảo

━━━━━━━━━━━━━━━━━━━
<b>MÔ HÌNH DOANH THU:</b>
Phí hoa hồng hệ thống <b>1%</b> trên mỗi giao dịch.
Ví dụ: Căn hộ 300,000 USD → phí nền tảng 3,000 USD.

Kịch bản theo thị phần:
📌 0.1% thị trường = Doanh thu <b>2 triệu USD</b>
📌 1% thị trường = Doanh thu <b>20 triệu USD</b>
📌 3% thị trường = Doanh thu <b>60 triệu USD</b>

<b>Dự phóng tài chính:</b>
→ Năm 1: Doanh thu 3.15 triệu USD, lợi nhuận ròng ~2 triệu USD — <b>chi trả cổ tức ngay năm đầu tiên</b>
→ Năm 3: Lợi nhuận dự kiến bứt phá <b>80 triệu USD</b>

Tài sản trí tuệ Atlas được <b>Dubai World Trade Center</b> định giá <b>92 triệu USD</b>.

⚠️ Vòng Private đang mở. Đóng cửa vào <b>${DEADLINE}</b> — còn <b>${daysLeft} ngày</b>.`;
        keyboard = [
            [{ text: '💰 Gói đầu tư IP Shares & Dòng tiền SPV', callback_data: 'atlas_ip_shares' }],
            [{ text: '🛡️ Cấu trúc SPV bảo vệ vốn thế nào?', callback_data: 'field_spv' }],
            ...nutsLienKet()
        ];
    }

    else if (data === 'atlas_ip_shares') {
        imageUrl = IMG_ATLAS;
        text = `💰 <b>GÓI ĐẦU TƯ IP SHARES & CƠ CHẾ DÒNG TIỀN SPV</b>

━━━━━━━━━━━━━━━━━━━
<b>CHỈ SỐ GÓI ĐẦU TƯ IP SHARES:</b>

📌 Giá hiện tại: <b>0.625 USD / 1 IP Share</b>
📌 Chiết khấu Early Bird: <b>60%</b> (quy đổi 1:60)
📌 Gói thấp nhất: <b>250 USD</b> = 400 IP shares
📌 Gói cao nhất: <b>5,000 USD</b> = 8,000 IP shares
📌 Dự phóng giá sau vòng 1: <b>3.8 USD/share</b> (tăng trưởng ~6 lần giá vốn)

━━━━━━━━━━━━━━━━━━━
<b>CƠ CHẾ VẬN HÀNH DÒNG TIỀN (ALL-OR-NOTHING):</b>

<b>📤 Chiều Vốn đi: NĐT → Quỹ SPV → Atlas</b>
Vốn của NĐT KHÔNG đưa trực tiếp cho cá nhân hay đội ngũ dự án.
Vốn được chuyển vào tài khoản Escrow của Quỹ SPV (Special Purpose Vehicle).
Chỉ khi gọi đủ ngân sách thành công, SPV mới giải ngân cho Atlas để xây dựng App MVP.
Nếu dự án hủy → <b>hoàn trả 100% vốn tự động</b>.

<b>📥 Chiều Lãi về: Atlas → Quỹ SPV → Ví NĐT</b>
Ngay từ năm đầu tiên (lợi nhuận ròng dự tính 2 triệu USD), Atlas đã có khả năng chi trả cổ tức.
Lợi nhuận kinh doanh từ nền tảng Atlas → đổ về Quỹ trung gian SPV → tự động chia và chảy thẳng về Ví hệ thống của NĐT.
<b>Hoàn toàn tự động, minh bạch.</b>

━━━━━━━━━━━━━━━━━━━
<b>LỘ TRÌNH 3 GIAI ĐOẠN:</b>
GĐ1: Xây dựng MVP, thị trường UAE
GĐ2: Mở rộng toàn UAE, tích hợp AI định giá
GĐ3: Singapore, Hồng Kông, Anh, Pháp

⚠️ Giai đoạn 1 — giá vốn rẻ nhất. Còn <b>${daysLeft} ngày</b>.`;
        keyboard = [
            [{ text: '🏢 Xem tổng quan dự án ATLAS', callback_data: 'atlas_chi_tiet' }],
            [{ text: '🛡️ Cấu trúc SPV bảo vệ vốn', callback_data: 'field_spv' }],
            ...nutsLienKet()
        ];
    }

    // ==================================================
    // NHÁNH ROAD TO $1M
    // ==================================================
    else if (data === 'road1m_gioi_thieu') {
        imageUrl = IMG_ROAD;
        text = `🗺️ <b>CON ĐƯỜNG ĐẾN $1,000,000 — TOÁN HỌC, KHÔNG PHẢI PHÉP THUẬT</b>

Hãy cùng làm một phép tính đời thường:

Mỗi tháng anh/chị chi bao nhiêu cho cà phê, trà sữa, ăn vặt? 
Trung bình khoảng 500,000 - 1,000,000đ? 
Trong 20 năm, số tiền đó = <b>120 - 240 triệu đồng</b> bay hơi không để lại gì.

Nhưng nếu anh/chị có kỷ luật, trích ra chỉ <b>$100-$200/tháng (2.5 - 5 triệu VNĐ)</b>,
đầu tư vào cổ phiếu blue-chip Mỹ trả cổ tức đều đặn qua hệ thống SWC:

📌 Với $150/tháng × 20%/năm:
→ 10 năm: ~$46,000 (~1.2 tỷ VNĐ)
→ 15 năm: ~$145,000 (~3.6 tỷ VNĐ)
→ 20 năm: ~$300,000 (~7.5 tỷ VNĐ)
→ 30 năm: ~$2,100,000 (~52.5 tỷ VNĐ)

<b>Điều đặc biệt:</b> Thông qua cấu trúc SPV chuẩn SEC Mỹ, anh/chị sẽ <b>sở hữu cổ phiếu hợp pháp</b> — có giấy chứng nhận cổ đông, quyền nhận cổ tức, quyền biểu quyết, quyền thoái vốn khi IPO. Không phải token, không phải lời hứa hẹn.

━━━━━━━━━━━━━━━━━━━
<b>3 TRIẾT LÝ VẬN HÀNH:</b>

<b>1. Commercial Cows (Con Bò Sữa Thương Mại)</b>
Chỉ mua cổ phiếu của DN lớn Mỹ, làm ăn có lãi, trả cổ tức đều.
Ví dụ: Apple, Microsoft, Coca-Cola — những công ty trả cổ tức 20-30 năm liên tục.
Giống mua bò — không chờ bán thịt, mà <b>vắt sữa mỗi ngày</b>.

<b>2. DCA — Phương pháp Bình Quân Giá</b>
Đến tháng, cứ rót $100-$200 đúng như hệ thống báo.
Thị trường khủng hoảng, giá giảm → Mua được nhiều hơn (Sale-off!).
Ví dụ: Tháng 3/2020 COVID → ai mua DCA lúc đó, đến 2021 lãi 100%.

<b>3. Buy & Hold — Mua và Nắm Giữ</b>
Loại bỏ hoàn toàn sai lầm cảm tính. Warren Buffett giữ Coca-Cola từ 1988 đến nay.
Kỷ luật tàn nhẫn nhưng kết quả ngọt ngào.`;
        keyboard = [
            [{ text: '📊 Lợi ích thực chiến — Sự thật đằng sau kỷ luật', callback_data: 'road1m_loi_ich' }],
            [{ text: '🦈 Tại sao 95% F0 sắp chết? (Chuỗi thức ăn)', callback_data: 'road1m_chuoi_thuc_an' }],
            [{ text: '🧮 Xem bảng tính lãi kép chi tiết', callback_data: 'pass_toan_hoc' }],
            ...nutsLienKet()
        ];
    }

    else if (data === 'road1m_loi_ich') {
        imageUrl = IMG_ROAD2;
        text = `📊 <b>LỢI ÍCH THỰC CHIẾN — ĐẦU TƯ ĐỂ LÀM GÌ?</b>

Nhiều người nghĩ đầu tư là để khoe con số trong tài khoản.
<b>Sai lầm hoàn toàn.</b>

Mục tiêu thực sự chỉ có một:
<b>Tạo ra dòng tiền cổ tức thụ động vượt chi phí sinh hoạt.</b>

Khi tiền cổ tức sinh ra mỗi tháng > số tiền gia đình bạn chi tiêu,
đó là khoảnh khắc bạn chính thức "nghỉ hưu" và tự do —
bất kể bạn đang 30 hay 50 tuổi.

━━━━━━━━━━━━━━━━━━━
<b>LỢI ÍCH 1 — Triệt tiêu cảm xúc hoảng loạn</b>
Kẻ thù lớn nhất không phải đội lái — mà là tâm lý SỢ HÃI của chính bạn.

Khi thị trường đỏ máu, sập 30%:
→ F0 khóc lóc cắt lỗ, bán rẻ tài sản cho Cá Mập
→ Thành viên SWC nhận tín hiệu lạnh lùng: "Cơ hội ngàn năm có một, gom mạnh đi!"

Đó là cách người giàu thâu tóm tài sản của người nghèo trong mỗi khủng hoảng.

<b>LỢI ÍCH 2 — Tiết kiệm 10,000 giờ máu và nước mắt</b>
Đừng lãng phí tuổi trẻ cố gắng đọc báo cáo tài chính,
canh biểu đồ nến xanh đỏ, mất ngủ vì giá crypto.

Bạn có gia đình, có sự nghiệp, có cuộc sống.
Chuyên gia SWC đã phân tích sẵn mâm cỗ.
Việc của bạn: <b>tốn đúng 10 phút mỗi tháng để copy và xác nhận</b>.

<b>LỢI ÍCH 3 — Di sản cho thế hệ sau</b>
15 năm nữa con bạn vào đại học cần vốn?
Hay muốn để lại nền tảng tài chính cho con cháu?
Hệ thống này xây dựng bệ phóng đó — trong khi bạn vẫn đang sống cuộc sống của mình.`;
        keyboard = [
            [{ text: '🦈 Chuỗi thức ăn tài chính — F0 đang ở đâu?', callback_data: 'road1m_chuoi_thuc_an' }],
            ...nutsLienKet()
        ];
    }

    else if (data === 'road1m_chuoi_thuc_an') {
        imageUrl = IMG_ROAD;
        text = `🔱 <b>5 TẦNG CHUỖI THỨC ĂN — SỰ THẬT TÀN NHẪN CỦA THỊ TRƯỜNG</b>

Bạn không nghèo đi vì bạn thiếu thông tin.
Bạn nghèo vì bạn ngây thơ bước vào sòng bài
và chơi bằng bộ luật do kẻ khác viết ra.

━━━━━━━━━━━━━━━━━━━
<b>🏛️ Tầng 1 — Đấng Sáng Tạo (Chính Phủ & NHTW)</b>
Người in tiền, người thắt chặt lãi suất.
Họ không cần trade. Họ điều khiển cả đại dương.
FED hạ lãi suất → tài sản tăng. FED tăng lãi suất → bong bóng vỡ.

<b>🐋 Tầng 2 — Cá Voi (Các Quỹ Đầu Tư Tài Phiệt)</b>
Có hàng tỷ đô la. Luôn đi NGƯỢC đám đông.
Âm thầm gom mua dưới đáy khi bạn hoảng loạn bán ra.
Xả hàng ngập đầu khi bạn đang hưng phấn đu đỉnh.

<b>🎰 Tầng 3 — Đội Lái (Market Maker)</b>
Cố tình vẽ biểu đồ, tạo cây nến đỏ cắm thẳng đứng lúc 2 giờ sáng
để rũ bỏ những kẻ yếu bóng vía, cắt lỗ bán tháo.

<b>🐺 Tầng 4 — Sói Già (Smart Investors)</b>
Sống sót bằng kỷ luật thép. Chốt lời cắt lỗ không cảm xúc.
Số này cực kỳ hiếm hoi — chỉ 5–10% trong tổng số người đầu tư.

<b>😵 Tầng 5 — F0 (Sinh Vật Phù Du)</b>
Mua bằng lỗ tai nghe phím hàng.
Bán bằng cảm giác sợ hãi.
Đây là <b>mỏ thanh khoản dồi dào</b> nuôi sống 4 tầng trên.
<b>95% người tự trade đang chìm ở đây.</b>

━━━━━━━━━━━━━━━━━━━
💥 <b>NHẬN RA ĐIỀU GÌ CHƯA?</b>

Tự trade = tự trao tiền cho Tầng 2, 3.
SWC Pass = chiếc cần cẩu kéo bạn ra khỏi vũng lầy Tầng 5,
đặt bạn ngồi lên lưng Cá Voi để <b>cùng săn mồi!</b>`;
        keyboard = [
            [{ text: '📊 Lợi ích thực chiến của hệ thống', callback_data: 'road1m_loi_ich' }],
            ...nutsLienKet()
        ];
    }

    // ==================================================
    // NHÁNH HỎI ĐÁP
    // ==================================================
    else if (data === 'faq_chinh' || data === 'faq_quay_lai') {
        text = `❓ <b>HỎI ĐÁP — PHÁ VỠ RÀO CẢN TÂM LÝ</b>

Giữa "Bắt tay vào hành động" và "Tiếp tục đứng nhìn",
con người luôn tự bịa ra lý do để biện minh cho sự chần chừ.

Những câu hỏi dưới đây là những rào cản TÂM LÝ phổ biến nhất.
Hãy chọn câu hỏi bạn đang thực sự phân vân:`;
        keyboard = [
            [{ text: '1️⃣ Chuyển tiền mua Pass xong nhận được gì ngay?', callback_data: 'faq_1' }],
            [{ text: '2️⃣ Sao không tự học YouTube cho khỏi tốn tiền?', callback_data: 'faq_2' }],
            [{ text: '3️⃣ Tôi chưa có đủ $600 lúc này thì sao?', callback_data: 'faq_3' }],
            [{ text: '4️⃣ Để tiền ngân hàng có an toàn hơn không?', callback_data: 'faq_4' }],
            [{ text: '5️⃣ Có lừa đảo như Ponzi, đa cấp không?', callback_data: 'faq_5' }],
            [{ text: '6️⃣ Tôi tự đầu tư cũng được, cần gì Pass?', callback_data: 'faq_6' }],
            [{ text: '🏠 Quay về Menu Chính', callback_data: 'menu_chinh' }]
        ];
    }

    else if (data === 'faq_1') {
        text = `✅ <b>Chuyển tiền mua Pass xong, bạn nhận được gì NGAY?</b>

Bạn không mua một lời hứa hẹn mơ hồ.
Bạn mua một <b>kết quả có thể xem được ngay lập tức</b>.

Ngay khi kích hoạt thành công thẻ SWC Pass:

<b>Bước 1 — Trong vòng vài phút:</b>
Tín hiệu chiến lược của tháng đầu tiên hiển thị trong hệ thống.
Bạn sẽ thấy ngay: mua mã nào, rót bao nhiêu % vốn, vùng giá nào an toàn.

<b>Bước 2 — Sau khi đọc tín hiệu (~10 phút):</b>
Mở app chứng khoán cá nhân của bạn (Vanguard, IBKR, VPS, SSI...).
Đặt lệnh theo hướng dẫn. Tắt máy. Xong.

<b>Bước 3 — Hàng tháng:</b>
Nhận tín hiệu mới. Thực thi trong 10 phút. Tiếp tục cuộc sống bình thường.
Lãi kép làm việc trong khi bạn đang ngủ.

<b>Bạn không cần:</b>
❌ Học cách vẽ biểu đồ nến
❌ Hiểu báo cáo tài chính
❌ Canh thị trường 24/7
❌ Lo lắng "Hôm nay thị trường thế nào?"

Chuyên gia đã nấu cỗ sẵn.
Việc của bạn: <b>cầm đũa lên và ăn.</b>`;
        keyboard = [[{ text: '↩️ Quay lại danh sách câu hỏi', callback_data: 'faq_quay_lai' }], ...nutsLienKet()];
    }

    else if (data === 'faq_2') {
        text = `✅ <b>Tại sao không tự học YouTube cho khỏi tốn tiền?</b>

Kiến thức miễn phí trên mạng thì nhiều như rác.
Nhưng nếu chỉ cần "biết kiến thức" mà giàu,
thì thế giới này ai cũng là triệu phú đô la rồi.

<b>Sự thật phũ phàng:</b>
95% người thua lỗ khi tự đầu tư KHÔNG PHẢI vì thiếu kiến thức.
Mà vì thiếu <b>HỆ THỐNG ÉP KỶ LUẬT PHẢI THỰC THI</b>.

Tự học YouTube giống như:
→ Nằm trên giường êm nệm ấm đọc sách "Dạy bơi cấp tốc"
→ Biết lý thuyết hoàn hảo nhưng không bao giờ xuống nước

SWC Pass giống như:
→ Thực sự nhảy xuống hồ nước sâu với huấn luyện viên bơi lội kè bên
→ Không cho phép bạn "ngồi trên bờ nghĩ tiếp"

<b>Và quan trọng hơn:</b>
YouTube dạy bạn Kiến thức chung.
SWC Pass cung cấp <b>Tín hiệu cụ thể</b>: "Tháng này, mã cụ thể này, vùng giá cụ thể này, tỷ lệ % cụ thể này."

Sự khác biệt giữa "biết" và "làm được" là một vực thẳm.
SWC Pass đưa bạn qua vực thẳm đó.`;
        keyboard = [[{ text: '↩️ Quay lại danh sách câu hỏi', callback_data: 'faq_quay_lai' }], ...nutsLienKet()];
    }

    else if (data === 'faq_3') {
        text = `✅ <b>Chưa có đủ $600 lúc này thì tính sao?</b>

Hãy làm một phép toán của kẻ tỉnh táo:

$600 ÷ 5 năm = <b>$10/tháng = khoảng 250,000 VNĐ</b>

Mức giá này chỉ bằng:
→ 1 bát phở mỗi tuần
→ 1 tài khoản Netflix mà bạn thỉnh thoảng mới xem
→ 1 ly cà phê mỗi ngày (thậm chí còn rẻ hơn)

<b>Câu hỏi thật sự không phải "Tôi có đủ tiền không?"</b>
Câu hỏi thật sự là:
<i>"Tôi có chấp nhận tiếp tục mất nhiều hơn $10/tháng cho lạm phát không?"</i>

Lạm phát hiện tại: 2.4%/năm.
Nếu bạn có 100 triệu trong ngân hàng lãi suất thấp,
bạn đang mất ~2.4 triệu/năm (200,000/tháng) vào tay lạm phát — trong im lặng.

Còn SWC Pass: $10/tháng để có hệ thống bảo vệ và tăng trưởng tài sản.

<b>Chi phí cơ hội thực sự:</b>
Mỗi tháng trì hoãn = 1 tháng lãi kép vĩnh viễn mất đi.
Bắt đầu lúc 25 tuổi với $240/tháng
so với bắt đầu lúc 30 tuổi cùng số tiền đó:
Khác nhau <b>hàng trăm nghìn đô la</b> ở tuổi 45.`;
        keyboard = [[{ text: '↩️ Quay lại danh sách câu hỏi', callback_data: 'faq_quay_lai' }], ...nutsLienKet()];
    }

    else if (data === 'faq_4') {
        text = `✅ <b>Để tiền ngân hàng an toàn hơn không?</b>

Tư duy "Tiền mặt là vua" là <b>ảo giác an toàn nguy hiểm nhất</b> của tầng lớp trung lưu.

<b>Minh chứng bằng toán học:</b>

Năm 2015: $1,000 mua được 2–3 chiếc iPhone đời mới.
Năm 2025: Cũng $1,000 đó lấy từ két ra, chưa đủ mua 1 chiếc iPhone mới.

Cùng những tờ tiền đó. Sức mua đã bay đi quá nửa.
Đó không phải ẩn dụ. Đó là toán học.

<b>Kẻ cướp có tên: LẠM PHÁT</b>
Nó không gõ cửa. Không thông báo. Không để lại dấu vết.
Nó âm thầm trừ đi giá trị tiền của bạn mỗi ngày, mỗi tháng.

<b>Giới tinh anh làm gì với tiền mặt?</b>
Họ KHÔNG bao giờ tích trữ tiền mặt dài hạn.
Họ dùng mọi cách để chuyển hóa tiền mặt thành tài sản sinh lời:
cổ phiếu cổ tức, BĐS cho thuê, Private Equity, RWA...

Bởi vì họ hiểu: <b>Giữ tiền nằm im = đang từ từ mất đi</b>.

Câu hỏi không phải "Đầu tư hay không?"
Câu hỏi là: <b>"Bạn muốn trả phí cho lạm phát hay cho hệ thống làm việc cho bạn?"</b>`;
        keyboard = [[{ text: '↩️ Quay lại danh sách câu hỏi', callback_data: 'faq_quay_lai' }], ...nutsLienKet()];
    }

    else if (data === 'faq_5') {
        text = `✅ <b>Có lừa đảo như Ponzi, đa cấp không?</b>

Đây là câu hỏi quan trọng nhất và bạn xứng đáng được trả lời thẳng thắn.

<b>Sự khác biệt cốt lõi:</b>

<b>Ponzi/MLM:</b>
❌ Cam kết lãi suất cố định ảo (30%/tháng, 200%/năm)
❌ Giữ tiền của bạn trong hệ thống
❌ Trả lãi bằng tiền của nhà đầu tư mới
❌ Không có tài sản thực đứng sau
❌ Pháp lý mờ nhạt hoặc không có

<b>SWC Pass + SWC Field:</b>
✅ KHÔNG cam kết lãi suất — bạn tự quyết định mua gì
✅ KHÔNG giữ tiền của bạn — tiền nằm trong app chứng khoán cá nhân
✅ Bạn sở hữu tài sản thực: cổ phiếu, cổ phần SPV
✅ Pháp lý: Giấy phép quỹ đầu tư SEC Mỹ, tuân thủ MiFID II Châu Âu
✅ Kiểm toán được, minh bạch hoàn toàn

<b>Cách kiểm tra đơn giản nhất:</b>
Hỏi bất kỳ mô hình đầu tư nào:
<i>"Anh có GIỮ TIỀN của tôi không?"</i>

SWC trả lời: <b>KHÔNG. Tiền của bạn, bạn tự giữ.</b>
Ponzi trả lời: "Gửi tiền vào ví chung để sinh lời."

Sự khác biệt chỉ có vậy thôi.`;
        keyboard = [[{ text: '↩️ Quay lại danh sách câu hỏi', callback_data: 'faq_quay_lai' }], ...nutsLienKet()];
    }

    else if (data === 'faq_6') {
        text = `✅ <b>Tôi tự đầu tư cũng được, cần gì SWC Pass?</b>

Câu trả lời trung thực: <b>Bạn hoàn toàn CÓ THỂ tự đầu tư.</b>
Nhưng hãy xem bạn đang ở Tầng nào.

<b>Tự đầu tư — bạn đang ở Tầng 2:</b>
Mua cổ phiếu trên sàn công khai.
Giá đã phản ánh thông tin. Bạn mua cùng giá với hàng triệu người khác.
Lợi nhuận giới hạn ở 10–15%/năm nếu chọn đúng.

<b>SWC Pass — bạn được ngồi mâm Tầng 1 (Venture Capital):</b>
Mua tài sản ở vòng Private — TRƯỚC KHI lên sàn công khai.
Cùng tài sản đó, bạn vào giá $0.10 trong khi đám đông vào giá $1.00.
Khi tài sản lên sàn, bạn đã lãi x10 từ đầu.

<b>Ví dụ thực tế:</b>
Amazon IPO năm 1997 giá $18/cổ phiếu (vòng Public).
Nhà đầu tư vòng Private vào trước đó với giá $0.30.
Khi bán lúc $18, họ đã lãi 60 lần trong khi bạn chỉ vừa được mua.

<b>Tóm lại:</b>
Tự đầu tư = đi bộ, an toàn nhưng chậm.
SWC Pass = đi cùng đoàn người có bản đồ, xe cộ và kinh nghiệm.

Cùng điểm đến. Nhưng ai đến trước?`;
        keyboard = [[{ text: '↩️ Quay lại danh sách câu hỏi', callback_data: 'faq_quay_lai' }], ...nutsLienKet()];
    }

    // ADMIN CALLBACKS
    else if (data === 'admin_thongke' && callbackQuery.from.id.toString() === ADMIN_ID) {
        const total = await User.countDocuments();
        const coSDT = await User.countDocuments({ phone: { $ne: '' } });
        const nong = await User.countDocuments({ giaiDoanPheu: 'nong' });
        const quanTam = await User.countDocuments({ giaiDoanPheu: 'quan_tam' });
        const daMua = await User.countDocuments({ giaiDoanPheu: 'da_mua' });
        const hoatDong24h = await User.countDocuments({ lanCuoiHoatDong: { $gte: new Date(Date.now() - 86400000) } });
        bot.sendMessage(ADMIN_ID,
            `📊 <b>THỐNG KÊ SWC ACADEMY</b>\n\n👥 Tổng users: ${total}\n📞 Có SĐT: ${coSDT}\n🔥 Nóng: ${nong}\n👀 Quan tâm: ${quanTam}\n✅ Đã mua: ${daMua}\n📱 Hoạt động 24h: ${hoatDong24h}\n⏳ Còn lại: ${getDaysLeft()} ngày`,
            { parse_mode: 'HTML' });
        return;
    }
    else if (data === 'admin_lenh' && callbackQuery.from.id.toString() === ADMIN_ID) {
        bot.sendMessage(ADMIN_ID,
            `📋 <b>LỆNH ADMIN:</b>\n\n<b>👥 Quản lý user:</b>\n/tracuu [ID] — Xem hồ sơ khách\n/setpass [ID] [gói] — Cập nhật gói Pass\n/setpheu [ID] [giai_doan] — Cập nhật phễu\n/note [ID] [ghi chú] — Lưu ghi chú\n/reset [ID] — Reset lịch sử AI\n\n<b>💳 SWC Pass:</b>\n/passlist — Xem DS đã kích hoạt Pass\n/passnolist — Xem DS chưa kích hoạt\n/passgoogle [email] — Tra cứu theo Gmail\n/passrevoke [email] — Huỷ SWC Pass\n\n<b>📢 Broadcast:</b>\n/sendall [nội dung] — Gửi tất cả\n/sendpheu [giai_doan] [nội dung] — Gửi theo phễu\n/thongbao [nội dung] — Gửi Group`,
            { parse_mode: 'HTML' });
        return;
    }

    // SWC PASS — Admin bấm nút kích hoạt → hiện chọn gói
    else if (data.startsWith('activate_pass_') && callbackQuery.from.id.toString() === ADMIN_ID) {
        const email = data.replace('activate_pass_', '');
        const user = await User.findOne({ googleEmail: email });
        if (!user) { bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy user: ${email}`); return; }
        bot.sendMessage(ADMIN_ID,
            `🔑 <b>CHỌN GÓI SWC PASS</b>\n\n👤 ${user.googleName || user.firstName}\n📧 <code>${email}</code>\n\nChọn gói kích hoạt:`,
            {
                parse_mode: 'HTML', reply_markup: {
                    inline_keyboard: [
                        [{ text: '📅 1 Năm', callback_data: 'passtier_1year_' + email }],
                        [{ text: '📅 5 Năm', callback_data: 'passtier_5year_' + email }],
                        [{ text: '♾️ Vĩnh Viễn', callback_data: 'passtier_lifetime_' + email }],
                        [{ text: '❌ Huỷ', callback_data: 'cancel_pass' }]
                    ]
                }
            });
        return;
    }

    // SWC PASS — Admin chọn gói (1 năm / 5 năm / vĩnh viễn)
    else if (data.startsWith('passtier_') && callbackQuery.from.id.toString() === ADMIN_ID) {
        const parts = data.replace('passtier_', '').split('_');
        const tierKey = parts[0]; // 1year, 5year, lifetime
        const email = parts.slice(1).join('_');
        try {
            const user = await User.findOne({ googleEmail: email });
            if (!user) { bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy: ${email}`); return; }

            const now = new Date();
            let expiry = null;
            let tierName = '';
            let passTier = '';

            if (tierKey === '1year') {
                expiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
                tierName = '1 Năm';
                passTier = '1_year';
            } else if (tierKey === '5year') {
                expiry = new Date(now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000);
                tierName = '5 Năm';
                passTier = '5_year';
            } else {
                expiry = null;
                tierName = 'Vĩnh Viễn';
                passTier = 'lifetime';
            }

            user.goiPass = 'essential';
            user.swcPassActivated = true;
            user.giaiDoanPheu = 'da_mua';
            user.passTier = passTier;
            user.passExpiry = expiry;
            user.passActivatedAt = now;
            await user.save();

            const expiryText = expiry ? expiry.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Không giới hạn';
            bot.sendMessage(ADMIN_ID,
                `✅ <b>ĐÃ KÍCH HOẠT SWC PASS!</b>\n\n👤 Tên: <b>${user.googleName || user.firstName}</b>\n📧 Email: <code>${email}</code>\n💳 Gói: <b>${tierName}</b>\n📅 Hết hạn: ${expiryText}\n⏱️ Kích hoạt lúc: ${now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n\n🎉 Thành viên sẽ được mở khoá khi reload trang Academy.`,
                {
                    parse_mode: 'HTML', reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔴 Huỷ SWC Pass', callback_data: 'revoke_pass_' + email }],
                            [{ text: '📊 Thống kê', callback_data: 'admin_thongke' }]
                        ]
                    }
                });
        } catch (e) {
            bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`);
        }
        return;
    }

    // SWC PASS — Admin huỷ pass
    else if (data.startsWith('revoke_pass_') && callbackQuery.from.id.toString() === ADMIN_ID) {
        const email = data.replace('revoke_pass_', '');
        try {
            const user = await User.findOne({ googleEmail: email });
            if (!user) { bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy: ${email}`); return; }
            user.goiPass = 'chua_co';
            user.swcPassActivated = false;
            user.passTier = '';
            user.passExpiry = null;
            user.passActivatedAt = null;
            user.giaiDoanPheu = 'quan_tam';
            await user.save();
            bot.sendMessage(ADMIN_ID,
                `🔴 <b>ĐÃ HUỶ SWC PASS</b>\n\n📧 <code>${email}</code>\n👤 ${user.googleName || user.firstName}\n\n⚠️ Thành viên sẽ bị khoá quyền truy cập khoá học.`,
                { parse_mode: 'HTML' });
        } catch (e) {
            bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`);
        }
        return;
    }

    else if (data === 'cancel_pass') { return; }

    if (text !== '') {
        bot.deleteMessage(chatId, messageId).catch(() => { });
        if (imageUrl) {
            bot.sendPhoto(chatId, imageUrl, { caption: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } })
                .catch(() => bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }));
        } else {
            bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
        }
    }
});

// ==========================================================
// XỬ LÝ TIN NHẮN TỰ DO — TRỢ LÝ SWC & ADMIN
// ==========================================================
bot.on('message', async (msg) => {
    if (!msg.from || msg.from.is_bot || msg.chat.type !== 'private') return;
    if (msg.contact || (msg.text && msg.text.startsWith('/'))) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // ADMIN TRẢ LỜI LẠI KHÁCH
    if (userId === ADMIN_ID && msg.reply_to_message) {
        const textGoc = msg.reply_to_message.text || msg.reply_to_message.caption || '';
        const match = textGoc.match(/ID:\s*(\d+)/);
        if (match) {
            const targetId = match[1];
            await bot.sendMessage(targetId,
                `👨‍💻 <b>Phản hồi từ Đội ngũ Chuyên gia SWC:</b>\n\n${msg.text || msg.caption}`,
                { parse_mode: 'HTML' }).catch(() => { });
            bot.sendMessage(ADMIN_ID, `✅ Đã gửi phản hồi cho khách ID: <code>${targetId}</code>`, { parse_mode: 'HTML' });
            await User.updateOne({ userId: targetId }, {
                $set: { adminPausedAiDen: new Date(Date.now() + 2 * 3600000) }
            });
            return;
        }
    }

    // KHÁCH GỬI TIN — GỌI AI TRỢ LÝ SWC
    if (userId !== ADMIN_ID) {
        let user = await User.findOne({ userId });
        if (!user) {
            user = new User({
                userId,
                firstName: msg.from.first_name || '',
                lastName: msg.from.last_name || '',
                username: msg.from.username ? `@${msg.from.username}` : ''
            });
            await user.save();
        }
        user.lanCuoiHoatDong = new Date();

        // Forward file/ảnh cho admin
        if (msg.photo || msg.video || msg.document) {
            await bot.forwardMessage(ADMIN_ID, chatId, msg.message_id).catch(() => { });
            bot.sendMessage(ADMIN_ID,
                `📎 <b>TỆP TỪ KHÁCH HÀNG</b>\n👤 ${user.firstName} ${user.lastName}\n🆔 ID: <code>${userId}</code>\nGhi chú: ${msg.caption || 'Không có'}\n\n<i>Reply tin này để chat trực tiếp (AI bị tạm khóa 2h)</i>`,
                { parse_mode: 'HTML' }).catch(() => { });
        }

        // Nếu admin đang xử lý — chỉ forward, không gọi AI
        const now = new Date();
        if (user.adminPausedAiDen && user.adminPausedAiDen > now) {
            bot.sendMessage(ADMIN_ID,
                `💬 <b>KHÁCH TRẢ LỜI (CHẾ ĐỘ ADMIN)</b>\n👤 ${user.firstName}\n🆔 ID: <code>${userId}</code>\nNội dung: ${msg.text || '[Tệp]'}\n\n<i>Reply để tiếp tục chat</i>`,
                { parse_mode: 'HTML' }).catch(() => { });
            return;
        }

        // Typing delay tự nhiên
        bot.sendChatAction(chatId, 'typing').catch(() => { });
        const noiDung = msg.text || msg.caption || '[Khách gửi tệp]';
        const camXuc = phanTichCamXuc(noiDung);
        const delay = { ngan_gon: 800, buon: 2000, hoai_nghi: 2500, lo_lang: 1500, phan_khich: 1200 }[camXuc] || Math.min(noiDung.length * 15, 3000);
        await new Promise(r => setTimeout(r, delay));

        const phanHoiAI = await goiClaude(user, noiDung);
        await bot.sendMessage(chatId, phanHoiAI, { parse_mode: 'HTML' }).catch(() => {
            bot.sendMessage(chatId, phanHoiAI);
        });

        // LUÔN chuyển tiếp TẤT CẢ tin nhắn cho Admin để theo dõi & can thiệp khi cần
        bot.sendMessage(ADMIN_ID,
            `💬 <b>KHÁCH ĐANG CHAT</b>\n👤 ${user.firstName} ${user.lastName}\n🆔 ID: <code>${userId}</code>\nTâm trạng: ${camXuc} | Quan tâm: ${user.moiQuanTamChinh}\nPhễu: ${user.giaiDoanPheu}\n\n💬 <b>Khách:</b> ${noiDung.substring(0, 300)}\n🤖 <b>Trợ lý:</b> ${phanHoiAI.substring(0, 400)}\n\n<i>Reply tin này để cướp quyền chat (AI tạm khóa 2h)</i>`,
            { parse_mode: 'HTML' }).catch(() => { });
    }
});

// ==========================================================
// DRIP FUNNEL 5 GIAI ĐOẠN — CHĂM SÓC THEO HÀNH TRÌNH
// ==========================================================
const DRIP = {
    1: (ten, dl) => `Anh/chị ${ten} ơi, Trợ lý SWC đây! 🤝

Rất vui được kết nối. Em hiểu ngoài kia có quá nhiều thông tin tài chính — đôi khi nhiều đến mức khiến mình không biết bắt đầu từ đâu.

Em chia sẻ 1 ví dụ nhỏ nhé: Hãy tưởng tượng mỗi tháng anh/chị chi khoảng 500,000đ cho cà phê, trà sữa. Trong 10 năm = 60 triệu đồng bay hơi. Nhưng nếu 60 triệu đó được đầu tư với lãi kép 20%/năm, nó sẽ thành khoảng 370 triệu đồng. Chênh lệch hơn 300 triệu chỉ vì 1 thói quen nhỏ.

Để bắt đầu đúng chỗ, em có một câu hỏi:
<i>"Nếu ngày mai anh/chị buộc phải ngừng làm việc trong 6 tháng, cuộc sống có bị ảnh hưởng không?"</i>

Nếu CÓ — thì chúng ta cần nói chuyện nghiêm túc về việc xây dựng dòng tiền thụ động.
Còn ${dl} ngày để anh/chị có cơ hội tốt nhất. 🗺️`,

    3: (ten, dl) => `Anh/chị ${ten} ơi, em muốn chia sẻ một góc nhìn mà ít ai nói thẳng:

95% người tự đầu tư đều thua lỗ. Không phải vì họ dốt. Mà vì họ đang chơi trong một sân chơi mà <b>luật do kẻ khác viết ra</b>.

Ví dụ thực tế: Anh A có 50 triệu, tự mua cổ phiếu theo "phím" trên Facebook. Thị trường giảm 20%, hoảng loạn bán → mất 10 triệu. Trong khi đó, người có hệ thống nhìn thấy "giá sale 20%" → mua thêm → 6 tháng sau lãi 30%.

Cùng một thị trường, nhưng 2 kết quả hoàn toàn khác nhau. Khác biệt duy nhất: HỆ THỐNG.

Thị trường tài chính có 5 tầng chuỗi thức ăn. F0 tự trade đang ngồi ở Tầng 5 — tầng thấp nhất, là mồi cho 4 tầng trên.

SWC Pass không phải khóa học. Nó là hệ thống kéo anh/chị ra khỏi Tầng 5.

Anh/chị muốn em giải thích cụ thể hơn không? Còn ${dl} ngày.`,

    7: (ten, dl) => `Anh/chị ${ten}, em muốn gửi một bài toán mà ai cũng làm được:

Chỉ cần $100-$200/tháng (tương đương 2.5-5 triệu VNĐ) × lãi kép 20%/năm:

📌 Với $150/tháng:
→ 10 năm: ~$46,000 (~1.2 tỷ VNĐ)
→ 15 năm: ~$145,000 (~3.6 tỷ VNĐ)
→ 20 năm: ~$300,000 (~7.5 tỷ VNĐ)

Ví dụ đời thường: $150/tháng chỉ bằng 5,000đ/ngày — ít hơn 1 ly trà đá. Nhưng khoản tiền nhỏ đó, nếu được đầu tư đều đặn vào cổ phiếu blue-chip Mỹ trả cổ tức qua hệ thống SWC, sau 20 năm sẽ thành một gia sản thực sự.

Và điều quan trọng: anh/chị sẽ SỞ HỮU CỔ PHIẾU CHUẨN MỸ — có giấy chứng nhận cổ đông, quyền cổ tức, quyền biểu quyết. Không phải token hay lời hứa hẹn.

Mỗi tháng trì hoãn = 1 tháng sức mạnh lãi kép vĩnh viễn mất đi.
Còn ${dl} ngày để anh/chị bắt đầu ở giá tốt nhất. 📈`,

    14: (ten, dl) => `Anh/chị ${ten} ơi, có tin quan trọng về dự án ATLAS tại Dubai:

Đây là "Grab của ngành BĐS" — gom toàn bộ quy trình mua-bán vào 1 app.
Đang ở Giai đoạn 1 — vòng Private, giá gốc, trước khi công chúng biết đến.

Ví dụ dễ hiểu: Ngày xưa ai mua cổ phiếu Amazon vòng Private giá $0.30/cp, khi lên sàn IPO $18/cp → lãi 60 lần. Nhà đầu tư vòng Public mua giá $18 thì đã muộn hơn rất nhiều. ATLAS đang ở giai đoạn "giá $0.30" đó.

Điều đặc biệt: chỉ cần $50 để sở hữu cổ phần hợp pháp qua SPV chuẩn Mỹ.
Bảo vệ vốn All-or-Nothing: không đủ KPI → hoàn 100%.

Anh/chị muốn em gửi chi tiết về dự án không?
Còn ${dl} ngày để vào vòng Private. 🏢`,

    21: (ten, dl) => `Anh/chị ${ten} — em cần nói thẳng.

Chúng ta đã trò chuyện một thời gian. Em biết anh/chị hiểu giá trị của SWC Pass.

Em chia sẻ 1 câu chuyện thật: Có anh B, 35 tuổi, lương 15 triệu/tháng. Mỗi tháng chi tiêu hết sạch. 10 năm đi làm = gần 2 tỷ đồng đã qua tay nhưng tài khoản tiết kiệm gần như trống. Nếu anh ấy chỉ cần trích $150/tháng (~3.7 triệu) từ 10 năm trước với lãi kép → bây giờ đã có hơn 1 tỷ VNĐ.

Còn ${dl} ngày. Sau ngày ${DEADLINE}, cánh cửa đóng lại.
Không phải chiêu marketing. Khi đủ 1,000 thành viên, hệ thống khóa hoàn toàn.

Câu hỏi thẳng thắn: <i>"Anh/chị cần thêm thông tin gì để có thể quyết định?"</i>

Em ở đây để giải đáp bất kỳ thắc mắc nào. 💬`
};

async function guiDripMessage(userId, buoc) {
    try {
        const user = await User.findOne({ userId });
        if (!user || user.khongNhanBroadcast || user.goiPass !== 'chua_co') return;
        const fn = DRIP[buoc];
        if (!fn) return;
        const text = fn(user.firstName || 'bạn', getDaysLeft());
        const keyboard = { inline_keyboard: nutsLienKet() };
        const img = [IMG_MAIN, IMG_ROAD, IMG_FIELD, IMG_ATLAS, IMG_HANG][Object.keys(DRIP).indexOf(String(buoc)) % 5];
        await bot.sendPhoto(userId, img, { caption: text, parse_mode: 'HTML', reply_markup: keyboard })
            .catch(() => bot.sendMessage(userId, text, { parse_mode: 'HTML', reply_markup: keyboard }));
        user.buocPheuHienTai = buoc;
        user.ngayPheuGuiCuoi = new Date();
        await user.save();
    } catch (e) { console.error('Lỗi drip:', e.message); }
}

// Tự động xoá tin nhắn cộng đồng sau 7 ngày (chạy mỗi giờ)
setInterval(async () => {
    const bayNgayTruoc = new Date(Date.now() - 7 * 86400000);
    await ChatMsg.deleteMany({ createdAt: { $lt: bayNgayTruoc } }).catch(() => {});
}, 3600000);

// Kiểm tra drip mỗi 1 giờ
setInterval(async () => {
    const now = new Date();
    const users = await User.find({ khongNhanBroadcast: { $ne: true }, goiPass: 'chua_co' }).catch(() => []);
    for (const user of users) {
        const ngayTG = new Date(user.ngayThamGia);
        const soNgay = Math.floor((now - ngayTG) / 86400000);
        const buocHienTai = user.buocPheuHienTai || 0;
        for (const buoc of [1, 3, 7, 14, 21]) {
            if (soNgay >= buoc && buocHienTai < buoc) {
                await guiDripMessage(user.userId, buoc);
                await new Promise(r => setTimeout(r, 500));
                break;
            }
        }
    }
}, 3600000);

// ==========================================================
// RE-ENGAGEMENT — NHẮN NGƯỜI IM LẶNG
// ==========================================================
async function tacDongNguoiImLang() {
    const baBaSo = new Date(Date.now() - 3 * 86400000);
    const danhSach = await User.find({
        khongNhanBroadcast: { $ne: true },
        goiPass: 'chua_co',
        lanCuoiHoatDong: { $lt: baBaSo },
        giaiDoanPheu: { $in: ['quan_tam', 'nong'] },
        userId: { $regex: /^\d+$/ }
    }).catch(() => []);

    const mauTin = [
        (ten) => `${ten} ơi, dạo này thị trường đang có nhiều biến động thú vị. Ví dụ: lãi suất FED đang ở mức 3.625% — điều này ảnh hưởng trực tiếp đến dòng tiền toàn cầu. Anh/chị có muốn em cập nhật phân tích chi tiết không?`,
        (ten) => `Chào ${ten}! Em vừa cập nhật phân tích vĩ mô tháng này. M2 đang ở Vùng Hoàng Kim 3-5% — đây là tín hiệu rất quan trọng cho nhà đầu tư. Anh/chị còn quan tâm không?`,
        (ten) => `${ten} ơi, em chia sẻ 1 con số: gói Plus 5 năm chỉ $10/tháng — bằng giá 2 ly trà sữa. Nhưng 2 ly trà sữa mỗi tháng × 5 năm = 3 triệu VNĐ bay hơi. Cùng số tiền đó với SWC Pass = tấm bản đồ bảo vệ gia sản. Muốn em giải thích thêm không?`
    ];

    for (const user of danhSach) {
        const tin = mauTin[Math.floor(Math.random() * mauTin.length)](user.firstName || 'bạn');
        const keyboard = { inline_keyboard: [[{ text: 'Muốn biết thêm', callback_data: 'menu_chinh' }], ...nutsLienKet().slice(-1)] };
        await bot.sendMessage(user.userId, tin, { reply_markup: keyboard }).catch(() => { });
        await new Promise(r => setTimeout(r, 300));
    }
}

// ==========================================================
// BROADCAST LỊCH TỰ ĐỘNG
// ==========================================================
function layGioVN() { return new Date(new Date().getTime() + 7 * 3600000); }

async function guiToanBo(noiDung, anhUrl = null, chiBaoGomPheu = null) {
    const dieuKien = { khongNhanBroadcast: { $ne: true }, userId: { $regex: /^\d+$/ } };
    if (chiBaoGomPheu) dieuKien.giaiDoanPheu = { $in: Array.isArray(chiBaoGomPheu) ? chiBaoGomPheu : [chiBaoGomPheu] };
    const danhSach = await User.find(dieuKien);
    let thanhCong = 0; let thatBai = 0;
    for (const user of danhSach) {
        try {
            if (anhUrl) {
                await bot.sendPhoto(user.userId, anhUrl, { caption: noiDung, parse_mode: 'HTML', reply_markup: { inline_keyboard: nutsLienKet() } });
            } else {
                await bot.sendMessage(user.userId, noiDung, { parse_mode: 'HTML', reply_markup: { inline_keyboard: nutsLienKet() } });
            }
            thanhCong++;
        } catch (e) { thatBai++; }
        await new Promise(r => setTimeout(r, 70));
    }
    return { thanhCong, thatBai, tongSo: danhSach.length };
}

// ==========================================================
// MẢNG TIN NHẮN XOAY VÒNG — BUỔI TRƯA / CHIỀU / TỐI
// ==========================================================
const TIN_BUOI_TRUA = [
    (dl) => `☀️ <b>KIẾN THỨC TÀI CHÍNH BUỔI TRƯA</b>\n\nLãi kép — Kỳ quan thứ 8 (Einstein):\n$150/tháng × 20%/năm:\n📌 10 năm → ~$46,000\n📌 20 năm → ~$300,000\n📌 30 năm → ~$2,100,000\n\nBắt đầu SỚM + kỷ luật ĐỀU ĐẶN.\nCòn ${dl} ngày! 🚀`,
    (dl) => `☀️ <b>GÓC NHÌN TÀI CHÍNH BUỔI TRƯA</b>\n\nBuffett: "Giá cả là thứ bạn trả. Giá trị là thứ bạn nhận."\n\nLy cà phê 50K/ngày = $600/năm bay hơi.\nCùng $600 đó đầu tư lãi kép 20 năm = hàng trăm triệu.\n\nCòn ${dl} ngày! 💡`,
    (dl) => `☀️ <b>BÀI HỌC BUỔI TRƯA — 6 CHIẾC LỌ</b>\n\n💰 55% Thiết yếu\n📚 10% Giáo dục\n🎉 10% Hưởng thụ\n💸 10% Tiết kiệm\n📈 10% Tự do tài chính\n🤝 5% Cho đi\n\nNgười giàu phân bổ tiền TRƯỚC khi tiêu.\nCòn ${dl} ngày! ⏳`,
    (dl) => `☀️ <b>TƯ DUY BUỔI TRƯA — CHUỖI THỨC ĂN</b>\n\n🏛️ Tầng 1: NHTW — In tiền\n🐋 Tầng 2: Cá Voi — Đi ngược đám đông\n🎰 Tầng 3: Market Maker\n🐺 Tầng 4: Smart Investors\n😵 Tầng 5: F0 — Mua bằng cảm xúc\n\n95% tự trade ở Tầng 5. SWC kéo bạn lên Tầng 4.\nCòn ${dl} ngày! 🎯`,
    (dl) => `☀️ <b>PHÂN TÍCH VĨ MÔ BUỔI TRƯA</b>\n\n📊 FED: 3.625%\n📊 M2 YoY: +4.29% (Vùng Hoàng Kim)\n📊 DXY: 98-100\n📊 CPI: 2.4%\n\nTín hiệu: RÚT KIẾM, gom tài sản lõi.\nCòn ${dl} ngày! 📈`,
    (dl) => `☀️ <b>BUỔI TRƯA — LẠM PHÁT</b>\n\nLạm phát 2.4%/năm ăn mòn tiền bạn.\n100 triệu ngân hàng = mất ~2.4 triệu/năm sức mua.\n\n❌ Tiết kiệm 30 năm: ~54,000 USD\n✅ Lãi kép SWC 30 năm: ~2,100,000 USD\nChênh lệch gần 40 lần!\nCòn ${dl} ngày! 💰`,
    (dl) => `☀️ <b>CÂU CHUYỆN BUỔI TRƯA</b>\n\nAnh B, 35 tuổi, lương 15 triệu/tháng.\n10 năm = gần 2 tỷ đồng qua tay.\nTài khoản: gần trống.\n\nNếu trích $150/tháng từ 10 năm trước → đã có hơn 1 tỷ VNĐ.\n\nKhác biệt: KỶ LUẬT phân bổ tiền.\nCòn ${dl} ngày! 🚀`,
    (dl) => `☀️ <b>SO SÁNH BUỔI TRƯA</b>\n\nCùng $10/tháng:\n❌ 2 ly trà sữa → bay hơi 30 phút\n❌ 1 tháng Netflix → giải trí rồi quên\n✅ SWC Pass → bản đồ bảo vệ gia sản 5 năm\n\n$10/tháng × 5 năm = tín hiệu đầu tư + SWC Field + cổ phiếu chuẩn Mỹ\nCòn ${dl} ngày! 💳`,
    (dl) => `☀️ <b>TRIẾT LÝ BUỔI TRƯA</b>\n\nTư Mã Ý — Tam Quốc: Mài gươm 10 năm, vung 1 nhát.\n\nDCA $150/tháng × 10-15 năm:\n📌 Năm 10: ~$46,000\n📌 Năm 15: ~$145,000 (gấp 3!)\n📌 Năm 20: ~$300,000 (gấp 6.5!)\n\nKiên nhẫn là vũ khí mạnh nhất.\nCòn ${dl} ngày! ⚔️`,
    (dl) => `☀️ <b>BUỔI TRƯA — SPV</b>\n\nSPV — Tấm khiên pháp lý:\n✅ Mỗi dự án 1 pháp nhân riêng\n✅ Sở hữu cổ phiếu HỢP PHÁP\n✅ Pháp luật Mỹ/EU bảo chứng\n✅ All-or-Nothing: không đủ KPI → hoàn 100%\n\nSWC KHÔNG GIỮ TIỀN. Tiền nằm trong app CÁ NHÂN.\nCòn ${dl} ngày! 🛡️`
];

const TIN_BUOI_CHIEU = [
    (dl) => `🌆 <b>CẬP NHẬT BUỔI CHIỀU</b>\n\nVào Group cộng đồng:\n✅ Tiến độ ATLAS Dubai\n✅ Chiến lược Lãi Kép\n✅ Kết nối nhà đầu tư tinh hoa\n✅ Tín hiệu thị trường\n\nCòn ${dl} ngày! ⏳`,
    (dl) => `🌆 <b>BUỔI CHIỀU — ATLAS DUBAI</b>\n\nBĐS Dubai: 200 tỷ USD/năm.\nAtlas — "Grab của BĐS" — vòng Private.\nIP Share: 0.625 USD → Dự phóng 3.8 USD (gấp ~6 lần).\n\nCòn ${dl} ngày vào vòng Private! 🏢`,
    (dl) => `🌆 <b>BUỔI CHIỀU — DCA</b>\n\nTháng 3/2020 — COVID sập 35%:\n→ F0 bán tháo, mất 50% vốn\n→ Người DCA: "Sale 35%!" → mua thêm\n→ 12 tháng sau: lãi 100%\n\nCùng thị trường, khác hệ thống = khác kết quả.\nCòn ${dl} ngày! 📊`,
    (dl) => `🌆 <b>BUỔI CHIỀU — COMMERCIAL COWS</b>\n\nKhông mua cổ phiếu chờ bán thịt.\nMua để VẮT SỮA mỗi tháng (cổ tức).\n\nApple, Microsoft, Coca-Cola — trả cổ tức 20-30 năm.\nCổ tức > chi phí sinh hoạt = TỰ DO TÀI CHÍNH.\nCòn ${dl} ngày! 🐄`,
    (dl) => `🌆 <b>BUỔI CHIỀU — SWC FIELD</b>\n\n✅ Đầu tư vòng Private từ $50\n✅ Chỉ 1% dự án được chọn\n✅ All-or-Nothing bảo vệ vốn\n✅ SPV minh bạch — pháp lý Mỹ, EU\n\n$50 = tấm vé ngồi chung mâm Cá Mập.\nCòn ${dl} ngày! 🦈`,
    (dl) => `🌆 <b>BUỔI CHIỀU — QUYỀN CỔ ĐÔNG</b>\n\nĐầu tư qua SWC = cổ phiếu chuẩn Mỹ qua SPV:\n📜 Giấy chứng nhận cổ đông\n💰 Quyền nhận cổ tức\n🗳️ Quyền biểu quyết\n🚪 Quyền thoái vốn khi IPO\n\nTÀI SẢN THỰC — không phải token.\nCòn ${dl} ngày! 📋`,
    (dl) => `🌆 <b>BUỔI CHIỀU — CHI PHÍ CƠ HỘI</b>\n\nMỗi năm trì hoãn = 1 năm lãi kép VĨNH VIỄN mất đi.\n\nBắt đầu 25 tuổi vs 30 tuổi, $150/tháng:\n→ 25 tuổi → 50 tuổi: ~$300,000\n→ 30 tuổi → 50 tuổi: ~$145,000\nChênh: $155,000 vì 5 năm trì hoãn!\nCòn ${dl} ngày! ⏰`,
    (dl) => `🌆 <b>BUỔI CHIỀU — ĐẮC NHÂN TÂM</b>\n\nCarnegie: "Cách duy nhất thắng tranh luận là tránh tranh luận."\n\nĐầu tư cũng vậy — đừng tranh luận với thị trường.\nThị trường luôn đúng. Cảm xúc luôn sai.\n\nSWC giúp loại bỏ cảm xúc, hành động theo dữ liệu.\nCòn ${dl} ngày! 🧠`,
    (dl) => `🌆 <b>BUỔI CHIỀU — DÒNG TIỀN 4 MÙA</b>\n\n🌸 Xuân: Lãi suất hạ → CS/Crypto\n☀️ Hạ: BĐS sốt\n🍂 Thu: NHTW tăng lãi suất\n❄️ Đông: Tiết kiệm/Vàng/USD\n\nKẻ thắng = kẻ CHUẨN BỊ ĐÓN nước.\nCòn ${dl} ngày! 🗺️`,
    (dl) => `🌆 <b>BUỔI CHIỀU — 17 TƯ DUY TRIỆU PHÚ</b>\n\n💡 Người giàu: "Tôi TẠO RA cuộc đời tôi"\n💡 Chơi để THẮNG\n💡 Suy nghĩ LỚN\n💡 Tập trung CƠ HỘI\n💡 Bắt tiền PHỤC VỤ mình\n\nBạn đang ở tư duy nào?\nCòn ${dl} ngày! 💎`
];

const TIN_BUOI_TOI = [
    (dl) => `🔔 <b>NHẮC NHỞ TỐI — CÒN ${dl} NGÀY!</b>\n\n2 loại người:\nLoại 1: F0 stress, nhìn chart đỏ mắt...\nLoại 2: Có SWC Pass — ngủ ngon, hệ thống tự chạy 😴\n\nUltimate (Vĩnh viễn) đóng cửa vào ${DEADLINE}.\nKhông ngoại lệ.`,
    (dl) => `🌙 <b>SUY NGẪM TỐI</b>\n\nHôm nay bạn đã làm gì cho tương lai tài chính?\n✅ Đọc 1 bài đầu tư?\n✅ Trích tiền vào quỹ?\n✅ Kiểm tra danh mục?\n\nMỗi ngày 1 hành động nhỏ = 365 bước/năm.\nCòn ${dl} ngày! 🎯`,
    (dl) => `🌙 <b>TỐI — CÂU CHUYỆN LÃI KÉP</b>\n\nNếu tổ tiên gửi 1 xu vàng 200 năm trước với lãi kép 5%/năm...\nHôm nay bạn có hơn 17,000 xu vàng.\n\nLãi kép không nhanh. Nhưng KHÔNG BAO GIỜ DỪNG.\nCòn ${dl} ngày! ⏳`,
    (dl) => `🌙 <b>TỐI — RỦI RO THỰC SỰ</b>\n\nRủi ro lớn nhất = KHÔNG ĐẦU TƯ.\nLạm phát 2.4%/năm × 20 năm = mất ~40% sức mua.\n100 triệu → chỉ còn sức mua 60 triệu.\n\nTiền mặt đang chết từ từ.\nCòn ${dl} ngày! 💸`,
    (dl) => `🌙 <b>TỐI — ATLAS UPDATE</b>\n\n🏗️ GĐ1: MVP, thị trường UAE\n🌍 GĐ2: Mở rộng + AI định giá\n🚀 GĐ3: Singapore, HK, Anh, Pháp\n\nIP Share 0.625 USD → Dự phóng 3.8 USD (gấp ~6 lần)\nĐang ở GĐ1 — giá rẻ nhất.\nCòn ${dl} ngày! 🏢`,
    (dl) => `🌙 <b>TỐI — BUFFETT</b>\n\n"Tôi luôn biết tôi sẽ giàu. Chưa bao giờ nghi ngờ." — Buffett\n\nÔng đầu tư từ 11 tuổi. Và nói bắt đầu QUÁ MUỘN.\nBạn bao nhiêu tuổi? Đã bắt đầu chưa?\nCòn ${dl} ngày! 📈`,
    (dl) => `🌙 <b>TỐI — SWC PASS VS QUỸ MỞ</b>\n\nQuỹ mở: cắn xén 2% TỔNG tài sản/năm.\n1 tỷ → mất 20 triệu phí. 10 tỷ → 200 triệu.\n\nSWC Pass: $10/tháng CỐ ĐỊNH.\nKiếm triệu đô, phí vẫn $10.\nCòn ${dl} ngày! 💳`,
    (dl) => `🌙 <b>TỐI — BẠN ĐANG Ở TẦNG NÀO?</b>\n\nTự đầu tư = giá thị trường (Tầng 2).\nSWC Pass = vòng Private, trước khi lên sàn (Tầng 1).\n\nAmazon: $0.30/cp (Private) vs $18/cp (Public) = lãi 60 lần.\nCòn ${dl} ngày vào vòng Private! 🎯`,
    (dl) => `🌙 <b>TỐI — 4 BƯỚC TIẾN HÓA</b>\n\n1️⃣ Giảm chi tiêu — bịt lỗ hổng\n2️⃣ Tăng thu nhập — bơm nước\n3️⃣ Đầu tư — bắt tiền làm nô lệ\n4️⃣ Đòn bẩy — chỉ khi thắng 1-2-3\n\n90% làm NGƯỢC = tự sát.\nCòn ${dl} ngày! ⚡`,
    (dl) => `🌙 <b>TỐI — ULTIMATE SẮP ĐÓNG</b>\n\nGói Ultimate ($2,600) — Vĩnh viễn:\n✅ Truy cập KHÔNG GIỚI HẠN mãi mãi\n✅ Di sản cho con cháu\n✅ 20 năm: chỉ $130/năm\n\n⚠️ ĐÓNG CỬA VĨNH VIỄN vào ${DEADLINE}.\nCòn ${dl} ngày! 💎`
];

setInterval(async () => {
    const gio = layGioVN();
    const h = gio.getUTCHours();
    const m = gio.getUTCMinutes();
    const daysLeft = getDaysLeft();
    const ngay = gio.getUTCDate();

    if (h === 8 && m === 0) {
        const baiHoc = TIN_NHAN_30_NGAY[ngay] || TIN_NHAN_30_NGAY[1];
        const tin = `🌅 <b>CHÀO BUỔI SÁNG — BÀI HỌC TÂM LÝ & ĐẦU TƯ</b>\n\n${baiHoc}\n\n⏳ Còn <b>${daysLeft} ngày</b> để gia nhập hệ thống SWC!`;
        await guiToanBo(tin, IMG_MAIN);
    }

    // BUỔI TRƯA — XOAY VÒNG 10 tin khác nhau theo ngày
    if (h === 12 && m === 0) {
        const idx = ngay % TIN_BUOI_TRUA.length;
        const tin = TIN_BUOI_TRUA[idx](daysLeft);
        const anhArr = [IMG_ROAD, IMG_FIELD, IMG_MAIN, IMG_ATLAS, IMG_HANG];
        await guiToanBo(tin, anhArr[idx % anhArr.length]);
    }

    // BUỔI CHIỀU — XOAY VÒNG 10 tin khác nhau theo ngày
    if (h === 19 && m === 30) {
        const idx = ngay % TIN_BUOI_CHIEU.length;
        const tin = TIN_BUOI_CHIEU[idx](daysLeft);
        const anhArr = [IMG_FIELD, IMG_ATLAS, IMG_ROAD, IMG_MAIN, IMG_HANG];
        await guiToanBo(tin, anhArr[idx % anhArr.length]);
    }

    // BUỔI TỐI — XOAY VÒNG 10 tin khác nhau (chỉ gửi phễu nóng + quan_tam)
    if (h === 20 && m === 30) {
        const idx = ngay % TIN_BUOI_TOI.length;
        const tin = TIN_BUOI_TOI[idx](daysLeft);
        await guiToanBo(tin, IMG_HANG, ['nong', 'quan_tam']);
    }

    if (h === 10 && m === 0) await tacDongNguoiImLang();
}, 60000);

// ==========================================================
// ADMIN PANEL & CÁC LỆNH QUẢN TRỊ
// ==========================================================
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id, `👨‍💻 <b>ADMIN PANEL SWC ACADEMY</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📊 Thống kê phễu', callback_data: 'admin_thongke' }],
                [{ text: '📋 Bảng lệnh quản trị', callback_data: 'admin_lenh' }]
            ]
        }
    });
});

bot.onText(/\/(xoa|del)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    if (msg.reply_to_message) {
        try {
            await bot.deleteMessage(msg.chat.id, msg.reply_to_message.message_id);
            await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {
            bot.sendMessage(ADMIN_ID, `❌ Lỗi khi xoá tin nhắn: ${e.message}`);
        }
    }
});

bot.onText(/\/sendall ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const tongSo = await User.countDocuments({ userId: { $regex: /^\d+$/ }, khongNhanBroadcast: { $ne: true } });
    bot.sendMessage(ADMIN_ID, `⏳ Đang gửi tin cho ${tongSo} người (Telegram ID hợp lệ)...`);
    const kq = await guiToanBo(match[1], IMG_MAIN);
    bot.sendMessage(ADMIN_ID, `✅ <b>KẾT QUẢ</b>\n📤 Tổng: ${kq.tongSo}\n✅ Thành công: ${kq.thanhCong}\n❌ Thất bại: ${kq.thatBai}`, { parse_mode: 'HTML' });
});

bot.onText(/\/sendpheu (\w+) ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const kq = await guiToanBo(match[2], IMG_MAIN, match[1]);
    bot.sendMessage(ADMIN_ID, `✅ Phễu "${match[1]}": ${kq.thanhCong}/${kq.tongSo} thành công, ${kq.thatBai} thất bại`);
});

bot.onText(/\/tracuu (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const user = await User.findOne({ userId: match[1] });
    if (!user) return bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy user ID: ${match[1]}`);
    const lanCuoi = user.lanCuoiHoatDong ? new Date(user.lanCuoiHoatDong).toLocaleString('vi-VN') : 'Chưa có';
    bot.sendMessage(ADMIN_ID,
        `🔎 <b>HỒ SƠ KHÁCH HÀNG</b>\n🆔 ID: <code>${match[1]}</code>\n📧 Email: <code>${user.googleEmail || 'Chưa liên kết'}</code>\n👤 Tên: ${user.firstName} ${user.lastName}\n📱 Username: ${user.username || 'Không có'}\n📞 SĐT: ${user.phone || 'Chưa có'}\n🎯 Phễu: ${user.giaiDoanPheu}\n💳 Gói Pass: ${user.passTier || user.goiPass}\n💬 Số tin nhắn: ${user.soTinNhan || 0}\n🕐 Lần cuối: ${lanCuoi}\n😊 Tâm trạng: ${user.camXucGanNhat || 'chưa xác định'}\n🎯 Quan tâm: ${user.moiQuanTamChinh || 'chưa xác định'}\n📝 Ghi chú: ${user.ghiChu || 'Không có'}`,
        { parse_mode: 'HTML' });
});

bot.onText(/\/setpass (\d+) (\w+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const goi = match[2].toLowerCase();
    if (!['chua_co', 'essential', 'plus', 'ultimate'].includes(goi)) return bot.sendMessage(ADMIN_ID, `❌ Sai gói! Dùng: chua_co / essential / plus / ultimate`);
    await User.updateOne({ userId: match[1] }, { $set: { goiPass: goi, giaiDoanPheu: goi !== 'chua_co' ? 'da_mua' : 'nong' } });
    bot.sendMessage(ADMIN_ID, `✅ Đã cập nhật gói <b>${goi}</b> cho ID: ${match[1]}`, { parse_mode: 'HTML' });
});

bot.onText(/\/setpheu (\d+) (\w+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const giaiDoan = match[2].toLowerCase();
    if (!['moi', 'quan_tam', 'nong', 'da_mua'].includes(giaiDoan)) return bot.sendMessage(ADMIN_ID, `❌ Sai giai đoạn! Dùng: moi / quan_tam / nong / da_mua`);
    await User.updateOne({ userId: match[1] }, { $set: { giaiDoanPheu: giaiDoan } });
    bot.sendMessage(ADMIN_ID, `✅ Đã cập nhật phễu: ${giaiDoan} cho ID: ${match[1]}`);
});

bot.onText(/\/note (\d+) ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    await User.updateOne({ userId: match[1] }, { $set: { ghiChu: match[2] } });
    bot.sendMessage(ADMIN_ID, `✅ Đã lưu ghi chú cho ID: ${match[1]}`);
});

bot.onText(/\/reset (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    await User.updateOne({ userId: match[1] }, { $set: { lichSuChat: [], adminPausedAiDen: null } });
    bot.sendMessage(ADMIN_ID, `✅ Đã reset lịch sử AI cho ID: ${match[1]}`);
});

bot.onText(/\/thongbao ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try {
        await bot.sendMessage(GROUP_USERNAME, `📢 <b>THÔNG BÁO TỪ BAN QUẢN TRỊ:</b>\n\n${match[1]}`, { parse_mode: 'HTML' });
        bot.sendMessage(ADMIN_ID, `✅ Đã gửi thông báo lên Group!`);
    } catch (e) { bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`); }
});

// ==========================================================
// THƯ VIỆN KIẾN THỨC — LỆNH ADMIN
// ==========================================================
const VALID_CATEGORIES = ['kien_thuc', 'du_an', 'tai_chinh', 'thu_thuat', 'tin_tuc'];
const CAT_LABELS = { kien_thuc: '📚 Kiến thức', du_an: '💎 Dự án', tai_chinh: '📊 Tài chính', thu_thuat: '💡 Thủ thuật', tin_tuc: '📰 Tin tức' };

// /post [danh_muc] | [tiêu đề] | [nội dung]
bot.onText(/\/post ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const parts = match[1].split('|').map(s => s.trim());
    if (parts.length < 3) {
        return bot.sendMessage(ADMIN_ID,
            `⚠️ <b>Cú pháp:</b>\n<code>/post danh_muc | Tiêu đề | Nội dung</code>\n\n<b>Danh mục:</b> ${VALID_CATEGORIES.join(', ')}\n\n<b>Ví dụ:</b>\n<code>/post kien_thuc | 17 Tư Duy Triệu Phú | Người giàu tin rằng...</code>`,
            { parse_mode: 'HTML' });
    }
    const [category, title, ...contentParts] = parts;
    const content = contentParts.join('|').trim();
    if (!VALID_CATEGORIES.includes(category.toLowerCase())) {
        return bot.sendMessage(ADMIN_ID, `❌ Danh mục không hợp lệ!\nDùng: ${VALID_CATEGORIES.join(', ')}`);
    }
    try {
        const article = new Knowledge({
            category: category.toLowerCase(),
            title,
            content,
            authorName: 'Hồ Văn Lợi'
        });
        await article.save();
        bot.sendMessage(ADMIN_ID,
            `✅ <b>ĐÃ ĐĂNG BÀI!</b>\n\n📂 Danh mục: ${CAT_LABELS[category.toLowerCase()]}\n📝 Tiêu đề: <b>${title}</b>\n🆔 ID: <code>${article._id}</code>\n\n👉 Xem tại: https://swcpass.com/academy/chat.html`,
            { parse_mode: 'HTML' });
    } catch (e) {
        bot.sendMessage(ADMIN_ID, `❌ Lỗi đăng bài: ${e.message}`);
    }
});

// /dsbai — Xem danh sách bài viết
bot.onText(/\/dsbai/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try {
        const articles = await Knowledge.find().sort({ createdAt: -1 }).limit(20);
        if (articles.length === 0) {
            return bot.sendMessage(ADMIN_ID, '📭 Thư viện hiện đang trống. Dùng /post để thêm bài.');
        }
        let text = `📖 <b>THƯ VIỆN KIẾN THỨC (${articles.length} bài mới nhất)</b>\n\n`;
        articles.forEach((a, i) => {
            const cat = CAT_LABELS[a.category] || a.category;
            const date = new Date(a.createdAt).toLocaleDateString('vi-VN');
            text += `${i + 1}. ${cat} — <b>${a.title}</b>\n   🆔 <code>${a._id}</code> • ${date}\n\n`;
        });
        text += `\n📋 <b>Lệnh:</b>\n/xoabai [ID] — Xóa bài\n/suabai [ID] | Nội dung mới — Sửa nội dung`;
        bot.sendMessage(ADMIN_ID, text, { parse_mode: 'HTML' });
    } catch (e) {
        bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`);
    }
});

// /xoabai [ID] — Xóa bài viết
bot.onText(/\/xoabai (.+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try {
        const result = await Knowledge.findByIdAndDelete(match[1].trim());
        if (result) {
            bot.sendMessage(ADMIN_ID, `✅ Đã xóa bài: <b>${result.title}</b>`, { parse_mode: 'HTML' });
        } else {
            bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy bài viết với ID: ${match[1]}`);
        }
    } catch (e) {
        bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`);
    }
});

// /suabai [ID] | [Nội dung mới] — Sửa nội dung bài viết
bot.onText(/\/suabai (.+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const parts = match[1].split('|').map(s => s.trim());
    if (parts.length < 2) {
        return bot.sendMessage(ADMIN_ID, `⚠️ Cú pháp: /suabai [ID] | [Nội dung mới]`);
    }
    try {
        const result = await Knowledge.findByIdAndUpdate(parts[0], { $set: { content: parts.slice(1).join('|').trim() } }, { new: true });
        if (result) {
            bot.sendMessage(ADMIN_ID, `✅ Đã cập nhật bài: <b>${result.title}</b>`, { parse_mode: 'HTML' });
        } else {
            bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy bài ID: ${parts[0]}`);
        }
    } catch (e) {
        bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`);
    }
});

// /getvideo [message_id] — Lấy video từ Private Channel
bot.onText(/\/getvideo (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try {
        const forwarded = await bot.forwardMessage(ADMIN_ID, '-1003951391128', parseInt(match[1]));
        if (forwarded.video) {
            const fileLink = await bot.getFileLink(forwarded.video.file_id);
            bot.sendMessage(ADMIN_ID, `🎬 <b>Video file link:</b>\n<code>${fileLink}</code>\n\nMessage ID: ${match[1]}`, { parse_mode: 'HTML' });
        } else {
            bot.sendMessage(ADMIN_ID, `✅ Đã forward message #${match[1]} — không phải video.`);
        }
    } catch (e) {
        bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`);
    }
});

// /xoachat [ngày] — Xóa tin nhắn cộng đồng
bot.onText(/\/xoachat (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try {
        const days = parseInt(match[1]);
        const cutoff = new Date(Date.now() - days * 86400000);
        const result = await ChatMsg.deleteMany({ createdAt: { $lt: cutoff } });
        bot.sendMessage(ADMIN_ID, `✅ Đã xoá <b>${result.deletedCount}</b> tin nhắn trên trang Cộng Đồng cũ hơn ${days} ngày.`, { parse_mode: 'HTML' });
    } catch (e) {
        bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`);
    }
});

// ==========================================================
// ADMIN PASS MANAGEMENT COMMANDS
// ==========================================================

// /passlist — Danh sách đã kích hoạt SWC Pass
bot.onText(/\/passlist/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({ goiPass: { $ne: 'chua_co' } }).sort({ passActivatedAt: -1 });
    if (users.length === 0) return bot.sendMessage(ADMIN_ID, '📭 Chưa có ai kích hoạt SWC Pass.');
    
    let text = `💳 <b>DANH SÁCH SWC PASS (${users.length})</b>\n\n`;
    const chunks = [];
    
    users.forEach((u, i) => {
        const tier = u.passTier === 'lifetime' ? '♾️ Vĩnh Viễn' : u.passTier === '5_year' ? '📅 5 Năm' : u.passTier === '1_year' ? '📅 1 Năm' : '📅 N/A';
        const expiry = u.passExpiry ? u.passExpiry.toLocaleDateString('vi-VN') : 'Không giới hạn';
        const daysLeft = u.passExpiry ? Math.ceil((u.passExpiry - new Date()) / 86400000) : '∞';
        const userText = `${i + 1}. ${u.googleName || u.firstName} — ${tier}\n   📧 <code>${u.googleEmail || 'Chưa liên kết'}</code>\n   ⏳ Còn ${daysLeft} ngày | Hết hạn: ${expiry}\n\n`;
        
        if (text.length + userText.length > 3900) {
            chunks.push(text);
            text = userText;
        } else {
            text += userText;
        }
    });
    if (text) chunks.push(text);
    
    for (const chunk of chunks) {
        await bot.sendMessage(ADMIN_ID, chunk, { parse_mode: 'HTML' });
    }
});

// /resetallpass — Reset tất cả SWC Pass
bot.onText(/\/resetallpass/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try {
        bot.sendMessage(ADMIN_ID, '⏳ Đang tiến hành reset toàn bộ SWC Pass...');
        const result = await User.updateMany(
            { goiPass: { $ne: 'chua_co' } },
            { $set: { goiPass: 'chua_co', passTier: '', passExpiry: null, swcPassActivated: false } }
        );
        bot.sendMessage(ADMIN_ID, `✅ Đã reset thành công SWC Pass cho ${result.modifiedCount} tài khoản về trạng thái chưa kích hoạt! Anh có thể bắt đầu cấp lại mới.`);
    } catch (e) {
        bot.sendMessage(ADMIN_ID, '❌ Lỗi reset: ' + e.message);
    }
});

// /passnolist — Danh sách chưa kích hoạt
bot.onText(/\/passnolist/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({ googleEmail: { $ne: '' }, goiPass: 'chua_co' }).sort({ ngayThamGia: -1 }).limit(30);
    if (users.length === 0) return bot.sendMessage(ADMIN_ID, '✅ Tất cả đều đã kích hoạt!');
    let text = `🔒 <b>CHƯA KÍCH HOẠT SWC PASS (${users.length})</b>\n\n`;
    users.forEach((u, i) => {
        text += `${i + 1}. ${u.googleName || u.firstName}\n   📧 <code>${u.googleEmail}</code>\n`;
    });
    bot.sendMessage(ADMIN_ID, text, {
        parse_mode: 'HTML', reply_markup: {
            inline_keyboard:
                users.slice(0, 5).map(u => [{ text: '✅ Kích hoạt ' + (u.googleName || u.googleEmail), callback_data: 'activate_pass_' + u.googleEmail }])
        }
    });
});

// /passgoogle [email] — Tra cứu theo Gmail
bot.onText(/\/passgoogle (.+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const email = match[1].trim().toLowerCase();
    const user = await User.findOne({ googleEmail: email });
    if (!user) return bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy: ${email}`);
    const tier = user.passTier === 'lifetime' ? '♾️ Vĩnh Viễn' : user.passTier === '5_year' ? '📅 5 Năm' : user.passTier === '1_year' ? '📅 1 Năm' : '❌ Chưa kích hoạt';
    const expiry = user.passExpiry ? user.passExpiry.toLocaleDateString('vi-VN') : 'N/A';
    const daysLeft = user.passExpiry ? Math.ceil((user.passExpiry - new Date()) / 86400000) : '∞';
    bot.sendMessage(ADMIN_ID,
        `👤 <b>THÔNG TIN USER</b>\n\n📧 Email: <code>${user.googleEmail}</code>\n👤 Tên: ${user.googleName}\n💬 Telegram: ${user.telegramUsername || 'N/A'}\n📱 Zalo: ${user.zaloPhone || 'N/A'}\n💳 Pass: ${tier}\n⏳ Còn: ${daysLeft} ngày\n📅 Hết hạn: ${expiry}\n🕐 Đăng ký: ${user.ngayThamGia.toLocaleDateString('vi-VN')}`,
        {
            parse_mode: 'HTML', reply_markup: {
                inline_keyboard: [
                    user.goiPass !== 'chua_co'
                        ? [{ text: '🔴 Huỷ SWC Pass', callback_data: 'revoke_pass_' + email }]
                        : [],
                    [{ text: '✅ Kích hoạt Gói 1 Năm', callback_data: 'passtier_1year_' + email }],
                    [{ text: '✅ Kích hoạt Gói 5 Năm', callback_data: 'passtier_5year_' + email }],
                    [{ text: '✅ Kích hoạt Vĩnh Viễn', callback_data: 'passtier_lifetime_' + email }]
                ].filter(row => row.length > 0)
            }
        });
});

// /passrevoke [email] — Huỷ SWC Pass
bot.onText(/\/passrevoke (.+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const email = match[1].trim().toLowerCase();
    const user = await User.findOne({ googleEmail: email });
    if (!user) return bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy: ${email}`);
    user.goiPass = 'chua_co';
    user.swcPassActivated = false;
    user.passTier = '';
    user.passExpiry = null;
    user.passActivatedAt = null;
    user.giaiDoanPheu = 'quan_tam';
    await user.save();
    bot.sendMessage(ADMIN_ID,
        `🔴 <b>ĐÃ HUỶ SWC PASS</b>\n\n📧 <code>${email}</code>\n👤 ${user.googleName}\n\n⚠️ Quyền truy cập khoá học đã bị thu hồi.`,
        { parse_mode: 'HTML' });
});

// ==========================================================
// FALLBACK — HƯỚNG DẪN KHI GÕ LỆNH SAI CÚ PHÁP
// ==========================================================
bot.onText(/^\/(tracuu|setpass|setpheu|note|reset|sendall|sendpheu|thongbao|passrevoke|passgoogle|xoabai|suabai|post|getvideo|xoachat)$/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const lenh = match[1].toLowerCase();
    const huongDan = {
        tracuu: '📋 <b>Cú pháp:</b>\n<code>/tracuu [ID]</code>\n\n<b>Ví dụ:</b>\n<code>/tracuu 507318519</code>\n\n→ Xem hồ sơ chi tiết của khách hàng theo Telegram ID.',
        setpass: '📋 <b>Cú pháp:</b>\n<code>/setpass [ID] [gói]</code>\n\n<b>Gói hợp lệ:</b> chua_co / essential / plus / ultimate\n\n<b>Ví dụ:</b>\n<code>/setpass 507318519 plus</code>',
        setpheu: '📋 <b>Cú pháp:</b>\n<code>/setpheu [ID] [giai_doan]</code>\n\n<b>Giai đoạn:</b> moi / quan_tam / nong / da_mua\n\n<b>Ví dụ:</b>\n<code>/setpheu 507318519 nong</code>',
        note: '📋 <b>Cú pháp:</b>\n<code>/note [ID] [ghi chú]</code>\n\n<b>Ví dụ:</b>\n<code>/note 507318519 Khách quan tâm gói Plus</code>',
        reset: '📋 <b>Cú pháp:</b>\n<code>/reset [ID]</code>\n\n<b>Ví dụ:</b>\n<code>/reset 507318519</code>\n\n→ Reset lịch sử chat AI của khách.',
        sendall: '📋 <b>Cú pháp:</b>\n<code>/sendall [nội dung]</code>\n\n<b>Ví dụ:</b>\n<code>/sendall Chào mọi người! Có thông báo mới...</code>\n\n→ Gửi tin nhắn đến TẤT CẢ users.',
        sendpheu: '📋 <b>Cú pháp:</b>\n<code>/sendpheu [giai_doan] [nội dung]</code>\n\n<b>Ví dụ:</b>\n<code>/sendpheu nong Anh/chị ơi, còn ít ngày nữa thôi!</code>',
        thongbao: '📋 <b>Cú pháp:</b>\n<code>/thongbao [nội dung]</code>\n\n<b>Ví dụ:</b>\n<code>/thongbao Chào mừng thành viên mới!</code>\n\n→ Gửi thông báo lên Group Chat.',
        passrevoke: '📋 <b>Cú pháp:</b>\n<code>/passrevoke [email]</code>\n\n<b>Ví dụ:</b>\n<code>/passrevoke user@gmail.com</code>\n\n→ Huỷ SWC Pass theo email.',
        passgoogle: '📋 <b>Cú pháp:</b>\n<code>/passgoogle [email]</code>\n\n<b>Ví dụ:</b>\n<code>/passgoogle user@gmail.com</code>\n\n→ Tra cứu thông tin theo Gmail.',
        xoabai: '📋 <b>Cú pháp:</b>\n<code>/xoabai [ID bài viết]</code>\n\n<b>Ví dụ:</b>\n<code>/xoabai 6543210abcdef</code>\n\n→ Dùng /dsbai để xem danh sách ID.',
        suabai: '📋 <b>Cú pháp:</b>\n<code>/suabai [ID] | [Nội dung mới]</code>\n\n<b>Ví dụ:</b>\n<code>/suabai 6543210abcdef | Nội dung đã cập nhật...</code>',
        post: '📋 <b>Cú pháp:</b>\n<code>/post [danh_muc] | [Tiêu đề] | [Nội dung]</code>\n\n<b>Danh mục:</b> kien_thuc / du_an / tai_chinh / thu_thuat / tin_tuc\n\n<b>Ví dụ:</b>\n<code>/post kien_thuc | 17 Tư Duy Triệu Phú | Người giàu tin rằng...</code>',
        getvideo: '📋 <b>Cú pháp:</b>\n<code>/getvideo [message_id]</code>\n\n<b>Ví dụ:</b>\n<code>/getvideo 12345</code>\n\n→ Lấy video từ Private Channel.',
        xoachat: '📋 <b>Cú pháp:</b>\n<code>/xoachat [số ngày]</code>\n\n<b>Ví dụ:</b>\n<code>/xoachat 7</code>\n\n→ Xoá toàn bộ tin nhắn chat trên trang Cộng Đồng cũ hơn 7 ngày.'
    };
    bot.sendMessage(ADMIN_ID, `⚠️ <b>THIẾU THAM SỐ!</b>\n\n${huongDan[lenh] || 'Lệnh không hợp lệ.'}`, { parse_mode: 'HTML' });
});

// ==========================================================
// HTTP SERVER + ACADEMY API ENDPOINTS
// ==========================================================
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

    try {
        // POST /api/notify — Thông báo login/signup cho Admin
        if (req.method === 'POST' && req.url === '/api/notify') {
            const data = await parseBody(req);
            const { action, name, email, phone, platform } = data;
            const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
            const icon = action === 'signup' ? '🆕' : '🔑';
            const label = action === 'signup' ? 'ĐĂNG KÝ MỚI' : 'ĐĂNG NHẬP';
            const message = `${icon} <b>${label} — SWC ACADEMY</b>\n\n👤 Tên: <b>${name || 'N/A'}</b>\n📧 Email: <code>${email || 'N/A'}</code>\n📞 SĐT: ${phone || 'Không có'}\n🕐 Thời gian: ${time}\n📱 Nền tảng: ${platform || 'Web'}`;
            await bot.sendMessage(NOTIFY_GROUP_ID, message, { parse_mode: 'HTML' });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true }));
        }

        // GET /api/comments — Lấy bình luận bài viết
        if (req.method === 'GET' && req.url.startsWith('/api/comments?articleId=')) {
            const articleId = new URL(req.url, 'http://localhost').searchParams.get('articleId');
            const comments = await Comment.find({ articleId }).sort({ createdAt: 1 }).limit(100);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true, data: comments }));
        }

        // POST /api/comments — Thêm bình luận mới
        if (req.method === 'POST' && req.url === '/api/comments') {
            const data = await parseBody(req);
            const cmt = new Comment(data);
            await cmt.save();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true }));
        }

        // GET /api/chat — Lấy lịch sử chat cộng đồng
        if (req.method === 'GET' && req.url === '/api/chat') {
            const msgs = await ChatMsg.find().sort({ createdAt: -1 }).limit(100);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true, data: msgs.reverse() }));
        }

        // POST /api/chat — Gửi tin nhắn mới lên cộng đồng
        if (req.method === 'POST' && req.url === '/api/chat') {
            const data = await parseBody(req);
            const msg = new ChatMsg(data);
            await msg.save();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true }));
        }

        // POST /api/chat-delete — Xóa tin nhắn cộng đồng
        if (req.method === 'POST' && req.url === '/api/chat-delete') {
            const { id, author } = await parseBody(req);
            const msg = await ChatMsg.findById(id);
            if (msg && msg.author === author) {
                await ChatMsg.findByIdAndDelete(id);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ ok: true }));
            }
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
        }
        // POST /api/auth/telegram — Xác thực Telegram Login
        if (req.method === 'POST' && req.url === '/api/auth/telegram') {
            const tgData = await parseBody(req);
            let user = await User.findOne({ userId: tgData.id.toString() });
            if (!user) {
                user = new User({
                    userId: tgData.id.toString(),
                    firstName: tgData.first_name || '',
                    lastName: tgData.last_name || '',
                    username: tgData.username ? `@${tgData.username}` : ''
                });
                await user.save();
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                ok: true,
                user: { id: user.userId, name: `${user.firstName} ${user.lastName}`.trim(), username: user.username, hasPass: user.goiPass !== 'chua_co', passType: user.goiPass }
            }));
        }

        // POST /api/check-pass — Kiểm tra SWC Pass
        if (req.method === 'POST' && req.url === '/api/check-pass') {
            const { telegramId } = await parseBody(req);
            const user = await User.findOne({ userId: telegramId });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true, hasPass: user ? user.goiPass !== 'chua_co' : false, passType: user ? user.goiPass : 'chua_co' }));
        }

        // POST /api/auth/google — Đăng nhập Google (2.2)
        if (req.method === 'POST' && req.url === '/api/auth/google') {
            const { email, name, picture, googleId } = await parseBody(req);
            const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

            // Tìm hoặc tạo user theo email
            let user = await User.findOne({ googleEmail: email });
            if (!user) {
                user = new User({
                    userId: 'google_' + (googleId || Date.now()),
                    firstName: name ? name.split(' ')[0] : '',
                    lastName: name ? name.split(' ').slice(1).join(' ') : '',
                    googleEmail: email,
                    googleName: name || '',
                    googleAvatar: picture || '',
                    googleId: googleId || '',
                    ngayThamGia: new Date()
                });
                await user.save();

                // Thông báo Admin — user mới đăng ký qua Google
                await bot.sendMessage(ADMIN_ID,
                    `🆕 <b>ĐĂNG KÝ MỚI — GOOGLE SIGN-IN</b>\n\n👤 Tên: <b>${name || 'N/A'}</b>\n📧 Email: <code>${email}</code>\n🕐 Thời gian: ${time}\n📱 Nền tảng: SWC Academy`,
                    {
                        parse_mode: 'HTML', reply_markup: {
                            inline_keyboard: [
                                [{ text: '✅ Kích hoạt SWC Pass', callback_data: 'activate_pass_' + email }],
                                [{ text: '📊 Xem thống kê', callback_data: 'admin_thongke' }]
                            ]
                        }
                    }).catch(() => { });
            } else {
                user.googleName = name || user.googleName;
                user.googleAvatar = picture || user.googleAvatar;
                user.lanCuoiHoatDong = new Date();
                await user.save();

                // Thông báo Admin — user quay lại
                await bot.sendMessage(ADMIN_ID,
                    `🔑 <b>ĐĂNG NHẬP LẠI — GOOGLE</b>\n\n👤 Tên: <b>${name || 'N/A'}</b>\n📧 Email: <code>${email}</code>\n🕐 Thời gian: ${time}\n💳 Pass: ${user.goiPass}`,
                    { parse_mode: 'HTML' }).catch(() => { });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true, isNew: !user.verified }));
        }

        // POST /api/check-verified — Kiểm tra user đã xác thực chưa
        if (req.method === 'POST' && req.url === '/api/check-verified') {
            const { email } = await parseBody(req);
            const user = await User.findOne({ googleEmail: email });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            if (user && user.verified) {
                return res.end(JSON.stringify({ ok: true, verified: true, hasPass: user.goiPass !== 'chua_co', passType: user.goiPass }));
            }
            return res.end(JSON.stringify({ ok: true, verified: false }));
        }

        // POST /api/verify-info — Lưu thông tin Telegram + Zalo sau Google login
        if (req.method === 'POST' && req.url === '/api/verify-info') {
            const { email, telegram, zaloPhone, passCode } = await parseBody(req);
            const user = await User.findOne({ googleEmail: email });
            if (!user) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ ok: false, error: 'User not found' }));
            }

            user.telegramUsername = telegram || '';
            user.zaloPhone = zaloPhone || '';
            user.verified = true;
            if (passCode) user.swcPassCode = passCode;
            await user.save();

            // Thông báo Admin
            const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
            await bot.sendMessage(ADMIN_ID,
                `📋 <b>XÁC THỰC THÔNG TIN</b>\n\n👤 Tên: <b>${user.googleName}</b>\n📧 Email: <code>${email}</code>\n💬 Telegram: ${telegram || 'Không có'}\n📱 Zalo: ${zaloPhone || 'Không có'}\n💳 Mã Pass: ${passCode || 'Không nhập'}\n🕐 ${time}`,
                {
                    parse_mode: 'HTML', reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Kích hoạt SWC Pass', callback_data: 'activate_pass_' + email }]
                        ]
                    }
                }).catch(() => { });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true, hasPass: user.goiPass !== 'chua_co', passType: user.goiPass }));
        }

        // POST /api/request-pass — Yêu cầu kích hoạt SWC Pass (1.4 + 2.7)
        if (req.method === 'POST' && req.url === '/api/request-pass') {
            const { email, name } = await parseBody(req);
            const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

            // Cập nhật passRequestedAt
            await User.updateOne({ googleEmail: email }, { $set: { passRequestedAt: new Date() } });

            // Gửi tin nhắn cho Admin với NÚT KÍCH HOẠT
            await bot.sendMessage(ADMIN_ID,
                `🔑 <b>YÊU CẦU KÍCH HOẠT SWC PASS!</b>\n\n👤 Tên: <b>${name || 'N/A'}</b>\n📧 Gmail: <code>${email}</code>\n🕐 Thời gian: ${time}\n\n⚡ Bấm nút bên dưới để kích hoạt:`,
                {
                    parse_mode: 'HTML', reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Kích hoạt Gói 1 Năm', callback_data: 'passtier_1year_' + email }],
                            [{ text: '✅ Kích hoạt Gói 5 Năm', callback_data: 'passtier_5year_' + email }],
                            [{ text: '✅ Kích hoạt Vĩnh Viễn', callback_data: 'passtier_lifetime_' + email }],
                            [{ text: '📊 Xem thống kê', callback_data: 'admin_thongke' }]
                        ]
                    }
                });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true }));
        }

        // POST /api/request-upgrade — Yêu cầu nâng cấp SWC Pass
        if (req.method === 'POST' && req.url === '/api/request-upgrade') {
            const { email, name, currentTier } = await parseBody(req);
            const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

            await bot.sendMessage(ADMIN_ID,
                `🚀 <b>YÊU CẦU NÂNG CẤP SWC PASS!</b>\n\n👤 Tên: <b>${name || 'N/A'}</b>\n📧 Gmail: <code>${email}</code>\n💳 Gói hiện tại: ${currentTier || 'N/A'}\n🕐 Thời gian: ${time}\n\n⚡ Bấm nút bên dưới để nâng cấp:`,
                {
                    parse_mode: 'HTML', reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Nâng cấp Gói 5 Năm', callback_data: 'passtier_5year_' + email }],
                            [{ text: '✅ Nâng cấp Vĩnh Viễn', callback_data: 'passtier_lifetime_' + email }]
                        ]
                    }
                });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true }));
        }


        // POST /api/check-pass-email — Kiểm tra SWC Pass bằng email
        if (req.method === 'POST' && req.url === '/api/check-pass-email') {
            const { email } = await parseBody(req);
            const user = await User.findOne({ googleEmail: email });
            if (!user) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ ok: true, hasPass: false, passType: 'chua_co' }));
            }
            // Auto-expire if past date
            if (user.passExpiry && new Date() > user.passExpiry && user.passTier !== 'lifetime') {
                user.goiPass = 'chua_co';
                user.swcPassActivated = false;
                user.passTier = '';
                user.passExpiry = null;
                user.passActivatedAt = null;
                user.giaiDoanPheu = 'quan_tam';
                await user.save();
                bot.sendMessage(ADMIN_ID, `⏰ <b>SWC Pass HẾT HẠN</b>\n\n📧 <code>${email}</code>\n👤 ${user.googleName}\n\nPass đã tự động bị vô hiệu hoá.`, { parse_mode: 'HTML' });
            }
            const daysLeft = user.passExpiry ? Math.ceil((user.passExpiry - new Date()) / 86400000) : null;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                ok: true,
                hasPass: user.goiPass !== 'chua_co',
                passType: user.goiPass,
                passTier: user.passTier || '',
                passExpiry: user.passExpiry || null,
                passActivatedAt: user.passActivatedAt || null,
                daysLeft: daysLeft
            }));
        }

        // POST /api/webhook — Lưu bài viết kiến thức từ Telegram
        if (req.method === 'POST' && req.url === '/api/webhook') {
            const { category, title, content, imageUrl, linkUrl } = await parseBody(req);
            const article = new Knowledge({ category, title, content, imageUrl, linkUrl });
            await article.save();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true, id: article._id }));
        }

        // GET /api/knowledge — Lấy danh sách bài viết
        if (req.method === 'GET' && req.url.startsWith('/api/knowledge')) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const category = url.searchParams.get('category');
            const query = category ? { category } : {};
            const articles = await Knowledge.find(query).sort({ createdAt: -1 }).limit(50);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true, data: articles }));
        }

        // Default
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('SWC Academy API + Trợ lý SWC — Running!\n');
    } catch (err) {
        console.error('API Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
    }
});

server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log(`🌐 Server khởi động port ${process.env.PORT || 3000}`);
    console.log('🚀 Trợ lý SWC + Academy API + Google Auth đã sẵn sàng!');
});

// ==========================================================
// CÂU NÓI TRIẾT LÝ 6H SÁNG (2.5)
// ==========================================================
const CAU_NOI_TRIET_LY = [
    '💡 "Thị trường là công cụ chuyển tiền từ túi người nóng vội sang túi người kiên nhẫn." — Warren Buffett',
    '💡 "Lãi kép là Kỳ quan thứ 8 của Thế giới. Ai hiểu nó, người đó kiếm được nó." — Albert Einstein',
    '💡 "Giá cả là những gì bạn phải trả. Giá trị là những gì bạn nhận được." — Warren Buffett',
    '💡 "Người giàu không làm việc vì tiền. Họ để tiền làm việc cho họ." — Robert Kiyosaki',
    '💡 "Nếu bạn sinh ra trong nghèo khó, đó không phải lỗi của bạn. Nhưng nếu bạn chết trong nghèo khó, đó là lỗi của bạn." — Bill Gates',
    '💡 "Cách duy nhất để làm việc vĩ đại là yêu những gì bạn làm." — Steve Jobs',
    '💡 "Hãy sợ khi người khác tham lam, và tham lam khi người khác sợ hãi." — Warren Buffett',
    '💡 "Đầu tư vào bản thân là khoản đầu tư sinh lời nhất mà bạn có thể thực hiện." — Warren Buffett',
    '💡 "Thành công là đi từ thất bại này đến thất bại khác mà không mất đi nhiệt huyết." — Winston Churchill',
    '💡 "Không phải kẻ mạnh nhất sống sót, cũng không phải kẻ thông minh nhất, mà là kẻ thích ứng tốt nhất." — Charles Darwin',
    '💡 "Kỷ luật là cầu nối giữa mục tiêu và thành tựu." — Jim Rohn',
    '💡 "Bạn không cần phải vĩ đại để bắt đầu, nhưng bạn phải bắt đầu để trở nên vĩ đại." — Zig Ziglar',
    '💡 "Tiền bạc không phải là tất cả, nhưng nó đứng cùng hàng với oxy." — Zig Ziglar',
    '💡 "Quy tắc số 1: Không bao giờ mất tiền. Quy tắc số 2: Không bao giờ quên quy tắc số 1." — Warren Buffett',
    '💡 "Người thắng cuộc không bao giờ bỏ cuộc, và người bỏ cuộc không bao giờ thắng." — Vince Lombardi',
    '💡 "Thời gian là bạn của doanh nghiệp tuyệt vời, là kẻ thù của doanh nghiệp tầm thường." — Warren Buffett',
    '💡 "Hãy đói khát. Hãy dại khờ." — Steve Jobs',
    '💡 "Mỗi ngày trì hoãn là 1 ngày sức mạnh lãi kép vĩnh viễn mất đi." — SWC Capital',
    '💡 "Con đường đến triệu đô không phải phép thuật. Chỉ là Toán học × Thời gian × Kỷ luật." — SWC Capital',
    '💡 "95% người thua lỗ không phải vì thiếu thông tin, mà vì thiếu hệ thống kỷ luật." — SWC Capital',
    '💡 "Tự trade = tự trao tiền cho Cá Mập. Hệ thống = ngồi trên lưng Cá Mập." — SWC Capital',
    '💡 "Người giàu tin rằng: Tôi tạo ra cuộc đời tôi. Người nghèo tin: Cuộc đời xảy đến với tôi." — T. Harv Eker',
    '💡 "$100-$200/tháng × 15-20 năm × lãi kép 20% = con đường đến triệu đô. Không phải may mắn — chỉ là kỷ luật." — SWC Capital',
    '💡 "Tiền mặt là rác. Tài sản sinh lời mới là vua." — Robert Kiyosaki',
    '💡 "Không ai có thể kiếm triệu đô với tư duy nghìn đô." — Grant Cardone',
    '💡 "Thị trường không phạt người sai — nó phạt người thiếu kỷ luật." — SWC Capital',
    '💡 "Khi mọi thứ dường như chống lại bạn, hãy nhớ máy bay cất cánh ngược gió." — Henry Ford',
    '💡 "Đừng tìm kiếm cơ hội — hãy tạo ra nó." — Chris Grosser',
    '💡 "Giàu có là khả năng trải nghiệm cuộc sống đầy đủ." — Henry David Thoreau',
    '💡 "Bạn bỏ lỡ 100% cú sút mà bạn không thực hiện." — Wayne Gretzky',
    '💡 "Tương lai thuộc về những người tin vào vẻ đẹp của ước mơ mình." — Eleanor Roosevelt'
];

async function guiCauNoiTrietLy() {
    const cauNoi = CAU_NOI_TRIET_LY[Math.floor(Math.random() * CAU_NOI_TRIET_LY.length)];
    const text = `🌅 <b>CHÀO BUỔI SÁNG — SWC CAPITAL</b>\n\n${cauNoi}\n\n🎯 <i>Mỗi ngày một bước tiến — kiên nhẫn và kỷ luật sẽ đưa bạn đến đích.</i>`;
    const danhSach = await User.find({ soTinNhan: { $gte: 1 }, userId: { $regex: /^\d+$/ } }).catch(() => []);
    for (const user of danhSach) {
        await bot.sendMessage(user.userId, text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎓 Vào SWC Academy', url: 'https://swcpass.com/academy/' }],
                    [{ text: '💬 Vào Nhóm Cộng Đồng', url: `https://t.me/${GROUP_USERNAME.replace('@', '')}` }]
                ]
            }
        }).catch(() => { });
        await new Promise(r => setTimeout(r, 100));
    }
    console.log(`✅ Đã gửi câu triết lý cho ${danhSach.length} người`);
}

// ==========================================================
// NHẮC ĐẦU TƯ ĐẦU THÁNG NGÀY 1-5 (2.4)
// ==========================================================
async function guiNhacDauTu() {
    const text = `📊 <b>NHẮC NHỞ ĐẦU TƯ HÀNG THÁNG</b>\n\nĐầu tháng rồi! Đây là thời điểm vàng để:\n\n💰 Trích $100-$200 đầu tư vào cổ phiếu blue-chip Mỹ theo chiến lược RM1\n📈 Kiểm tra và cập nhật danh mục đầu tư\n🎯 Kỷ luật DCA — mỗi tháng đều đặn, không bỏ lỡ\n\nVí dụ: $150/tháng chỉ bằng 5,000đ/ngày — ít hơn 1 ly trà đá. Nhưng sau 20 năm với lãi kép = ~$300,000 (~7.5 tỷ VNĐ).\n\nQuyền lợi: Sở hữu cổ phiếu chuẩn Mỹ qua SPV — có giấy chứng nhận cổ đông, quyền cổ tức.\n\nBấm nút bên dưới để xem danh mục:`;
    const danhSach = await User.find({ khongNhanBroadcast: { $ne: true }, userId: { $regex: /^\d+$/ } }).catch(() => []);
    for (const user of danhSach) {
        await bot.sendMessage(user.userId, text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🗺️ Xem danh mục RM1', url: ROAD_1M_URL }],
                    [{ text: '🎓 Vào SWC Academy', url: 'https://swcpass.com/academy/' }],
                    [{ text: '💬 Vào Nhóm Cộng Đồng', url: `https://t.me/${GROUP_USERNAME.replace('@', '')}` }],
                    [{ text: '🏠 Menu Chính', callback_data: 'menu_chinh' }]
                ]
            }
        }).catch(() => { });
        await new Promise(r => setTimeout(r, 100));
    }
    console.log(`✅ Đã gửi nhắc đầu tư cho ${danhSach.length} người`);
}

// ==========================================================
// NHẮC HỌC TẬP CHO SWC PASS MEMBER MỖI NGÀY (2.3)
// ==========================================================
const MAU_NHAC_HOC = [
    (ten) => `📚 Chào ${ten}! Hôm nay bạn đã dành 10 phút để học kiến thức mới chưa?\n\nMỗi ngày một bài — kiến thức sẽ tích lũy thành sức mạnh.\n\nVào SWC Academy ngay nhé! 🎓`,
    (ten) => `🧠 ${ten} ơi, kiến thức mới đang chờ bạn trên SWC Academy!\n\nĐừng quên cập nhật tin tức thị trường và đọc phân tích mới nhất.\n\nMỗi ngày tiến 1 bước — 365 bước/năm! 🚀`,
    (ten) => `💡 ${ten}, bạn đã vào nhóm chat SWC Capital hôm nay chưa?\n\nNhiều thông tin giá trị đang được chia sẻ. Đừng bỏ lỡ!\n\nVào nhóm ngay nhé! 💬`,
    (ten) => `📈 Chào ${ten}! Nhắc nhở: Kiểm tra danh mục đầu tư định kỳ.\n\nThành viên SWC Pass được cập nhật tín hiệu mới nhất hàng tháng.\n\nVào Academy để xem bài giảng mới! 🎓`
];

async function guiNhacHocTap() {
    const danhSach = await User.find({ goiPass: { $ne: 'chua_co' }, khongNhanBroadcast: { $ne: true }, userId: { $regex: /^\d+$/ } }).catch(() => []);
    for (const user of danhSach) {
        const mau = MAU_NHAC_HOC[Math.floor(Math.random() * MAU_NHAC_HOC.length)];
        const text = mau(user.firstName || user.googleName || 'bạn');
        await bot.sendMessage(user.userId, text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎓 Vào SWC Academy', url: 'https://swcpass.com/academy/' }],
                    [{ text: '📰 Thư viện Kiến thức', url: 'https://swcpass.com/academy/chat.html' }],
                    [{ text: '💬 Vào Nhóm Cộng Đồng', url: `https://t.me/${GROUP_USERNAME.replace('@', '')}` }],
                    [{ text: '🗺️ Danh mục RM1', url: ROAD_1M_URL }]
                ]
            }
        }).catch(() => { });
        await new Promise(r => setTimeout(r, 100));
    }
    console.log(`✅ Đã gửi nhắc học tập cho ${danhSach.length} thành viên Pass`);
}

// ==========================================================
// FOLLOW-UP TỰ ĐỘNG CHO CHƯA KÍCH HOẠT PASS (2.3)
// ==========================================================
async function followUpChuaKichHoat() {
    const danhSach = await User.find({
        googleEmail: { $ne: '' },
        goiPass: 'chua_co',
        khongNhanBroadcast: { $ne: true },
        verified: true,
        userId: { $regex: /^\d+$/ }
    }).catch(() => []);

    for (const user of danhSach) {
        const ten = user.googleName || user.firstName || 'bạn';
        const text = `👋 Chào ${ten}!\n\nBạn đã đăng ký SWC Academy nhưng chưa kích hoạt SWC Pass.\n\n🔓 Kích hoạt SWC Pass để:\n✅ Mở khoá toàn bộ khoá học nâng cao\n✅ Nhận tín hiệu đầu tư hàng tháng\n✅ Tham gia cộng đồng VIP\n\nChỉ cần bấm nút bên dưới — Admin sẽ kích hoạt ngay cho bạn! ⚡`;
        await bot.sendMessage(user.userId, text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💳 Kích hoạt SWC Pass', url: SWC_PASS_URL }],
                    [{ text: '🎓 Vào SWC Academy', url: 'https://swcpass.com/academy/' }],
                    [{ text: '💬 Hỏi Trợ Lý', callback_data: 'menu_chinh' }]
                ]
            }
        }).catch(() => { });
        await new Promise(r => setTimeout(r, 200));
    }
}

const TIN_NHAN_30_NGAY = [
    "Đầu tư không phải là đánh bạc. Đó là một quá trình dài hạn, đòi hỏi sự kiên nhẫn và kỷ luật thép.", // 0
    "Trong đầu tư, 'Sợ hãi' và 'Tham lam' là hai kẻ thù lớn nhất. Hãy học cách kiểm soát chúng thay vì để chúng điều khiển bạn.",
    "Lãi kép là kỳ quan thứ 8 của thế giới. Hãy để tiền của bạn làm việc cho bạn một cách kiên trì mỗi ngày.",
    "Bạn không cần phải thông minh xuất chúng để đầu tư thành công, nhưng bạn bắt buộc phải có kỷ luật dài hạn.",
    "Thị trường chứng khoán là thiết bị chuyển tiền từ kẻ thiếu kiên nhẫn sang người kiên nhẫn.",
    "Rủi ro lớn nhất không phải là bạn đầu tư sai, mà là bạn không chịu bắt đầu đầu tư sớm.",
    "Mọi cơ hội lớn đều được ngụy trang dưới dạng rủi ro và sự hoài nghi. Bạn có đủ bản lĩnh để nắm bắt?",
    "Đừng đặt tất cả trứng vào một giỏ. Quản trị rủi ro và phân bổ vốn là kỹ năng sống còn trong thị trường tài chính.",
    "Biến động thị trường là cơ hội cho người đã chuẩn bị sẵn tiền mặt và kiến thức, nhưng là thảm họa với kẻ vay mượn.",
    "Khi người khác tham lam, bạn hãy sợ hãi. Khi người khác sợ hãi, bạn hãy tham lam. Đây là nguyên tắc vàng của Warren Buffett.",
    "Thời gian quan trọng hơn thời điểm. Nắm giữ tài sản lâu dài luôn mang lại kết quả tốt hơn việc cố đoán đỉnh và đáy.", // 10
    "Tiết kiệm là bước đầu tiên của tự do tài chính. Đầu tư là bước thứ hai để làm cho số tiền đó sinh sôi nảy nở.",
    "Kiến thức là khoản đầu tư mang lại lợi nhuận cao nhất. Hãy không ngừng học hỏi và nâng cấp tư duy của chính mình.",
    "Người thành công trong đầu tư không bao giờ hành động dựa trên cảm xúc nhất thời, họ dựa trên dữ liệu và kế hoạch.",
    "Khủng hoảng kinh tế luôn đi kèm với sự phân phối lại tài sản. Nếu bạn có chuẩn bị, đó là cơ hội đổi đời lớn nhất.",
    "Một danh mục đầu tư xuất sắc là một danh mục giúp bạn ngủ ngon vào ban đêm, bất chấp bão táp thị trường.",
    "Đừng bao giờ đầu tư vào một mô hình kinh doanh mà bạn không hiểu rõ. Đó là cách nhanh nhất để mất tiền.",
    "Bạn không thể kiểm soát được hướng đi của thị trường, nhưng bạn có thể kiểm soát được cách mình phản ứng với nó.",
    "Sự giàu có thực sự không đo bằng số tiền bạn kiếm được, mà bằng số thời gian bạn có thể sống tự do không cần làm việc.",
    "Hãy tránh xa tâm lý FOMO (Hội chứng sợ bỏ lỡ). Cơ hội đầu tư tốt luôn luôn xuất hiện, đừng vội vàng đu đỉnh.",
    "Kỷ luật đầu tư hàng tháng (DCA) là cách an toàn và bền vững nhất để xây dựng tài sản lên đến hàng triệu đô.", // 20
    "Sự khác biệt giữa người giàu và người nghèo nằm ở tư duy: Người nghèo tiêu tiền rồi mới tiết kiệm, người giàu tiết kiệm để đầu tư rồi mới tiêu xài.",
    "Đầu tư giá trị cần thời gian để chứng minh. Những quả ngọt nhất luôn dành cho người biết gieo hạt và kiên nhẫn chăm sóc.",
    "Đừng để lòng tham che mờ lý trí khi thị trường tăng trưởng nóng. Luôn nhớ phải chốt lời và bảo vệ thành quả.",
    "Mọi quyết định đầu tư đều có rủi ro, nhưng rủi ro cao nhất là để tiền của bạn nằm im và bị lạm phát bào mòn.",
    "Người bi quan luôn thấy khó khăn trong mọi cơ hội, người lạc quan luôn thấy cơ hội trong mọi khó khăn. Bạn chọn làm ai?",
    "Một kế hoạch đầu tư tồi tệ được thực hiện với kỷ luật thép vẫn tốt hơn một kế hoạch hoàn hảo nhưng bị bỏ dở giữa chừng.",
    "Hãy học cách tha thứ cho những sai lầm đầu tư của chính mình. Những sai lầm đó là bài học đắt giá giúp bạn hoàn thiện hơn.",
    "Độc lập tài chính bắt đầu từ việc bạn từ bỏ những chi tiêu không cần thiết để đổi lấy sự an tâm trong tương lai.",
    "Thay vì theo dõi bảng giá mỗi ngày, hãy dành thời gian đó để phát triển kỹ năng và gia tăng thu nhập từ công việc của bạn.",
    "Thành công trong đầu tư chỉ chiếm 10% kỹ năng chọn tài sản, 90% còn lại là nghệ thuật quản trị tâm lý và cảm xúc.", // 30
    "Kiên trì, kỷ luật và không ngừng học hỏi. Chúc bạn một ngày mới đầy năng lượng và những quyết định đầu tư sáng suốt!" // 31
];

async function guiBaiVietNgauNhien() {
    try {
        const result = await Knowledge.aggregate([{ $sample: { size: 1 } }]);
        if (!result || result.length === 0) return;
        const baiViet = result[0];
        const tin = `📚 <b>BÀI VIẾT NỔI BẬT HÔM NAY</b>\n\n📌 <b>Tiêu đề:</b> ${baiViet.title}\n✍️ <b>Tác giả:</b> ${baiViet.authorName || 'SWC Academy'}\n\n📖 Bấm vào link bên dưới để xem toàn bộ nội dung bài phân tích chi tiết. Một kho tàng kiến thức đang chờ bạn khám phá! 👇\n\n🔗 <b>Đọc ngay:</b> https://swcpass.com/academy/chat.html?id=${baiViet._id}`;
        
        // Gửi Group
        if (baiViet.imageUrl) {
            await bot.sendPhoto('-1002341901192', baiViet.imageUrl, { parse_mode: 'HTML', caption: tin }).catch(() => {});
        } else {
            await bot.sendMessage('-1002341901192', tin, { parse_mode: 'HTML' }).catch(() => {});
        }

        // Gửi Toàn bộ User
        const danhSach = await User.find({ khongNhanBroadcast: { $ne: true }, userId: { $regex: /^\d+$/ } }).catch(() => []);
        for (const user of danhSach) {
            if (baiViet.imageUrl) {
                await bot.sendPhoto(user.userId, baiViet.imageUrl, { parse_mode: 'HTML', caption: tin }).catch(() => {});
            } else {
                await bot.sendMessage(user.userId, tin, { parse_mode: 'HTML' }).catch(() => {});
            }
            await new Promise(r => setTimeout(r, 70));
        }
        console.log(`✅ Đã gửi bài viết ngẫu nhiên: ${baiViet.title}`);
    } catch (error) {
        console.log('Lỗi gửi bài ngẫu nhiên:', error.message);
    }
}

// ==========================================================
// CRON MỚI — GỘP VÀO INTERVAL CHÍNH
// ==========================================================
setInterval(async () => {
    const gio = layGioVN();
    const h = gio.getUTCHours();
    const m = gio.getUTCMinutes();
    const ngay = gio.getUTCDate();

    // Tự động hạ gói Pass nếu quá hạn
    try {
        const now = new Date();
        const expiredUsers = await User.find({ goiPass: { $ne: 'chua_co' }, passExpiry: { $lt: now, $ne: null } });
        for (let user of expiredUsers) {
            user.goiPass = 'chua_co';
            user.passTier = '';
            user.passExpiry = null;
            user.swcPassActivated = false;
            await user.save();
            bot.sendMessage(ADMIN_ID, `⚠️ <b>HỆ THỐNG TỰ ĐỘNG HẠ GÓI</b>\n\n📧 Email: <code>${user.googleEmail}</code>\n👤 Tên: ${user.googleName}\nLý do: Đã hết hạn SWC Pass.`, { parse_mode: 'HTML' });
        }
    } catch (e) { }

    // 6:00 sáng VN — Câu nói triết lý (2.5)
    if (h === 6 && m === 0) await guiCauNoiTrietLy();

    // 7:00 sáng — Nhắc SWC Pass member học tập (2.3)
    if (h === 7 && m === 0) await guiNhacHocTap();

    // Ngày 1-5 đầu tháng, 9h sáng — Nhắc đầu tư RM1 (2.4)
    if (ngay >= 1 && ngay <= 5 && h === 9 && m === 0) await guiNhacDauTu();

    // 15:00 chiều — Follow-up chưa kích hoạt Pass (2.3)
    if (h === 15 && m === 0) await followUpChuaKichHoat();

    // 21:00 tối — Bài viết ngẫu nhiên (DỜI TỪ 20:30 ĐỂ TRÁNH TRÙNG VỚI TIN TỐI)
    if (h === 21 && m === 0) await guiBaiVietNgauNhien();
}, 60000);
