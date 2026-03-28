require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');

// BẮT LỖI TOÀN CỤC - NGĂN CHẶN BOT SẬP NGẦM
process.on('uncaughtException', (err) => console.error('❌ Lỗi Uncaught Exception:', err.message));
process.on('unhandledRejection', (err) => console.error('❌ Lỗi Unhandled Rejection:', err.message));

// ==========================================
// CẤU HÌNH BIẾN MÔI TRƯỜNG & KHỞI TẠO
// ==========================================
const token = process.env.BOT_TOKEN || 'MISSING_TOKEN';
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swc';
const claudeApiKey = process.env.CLAUDE_API_KEY || 'MISSING_KEY';

const bot = new TelegramBot(token, {
    polling: token !== 'MISSING_TOKEN' ? { 
        params: { allowed_updates: JSON.stringify(["message", "callback_query", "chat_member", "my_chat_member"]) } 
    } : false
});

const claude = new Anthropic({ apiKey: claudeApiKey });

bot.on("polling_error", (msg) => console.log("⚠️ LỖI POLLING:", msg.message));
bot.on("error", (msg) => console.log("⚠️ LỖI CHUNG:", msg.message));

// ==========================================
// HẰNG SỐ CẤU HÌNH & LINK
// ==========================================
const ADMIN_ID = process.env.ADMIN_ID || '507318519';
const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';
const PRIVATE_TG_GROUP = 'https://t.me/swc_vip_internal'; 
const PRIVATE_ZALO_GROUP = 'https://zalo.me/g/yeiaea989';
const SWC_PASS_WEB = 'https://swcpass.vn';
const SWC_FIELD_WEB = 'https://swcfield.com/en';
const ACTIVATE_URL = 'https://auth.swcfield.com/en/recover-password'; 
const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';
const VIDEO_MOBILE = 'https://youtu.be/SEB7RJrutxg';
const VIDEO_PC = 'https://www.youtube.com/watch?v=gy_sxh9WCCM';
const DEADLINE = '31/03/2026';

function getDaysLeft() {
    const deadline = new Date('2026-03-31T23:59:00+07:00');
    const now = new Date();
    const diff = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
}

const NÚT_ĐĂNG_KÝ_SỰ_KIỆN = [{ text: `🚨 ĐĂNG KÝ KÍCH HOẠT SWC PASS (CÒN ${getDaysLeft()} NGÀY)`, url: ACTIVATE_URL }];

// ==========================================
// KẾT NỐI MONGODB & SCHEMA
// ==========================================
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Đã kết nối MongoDB!'))
    .catch(err => console.error('❌ Lỗi MongoDB:', err.message));

const userSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    username: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    joinDate: { type: Date, default: Date.now },

    tag: { type: String, default: 'new', enum: ['new', 'newbie', 'experienced', 'vip_pass', 'atlas_investor'] },
    swcPassTier: { type: String, default: 'none', enum: ['none', 'essential', 'plus', 'ultimate'] },
    
    funnelStage: { type: String, default: 'new', enum: ['new', 'interested', 'hot_lead', 'converted'] },
    funnelDay: { type: Number, default: 0 },
    lastFunnelSent: { type: Date, default: null },

    broadcastOptOut: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    
    lastBotInteraction: { type: Date, default: null },
    adminPausedAiUntil: { type: Date, default: null }, 
    chatHistory: { type: Array, default: [] }
});

const User = mongoose.model('User', userSchema);

// ==========================================
// SYSTEM PROMPT CHO AI CLAUDE HAIKU
// ==========================================
function buildSystemPrompt(user) {
    const daysLeft = getDaysLeft();
    return `Bạn là "Tí" — trợ lý AI tư vấn đầu tư tài chính của quỹ Sky World Community Viet Nam, làm việc dưới quyền anh Hồ Văn Lợi.

TÍNH CÁCH: Chuyên nghiệp, thông tuệ, tự nhiên, dí dỏm — tuyệt đối không giống robot. Xưng "em" hoặc "Tí", gọi khách là "anh/chị" hoặc theo tên nếu biết.

NHIỆM VỤ CỐT LÕI:
- Tư vấn tài chính, đầu tư theo triết lý SWC (Road to $1M).
- Chốt sale thẻ thành viên SWC Pass trước deadline ${DEADLINE} (CÒN ${daysLeft} NGÀY). Khuyến khích mạnh Gói Plus 5 năm và Gói Ultimate Vĩnh viễn.
- Phân loại khách và dẫn dắt họ nhận ra sai lầm khi tự Trade.

THÔNG TIN KHÁCH HÀNG HIỆN TẠI:
- Tên: ${user.firstName} ${user.lastName}
- Nhóm: ${user.tag}
- Gói hiện tại: ${user.swcPassTier}

HỆ SINH THÁI SWC & SWC PASS:
- SWC Field: Nền tảng "Showcase" dự án đầu tư thế hệ mới. Cho phép đầu tư vào các dự án đã qua thẩm định qua mô hình SPV (Cấu trúc pháp lý riêng biệt tại Mỹ, EU) giúp minh bạch và tối ưu hóa pháp lý. Ngưỡng đầu vào thấp chỉ từ $50.
- SWC Pass là tư cách thành viên (Membership), không thu phí ẩn, không cắt xén % lợi nhuận. Chỉ trả phí tham gia.
- Chiến lược "Road to $1M": Đầu tư kỷ luật định kỳ $8/ngày ($240/tháng), dùng sức mạnh lãi kép để đạt 1 Triệu Đô trong 15 năm. Nhận tín hiệu hàng tháng, thao tác chỉ 10-15 phút/tháng.

SẢN PHẨM SWC PASS (3 GÓI - CÁCH TƯ VẤN):
1. Essential (1 năm - $240): Gọi là gói "Cà Phê Trải Nghiệm". Dành cho người sợ mất tiền. Chỉ $20/tháng bằng chầu cafe để thuê đội ngũ chuyên gia phân tích thị trường Mỹ.
2. Plus (5 Năm - $600): Gọi là gói "Kỷ Luật Thép". Khuyên khách CHỌN GÓI NÀY. Chỉ $10/tháng. Đầu tư phải tính bằng năm để thấy sức mạnh lãi kép. Bằng tiền một bát phở mỗi tuần để mua quyền truy cập danh mục của giới siêu giàu.
3. Ultimate (Vĩnh viễn - $2.600): Gọi là gói "Di Sản Gia Tộc". Đầu tư 20 năm thì mỗi năm chỉ $130. Mua đứt mỏ vàng. CHÚ Ý: Gói này SẼ ĐÓNG CỬA VĨNH VIỄN VÀO NGÀY ${DEADLINE}. Chỉ 1000 suất toàn cầu.

LINK QUAN TRỌNG:
- Kích hoạt SWC Pass: ${ACTIVATE_URL}
- Website SWC Pass: ${SWC_PASS_WEB}
- SWC Field: ${SWC_FIELD_WEB}

TRIẾT LÝ ĐẦU TƯ:
- 5 Tầng chuỗi thức ăn: Chính phủ → Cá voi → Đội lái → Sói già → F0 (thanh khoản). F0 tự trade = tự sát.
- Bảo vệ khỏi sai lầm cảm tính: Chiến lược DCA và Buy & Hold giúp giảm căng thẳng.

QUY TẮC GIAO TIẾP:
- Phải dùng "Bộ lọc chống FOMO" và "Kẻ hủy diệt phí ẩn" để tư vấn.
- Luôn kết thúc bằng câu hỏi mở để dẫn dắt (Ví dụ: Anh/chị hiện tại đang tự trade hay để tiền mặt ở ngân hàng chịu lạm phát?)
- LIÊN TỤC nhắc deadline ${DEADLINE} — còn ${daysLeft} ngày cho gói Ultimate.
- KHÔNG giải thích dài dòng kỹ thuật. KHÔNG nhắc tới Token, Coin, SWGT, hay rút tiền mặt. Chỉ nói về Đầu tư cổ phần, SPV, Lãi kép và Hệ sinh thái SWC.`;
}

async function callClaude(user, userMessage) {
    try {
        let history = user.chatHistory || [];
        history.push({ role: 'user', content: userMessage });
        if (history.length > 10) history = history.slice(-10);

        const response = await claude.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 600,
            system: buildSystemPrompt(user),
            messages: history
        });

        const reply = response.content[0].text;
        history.push({ role: 'assistant', content: reply });
        user.chatHistory = history;
        user.lastBotInteraction = new Date();

        if (user.funnelStage === 'new') user.funnelStage = 'interested';
        if (user.funnelStage === 'interested' && history.length > 4) user.funnelStage = 'hot_lead';

        await user.save();
        return reply;
    } catch (err) {
        console.error('❌ Claude API error:', err.message);
        return `Xin lỗi anh/chị, hệ thống Đội ngũ chuyên gia SWC đang bận xử lý dữ liệu. Vui lòng chờ giây lát em sẽ báo Admin phản hồi trực tiếp nhé! 🙏`;
    }
}

// ==========================================
// HÀM GỬI MAIN MENU (EDIT MESSAGE)
// ==========================================
async function sendMainMenu(chatId, messageId = null) {
    const daysLeft = getDaysLeft();
    const text = `🦁 <b>SWC CAPITAL — HỆ SINH THÁI ĐẦU TƯ TINH ANH</b>\n\n⏳ <b>CÒN KHOẢNG ${daysLeft} NGÀY</b> — Quyền đăng ký gói Thành viên Ultimate (Vĩnh viễn) sẽ đóng cửa vĩnh viễn vào lúc 23:59 ngày <b>${DEADLINE}</b>!\n\nHãy chọn nội dung bạn muốn khám phá để bắt đầu xây dựng đế chế tài chính của riêng mình:`;

    const keyboard = {
        inline_keyboard: [
            [{ text: "💎 SWC Pass — Tấm Vé Thông Hành", callback_data: 'menu_swcpass' }],
            [{ text: "🏢 Dự án ATLAS — BĐS Số Hóa Dubai", callback_data: 'menu_atlas' }],
            [{ text: "🗺️ Road to $1M — Lộ Trình Triệu Đô", callback_data: 'road_to_1m' }],
            [{ text: "❓ Giải Đáp Thắc Mắc (FAQ)", callback_data: 'menu_faq' }],
            NÚT_ĐĂNG_KÝ_SỰ_KIỆN
        ]
    };

    const options = { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: keyboard };

    if (messageId) {
        bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...options }).catch(() => bot.sendMessage(chatId, text, options));
    } else {
        bot.sendMessage(chatId, text, options).catch(() => {});
    }
}

// ==========================================
// /START & LẤY SĐT KHẢO SÁT
// ==========================================
bot.onText(/\/start(.*)/i, async (msg) => {
    if (msg.chat.type !== 'private') return;
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    let user = await User.findOne({ userId });
    if (!user) user = new User({ userId, firstName: msg.from.first_name || '', lastName: msg.from.last_name || '', username: msg.from.username ? `@${msg.from.username}` : '' });
    else { user.firstName = msg.from.first_name || ''; user.lastName = msg.from.last_name || ''; user.username = msg.from.username ? `@${msg.from.username}` : ''; }
    await user.save();

    if (!user.phone) {
        const welcomeMsg = `Xin chào <b>${user.firstName}</b>! 🦁\n\nTôi là <b>Tí</b> — trợ lý AI của quỹ <b>SWC Capital Viet Nam</b>.\n\nĐể hỗ trợ anh/chị thiết lập hồ sơ đầu tư và cung cấp chiến lược chính xác nhất, vui lòng <b>chia sẻ số điện thoại</b> bằng nút bên dưới nhé! 👇`;
        bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'HTML', reply_markup: { keyboard: [[{ text: "📞 Chia sẻ Số điện thoại", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } }).catch(() => {});
    } else {
        sendMainMenu(chatId);
    }
});

bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    await User.updateOne({ userId }, { $set: { phone: msg.contact.phone_number } });

    bot.sendMessage(chatId, "⏳ Đang thiết lập hồ sơ nhà đầu tư...", { reply_markup: { remove_keyboard: true } }).then(sent => {
        bot.deleteMessage(chatId, sent.message_id).catch(() => {});
        sendMainMenu(chatId);
    });

    setTimeout(() => {
        const surveyMsg = `👋 Để Tí và đội ngũ chuyên gia hỗ trợ anh/chị chuẩn xác nhất, cho Tí biết vị thế hiện tại của mình nhé:`;
        bot.sendMessage(chatId, surveyMsg, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🙋 Tôi là nhà đầu tư mới", callback_data: 'survey_newbie' }],
                    [{ text: "💼 Tôi đã có kinh nghiệm đầu tư", callback_data: 'survey_experienced' }],
                    [{ text: "🔥 Tôi đã sở hữu SWC Pass", callback_data: 'survey_vip' }],
                    [{ text: "💎 Tôi quan tâm Siêu dự án ATLAS", callback_data: 'survey_atlas' }]
                ]
            }
        }).catch(() => {});
    }, 15000);
});

// ==========================================
// CALLBACK QUERY (MENU & FAQ)
// ==========================================
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id.toString();
    const data = callbackQuery.data;
    const daysLeft = getDaysLeft();

    let user = await User.findOne({ userId });
    if (!user) return bot.answerCallbackQuery(callbackQuery.id);

    let text = '';
    let keyboard = [];
    const ctaButtons = [
        [{ text: "💬 THAM GIA NHÓM CHAT ĐẦU TƯ", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }],
        [{ text: "🔙 Quay lại Menu Chính", callback_data: 'main_menu' }],
        NÚT_ĐĂNG_KÝ_SỰ_KIỆN
    ];

    if (data === 'main_menu') return sendMainMenu(chatId, messageId);

    // --- SWC PASS MENU ---
    else if (data === 'menu_swcpass') {
        text = `💎 <b>SWC PASS — TẤM VÉ THÔNG HÀNH GIỚI TINH ANH</b>\n\nBạn mở ra cánh cửa cơ hội trước đây chỉ dành cho các nhà đầu tư tổ chức (Vốn >$500k). Chúng tôi cung cấp Cấu trúc pháp lý SPV an toàn, minh bạch thay vì thu phí giao dịch ẩn.\n\n<b>CÁC ĐẶC QUYỀN VƯỢT TRỘI:</b>\n✔️ Sở hữu cổ phiếu của SPV (Tài sản thực pháp lý tại Mỹ/EU/Nga).\n✔️ Đầu tư vòng Private chỉ từ $50.\n✔️ Tham gia câu lạc bộ, nhận chiến lược Road to $1M (10 phút/tháng).\n\n<b>3 LỰA CHỌN THÀNH VIÊN:</b>\n1️⃣ <b>Essential (1 năm - $240):</b> Gói "Cà phê trải nghiệm" ($20/tháng).\n2️⃣ <b>Plus (5 năm - $600):</b> Gói "Kỷ luật thép" (Chỉ $10/tháng - Tiết kiệm 50%). Khuyên dùng!\n3️⃣ <b>Ultimate (Vĩnh viễn - $2.600):</b> Gói "Di sản gia tộc". Mua đứt mỏ vàng.\n\n⚠️ <i>Lưu ý: Gói Ultimate giới hạn 1000 suất và sẽ ĐÓNG CỬA VĨNH VIỄN sau <b>${daysLeft} ngày</b> nữa (${DEADLINE}).</i>`;
        keyboard = [[{ text: "🗺️ Xem Lộ Trình Road to $1M", callback_data: 'road_to_1m' }], [{ text: "🌐 Website SWC Pass", url: SWC_PASS_WEB }], ...ctaButtons];
    }

    // --- HÀNH TRÌNH ĐẾN $1M FULL ---
    else if (data === 'road_to_1m' || data === 'faq_2') {
        text = `🗺️ <b>Hành trình đến $1M (Road to $1M)</b>\n\nChiến lược do SWC Field phát triển. Đây là một chương trình đầu tư dài hạn: <b>chỉ cần đầu tư 8 đô la mỗi ngày (khoảng 240 đô la mỗi tháng) có kỷ luật</b>, đảm bảo đầu tư đều đặn và với <b>sức mạnh lãi kép</b>, bạn có thể hướng đến mục tiêu đạt số vốn <b>1.000.000 đô la trong 15 năm</b>.\n\nSản phẩm là một hệ thống hoàn chỉnh cho phép bạn bắt đầu đầu tư mà không cần kinh nghiệm hay các khóa đào tạo — và không cần tốn nhiều thời gian (chỉ 10-15 phút mỗi tháng).\n\n🎯 <b>Mục tiêu cốt lõi:</b>\n1. Xây dựng vốn tài chính dài hạn bằng Lãi kép.\n2. Đạt sự tự do và độc lập tài chính thoát khỏi "sống dựa đồng lương".\n3. Xây dựng di sản tài chính vững chắc cho thế hệ tương lai.\n\n🔥 <b>Lợi ích tuyệt đối:</b>\n- Nhận tín hiệu hàng tháng (Mua mã nào, tỷ lệ bao nhiêu, giá nào).\n- Tiết kiệm 10.000 giờ tự học, tự mò mẫm biểu đồ.\n- Phương pháp DCA (Trung bình giá) bảo vệ bạn khỏi sự hoảng loạn của thị trường.`;
        keyboard = [[{ text: "🔙 Quay lại", callback_data: data === 'faq_2' ? 'faq_back' : 'menu_swcpass' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN];
    }

    // --- SIÊU DỰ ÁN ATLAS ---
    else if (data === 'menu_atlas') {
        text = `🏢 <b>SIÊU DỰ ÁN ATLAS — BĐS SỐ HÓA DUBAI (RWA)</b>\n\nSở hữu và giao dịch <b>bất động sản Dubai</b> chỉ bằng vài cú chạm trên điện thoại.\n\n🌟 <b>Điểm nổi bật:</b>\n• <b>Thanh khoản 3 giây</b> — phá vỡ sự chậm chạp BĐS truyền thống\n• <b>Pháp nhân Atlas Overseas FZE</b> — cấp phép bởi Trung tâm Thương mại Dubai\n• <b>Đầu tư từ $50</b> — dân chủ hóa sân chơi giới siêu giàu\n• <b>RWA (Real World Assets)</b> — tài sản thật, thanh khoản thật\n\n⚠️ Vòng ưu đãi <b>đóng lại ${DEADLINE}</b>. Đừng bỏ lỡ vị thế tốt nhất!`;
        keyboard = [[{ text: "🌐 Khám phá SWC Field", url: SWC_FIELD_WEB }], ...ctaButtons];
    }

    // --- FAQ NÂNG CAO ---
    else if (data === 'menu_faq' || data === 'faq_back') {
        text = `❓ <b>GIẢI ĐÁP THẮC MẮC PHỔ BIẾN</b>\nChọn câu hỏi bạn đang quan tâm:`;
        keyboard = [
            [{ text: "1. Nhận được gì ngay sau thanh toán?", callback_data: 'faq_1' }],
            [{ text: "2. Hành trình đến $1M là gì?", callback_data: 'road_to_1m' }],
            [{ text: "3. Khác gì tự học YouTube miễn phí?", callback_data: 'faq_3' }],
            [{ text: "4. Chưa có đủ $600 lúc này?", callback_data: 'faq_4' }],
            [{ text: "5. Giữ tiền mặt có an toàn không?", callback_data: 'faq_5' }],
            [{ text: "🔙 Menu Chính", callback_data: 'main_menu' }],
            NÚT_ĐĂNG_KÝ_SỰ_KIỆN
        ];
    }
    else if (data === 'faq_1') {
        text = `✅ <b>Nhận được gì ngay sau khi thanh toán?</b>\n\nQuyền truy cập <b>đầy đủ và ngay lập tức</b> vào hệ sinh thái SWC Field. Tín hiệu đầu tư chiến lược tháng đầu tiên sẽ hiển thị trong tài khoản của bạn <b>chỉ sau vài phút</b>.\nBạn sẽ biết chính xác: mua mã cổ phiếu nào, tỷ lệ bao nhiêu, mua ở giá nào. <b>Không cần chờ đợi hay phân tích!</b>`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN];
    }
    else if (data === 'faq_3') {
        text = `✅ <b>Khác gì kiến thức miễn phí YouTube?</b>\n\nKiến thức miễn phí thì đầy rẫy — nhưng nếu chỉ "biết" mà giàu thì ai cũng là triệu phú rồi. \nSự khác biệt của SWC Pass nằm ở <b>Hệ thống Kỷ luật ép bạn thực thi</b>, loại bỏ hoàn toàn cảm xúc cá nhân sợ hãi hay fomo.\nGiống như việc bạn đọc sách dạy bơi so với việc <b>thực sự nhảy xuống hồ với Huấn luyện viên bơi lội kế bên</b>.`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN];
    }
    else if (data === 'faq_4') {
        text = `✅ <b>Chưa có đủ $600 lúc này để mua Gói 5 năm?</b>\n\nBài toán đơn giản: $600 ÷ 5 năm = <b>$10/tháng</b> (~250.000 VNĐ). Số tiền bạn đang ném qua cửa sổ cho 1 chầu cà phê mỗi tuần.\nTrì hoãn "chờ có đủ tiền" = <b>đánh mất hàng thập kỷ sức mạnh lãi kép</b>. Cái giá thực sự không phải $600 — mà là chi phí cơ hội bạn bỏ lỡ!`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN];
    }
    else if (data === 'faq_5') {
        text = `✅ <b>Giữ tiền mặt trong két/ngân hàng cho an toàn?</b>\n\nĐây là <b>ảo giác an toàn nguy hiểm nhất</b>. Ngân hàng trung ương in tiền mỗi ngày → lạm phát <b>lặng lẽ móc túi bạn</b> mà không kêu một tiếng.\nGiữ tiền mặt dài hạn = <b>đảm bảo 100% bạn sẽ nghèo đi theo thời gian</b>. Giới tinh anh không bao giờ tích trữ tiền mặt dài hạn! Họ chuyển hóa thành Tài sản.`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN];
    }

    // --- KHẢO SÁT CHÍNH XÁC TÂM LÝ CHỐT SALE ---
    else if (data === 'survey_newbie') {
        user.tag = 'newbie'; user.funnelStage = 'interested'; await user.save();
        text = `✅ Cảm ơn anh/chị đã chia sẻ!\n\nLà người mới, <b>lạm phát đang âm thầm ăn mòn tiền mặt mỗi ngày</b>. Giải pháp duy nhất là xây dựng cỗ máy dòng tiền tự động.\n\nGói <b>Essential ($240/năm)</b> là lựa chọn hoàn hảo để bắt đầu — không cần kinh nghiệm, chỉ 10 phút/tháng để làm quen với hệ thống chuyên gia.\n\n⏳ Còn <b>${daysLeft} ngày</b> để đăng ký với mức giá ưu đãi nhất!`;
        keyboard = ctaButtons;
    }
    else if (data === 'survey_experienced') {
        user.tag = 'experienced'; user.funnelStage = 'hot_lead'; await user.save();
        text = `✅ Tuyệt vời! Anh/chị là nhà đầu tư có tầm nhìn.\n\nVới kinh nghiệm sẵn có, anh chị sẽ hiểu giá trị của Cấu trúc SPV. <b>SWC Field — Private Rounds</b> chính là sân chơi tiếp theo để nhân x lần tài sản thay vì tự trade rủi ro.\n\nGói <b>Plus ($600 / 5 năm)</b> sẽ mở khóa toàn bộ đặc quyền này cho anh/chị (Tiết kiệm 50% chi phí).\n\n⚠️ Vòng ưu đãi <b>đóng cửa ${DEADLINE}</b>. Đừng bỏ lỡ!`;
        keyboard = ctaButtons;
    }
    else if (data === 'survey_vip') {
        user.tag = 'vip_pass'; user.swcPassTier = 'essential'; user.funnelStage = 'converted'; await user.save();
        text = `✅ <b>Chào mừng thành viên VIP!</b>\n\nAnh/chị đã có vũ khí mạnh nhất của hệ sinh thái SWC rồi 💪\nHãy chắc chắn đã tham gia Group nội bộ để <b>nhận tín hiệu chiến lược hàng tháng</b> và cập nhật dự án SWC Field.`;
        keyboard = [[{ text: "💬 Vào Group VIP Telegram", url: PRIVATE_TG_GROUP }], [{ text: "🔙 Menu Chính", callback_data: 'main_menu' }]];
    }
    else if (data === 'survey_atlas') {
        user.tag = 'atlas_investor'; user.funnelStage = 'hot_lead'; await user.save();
        text = `✅ <b>Tầm nhìn của anh/chị hoàn toàn đúng!</b>\n\nATLAS chính là xu hướng RWA của tương lai. Giao dịch BĐS Dubai chỉ với 1 chạm.\n\nGói <b>Ultimate ($2,600 — Vĩnh viễn)</b> được thiết kế đặc biệt cho những tay chơi lớn như anh/chị. Mua đứt đặc quyền trọn đời.\n\n⏳ Chỉ còn <b>${daysLeft} ngày</b> — 1.000 suất, đóng cửa vĩnh viễn ${DEADLINE}!`;
        keyboard = ctaButtons;
    }

    bot.answerCallbackQuery(callbackQuery.id).catch(() => {});
    if (text !== '') {
        bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard } }).catch(() => {
            bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard } });
        });
    }
});

// ==========================================
// XỬ LÝ TIN NHẮN — AI TƯ VẤN VÀ ADMIN
// ==========================================
bot.on('message', async (msg) => {
    if (!msg.from || msg.from.is_bot) return;
    if (msg.chat.type !== 'private') return;
    if (msg.contact || (msg.text && msg.text.startsWith('/'))) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // 1. ADMIN REPLY (KHÓA AI TRONG 2 TIẾNG)
    if (userId === ADMIN_ID && msg.reply_to_message) {
        const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
        const idMatch = originalText.match(/ID:\s*(\d+)/);
        if (idMatch) {
            const targetId = idMatch[1];
            bot.sendMessage(targetId, `👨‍💻 <b>Phản hồi từ Đội ngũ Chuyên gia SWC:</b>\n\n${msg.text || msg.caption}`, { parse_mode: 'HTML' }).catch(() => {});
            bot.sendMessage(ADMIN_ID, `✅ Đã gửi câu trả lời cho khách ID: <code>${targetId}</code>`, { parse_mode: 'HTML' });
            
            await User.updateOne({ userId: targetId }, { $set: { adminPausedAiUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) } });
            return;
        }
    }

    // 2. KHÁCH NHẮN TIN (AI CLAUDE XỬ LÝ & BÁO CÁO ẢNH CHO ADMIN)
    if (userId !== ADMIN_ID) {
        let user = await User.findOne({ userId });
        if (!user) { user = new User({ userId, firstName: msg.from.first_name || '', lastName: msg.from.last_name || '', username: msg.from.username ? `@${msg.from.username}` : '' }); await user.save(); }

        if (msg.photo || msg.video || msg.document) {
            await bot.forwardMessage(ADMIN_ID, chatId, msg.message_id).catch(() => {});
            bot.sendMessage(ADMIN_ID, `📩 <b>TỆP/ẢNH TỪ KHÁCH HÀNG</b>\n👤 Tên: ${user.firstName}\n🆔 ID: <code>${userId}</code>\n💬 Ghi chú: ${msg.caption || 'Không có'}\n\n👉 <i>Reply để chat trực tiếp (AI sẽ tự khóa).</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "💬 Chat trực tiếp", url: `tg://user?id=${userId}` }]] } }).catch(()=>{});
        }

        const now = new Date();
        if (user.adminPausedAiUntil && user.adminPausedAiUntil > now) {
            bot.sendMessage(ADMIN_ID, `📩 <b>KHÁCH TRẢ LỜI (CHẾ ĐỘ ADMIN CHAT)</b>\n👤 Tên: ${user.firstName}\n🆔 ID: <code>${userId}</code>\n💬 Nội dung: ${msg.text || '[Ảnh/File]'}\n\n👉 <i>Reply để tiếp tục chat.</i>`, { parse_mode: 'HTML' }).catch(()=>{});
            return;
        }

        bot.sendChatAction(chatId, 'typing').catch(() => {});
        const userText = msg.text || msg.caption || '[Khách gửi file/ảnh]';
        const aiReply = await callClaude(user, userText);
        bot.sendMessage(chatId, aiReply, { parse_mode: 'HTML' }).catch(() => {});

        if (['interested', 'hot_lead', 'converted'].includes(user.funnelStage)) {
            const alertMsg = `🔥 <b>HOT LEAD — ĐANG CHAT VỚI AI</b>\n👤 Tên: <b>${user.firstName}</b>\n🆔 ID: <code>${userId}</code>\n\n💬 <b>Khách:</b> ${userText}\n🤖 <b>AI Tí:</b> ${aiReply}\n\n👉 <i>Reply tin này để cướp quyền điều khiển từ AI.</i>`;
            bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "💬 Cướp quyền chat", url: `tg://user?id=${userId}` }]] } }).catch(() => {});
        }
    }
});

// ==========================================
// BROADCAST TỰ ĐỘNG THEO LỊCH 
// ==========================================
function getVNTime() {
    const now = new Date();
    return new Date(now.getTime() + (7 * 60 * 60 * 1000));
}

async function broadcastToAll(message, options = {}) {
    const users = await User.find({ broadcastOptOut: false });
    let success = 0;
    for (const user of users) {
        try { await bot.sendMessage(user.userId, message, { parse_mode: 'HTML', ...options }); success++; } catch (e) {}
        await new Promise(r => setTimeout(r, 50));
    }
    return success;
}

async function broadcastToTag(tag, message, options = {}) {
    const users = await User.find({ tag, broadcastOptOut: false });
    let success = 0;
    for (const user of users) {
        try { await bot.sendMessage(user.userId, message, { parse_mode: 'HTML', ...options }); success++; } catch (e) {}
        await new Promise(r => setTimeout(r, 50));
    }
    return success;
}

setInterval(async () => {
    const vn = getVNTime();
    const h = vn.getUTCHours();
    const m = vn.getUTCMinutes();
    const daysLeft = getDaysLeft();

    // 08:00 — Bài sáng (tất cả users)
    if (h === 8 && m === 0) {
        const msg = `🌅 <b>CHÀO BUỔI SÁNG — THỊ TRƯỜNG HÔM NAY NÓI GÌ?</b>\n\nTrong khi đa số nhà đầu tư F0 đang lo lắng không biết hôm nay thị trường đi đâu...\nThành viên SWC đã có kế hoạch từ đầu tháng. Không cần đoán mò.\n\n💡 <b>Sự thật:</b> 95% người tự trade thua lỗ không phải vì thiếu thông tin — mà vì <b>thiếu hệ thống kỷ luật</b>.\n\n⏳ Còn <b>${daysLeft} ngày</b> để gia nhập hệ thống tốt nhất trước khi cửa đóng.\n\n👉 ${ACTIVATE_URL}`;
        await broadcastToAll(msg, { reply_markup: { inline_keyboard: [[{ text: `🚀 KÍCH HOẠT — CÒN ${daysLeft} NGÀY`, url: ACTIVATE_URL }]] } });
    }

    // 12:00 — Tip kiến thức (tất cả)
    if (h === 12 && m === 0) {
        const tips = [
            `💡 <b>KIẾN THỨC TÀI CHÍNH HÔM NAY</b>\n\n<b>5 Tầng chuỗi thức ăn tài chính:</b>\n\n1. Chính phủ/NHTW — Điều tiết lãi suất\n2. Cá voi (Quỹ lớn) — Gom đáy bán đỉnh\n3. Đội lái — Vẽ chart, rũ bỏ\n4. Sói già — Trader kỷ luật\n5. F0 — Thanh khoản cho tầng trên\n\n❓ Bạn đang ở tầng nào?\n\n⏳ SWC Pass giúp bạn <b>nhảy thẳng lên Tầng 2</b> — đứng trên vai Quỹ lớn. Còn ${daysLeft} ngày!`,
            `💡 <b>KIẾN THỨC TÀI CHÍNH HÔM NAY</b>\n\n<b>Tại sao tự trade nguy hiểm?</b>\n\nKhi giá tạo đỉnh, tâm lý F0 là FOMO mua vào đu đỉnh. Khi giá sập, F0 hoảng loạn cắt lỗ đáy.\nĐây là dấu chân Cá voi đang xả hàng lấy thanh khoản.\n\n💎 Thành viên SWC không cần tự đọc chart — AI chuyên gia Phố Wall làm thay với chiến lược DCA. Còn ${daysLeft} ngày!`,
            `💡 <b>KIẾN THỨC TÀI CHÍNH HÔM NAY</b>\n\n<b>Lãi kép — Kỳ quan thứ 8 của thế giới</b>\n\n$240/tháng × 15 năm × lãi kép 20%/năm = <b>$1,000,000+</b>\n\nBí quyết không phải là số tiền lớn — mà là <b>bắt đầu SỚM và kỷ luật ĐỀU ĐẶN</b>.\nMỗi ngày trì hoãn = mất đi một phần sức mạnh lãi kép. Còn ${daysLeft} ngày!`
        ];
        const tip = tips[Math.floor(Math.random() * tips.length)];
        await broadcastToAll(tip, { reply_markup: { inline_keyboard: [[{ text: `💎 Xem Gói SWC Pass`, callback_data: 'menu_swcpass' }]] } });
    }

    // 19:30 — Kéo vào group (tất cả)
    if (h === 19 && m === 30) {
        const msg = `📚 <b>THỜI GIAN CẬP NHẬT TIN TỨC & KIẾN THỨC TÀI CHÍNH!</b>\n\nVào Group cộng đồng ngay để:\n✅ Cập nhật tin tức mới nhất về SWC Field (Dự án ATLAS)\n✅ Thảo luận chiến lược đầu tư giá trị\n✅ Kết nối với hơn 1.000+ nhà đầu tư tinh anh\n\n⏳ Còn <b>${daysLeft} ngày</b> để gia nhập hệ sinh thái với giá tốt nhất!`;
        await broadcastToAll(msg, { reply_markup: { inline_keyboard: [ [{ text: "💬 Vào Group Thảo Luận Ngay", url: `https://t.me/${GROUP_USERNAME.replace('@', '')}` }], [{ text: `🚀 Kích Hoạt SWC Pass`, url: ACTIVATE_URL }] ] } });
    }

    // 20:30 — FOMO chốt sale (hot leads & interested)
    if (h === 20 && m === 30) {
        const msg = `🔥 <b>NHẮC NHỞ KHẨN — CÒN ${daysLeft} NGÀY!</b>\n\nLúc này có 2 loại người:\nLoại 1: Đang ngồi phân tích chart, lo lắng không biết thị trường đi đâu...\nLoại 2: Đã có SWC Pass — <b>đang ngủ ngon trong khi port tự chạy</b>.\n\nBạn muốn là loại nào?\n\nGói <b>Ultimate (Vĩnh viễn)</b> — 1.000 suất — <b>đóng cửa ${DEADLINE}</b>.\nSau ngày đó? Không ngoại lệ. Không "để tôi hỏi thêm."\n\n👉 ${ACTIVATE_URL}`;
        await broadcastToTag('hot_lead', msg, { reply_markup: { inline_keyboard: [[{ text: `⚡ KÍCH HOẠT NGAY — CÒN ${daysLeft} NGÀY`, url: ACTIVATE_URL }]] } });
        await broadcastToTag('interested', msg, { reply_markup: { inline_keyboard: [[{ text: `⚡ KÍCH HOẠT NGAY — CÒN ${daysLeft} NGÀY`, url: ACTIVATE_URL }]] } });
    }

    // 21:00 — Nội dung VIP cho uST holders và Pass holders
    if (h === 21 && m === 0) {
        const vipMsg = `💎 <b>CẬP NHẬT NỘI BỘ — DÀNH RIÊNG CHO THÀNH VIÊN VIP</b>\n\nTuần này thị trường đang trong giai đoạn tích lũy. Đây là thời điểm <b>Cá voi âm thầm gom hàng</b> — không phải lúc hoảng loạn bán ra.\n\nTín hiệu tháng tới sẽ được cập nhật sớm trong hệ thống Road to $1M.\nAnh/chị đang đi đúng hướng. Giữ vững Vị thế! 💪\n\n👉 Truy cập tài khoản: ${ACTIVATE_URL}`;
        await broadcastToTag('vip_pass', vipMsg);
        await broadcastToTag('ust_holder', vipMsg);
    }
}, 60000);

// ==========================================
// FUNNEL DRIP — CHUỖI 7 NGÀY BÁM ĐUỔI KHÁCH HÀNG 
// ==========================================
const funnelMessages = [
    null, // Ngày 0
    `📖 <b>BÀI HỌC SỐ 1: TẠI SAO 95% NHÀ ĐẦU TƯ THUA LỖ?</b>\n\nKhông phải vì thiếu thông tin. Không phải vì thị trường xấu.\nMà vì họ đang chơi trò chơi mà <b>luật do người khác viết</b>.\n\n5 tầng chuỗi thức ăn tài chính:\n🏛️ Chính phủ → 🐋 Cá voi → 🎰 Đội lái → 🐺 Sói già → 😵 F0\n\n<b>F0 (Tầng 5) = Thanh khoản cho tất cả tầng trên.</b>\nMỗi lần bạn mua vào hoảng loạn hay bán ra sợ hãi — đó là lúc Cá voi đang ăn tiền của bạn.\n\n💡 Giải pháp duy nhất: Đừng chơi một mình. Hãy đứng trên vai Quỹ lớn qua cấu trúc SPV.\n<i>→ Đó là lý do SWC Pass tồn tại.</i>`,
    `📖 <b>BÀI HỌC SỐ 2: TIỀN NHÀN RỖI LÀ GÌ?</b>\n\nCó một nguyên tắc bất di bất dịch:\n<b>TUYỆT ĐỐI không đầu tư bằng tiền "cơm áo gạo tiền".</b>\n\nChỉ dùng tiền nhàn rỗi — tiền mà dù mất đi hôm nay, cuộc sống của bạn không thay đổi.\nĐây là lý do hầu hết F0 thua lỗ: họ dùng tiền học phí, tiền thuê nhà để "đánh nhanh rút gọn." Kết quả? Không dám cắt lỗ → Gồng lỗ → Cháy tài khoản.\n\n💡 Gói Plus của SWC Pass bắt đầu từ <b>$10/tháng (~250k VNĐ)</b> — đúng nghĩa tiền nhàn rỗi ly cà phê.`,
    `📖 <b>BÀI HỌC SỐ 3: SỨC MẠNH LÃI KÉP</b>\n\nEinstein gọi đây là "Kỳ quan thứ 8 của thế giới."\n<b>$240/tháng × kỷ luật × 15 năm = $1,000,000</b>\n\nKhông phải may mắn. Không phải tài năng. Chỉ là <b>toán học + thời gian + kỷ luật</b>.\nVấn đề của đa số: Họ không bắt đầu sớm. Họ cứ chờ "đúng thời điểm."\n\n💡 <b>Thời điểm tốt nhất là 10 năm trước. Thời điểm tốt thứ 2 là HÔM NAY.</b>\n⏳ Còn {DAYS} ngày để bắt đầu!`,
    `🔥 <b>CÒN {DAYS} NGÀY — ĐÃ CÓ BAO NHIÊU NGƯỜI ĐĂNG KÝ RỒI?</b>\n\nGói Ultimate (Vĩnh viễn) — 1.000 suất toàn cầu.\nKhi 1.000 suất đầy → cửa đóng vĩnh viễn. Không mở lại. Không ngoại lệ.\n\nNgười đăng ký hôm nay đang <b>khóa giá vĩnh viễn</b> trong khi giá thị trường chỉ có một chiều: đi lên.\n<b>Câu hỏi không phải "Có nên mua không?" — mà là "Bao giờ thì quá muộn?"</b>\n\n👉 ${ACTIVATE_URL}`,
    `💬 <b>HỌ ĐÃ THAY ĐỔI NHƯ THẾ NÀO SAU KHI DÙNG SWC PASS?</b>\n\n<i>"Trước đây tôi dành 3-4 tiếng mỗi ngày xem chart, vẫn thua lỗ. Giờ 10 phút/tháng, danh mục đang tăng trưởng đều đặn."</i>\n<i>"Tôi không còn mất ngủ vì thị trường biến động nữa. Hệ thống đang chạy thay tôi."</i>\n\n💡 Đây không phải may mắn. Đây là <b>hệ thống đúng + kỷ luật đúng</b>.\n⏳ Còn {DAYS} ngày — Anh/chị sẵn sàng chưa?`,
    `⚡ <b>NGÀY MAI LÀ NGÀY CUỐI CÙNG!</b>\n\nAnh/chị đã theo dõi thông tin SWC trong nhiều ngày. Đây là lúc đưa ra quyết định.\n\n<b>2 lựa chọn:</b>\n❌ Tiếp tục tự trade → Tiếp tục mất thời gian + tiền bạc + sức khỏe tâm thần\n✅ Mua SWC Pass → 10 phút/tháng, đứng trên vai Quỹ lớn, bảo vệ tài sản qua SPV.\n\nGói Ultimate đóng cửa <b>${DEADLINE}</b>. Quyết định hôm nay định hình 15 năm tới của anh/chị.\n👉 ${ACTIVATE_URL}`,
    `🚨 <b>HÔM NAY LÀ NGÀY CUỐI CÙNG!</b>\n\n23:59 tối nay — cửa đóng. Không phải "sắp đóng." Không phải "sẽ mở lại sau." <b>ĐÓNG VĨNH VIỄN.</b>\n\nNếu anh/chị đang đọc tin này — còn kịp.\nNếu anh/chị đọc tin này vào ngày mai — sẽ không còn kịp nữa.\n\n👉 <b>KÍCH HOẠT NGAY:</b>\n${ACTIVATE_URL}\n\n📺 Hướng dẫn (mobile): ${VIDEO_MOBILE}\n💻 Hướng dẫn (PC): ${VIDEO_PC}`
];

setInterval(async () => {
    try {
        const now = new Date();
        const daysLeft = getDaysLeft();
        const funnelUsers = await User.find({
            funnelStage: { $in: ['interested', 'hot_lead'] },
            broadcastOptOut: false,
            lastFunnelSent: { $lt: new Date(now.getTime() - 20 * 60 * 60 * 1000) } 
        });

        for (const user of funnelUsers) {
            const day = Math.min(user.funnelDay + 1, funnelMessages.length - 1);
            let msgTemplate = funnelMessages[day];
            if (!msgTemplate) continue;

            const msg = msgTemplate.replace(/{DAYS}/g, daysLeft);
            try {
                await bot.sendMessage(user.userId, msg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: `🚀 Kích Hoạt SWC Pass — Còn ${daysLeft} Ngày`, url: ACTIVATE_URL }]] } });
                user.funnelDay = day; user.lastFunnelSent = now; await user.save();
            } catch (e) {}
            await new Promise(r => setTimeout(r, 100));
        }
    } catch (e) { console.error('Funnel error:', e.message); }
}, 60 * 60 * 1000); 

// ==========================================
// ADMIN COMMANDS
// ==========================================
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id, `👨‍💻 <b>ADMIN PANEL — SWC BOT v4.0 (CHỐT SALE CÁO GIÀ)</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Thống kê Phễu Khách Hàng", callback_data: 'admin_stats' }],
                [{ text: "📢 Lệnh Sendall & MKT", callback_data: 'admin_help' }]
            ]
        }
    });
});

bot.on('callback_query', async (query) => {
    if(query.data === 'admin_stats' && query.from.id.toString() === ADMIN_ID) {
        const total = await User.countDocuments();
        const newbie = await User.countDocuments({ tag: 'newbie' });
        const experienced = await User.countDocuments({ tag: 'experienced' });
        const vip = await User.countDocuments({ tag: 'vip_pass' });
        const atlas = await User.countDocuments({ tag: 'atlas_investor' });
        const interested = await User.countDocuments({ funnelStage: 'interested' });
        const hotLead = await User.countDocuments({ funnelStage: 'hot_lead' });
        const converted = await User.countDocuments({ funnelStage: 'converted' });

        const report = `📊 <b>THỐNG KÊ HỆ THỐNG SWC BOT</b>\n\n👥 <b>Tổng users:</b> ${total}\n⏳ <b>Còn lại:</b> ${getDaysLeft()} ngày đến ${DEADLINE}\n\n<b>Phân loại:</b>\n• 🙋 F0/Mới: ${newbie}\n• 💼 Có kinh nghiệm: ${experienced}\n• 🔥 Đã có Pass: ${vip}\n• 🏢 Đầu tư ATLAS: ${atlas}\n\n<b>Phễu (Funnel):</b>\n• 🌱 Quan tâm (Interested): ${interested}\n• 🔥 Sắp chốt (Hot Lead): ${hotLead}\n• ✅ Đã chốt (Converted): ${converted}`;
        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    }
    if(query.data === 'admin_help' && query.from.id.toString() === ADMIN_ID) {
        bot.sendMessage(ADMIN_ID, `📢 <b>LỆNH ADMIN MKT:</b>\n\n1. <code>/tracuu [ID]</code>: Soi hồ sơ khách.\n2. <code>/addnote [ID] [Ghi chú]</code>: Lưu thông tin khách.\n3. <code>/setpass [ID] [Gói]</code>: Nâng cấp gói cho khách (none / essential / plus / ultimate).\n4. <code>/sendall [Nội dung]</code>: Gửi toàn hệ thống.\n5. <code>/sendtag [Tag] [Nội dung]</code>: Gửi theo nhóm (newbie, experienced, vip_pass, atlas_investor).\n6. <code>/sendgroup [Nội dung]</code>: Bot gửi tin lên Group chat.\n7. <code>/export</code>: Lấy danh sách 50 Hot Lead.`, { parse_mode: 'HTML' });
    }
});

bot.onText(/\/tracuu (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const user = await User.findOne({ userId: match[1] });
    if (!user) return bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy ID: <code>${match[1]}</code>`, { parse_mode: 'HTML' });
    const report = `🔎 <b>HỒ SƠ KHÁCH HÀNG</b>\n🆔 ID: <code>${match[1]}</code>\n👤 Tên: ${user.firstName} ${user.lastName}\n🔗 User: ${user.username || 'Không'}\n📞 SĐT: ${user.phone || 'Chưa có'}\n🏷 Tag: ${user.tag}\n🎯 Funnel: ${user.funnelStage} (Ngày ${user.funnelDay})\n💎 Gói Pass: ${user.swcPassTier}\n📅 Join: ${new Date(user.joinDate).toLocaleString('vi-VN')}\n📝 Ghi chú: ${user.notes || 'Trống'}\n\n👉 <a href="tg://user?id=${match[1]}">Nhấn vào đây để chat</a>`;
    bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
});

bot.onText(/\/addnote (\d+) ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    await User.updateOne({ userId: match[1] }, { $set: { notes: match[2] } });
    bot.sendMessage(ADMIN_ID, `✅ Đã lưu ghi chú cho ID <code>${match[1]}</code>:\n${match[2]}`, { parse_mode: 'HTML' });
});

bot.onText(/\/setpass (\d+) (\w+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const validTiers = ['none', 'essential', 'plus', 'ultimate'];
    const tier = match[2].toLowerCase();
    if (!validTiers.includes(tier)) return bot.sendMessage(ADMIN_ID, `❌ Dùng: none / essential / plus / ultimate`);
    await User.updateOne({ userId: match[1] }, { $set: { swcPassTier: tier, funnelStage: tier !== 'none' ? 'converted' : 'hot_lead' } });
    bot.sendMessage(ADMIN_ID, `✅ Đã cập nhật SWC Pass cho ID <code>${match[1]}</code> → <b>${tier}</b>`, { parse_mode: 'HTML' });
});

bot.onText(/\/sendall ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({});
    bot.sendMessage(ADMIN_ID, `⏳ Đang gửi cho ${users.length} users...`);
    let success = 0;
    for (const u of users) {
        try { await bot.sendMessage(u.userId, match[1], { parse_mode: 'HTML', reply_markup: { inline_keyboard: [NÚT_ĐĂNG_KÝ_SỰ_KIỆN] } }); success++; } catch (e) {}
        await new Promise(r => setTimeout(r, 50));
    }
    bot.sendMessage(ADMIN_ID, `✅ Đã gửi thành công: ${success}/${users.length}`);
});

bot.onText(/\/sendtag (\w+) ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({ tag: match[1] });
    bot.sendMessage(ADMIN_ID, `⏳ Đang gửi cho ${users.length} users tag [${match[1]}]...`);
    let success = 0;
    for (const u of users) {
        try { await bot.sendMessage(u.userId, match[2], { parse_mode: 'HTML' }); success++; } catch (e) {}
        await new Promise(r => setTimeout(r, 50));
    }
    bot.sendMessage(ADMIN_ID, `✅ Đã gửi: ${success}/${users.length}`);
});

bot.onText(/\/sendgroup ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try {
        await bot.sendMessage(GROUP_USERNAME, `📢 <b>THÔNG BÁO TỪ ĐỘI NGŨ SWC:</b>\n\n${match[1]}`, { parse_mode: 'HTML' });
        bot.sendMessage(ADMIN_ID, `✅ Đã gửi lên Group!`);
    } catch (e) { bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`); }
});

bot.onText(/\/export/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const hotLeads = await User.find({ funnelStage: { $in: ['hot_lead', 'interested'] } }).limit(50);
    if (hotLeads.length === 0) return bot.sendMessage(ADMIN_ID, `📭 Chưa có hot lead nào.`);
    let report = `🔥 <b>DANH SÁCH HOT LEADS (${hotLeads.length} người)</b>\n\n`;
    hotLeads.forEach((u, i) => { report += `${i + 1}. <b>${u.firstName} ${u.lastName}</b> | <code>${u.userId}</code> | ${u.tag} | SĐT: ${u.phone || 'Chưa có'}\n`; });
    bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
});

// ==========================================
// HTTP SERVER BẮT BUỘC ĐỂ RENDER KHÔNG BÁO LỖI TIMED OUT
// ==========================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SWC Bot v4.0 - Hoạt động bình thường!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 HTTP server đang lắng nghe trên cổng ${PORT}`);
    console.log("🚀 Cỗ máy chốt Sale SWC Pass & ATLAS đã khởi động!");
});
