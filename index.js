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

const NÚT_ĐĂNG_KÝ_SỰ_KIỆN = [{ text: `🚨 ĐĂNG KÝ KÍCH HOẠT SWC PASS (CÒN ${getDaysLeft()} NGÀY)`, url: ACTIVATE_URL }];
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
// SYSTEM PROMPT & AI CLAUDE
// ==========================================
function buildSystemPrompt(user) {
    const daysLeft = getDaysLeft();
    return `Bạn là "Tí" — trợ lý AI tư vấn đầu tư tài chính của quỹ SWC Capital Viet Nam, làm việc dưới quyền anh Hồ Văn Lợi.

TÍNH CÁCH: Sắc sảo, chuyên nghiệp, thấu hiểu tâm lý hành vi (như một Sói già Phố Wall). Xưng "em" hoặc "Tí", gọi khách là "anh/chị".

NHIỆM VỤ:
- Chốt sale thẻ SWC Pass trước deadline ${DEADLINE} (CÒN ${daysLeft} NGÀY). 
- Hướng khách hàng mua Gói Plus ($600/5 năm) hoặc Ultimate ($2600/Vĩnh viễn). Nhấn mạnh Gói Essential ($240/1 năm) chỉ là gói "Cà phê trải nghiệm".
- Giải thích Road to $1M: $8/ngày ($240/tháng) lãi kép trong 15 năm đạt $1,000,000.
- Nhấn mạnh SWC Field (https://swcfield.com/vi/) và Cấu trúc pháp lý SPV giúp đầu tư chung mâm với Quỹ lớn từ $50.

QUY TẮC: 
- Luôn kết thúc câu bằng câu hỏi mở. Nhấn mạnh sự khan hiếm của gói Ultimate (Đóng cửa vĩnh viễn 31/03/2026).
- KHÔNG nhắc tới Token, SWGT. Chỉ tập trung Đầu tư Cổ phần, BĐS Dubai (ATLAS), và Lãi kép.`;
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
        return `Hệ thống Đội ngũ chuyên gia SWC đang bận xử lý dữ liệu. Vui lòng chờ giây lát em sẽ báo Admin phản hồi trực tiếp nhé! 🙏`;
    }
}

// ==========================================
// HÀM GỬI MAIN MENU 
// ==========================================
async function sendMainMenu(chatId, messageId = null) {
    const daysLeft = getDaysLeft();
    const text = `🦁 <b>CỔNG ĐẦU TƯ SWC CAPITAL VIỆT NAM</b>\n\nNơi trang bị cho bạn hệ thống kỷ luật và công cụ của giới tinh anh để đạt tự do tài chính.\n\n⏳ <b>SỰ KIỆN QUAN TRỌNG:</b> Gói thành viên Ultimate (Vĩnh viễn) sẽ chính thức ĐÓNG CỬA vào lúc 23:59 ngày <b>${DEADLINE}</b> (Còn ${daysLeft} ngày).\n\n👇 <b>HÃY CHỌN DANH MỤC ĐỂ KHÁM PHÁ:</b>`;

    const keyboard = {
        inline_keyboard: [
            [{ text: "🇻🇳 Cài đặt Tiếng Việt (Cho người mới)", url: "https://t.me/setlanguage/vi" }],
            [{ text: "📢 Vào Kênh Tin Tức", url: `https://t.me/${CHANNEL_USERNAME.replace('@','')}` }, { text: "💬 Vào Nhóm Giao Lưu", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }],
            [{ text: "💳 TÌM HIỂU VỀ THẺ SWC PASS", callback_data: 'menu_swcpass_main' }],
            [{ text: "🏢 SWC FIELD & SIÊU DỰ ÁN ATLAS", callback_data: 'menu_swcfield_main' }],
            [{ text: "🗺️ ROAD TO $1M (HÀNH TRÌNH TRIỆU ĐÔ)", callback_data: 'menu_road1m_main' }],
            [{ text: "❓ HỎI ĐÁP ĐẦU TƯ (FAQ)", callback_data: 'menu_faq_main' }],
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
// XỬ LÝ /START & THU THẬP SĐT
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
        const welcomeMsg = `Xin chào <b>${user.firstName}</b>! 🦁\n\nTôi là <b>Tí</b> — trợ lý AI của quỹ <b>SWC Capital Viet Nam</b>.\n\nĐể trải nghiệm hệ thống và nhận các tài liệu đầu tư bí mật, vui lòng <b>Chia sẻ số điện thoại</b> bằng nút bên dưới nhé! 👇`;
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
});

// ==========================================
// MA TRẬN CALLBACK QUERY (ĐIỀU HƯỚNG CHI TIẾT)
// ==========================================
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    const daysLeft = getDaysLeft();

    let text = ''; let keyboard = [];
    bot.answerCallbackQuery(callbackQuery.id).catch(() => {});

    if (data === 'main_menu') return sendMainMenu(chatId, messageId);

    // ==========================================
    // NHÁNH 1: SWC PASS
    // ==========================================
    if (data === 'menu_swcpass_main') {
        text = `💎 <b>SWC PASS - TẤM VÉ THÔNG HÀNH GIỚI TINH ANH</b>\n\nBạn có được tư cách thành viên mở ra cánh cửa cho các cơ hội trước đây chỉ dành cho các nhà đầu tư tổ chức.\n\n✔️ Đầu tư qua cấu trúc SPV thay vì "cổ phần trừu tượng".\n✔️ Trả phí tư cách thành viên thay vì bị cắt xén phí giao dịch, phí quản lý quỹ.\n✔️ Truy cập vào câu lạc bộ nhà đầu tư với sự hỗ trợ đào tạo chuyên sâu.\n\n👇 <b>Khám phá chi tiết:</b>`;
        keyboard = [
            [{ text: "⚖️ Phân tích & So sánh 3 Gói SWC Pass", callback_data: 'swcpass_compare' }],
            [{ text: "🎁 4 Đặc Quyền Vượt Trội Của Pass", callback_data: 'swcpass_benefits' }],
            [{ text: "🌐 Website SWC Pass", url: SWC_PASS_WEB }],
            NÚT_MENU_CHÍNH
        ];
    }
    
    // --- So sánh các gói SWC Pass (Tâm lý Cáo Già) ---
    else if (data === 'swcpass_compare') {
        text = `⚖️ <b>SO SÁNH CÁC GÓI SWC PASS</b>\n\nChúng tôi có 3 mức vé. Hãy dùng toán học để xem cái nào thực sự có lợi:\n\n1️⃣ <b>Gói Essential (1 Năm - $240)</b>: <i>Gói "Cà Phê Trải Nghiệm"</i>\nBạn sợ rủi ro? Gói này chia ra chỉ $20/tháng – bằng một chầu cà phê. Thay vì uống xong là hết, $20 này thuê được đội ngũ chuyên gia phân tích thị trường Mỹ. Đây là mức 'học phí' rẻ nhất để tránh việc tự trade mất hàng trăm triệu.\n\n2️⃣ <b>Gói Plus (5 Năm - $600)</b>: <i>Gói "Kỷ Luật Thép"</i> <b>[🔥 KHUYÊN DÙNG]</b>\nĐầu tư mà nhìn ngắn 1 năm thì không bao giờ thấy Lãi Kép. Với gói 5 năm, giá cưa đôi chỉ còn <b>$10/tháng</b>. Bằng một bát phở mỗi tuần, bạn mua được quyền truy cập danh mục giới siêu giàu và bị 'ép' vào kỷ luật thép trong 5 năm.\n\n3️⃣ <b>Gói Ultimate (Vĩnh Viễn - $2.600)</b>: <i>Gói "Di Sản Gia Tộc"</i>\nDành cho người có tầm nhìn xa. Đầu tư 20 năm thì mỗi năm chỉ $130. Bạn mua ĐỨT một hệ thống tài chính để sau này chuyển giao cho con cái.\n\n⚠️ <b>CÚ CHỐT HẠ:</b> Gói Ultimate SẼ ĐÓNG CỬA VĨNH VIỄN vào <b>${DEADLINE}</b>. Bỏ lỡ cơ hội này, bạn mang $10.000 đến cũng phải ngậm ngùi trả phí thuê bao mỗi năm!`;
        keyboard = [
            NÚT_ĐĂNG_KÝ_SỰ_KIỆN,
            [{ text: "🔙 Quay lại SWC Pass", callback_data: 'menu_swcpass_main' }, { text: "🏠 Menu Chính", callback_data: 'main_menu' }]
        ];
    }

    // --- Quyền lợi SWC Pass ---
    else if (data === 'swcpass_benefits') {
        text = `🎁 <b>4 LỚP ĐẶC QUYỀN TỐI THƯỢNG CỦA SWC PASS</b>\n\n<b>1. Đặc quyền tạo dòng tiền (Road to $1M):</b>\nMỗi tháng, nhận bản kế hoạch chi tiết: Mua mã nào? Tỷ lệ bao nhiêu? Bạn chỉ dành 10 phút thao tác. Tiền vốn nằm 100% trong tài khoản chứng khoán cá nhân của bạn. Không giao tiền cho ai, không sợ sập web.\n\n<b>2. Sân chơi Cá Mập (SWC Field):</b>\nMua tài sản giá sỉ (Vòng Private) trước khi lên sàn. Ngưỡng đầu vào siêu thấp từ $50 (thay vì $500k như quỹ lớn). Đầu tư an toàn qua pháp nhân SPV.\n\n<b>3. Đặc quyền Cộng Đồng & Số Hóa:</b>\nTham gia Zoom kín, Hỏi-Đáp trực tiếp chuyên gia. Biểu đồ theo dõi tiến độ "Road to $1M" giúp bạn biết mình đang ở đâu. Miễn phí cập nhật công cụ mới trọn đời.\n\n<b>4. Đặc quyền Đối Tác:</b>\nDòng tiền thụ động vĩnh cửu. Khi tuyến dưới gia hạn Membership hàng năm, hoa hồng sẽ tự động chảy về túi bạn đều đặn.`;
        keyboard = [
            [{ text: "⚖️ Xem So Sánh Các Gói", callback_data: 'swcpass_compare' }],
            [{ text: "🔙 Quay lại", callback_data: 'menu_swcpass_main' }, { text: "🏠 Menu Chính", callback_data: 'main_menu' }]
        ];
    }

    // ==========================================
    // NHÁNH 2: ROAD TO $1M
    // ==========================================
    else if (data === 'menu_road1m_main') {
        text = `🗺️ <b>HÀNH TRÌNH ĐẾN $1 TRIỆU ĐÔ</b>\n\nChiến lược do SWC Field phát triển. Đây là một chương trình đầu tư dài hạn: <b>chỉ cần đầu tư $8/ngày (khoảng $240/tháng) có kỷ luật</b>, đầu tư đều đặn và với sức mạnh Lãi Kép, bạn hướng đến mục tiêu <b>$1,000,000 trong 15 năm</b>.\n\nSản phẩm là hệ thống hoàn chỉnh giúp bạn bắt đầu mà không cần kinh nghiệm hay các khóa đào tạo — chỉ tốn 10-15 phút mỗi tháng.`;
        keyboard = [
            [{ text: "🎯 Mục tiêu của Chiến lược", callback_data: 'road1m_goals' }],
            [{ text: "🔥 Lợi ích thực chiến", callback_data: 'road1m_benefits' }],
            [{ text: "🦈 5 Tầng Chuỗi Thức Ăn Tài Chính", callback_data: 'road1m_foodchain' }],
            NÚT_MENU_CHÍNH
        ];
    }
    else if (data === 'road1m_goals') {
        text = `🎯 <b>MỤC TIÊU CỦA ROAD TO $1M</b>\n\nDự án nhằm mục đích giúp người tham gia:\n\n<b>1. Xây dựng vốn tài chính dài hạn:</b> Cung cấp chiến lược sẵn có để xây dựng tài sản ròng từ 1.000.000 đô la trở lên trong 15-20 năm, bằng cách sử dụng Lãi kép.\n\n<b>2. Đạt sự tự do và độc lập tài chính:</b> Vượt qua áp lực "sống dựa vào đồng lương" và xây dựng thu nhập thụ động cao hơn chi phí.\n\n<b>3. Xây dựng di sản gia tộc:</b> Công cụ tích lũy vốn giúp cha mẹ đảm bảo cho con cháu sự khởi đầu tự tin và một di sản tài chính vững chắc.`;
        keyboard = [[{ text: "🔙 Quay lại Lộ trình", callback_data: 'menu_road1m_main' }, { text: "🏠 Menu", callback_data: 'main_menu' }]];
    }
    else if (data === 'road1m_benefits') {
        text = `🔥 <b>LỢI ÍCH THỰC CHIẾN TỪ ROAD TO $1M</b>\n\n<b>1. Chiến lược đã được kiểm chứng:</b> Nhận tín hiệu hàng tháng (nên mua gì, bao nhiêu, giá nào) và làm theo hệ thống đã giúp hơn 7.000 người thực hiện.\n\n<b>2. Tiết kiệm 10.000 giờ:</b> Không cần ngồi nhìn biểu đồ đỏ mắt hay học lý thuyết suông. Quản lý danh mục chỉ mất 10-15 phút/tháng.\n\n<b>3. Bảo vệ khỏi sai lầm cảm tính:</b> Khắc phục hội chứng "Tự trade = Tự sát". Phương pháp DCA (Bình quân giá) giúp giảm căng thẳng, ngăn ngừa hoảng loạn khi thị trường sập và tránh giao dịch đầu cơ đu đỉnh.`;
        keyboard = [[{ text: "🔙 Quay lại Lộ trình", callback_data: 'menu_road1m_main' }, { text: "🏠 Menu", callback_data: 'main_menu' }]];
    }
    else if (data === 'road1m_foodchain') {
        text = `🦈 <b>5 TẦNG CHUỖI THỨC ĂN TÀI CHÍNH</b>\n\nBạn không nghèo đi vì thiếu thông tin, bạn nghèo vì đang chơi luật của người khác.\n\nTầng 1: Chính phủ/NHTW (Điều tiết cung tiền)\nTầng 2: Cá voi / Quỹ lớn (Gom đáy bán đỉnh)\nTầng 3: Đội lái / Market Maker (Vẽ biểu đồ, rũ bỏ)\nTầng 4: Sói già (Trader kỷ luật)\nTầng 5: F0 - Nhỏ lẻ (Làm thanh khoản cho 4 tầng trên)\n\n💥 <b>F0 Tự trade = Tự sát.</b> Mỗi lần bạn mua vào vì FOMO hay bán ra vì sợ hãi, đó là lúc Cá voi đang nuốt trọn tiền của bạn. \n👉 <b>SWC Pass</b> giúp bạn nhảy thẳng lên Tầng 2, ủy thác hệ thống để đứng trên vai Quỹ lớn!`;
        keyboard = [
            NÚT_ĐĂNG_KÝ_SỰ_KIỆN,
            [{ text: "🔙 Quay lại Lộ trình", callback_data: 'menu_road1m_main' }]
        ];
    }

    // ==========================================
    // NHÁNH 3: SWC FIELD & ATLAS
    // ==========================================
    else if (data === 'menu_swcfield_main') {
        text = `🏢 <b>SWC FIELD LÀ GÌ?</b>\n\nNền tảng "Showcase" dự án đầu tư thế hệ mới. Khách hàng có thể lựa chọn rải vốn vào các dự án đã qua sơ tuyển đánh giá toàn diện. \n\nLợi thế:\n- Đầu tư mâm Cá Mập từ $50 thay vì $500.000.\n- Truy cập toàn cầu: 1 tài khoản, 4 khu vực pháp lý.\n- Minh bạch tuyệt đối qua cấu trúc SPV.\n\n👇 <b>Hãy khám phá:</b>`;
        keyboard = [
            [{ text: "⚖️ SPV Là Gì? (Pháp lý an toàn)", callback_data: 'swcfield_spv' }],
            [{ text: "🏢 Dự Án Trọng Điểm: ATLAS RWA Dubai", callback_data: 'swcfield_atlas' }],
            [{ text: "🌐 Truy cập SWC Field", url: SWC_FIELD_WEB }],
            NÚT_MENU_CHÍNH
        ];
    }
    else if (data === 'swcfield_spv') {
        text = `⚖️ <b>CẤU TRÚC PHÁP LÝ SPV (BẢO VỆ TÀI SẢN)</b>\n\n<i>"Tôi sợ bị lừa, sợ mất tiền vào các dự án rác."</i>\n\n👉 <b>Bộ Lọc Chống FOMO:</b> Chúng tôi làm phần việc nhàm chán nhất để bảo vệ bạn. Bạn không phải đoán xem dự án nào an toàn.\n\nMột Phương tiện mục đích đặc biệt <b>(SPV)</b> riêng biệt được tạo ra cho mỗi quỹ. Bạn mua cổ phiếu của SPV, điều này mang lại cho bạn cổ phần được công nhận hợp pháp (không phải 'cổ phần' trừu tượng).\n\nTất cả giao dịch được thực hiện qua các nền tảng được quản lý tại Mỹ, EU, Nga. Tiền của bạn được bảo vệ như cách giới siêu giàu đang làm!`;
        keyboard = [[{ text: "🔙 Quay lại SWC Field", callback_data: 'menu_swcfield_main' }]];
    }
    else if (data === 'swcfield_atlas') {
        text = `🏢 <b>SIÊU DỰ ÁN ATLAS — BĐS SỐ HÓA DUBAI (RWA)</b>\n\nSở hữu và giao dịch <b>Bất động sản Dubai</b> chỉ bằng vài cú chạm trên điện thoại.\n\n🌟 <b>Điểm nổi bật:</b>\n• <b>Thanh khoản 3 giây</b> — phá vỡ sự chậm chạp BĐS truyền thống.\n• <b>Pháp nhân Atlas Overseas FZE</b> — cấp phép bởi Trung tâm Thương mại Dubai.\n• <b>Đầu tư từ $50</b> — Dân chủ hóa sân chơi của giới siêu giàu.\n• <b>RWA (Real World Assets)</b> — Tài sản thật, tạo ra dòng tiền thật.\n\n⚠️ <b>LƯU Ý:</b> Vòng ưu đãi đóng cửa vào <b>${DEADLINE}</b>. Đừng bỏ lỡ vị thế sớm nhất!`;
        keyboard = [[{ text: "🔙 Quay lại SWC Field", callback_data: 'menu_swcfield_main' }]];
    }

    // ==========================================
    // NHÁNH 4: FAQ (XỬ LÝ TỪ CHỐI)
    // ==========================================
    else if (data === 'menu_faq_main' || data === 'faq_back') {
        text = `❓ <b>GIẢI ĐÁP THẮC MẮC (XÓA BỎ RÀO CẢN)</b>\n\nChúng tôi thấu hiểu nỗi lo của nhà đầu tư F0. Hãy chọn vấn đề bạn đang vướng mắc:`;
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
        text = `✅ <b>Nhận được gì ngay sau khi thanh toán?</b>\n\nQuyền truy cập <b>đầy đủ và ngay lập tức</b> vào hệ sinh thái. Tín hiệu chiến lược tháng đầu tiên sẽ hiển thị trong tài khoản của bạn <b>chỉ sau vài phút</b>.\nBạn sẽ biết chính xác: Mua mã nào, tỷ lệ bao nhiêu, giá nào. <b>Không cần chờ đợi, không cần học cách vẽ biểu đồ!</b>`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]];
    }
    else if (data === 'faq_3') {
        text = `✅ <b>Khác gì tự học kiến thức miễn phí trên YouTube?</b>\n\nKiến thức miễn phí thì đầy rẫy — nhưng nếu chỉ "biết" mà giàu thì ai cũng là triệu phú rồi. \nSự khác biệt của SWC Pass nằm ở <b>Hệ thống Kỷ luật ép bạn thực thi</b>, loại bỏ hoàn toàn cảm xúc cá nhân (Sợ hãi & Fomo).\nGiống như việc bạn đọc sách dạy bơi so với việc <b>thực sự nhảy xuống hồ với Huấn luyện viên bơi lội kế bên</b>.`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]];
    }
    else if (data === 'faq_4') {
        text = `✅ <b>Chưa có đủ $600 lúc này để mua Gói 5 năm?</b>\n\nBài toán đơn giản: $600 ÷ 5 năm = <b>$10/tháng</b> (~250.000 VNĐ). Số tiền bạn đang ném qua cửa sổ cho 1 bát phở mỗi tuần.\nTrì hoãn "chờ có đủ tiền" = <b>đánh mất hàng thập kỷ sức mạnh Lãi kép</b>. Cái giá thực sự không phải $600 — mà là chi phí cơ hội bạn đã bỏ lỡ!`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]];
    }
    else if (data === 'faq_5') {
        text = `✅ <b>Giữ tiền mặt trong ngân hàng cho an toàn?</b>\n\nĐây là <b>ảo giác an toàn nguy hiểm nhất</b>. Ngân hàng trung ương in tiền mỗi ngày → lạm phát <b>lặng lẽ móc túi bạn</b>.\nGiữ tiền mặt dài hạn = <b>đảm bảo 100% bạn sẽ nghèo đi theo thời gian</b>. Giới tinh anh không bao giờ tích trữ tiền mặt, họ chuyển hóa nó thành Tài sản sinh lời.`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]];
    }
    else if (data === 'faq_6') {
        text = `✅ <b>KẺ HỦY DIỆT PHÍ ẨN</b>\n\nNếu bạn đưa tiền cho các quỹ truyền thống, họ sẽ cắt xén 1.5% đến 2% trên TỔNG tài sản của bạn mỗi năm (Phí này cướp đi hàng tỷ đồng sau 20 năm).\n\nỞ SWC, chúng tôi chơi công bằng: <b>Mô hình Thẻ Thành Viên (Membership)</b>. Bạn chỉ trả đúng $10/tháng (gói 5 năm). Tài sản của bạn có tăng lên 1 triệu đô, phí vẫn chỉ là $10. Chúng tôi không phạt bạn vì bạn giàu lên!`;
        keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]];
    }

    if (text !== '') {
        bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard } }).catch(() => {
            bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard } });
        });
    }
});

// ==========================================
// XỬ LÝ TIN NHẮN — AI TƯ VẤN VÀ ADMIN (GIỮ NGUYÊN)
// ==========================================
bot.on('message', async (msg) => {
    if (!msg.from || msg.from.is_bot || msg.chat.type !== 'private') return;
    if (msg.contact || (msg.text && msg.text.startsWith('/'))) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // ADMIN REPLY
    if (userId === ADMIN_ID && msg.reply_to_message) {
        const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
        const idMatch = originalText.match(/ID:\s*(\d+)/);
        if (idMatch) {
            const targetId = idMatch[1];
            bot.sendMessage(targetId, `👨‍💻 <b>Phản hồi từ Ban Cố Vấn SWC:</b>\n\n${msg.text || msg.caption}`, { parse_mode: 'HTML' }).catch(() => {});
            bot.sendMessage(ADMIN_ID, `✅ Đã trả lời khách ID: <code>${targetId}</code>`, { parse_mode: 'HTML' });
            await User.updateOne({ userId: targetId }, { $set: { adminPausedAiUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) } });
            return;
        }
    }

    // KHÁCH NHẮN TIN - GỌI AI
    if (userId !== ADMIN_ID) {
        let user = await User.findOne({ userId });
        if (!user) { user = new User({ userId, firstName: msg.from.first_name || '', lastName: msg.from.last_name || '', username: msg.from.username ? `@${msg.from.username}` : '' }); await user.save(); }

        if (msg.photo || msg.video || msg.document) {
            await bot.forwardMessage(ADMIN_ID, chatId, msg.message_id).catch(() => {});
            bot.sendMessage(ADMIN_ID, `📩 <b>TỆP TỪ KHÁCH HÀNG</b>\n👤 Khách: ${user.firstName}\n🆔 ID: <code>${userId}</code>\n💬 Ghi chú: ${msg.caption || 'Không có'}\n\n👉 <i>Reply để chat trực tiếp (AI sẽ tự khóa).</i>`, { parse_mode: 'HTML' }).catch(()=>{});
        }

        const now = new Date();
        if (user.adminPausedAiUntil && user.adminPausedAiUntil > now) {
            bot.sendMessage(ADMIN_ID, `📩 <b>KHÁCH TRẢ LỜI (CHẾ ĐỘ ADMIN)</b>\n👤 Tên: ${user.firstName}\n🆔 ID: <code>${userId}</code>\n💬 Nội dung: ${msg.text || '[Tệp]'}\n\n👉 <i>Reply để tiếp tục.</i>`, { parse_mode: 'HTML' }).catch(()=>{});
            return;
        }

        bot.sendChatAction(chatId, 'typing').catch(() => {});
        const userText = msg.text || msg.caption || '[Khách gửi tệp]';
        const aiReply = await callClaude(user, userText);
        bot.sendMessage(chatId, aiReply, { parse_mode: 'HTML' }).catch(() => {});

        if (['interested', 'hot_lead', 'converted'].includes(user.funnelStage)) {
            const alertMsg = `🔥 <b>HOT LEAD — ĐANG CHAT VỚI AI</b>\n👤 Tên: <b>${user.firstName}</b>\n🆔 ID: <code>${userId}</code>\n\n💬 <b>Khách:</b> ${userText}\n🤖 <b>Tí:</b> ${aiReply}\n\n👉 <i>Reply tin này để cướp quyền chat.</i>`;
            bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML' }).catch(() => {});
        }
    }
});

// ==========================================
// BROADCAST TỰ ĐỘNG THEO LỊCH (CRONJOBS)
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
// FUNNEL DRIP TỰ ĐỘNG — CHUỖI 7 NGÀY
// ==========================================
const funnelMessages = [
    null, 
    `📖 <b>BÀI HỌC SỐ 1: TẠI SAO 95% NHÀ ĐẦU TƯ THUA LỖ?</b>\n\nMà vì họ đang chơi trò chơi mà <b>luật do người khác viết</b>.\n<b>F0 = Thanh khoản cho tất cả tầng trên.</b>\nMỗi lần bạn mua vào hoảng loạn hay bán ra sợ hãi — đó là lúc Cá voi ăn tiền của bạn.\n\n💡 Giải pháp: Đừng chơi một mình. Hãy đứng trên vai Quỹ lớn.`,
    `📖 <b>BÀI HỌC SỐ 2: TIỀN NHÀN RỖI LÀ GÌ?</b>\n\n<b>TUYỆT ĐỐI không đầu tư bằng tiền "cơm áo gạo tiền".</b>\nChỉ dùng tiền nhàn rỗi. Nếu dùng tiền học phí, vay mượn -> Không dám cắt lỗ → Gồng lỗ → Cháy tài khoản.\n\n💡 SWC Pass gói Plus chỉ <b>$10/tháng (~250k VNĐ)</b> — đúng nghĩa tiền ly cà phê.`,
    `📖 <b>BÀI HỌC SỐ 3: SỨC MẠNH LÃI KÉP</b>\n\nEinstein gọi đây là "Kỳ quan thứ 8".\n<b>$240/tháng × kỷ luật × 15 năm = $1,000,000</b>\nKhông phải may mắn. Chỉ là <b>toán học + thời gian + kỷ luật</b>.\n⏳ Còn {DAYS} ngày để bắt đầu!`,
    `🔥 <b>CÒN {DAYS} NGÀY — ĐÃ CÓ BAO NHIÊU NGƯỜI ĐĂNG KÝ?</b>\n\nGói Ultimate (Vĩnh viễn) — 1.000 suất toàn cầu.\nKhi 1.000 suất đầy → cửa đóng vĩnh viễn. \n<b>Câu hỏi không phải "Có nên mua không?" — mà là "Bao giờ thì quá muộn?"</b>`,
    `💬 <b>HỌ ĐÃ THAY ĐỔI THẾ NÀO SAU KHI DÙNG PASS?</b>\n\n<i>"Trước đây tôi dành 3-4 tiếng mỗi ngày xem chart, vẫn thua lỗ. Giờ 10 phút/tháng, danh mục đang tăng trưởng đều đặn."</i>\n💡 Đây là <b>hệ thống đúng + kỷ luật đúng</b>.\n⏳ Còn {DAYS} ngày!`,
    `⚡ <b>NGÀY MAI LÀ NGÀY CUỐI CÙNG!</b>\n\n<b>2 lựa chọn:</b>\n❌ Tiếp tục tự trade → Mất tiền bạc & tâm lý\n✅ Mua SWC Pass → 10 phút/tháng, ủy thác Quỹ lớn.\n\nGói Ultimate đóng cửa <b>${DEADLINE}</b>. Quyết định hôm nay định hình 15 năm tới.`,
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
// ADMIN COMMANDS
// ==========================================
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id, `👨‍💻 <b>ADMIN PANEL — SWC BOT v5.0</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "📊 Thống kê Phễu Khách Hàng", callback_data: 'admin_stats' }], [{ text: "📢 Lệnh Sendall & MKT", callback_data: 'admin_help' }]] } });
});

bot.on('callback_query', async (query) => {
    if(query.data === 'admin_stats' && query.from.id.toString() === ADMIN_ID) {
        const total = await User.countDocuments(); const newbie = await User.countDocuments({ tag: 'newbie' }); const experienced = await User.countDocuments({ tag: 'experienced' }); const vip = await User.countDocuments({ tag: 'vip_pass' }); const atlas = await User.countDocuments({ tag: 'atlas_investor' }); const interested = await User.countDocuments({ funnelStage: 'interested' }); const hotLead = await User.countDocuments({ funnelStage: 'hot_lead' }); const converted = await User.countDocuments({ funnelStage: 'converted' });
        const report = `📊 <b>THỐNG KÊ SWC BOT</b>\n\n👥 <b>Tổng users:</b> ${total}\n⏳ <b>Còn lại:</b> ${getDaysLeft()} ngày\n\n<b>Phân loại:</b>\n• F0: ${newbie} | Có KN: ${experienced}\n• VIP Pass: ${vip} | ATLAS: ${atlas}\n\n<b>Phễu:</b>\n• Interested: ${interested}\n• Hot Lead: ${hotLead}\n• Converted: ${converted}`;
        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    }
    if(query.data === 'admin_help' && query.from.id.toString() === ADMIN_ID) {
        bot.sendMessage(ADMIN_ID, `📢 <b>LỆNH ADMIN:</b>\n1. <code>/tracuu [ID]</code>\n2. <code>/addnote [ID] [Note]</code>\n3. <code>/setpass [ID] [Gói]</code>\n4. <code>/sendall [Text]</code>\n5. <code>/sendtag [Tag] [Text]</code>\n6. <code>/sendgroup [Text]</code>\n7. <code>/export</code>`, { parse_mode: 'HTML' });
    }
});

bot.onText(/\/tracuu (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const user = await User.findOne({ userId: match[1] });
    if (!user) return bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy!`);
    const report = `🔎 <b>HỒ SƠ</b>\n🆔 <code>${match[1]}</code>\n👤 ${user.firstName} ${user.lastName}\n📞 ${user.phone || 'Chưa có'}\n🏷 Tag: ${user.tag}\n🎯 Funnel: ${user.funnelStage}\n💎 Gói: ${user.swcPassTier}\n👉 <a href="tg://user?id=${match[1]}">Chat</a>`;
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
    if (!['none', 'essential', 'plus', 'ultimate'].includes(tier)) return bot.sendMessage(ADMIN_ID, `❌ Sai gói!`);
    await User.updateOne({ userId: match[1] }, { $set: { swcPassTier: tier, funnelStage: tier !== 'none' ? 'converted' : 'hot_lead' } });
    bot.sendMessage(ADMIN_ID, `✅ Pass cập nhật: <b>${tier}</b>`, { parse_mode: 'HTML' });
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

bot.onText(/\/sendgroup ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try { await bot.sendMessage(GROUP_USERNAME, `📢 <b>THÔNG BÁO TỪ BQT:</b>\n\n${match[1]}`, { parse_mode: 'HTML' }); bot.sendMessage(ADMIN_ID, `✅ Đã gửi Group!`);
    } catch (e) { bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`); }
});

bot.onText(/\/export/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const hotLeads = await User.find({ funnelStage: { $in: ['hot_lead', 'interested'] } }).limit(50);
    if (hotLeads.length === 0) return bot.sendMessage(ADMIN_ID, `📭 Chưa có hot lead nào.`);
    let report = `🔥 <b>HOT LEADS</b>\n\n`;
    hotLeads.forEach((u, i) => { report += `${i + 1}. <b>${u.firstName}</b> | <code>${u.userId}</code> | SĐT: ${u.phone}\n`; });
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
    console.log("🚀 MA TRẬN CHỐT SALE ĐÃ KÍCH HOẠT!");
});
