require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');

// ==========================================
// CẤU HÌNH BIẾN MÔI TRƯỜNG & KHỞI TẠO
// ==========================================
const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGODB_URI;
const claudeApiKey = process.env.CLAUDE_API_KEY;

const bot = new TelegramBot(token, {
    polling: { 
        params: { 
            allowed_updates: JSON.stringify(["message", "callback_query", "chat_member", "my_chat_member"]) 
        } 
    }
});

const claude = new Anthropic({ apiKey: claudeApiKey });

bot.on("polling_error", (msg) => console.log("⚠️ LỖI POLLING:", msg));
bot.on("error", (msg) => console.log("⚠️ LỖI CHUNG:", msg));

// ==========================================
// HẰNG SỐ CẤU HÌNH & LINK
// ==========================================
const ADMIN_ID = process.env.ADMIN_ID || '507318519';
const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';
const PRIVATE_TG_GROUP = 'https://t.me/+1M_PlogMd_M1ZjNl'; 
const PRIVATE_ZALO_GROUP = 'https://zalo.me/g/yeiaea989';
const SWC_PASS_WEB = 'https://swcpass.vn';
const SWC_FIELD_WEB = 'https://swcfield.com/vi';
const ACTIVATE_URL = 'https://launch.swc.capital/broadcast_31_vi'; 
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

const NÚT_ĐĂNG_KÝ_SỰ_KIỆN = [{ text: `🚨 ĐĂNG KÝ SỰ KIỆN ATLAS (CÒN ${getDaysLeft()} NGÀY)`, url: ACTIVATE_URL }];

// ==========================================
// KẾT NỐI MONGODB & SCHEMA
// ==========================================
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Đã kết nối MongoDB!'))
    .catch(err => console.error('❌ Lỗi MongoDB:', err));

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

    referralCount: { type: Number, default: 0 },
    broadcastOptOut: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    
    lastBotInteraction: { type: Date, default: null },
    adminPausedAiUntil: { type: Date, default: null }, 
    chatHistory: { type: Array, default: [] }
});

const User = mongoose.model('User', userSchema);

// ==========================================
// SYSTEM PROMPT & AI CLAUDE HAIKU
// ==========================================
function buildSystemPrompt(user) {
    const daysLeft = getDaysLeft();
    return `Bạn là "Tí" — trợ lý AI tư vấn đầu tư tài chính của quỹ Sky World Community Viet Nam, làm việc dưới quyền anh Hồ Văn Lợi.

TÍNH CÁCH: Chuyên nghiệp, thông tuệ, tự nhiên, dí dỏm — tuyệt đối không giống robot. Xưng "em" hoặc "Tí", gọi khách là "anh/chị" hoặc theo tên nếu biết.

NHIỆM VỤ CỐT LÕI:
- Tư vấn tài chính, đầu tư, trading theo triết lý SWC
- Chốt sale thẻ SWC Pass và giới thiệu Siêu dự án ATLAS trước deadline ${DEADLINE} (CÒN ${daysLeft} NGÀY)
- Phân loại khách và dẫn dắt vào đúng gói phù hợp

THÔNG TIN KHÁCH HÀNG HIỆN TẠI:
- Tên: ${user.firstName} ${user.lastName}
- Nhóm: ${user.tag}
- Gói hiện tại: ${user.swcPassTier}
- Funnel stage: ${user.funnelStage}

SẢN PHẨM SWC PASS (3 GÓI):
1. Essential (1 năm): $240/năm hoặc $20/tháng — dành cho người mới
2. Plus (5 năm): $600 hoặc $10/tháng — dành cho người có kinh nghiệm
3. Ultimate (Vĩnh viễn): $2,600 — chỉ 1.000 suất toàn cầu, đóng cửa ${DEADLINE}

LINK QUAN TRỌNG:
- Đăng ký sự kiện/Kích hoạt ATLAS: ${ACTIVATE_URL}
- Website SWC Pass: ${SWC_PASS_WEB}
- SWC Field: ${SWC_FIELD_WEB}

TRIẾT LÝ ĐẦU TƯ:
- 5 Tầng chuỗi thức ăn: Chính phủ → Cá voi → Đội lái → Sói già → F0 (thanh khoản)
- Tự trade = tự sát: 95% F0 thua lỗ vì cảm xúc chi phối
- SWC Pass = ủy thác hệ thống chuyên gia, chỉ 10 phút/tháng
- Road to $1M: $240/tháng × lãi kép 15 năm = $1,000,000

QUY TẮC GIAO TIẾP:
- Tin nhắn ngắn gọn, chia đoạn nhỏ, dùng emoji sinh động
- Luôn kết thúc bằng câu hỏi mở để dẫn dắt
- LIÊN TỤC nhắc deadline ${DEADLINE} — còn ${daysLeft} ngày
- Khi khách do dự: dùng FUD (nỗi đau tự trade) + FOMO (khan hiếm)
- KHÔNG giải thích dài dòng kỹ thuật. KHÔNG nhắc tới SWGT hay uTerra.`;
}

async function callClaude(user, userMessage) {
    try {
        let history = user.chatHistory || [];
        history.push({ role: 'user', content: userMessage });
        if (history.length > 20) history = history.slice(-20);

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
        if (user.funnelStage === 'interested' && history.length > 6) user.funnelStage = 'hot_lead';

        await user.save();
        return reply;
    } catch (err) {
        console.error('❌ Claude API error:', err.message);
        return `Xin lỗi anh/chị, hệ thống đang bận. Vui lòng chờ giây lát để Đội ngũ chuyên gia trực tiếp phản hồi nhé! 🙏`;
    }
}

// ==========================================
// HÀM GỬI MAIN MENU
// ==========================================
async function sendMainMenu(chatId, messageId = null) {
    const daysLeft = getDaysLeft();
    const text = `✅ <b>Hồ sơ của bạn đã được lưu trữ an toàn.</b> Chào mừng bạn gia nhập <b>Cộng Đồng Đầu Tư SWC</b>.\n\n⏳ <b>CÒN KHOẢNG ${daysLeft} NGÀY</b> — Sự kiện ra mắt siêu dự án ATLAS sẽ đóng cửa vào lúc 23:59 ngày <b>${DEADLINE}</b>!\n\nChọn nội dung bạn muốn khám phá tiếp theo:`;

    const keyboard = {
        inline_keyboard: [
            [{ text: "💎 Đặc quyền & Tính năng SWC Pass", callback_data: 'menu_swcpass' }],
            [{ text: "🏢 Khám phá Siêu dự án ATLAS", callback_data: 'menu_atlas' }],
            [{ text: "❓ Giải đáp thắc mắc (FAQ)", callback_data: 'menu_faq' }],
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
        const welcomeMsg = `Xin chào <b>${user.firstName}</b>! 🦁\n\nTôi là <b>Tí</b> — trợ lý AI của quỹ <b>Sky World Community Viet Nam</b>.\n\nĐể hỗ trợ anh/chị chính xác nhất, vui lòng <b>chia sẻ số điện thoại</b> để thiết lập hồ sơ bảo mật nhé! 👇`;
        bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'HTML', reply_markup: { keyboard: [[{ text: "📞 Chia sẻ Số điện thoại", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } }).catch(() => {});
    } else {
        sendMainMenu(chatId);
    }
});

bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    await User.updateOne({ userId }, { $set: { phone: msg.contact.phone_number } });

    bot.sendMessage(chatId, "⏳ Đang thiết lập hồ sơ...", { reply_markup: { remove_keyboard: true } }).then(sent => {
        bot.deleteMessage(chatId, sent.message_id).catch(() => {});
        sendMainMenu(chatId);
    });

    setTimeout(() => {
        const surveyMsg = `👋 Để Tí và đội ngũ hỗ trợ anh/chị chính xác nhất, cho Tí biết vị thế hiện tại của mình nhé:`;
        bot.sendMessage(chatId, surveyMsg, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🙋 Tôi là nhà đầu tư mới", callback_data: 'survey_newbie' }],
                    [{ text: "💼 Tôi đã có kinh nghiệm", callback_data: 'survey_experienced' }],
                    [{ text: "🔥 Tôi đã có thẻ SWC Pass", callback_data: 'survey_vip' }],
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
        [{ text: "💬 THAM GIA NHÓM KÍN ZALO", url: PRIVATE_ZALO_GROUP }],
        [{ text: "🔙 Quay lại Menu Chính", callback_data: 'main_menu' }],
        NÚT_ĐĂNG_KÝ_SỰ_KIỆN
    ];

    if (data === 'main_menu') return sendMainMenu(chatId, messageId);

    // --- SWC PASS MENU ---
    else if (data === 'menu_swcpass') {
        text = `💎 <b>SWC PASS — TẤM VÉ THÔNG HÀNH GIỚI TINH ANH</b>\n\nKhông phải khóa học. Không phải tín hiệu trade. Đây là <b>Hệ thống Kỷ luật</b> giúp bạn xây dựng sự giàu có bền vững.\n\n<b>3 GÓI THÀNH VIÊN:</b>\n\n1️⃣ <b>Essential</b> — 1 năm\n💰 $240/năm (hoặc $20/tháng) — Lý tưởng cho người mới bắt đầu\n\n2️⃣ <b>Plus</b> — 5 năm\n💰 $600 (chỉ $10/tháng) — Cố định giá, tối ưu dài hạn\n\n3️⃣ <b>Ultimate</b> — Vĩnh viễn 👑\n💰 $2,600 — Chỉ <b>1.000 suất toàn cầu</b>\n\n⏳ Còn <b>${daysLeft} ngày</b> để giữ vị thế tốt nhất!`;
        keyboard = [[{ text: "🗺️ Xem Lộ Trình Road to $1M", callback_data: 'road_to_1m' }], [{ text: "🌐 Website SWC Pass", url: SWC_PASS_WEB }], ...ctaButtons];
    }

    // --- HÀNH TRÌNH ĐẾN $1M FULL ---
    else if (data === 'road_to_1m' || data === 'faq_2') {
        text = `🗺️ <b>Hành trình đến $1M (Road to $1M)</b>\n\n<b>Chiến lược do SWC Field phát triển.</b> Đây là một chương trình đầu tư dài hạn: <b>chỉ cần đầu tư 8 đô la mỗi ngày (khoảng 240 đô la mỗi tháng) có kỷ luật</b>, đảm bảo đầu tư đều đặn và với <b>sức mạnh lãi kép</b>, bạn có thể hướng đến mục tiêu đạt số vốn <b>1.000.000 đô la trong 15 năm</b>. Sản phẩm là một hệ thống hoàn chỉnh cho phép bạn bắt đầu đầu tư <b>mà không cần kinh nghiệm hay các khóa đào tạo</b> — và không cần tốn nhiều thời gian (chỉ 10-15 phút mỗi tháng).\n\n<i>Cập nhật: thg 3, 2026</i>\n\n🎯 <b>Mục tiêu</b>\nDự án "Hành trình đến $1M" nhằm mục đích giúp người tham gia:\n1. <b>Xây dựng vốn tài chính dài hạn:</b> Tích lũy tài sản ròng từ 1.000.000 đô la trở lên trong 15-20 năm.\n2. <b>Đạt sự tự do tài chính:</b> Xây dựng thu nhập thụ động cao hơn chi phí.\n3. <b>Xây dựng nền tảng tài chính thế hệ sau:</b> Đảm bảo di sản vững chắc.\n\n🔥 <b>Lợi ích</b>\n1. <b>Chiến lược kiểm chứng:</b> Nhận tín hiệu hàng tháng.\n2. <b>Tiết kiệm thời gian:</b> Quản lý mục đầu tư chỉ mất 10-15 phút/tháng.\n3. <b>Bảo vệ khỏi sai lầm:</b> Phương pháp DCA và Buy & Hold chuyên nghiệp.`;
        keyboard = [[{ text: "🔙 Quay lại", callback_data: data === 'faq_2' ? 'faq_back' : 'menu_swcpass' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN];
    }

    // --- SIÊU DỰ ÁN ATLAS ---
    else if (data === 'menu_atlas') {
        text = `🏢 <b>SIÊU DỰ ÁN ATLAS — BĐS SỐ HÓA DUBAI</b>\n\nSở hữu và giao dịch <b>bất động sản Dubai</b> chỉ bằng vài cú chạm trên điện thoại.\n\n🌟 <b>Điểm nổi bật:</b>\n• <b>Thanh khoản 3 giây</b> — phá vỡ sự chậm chạp BĐS truyền thống\n• <b>Pháp nhân Atlas Overseas FZE</b> — cấp phép bởi Trung tâm Thương mại Dubai\n• <b>Đầu tư từ $50</b> — dân chủ hóa sân chơi giới siêu giàu\n• <b>RWA (Real World Assets)</b> — tài sản thật, không phải meme coin\n\n⚠️ Vòng ưu đãi <b>đóng lại ${DEADLINE}</b>. Đừng bỏ lỡ vị thế tốt nhất!`;
        keyboard = [[{ text: "🌐 Khám phá SWC Field", url: SWC_FIELD_WEB }], ...ctaButtons];
    }

    // --- FAQ NÂNG CAO ---
    else if (data === 'menu_faq' || data === 'faq_back') {
        text = `❓ <b>GIẢI ĐÁP THẮC MẮC PHỔ BIẾN</b>\nChọn câu hỏi bạn đang quan tâm:`;
        keyboard = [
            [{ text: "1. Nhận được gì ngay sau thanh toán?", callback_data: 'faq_1' }],
            [{ text: "2. Hành trình đến $1M là gì?", callback_data: 'road_to_1m' }],
            [{ text: "3. Khác gì YouTube miễn phí?", callback_data: 'faq_3' }],
            [{ text: "4. Chưa có đủ $600 lúc này?", callback_data: 'faq_4' }],
            [{ text: "5. Giữ tiền mặt có an toàn không?", callback_data: 'faq_5' }],
            [{ text: "🔙 Menu Chính", callback_data: 'main_menu' }],
            NÚT_ĐĂNG_KÝ_SỰ_KIỆN
        ];
    }
    else if (data === 'faq_1') {
        text = `✅ <b>Nhận được gì ngay sau khi thanh toán?</b>\n\nQuyền truy cập <b>đầy đủ và ngay lập tức</b> vào hệ sinh thái. Tín hiệu tháng đầu tiên sẽ trong tài khoản của bạn <b>chỉ sau vài phút</b>.\nBạn sẽ biết chính xác: mua mã nào, tỷ lệ bao nhiêu, mua ở giá nào. <b>Không cần chờ đợi!</b>`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN];
    }
    else if (data === 'faq_3') {
        text = `✅ <b>Khác gì kiến thức miễn phí YouTube?</b>\n\nKiến thức miễn phí thì đầy — nhưng nếu chỉ "biết" mà giàu thì ai cũng là triệu phú rồi. Sự khác biệt nằm ở <b>Hệ thống Kỷ luật ép bạn thực thi</b>, loại bỏ cảm xúc cá nhân.\nGiống như đọc sách dạy bơi vs <b>thực sự nhảy xuống hồ với HLV bên cạnh</b>.`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN];
    }
    else if (data === 'faq_4') {
        text = `✅ <b>Chưa có đủ $600 lúc này?</b>\n\nBài toán đơn giản: $600 ÷ 5 năm = <b>$10/tháng</b> (~250.000 VNĐ). Số tiền bạn đang ném qua cửa sổ cho cà phê mỗi tuần.\nTrì hoãn "chờ có đủ tiền" = <b>đánh mất hàng thập kỷ sức mạnh lãi kép</b>. Cái giá thực sự không phải $600 — mà là cơ hội bạn bỏ lỡ.`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN];
    }
    else if (data === 'faq_5') {
        text = `✅ <b>Giữ tiền mặt cho an toàn?</b>\n\nĐây là <b>ảo giác an toàn nguy hiểm nhất</b>. Ngân hàng trung ương in tiền mỗi ngày → lạm phát <b>lặng lẽ móc túi bạn</b>.\nGiữ tiền mặt dài hạn = <b>đảm bảo 100% bạn sẽ nghèo đi theo thời gian</b>. Giới tinh anh không bao giờ tích trữ tiền mặt dài hạn!`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN];
    }

    // --- KHẢO SÁT CHÍNH XÁC ---
    else if (data === 'survey_newbie') {
        user.tag = 'newbie'; user.funnelStage = 'interested'; await user.save();
        text = `✅ Cảm ơn anh/chị đã chia sẻ!\n\nLà người mới, <b>lạm phát đang âm thầm ăn mòn tiền mặt mỗi ngày</b>. Giải pháp duy nhất là xây dựng cỗ máy dòng tiền tự động qua gói <b>Essential ($240/năm)</b>.\n\n⏳ Còn <b>${daysLeft} ngày</b> để đăng ký với mức giá ưu đãi nhất!`;
        keyboard = ctaButtons;
    }
    else if (data === 'survey_experienced') {
        user.tag = 'experienced'; user.funnelStage = 'hot_lead'; await user.save();
        text = `✅ Tuyệt vời! Anh/chị là nhà đầu tư có tầm nhìn.\n\nVới kinh nghiệm sẵn có, <b>SWC Field & ATLAS RWA</b> chính là sân chơi tiếp theo để nhân x lần tài sản.\n\n⚠️ Vòng ưu đãi đóng cửa <b>${DEADLINE}</b>. Đừng bỏ lỡ!`;
        keyboard = ctaButtons;
    }
    else if (data === 'survey_vip') {
        user.tag = 'vip_pass'; user.swcPassTier = 'essential'; user.funnelStage = 'converted'; await user.save();
        text = `✅ <b>Chào mừng thành viên VIP!</b>\n\nAnh/chị đã có vũ khí mạnh nhất của hệ sinh thái SWC rồi 💪\nHãy chắc chắn đã tham gia Group nội bộ để <b>nhận tín hiệu cổ tức hàng tháng</b>.`;
        keyboard = [[{ text: "💬 Vào Group VIP Telegram", url: PRIVATE_TG_GROUP }], [{ text: "🔙 Menu Chính", callback_data: 'main_menu' }]];
    }
    else if (data === 'survey_atlas') {
        user.tag = 'atlas_investor'; user.funnelStage = 'hot_lead'; await user.save();
        text = `✅ <b>Tầm nhìn của anh/chị hoàn toàn đúng!</b>\n\nATLAS chính là xu hướng RWA của tương lai. Trong lúc chờ bứt phá, <b>SWC Pass là cỗ máy tạo dòng tiền ngay hôm nay</b>.\n\nGói <b>Ultimate ($2,600 — Vĩnh viễn)</b> được thiết kế đặc biệt cho những người như anh/chị.\n⏳ Chỉ còn <b>${daysLeft} ngày</b> — Không mở lại!`;
        keyboard = ctaButtons;
    }

    bot.answerCallbackQuery(callbackQuery.id).catch(() => {});
    if (text !== '') {
        bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard } }).catch(() => {});
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

    // 1. ADMIN REPLY (KHÓA AI)
    if (userId === ADMIN_ID && msg.reply_to_message) {
        const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
        const idMatch = originalText.match(/ID:\s*(\d+)/);
        if (idMatch) {
            const targetId = idMatch[1];
            bot.sendMessage(targetId, `👨‍💻 <b>Phản hồi từ Đội ngũ Chuyên gia SWC:</b>\n\n${msg.text || msg.caption}`, { parse_mode: 'HTML' }).catch(() => {});
            bot.sendMessage(ADMIN_ID, `✅ Đã gửi câu trả lời cho khách ID: <code>${targetId}</code>`, { parse_mode: 'HTML' });
            
            // Tạm dừng AI 2 tiếng để Admin chat
            await User.updateOne({ userId: targetId }, { $set: { adminPausedAiUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) } });
            return;
        }
    }

    // 2. KHÁCH NHẮN TIN (AI CLAUDE XỬ LÝ & BÁO CÁO ẢNH CHO ADMIN)
    if (userId !== ADMIN_ID) {
        let user = await User.findOne({ userId });
        if (!user) { user = new User({ userId, firstName: msg.from.first_name || '', lastName: msg.from.last_name || '', username: msg.from.username ? `@${msg.from.username}` : '' }); await user.save(); }

        // Báo cáo ngay cho Admin nếu khách gửi Ảnh/Tệp
        if (msg.photo || msg.video || msg.document) {
            await bot.forwardMessage(ADMIN_ID, chatId, msg.message_id).catch(() => {});
            bot.sendMessage(ADMIN_ID, `📩 <b>TỆP/ẢNH TỪ KHÁCH HÀNG</b>\n👤 Tên: ${user.firstName}\n🆔 ID: <code>${userId}</code>\n💬 Ghi chú: ${msg.caption || 'Không có'}\n\n👉 <i>Reply để chat trực tiếp (AI sẽ tự khóa).</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "💬 Chat trực tiếp", url: `tg://user?id=${userId}` }]] } }).catch(()=>{});
        }

        // Nếu AI đang bị Admin khóa -> Báo tin nhắn thầm lặng về cho Admin, AI im lặng
        const now = new Date();
        if (user.adminPausedAiUntil && user.adminPausedAiUntil > now) {
            bot.sendMessage(ADMIN_ID, `📩 <b>KHÁCH TRẢ LỜI (CHẾ ĐỘ ADMIN CHAT)</b>\n👤 Tên: ${user.firstName}\n🆔 ID: <code>${userId}</code>\n💬 Nội dung: ${msg.text || '[Ảnh/File]'}\n\n👉 <i>Reply để tiếp tục chat.</i>`, { parse_mode: 'HTML' }).catch(()=>{});
            return;
        }

        // Nếu AI mở khóa -> Trả lời khách
        bot.sendChatAction(chatId, 'typing').catch(() => {});
        const userText = msg.text || msg.caption || '[Khách gửi file/ảnh]';
        const aiReply = await callClaude(user, userText);
        bot.sendMessage(chatId, aiReply, { parse_mode: 'HTML' }).catch(() => {});

        // Báo cáo Hot Lead cho Admin
        if (['interested', 'hot_lead', 'converted'].includes(user.funnelStage)) {
            const alertMsg = `🔥 <b>HOT LEAD — ĐANG CHAT VỚI AI</b>\n👤 Tên: <b>${user.firstName}</b>\n🆔 ID: <code>${userId}</code>\n\n💬 <b>Khách:</b> ${userText}\n🤖 <b>AI Tí:</b> ${aiReply}\n\n👉 <i>Reply tin này để cướp quyền điều khiển từ AI.</i>`;
            bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "💬 Cướp quyền chat", url: `tg://user?id=${userId}` }]] } }).catch(() => {});
        }
    }
});

// ==========================================
// BROADCAST TỰ ĐỘNG THEO LỊCH (CRONJOBS HÀNG NGÀY)
// ==========================================
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
    const vnTime = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
    const h = vnTime.getUTCHours();
    const m = vnTime.getUTCMinutes();
    const daysLeft = getDaysLeft();

    // 08:00 — Bài sáng
    if (h === 8 && m === 0) {
        const msg = `🌅 <b>CHÀO BUỔI SÁNG — THỊ TRƯỜNG HÔM NAY NÓI GÌ?</b>\n\nTrong khi đa số nhà đầu tư F0 đang lo lắng không biết hôm nay thị trường đi đâu...\nThành viên SWC đã có kế hoạch từ đầu tháng. Không cần đoán mò.\n\n💡 <b>Sự thật:</b> 95% người tự trade thua lỗ không phải vì thiếu thông tin — mà vì <b>thiếu hệ thống kỷ luật</b>.\n\n⏳ Còn <b>${daysLeft} ngày</b> để gia nhập hệ thống tốt nhất trước khi cửa đóng.`;
        await broadcastToAll(msg, { reply_markup: { inline_keyboard: [NÚT_ĐĂNG_KÝ_SỰ_KIỆN] } });
    }

    // 12:00 — Tip kiến thức
    if (h === 12 && m === 0) {
        const tips = [
            `💡 <b>KIẾN THỨC TÀI CHÍNH HÔM NAY</b>\n\n<b>5 Tầng chuỗi thức ăn tài chính:</b>\n1. Chính phủ/NHTW\n2. Cá voi (Quỹ lớn)\n3. Đội lái\n4. Sói già\n5. F0 (Thanh khoản)\n\n⏳ SWC Pass giúp bạn <b>nhảy thẳng lên Tầng 2</b> — đứng trên vai Quỹ lớn. Còn ${daysLeft} ngày!`,
            `💡 <b>KIẾN THỨC TÀI CHÍNH HÔM NAY</b>\n\n<b>Lãi kép — Kỳ quan thứ 8</b>\n$240/tháng × 15 năm × lãi kép 20%/năm = <b>$1,000,000+</b>\nBí quyết không phải là số tiền lớn — mà là <b>bắt đầu SỚM và kỷ luật ĐỀU ĐẶN</b>. Còn ${daysLeft} ngày!`
        ];
        const tip = tips[Math.floor(Math.random() * tips.length)];
        await broadcastToAll(tip, { reply_markup: { inline_keyboard: [[{ text: `💎 Xem Gói SWC Pass`, callback_data: 'menu_swcpass' }]] } });
    }

    // 20:30 — FOMO chốt sale (hot leads)
    if (h === 20 && m === 30) {
        const msg = `🔥 <b>NHẮC NHỞ KHẨN — CÒN ${daysLeft} NGÀY!</b>\n\nLúc này có 2 loại người:\nLoại 1: Đang ngồi phân tích chart, lo lắng thị trường...\nLoại 2: Đã có SWC Pass — <b>ngủ ngon trong khi port tự chạy</b>.\n\nBạn muốn là loại nào? Gói <b>Ultimate</b> đóng cửa <b>${DEADLINE}</b>. Không ngoại lệ.`;
        await broadcastToTag('hot_lead', msg, { reply_markup: { inline_keyboard: [NÚT_ĐĂNG_KÝ_SỰ_KIỆN] } });
        await broadcastToTag('interested', msg, { reply_markup: { inline_keyboard: [NÚT_ĐĂNG_KÝ_SỰ_KIỆN] } });
    }
}, 60000);

// ==========================================
// FUNNEL DRIP TỰ ĐỘNG — CHẠY MỖI GIỜ 
// ==========================================
const funnelMessages = [
    null, 
    `📖 <b>BÀI HỌC SỐ 1: TẠI SAO 95% NHÀ ĐẦU TƯ THUA LỖ?</b>\n\nKhông phải vì thiếu thông tin. Mà vì họ chơi trò chơi mà <b>luật do người khác viết</b>.\n\n<b>F0 = Thanh khoản cho tất cả tầng trên.</b>\nMỗi lần bạn mua vào hoảng loạn hay bán ra sợ hãi — đó là lúc Cá voi đang ăn tiền của bạn.\n\n💡 Giải pháp: Đừng chơi một mình. Hãy đứng trên vai Quỹ lớn. <i>→ Đó là lý do SWC Pass tồn tại.</i>`,
    `📖 <b>BÀI HỌC SỐ 2: TIỀN NHÀN RỖI LÀ GÌ?</b>\n\n<b>TUYỆT ĐỐI không đầu tư bằng tiền "cơm áo gạo tiền".</b>\nChỉ dùng tiền nhàn rỗi — tiền mà dù mất đi hôm nay, cuộc sống của bạn không thay đổi. Nếu dùng tiền học phí, vay mượn -> Không dám cắt lỗ → Gồng lỗ → Cháy tài khoản.\n\n💡 SWC Pass bắt đầu từ <b>$8/ngày (~240k VNĐ)</b> — đúng nghĩa tiền nhàn rỗi.`,
    `📖 <b>BÀI HỌC SỐ 3: SỨC MẠNH LÃI KÉP</b>\n\nEinstein gọi đây là "Kỳ quan thứ 8 của thế giới."\n<b>$240/tháng × kỷ luật × 15 năm = $1,000,000</b>\nKhông phải may mắn. Chỉ là <b>toán học + thời gian + kỷ luật</b>.\n\n💡 <b>Thời điểm tốt nhất là 10 năm trước. Thời điểm tốt thứ 2 là HÔM NAY.</b>\n⏳ Còn {DAYS} ngày để bắt đầu!`,
    `🔥 <b>CÒN {DAYS} NGÀY — ĐÃ CÓ BAO NHIÊU NGƯỜI ĐĂNG KÝ?</b>\n\nGói Ultimate (Vĩnh viễn) — 1.000 suất toàn cầu.\nKhi 1.000 suất đầy → cửa đóng vĩnh viễn. Người đăng ký hôm nay đang <b>khóa giá vĩnh viễn</b>.\n\n<b>Câu hỏi không phải "Có nên mua không?" — mà là "Bao giờ thì quá muộn?"</b>`,
    `💬 <b>HỌ ĐÃ THAY ĐỔI NHƯ THẾ NÀO SAU KHI DÙNG SWC PASS?</b>\n\n<i>"Trước đây tôi dành 3-4 tiếng mỗi ngày xem chart, vẫn thua lỗ. Giờ 10 phút/tháng, danh mục đang tăng trưởng đều đặn."</i>\n\n💡 Đây không phải may mắn. Đây là <b>hệ thống đúng + kỷ luật đúng</b>.\n⏳ Còn {DAYS} ngày — Anh/chị sẵn sàng chưa?`,
    `⚡ <b>NGÀY MAI LÀ NGÀY CUỐI CÙNG!</b>\n\n<b>2 lựa chọn:</b>\n❌ Tiếp tục tự trade → Mất thời gian + tiền bạc\n✅ SWC Pass → 10 phút/tháng, đứng trên vai Quỹ lớn.\n\nGói Ultimate đóng cửa <b>${DEADLINE}</b>. Quyết định hôm nay định hình 15 năm tới của anh/chị.`,
    `🚨 <b>HÔM NAY LÀ NGÀY CUỐI CÙNG!</b>\n\n23:59 tối nay — cửa đóng. Không "sắp đóng". Không "sẽ mở lại". <b>ĐÓNG VĨNH VIỄN.</b>\n\nNếu anh/chị đang đọc tin này — còn kịp.\nNếu đọc vào ngày mai — sẽ không còn kịp nữa.`
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
                await bot.sendMessage(user.userId, msg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [NÚT_ĐĂNG_KÝ_SỰ_KIỆN] } });
                user.funnelDay = day; user.lastFunnelSent = now; await user.save();
            } catch (e) {}
            await new Promise(r => setTimeout(r, 100));
        }
    } catch (e) {}
}, 60 * 60 * 1000); 

// ==========================================
// BẢNG ĐIỀU KHIỂN DÀNH CHO ADMIN
// ==========================================
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id, `👨‍💻 <b>ADMIN PANEL — SWC BOT v3.0 (CÓ AI)</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "📊 Thống kê hệ thống", callback_data: 'admin_stats' }],
