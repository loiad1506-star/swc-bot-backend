require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');

// ==========================================
// BẮT LỖI TOÀN CỤC - NGĂN CHẶN BOT SẬP NGẦM
// ==========================================
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
const SWC_FIELD_WEB = 'https://swcfield.com/vi/';
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

const NÚT_ĐĂNG_KÝ_SỰ_KIỆN = [{ text: `🚨 ĐĂNG KÝ SWC PASS (CÒN ${getDaysLeft()} NGÀY)`, url: ACTIVATE_URL }];
const NÚT_MENU_CHÍNH = [{ text: "🏠 Trở về Menu Chính", callback_data: 'main_menu' }];

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
// SYSTEM PROMPT & BỘ LỌC AI CLAUDE
// ==========================================
function buildSystemPrompt(user) {
    const daysLeft = getDaysLeft();
    return `Bạn là "Tí" — trợ lý AI tư vấn đầu tư tài chính của quỹ Sky World Community Viet Nam, làm việc dưới quyền anh Hồ Văn Lợi.
TÍNH CÁCH: Sắc sảo, chuyên nghiệp, thấu hiểu tâm lý hành vi (chuẩn Sói già Phố Wall). Xưng "em" hoặc "Tí", gọi khách là "anh/chị". Tuyệt đối không giống robot.

NHIỆM VỤ:
1. Tư vấn đầu tư theo triết lý SWC. Dịch tính năng khô khan thành Giải pháp cho nỗi sợ của khách.
2. Chốt sale thẻ SWC Pass trước deadline ${DEADLINE} (CÒN ${daysLeft} NGÀY).

THÔNG TIN KHÁCH HÀNG: Tên: ${user.firstName} ${user.lastName} | Nhóm: ${user.tag} | Gói Pass hiện tại: ${user.swcPassTier}

KIẾN THỨC NỀN TẢNG (LUÔN SỬ DỤNG KHI TƯ VẤN):
- TẦNG 5 CHUỖI THỨC ĂN: Chính phủ → Cá voi → Đội lái → Sói già → F0. F0 tự trade = tự sát, là thanh khoản cho quỹ lớn.
- BỘ LỌC CHỐNG FOMO (SWC FIELD): Không phải mò mẫm dự án rác. Mọi dự án được Thẩm định và đóng gói pháp lý qua SPV (Phương tiện mục đích đặc biệt), bảo vệ tiền ở Mỹ/EU/Nga.
- KẺ HỦY DIỆT PHÍ ẨN: Quỹ khác thu phí 2% tài sản mỗi năm. SWC Pass chỉ thu phí Membership cố định. Không cắt xén lợi nhuận.
- CỖ MÁY LÃI KÉP (Road to $1M): Không làm giàu nhanh. Đầu tư $8/ngày ($240/tháng), kỷ luật 15 năm = $1,000,000. Dành 10 phút/tháng làm theo tín hiệu.

3 GÓI SWC PASS ĐỂ CHỐT SALE:
1. Essential (1 Năm - $240): Gọi là gói "Cà Phê Trải Nghiệm" ($20/tháng). Để thử nghiệm hệ thống chuyên gia thay vì tự trade mất hàng trăm triệu.
2. Plus (5 Năm - $600): Gọi là gói "Kỷ Luật Thép". [KHUYÊN KHÁCH MUA GÓI NÀY]. Chỉ $10/tháng, tiết kiệm 50%. Ép khách vào kỷ luật 5 năm để thấy sức mạnh Lãi kép.
3. Ultimate (Vĩnh Viễn - $2.600): Gọi là gói "Di Sản Gia Tộc". Mua đứt mỏ vàng cho con cái. CHÚ Ý TỬ HUYỆT FOMO: Gói này SẼ ĐÓNG CỬA VĨNH VIỄN VÀO NGÀY 31/03/2026. Chỉ 1000 suất.

QUY TẮC GIAO TIẾP:
- Tin nhắn ngắn gọn, xuống dòng hợp lý, có emoji.
- Luôn kết thúc bằng 1 câu hỏi mở để kéo dài cuộc hội thoại (Ví dụ: Anh/chị đang tự trade hay để tiền mặt chịu lạm phát?).
- LIÊN TỤC nhắc deadline ${DEADLINE} — còn ${daysLeft} ngày.
- KHÔNG nhắc tới Token, Coin, SWGT.`;
}

async function callClaude(user, userMessage) {
    try {
        let history = user.chatHistory || [];
        history.push({ role: 'user', content: userMessage });

        // LỌC LỊCH SỬ CHAT: API Claude bắt buộc Role phải luân phiên (user -> assistant -> user). Nếu trùng sẽ bị lỗi.
        let validHistory = [];
        let lastRole = '';
        for (let i = Math.max(0, history.length - 10); i < history.length; i++) {
            let msg = history[i];
            if (msg.role !== lastRole) {
                validHistory.push(msg);
                lastRole = msg.role;
            } else {
                validHistory[validHistory.length - 1].content += '\n' + msg.content; // Gộp tin nhắn nếu cùng 1 role
            }
        }
        if (validHistory.length > 0 && validHistory[0].role === 'assistant') validHistory.shift();

        const response = await claude.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 800,
            system: buildSystemPrompt(user),
            messages: validHistory
        });

        const reply = response.content[0].text;
        
        history.push({ role: 'assistant', content: reply });
        user.chatHistory = history.slice(-20); 
        user.lastBotInteraction = new Date();

        if (user.funnelStage === 'new') user.funnelStage = 'interested';
        if (user.funnelStage === 'interested' && history.length > 4) user.funnelStage = 'hot_lead';
        await user.save();
        return reply;
    } catch (err) {
        console.error('❌ Lỗi API Claude:', err);
        return `Dạ hiện tại Đội ngũ chuyên gia SWC đang bận xử lý dữ liệu định lượng. Em đã báo cáo lên hệ thống, Admin sẽ trực tiếp phản hồi lại anh/chị ngay nhé! 🙏`;
    }
}

// ==========================================
// HÀM GỬI MAIN MENU (MA TRẬN PHỄU)
// ==========================================
async function sendMainMenu(chatId, messageId = null) {
    const daysLeft = getDaysLeft();
    const text = `🦁 <b>CỔNG ĐẦU TƯ SWC CAPITAL VIỆT NAM</b>\n\nNơi trang bị cho bạn hệ thống kỷ luật và công cụ của giới tinh anh để đạt tự do tài chính.\n\n⏳ <b>SỰ KIỆN QUAN TRỌNG:</b> Gói thành viên Ultimate (Vĩnh viễn) sẽ chính thức ĐÓNG CỬA vào lúc 23:59 ngày <b>${DEADLINE}</b> (Còn ${daysLeft} ngày).\n\n👇 <b>HÃY CHỌN DANH MỤC ĐỂ KHÁM PHÁ:</b>`;

    const keyboard = {
        inline_keyboard: [
            [{ text: "🇻🇳 Cài đặt Tiếng Việt (Cho người mới)", url: "https://t.me/setlanguage/vi" }],
            [{ text: "📢 Vào Kênh Tin Tức", url: `https://t.me/${CHANNEL_USERNAME.replace('@','')}` }, { text: "💬 Vào Nhóm Giao Lưu", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }],
            [{ text: "💳 THẺ SWC PASS LÀ GÌ?", callback_data: 'menu_swcpass_main' }],
            [{ text: "🏢 DỰ ÁN SWC FIELD & ATLAS", callback_data: 'menu_swcfield_main' }],
            [{ text: "🗺️ ROAD TO $1M (HÀNH TRÌNH TRIỆU ĐÔ)", callback_data: 'menu_road1m_main' }],
            [{ text: "❓ HỎI ĐÁP (FAQ)", callback_data: 'menu_faq_main' }],
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
// /START & THU THẬP SĐT
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
        const welcomeMsg = `Xin chào <b>${user.firstName}</b>! 🦁\n\nTôi là <b>SWC Pass</b> — trợ lý của quỹ <b>SWC Capital</b>.\n\nĐể trải nghiệm hệ thống và nhận các tài liệu đầu tư bí mật, vui lòng <b>Chia sẻ số điện thoại</b> bằng nút bên dưới nhé! 👇`;
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
    }, 10000);
});

// ==========================================
// MA TRẬN CALLBACK QUERY (ĐIỀU HƯỚNG BÁCH KHOA TOÀN THƯ)
// ==========================================
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    const daysLeft = getDaysLeft();

    let text = ''; let keyboard = [];
    bot.answerCallbackQuery(callbackQuery.id).catch(() => {});

    if (data === 'main_menu') return sendMainMenu(chatId, messageId);

    // --- KHẢO SÁT CHÍNH XÁC TÂM LÝ CHỐT SALE ---
    if (data === 'survey_newbie') {
        await User.updateOne({ userId: callbackQuery.from.id.toString() }, { $set: { tag: 'newbie', funnelStage: 'interested' } });
        text = `✅ Cảm ơn anh/chị đã chia sẻ!\n\nLà người mới, <b>lạm phát đang âm thầm ăn mòn tiền mặt mỗi ngày</b>. Giải pháp duy nhất là xây dựng cỗ máy dòng tiền tự động.\n\nGói <b>Essential ($240/năm)</b> là lựa chọn hoàn hảo để bắt đầu — không cần kinh nghiệm, chỉ 10 phút/tháng để làm quen với hệ thống chuyên gia.\n\n⏳ Còn <b>${daysLeft} ngày</b> để đăng ký với mức giá ưu đãi nhất!`;
        keyboard = [ NÚT_ĐĂNG_KÝ_SỰ_KIỆN, [{ text: "💬 THAM GIA NHÓM CHAT ĐẦU TƯ", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }], NÚT_MENU_CHÍNH ];
    }
    else if (data === 'survey_experienced') {
        await User.updateOne({ userId: callbackQuery.from.id.toString() }, { $set: { tag: 'experienced', funnelStage: 'hot_lead' } });
        text = `✅ Tuyệt vời! Anh/chị là nhà đầu tư có tầm nhìn.\n\nVới kinh nghiệm sẵn có, anh chị sẽ hiểu giá trị của Cấu trúc SPV. <b>SWC Field — Private Rounds</b> chính là sân chơi tiếp theo để nhân x lần tài sản thay vì tự trade rủi ro.\n\nGói <b>Plus ($600 / 5 năm)</b> sẽ mở khóa toàn bộ đặc quyền này cho anh/chị (Tiết kiệm 50% chi phí).\n\n⚠️ Vòng ưu đãi <b>đóng cửa ${DEADLINE}</b>. Đừng bỏ lỡ!`;
        keyboard = [ NÚT_ĐĂNG_KÝ_SỰ_KIỆN, [{ text: "💬 THAM GIA NHÓM CHAT ĐẦU TƯ", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }], NÚT_MENU_CHÍNH ];
    }
    else if (data === 'survey_vip') {
        await User.updateOne({ userId: callbackQuery.from.id.toString() }, { $set: { tag: 'vip_pass', swcPassTier: 'essential', funnelStage: 'converted' } });
        text = `✅ <b>Chào mừng thành viên VIP!</b>\n\nAnh/chị đã có vũ khí mạnh nhất của hệ sinh thái SWC rồi 💪\nHãy chắc chắn đã tham gia Group nội bộ để <b>nhận tín hiệu chiến lược hàng tháng</b> và cập nhật dự án SWC Field.`;
        keyboard = [[{ text: "💬 Vào Group VIP Telegram", url: PRIVATE_TG_GROUP }], NÚT_MENU_CHÍNH];
    }
    else if (data === 'survey_atlas') {
        await User.updateOne({ userId: callbackQuery.from.id.toString() }, { $set: { tag: 'atlas_investor', funnelStage: 'hot_lead' } });
        text = `✅ <b>Tầm nhìn của anh/chị hoàn toàn đúng!</b>\n\nATLAS chính là xu hướng RWA của tương lai. Giao dịch BĐS Dubai chỉ với 1 chạm.\n\nGói <b>Ultimate ($2,600 — Vĩnh viễn)</b> được thiết kế đặc biệt cho những tay chơi lớn như anh/chị. Mua đứt đặc quyền trọn đời.\n\n⏳ Chỉ còn <b>${daysLeft} ngày</b> — 1.000 suất, đóng cửa vĩnh viễn ${DEADLINE}!`;
        keyboard = [ NÚT_ĐĂNG_KÝ_SỰ_KIỆN, [{ text: "💬 THAM GIA NHÓM CHAT ĐẦU TƯ", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }], NÚT_MENU_CHÍNH ];
    }

    // --- NHÁNH 1: SWC PASS ---
    else if (data === 'menu_swcpass_main') {
        text = `💎 <b>SWC PASS LÀ GÌ?</b>\n\nĐầu tư là sân chơi của giới tinh anh. SWC Pass mở ra cánh cửa cơ hội trước đây chỉ dành cho các nhà đầu tư tổ chức (Vốn >$500.000).\n\n✔️ <b>Đầu tư qua SPV:</b> Nhận cổ phần thực, được pháp luật công nhận.\n✔️ <b>Kẻ hủy diệt phí ẩn:</b> Trả phí Membership cố định, không bị ngân hàng hay quỹ lớn cắt xén % lợi nhuận.\n✔️ <b>Cộng đồng tinh hoa:</b> Câu lạc bộ đào tạo, hỗ trợ trực tiếp và nhận chiến lược Road to $1M.\n\n👇 <b>Khám phá chi tiết:</b>`;
        keyboard = [
            [{ text: "⚖️ So Sánh 3 Gói SWC Pass (Nên Chọn Gói Nào?)", callback_data: 'swcpass_compare' }],
            [{ text: "🎁 Phân tích 4 Đặc Quyền Chi Tiết", callback_data: 'swcpass_benefits' }],
            [{ text: "🌐 Website SWC Pass", url: SWC_PASS_WEB }],
            NÚT_MENU_CHÍNH
        ];
    }
    else if (data === 'swcpass_compare') {
        text = `⚖️ <b>BẢNG GIÁ SWC PASS - LỰA CHỌN CỦA "CÁO GIÀ"</b>\n\n1️⃣ <b>Gói Essential (1 Năm - $240)</b>: <i>"Cà Phê Trải Nghiệm"</i>\nBạn sợ rủi ro? Gói này chia ra chỉ $20/tháng – bằng một chầu cà phê. Đây là mức 'học phí' rẻ nhất để thuê đội ngũ phân tích thị trường Mỹ, tránh việc tự trade mất hàng trăm triệu. Em hiểu anh chị cần sự an toàn. Gói này thiết kế đúng cho anh chị. 240 đô la một năm, chia ra chỉ 20 đô mỗi tháng – bằng đúng tiền một chầu cà phê cuối tuần. Nhưng thay vì uống cà phê xong là hết, 20 đô này thuê được một đội ngũ chuyên gia phân tích thị trường Mỹ cho anh chị mỗi tháng. Đây là mức 'học phí' rẻ nhất thế giới để tránh việc tự mua sai cổ phiếu rác mất hàng trăm triệu.\n\n2️⃣ <b>Gói Plus (5 Năm - $600)</b>: <i>"Kỷ Luật Thép"</i> <b>[🔥 KHUYÊN DÙNG]</b>\nĐầu tư mà nhìn ngắn 1 năm thì không bao giờ thấy Lãi Kép. Với gói 5 năm, giá cưa đôi chỉ còn <b>$10/tháng</b>. Bằng một bát phở mỗi tuần, bạn mua quyền truy cập danh mục giới siêu giàu và bị 'ép' vào kỷ luật thép 5 năm.Đầu tư tài chính mà nhìn ngắn 1 năm thì không bao giờ thấy được sức mạnh của Lãi Kép. Einstein gọi Lãi kép là kỳ quan thứ 8, nhưng nó cần thời gian. Đó là lý do SWC ra mắt gói 5 năm. Khi anh chị mua gói này, giá cưa đôi chỉ còn $10/tháng (tiết kiệm 50%). Quan trọng hơn, cầm tấm vé 5 năm trong tay sẽ 'ép' anh chị vào một kỷ luật thép, không được bỏ cuộc giữa chừng. Mọi công cụ AI, phân tích mới ra mắt trong 5 năm tới, anh chị đều được dùng miễn phí mà không lo nền tảng tăng giá.\n\n3️⃣ <b>Gói Ultimate (Vĩnh Viễn - $2.600)</b>: <i>"Di Sản Gia Tộc"</i>\nDành cho người có tầm nhìn xa. Bạn mua ĐỨT một hệ thống tài chính để sau này chuyển giao cho con cái. Anh chị nhìn thẳng vào vấn đề giúp em: 2.600 đô nghe có vẻ lớn, nhưng nếu anh chị đầu tư 20 năm, mỗi năm chỉ có 130 đô. Anh chị mua ĐỨT một hệ thống tài chính không chỉ cho anh chị, mà sau này chuyển giao tài khoản cho con cái dùng tiếp.\n\n⚠️ <b>CÚ CHỐT HẠ:</b> Gói Ultimate SẼ ĐÓNG CỬA VĨNH VIỄN vào <b>${DEADLINE}</b> (Còn ${daysLeft} ngày). Bỏ lỡ cơ hội này, mang $10.000 đến cũng không thể mua đứt được nữa!`;
        keyboard = [ NÚT_ĐĂNG_KÝ_SỰ_KIỆN, [{ text: "🔙 Quay lại", callback_data: 'menu_swcpass_main' }, { text: "🏠 Menu Chính", callback_data: 'main_menu' }] ];
    }
    else if (data === 'swcpass_benefits') {
        text = `🎁 <b>4 LỚP ĐẶC QUYỀN TỐI THƯỢNG CỦA SWC PASS</b>\n\n<b>1. Tạo dòng tiền (Road to $1M):</b> Tín hiệu hàng tháng (Mua mã nào, tỷ lệ bao nhiêu). Không cần phân tích chart, chỉ tốn 10 phút thao tác. Tiền vốn nằm 100% trong tài khoản chứng khoán cá nhân của bạn.\n\n<b>2. Sân chơi Cá Mập (SWC Field):</b> Đầu tư vòng Private vào dự án công nghệ, BĐS trước khi lên sàn. Đầu vào chỉ từ $50.\n\n<b>3. Cộng Đồng & Số Hóa:</b> Zoom kín, Hỏi-Đáp trực tiếp chuyên gia. Biểu đồ theo dõi tiến độ "Road to $1M" trực quan.\n\n<b>4. Đặc quyền Đối Tác:</b> Nhận hoa hồng thụ động định kỳ khi mạng lưới tuyến dưới gia hạn Membership hàng năm.`;
        keyboard = [ [{ text: "⚖️ Xem So Sánh Các Gói", callback_data: 'swcpass_compare' }], [{ text: "🔙 Quay lại", callback_data: 'menu_swcpass_main' }] ];
    }

    // --- NHÁNH 2: ROAD TO $1M ---
    else if (data === 'menu_road1m_main') {
        text = `🗺️ <b>HÀNH TRÌNH ĐẾN $1 TRIỆU ĐÔ</b>\n\nChiến lược do SWC Field phát triển. Đây là một chương trình đầu tư dài hạn: <b>chỉ cần đầu tư $8/ngày (khoảng $240/tháng) có kỷ luật</b>, đều đặn cùng với sức mạnh <b>Lãi Kép</b>, bạn hướng đến mục tiêu <b>$1,000,000 trong 15 năm</b>.\n\nHệ thống giúp bạn bắt đầu mà không cần kinh nghiệm — chỉ tốn 10-15 phút/tháng làm theo tín hiệu.`;
        keyboard = [
            [{ text: "🎯 Mục tiêu & Lợi ích thực chiến", callback_data: 'road1m_benefits' }],
            [{ text: "🦈 Tại sao 95% F0 thất bại? (5 Tầng chuỗi thức ăn)", callback_data: 'road1m_foodchain' }],
            NÚT_ĐĂNG_KÝ_SỰ_KIỆN, NÚT_MENU_CHÍNH
        ];
    }
    else if (data === 'road1m_benefits') {
        text = `🔥 <b>MỤC TIÊU & LỢI ÍCH THỰC CHIẾN</b>\n\n<b>1. MỤC TIÊU THỰC CHIẾN: KHÔNG PHẢI LÀ TIỀN, MÀ LÀ VỊ THẾ:</b> Thoát khỏi áp lực "sống dựa đồng lương", tạo thu nhập thụ động và di sản.Định hình lại thói quen dòng tiền (Kỷ luật thép): Thay vì ném tiền vào những tiêu sản (cà phê sang chảnh, quần áo hàng hiệu), hệ thống này ép nhà đầu tư kỷ luật trích ra đúng 8$/ngày (khoảng 240$/tháng). Mục tiêu đầu tiên là biến việc tiết kiệm và đầu tư trở thành một thói quen vô thức như việc đánh răng mỗi sáng.

Xây dựng móng nhà "Tự do tài chính": Mục tiêu thực chiến không phải là nhìn con số trong tài khoản to lên để khoe khoang. Mục tiêu là dùng danh mục cổ phiếu này tạo ra Dòng tiền Cổ tức. Khi số tiền cổ tức thụ động hàng năm vượt qua tổng chi phí sinh hoạt của gia đình, đó là lúc họ chính thức "nghỉ hưu" và tự do, bất kể họ bao nhiêu tuổi.

Thiết lập Di sản cho thế hệ sau: Người nghèo để lại cho con cái sự nợ nần. Người trung lưu để lại một căn nhà. Người giàu thực sự để lại một Hệ thống tạo ra tiền. Tài khoản chứng khoán và công thức mua bán này chính là tài sản thừa kế vô giá, giúp con cái họ có một bệ phóng thay vì phải chật vật làm lại từ đầu.\n\n<b>2. LỢI ÍCH THỰC CHIẾN: NHỮNG THỨ CHẠM ĐƯỢC BẰNG TAY:</b> Nhận tín hiệu hàng tháng. Tiết kiệm 10.000 giờ tự học, mò mẫm biểu đồ.Triệt tiêu 100% cảm xúc hoảng loạn: Sát thủ lớn nhất trên thị trường không phải là "Cá mập", mà là sự sợ hãi của chính nhà đầu tư. Khi thị trường sập 30%, người thường sẽ cắt lỗ. Với Road to $1M, chiến lược Trung bình giá (DCA) sẽ gửi tín hiệu: "Cơ hội vàng, mua mạnh mã này cho tôi". Khách hàng hành động như một cỗ máy vô cảm, và đó là cách người chiến thắng gom tài sản giá rẻ.

Tiết kiệm 10.000 giờ học việc bằng máu: Khách hàng không cần phải đi học đọc báo cáo tài chính, không cần phân tích nến Nhật, không cần biết đường MA hay MACD là gì. Đội ngũ chuyên gia SWC đã làm việc đó. Khách hàng chỉ tốn đúng 10 đến 15 phút mỗi tháng để mở app chứng khoán và copy lệnh (Mua mã gì, tỷ lệ bao nhiêu). Thời gian còn lại, họ đi làm công việc chuyên môn và chơi với con cái.

Minh bạch tuyệt đối, tự nắm đằng chuôi: Đây là đòn bẩy mạnh nhất để chốt sale. SWC Pass không giữ một đồng tiền vốn nào của khách. Tiền nằm trong tài khoản chứng khoán do khách hàng đứng tên, thẻ ngân hàng của khách hàng. Nền tảng chỉ cung cấp "bản đồ kho báu", còn khách hàng là người tự tay cầm xẻng đi đào. Cần tiền đột xuất? Họ tự bấm nút bán và rút tiền về trong một nốt nhạc.

Đa dạng hóa địa chính trị (Thoát khỏi ao làng): Nếu chỉ mua bất động sản hoặc chứng khoán trong nước, tài sản của bạn bị trói chặt vào nền kinh tế nội địa. Road to $1M hướng dẫn khách hàng rải vốn sang các thị trường quốc tế vững chãi (như chứng khoán Mỹ có lịch sử hàng trăm năm). Một thị trường hắt hơi sổ mũi, thị trường khác sẽ gánh vác, đảm bảo con tàu tài sản luôn tiến về phía trước.\n\n<b>3. Bảo vệ khỏi cảm tính:</b> Phương pháp DCA (Trung bình giá) giúp bạn vượt qua nỗi sợ hãi khi thị trường sập và tránh FOMO đu đỉnh. Tự động hóa việc đầu tư!`;
        keyboard = [[{ text: "🔙 Quay lại Lộ trình", callback_data: 'menu_road1m_main' }]];
    }
    else if (data === 'road1m_foodchain') {
        text = `🦈 <b>5 TẦNG CHUỖI THỨC ĂN TÀI CHÍNH</b>\n\nBạn không nghèo đi vì thiếu thông tin, bạn nghèo vì đang chơi bằng luật của người khác.\n\n1. <b>Chính phủ:</b> Điều tiết cung tiền.\n2. <b>Cá voi (Quỹ lớn):</b> Gom đáy bán đỉnh.\n3. <b>Đội lái (Market Maker):</b> Vẽ biểu đồ, rũ bỏ tâm lý.\n4. <b>Sói già:</b> Trader kỷ luật.\n5. <b>F0 (Nhỏ lẻ):</b> Làm thanh khoản cho 4 tầng trên.\n\n💥 <b>F0 Tự trade = Tự sát.</b> SWC Pass giúp bạn nhảy thẳng lên Tầng 2, ủy thác hệ thống để đứng trên vai Quỹ lớn!`;
        keyboard = [ NÚT_ĐĂNG_KÝ_SỰ_KIỆN, [{ text: "🔙 Quay lại", callback_data: 'menu_road1m_main' }] ];
    }

    // --- NHÁNH 3: SWC FIELD & ATLAS ---
    else if (data === 'menu_swcfield_main') {
        text = `🏢 <b>SWC FIELD LÀ GÌ?</b>\n\nNền tảng "Showcase" dự án đầu tư thế hệ mới. Khách hàng rải vốn vào các dự án đã qua Thẩm định nghiêm ngặt.\n\nLợi thế:\n- Đầu tư mâm Cá Mập từ $50 thay vì $500.000.\n- Truy cập toàn cầu: 1 tài khoản, 4 khu vực pháp lý.\n- Minh bạch tuyệt đối qua cấu trúc <b>Pháp lý SPV</b>.\n\n👇 <b>Hãy khám phá:</b>`;
        keyboard = [
            [{ text: "⚖️ Bộ lọc SPV (Tại sao tiền của bạn an toàn?)", callback_data: 'swcfield_spv' }],
            [{ text: "🏢 Dự Án Trọng Điểm: ATLAS RWA Dubai", callback_data: 'swcfield_atlas' }],
            [{ text: "🌐 Website SWC Field", url: SWC_FIELD_WEB }],
            NÚT_MENU_CHÍNH
        ];
    }
    else if (data === 'swcfield_spv') {
        text = `⚖️ <b>BỘ LỌC CHỐNG FOMO & CẤU TRÚC PHÁP LÝ SPV</b>\n\n<i>"Tôi sợ bị lừa, sợ mất tiền vào dự án rác?"</i>\n\nChúng tôi làm phần việc nhàm chán nhất để bảo vệ bạn. \nThay vì bạn mua một "cổ phần trừu tượng", mỗi dự án trên SWC Field đều được đóng gói thành một <b>SPV (Phương tiện mục đích đặc biệt)</b>.\n\nBạn mua cổ phiếu của pháp nhân SPV đó, mang lại quyền sở hữu hợp pháp. Giao dịch được quản lý nghiêm ngặt tại Mỹ, EU, Nga. Tiền của bạn được bảo vệ như giới siêu giàu!`;
        keyboard = [[{ text: "🔙 Quay lại", callback_data: 'menu_swcfield_main' }]];
    }
    else if (data === 'swcfield_atlas') {
        text = `🏢 <b>SIÊU DỰ ÁN ATLAS — BĐS SỐ HÓA DUBAI (RWA)</b>\n\nSở hữu và giao dịch <b>Bất động sản Dubai</b> chỉ bằng vài cú chạm trên điện thoại.\n\n🌟 <b>Điểm nổi bật:</b>\n• <b>Thanh khoản 3 giây</b> — phá vỡ sự chậm chạp BĐS truyền thống.\n• <b>Pháp nhân Atlas Overseas FZE</b> — cấp phép bởi Dubai.\n• <b>Đầu tư từ $50</b> — Dân chủ hóa sân chơi giới siêu giàu.\n• <b>RWA (Real World Assets)</b> — Tài sản thật, dòng tiền thật.\n\n⚠️ <b>LƯU Ý KHẨN:</b> Vòng ưu đãi đóng cửa vào <b>${DEADLINE}</b>.`;
        keyboard = [ NÚT_ĐĂNG_KÝ_SỰ_KIỆN, [{ text: "🔙 Quay lại", callback_data: 'menu_swcfield_main' }] ];
    }

    // --- NHÁNH 4: FAQ ---
    else if (data === 'menu_faq_main' || data === 'faq_back') {
        text = `❓ <b>GIẢI ĐÁP THẮC MẮC (XÓA BỎ RÀO CẢN)</b>\n\nChúng tôi thấu hiểu nỗi lo của NĐT F0. Hãy chọn vấn đề bạn đang vướng mắc:`;
        keyboard = [
            [{ text: "1. Mua Pass xong tôi nhận được gì?", callback_data: 'faq_1' }],
            [{ text: "2. Khác gì tự học Youtube miễn phí?", callback_data: 'faq_3' }],
            [{ text: "3. Tôi không có đủ $600 lúc này?", callback_data: 'faq_4' }],
            [{ text: "4. Thà để tiền ở ngân hàng cho an toàn?", callback_data: 'faq_5' }],
            [{ text: "5. SWC có thu phí ẩn cắt cổ không?", callback_data: 'faq_6' }],
            NÚT_MENU_CHÍNH
        ];
    }
    else if (data === 'faq_1') {
        text = `✅ <b>Nhận được gì ngay sau khi thanh toán?</b>\n\nQuyền truy cập <b>đầy đủ và ngay lập tức</b> vào hệ sinh thái. Tín hiệu chiến lược tháng đầu tiên sẽ hiển thị <b>chỉ sau vài phút</b>.\nBạn sẽ biết chính xác: Mua mã cổ phiếu nào, tỷ lệ bao nhiêu, mua ở giá nào. Không cần chờ đợi, không cần học vẽ biểu đồ!`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]];
    }
    else if (data === 'faq_3') {
        text = `✅ <b>Khác gì tự học miễn phí trên YouTube?</b>\n\nKiến thức miễn phí thì đầy rẫy — nhưng nếu chỉ "biết" mà giàu thì ai cũng là triệu phú rồi. \nSự khác biệt của SWC Pass nằm ở <b>Hệ thống Kỷ luật ép bạn thực thi</b>, loại bỏ hoàn toàn cảm xúc sợ hãi & FOMO.\nGiống như đọc sách dạy bơi so với việc <b>thực sự nhảy xuống hồ với Huấn luyện viên bơi lội kế bên</b>.`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]];
    }
    else if (data === 'faq_4') {
        text = `✅ <b>Chưa có đủ $600 lúc này để mua Gói 5 năm?</b>\n\nBài toán đơn giản: $600 ÷ 5 năm = <b>$10/tháng</b> (~250.000 VNĐ). Chỉ bằng 1 bát phở mỗi tuần.\nTrì hoãn "chờ có đủ tiền" = <b>đánh mất hàng thập kỷ sức mạnh Lãi kép</b>. Cái giá thực sự không phải $600 — mà là chi phí cơ hội bạn đã vĩnh viễn bỏ lỡ!`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]];
    }
    else if (data === 'faq_5') {
        text = `✅ <b>Giữ tiền mặt trong ngân hàng cho an toàn?</b>\n\nĐây là <b>ảo giác an toàn nguy hiểm nhất</b>. Ngân hàng trung ương in tiền mỗi ngày → lạm phát <b>lặng lẽ móc túi bạn</b>.\nGiữ tiền mặt dài hạn = <b>đảm bảo 100% bạn sẽ nghèo đi theo thời gian</b>. Giới tinh anh không bao giờ tích trữ tiền mặt, họ chuyển hóa nó thành Tài sản sinh lời.`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]];
    }
    else if (data === 'faq_6') {
        text = `✅ <b>KẺ HỦY DIỆT PHÍ ẨN</b>\n\nNếu đưa tiền cho các quỹ truyền thống, họ sẽ cắt xén 1.5% - 2% trên TỔNG tài sản của bạn mỗi năm (cướp đi hàng tỷ đồng sau 20 năm).\n\nỞ SWC, chúng tôi chơi công bằng: <b>Mô hình Thẻ Thành Viên (Membership)</b>. Trả đúng $10/tháng (gói 5 năm). Dù tài sản tăng 1 triệu đô, phí vẫn chỉ là $10. Chúng tôi không phạt bạn vì bạn giàu lên!`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]];
    }

    if (text !== '') {
        bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard } }).catch(() => {
            bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard } });
        });
    }
});

// ==========================================
// TƯƠNG TÁC TIN NHẮN (GỌI AI & CHUYỂN ADMIN)
// ==========================================
bot.on('message', async (msg) => {
    if (!msg.from || msg.from.is_bot || msg.chat.type !== 'private') return;
    if (msg.contact || (msg.text && msg.text.startsWith('/'))) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // 1. ADMIN REPLY LẠI KHÁCH
    if (userId === ADMIN_ID && msg.reply_to_message) {
        const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
        const idMatch = originalText.match(/ID:\s*(\d+)/);
        if (idMatch) {
            const targetId = idMatch[1];
            bot.sendMessage(targetId, `👨‍💻 <b>Phản hồi từ Đội ngũ Chuyên gia SWC:</b>\n\n${msg.text || msg.caption}`, { parse_mode: 'HTML' }).catch(() => {});
            bot.sendMessage(ADMIN_ID, `✅ Đã trả lời khách ID: <code>${targetId}</code>`, { parse_mode: 'HTML' });
            
            // Khóa AI 2 tiếng để Admin làm việc trực tiếp
            await User.updateOne({ userId: targetId }, { $set: { adminPausedAiUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) } });
            return;
        }
    }

    // 2. KHÁCH NHẮN TIN - GỌI AI CLAUDE HOẶC CHUYỂN CHO ADMIN
    if (userId !== ADMIN_ID) {
        let user = await User.findOne({ userId });
        if (!user) { user = new User({ userId, firstName: msg.from.first_name || '', lastName: msg.from.last_name || '', username: msg.from.username ? `@${msg.from.username}` : '' }); await user.save(); }

        // Khách gửi File/Ảnh -> Báo ngay cho Admin
        if (msg.photo || msg.video || msg.document) {
            await bot.forwardMessage(ADMIN_ID, chatId, msg.message_id).catch(() => {});
            bot.sendMessage(ADMIN_ID, `📩 <b>TỆP TỪ KHÁCH HÀNG</b>\n👤 Khách: ${user.firstName}\n🆔 ID: <code>${userId}</code>\n💬 Ghi chú: ${msg.caption || 'Không có'}\n\n👉 <i>Reply tin này để chat trực tiếp (AI sẽ tự khóa).</i>`, { parse_mode: 'HTML' }).catch(()=>{});
        }

        // Nếu Admin đang chat -> AI im lặng
        const now = new Date();
        if (user.adminPausedAiUntil && user.adminPausedAiUntil > now) {
            bot.sendMessage(ADMIN_ID, `📩 <b>KHÁCH TRẢ LỜI (CHẾ ĐỘ ADMIN)</b>\n👤 Tên: ${user.firstName}\n🆔 ID: <code>${userId}</code>\n💬 Nội dung: ${msg.text || '[Tệp]'}\n\n👉 <i>Reply để tiếp tục.</i>`, { parse_mode: 'HTML' }).catch(()=>{});
            return;
        }

        // AI Xử lý tin nhắn
        bot.sendChatAction(chatId, 'typing').catch(() => {});
        const userText = msg.text || msg.caption || '[Khách gửi tệp]';
        const aiReply = await callClaude(user, userText);
        bot.sendMessage(chatId, aiReply, { parse_mode: 'HTML' }).catch(() => {});

        // Đẩy báo cáo nếu khách vào phễu Sâu (Hot Lead)
        if (['interested', 'hot_lead', 'converted'].includes(user.funnelStage)) {
            const alertMsg = `🔥 <b>HOT LEAD ĐANG CHAT VỚI AI</b>\n👤 Tên: <b>${user.firstName}</b>\n🆔 ID: <code>${userId}</code>\n\n💬 <b>Khách:</b> ${userText}\n🤖 <b>Tí:</b> ${aiReply}\n\n👉 <i>Reply tin này để cướp quyền chat.</i>`;
            bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML' }).catch(() => {});
        }
    }
});

// ==========================================
// BROADCAST THEO LỊCH CỐ ĐỊNH (CRONJOBS)
// ==========================================
function getVNTime() {
    return new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
}

async function broadcastToAll(message, options = {}) {
    const users = await User.find({ broadcastOptOut: false });
    for (const user of users) {
        try { await bot.sendMessage(user.userId, message, { parse_mode: 'HTML', ...options }); } catch (e) {}
        await new Promise(r => setTimeout(r, 50));
    }
}
async function broadcastToTag(tag, message, options = {}) {
    const users = await User.find({ tag, broadcastOptOut: false });
    for (const user of users) {
        try { await bot.sendMessage(user.userId, message, { parse_mode: 'HTML', ...options }); } catch (e) {}
        await new Promise(r => setTimeout(r, 50));
    }
}

setInterval(async () => {
    const vnTime = getVNTime();
    const h = vnTime.getUTCHours();
    const m = vnTime.getUTCMinutes();
    const daysLeft = getDaysLeft();

    if (h === 8 && m === 0) {
        const msg = `🌅 <b>CHÀO BUỔI SÁNG — THỊ TRƯỜNG HÔM NAY NÓI GÌ?</b>\n\nĐa số NĐT F0 đang lo lắng không biết hôm nay thị trường đi đâu...\nThành viên SWC đã có kế hoạch từ đầu tháng. Không cần đoán mò.\n\n💡 <b>Sự thật:</b> 95% người tự trade thua lỗ không phải vì thiếu thông tin — mà vì <b>thiếu hệ thống kỷ luật</b>.\n\n⏳ Còn <b>${daysLeft} ngày</b> để gia nhập hệ thống trước khi cửa đóng.`;
        await broadcastToAll(msg, { reply_markup: { inline_keyboard: [NÚT_ĐĂNG_KÝ_SỰ_KIỆN] } });
    }

    if (h === 12 && m === 0) {
        const tips = [
            `💡 <b>KIẾN THỨC:</b>\n\n<b>5 Tầng chuỗi thức ăn tài chính:</b>\n1. Chính phủ\n2. Cá voi (Quỹ lớn)\n3. Đội lái\n4. Sói già\n5. F0 (Thanh khoản)\n\n⏳ SWC Pass giúp bạn <b>nhảy thẳng lên Tầng 2</b>. Còn ${daysLeft} ngày!`,
            `💡 <b>KIẾN THỨC:</b>\n\n<b>Lãi kép — Kỳ quan thứ 8</b>\n$240/tháng × 15 năm × lãi kép 20%/năm = <b>$1,000,000+</b>\nBí quyết là <b>bắt đầu SỚM và kỷ luật ĐỀU ĐẶN</b>. Còn ${daysLeft} ngày!`
        ];
        await broadcastToAll(tips[Math.floor(Math.random() * tips.length)], { reply_markup: { inline_keyboard: [[{ text: `💎 Tìm Hiểu SWC Pass`, callback_data: 'menu_swcpass_main' }]] } });
    }

    if (h === 19 && m === 30) {
        const msg = `📚 <b>THỜI GIAN CẬP NHẬT KIẾN THỨC!</b>\n\nVào Group cộng đồng ngay để:\n✅ Cập nhật dự án ATLAS Dubai\n✅ Thảo luận chiến lược đầu tư\n✅ Kết nối 1.000+ nhà đầu tư\n\n⏳ Còn <b>${daysLeft} ngày</b> giữ vị thế tốt nhất!`;
        await broadcastToAll(msg, { reply_markup: { inline_keyboard: [ [{ text: "💬 Vào Group Ngay", url: `https://t.me/${GROUP_USERNAME.replace('@', '')}` }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN ] } });
    }

    if (h === 20 && m === 30) {
        const msg = `🔥 <b>NHẮC NHỞ KHẨN — CÒN ${daysLeft} NGÀY!</b>\n\nLúc này có 2 loại người:\nLoại 1: Đang lo lắng thị trường...\nLoại 2: Đã có SWC Pass — <b>đang ngủ ngon trong khi hệ thống tự chạy</b>.\n\nGói <b>Ultimate</b> — 1.000 suất — <b>đóng cửa ${DEADLINE}</b>. Không ngoại lệ.`;
        await broadcastToTag('hot_lead', msg, { reply_markup: { inline_keyboard: [NÚT_ĐĂNG_KÝ_SỰ_KIỆN] } });
        await broadcastToTag('interested', msg, { reply_markup: { inline_keyboard: [NÚT_ĐĂNG_KÝ_SỰ_KIỆN] } });
    }
}, 60000);

// ==========================================
// FUNNEL DRIP TỰ ĐỘNG — CHUỖI 7 BÀI HỌC
// ==========================================
const funnelMessages = [
    null, 
    `📖 <b>BÀI HỌC 1: TẠI SAO 95% NHÀ ĐẦU TƯ THUA LỖ?</b>\n\nMà vì họ đang chơi trò chơi mà <b>luật do người khác viết</b>.\n<b>F0 = Thanh khoản cho tất cả tầng trên.</b>\nMỗi lần bạn hoảng loạn hay fomo — đó là lúc Cá voi ăn tiền của bạn.\n\n💡 Giải pháp: Đừng chơi một mình. Hãy đứng trên vai Quỹ lớn qua cấu trúc SPV.`,
    `📖 <b>BÀI HỌC 2: TIỀN NHÀN RỖI LÀ GÌ?</b>\n\n<b>TUYỆT ĐỐI không đầu tư bằng tiền "cơm áo gạo tiền".</b>\nChỉ dùng tiền nhàn rỗi. Dùng tiền vay mượn -> Không dám cắt lỗ → Gồng lỗ → Cháy tài khoản.\n\n💡 SWC Pass gói Plus chỉ <b>$10/tháng (~250k VNĐ)</b> — đúng nghĩa tiền ly cà phê.`,
    `📖 <b>BÀI HỌC 3: SỨC MẠNH LÃI KÉP</b>\n\nEinstein gọi đây là "Kỳ quan thứ 8".\n<b>$240/tháng × kỷ luật × 15 năm = $1,000,000</b>\nKhông phải may mắn. Chỉ là <b>toán học + thời gian + kỷ luật</b>.\n⏳ Còn {DAYS} ngày để bắt đầu!`,
    `🔥 <b>CÒN {DAYS} NGÀY — ĐÃ CÓ BAO NHIÊU NGƯỜI ĐĂNG KÝ?</b>\n\nGói Ultimate (Vĩnh viễn) — 1.000 suất toàn cầu.\nKhi 1.000 suất đầy → cửa đóng vĩnh viễn. \n<b>Câu hỏi không phải "Có nên mua không?" — mà là "Bao giờ thì quá muộn?"</b>`,
    `💬 <b>HỌ ĐÃ THAY ĐỔI THẾ NÀO SAU KHI DÙNG PASS?</b>\n\n<i>"Trước đây tôi dành 3-4 tiếng mỗi ngày xem chart, vẫn thua lỗ. Giờ 10 phút/tháng, danh mục đang tăng trưởng đều đặn."</i>\n💡 Đây là <b>hệ thống đúng + kỷ luật đúng</b>.\n⏳ Còn {DAYS} ngày!`,
    `⚡ <b>NGÀY MAI LÀ NGÀY CUỐI CÙNG!</b>\n\n<b>2 lựa chọn:</b>\n❌ Tiếp tục tự trade → Mất tiền bạc & tâm lý\n✅ Mua SWC Pass → 10 phút/tháng, ủy thác Quỹ lớn.\n\nGói Ultimate đóng cửa <b>${DEADLINE}</b>. Quyết định hôm nay định hình 15 năm tới của bạn.`,
    `🚨 <b>HÔM NAY LÀ NGÀY CUỐI CÙNG!</b>\n\n23:59 tối nay — cửa đóng. <b>ĐÓNG VĨNH VIỄN.</b>\nNếu anh/chị đang đọc tin này — còn kịp.\n\n👉 <b>KÍCH HOẠT NGAY:</b>\n${ACTIVATE_URL}`
];

setInterval(async () => {
    try {
        const now = new Date();
        const daysLeft = getDaysLeft();
        const funnelUsers = await User.find({ funnelStage: { $in: ['interested', 'hot_lead'] }, broadcastOptOut: false, lastFunnelSent: { $lt: new Date(now.getTime() - 20 * 60 * 60 * 1000) } });

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
// LỆNH QUẢN TRỊ ADMIN PANEL
// ==========================================
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id, `👨‍💻 <b>ADMIN PANEL — SWC BOT (CHỐT SALE)</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "📊 Thống kê Phễu Khách Hàng", callback_data: 'admin_stats' }], [{ text: "📢 Bảng lệnh Quản trị", callback_data: 'admin_help' }]] } });
});

bot.on('callback_query', async (query) => {
    if(query.data === 'admin_stats' && query.from.id.toString() === ADMIN_ID) {
        const total = await User.countDocuments(); const newbie = await User.countDocuments({ tag: 'newbie' }); const experienced = await User.countDocuments({ tag: 'experienced' }); const vip = await User.countDocuments({ tag: 'vip_pass' }); const atlas = await User.countDocuments({ tag: 'atlas_investor' }); const interested = await User.countDocuments({ funnelStage: 'interested' }); const hotLead = await User.countDocuments({ funnelStage: 'hot_lead' }); const converted = await User.countDocuments({ funnelStage: 'converted' });
        const report = `📊 <b>THỐNG KÊ SWC BOT</b>\n\n👥 <b>Tổng users:</b> ${total}\n⏳ <b>Còn lại:</b> ${getDaysLeft()} ngày\n\n<b>Phân loại:</b>\n• F0: ${newbie} | Có KN: ${experienced}\n• VIP Pass: ${vip} | ATLAS: ${atlas}\n\n<b>Tiến trình Phễu:</b>\n• Interested (Đang tìm hiểu): ${interested}\n• Hot Lead (Sắp chốt): ${hotLead}\n• Converted (Đã chốt): ${converted}`;
        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    }
    if(query.data === 'admin_help' && query.from.id.toString() === ADMIN_ID) {
        bot.sendMessage(ADMIN_ID, `📢 <b>LỆNH ADMIN BẰNG TAY:</b>\n\n1. <code>/tracuu [ID]</code>: Xem thông tin 1 khách.\n2. <code>/addnote [ID] [Note]</code>: Ghi chú lịch sử khách.\n3. <code>/setpass [ID] [Gói]</code>: Kích hoạt gói cho khách.\n4. <code>/sendall [Text]</code>: Bắn tin nhắn cho Toàn bộ Bot.\n5. <code>/sendtag [Tag] [Text]</code>: Bắn tin cho 1 nhóm (newbie, experienced, vip_pass, atlas_investor).\n6. <code>/sendgroup [Text]</code>: Bot thay mặt anh gửi tin nhắn dõng dạc vào Group Chat.\n7. <code>/export</code>: Lấy ngay 50 ông Hot Lead để gọi điện chốt sale.`, { parse_mode: 'HTML' });
    }
});

bot.onText(/\/tracuu (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const user = await User.findOne({ userId: match[1] });
    if (!user) return bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy!`);
    const report = `🔎 <b>HỒ SƠ KHÁCH HÀNG</b>\n🆔 <code>${match[1]}</code>\n👤 Tên: ${user.firstName} ${user.lastName}\n📞 SĐT: ${user.phone || 'Chưa có'}\n🏷 Nhóm: ${user.tag}\n🎯 Phễu: ${user.funnelStage} (Ngày ${user.funnelDay})\n💎 Gói Pass: ${user.swcPassTier}\n\n👉 <a href="tg://user?id=${match[1]}">Nhấn vào đây để Chat</a>`;
    bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
});

bot.onText(/\/addnote (\d+) ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    await User.updateOne({ userId: match[1] }, { $set: { notes: match[2] } });
    bot.sendMessage(ADMIN_ID, `✅ Đã lưu note!`);
});

bot.onText(/\/setpass (\d+) (\w+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const tier = match[2].toLowerCase();
    if (!['none', 'essential', 'plus', 'ultimate'].includes(tier)) return bot.sendMessage(ADMIN_ID, `❌ Sai gói! Dùng: essential / plus / ultimate`);
    await User.updateOne({ userId: match[1] }, { $set: { swcPassTier: tier, funnelStage: tier !== 'none' ? 'converted' : 'hot_lead' } });
    bot.sendMessage(ADMIN_ID, `✅ Đã Kích hoạt Gói: <b>${tier}</b>`, { parse_mode: 'HTML' });
});

bot.onText(/\/sendall ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({});
    let success = 0;
    for (const u of users) {
        try { await bot.sendMessage(u.userId, match[1], { parse_mode: 'HTML', reply_markup: { inline_keyboard: [NÚT_ĐĂNG_KÝ_SỰ_KIỆN] } }); success++; } catch (e) {}
        await new Promise(r => setTimeout(r, 50));
    }
    bot.sendMessage(ADMIN_ID, `✅ Đã gửi: ${success}/${users.length}`);
});

bot.onText(/\/sendtag (\w+) ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({ tag: match[1] });
    let success = 0;
    for (const u of users) {
        try { await bot.sendMessage(u.userId, match[2], { parse_mode: 'HTML' }); success++; } catch (e) {}
        await new Promise(r => setTimeout(r, 50));
    }
    bot.sendMessage(ADMIN_ID, `✅ Đã gửi: ${success}/${users.length}`);
});

bot.onText(/\/sendgroup ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try { await bot.sendMessage(GROUP_USERNAME, `📢 <b>THÔNG BÁO TỪ BQT:</b>\n\n${match[1]}`, { parse_mode: 'HTML' }); bot.sendMessage(ADMIN_ID, `✅ Đã gửi Group!`);
    } catch (e) { bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`); }
});

bot.onText(/\/export/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const hotLeads = await User.find({ funnelStage: { $in: ['hot_lead', 'interested'] } }).limit(50);
    if (hotLeads.length === 0) return bot.sendMessage(ADMIN_ID, `📭 Chưa có hot lead nào.`);
    let report = `🔥 <b>DANH SÁCH HOT LEADS (Gọi Chốt Sale)</b>\n\n`;
    hotLeads.forEach((u, i) => { report += `${i + 1}. <b>${u.firstName}</b> | ID: <code>${u.userId}</code> | SĐT: ${u.phone}\n`; });
    bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
});

// ==========================================
// HTTP SERVER (BẮT BUỘC ĐỂ RENDER KHÔNG SẬP)
// ==========================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SWC Bot v5.0 - Running OK!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web Server đang chạy cổng ${PORT}`);
    console.log("🚀 MA TRẬN CHỐT SALE ĐÃ KÍCH HOẠT THÀNH CÔNG!");
});
