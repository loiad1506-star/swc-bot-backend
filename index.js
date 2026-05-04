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

const SWC_FIELD_URL   = 'https://swcpass.com/swc-field/';
const SWC_PASS_URL    = 'https://swcpass.com/swc-field/#pricing';
const ROAD_1M_URL     = 'https://swcpass.com/rm1/';
const ATLAS_URL       = 'https://swcpass.com/atlas/';
const VIDEO_MOBILE    = 'https://www.youtube.com/watch?v=SEB7RJrutxg';
const VIDEO_PC        = 'https://www.youtube.com/watch?v=gy_sxh9WCCM';

const IMG_MAIN   = 'https://photos.app.goo.gl/6SC4mNCBawpMfMgj6';
const IMG_PASS   = 'https://photos.app.goo.gl/cbECmeni7rhuBAst5';
const IMG_HANG   = 'https://photos.app.goo.gl/yZU4FjisXcrQVMuf7';
const IMG_ROAD   = 'https://photos.app.goo.gl/Ca3xJzrWPaxzLSur7';
const IMG_ROAD2  = 'https://photos.app.goo.gl/pcfu5PUhz8Xs61kt7';
const IMG_FIELD  = 'https://photos.app.goo.gl/9nub7vRX5h9buGwr8';
const IMG_ATLAS  = 'https://photos.app.goo.gl/9nub7vRX5h9buGwr8';
const IMG_SPV    = 'https://photos.app.goo.gl/9nub7vRX5h9buGwr8';

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
        [{ text: '💬 Vào Nhóm Chat Cộng Đồng', url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }],
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
    userId:            { type: String, unique: true },
    firstName:         { type: String, default: '' },
    lastName:          { type: String, default: '' },
    username:          { type: String, default: '' },
    phone:             { type: String, default: '' },
    ngayThamGia:       { type: Date, default: Date.now },
    lanCuoiHoatDong:   { type: Date, default: Date.now },
    soTinNhan:         { type: Number, default: 0 },
    goiPass:           { type: String, default: 'chua_co', enum: ['chua_co', 'essential', 'plus', 'ultimate'] },
    giaiDoanPheu:      { type: String, default: 'moi', enum: ['moi', 'quan_tam', 'nong', 'da_mua'] },
    ngayPheuGuiCuoi:   { type: Date, default: null },
    buocPheuHienTai:   { type: Number, default: 0 },
    khongNhanBroadcast:{ type: Boolean, default: false },
    ghiChu:            { type: String, default: '' },
    adminPausedAiDen:  { type: Date, default: null },
    lichSuChat:        { type: Array, default: [] },
    camXucGanNhat:     { type: String, default: 'binh_thuong' },
    moiQuanTamChinh:   { type: String, default: '' }
});
const User = mongoose.model('User', userSchema);

// Schema cho Thư viện Kiến thức (Academy)
const knowledgeSchema = new mongoose.Schema({
    category:      { type: String, enum: ['kien_thuc', 'du_an', 'tai_chinh', 'thu_thuat', 'tin_tuc'], required: true },
    title:         { type: String, required: true },
    content:       { type: String, default: '' },
    imageUrl:      { type: String, default: '' },
    linkUrl:       { type: String, default: '' },
    telegramMsgId: { type: String, default: '' },
    authorName:    { type: String, default: 'SWC Academy' },
    createdAt:     { type: Date, default: Date.now },
    views:         { type: Number, default: 0 }
});
const Knowledge = mongoose.model('Knowledge', knowledgeSchema);

// ==========================================================
// NHẬN DIỆN CẢM XÚC & MỐI QUAN TÂM
// ==========================================================
function phanTichCamXuc(text) {
    const t = text.toLowerCase();
    if (['thua lỗ','mất hết','thất bại','buồn','bị lừa rồi','chán nản'].some(k => t.includes(k))) return 'buon';
    if (['lừa đảo','scam','đa cấp','không tin','bằng chứng','chứng minh đi'].some(k => t.includes(k))) return 'hoai_nghi';
    if (['sợ','lo lắng','rủi ro','có thật không','an toàn không','chắc không'].some(k => t.includes(k))) return 'lo_lang';
    if (['x10','x100','giàu nhanh','all in','đổi đời','muốn mua ngay'].some(k => t.includes(k))) return 'phan_khich';
    if (text.split(' ').length <= 5) return 'ngan_gon';
    return 'binh_thuong';
}

function phanTichMoiQuanTam(text) {
    const t = text.toLowerCase();
    if (['giá','phí','bao nhiêu','tiền','đắt','rẻ hơn'].some(k => t.includes(k))) return 'gia_ca';
    if (['lừa','scam','an toàn','pháp lý','uy tín'].some(k => t.includes(k))) return 'do_tin_cay';
    if (['atlas','dubai','bất động sản','bds'].some(k => t.includes(k))) return 'atlas';
    if (['road','1m','triệu','lãi kép','dca'].some(k => t.includes(k))) return 'road1m';
    if (['pass','thẻ','essential','plus','ultimate'].some(k => t.includes(k))) return 'swcpass';
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
Kể chuyện SWC: Mèo Vàng bắt cá (Road to $1M: nhịn oi $8/ngày, 15 năm = 1 triệu con cá). Tàu đánh cá (SWC Field: gom 10.000 chú mèo, mỗi chú $50 = cổ đông Tàu Lớn qua SPV). SWC Pass = thẻ hội viên để lên Tàu Lớn.
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
SWC — Sky World Community: Website swc001.netlify.app. Crowdinvesting Platform quốc tế, 10+ năm, giấy phép quỹ đầu tư SEC Mỹ. Sứ mệnh: giúp nhà đầu tư cá nhân tiếp cận Pre-IPO, Venture Capital. SPV: mỗi dự án có SPV riêng, đầu tư từ $50, không phí ẩn. Pháp lý: SEC Mỹ, MiFID II Châu Âu. Chỉ 1% dự án lọt qua thẩm định.
SWC Pass (swcpass.vn): Hệ thống tín hiệu & lộ trình hàng tháng. Chỉ 10-15 phút/tháng. Essential (Silver): $290/năm = $20/tháng + tặng 90 ngày. Plus (Gold): $720/5 năm = $10/tháng, khoá giá 5 năm, 80% nhà đầu tư tinh anh chọn. Ultimate (Diamond): $2,600 vĩnh viễn, một lần, truyền lại cho con cháu.
SWC Field (swc001.netlify.app): Sân chơi cá mập. Chỉ 1% dự án được chọn. Bảo vệ vốn All-or-Nothing (không đủ KPI → hoàn 100%). Từ $50.
Dự án ATLAS (swc001.netlify.app/chi-tiet-du-an-atlas): "Grab của ngành BĐS tại UAE." Gom toàn bộ quy trình mua-bán BĐS vào 1 app. Giải quyết: tin ảo, kê giá (môi giới ăn chênh), môi giới không phép. Win-Win-Win. Lộ trình: MVP UAE → Mở rộng UAE → Singapore, HK, Anh, Pháp.
Road to $1M (swc001.netlify.app/road-to-1m): DCA $8/ngày = $240/tháng, Buy & Hold, lãi kép 15-20 năm. $240/tháng × 20%/năm: 10 năm ~$55K, 20 năm ~$480K, 30 năm ~$3.4M (×64 vốn gốc). 3 triết lý: Commercial Cows + DCA (thị trường sập = sale-off) + Buy & Hold (loại cảm tính).
`;

const TOAN_BO_KIEN_THUC = `${KT_PHAT_TRIEN}\n${KT_NHAN_TINH}\n${KT_DAU_TU}\n${KT_DU_AN}`;

// ==========================================================
// SYSTEM PROMPT — NHÂN VẬT "TÍ" HOÀN TOÀN TIẾNG VIỆT
// ==========================================================
function xayDungSystemPrompt(user, camXuc) {
    const daysLeft = getDaysLeft();
    const soTin = user.soTinNhan || 0;

    const quenMuc = soTin === 0
        ? '[Lần đầu trò chuyện. Chào hỏi thân thiện, giới thiệu ngắn về Tí.]'
        : soTin >= 10
            ? `[Đã quen (${soTin} tin nhắn). Nói thẳng, không giới thiệu lại. Gọi tên ${user.firstName}.]`
            : `[Đã quen một chút (${soTin} tin nhắn). Tự nhiên như bạn bè.]`;

    const camXucGoi = {
        buon: `[TÂM TRẠNG: ${user.firstName} đang có cảm xúc tiêu cực. ƯU TIÊN ĐỒNG CẢM trước, không vội tư vấn. Nói nhẹ nhàng, ngắn gọn như người bạn thân ngồi cạnh.]`,
        lo_lang: `[TÂM TRẠNG: ${user.firstName} đang lo lắng. TRẤN AN trước bằng 1-2 câu thực tế. Sau đó mới giải thích.]`,
        hoai_nghi: `[TÂM TRẠNG: ${user.firstName} đang hoài nghi. Không thuyết phục. Chỉ đưa FACT lạnh. Điềm tĩnh, không phòng thủ.]`,
        phan_khich: `[TÂM TRẠNG: ${user.firstName} phấn khích quá mức. LÀM NGUỘI nhẹ bằng 1 rủi ro cụ thể trước khi đồng tình.]`,
        ngan_gon: `[TÂM TRẠNG: Tin nhắn ngắn. Trả lời 2-3 dòng thôi, như đang nhắn tin với bạn bè.]`,
        binh_thuong: ''
    }[camXuc] || '';

    const quanTamGoi = {
        gia_ca: '[QUAN TÂM: Hỏi về GIÁ. Dùng so sánh chi phí cơ hội, không giảm giá.]',
        do_tin_cay: '[QUAN TÂM: Lo LỪA ĐẢO. Đưa bằng chứng pháp lý SPV, SEC Mỹ, không giữ tiền của khách.]',
        atlas: '[QUAN TÂM: Hỏi ATLAS/Dubai. Tập trung RWA, thanh khoản 3s, bảo vệ vốn All-or-Nothing.]',
        road1m: '[QUAN TÂM: Hỏi ROAD TO $1M. Đưa toán học lãi kép, $8/ngày, 15 năm.]',
        swcpass: '[QUAN TÂM: Hỏi SWC PASS. Gợi ý Gold 5 năm ($10/tháng) hoặc Ultimate ($2,600 vĩnh viễn).]',
        chung: ''
    }[user.moiQuanTamChinh] || '';

    return `Bạn là "Tí" — trợ lý AI phân tích tâm lý và tư vấn tài chính của quỹ Sky World Community Việt Nam, dưới quyền anh Hồ Văn Lợi.

TÍNH CÁCH: Thấu hiểu nhân tính, sắc bén, như một Sói già Phố Wall. Xưng "em" hoặc "Tí", gọi khách là "anh/chị". Dùng ví dụ đời thực, kể chuyện, không dùng văn mẫu khô khan.

QUAN TRỌNG — PHONG CÁCH VIẾT:
- KHÔNG BAO GIỜ dùng dấu sao (**) hay tiêu đề mục kiểu báo cáo
- Ngắt dòng liên tục, mỗi ý 1-2 câu
- Tối đa 200 từ mỗi phản hồi
- Đôi khi bắt đầu bằng "Ừ thì...", "Thật ra là...", "Nói thật nhé anh/chị..."
- KHÔNG bao giờ xưng là "Bot" hay "Trợ lý AI"

${camXucGoi}
${quanTamGoi}
${quenMuc}

KIẾN THỨC CỐT LÕI:
${TOAN_BO_KIEN_THUC}

NHIỆM VỤ CHÍNH:
1. Gỡ bỏ tâm lý phòng thủ của F0. Khai sáng cho họ thấy tự trade là tự sát (chuỗi thức ăn tài chính Tầng 5).
2. Chốt sale thẻ SWC Pass trước deadline ${DEADLINE} (còn ${daysLeft} ngày). Khuyên mạnh Gói Plus 5 năm ($600) và Ultimate Vĩnh viễn ($2,600).
3. Hướng khách xem Video hướng dẫn và vào Group Chat.
4. Áp dụng nguyên tắc Dale Carnegie: làm người khác NÓI NHIỀU, đặt câu hỏi, để khách tự thuyết phục bản thân.

XỬ LÝ TỪ CHỐI:
- "Giá cao": "$10/tháng chưa bằng 1 ly trà đá mỗi ngày, đổi lại tấm bản đồ bảo vệ gia sản 5 năm"
- "Để nghĩ thêm": "Lạm phát 2.4% đang ăn mòn tiền mặt của anh/chị mỗi ngày. Trì hoãn hôm nay = trả giá đắt hơn ngày mai"
- "Có lừa đảo không?": "SPV chuẩn mực pháp lý quốc tế. SEC Mỹ ký phép. Khác hoàn toàn Ponzi — chúng tôi KHÔNG GIỮ TIỀN của anh/chị"
- "Tự đầu tư cũng được": "Có Pass, anh/chị ngồi mâm Tầng 1 Venture Capital — mua giá trước khi lên sàn. Tự đi thì xa, đi với SWC thì vừa an toàn vừa nắm thông tin trước đám đông"

QUY TẮC CUỐI: Luôn kết thúc bằng 1 câu hỏi mở nhắm vào nỗi đau. KHÔNG NHẮC Token, SWGT, không bịa số liệu.`;
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
            model: 'claude-sonnet-4-6',
            max_tokens: 1000,
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
            [{ text: '💬 Vào Nhóm Chat Cộng Đồng', url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }]
        ]
    };

    if (messageId) bot.deleteMessage(chatId, messageId).catch(() => {});
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
                    [{ text: '🏠 Menu Bot chính', callback_data: 'menu_chinh' }]
                ]
            }
        });
        
        bot.sendMessage(ADMIN_ID,
            `🎓 <b>LEAD TỪ ACADEMY!</b>\nTên: ${user.firstName} ${user.lastName}\nID: <code>${userId}</code>\nUsername: ${user.username}`,
            { parse_mode: 'HTML' }).catch(() => {});
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
            { parse_mode: 'HTML' }).catch(() => {});
    }

    if (!user.phone) {
        const loi_chao = `Xin chào <b>${user.firstName || 'bạn'}</b>! 🦁\n\nTôi là <b>Tí</b> — trợ lý phân tích tâm lý và đầu tư của <b>SWC Capital Việt Nam</b>.\n\nĐể hệ thống chẩn đoán đúng vị thế tài chính và cung cấp tài liệu phù hợp, vui lòng <b>bấm nút bên dưới</b> để chia sẻ số điện thoại nhé! 👇`;
        bot.sendMessage(chatId, loi_chao, {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [[{ text: '📞 Chia sẻ Số điện thoại', request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }).catch(() => {});
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
        bot.deleteMessage(chatId, sent.message_id).catch(() => {});
        guiMenuChinh(chatId);
    });
    bot.sendMessage(ADMIN_ID,
        `📞 <b>KHÁCH CÓ SỐ ĐIỆN THOẠI!</b>\nTên: ${msg.from.first_name}\nSĐT: ${msg.contact.phone_number}\nID: <code>${userId}</code>`,
        { parse_mode: 'HTML' }).catch(() => {});
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
    bot.answerCallbackQuery(callbackQuery.id).catch(() => {});

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
Mỗi ngày nhịn oi $8 — bằng 1 ly cà phê sáng.
Mỗi tháng đầu tư đều đặn <b>$240</b>.
Tỷ lệ sinh lời trung bình <b>20%/năm</b> (kết hợp cổ tức + SWC Field).

<b>Kết quả sau:</b>
📌 10 năm → Tài khoản ~$55,000 (~1.4 tỷ VNĐ)
📌 15 năm → Tài khoản ~$230,000 (~5.8 tỷ VNĐ)
📌 20 năm → Tài khoản ~$480,000 (~12 tỷ VNĐ)
📌 30 năm → Tài khoản ~$3,400,000 (gấp 64 lần vốn gốc bỏ ra!)

━━━━━━━━━━━━━━━━━━━
<b>So sánh với để tiền ngân hàng:</b>
Cùng $240/tháng × 30 năm tiết kiệm thuần = khoảng 86 triệu VNĐ (bị lạm phát ăn mòn).
Cùng số tiền đó với lãi kép SWC = ~$3,400,000 (khoảng 85 tỷ VNĐ).

Khác nhau 1,000 lần.
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
        text = `🏢 <b>SIÊU DỰ ÁN ATLAS — "GRAB" CỦA NGÀNH BẤT ĐỘNG SẢN DUBAI</b>

Bạn nghĩ đầu tư BĐS phải có vài chục tỷ, mua cục gạch rồi chôn vốn 5–10 năm?
Đó là tư duy của thập kỷ trước. <b>Chào mừng đến với RWA.</b>

━━━━━━━━━━━━━━━━━━━
<b>ATLAS là gì?</b>
Một hệ sinh thái kỹ thuật số toàn diện cho thị trường BĐS — bắt đầu tại UAE (Dubai).

Nếu Grab là ứng dụng gom mọi nhu cầu gọi xe vào 1 nơi,
thì ATLAS là <b>"Grab của ngành BĐS"</b> — gom toàn bộ quy trình:
tìm kiếm → thẩm định pháp lý → đàm phán → thanh toán → ký hợp đồng.
Tất cả trong <b>1 ứng dụng duy nhất</b>.

━━━━━━━━━━━━━━━━━━━
<b>Vấn đề ATLAS giải quyết:</b>
🔴 Tin ảo: Đăng nhà đẹp giá rẻ → gọi điện thì "vừa bán xong"
🔴 Kê giá: Môi giới ăn chênh lệch 500 triệu giữa người mua và người bán
🔴 Rủi ro pháp lý: Giấy tờ gửi qua Zalo, dễ bị lừa

━━━━━━━━━━━━━━━━━━━
<b>Win-Win-Win cho tất cả các bên:</b>
👤 <b>Người mua:</b> Chỉ xem nhà thật, chỉ trả tiền khi giao dịch thành công
🏠 <b>Người bán:</b> Không bị ép giá, có tính năng "Bán gấp" — AI tính giá hợp lý, chốt trong 1–2 ngày
🤝 <b>Môi giới chân chính:</b> Hệ thống tự phân bổ khách, không cần chạy quảng cáo

━━━━━━━━━━━━━━━━━━━
<b>Lộ trình 3 giai đoạn:</b>
Giai đoạn 1: Xây dựng MVP, thị trường UAE
Giai đoạn 2: Mở rộng toàn UAE, tích hợp AI định giá
Giai đoạn 3: Singapore, Hồng Kông, Anh, Pháp

<b>Tại sao đầu tư vào ATLAS ngay lúc này?</b>
→ Đây là Giai đoạn 1 — giá vốn rẻ nhất
→ Khi ATLAS mở rộng sang các quốc gia khác, giá trị cổ phần tăng theo
→ Bảo vệ vốn All-or-Nothing — nếu không đủ KPI → hoàn 100%

⚠️ Vòng Private đang mở. Đóng cửa vào <b>${DEADLINE}</b> — còn <b>${daysLeft} ngày</b>.`;
        keyboard = [
            [{ text: '🛡️ Cấu trúc SPV bảo vệ vốn thế nào?', callback_data: 'field_spv' }],
            ...nutsLienKet()
        ];
    }

    // ==================================================
    // NHÁNH ROAD TO $1M
    // ==================================================
    else if (data === 'road1m_gioi_thieu') {
        imageUrl = IMG_ROAD;
        text = `🗺️ <b>CON ĐƯỜNG ĐẾN $1,000,000 — TOÁN HỌC, KHÔNG PHẢI PHÉP THUẬT</b>

Bao nhiêu lần bạn dễ dàng vung 200.000 VNĐ cho một bữa ăn nhậu,
một chiếc áo mới mà không hề suy nghĩ?

Chuyện gì sẽ xảy ra nếu bạn có tính kỷ luật,
tự động trích ra đúng số tiền đó: <b>$8/ngày ($240/tháng)</b>,
ném nó vào một cỗ máy sinh lời đã được tinh chỉnh hoàn hảo?

Trong 15 năm, con số đó sẽ cán mốc <b>1 Triệu Đô La</b>.

Không phải phép thuật. Không phải may mắn.
Chỉ là <b>Toán học × Thời gian × Kỷ luật Vô Cảm</b>.

━━━━━━━━━━━━━━━━━━━
<b>3 TRIẾT LÝ VẬN HÀNH:</b>

<b>1. Commercial Cows (Con Bò Sữa Thương Mại)</b>
Chỉ mua cổ phiếu của DN lớn, làm ăn có lãi, trả cổ tức đều.
Giống mua bò — không chờ bán thịt, mà <b>vắt sữa mỗi ngày</b>.

<b>2. DCA — Phương pháp Bình Quân Giá</b>
Đến tháng, cứ rót tiền đúng như hệ thống báo.
Thị trường khủng hoảng, giá giảm → Mua được nhiều hơn (Sale-off!).
Thị trường phục hồi → Khối tài sản phình to.

<b>3. Buy & Hold — Mua và Nắm Giữ</b>
Loại bỏ hoàn toàn sai lầm cảm tính.
Không hốt hoảng bán tháo khi khủng hoảng.
Không tham lam đu đỉnh khi hưng phấn.
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
            `📊 <b>THỐNG KÊ SWC BOT V6</b>\n\n👥 Tổng users: ${total}\n📞 Có SĐT: ${coSDT}\n🔥 Nóng: ${nong}\n👀 Quan tâm: ${quanTam}\n✅ Đã mua: ${daMua}\n📱 Hoạt động 24h: ${hoatDong24h}\n⏳ Còn lại: ${getDaysLeft()} ngày`,
            { parse_mode: 'HTML' });
        return;
    }
    else if (data === 'admin_lenh' && callbackQuery.from.id.toString() === ADMIN_ID) {
        bot.sendMessage(ADMIN_ID,
            `📋 <b>LỆNH ADMIN:</b>\n\n/tracuu [ID] — Xem hồ sơ khách\n/setpass [ID] [gói] — Cập nhật gói Pass\n/setpheu [ID] [giai_doan] — Cập nhật phễu\n/note [ID] [ghi chú] — Lưu ghi chú\n/reset [ID] — Reset lịch sử AI\n/sendall [nội dung] — Gửi tất cả\n/sendpheu [giai_doan] [nội dung] — Gửi theo phễu\n/thongbao [nội dung] — Gửi Group`,
            { parse_mode: 'HTML' });
        return;
    }

    if (text !== '') {
        bot.deleteMessage(chatId, messageId).catch(() => {});
        if (imageUrl) {
            bot.sendPhoto(chatId, imageUrl, { caption: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } })
                .catch(() => bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }));
        } else {
            bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
        }
    }
});

// ==========================================================
// XỬ LÝ TIN NHẮN TỰ DO — AI TÍ & ADMIN
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
                { parse_mode: 'HTML' }).catch(() => {});
            bot.sendMessage(ADMIN_ID, `✅ Đã gửi phản hồi cho khách ID: <code>${targetId}</code>`, { parse_mode: 'HTML' });
            await User.updateOne({ userId: targetId }, {
                $set: { adminPausedAiDen: new Date(Date.now() + 2 * 3600000) }
            });
            return;
        }
    }

    // KHÁCH GỬI TIN — GỌI AI TÍ
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
            await bot.forwardMessage(ADMIN_ID, chatId, msg.message_id).catch(() => {});
            bot.sendMessage(ADMIN_ID,
                `📎 <b>TỆP TỪ KHÁCH HÀNG</b>\n👤 ${user.firstName} ${user.lastName}\n🆔 ID: <code>${userId}</code>\nGhi chú: ${msg.caption || 'Không có'}\n\n<i>Reply tin này để chat trực tiếp (AI bị tạm khóa 2h)</i>`,
                { parse_mode: 'HTML' }).catch(() => {});
        }

        // Nếu admin đang xử lý — chỉ forward, không gọi AI
        const now = new Date();
        if (user.adminPausedAiDen && user.adminPausedAiDen > now) {
            bot.sendMessage(ADMIN_ID,
                `💬 <b>KHÁCH TRẢ LỜI (CHẾ ĐỘ ADMIN)</b>\n👤 ${user.firstName}\n🆔 ID: <code>${userId}</code>\nNội dung: ${msg.text || '[Tệp]'}\n\n<i>Reply để tiếp tục chat</i>`,
                { parse_mode: 'HTML' }).catch(() => {});
            return;
        }

        // Typing delay tự nhiên
        bot.sendChatAction(chatId, 'typing').catch(() => {});
        const noiDung = msg.text || msg.caption || '[Khách gửi tệp]';
        const camXuc = phanTichCamXuc(noiDung);
        const delay = { ngan_gon: 800, buon: 2000, hoai_nghi: 2500, lo_lang: 1500, phan_khich: 1200 }[camXuc] || Math.min(noiDung.length * 15, 3000);
        await new Promise(r => setTimeout(r, delay));

        const phanHoiAI = await goiClaude(user, noiDung);
        await bot.sendMessage(chatId, phanHoiAI, { parse_mode: 'HTML' }).catch(() => {
            bot.sendMessage(chatId, phanHoiAI);
        });

        // Thông báo admin khi hot lead
        if (['quan_tam', 'nong'].includes(user.giaiDoanPheu)) {
            bot.sendMessage(ADMIN_ID,
                `🔥 <b>HOT LEAD ĐANG CHAT!</b>\n👤 ${user.firstName} ${user.lastName}\n🆔 ID: <code>${userId}</code>\nTâm trạng: ${camXuc} | Quan tâm: ${user.moiQuanTamChinh}\nPhễu: ${user.giaiDoanPheu}\n\n💬 <b>Khách:</b> ${noiDung.substring(0, 200)}\n🤖 <b>Tí:</b> ${phanHoiAI.substring(0, 300)}\n\n<i>Reply tin này để cướp quyền chat</i>`,
                { parse_mode: 'HTML' }).catch(() => {});
        }
    }
});

// ==========================================================
// DRIP FUNNEL 5 GIAI ĐOẠN — CHĂM SÓC THEO HÀNH TRÌNH
// ==========================================================
const DRIP = {
    1: (ten, dl) => `Anh/chị ${ten} ơi, Tí đây! 😊

Rất vui được kết nối. Em biết ngoài kia có rất nhiều thông tin tài chính — đôi khi nhiều đến mức choáng ngợp.

Để bắt đầu đúng chỗ, em có một câu hỏi nhỏ:

<i>"Nếu ngày mai anh/chị buộc phải ngừng làm việc trong 6 tháng, cuộc sống có bị ảnh hưởng không?"</i>

Nếu CÓ — thì chúng ta cần nói chuyện rất nghiêm túc về việc xây dựng dòng tiền thụ động.
Còn ${dl} ngày để anh/chị có cơ hội tốt nhất. 🗺️`,

    3: (ten, dl) => `Anh/chị ${ten} ơi, Tí muốn chia sẻ một sự thật tàn nhẫn:

95% người tự trade thị trường đều thua lỗ.
Không phải vì họ dốt. Mà vì họ đang chơi trong một sân chơi mà <b>luật do kẻ khác viết ra</b>.

Thị trường tài chính có 5 tầng. Ai ở Tầng nào ăn Tầng đó.
F0 tự trade đang ngồi ở Tầng 5 — tầng thấp nhất, là mồi cho 4 tầng trên.

SWC Pass không phải khóa học. Nó là chiếc cần cẩu kéo anh/chị ra khỏi Tầng 5.

Anh/chị muốn Tí giải thích cụ thể hơn không? Còn ${dl} ngày.`,

    7: (ten, dl) => `Anh/chị ${ten}, Tí muốn gửi một bài toán đơn giản:

$8/ngày × 365 ngày × 15 năm × lãi kép 20%/năm = <b>$1,000,000</b>

Người bắt đầu lúc 25 tuổi với $8/ngày
sẽ có kết quả TỐT HƠN NHIỀU so với
người bắt đầu lúc 35 tuổi với $80/ngày.

Tại sao? Vì họ có thêm 10 năm lãi kép.

Mỗi ngày trì hoãn = 1 ngày sức mạnh lãi kép vĩnh viễn mất đi.
Còn ${dl} ngày để anh/chị bắt đầu ở giá tốt nhất. 📈`,

    14: (ten, dl) => `Anh/chị ${ten} ơi, có tin quan trọng về dự án ATLAS tại Dubai:

Đây là "Grab của ngành BĐS" — gom toàn bộ quy trình mua-bán vào 1 app.
Đang ở Giai đoạn 1 — vòng Private, giá gốc, trước khi công chúng biết đến.

Điều đặc biệt: chỉ cần $50 để sở hữu cổ phần.
Bảo vệ vốn All-or-Nothing: không đủ KPI → hoàn 100%.

Anh/chị có muốn Tí gửi chi tiết về dự án không?
Còn ${dl} ngày để vào vòng Private. 🏢`,

    21: (ten, dl) => `Anh/chị ${ten} — Tí cần nói thẳng.

Chúng ta đã trò chuyện một thời gian.
Tí biết anh/chị hiểu giá trị của SWC Pass.

Còn ${dl} ngày. Sau ngày ${DEADLINE}, cánh cửa đóng lại.
Không phải chiêu marketing. Khi đủ 1,000 thành viên, hệ thống khóa hoàn toàn.

Câu hỏi thẳng thắn: <i>"Anh/chị cần thêm thông tin gì để có thể quyết định?"</i>

Tí ở đây để giải đáp bất kỳ thắc mắc nào. 💬`
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

// Kiểm tra drip mỗi 1 giờ
setInterval(async () => {
    const now = new Date();
    const users = await User.find({ khongNhanBroadcast: false, goiPass: 'chua_co' }).catch(() => []);
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
        khongNhanBroadcast: false,
        goiPass: 'chua_co',
        lanCuoiHoatDong: { $lt: baBaSo },
        giaiDoanPheu: { $in: ['quan_tam', 'nong'] }
    }).catch(() => []);

    const mauTin = [
        (ten) => `${ten} ơi, dạo này thị trường đang có nhiều biến động thú vị. Anh/chị có muốn Tí cập nhật không?`,
        (ten) => `Chào ${ten}! Tí vừa đọc xong phân tích vĩ mô tháng này — có điều khá thú vị liên quan đến dòng tiền. Anh/chị còn quan tâm không?`,
        (ten) => `${ten} ơi, gói Plus 5 năm hiện tại chỉ $10/tháng. Em nghĩ nó phù hợp với anh/chị — muốn Tí giải thích thêm không?`
    ];

    for (const user of danhSach) {
        const tin = mauTin[Math.floor(Math.random() * mauTin.length)](user.firstName || 'bạn');
        const keyboard = { inline_keyboard: [[{ text: 'Muốn biết thêm', callback_data: 'menu_chinh' }], ...nutsLienKet().slice(-1)] };
        await bot.sendMessage(user.userId, tin, { reply_markup: keyboard }).catch(() => {});
        await new Promise(r => setTimeout(r, 300));
    }
}

// ==========================================================
// BROADCAST LỊCH TỰ ĐỘNG
// ==========================================================
function layGioVN() { return new Date(new Date().getTime() + 7 * 3600000); }

async function guiToanBo(noiDung, anhUrl = null, chiBaoGomPheu = null) {
    const dieuKien = { khongNhanBroadcast: false };
    if (chiBaoGomPheu) dieuKien.giaiDoanPheu = { $in: Array.isArray(chiBaoGomPheu) ? chiBaoGomPheu : [chiBaoGomPheu] };
    const danhSach = await User.find(dieuKien);
    let thanhCong = 0;
    for (const user of danhSach) {
        try {
            if (anhUrl) {
                await bot.sendPhoto(user.userId, anhUrl, { caption: noiDung, parse_mode: 'HTML', reply_markup: { inline_keyboard: nutsLienKet() } });
            } else {
                await bot.sendMessage(user.userId, noiDung, { parse_mode: 'HTML', reply_markup: { inline_keyboard: nutsLienKet() } });
            }
            thanhCong++;
        } catch (e) {}
        await new Promise(r => setTimeout(r, 70));
    }
    return thanhCong;
}

setInterval(async () => {
    const gio = layGioVN();
    const h = gio.getUTCHours();
    const m = gio.getUTCMinutes();
    const daysLeft = getDaysLeft();

    if (h === 8 && m === 0) {
        const tin = `🌅 <b>CHÀO BUỔI SÁNG — F0 ĐANG LO, TA ĐANG CÓ KẾ HOẠCH!</b>

Đa số F0 sáng dậy đầu tiên là mở app xem thị trường có đỏ không...
Thành viên SWC sáng dậy uống cà phê, đã có kế hoạch từ đầu tháng.

Sự thật tàn nhẫn: 95% người tự trade thua lỗ không phải vì thiếu thông tin — mà vì <b>thiếu hệ thống kỷ luật</b>.

⏳ Còn <b>${daysLeft} ngày</b> để gia nhập hệ thống trước khi cửa đóng vĩnh viễn!`;
        await guiToanBo(tin, IMG_MAIN);
    }

    if (h === 12 && m === 0) {
        const tin = `☀️ <b>KIẾN THỨC TÀI CHÍNH BUỔI TRƯA</b>

Lãi kép — Kỳ quan thứ 8 của Thế giới (Einstein):

$240/tháng × 20%/năm:
📌 10 năm → ~$55,000
📌 20 năm → ~$480,000  
📌 30 năm → ~$3,400,000

<b>Bí quyết:</b> Bắt đầu SỚM và kỷ luật ĐỀU ĐẶN.
Mỗi ngày trì hoãn = 1 ngày lãi kép vĩnh viễn mất đi.
Còn ${daysLeft} ngày để lên tàu SWC Pass! 🚀`;
        await guiToanBo(tin, IMG_ROAD);
    }

    if (h === 19 && m === 30) {
        const tin = `🌆 <b>THỜI GIAN CẬP NHẬT KIẾN THỨC BUỔI TỐI</b>

Vào Group cộng đồng ngay để:
✅ Cập nhật tiến độ dự án ATLAS Dubai (RWA)
✅ Thảo luận chiến lược đầu tư Lãi Kép
✅ Kết nối với 1,000+ nhà đầu tư tinh hoa
✅ Nhận tín hiệu thị trường từ chuyên gia

⏳ Còn <b>${daysLeft} ngày</b> để mua vị thế tốt nhất!`;
        await guiToanBo(tin, IMG_FIELD);
    }

    if (h === 20 && m === 30) {
        const tin = `🔔 <b>NHẮC NHỞ QUAN TRỌNG — CÒN ĐÚNG ${daysLeft} NGÀY!</b>

Lúc này có 2 loại người:

Loại 1: F0 đang lo lắng thị trường, nhìn chart đỏ mắt, stress...
Loại 2: Đã sở hữu SWC Pass — <b>đang ngủ ngon trong khi hệ thống tự động chạy</b> 😴

Gói <b>Ultimate (Vĩnh viễn)</b> — Giới hạn 1,000 suất.
Sẽ <b>đóng cửa vĩnh viễn</b> vào ${DEADLINE}. Không có ngoại lệ.`;
        await guiToanBo(tin, IMG_HANG, ['nong', 'quan_tam']);
    }

    if (h === 10 && m === 0) await tacDongNguoiImLang();
}, 60000);

// ==========================================================
// ADMIN PANEL & CÁC LỆNH QUẢN TRỊ
// ==========================================================
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id, `👨‍💻 <b>ADMIN PANEL SWC BOT V6</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📊 Thống kê phễu', callback_data: 'admin_thongke' }],
                [{ text: '📋 Bảng lệnh quản trị', callback_data: 'admin_lenh' }]
            ]
        }
    });
});

bot.onText(/\/sendall ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const danhSach = await User.find({});
    bot.sendMessage(ADMIN_ID, `⏳ Đang gửi tin kèm ảnh cho ${danhSach.length} người...`);
    const thanhCong = await guiToanBo(match[1], IMG_MAIN);
    bot.sendMessage(ADMIN_ID, `✅ Gửi thành công: ${thanhCong}/${danhSach.length}`);
});

bot.onText(/\/sendpheu (\w+) ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const thanhCong = await guiToanBo(match[2], IMG_MAIN, match[1]);
    bot.sendMessage(ADMIN_ID, `✅ Đã gửi cho phễu "${match[1]}": ${thanhCong} người`);
});

bot.onText(/\/tracuu (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const user = await User.findOne({ userId: match[1] });
    if (!user) return bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy user ID: ${match[1]}`);
    const lanCuoi = user.lanCuoiHoatDong ? new Date(user.lanCuoiHoatDong).toLocaleString('vi-VN') : 'Chưa có';
    bot.sendMessage(ADMIN_ID,
        `🔎 <b>HỒ SƠ KHÁCH HÀNG</b>\n🆔 ID: <code>${match[1]}</code>\n👤 Tên: ${user.firstName} ${user.lastName}\n📱 Username: ${user.username || 'Không có'}\n📞 SĐT: ${user.phone || 'Chưa có'}\n🎯 Phễu: ${user.giaiDoanPheu}\n💳 Gói Pass: ${user.goiPass}\n💬 Số tin nhắn: ${user.soTinNhan || 0}\n🕐 Lần cuối: ${lanCuoi}\n😊 Tâm trạng: ${user.camXucGanNhat || 'chưa xác định'}\n🎯 Quan tâm: ${user.moiQuanTamChinh || 'chưa xác định'}\n📝 Ghi chú: ${user.ghiChu || 'Không có'}`,
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
    if (!['moi','quan_tam','nong','da_mua'].includes(giaiDoan)) return bot.sendMessage(ADMIN_ID, `❌ Sai giai đoạn! Dùng: moi / quan_tam / nong / da_mua`);
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
// HTTP SERVER + ACADEMY API ENDPOINTS
// ==========================================================
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
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
        res.end('SWC Bot V6 + Academy API — Running!\n');
    } catch (err) {
        console.error('API Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
    }
});

server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log(`🌐 Server khởi động port ${process.env.PORT || 3000}`);
    console.log('🚀 AI Tí + Academy API đã sẵn sàng!');
});
