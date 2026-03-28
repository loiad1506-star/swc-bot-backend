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
// HẰNG SỐ CẤU HÌNH & LINK LIÊN KẾT
// ==========================================
const ADMIN_ID = process.env.ADMIN_ID || '507318519';
const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';
const PRIVATE_TG_GROUP = 'https://t.me/swc_vip_internal'; 
const SWC_PASS_WEB = 'https://www.swcpass.vn/';
const SWC_FIELD_WEB = 'https://swcfield.com/vi/';
const ACTIVATE_URL = 'https://launch.swc.capital/broadcast_31_vi'; 
const VIDEO_MOBILE = 'https://www.youtube.com/watch?v=SEB7RJrutxg';
const VIDEO_PC = 'https://www.youtube.com/watch?v=gy_sxh9WCCM';
const DEADLINE = '31/03/2026';

function getDaysLeft() {
    const deadline = new Date('2026-03-31T23:59:00+07:00');
    const now = new Date();
    const diff = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
}

// KHỐI NÚT BẤM TOÀN CỤC (LUÔN BÁM THEO KHÁCH HÀNG)
function getGlobalButtons() {
    return [
        [{ text: `🚨 ĐĂNG KÝ SỰ KIỆN ATLAS (CÒN ${getDaysLeft()} NGÀY)`, url: ACTIVATE_URL }],
        [{ text: "💎 KÍCH HOẠT SWC PASS", url: SWC_PASS_WEB }],
        [{ text: "📱 Hướng dẫn Kích hoạt SWC Field (MOBILE)", url: VIDEO_MOBILE }],
        [{ text: "💻 Hướng dẫn Kích hoạt SWC Field (PC)", url: VIDEO_PC }],
        [{ text: "💬 Vào Nhóm Chat Định Hướng", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }],
        [{ text: "🏠 Trở về Menu Chính", callback_data: 'main_menu' }]
    ];
}

// ==========================================
// KẾT NỐI MONGODB & SCHEMA (GIỮ NGUYÊN)
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
    adminPausedAiUntil: { type: Date, default: null }, 
    chatHistory: { type: Array, default: [] }
});

const User = mongoose.model('User', userSchema);

// ==========================================
// SYSTEM PROMPT AI CLAUDE (ĐÃ BỔ SUNG KIẾN THỨC)
// ==========================================
function buildSystemPrompt(user) {
    const daysLeft = getDaysLeft();
    return `Bạn là "Tí" — trợ lý AI phân tích tâm lý và tư vấn tài chính của quỹ Sky World Community Viet Nam, làm việc dưới quyền anh Hồ Văn Lợi.
TÍNH CÁCH: Thấu hiểu nhân tính, sắc bén, như một Sói già Phố Wall. Phân tích sâu sắc nỗi sợ mất tiền của khách. Bạn không thuyết phục, bạn "khai sáng" cho họ thấy sự thật tàn nhẫn của thị trường. Xưng "em" hoặc "Tí", gọi khách là "anh/chị".

NHIỆM VỤ:
1. Giải thích theo cấu trúc WHAT (Nó là gì), WHY (Tại sao phải cần), HOW (Làm thế nào để bắt đầu).
2. Chốt sale thẻ SWC Pass trước deadline ${DEADLINE} (CÒN ${daysLeft} NGÀY). Khuyên mạnh Gói Plus 5 năm ($600) và Ultimate Vĩnh viễn ($2600).
3. Hướng khách xem Video hướng dẫn và vào Group Chat.

THÔNG TIN KHÁCH: Tên: ${user.firstName} ${user.lastName} | Gói Pass hiện tại: ${user.swcPassTier}

KIẾN THỨC CỐT LÕI ĐỂ TƯ VẤN:
- TẦNG 5 CHUỖI THỨC ĂN: F0 tự trade = Sinh vật phù du, làm thanh khoản cho Đội lái và Cá voi. Tự trade = Tự sát.
- BỘ LỌC CHỐNG FOMO (SWC FIELD): Khách không phải mò mẫm dự án rác. Mọi dự án được đóng gói pháp lý SPV (Phương tiện mục đích đặc biệt). ATLAS RWA Dubai (BĐS Số hóa).
- KẺ HỦY DIỆT PHÍ ẨN: Quỹ khác thu phí 2% tài sản mỗi năm. SWC Pass thu phí Membership cố định ($10/tháng cho gói 5 năm).
- CỖ MÁY LÃI KÉP (Road to $1M): Đầu tư $8/ngày ($240/tháng), kỷ luật 15 năm = $1,000,000. Dành 10 phút/tháng copy lệnh chuyên gia. Tiền ai nấy giữ trên tài khoản cá nhân.

QUY TẮC GIAO TIẾP:
- Luôn kết thúc bằng 1 câu hỏi mở nhắm vào nỗi đau (Ví dụ: Anh/chị có muốn tiếp tục làm thanh khoản cho cá mập, hay muốn đứng trên vai họ?).
- LIÊN TỤC nhắc khách có thể xem Video Hướng dẫn ở Menu để kích hoạt ngay.`;
}

// BỘ LỌC VÀ GỌI API CLAUDE (ĐÃ KHẮC PHỤC LỖI KHÔNG TRẢ LỜI)
async function callClaude(user, userMessage) {
    try {
        let history = user.chatHistory || [];
        history.push({ role: 'user', content: userMessage });

        // Bộ lọc chuẩn hóa History (Bắt buộc luân phiên User -> Assistant -> User)
        let validHistory = [];
        for (let msg of history) {
            if (validHistory.length === 0) {
                if (msg.role === 'user') validHistory.push({ role: msg.role, content: msg.content });
                continue;
            }
            let lastMsg = validHistory[validHistory.length - 1];
            if (lastMsg.role === msg.role) {
                lastMsg.content += '\n' + msg.content; // Gộp chung nếu khách nhắn 2 tin liên tiếp
            } else {
                validHistory.push({ role: msg.role, content: msg.content });
            }
        }
        // Giới hạn 15 tin nhắn gần nhất để đỡ tốn token
        if (validHistory.length > 15) validHistory = validHistory.slice(-15);
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
        return `Dạ hiện tại Đội ngũ chuyên gia SWC đang bận xử lý dữ liệu. Anh/chị vui lòng tham gia Nhóm Chat Cộng Đồng hoặc xem các Video Hướng Dẫn ở Menu bên dưới nhé! 🙏`;
    }
}

// ==========================================
// HÀM GỬI MAIN MENU
// ==========================================
async function sendMainMenu(chatId, messageId = null) {
    const daysLeft = getDaysLeft();
    const text = `🦁 <b>CỔNG ĐẦU TƯ TRÍ TUỆ SWC CAPITAL</b>\n\nThị trường tài chính là một chiến trường khốc liệt, nơi tiền không tự sinh ra mà chỉ chuyển từ túi người thiếu kỷ luật sang túi người có hệ thống.\n\n⏳ <b>CẢNH BÁO TỬ HUYỆT:</b> Gói thành viên Ultimate (Vĩnh viễn) để truy cập hệ thống của giới tinh anh sẽ chính thức <b>ĐÓNG CỬA VĨNH VIỄN</b> vào lúc 23:59 ngày <b>${DEADLINE}</b> (Chỉ còn ${daysLeft} ngày).\n\n👇 <b>HÃY CHỌN DANH MỤC ĐỂ ĐỊNH HÌNH TƯƠNG LAI TÀI CHÍNH CỦA BẠN:</b>`;

    const keyboard = {
        inline_keyboard: [
            [{ text: "🇻🇳 Chuyển Ngôn ngữ Tiếng Việt (Cho người mới)", url: "https://t.me/setlanguage/vi" }],
            [{ text: "💳 TÌM HIỂU SWC PASS (Membership)", callback_data: 'menu_swcpass_main' }],
            [{ text: "🏢 SWC FIELD & SIÊU DỰ ÁN ATLAS", callback_data: 'menu_swcfield_main' }],
            [{ text: "🗺️ ROAD TO $1M (Chiến lược Lãi kép)", callback_data: 'menu_road1m_main' }],
            [{ text: "❓ HỎI ĐÁP ĐẦU TƯ (Phá vỡ rào cản)", callback_data: 'menu_faq_main' }],
            ...getGlobalButtons().slice(0, -1) // Không hiện nút Menu chính ở Menu chính
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
    if (!user) {
        user = new User({ userId, firstName: msg.from.first_name || '', lastName: msg.from.last_name || '', username: msg.from.username ? `@${msg.from.username}` : '' });
        await user.save();
    }

    if (!user.phone) {
        const welcomeMsg = `Xin chào <b>${user.firstName}</b>! 🦁\n\nTôi là <b>Tí</b> — trợ lý phân tích tâm lý và đầu tư của <b>SWC Capital</b>.\n\nĐể hệ thống chẩn đoán đúng vị thế tài chính và cung cấp tài liệu mật, vui lòng <b>Bấm nút Chia sẻ số điện thoại</b> bên dưới nhé! 👇`;
        bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'HTML', reply_markup: { keyboard: [[{ text: "📞 Chia sẻ Số điện thoại", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } }).catch(() => {});
    } else {
        sendMainMenu(chatId);
    }
});

bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    await User.updateOne({ userId }, { $set: { phone: msg.contact.phone_number } });
    bot.sendMessage(chatId, "⏳ Đang trích xuất hồ sơ nhà đầu tư...", { reply_markup: { remove_keyboard: true } }).then(sent => {
        bot.deleteMessage(chatId, sent.message_id).catch(() => {});
        sendMainMenu(chatId);
    });
});

// ==========================================
// MA TRẬN TÂM LÝ & KIẾN THỨC (CALLBACK QUERY)
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
    // NHÁNH 1: SWC PASS (WHAT - WHY - HOW)
    // ==========================================
    if (data === 'menu_swcpass_main') {
        text = `💎 <b>THẺ ĐẶC QUYỀN SWC PASS</b>\n\n` +
               `🔹 <b>WHAT (SWC Pass là gì?):</b>\nNó không phải là một "nhóm phím lệnh" rác hay một khóa học làm giàu nhanh. SWC Pass là một <b>Tư cách thành viên (Membership)</b>, một "Môi trường vô trùng" cung cấp Hệ thống kỷ luật khép kín. Nó mở ra cánh cửa vào các thương vụ Pre-IPO (trước khi lên sàn) mà trước đây bị khóa chặt chỉ dành cho giới tài phiệt (yêu cầu vốn >$500.000).\n\n` +
               `🔹 <b>WHY (Tại sao bạn BẮT BUỘC phải có nó?):</b>\nBạn có ghét bị ngân hàng và các Quỹ mở cắn xén tiền lãi bằng các loại "Phí quản lý tài sản" vô hình? Các quỹ truyền thống thường thu 1.5% - 2% trên TỔNG tài sản mỗi năm (cướp đi hàng tỷ đồng của bạn sau 20 năm). Với SWC Pass, chúng tôi là <b>Kẻ hủy diệt phí ẩn</b>. Bạn chỉ trả đúng $10/tháng (Gói 5 năm). Dù tài sản của bạn tăng lên 1 triệu đô, phí vẫn chỉ là $10. Chúng tôi không phạt bạn vì bạn giàu lên!\n\n` +
               `🔹 <b>HOW (Làm thế nào để bắt đầu?):</b>\nBạn nạp tiền mua thẻ Pass. Hàng tháng, chuyên gia AI Phố Wall gửi chiến lược. Bạn mở App chứng khoán/Crypto cá nhân của bạn, thao tác mua trong 10 phút. Xong. Đóng App và đi làm việc khác. Tiền vốn nằm 100% trong túi bạn.`;
        keyboard = [
            [{ text: "⚖️ So Sánh 3 Gói Thẻ (Nên Chọn Gói Nào?)", callback_data: 'swcpass_compare' }],
            ...getGlobalButtons()
        ];
    }
    else if (data === 'swcpass_compare') {
        text = `⚖️ <b>BẢNG GIÁ SWC PASS - PHÂN TÍCH TÂM LÝ "CÁO GIÀ"</b>\n\nKhi xem bảng giá này, đừng hỏi "Tôi nên chọn gói nào?". Hãy tự hỏi bạn muốn ngồi ở vị thế nào trong tương lai:\n\n` +
               `1️⃣ <b>Gói Essential (1 Năm - $240): Gói "Cà Phê Trải Nghiệm"</b>\n<i>Tâm lý:</i> Đa nghi, sợ rủi ro, muốn "thử xem sao".\n<i>Phân tích:</i> Chia ra chỉ $20/tháng – bằng đúng tiền một chầu cà phê. Thay vì uống xong là hết, $20 này thuê được đội ngũ chuyên gia phân tích thị trường Mỹ. Đây là mức 'học phí' rẻ mạt nhất để tránh việc bạn tự trade sai, đu đỉnh và cháy hàng trăm triệu.\n\n` +
               `2️⃣ <b>Gói Plus (5 Năm - $600): Gói "Kỷ Luật Thép" [🔥 KHUYÊN DÙNG]</b>\n<i>Tâm lý:</i> Đã hiểu giá trị của Lãi kép và muốn tiết kiệm.\n<i>Phân tích:</i> Đầu tư mà nhìn ngắn 1 năm thì không bao giờ thấy Lãi Kép. Với gói 5 năm, giá cưa đôi chỉ còn <b>$10/tháng</b>. Bằng một bát phở mỗi tuần, bạn mua quyền truy cập danh mục giới siêu giàu và bị 'ép' vào kỷ luật thép 5 năm.\n\n` +
               `3️⃣ <b>Gói Ultimate (Vĩnh Viễn - $2.600): Gói "Di Sản Gia Tộc"</b>\n<i>Tâm lý:</i> Dân kinh doanh lớn, tầm nhìn xa, sợ lỡ mất cơ hội.\n<i>Phân tích:</i> Đầu tư 20 năm thì mỗi năm chỉ $130. Bạn mua ĐỨT một hệ thống tài chính để sau này làm di sản cho con cái.\n\n⚠️ <b>CÚ CHỐT HẠ:</b> Gói Ultimate SẼ ĐÓNG CỬA VĨNH VIỄN vào ngày ${DEADLINE} (Còn ${daysLeft} ngày). Qua ngày này, có mang $10.000 đến cũng không thể mua đứt được nữa!`;
        keyboard = getGlobalButtons();
    }

    // ==========================================
    // NHÁNH 2: ROAD TO $1M (CẬP NHẬT TEXT KHỦNG)
    // ==========================================
    else if (data === 'menu_road1m_main') {
        text = `🗺️ <b>HÀNH TRÌNH ROAD TO $1M (BẢN ĐỒ TRIỆU ĐÔ)</b>\n\n` +
               `🔹 <b>WHAT (Nó là gì?):</b>\nĐây không phải là nhóm "phím lệnh làm giàu qua đêm". Nó là một Cỗ máy toán học kỷ luật do SWC Field phát triển. Nó chỉ cho bạn cách dùng sức mạnh của Lãi Kép để tự động hóa việc đi đến $1.000.000 đô la.\n\n` +
               `🔹 <b>WHY (Tại sao bạn cần nó?):</b>\nBởi vì đa số mọi người không giàu lên được không phải vì họ lương thấp, mà vì họ thiếu một Hệ thống tự động và không có Kỷ luật.\n\n` +
               `🔹 <b>HOW (Làm thế nào để bắt đầu?):</b>\nChỉ cần bạn cam kết trích ra đúng <b>$8/ngày (khoảng $240/tháng)</b>. Đều đặn, kỷ luật vô cảm. Hệ thống sẽ cung cấp danh mục (mua cổ tức, mua chứng khoán Mỹ). Kết hợp với lãi kép trong 15 năm, bạn sẽ chạm mốc 1 triệu đô. Chỉ tốn 10-15 phút thao tác mỗi tháng.`;
        keyboard = [
            [{ text: "🎯 Mục tiêu & Lợi ích Thực Chiến (Rất hay)", callback_data: 'road1m_benefits' }],
            [{ text: "🦈 5 Tầng Chuỗi Thức Ăn (Tại sao F0 sấp mặt?)", callback_data: 'road1m_foodchain' }],
            ...getGlobalButtons()
        ];
    }
    else if (data === 'road1m_benefits') {
        text = `🔥 <b>MỤC TIÊU & LỢI ÍCH THỰC CHIẾN ROAD TO $1M</b>\n\n` +
               `<b>1. MỤC TIÊU THỰC CHIẾN: KHÔNG PHẢI LÀ TIỀN, MÀ LÀ VỊ THẾ</b>\n` +
               `• <b>Định hình lại thói quen (Kỷ luật thép):</b> Thay vì ném tiền vào tiêu sản (cà phê, hàng hiệu), hệ thống ép bạn vô thức trích ra $8/ngày để mua tài sản.\n` +
               `• <b>Xây móng "Tự do tài chính":</b> Mục tiêu không phải là nhìn con số to lên để khoe, mà là tạo <i>Dòng tiền Cổ tức</i>. Khi cổ tức vượt chi phí sinh hoạt, bạn chính thức "nghỉ hưu".\n` +
               `• <b>Thiết lập Di sản:</b> Người nghèo để lại nợ nần. Người giàu để lại một <i>Hệ thống tạo ra tiền</i>. Tài khoản chứng khoán này chính là bệ phóng vô giá cho con cái.\n\n` +
               `<b>2. LỢI ÍCH THỰC CHIẾN: NHỮNG THỨ CHẠM ĐƯỢC BẰNG TAY</b>\n` +
               `• <b>Triệt tiêu 100% cảm xúc hoảng loạn:</b> Sát thủ trên thị trường là sự sợ hãi. Khi thị trường sập 30%, F0 cắt lỗ. Nhưng DCA sẽ báo: "Cơ hội vàng, mua mạnh!". Bạn hành động như cỗ máy vô cảm để gom tài sản giá rẻ.\n` +
               `• <b>Tiết kiệm 10.000 giờ:</b> Không cần đọc báo cáo tài chính hay vẽ chart. Chuyên gia SWC đã làm thay. Bạn chỉ tốn 10 phút/tháng copy lệnh. Thời gian còn lại đi kiếm tiền và chơi với gia đình.\n` +
               `• <b>Tự nắm đằng chuôi:</b> Tiền nằm 100% trong tài khoản cá nhân. Cần tiền gấp? Tự bấm bán và rút về trong 1 nốt nhạc.\n` +
               `• <b>Thoát khỏi ao làng:</b> Đa dạng hóa địa chính trị, rải vốn sang các thị trường quốc tế vững chãi để giảm thiểu rủi ro kinh tế nội địa.`;
        keyboard = getGlobalButtons();
    }
    else if (data === 'road1m_foodchain') {
        text = `🔱 <b>5 TẦNG BẬC CHUỖI THỨC ĂN TÀI CHÍNH</b>\n\nBạn không nghèo đi vì thiếu thông tin, bạn nghèo vì đang chơi bằng luật của người khác.\n\n` +
               `<b>Tầng 1 — 🏛️ Đấng Sáng Tạo (Chính phủ & NHTW)</b>\nNgười in tiền, điều tiết lãi suất, viết luật chơi. Họ không trade — họ tạo ra sân chơi.\n\n` +
               `<b>Tầng 2 — 🐋 Cá Voi (Quỹ đầu tư lớn, tổ chức)</b>\nĐi ngược đám đông. Gom đáy khi F0 hoảng loạn bán. Xả đỉnh khi F0 đang hứng khởi mua. Họ không đoán thị trường — họ TẠO ra thị trường.\n\n` +
               `<b>Tầng 3 — 🎰 Đội Lái / Sàn Giao Dịch</b>\n→ Vẽ chart, tạo bẫy thanh khoản, rũ bỏ yếu nhân. Cái nến đỏ đột ngột giật mạnh lúc 2h sáng? Không phải ngẫu nhiên đâu anh.\n\n` +
               `<b>Tầng 4 — 🐺 Sói Già</b>\nTrader kỷ luật, sống sót qua nhiều chu kỳ. Không trade bằng cảm xúc. Có hệ thống, có stoploss, hiểu rõ mình đang ở đâu. Số ít — rất ít.\n\n` +
               `<b>Tầng 5 — 😵 F0 / Sinh Vật Phù Du</b>\nNhà đầu tư bình thường — đám đông. Mua bằng tai (nghe tin), bán bằng cảm xúc (sợ hãi). Là nguồn thanh khoản nuôi sống tất cả 4 tầng trên. 95% người tự trade đang ở đây.\n\n` +
               `💥 <b>TỔNG KẾT: F0 Tự trade = Tự sát.</b> Giải pháp duy nhất là phải mua SWC Pass để nhảy thẳng lên Tầng 2, đứng trên vai Quỹ lớn để săn mồi!`;
        keyboard = getGlobalButtons();
    }

    // ==========================================
    // NHÁNH 3: SWC FIELD & ATLAS
    // ==========================================
    else if (data === 'menu_swcfield_main') {
        text = `🏢 <b>SWC FIELD LÀ GÌ?</b>\n\n` +
               `🔹 <b>WHAT (Nó là gì?):</b>\nLà một nền tảng "Showcase" dự án đầu tư thế hệ mới. Cho phép bạn rải vốn vào các dự án đã qua Đánh giá sơ tuyển toàn diện trước khi giới thiệu ra công chúng.\n\n` +
               `🔹 <b>WHY (Tại sao nên đầu tư qua đây?):</b>\nTrích ra $50 không làm bạn nghèo đi, nhưng nó cho bạn tấm vé bước vào những thương vụ Mua sỉ (Vòng Private) trước đây vốn dĩ bị khóa chặt chỉ dành cho các Cá voi ôm $500.000.\n\n` +
               `🔹 <b>HOW (Cơ chế hoạt động):</b>\nMột tài khoản - Bốn khu vực pháp lý. Đầu tư thông qua bộ lọc pháp lý an toàn nhất thế giới mang tên SPV.`;
        keyboard = [
            [{ text: "⚖️ Giải Phẫu Bộ Lọc SPV (Tại sao bạn không bị lừa?)", callback_data: 'swcfield_spv' }],
            [{ text: "🏢 Dự Án ATLAS RWA (BĐS Số Hóa Dubai)", callback_data: 'swcfield_atlas' }],
            ...getGlobalButtons()
        ];
    }
    else if (data === 'swcfield_spv') {
        text = `⚖️ <b>BỘ LỌC CHỐNG FOMO & CẤU TRÚC PHÁP LÝ SPV</b>\n\n<i>"Tôi sợ bị lừa, sợ mất tiền vào các dự án rác ảo mộng?"</i>\n\n👉 Đây chính là câu trả lời cho sự an tâm (Peace of Mind) của bạn.\n\nChúng tôi làm phần việc nhàm chán nhất để bảo vệ bạn khỏi những quyết định đầu tư cảm xúc. Bạn không phải ngồi đoán xem dự án nào an toàn, dự án nào lừa đảo.\n\n<b>Quy trình SPV hoạt động như sau:</b>\nThay vì bạn mua một "cổ phần" mơ hồ, mỗi dự án trên SWC Field đều được đóng gói thành một <b>SPV (Special Purpose Vehicle - Phương tiện mục đích đặc biệt)</b>.\n\nBạn dùng tiền mua cổ phiếu của chính pháp nhân SPV đó. Điều này mang lại cho bạn cổ phần được công nhận hợp pháp, có giấy tờ đàng hoàng. \nTất cả giao dịch được thực hiện qua các nền tảng được quản lý nghiêm ngặt bởi luật pháp quốc tế. Tiền của bạn được bọc thép bảo vệ y hệt như cách giới siêu giàu đang làm!`;
        keyboard = getGlobalButtons();
    }
    else if (data === 'swcfield_atlas') {
        text = `🏢 <b>SIÊU DỰ ÁN ATLAS — BĐS SỐ HÓA DUBAI (RWA)</b>\n\nXu hướng của tương lai không phải là Crypto ảo, mà là <b>RWA (Real World Assets - Tài sản thực được số hóa)</b>.\n\nSở hữu và giao dịch <b>Bất động sản thực tế tại Dubai</b> chỉ bằng vài cú chạm trên điện thoại.\n\n🌟 <b>ĐIỂM NỔI BẬT KHÔNG THỂ BỎ QUA:</b>\n• <b>Thanh khoản 3 giây:</b> Phá vỡ sự chậm chạp, kẹt vốn của BĐS truyền thống. Bán là có tiền ngay.\n• <b>Pháp lý tối cao:</b> Pháp nhân Atlas Overseas FZE được cấp phép trực tiếp bởi Trung tâm Thương mại Dubai.\n• <b>Đầu tư chỉ từ $50:</b> Dân chủ hóa sân chơi của giới siêu giàu. Không cần cầm chục tỷ mới mua được nhà Dubai.\n• <b>Dòng tiền thật:</b> Tài sản tạo ra lợi nhuận cho thuê thực tế đổ về túi bạn hàng tháng.\n\n⚠️ <b>LƯU Ý KHẨN:</b> Vòng ưu đãi đóng cửa vào <b>${DEADLINE}</b>. Đừng để lỡ chuyến tàu giàu sang này!`;
        keyboard = getGlobalButtons();
    }

    // ==========================================
    // NHÁNH 4: FAQ (ĐẬP TAN RÀO CẢN TÂM LÝ)
    // ==========================================
    else if (data === 'menu_faq_main' || data === 'faq_back') {
        text = `❓ <b>GIẢI MÃ TÂM LÝ TỪ CHỐI (FAQ)</b>\n\nĐừng để sự nghi ngờ cướp đi tương lai của bạn. Hãy chọn một nỗi sợ bạn đang gặp phải để chúng tôi đập tan nó:`;
        keyboard = [
            [{ text: "1. Tôi chuyển tiền xong thì nhận được cái gì?", callback_data: 'faq_1' }],
            [{ text: "2. Tại sao không tự lên YouTube học cho đỡ tốn?", callback_data: 'faq_3' }],
            [{ text: "3. Tôi không có đủ $600 lúc này thì sao?", callback_data: 'faq_4' }],
            [{ text: "4. Thà tôi để tiền ở két/ngân hàng cho an toàn?", callback_data: 'faq_5' }],
            [{ text: "5. Các người có thu phí ẩn cắt cổ không?", callback_data: 'faq_6' }],
            [{ text: "🏠 Trở về Menu Chính", callback_data: 'main_menu' }]
        ];
    }
    else if (data === 'faq_1') {
        text = `✅ <b>Nhận được gì ngay sau khi thanh toán?</b>\n\nBạn nhận được quyền truy cập <b>đầy đủ và ngay lập tức</b> vào hệ sinh thái đặc quyền của SWC Field.\n\nTín hiệu chiến lược tháng đầu tiên sẽ hiển thị trong tài khoản của bạn <b>chỉ sau vài phút</b>. Bạn sẽ biết chính xác:\n- Mua mã cổ phiếu/tài sản nào?\n- Tỷ lệ phân bổ vốn bao nhiêu?\n- Mua ở mức giá nào an toàn nhất?\n\n<b>Không cần chờ đợi, không cần đi học cách vẽ biểu đồ, không cần phân tích báo cáo tài chính!</b> Cỗ máy đã dọn sẵn mâm, bạn chỉ việc ngồi vào bàn.`;
        keyboard = [[{ text: "🔙 Quay lại danh sách Câu hỏi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }
    else if (data === 'faq_3') {
        text = `✅ <b>Khác gì việc tự học kiến thức miễn phí trên YouTube?</b>\n\nKiến thức miễn phí trên mạng thì đầy rẫy — nhưng nếu chỉ "biết" mà giàu thì thế giới này ai cũng là triệu phú rồi.\n\nSự khác biệt của SWC Pass nằm ở chỗ nó cung cấp một <b>Hệ thống Kỷ luật ép bạn phải thực thi</b>, loại bỏ hoàn toàn cảm xúc cá nhân (Sợ hãi bán đáy & FOMO đu đỉnh).\n\nNó giống như việc bạn nằm nhà đọc sách "Dạy bơi cấp tốc" so với việc bạn <b>thực sự nhảy xuống hồ sâu với một Huấn luyện viên Olympic bơi lội kế bên kẹp cổ bạn kéo đi</b>. Bạn chọn cách nào để không chết đuối trong thị trường?`;
        keyboard = [[{ text: "🔙 Quay lại danh sách Câu hỏi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }
    else if (data === 'faq_4') {
        text = `✅ <b>Chưa có đủ $600 lúc này để mua Gói 5 năm thì sao?</b>\n\nHãy làm một phép toán đơn giản: $600 ÷ 5 năm = <b>$10/tháng</b> (Khoảng 250.000 VNĐ). \n\nMức giá này chỉ bằng đúng số tiền bạn ném qua cửa sổ cho 1 bát phở hoặc 1 tài khoản Netflix thỉnh thoảng mới xem mỗi tuần.\n\nViệc bạn trì hoãn với lý do "chờ có đủ tiền" đồng nghĩa với việc bạn đang <b>đánh mất hàng thập kỷ sức mạnh của Lãi kép</b>. Cái giá thực sự đắt đỏ không phải là $600 — mà là chi phí của sự bỏ lỡ cơ hội đổi đời vĩnh viễn!`;
        keyboard = [[{ text: "🔙 Quay lại danh sách Câu hỏi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }
    else if (data === 'faq_5') {
        text = `✅ <b>Thà giữ tiền mặt trong két hoặc ngân hàng cho an toàn?</b>\n\nThưa anh chị, đây là <b>ảo giác an toàn nguy hiểm nhất</b> của người nghèo.\n\nNgân hàng trung ương in tiền ra mỗi ngày. Nó tạo ra "Lạm phát" - một bóng ma <b>lặng lẽ móc túi bạn</b> mà không kêu một tiếng nào.\n\nGiữ tiền mặt dài hạn = <b>đảm bảo 100% bạn sẽ nghèo đi theo thời gian</b>. Giới tinh anh và siêu giàu không bao giờ tích trữ tiền mặt, họ luôn tìm cách mượn nợ và chuyển hóa nó thành Tài sản sinh lời. Đừng chết chìm trong sự "an toàn" giả tạo đó!`;
        keyboard = [[{ text: "🔙 Quay lại danh sách Câu hỏi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }
    else if (data === 'faq_6') {
        text = `✅ <b>KẺ HỦY DIỆT PHÍ ẨN</b>\n\n<i>"Tôi ghét bị ngân hàng và các quỹ cắn xén tiền lãi bằng các loại phí vô hình."</i>\n\nĐúng vậy! Nếu bạn đưa tiền ủy thác cho các quỹ truyền thống, họ sẽ cắt xén 1.5% đến 2% trên <b>TỔNG tài sản</b> của bạn mỗi năm. Khoản phí cắt cổ này sẽ cướp đi hàng tỷ đồng của bạn sau 15-20 năm.\n\nỞ SWC, chúng tôi chơi một trò chơi công bằng hơn rất nhiều: <b>Mô hình Thẻ Thành Viên (Membership)</b>. \nBạn chỉ trả đúng $10/tháng (nếu mua gói 5 năm). Dù tài sản của bạn trong tương lai có phình to lên thành 1 triệu đô la, mức phí bạn đóng vẫn chỉ là $10. \n<b>Chúng tôi không trừng phạt bạn vì bạn giàu lên!</b>`;
        keyboard = [[{ text: "🔙 Quay lại danh sách Câu hỏi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }

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
    if (!msg.from || msg.from.is_bot || msg.chat.type !== 'private') return;
    if (msg.contact || (msg.text && msg.text.startsWith('/'))) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // ADMIN TRẢ LỜI LẠI KHÁCH
    if (userId === ADMIN_ID && msg.reply_to_message) {
        const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
        const idMatch = originalText.match(/ID:\s*(\d+)/);
        if (idMatch) {
            const targetId = idMatch[1];
            bot.sendMessage(targetId, `👨‍💻 <b>Phản hồi từ Đội ngũ Chuyên gia SWC:</b>\n\n${msg.text || msg.caption}`, { parse_mode: 'HTML' }).catch(() => {});
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
            bot.sendMessage(ADMIN_ID, `📩 <b>TỆP TỪ KHÁCH HÀNG</b>\n👤 Khách: ${user.firstName}\n🆔 ID: <code>${userId}</code>\n💬 Ghi chú: ${msg.caption || 'Không có'}\n\n👉 <i>Reply tin này để chat trực tiếp (AI sẽ tự khóa).</i>`, { parse_mode: 'HTML' }).catch(()=>{});
        }

        const now = new Date();
        if (user.adminPausedAiUntil && user.adminPausedAiUntil > now) {
            bot.sendMessage(ADMIN_ID, `📩 <b>KHÁCH TRẢ LỜI (CHẾ ĐỘ ADMIN ĐANG BẬT)</b>\n👤 Tên: ${user.firstName}\n🆔 ID: <code>${userId}</code>\n💬 Nội dung: ${msg.text || '[Tệp]'}\n\n👉 <i>Reply để tiếp tục chat.</i>`, { parse_mode: 'HTML' }).catch(()=>{});
            return;
        }

        bot.sendChatAction(chatId, 'typing').catch(() => {});
        const userText = msg.text || msg.caption || '[Khách gửi tệp]';
        const aiReply = await callClaude(user, userText);
        bot.sendMessage(chatId, aiReply, { parse_mode: 'HTML' }).catch(() => {});

        if (['interested', 'hot_lead', 'converted'].includes(user.funnelStage)) {
            const alertMsg = `🔥 <b>HOT LEAD ĐANG CHAT VỚI AI</b>\n👤 Tên: <b>${user.firstName}</b>\n🆔 ID: <code>${userId}</code>\n\n💬 <b>Khách:</b> ${userText}\n🤖 <b>Tí:</b> ${aiReply}\n\n👉 <i>Reply tin này để cướp quyền chat.</i>`;
            bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML' }).catch(() => {});
        }
    }
});

// ==========================================
// BROADCAST TỰ ĐỘNG THEO LỊCH 
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

setInterval(async () => {
    const vnTime = getVNTime();
    const h = vnTime.getUTCHours();
    const m = vnTime.getUTCMinutes();
    const daysLeft = getDaysLeft();

    if (h === 8 && m === 0) {
        const msg = `🌅 <b>CHÀO BUỔI SÁNG — THỊ TRƯỜNG HÔM NAY NÓI GÌ?</b>\n\nĐa số NĐT F0 đang lo lắng không biết hôm nay thị trường đi đâu...\nThành viên SWC đã có kế hoạch từ đầu tháng. Không cần đoán mò.\n\n💡 <b>Sự thật tàn nhẫn:</b> 95% người tự trade thua lỗ không phải vì thiếu thông tin — mà vì <b>thiếu hệ thống kỷ luật</b>.\n\n⏳ Đừng để mất thời gian nữa! Còn <b>${daysLeft} ngày</b> để gia nhập hệ thống trước khi cửa đóng.`;
        await broadcastToAll(msg, { reply_markup: { inline_keyboard: [NÚT_ĐĂNG_KÝ_SỰ_KIỆN] } });
    }

    if (h === 12 && m === 0) {
        const tips = [
            `💡 <b>KIẾN THỨC TÀI CHÍNH TỪ SÓI GIÀ:</b>\n\n<b>5 Tầng chuỗi thức ăn tài chính:</b>\n1. Chính phủ\n2. Cá voi (Quỹ lớn)\n3. Đội lái\n4. Sói già\n5. F0 (Làm thanh khoản cho 4 tầng trên)\n\n⏳ Bạn đang đứng ở đâu? Mua SWC Pass ngay để <b>nhảy thẳng lên Tầng 2</b>. Còn ${daysLeft} ngày!`,
            `💡 <b>KIẾN THỨC TÀI CHÍNH TỪ SÓI GIÀ:</b>\n\n<b>Lãi kép — Kỳ quan thứ 8</b>\n$240/tháng × 15 năm × lãi kép 20%/năm = <b>$1,000,000+</b>\nBí quyết là <b>bắt đầu SỚM và kỷ luật ĐỀU ĐẶN</b>. Đừng đánh bạc với thời gian. Còn ${daysLeft} ngày!`
        ];
        await broadcastToAll(tips[Math.floor(Math.random() * tips.length)], { reply_markup: { inline_keyboard: [[{ text: `💎 Xem Ngay Các Gói SWC Pass`, callback_data: 'menu_swcpass_main' }]] } });
    }

    if (h === 19 && m === 30) {
        const msg = `📚 <b>THỜI GIAN CẬP NHẬT KIẾN THỨC ĐỂ BẢO VỆ TÀI SẢN!</b>\n\nVào Group cộng đồng ngay để:\n✅ Cập nhật tiến độ dự án ATLAS Dubai (RWA)\n✅ Thảo luận chiến lược đầu tư Lãi Kép\n✅ Kết nối 1.000+ nhà đầu tư tinh hoa\n\n⏳ Giữ chặt ví tiền! Còn <b>${daysLeft} ngày</b> để mua vị thế tốt nhất!`;
        await broadcastToAll(msg, { reply_markup: { inline_keyboard: [ [{ text: "💬 Vào Group Định Hướng Ngay", url: `https://t.me/${GROUP_USERNAME.replace('@', '')}` }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN ] } });
    }
}, 60000);

// ==========================================
// ADMIN COMMANDS (LỆNH QUẢN TRỊ)
// ==========================================
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id, `👨‍💻 <b>ADMIN PANEL — SWC BOT (MA TRẬN CHỐT SALE)</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "📊 Thống kê Phễu Khách Hàng", callback_data: 'admin_stats' }], [{ text: "📢 Bảng lệnh Quản trị", callback_data: 'admin_help' }]] } });
});

bot.on('callback_query', async (query) => {
    if(query.data === 'admin_stats' && query.from.id.toString() === ADMIN_ID) {
        const total = await User.countDocuments(); const newbie = await User.countDocuments({ tag: 'newbie' }); const experienced = await User.countDocuments({ tag: 'experienced' }); const vip = await User.countDocuments({ tag: 'vip_pass' }); const atlas = await User.countDocuments({ tag: 'atlas_investor' }); const interested = await User.countDocuments({ funnelStage: 'interested' }); const hotLead = await User.countDocuments({ funnelStage: 'hot_lead' }); const converted = await User.countDocuments({ funnelStage: 'converted' });
        const report = `📊 <b>THỐNG KÊ SWC BOT</b>\n\n👥 <b>Tổng users:</b> ${total}\n⏳ <b>Còn lại:</b> ${getDaysLeft()} ngày\n\n<b>Phân loại:</b>\n• F0: ${newbie} | Có KN: ${experienced}\n• VIP Pass: ${vip} | ATLAS: ${atlas}\n\n<b>Tiến trình Phễu:</b>\n• Interested (Đang tìm hiểu): ${interested}\n• Hot Lead (Sắp chốt): ${hotLead}\n• Converted (Đã chốt): ${converted}`;
        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    }
    if(query.data === 'admin_help' && query.from.id.toString() === ADMIN_ID) {
        bot.sendMessage(ADMIN_ID, `📢 <b>LỆNH ADMIN BẰNG TAY:</b>\n\n1. <code>/tracuu [ID]</code>: Xem thông tin 1 khách.\n2. <code>/addnote [ID] [Note]</code>: Ghi chú lịch sử khách.\n3. <code>/setpass [ID] [Gói]</code>: Kích hoạt gói cho khách (none/essential/plus/ultimate).\n4. <code>/sendall [Text]</code>: Bắn tin nhắn cho Toàn hệ thống.\n5. <code>/sendgroup [Text]</code>: Gửi tin lên Group.\n6. <code>/export</code>: Lấy danh sách Hot Lead để gọi điện chốt sale.`, { parse_mode: 'HTML' });
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
    bot.sendMessage(ADMIN_ID, `✅ Đã Kích hoạt Gói: <b>${tier}</b> cho khách ${match[1]}`, { parse_mode: 'HTML' });
});

// LỆNH GỬI TIN NHẮN CHO TẤT CẢ MỌI NGƯỜI (SENDALL)
bot.onText(/\/sendall ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const textToSend = match[1];
    const users = await User.find({});
    
    bot.sendMessage(ADMIN_ID, `⏳ Bắt đầu chiến dịch gửi tin nhắn hàng loạt cho ${users.length} người...`);
    let success = 0;
    
    for (const u of users) {
        try { 
            await bot.sendMessage(u.userId, textToSend, { 
                parse_mode: 'HTML', 
                reply_markup: { inline_keyboard: getGlobalButtons() } 
            }); 
            success++; 
        } catch (e) {
            // Có thể khách đã chặn (Block) bot
        }
        await new Promise(r => setTimeout(r, 50)); // Chống spam Rate Limit của Telegram
    }
    bot.sendMessage(ADMIN_ID, `✅ Chiến dịch hoàn tất! Đã gửi thành công: ${success}/${users.length} khách hàng.`);
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
    console.log("🚀 MA TRẬN CHỐT SALE MASTER ĐÃ KÍCH HOẠT THÀNH CÔNG!");
});
