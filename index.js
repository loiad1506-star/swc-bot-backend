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

// --- DANH SÁCH LINK HÌNH ẢNH CỦA ANH LỢI ---
const IMG_MAIN_MENU = 'https://photos.app.goo.gl/6SC4mNCBawpMfMgj6'; 
const IMG_SWCPASS = 'https://photos.app.goo.gl/cbECmeni7rhuBAst5';   
const IMG_MEMBERSHIP = 'https://photos.app.goo.gl/yZU4FjisXcrQVMuf7';
const IMG_ROAD1M = 'https://photos.app.goo.gl/Ca3xJzrWPaxzLSur7';    
const IMG_FIELD_ROAD1M = 'https://photos.app.goo.gl/pcfu5PUhz8Xs61kt7';
const IMG_SWCFIELD = 'https://gemini.google.com/share/a25e35f76a97';   
const IMG_ATLAS = 'https://gemini.google.com/share/382a3080a6eb';
const IMG_FIELD_SAFE = 'https://photos.app.goo.gl/9nub7vRX5h9buGwr8';
const IMG_MOBILE_REG = 'https://vidiq-video-thumbnails.s3.us-east-1.amazonaws.com/SEB7RJrutxg/f13f936f-c938-4c9e-8811-37ab7b419caa.jpg';

function getDaysLeft() {
    const deadline = new Date('2026-03-31T23:59:00+07:00');
    const now = new Date();
    const diff = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
}

// KHỐI NÚT BẤM TOÀN CỤC (LUÔN BÁM THEO KHÁCH HÀNG)
function getGlobalButtons() {
    return [
        [{ text: `🚨 NHẬN THƯỞNG TỪ SỰ KIỆN (CÒN ${getDaysLeft()} NGÀY)`, url: ACTIVATE_URL }],
        [{ text: "💎 KÍCH HOẠT SWC PASS", url: SWC_PASS_WEB }],
        [{ text: "📱 Hướng dẫn Kích hoạt SWC Field (MOBILE)", url: VIDEO_MOBILE }],
        [{ text: "💻 Hướng dẫn Kích hoạt SWC Field (PC)", url: VIDEO_PC }],
        [{ text: "💬 Vào Nhóm Chat Định Hướng", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }],
        [{ text: "🏠 Trở về Menu Chính", callback_data: 'main_menu' }]
    ];
}

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
    adminPausedAiUntil: { type: Date, default: null }, 
    chatHistory: { type: Array, default: [] }
});

const User = mongoose.model('User', userSchema);

// ==========================================
// SYSTEM PROMPT BÁCH KHOA TOÀN THƯ (AI CLAUDE)
// ==========================================
function buildSystemPrompt(user) {
    const daysLeft = getDaysLeft();
    return `Bạn là "Tí" — trợ lý AI phân tích tâm lý và tư vấn tài chính của quỹ Sky World Community Viet Nam, dưới quyền anh Hồ Văn Lợi.
TÍNH CÁCH: Thấu hiểu nhân tính, sắc bén, như một Sói già Phố Wall. Dùng ví dụ đời thực, kể chuyện, không dùng văn mẫu khô khan. Xưng "em" hoặc "Tí", gọi khách là "anh/chị".

NHIỆM VỤ:
1. Gỡ bỏ tâm lý phòng thủ của F0. Khai sáng cho họ thấy tự trade là tự sát (chuỗi thức ăn tài chính).
2. Chốt sale thẻ SWC Pass trước deadline ${DEADLINE} (CÒN ${daysLeft} NGÀY). Khuyên mạnh Gói Plus 5 năm ($600) và Ultimate Vĩnh viễn ($2600).
3. Hướng khách xem Video hướng dẫn và vào Group Chat.

THÔNG TIN KHÁCH: Tên: ${user.firstName} ${user.lastName} | Gói Pass: ${user.swcPassTier}

KIẾN THỨC CỐT LÕI ĐỂ TƯ VẤN:
- BỘ LỌC CHỐNG FOMO (SWC FIELD): Đầu tư vòng Private an toàn qua SPV. ATLAS RWA Dubai (BĐS Số hóa thanh khoản 3s).
- KẺ HỦY DIỆT PHÍ ẨN: Quỹ khác thu 2% tài sản mỗi năm. SWC Pass thu phí Membership cố định ($10/tháng cho gói 5 năm).
- LÃI KÉP (Road to $1M): Đầu tư $8/ngày ($240/tháng), kỷ luật 15 năm = $1,000,000. Dành 10 phút/tháng thao tác. Tiền ai nấy giữ.

QUY TẮC:
- Luôn kết thúc bằng 1 câu hỏi mở nhắm vào nỗi đau. KHÔNG nhắc Token, SWGT.`;
}

async function callClaude(user, userMessage) {
    try {
        let history = user.chatHistory || [];
        history.push({ role: 'user', content: userMessage });

        let validHistory = [];
        for (let msg of history) {
            if (validHistory.length === 0) {
                if (msg.role === 'user') validHistory.push({ role: msg.role, content: msg.content });
                continue;
            }
            let lastMsg = validHistory[validHistory.length - 1];
            if (lastMsg.role === msg.role) {
                lastMsg.content += '\n' + msg.content; 
            } else {
                validHistory.push({ role: msg.role, content: msg.content });
            }
        }
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
// HÀM GỬI MAIN MENU (CÓ ẢNH VÀ FALLBACK CHỐNG LỖI)
// ==========================================
async function sendMainMenu(chatId, messageId = null) {
    const daysLeft = getDaysLeft();
    const text = `🦁 <b>CỔNG ĐẦU TƯ TRÍ TUỆ SWC CAPITAL</b>\n\nThị trường tài chính là một chiến trường khốc liệt. Ở đây, tiền không tự sinh ra mà chỉ chuyển từ túi của những người yếu bóng vía, thiếu kỷ luật sang túi của những bộ óc có hệ thống chiến lược bài bản.\n\n⏳ <b>CẢNH BÁO TỬ HUYỆT:</b> Đặc quyền đăng ký gói thành viên Ultimate (Vĩnh viễn) để truy cập hệ thống đầu tư của giới tinh anh sẽ chính thức <b>ĐÓNG CỬA VĨNH VIỄN</b> vào lúc 23:59 ngày <b>${DEADLINE}</b>. Chỉ còn đúng ${daysLeft} ngày nữa để bạn tự cứu lấy tương lai tài chính của gia tộc mình.\n\n👇 <b>HÃY CHỌN MỘT DANH MỤC DƯỚI ĐÂY ĐỂ BẮT ĐẦU:</b>`;

    const keyboard = {
        inline_keyboard: [
            [{ text: "🇻🇳 Đổi Tiếng Việt (Dành cho người mới)", url: "https://t.me/setlanguage/vi" }],
            [{ text: "💳 GIẢI MÃ BÍ MẬT THẺ SWC PASS", callback_data: 'menu_swcpass_main' }],
            [{ text: "🏢 SWC FIELD & SIÊU DỰ ÁN ATLAS", callback_data: 'menu_swcfield_main' }],
            [{ text: "🗺️ ROAD TO $1M (Bản đồ Lãi kép)", callback_data: 'menu_road1m_main' }],
            [{ text: "❓ HỎI ĐÁP ĐẦU TƯ (Phá vỡ rào cản)", callback_data: 'menu_faq_main' }],
            ...getGlobalButtons().slice(0, -1) 
        ]
    };

    if (messageId) bot.deleteMessage(chatId, messageId).catch(() => {});
    
    bot.sendPhoto(chatId, IMG_MAIN_MENU, { caption: text, parse_mode: 'HTML', reply_markup: keyboard }).catch(() => {
        // Fallback: Nếu link ảnh Google Photos bị Telegram chặn, gửi text thường để không sập bot
        bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
    });
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

    let text = ''; let keyboard = []; let imageUrl = '';
    bot.answerCallbackQuery(callbackQuery.id).catch(() => {});

    if (data === 'main_menu') {
        return sendMainMenu(chatId, messageId);
    }

    // ==========================================
    // NHÁNH 1: SWC PASS 
    // ==========================================
    if (data === 'menu_swcpass_main') {
        imageUrl = IMG_SWCPASS;
        text = `💎 <b>BÍ MẬT CỦA TẤM THẺ SWC PASS</b>\n\nHãy tưởng tượng bạn muốn bơi qua một dòng sông chảy xiết. Tự bơi, bạn có thể đuối sức và chìm nghỉm. Nhưng nếu bạn thuê được một chiếc du thuyền siêu tốc có thuyền trưởng dày dạn kinh nghiệm, bạn chỉ việc bước lên tàu và tận hưởng hành trình.\n\nSWC Pass không phải là một khóa học làm giàu hay hội nhóm hô hào phím lệnh. Nó chính là "Chiếc du thuyền" đó. Nó là một <b>Tư cách thành viên (Membership)</b> bảo chứng cho việc bạn được bước chân vào thế giới đầu tư của giới tinh anh.\n\nThông qua SWC Pass, bạn thoát khỏi kiếp làm "nhỏ lẻ F0", được quyền mua gom tài sản chất lượng cao từ sớm (vòng Private) và được thiết lập một kỷ luật đầu tư sắc lạnh mà không bị cảm xúc chi phối.`;
        keyboard = [
            [{ text: "⚖️ Phân Tích 3 Gói Thẻ: Chọn Bát Phở hay Di Sản?", callback_data: 'swcpass_compare' }],
            [{ text: "🎁 4 Đặc Quyền Kẻ Hủy Diệt Phí Ẩn", callback_data: 'swcpass_benefits' }],
            ...getGlobalButtons()
        ];
    }
    else if (data === 'swcpass_compare') {
        imageUrl = IMG_MEMBERSHIP;
        text = `⚖️ <b>BẢNG GIÁ SWC PASS - BẠN CHỌN VỊ THẾ NÀO?</b>\n\nQuyết định hôm nay sẽ định hình khối tài sản của bạn trong 15 năm tới:\n\n1️⃣ <b>Gói Essential (1 Năm - $240): "Cà Phê Trải Nghiệm"</b>\nBạn chưa tin tưởng? Gói này dành cho bạn. Chia ra chỉ $20/tháng – bằng đúng tiền một chầu cà phê cuối tuần. Nhưng thay vì uống xong là hết, $20 này giúp bạn thuê được cả một đội ngũ chuyên gia Mỹ phân tích thị trường. Đây là mức 'học phí' rẻ mạt nhất để tránh việc bạn tự trade sai, đu đỉnh và cháy hàng trăm triệu.\n\n2️⃣ <b>Gói Plus (5 Năm - $600): "Kỷ Luật Thép" [🔥 KHUYÊN DÙNG]</b>\nTrồng cây thì không thể hái quả trong vài tháng. Lãi Kép cần có thời gian. Gói 5 năm sẽ cưa đôi chi phí của bạn, chỉ còn <b>$10/tháng</b> (Bằng bát phở mỗi tuần). Bạn mua quyền truy cập danh mục giới siêu giàu và bị 'ép' vào kỷ luật thép. Mọi công cụ AI mới ra mắt sau này, bạn đều được dùng miễn phí.\n\n3️⃣ <b>Gói Ultimate (Vĩnh Viễn - $2.600): "Di Sản Gia Tộc"</b>\nNếu bạn là người kinh doanh, nhìn xa trông rộng. Đầu tư 20 năm thì mỗi năm chỉ tốn $130. Bạn mua ĐỨT nền tảng tài chính này để làm bệ phóng, làm di sản cho con cái.\n\n⚠️ <b>CÚ CHỐT HẠ:</b> Gói Ultimate là phiên bản chào sân. Nó SẼ ĐÓNG CỬA VĨNH VIỄN vào ngày ${DEADLINE} (Chỉ còn ${daysLeft} ngày). Qua ngày này, mang $10.000 đến cũng không thể mua đứt được nữa!`;
        keyboard = getGlobalButtons();
    }
    else if (data === 'swcpass_benefits') {
        imageUrl = IMG_SWCPASS;
        text = `🎁 <b>KẺ HỦY DIỆT PHÍ ẨN VÀ 4 ĐẶC QUYỀN TỐI THƯỢNG</b>\n\nCác quỹ mở ngoài kia thường có một "chiêu bẩn": Họ cắn xén 2% trên TỔNG tài sản của bạn mỗi năm. Tức là bạn có 1 tỷ, bạn mất 20 triệu. Nếu bạn có 10 tỷ, bạn mất đứt 200 triệu tiền phí quản lý. Với SWC Pass, chúng tôi chơi sòng phẳng. Bạn chỉ trả đúng $10/tháng. Bạn có kiếm được triệu đô, chúng tôi cũng không trừng phạt bạn bằng cách thu thêm tiền!\n\n<b>NHỮNG ĐẶC QUYỀN BẠN NẮM TRONG TAY:</b>\n<b>1. Cỗ Máy Toán Học "Road to $1M":</b> Nhận bản đồ chi tiết hàng tháng. Mua mã nào, mua bao nhiêu. Không cần phân tích nến, không cần căng mắt nhìn màn hình.\n\n<b>2. Tiền Ai Nấy Giữ:</b> SWC Pass KHÔNG GIỮ TIỀN của bạn. Bạn mở app chứng khoán cá nhân, tự tay thao tác trong 10 phút rồi tắt máy. An toàn 100%.\n\n<b>3. Sân Chơi Của Cá Mập:</b> Khởi điểm đầu tư vòng Private chỉ từ $50, đập tan rào cản $500.000 của giới tài phiệt.\n\n<b>4. Dòng Tiền Thụ Động Vĩnh Cửu:</b> Dành cho người làm hệ thống. Khi đối tác của bạn gia hạn Pass hàng năm, tiền hoa hồng sẽ đổ về túi bạn đều đặn mà không cần tốn sức chốt sale lại.`;
        keyboard = [[{ text: "⚖️ Xem Lại Phân Tích 3 Gói Pass", callback_data: 'swcpass_compare' }], ...getGlobalButtons()];
    }

    // ==========================================
    // NHÁNH 2: ROAD TO $1M 
    // ==========================================
    else if (data === 'menu_road1m_main') {
        imageUrl = IMG_ROAD1M;
        text = `🗺️ <b>HÀNH TRÌNH ROAD TO $1M (BẢN ĐỒ TRIỆU ĐÔ)</b>\n\nHãy nhớ lại, đã bao nhiêu lần bạn dễ dàng vung 200.000 VNĐ cho một bữa ăn nhậu, một chiếc áo mới mà không hề mảy may suy nghĩ? \n\nChuyện gì sẽ xảy ra nếu bạn có tính kỷ luật, tự động trích ra đúng số tiền đó: <b>$8/ngày (khoảng $240/tháng)</b>, ném nó vào một cỗ máy sinh lời đã được tinh chỉnh hoàn hảo, và để mặc cho "Kỳ quan thứ 8" là Lãi Kép tự do phát huy sức mạnh?\n\nTrong 15 năm, con số đó sẽ cán mốc <b>1 Triệu Đô La</b>. \n\nNó không phải là phép thuật hay trúng số. Nó chỉ là Toán học cơ bản kết hợp với Thời gian và Sự Kỷ luật Vô Cảm. Nhưng để làm được, bạn cần một Hệ thống chỉ đường.`;
        keyboard = [
            [{ text: "🎯 Lợi Ích Thực Chiến (Sự Thật Đằng Sau Kỷ Luật)", callback_data: 'road1m_benefits' }],
            [{ text: "🦈 Tại Sao 95% F0 Sắp Chết? (Chuỗi Thức Ăn)", callback_data: 'road1m_foodchain' }],
            ...getGlobalButtons()
        ];
    }
    else if (data === 'road1m_benefits') {
        imageUrl = IMG_FIELD_ROAD1M;
        text = `🔥 <b>LỢI ÍCH THỰC CHIẾN: CHÚNG TÔI KHÔNG BÁN GIẤC MƠ, CHÚNG TÔI BÁN SỰ GIẢI THOÁT</b>\n\nNhiều người nghĩ đầu tư là để khoe khoang con số trong tài khoản. Sai lầm!\n\n• <b>Vị Thế Của Dòng Tiền:</b> Mục tiêu thực sự của Road to $1M là tạo ra <i>Dòng tiền Cổ tức Thụ Động</i>. Khi tiền cổ tức sinh ra mỗi tháng lớn hơn số tiền gia đình bạn chi tiêu sinh hoạt, đó là khoảnh khắc bạn chính thức "Nghỉ hưu" và tự do, bất kể bạn đang 30 hay 50 tuổi.\n\n• <b>Triệt Tiêu Cảm Xúc Hoảng Loạn:</b> Kẻ thù lớn nhất cướp tiền của bạn không phải đội lái, mà là tâm lý Sợ hãi của chính bạn. Khi thị trường đỏ máu, sập 30%, người bình thường sẽ khóc lóc cắt lỗ. Nhưng hệ thống DCA của chúng tôi sẽ báo tín hiệu lạnh lùng: "Cơ hội ngàn năm có một, gom mạnh tài sản giá rẻ!". Bạn thao tác như một cỗ máy, đó là cách người giàu thâu tóm tài sản của người nghèo.\n\n• <b>Tiết Kiệm 10.000 Giờ Máu Và Nước Mắt:</b> Đừng lãng phí tuổi trẻ để cố gắng đọc hiểu báo cáo tài chính hay canh biểu đồ nến xanh đỏ. Bạn có gia đình, có chuyên môn riêng. Chuyên gia SWC đã phân tích sẵn mâm cỗ. Bạn chỉ cần tốn đúng 10 phút mỗi tháng để copy và xác nhận.`;
        keyboard = [[{ text: "🔙 Quay Lại Lộ Trình", callback_data: 'menu_road1m_main' }], ...getGlobalButtons()];
    }
    else if (data === 'road1m_foodchain') {
        imageUrl = IMG_ROAD1M;
        text = `🔱 <b>5 TẦNG CHUỖI THỨC ĂN: SỰ THẬT TÀN NHẪN CỦA THỊ TRƯỜNG</b>\n\nBạn không nghèo đi vì bạn thiếu thông tin. Bạn nghèo vì bạn ngây thơ bước vào sòng bài và chơi bằng bộ luật do kẻ khác viết ra.\n\n<b>Tầng 1 — 🏛️ Đấng Sáng Tạo (Chính Phủ & NHTW):</b> Người in tiền, người thắt chặt lãi suất. Họ không cần trade, họ điều khiển toàn bộ dòng chảy của đại dương.\n\n<b>Tầng 2 — 🐋 Cá Voi (Các Quỹ Đầu Tư Tài Phiệt):</b> Chúng có hàng tỷ đô la. Chúng đi ngược đám đông. Chúng âm thầm gom mua dưới đáy khi bạn hoảng loạn bán ra, và chúng xả hàng ngập đầu khi bạn đang hưng phấn tột độ đu đỉnh.\n\n<b>Tầng 3 — 🎰 Đội Lái (Market Maker):</b> Những kẻ cố tình vẽ biểu đồ, tạo ra những cây nến đỏ cắm thẳng đứng lúc 2 giờ sáng để rũ bỏ những kẻ yếu bóng vía.\n\n<b>Tầng 4 — 🐺 Sói Già:</b> Những tay Trader sống sót bằng kỷ luật thép, chốt lời cắt lỗ không cảm xúc. Nhưng số này cực kỳ hiếm hoi.\n\n<b>Tầng 5 — 😵 F0 (Sinh Vật Phù Du):</b> Chính là Đám đông. Mua bằng lỗ tai nghe phím hàng, bán bằng cảm giác sợ hãi. Đây chính là mỏ thanh khoản dồi dào nuôi sống 4 tầng trên. 95% những kẻ tự trade đều đang chìm ở đáy đại dương này.\n\n💥 <b>NHẬN RA ĐIỀU GÌ CHƯA? Tự trade là tự sát.</b> SWC Pass là chiếc cần cẩu kéo bạn ra khỏi vũng lầy Tầng 5, đặt bạn ngồi lên lưng của Cá Voi (Tầng 2) để cùng săn mồi!`;
        keyboard = [[{ text: "🔙 Quay Lại", callback_data: 'menu_road1m_main' }], ...getGlobalButtons()];
    }

    // ==========================================
    // NHÁNH 3: SWC FIELD & ATLAS 
    // ==========================================
    else if (data === 'menu_swcfield_main') {
        imageUrl = IMG_SWCFIELD;
        text = `🏢 <b>SWC FIELD & QUYỀN LỰC CỦA KẺ THÁCH THỨC</b>\n\nTheo lẽ thường, để mua được cổ phần của một dự án công nghệ hoặc bất động sản ở "Giá Sỉ" (vòng Private) trước khi chúng được bơm thổi lên sàn, bạn phải chứng minh mình là nhà đầu tư chuyên nghiệp và có trong tay ít nhất 500.000 Đô La.\n\nNhưng <b>SWC Field</b> ra đời để phá vỡ đặc quyền đó. Nền tảng Showcase này gỡ bỏ rào cản, cho phép bạn được rót vốn, chia phần chiếc bánh béo bở đó chỉ với số vốn từ $50.\n\n$50 không làm bạn nghèo đi, nhưng nó cấp cho bạn một tấm vé bước vào sân chơi của giới tinh hoa.`;
        keyboard = [
            [{ text: "⚖️ Bộ Lọc SPV (Lá Chắn Chống Lừa Đảo)", callback_data: 'swcfield_spv' }],
            [{ text: "🏢 Dự Án ATLAS (Sở Hữu BĐS Dubai Trong 3 Giây)", callback_data: 'swcfield_atlas' }],
            [{ text: "🌐 Khám phá Website SWC Field", url: SWC_FIELD_WEB }],
            ...getGlobalButtons()
        ];
    }
    else if (data === 'swcfield_spv') {
        imageUrl = IMG_FIELD_SAFE;
        text = `⚖️ <b>BỘ LỌC CHỐNG FOMO & ÁO GIÁP PHÁP LÝ SPV</b>\n\n<i>"Nhưng ngộ nhỡ dự án sập thì sao? Sợ lừa đảo lắm!"</i>\n\nĐó là một nỗi sợ hoàn toàn chính đáng. Và đó là lý do SWC Field không bao giờ bán cho bạn những "Cổ phần trừu tượng" hay những đồng Coin rác bơm thổi.\n\nMỗi một dự án xuất hiện trên SWC Field đều phải vượt qua bài kiểm tra Sinh tử của Đội ngũ thẩm định. Sau đó, nó được đóng gói cẩn thận vào một <b>SPV (Special Purpose Vehicle - Pháp nhân mục đích đặc biệt)</b>.\n\nKhi bạn xuống tiền, bạn đang mua <b>Cổ phiếu hợp pháp</b> của chính SPV đó, được bảo chứng bởi hệ thống luật pháp khắt khe của Mỹ, Liên Minh Châu Âu hoặc Nga. Tiền của bạn không bay vào hư không, nó được khóa trong một lớp áo giáp pháp lý y hệt như cách các tỷ phú bảo vệ tài sản của họ!`;
        keyboard = [[{ text: "🔙 Quay lại SWC Field", callback_data: 'menu_swcfield_main' }], ...getGlobalButtons()];
    }
    else if (data === 'swcfield_atlas') {
        imageUrl = IMG_ATLAS;
        text = `🏢 <b>SIÊU DỰ ÁN ATLAS — SỰ TIẾN HÓA CỦA BẤT ĐỘNG SẢN DUBAI (RWA)</b>\n\nBạn nghĩ rằng đầu tư Bất động sản là phải có vài chục tỷ đồng, mua một cục gạch rồi chôn vốn ở đó 5-10 năm không rút ra được? Quên đi, đó là tư duy của thập kỷ trước.\n\nXu hướng thâu tóm tài sản của tương lai gọi tên <b>RWA (Real World Assets - Tài sản thực được số hóa)</b>. Siêu dự án ATLAS biến những tòa tháp chọc trời tại Dubai thành những phần tài sản số hóa.\n\n🌟 <b>SỰ ĐỘT PHÁ TÀN NHẪN:</b>\n• <b>Thanh khoản trong 3 giây:</b> Đập tan sự kẹt vốn của BĐS truyền thống. Cần tiền? Bấm bán, tiền về ví. Nhanh như chớp.\n• <b>Bảo chứng quyền lực:</b> Được pháp nhân Atlas Overseas FZE (Cấp phép bởi chính phủ Dubai) đứng ra bảo lãnh.\n• <b>Khởi điểm chỉ từ $50:</b> Bạn, với số vốn của một người bình thường, giờ đây có thể sở hữu BĐS trung tâm Dubai và nhận <b>Tiền thuê nhà thật</b> chảy về ví mỗi tháng.\n\n⚠️ <b>LỜI CẢNH BÁO TỬ HUYỆT:</b> Vòng ưu đãi Mua sỉ Private của dự án ATLAS sẽ đóng cửa không thương tiếc vào <b>${DEADLINE}</b>. Đừng để lỡ chuyến tàu tạo ra gia sản này!`;
        keyboard = [[{ text: "🔙 Quay lại SWC Field", callback_data: 'menu_swcfield_main' }], ...getGlobalButtons()];
    }

    // ==========================================
    // NHÁNH 4: FAQ (ĐẬP TAN RÀO CẢN TÂM LÝ)
    // ==========================================
    else if (data === 'menu_faq_main' || data === 'faq_back') {
        imageUrl = IMG_FAQ;
        text = `❓ <b>GIẢI MÃ TÂM LÝ TỪ CHỐI (FAQ)</b>\n\nGiữa việc "Bắt tay vào hành động" và "Tiếp tục đứng nhìn", con người luôn tự bịa ra những lý do để biện minh cho sự chần chừ của mình. \n\nĐừng để sự nghi ngờ cướp đi tương lai của bạn. Hãy chọn một nỗi sợ bạn đang gặp phải để chúng tôi đập tan nó:`;
        keyboard = [
            [{ text: "1. Tôi chuyển tiền mua Pass xong thì nhận được cái gì?", callback_data: 'faq_1' }],
            [{ text: "2. Tại sao tôi không tự lên YouTube học cho đỡ tốn tiền?", callback_data: 'faq_3' }],
            [{ text: "3. Tôi không có đủ $600 lúc này thì tính sao?", callback_data: 'faq_4' }],
            [{ text: "4. Thà tôi để tiền ở két hoặc ngân hàng cho an toàn?", callback_data: 'faq_5' }],
            [{ text: "🏠 Trở về Menu Chính", callback_data: 'main_menu' }]
        ];
    }
    else if (data === 'faq_1') {
        imageUrl = IMG_FAQ;
        text = `✅ <b>Chuyển tiền mua Pass xong, bạn nhận được gì?</b>\n\nBạn không mua một lời hứa. Bạn mua một <b>Kết quả ngay lập tức</b>.\n\nNgay khi kích hoạt thành công thẻ SWC Pass, chiếc bịt mắt của bạn sẽ được tháo xuống. Tín hiệu chiến lược của tháng đầu tiên sẽ hiển thị ngay trong màn hình hệ thống chỉ sau vài phút.\n\nBạn sẽ được hệ thống chỉ điểm cực kỳ chính xác:\n👉 Cần mua mã cổ phiếu/tài sản nào?\n👉 Rót bao nhiêu % vốn vào đó?\n👉 Vùng giá an toàn nhất để mua là bao nhiêu?\n\nBạn không cần tốn thời gian đi học cách vẽ biểu đồ nến, cũng chẳng cần hiểu báo cáo tài chính là gì. Chuyên gia đã nấu cỗ sẵn, việc của bạn chỉ là cầm đũa lên và ăn!`;
        keyboard = [[{ text: "🔙 Quay lại Danh sách Câu hỏi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }
    else if (data === 'faq_3') {
        imageUrl = IMG_FAQ;
        text = `✅ <b>Tại sao không tự học kiến thức miễn phí trên YouTube?</b>\n\nKiến thức miễn phí trên mạng thì nhiều như rác. Nhưng nếu chỉ cần "Biết kiến thức" mà giàu, thì thế giới này ai cũng là triệu phú đô la cả rồi.\n\nSự khác biệt sinh tử của SWC Pass nằm ở chỗ: Nó cung cấp một <b>Hệ Thống Kỷ Luật ép bạn phải thực thi</b>. Nó trói tay bạn lại, ngăn không cho cảm xúc cá nhân xen vào, xóa sổ lòng tham đu đỉnh và sự sợ hãi bán tháo dưới đáy.\n\nViệc tự học trên mạng giống như bạn nằm trên giường êm nệm ấm đọc cuốn sách "Dạy bơi cấp tốc". Còn SWC Pass là việc bạn <b>thực sự nhảy xuống hồ nước sâu với một Huấn luyện viên Olympic bơi lội kế bên kẹp cổ kéo bạn đi đúng hướng</b>. Bạn chọn cách nào để không bị chết đuối trong thị trường này?`;
        keyboard = [[{ text: "🔙 Quay lại Danh sách Câu hỏi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }
    else if (data === 'faq_4') {
        imageUrl = IMG_FAQ;
        text = `✅ <b>Bạn chưa có đủ $600 lúc này để mua Gói 5 năm?</b>\n\nHãy làm một phép toán của kẻ tỉnh táo: $600 ÷ 5 năm = <b>Đúng $10/tháng</b> (Khoảng 250.000 VNĐ).\n\nMức giá này chỉ bằng số tiền bạn vung tay qua cửa sổ cho 1 bát phở hoặc 1 tài khoản Netflix mà bạn thỉnh thoảng mới động đến mỗi tuần.\n\nViệc bạn cứ chần chừ, trì hoãn với lý do "Đợi để gom cho đủ tiền" đồng nghĩa với việc bạn đang tự tay <b>đánh mất hàng thập kỷ sức mạnh của Lãi Kép</b>. Cái giá thực sự đắt đỏ tàn nhẫn không phải là 600 đô la — mà là Chi phí cơ hội thay đổi vị thế gia tộc mà bạn đã vĩnh viễn bỏ lỡ.`;
        keyboard = [[{ text: "🔙 Quay lại Danh sách Câu hỏi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }
    else if (data === 'faq_5') {
        imageUrl = IMG_FAQ;
        text = `✅ <b>Thà giữ tiền mặt trong két sắt hoặc ngân hàng cho an toàn?</b>\n\nThưa bạn, tư duy "Tiền mặt là vua" chính là <b>Ảo giác an toàn nguy hiểm nhất</b> của tầng lớp trung lưu và người nghèo.\n\nCác Ngân hàng Trung ương không ngừng in thêm tiền mới mỗi ngày. Hệ quả tất yếu là "Lạm phát" - Một bóng ma khổng lồ <b>lặng lẽ móc túi bạn</b>, ăn mòn sức mua của bạn mỗi khi bạn chìm vào giấc ngủ mà không hề phát ra một tiếng động nào.\n\nGiữ khư khư tiền mặt dài hạn = <b>Đảm bảo 100% bạn sẽ nghèo đi theo thời gian</b>. Giới tinh anh và tầng lớp siêu giàu không bao giờ tích trữ tiền mặt ngu ngốc, họ luôn dùng mọi cách mượn nợ để chuyển hóa nó thành Tài sản sinh lời. Đừng tự dìm chết mình trong sự "an toàn" giả tạo đó!`;
        keyboard = [[{ text: "🔙 Quay lại Danh sách Câu hỏi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }

    // --- CƠ CHẾ GỬI ẢNH VÀ XÓA TIN NHẮN CŨ CHỐNG LỖI ---
    if (text !== '') {
        bot.deleteMessage(chatId, messageId).catch(() => {});
        if (imageUrl !== '') {
            bot.sendPhoto(chatId, imageUrl, {
                caption: text,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboard }
            }).catch((e) => {
                bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
            });
        } else {
            bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
        }
    }
});

// ==========================================
// XỬ LÝ TIN NHẮN TỰ DO — AI TƯ VẤN VÀ ADMIN
// ==========================================
bot.on('message', async (msg) => {
    if (!msg.from || msg.from.is_bot || msg.chat.type !== 'private') return;
    if (msg.contact || (msg.text && msg.text.startsWith('/'))) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // 1. ADMIN TRẢ LỜI LẠI KHÁCH
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

    // 2. KHÁCH NHẮN TIN - GỌI AI CLAUDE
    if (userId !== ADMIN_ID) {
        let user = await User.findOne({ userId });
        if (!user) { user = new User({ userId, firstName: msg.from.first_name || '', lastName: msg.from.last_name || '', username: msg.from.username ? `@${msg.from.username}` : '' }); await user.save(); }

        if (msg.photo || msg.video || msg.document) {
            await bot.forwardMessage(ADMIN_ID, chatId, msg.message_id).catch(() => {});
            bot.sendMessage(ADMIN_ID, `📩 <b>TỆP TỪ KHÁCH HÀNG</b>\n👤 Tên: ${user.firstName}\n🆔 ID: <code>${userId}</code>\n💬 Ghi chú: ${msg.caption || 'Không có'}\n\n👉 <i>Reply tin này để chat trực tiếp (AI sẽ bị khóa 2h).</i>`, { parse_mode: 'HTML' }).catch(()=>{});
        }

        const now = new Date();
        if (user.adminPausedAiUntil && user.adminPausedAiUntil > now) {
            bot.sendMessage(ADMIN_ID, `📩 <b>KHÁCH TRẢ LỜI (CHẾ ĐỘ ADMIN)</b>\n👤 Tên: ${user.firstName}\n🆔 ID: <code>${userId}</code>\n💬 Nội dung: ${msg.text || '[Tệp]'}\n\n👉 <i>Reply để tiếp tục chat.</i>`, { parse_mode: 'HTML' }).catch(()=>{});
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
// BROADCAST LỊCH GỬI TIN & DRIP FUNNEL 7 NGÀY
// ==========================================
function getVNTime() { return new Date(new Date().getTime() + (7 * 60 * 60 * 1000)); }

async function broadcastToAll(message) {
    const users = await User.find({ broadcastOptOut: false });
    for (const user of users) {
        try { await bot.sendPhoto(user.userId, IMG_MAIN_MENU, { caption: message, parse_mode: 'HTML', reply_markup: { inline_keyboard: getGlobalButtons() } }); } catch (e) {}
        await new Promise(r => setTimeout(r, 70));
    }
}

async function broadcastToTag(tag, message) {
    const users = await User.find({ tag, broadcastOptOut: false });
    for (const user of users) {
        try { await bot.sendPhoto(user.userId, IMG_MAIN_MENU, { caption: message, parse_mode: 'HTML', reply_markup: { inline_keyboard: getGlobalButtons() } }); } catch (e) {}
        await new Promise(r => setTimeout(r, 70));
    }
}

setInterval(async () => {
    const vnTime = getVNTime();
    const h = vnTime.getUTCHours();
    const m = vnTime.getUTCMinutes();
    const daysLeft = getDaysLeft();

    if (h === 8 && m === 0) {
        const msg = `🌅 <b>CHÀO BUỔI SÁNG — F0 ĐANG LO, TA ĐANG CÓ KẾ HOẠCH!</b>\n\nĐa số F0 đang sợ hãi không biết hôm nay thị trường đi đâu... Nhưng thành viên SWC đã có kế hoạch từ đầu tháng.\n\n💡 <b>Sự thật tàn nhẫn:</b> 95% người tự trade thua lỗ không phải vì thiếu thông tin — mà vì <b>thiếu hệ thống kỷ luật</b>.\n\n⏳ Còn <b>${daysLeft} ngày</b> để gia nhập hệ thống trước khi cửa đóng vĩnh viễn!`;
        await broadcastToAll(msg);
    }
    if (h === 12 && m === 0) {
        const msg = `💡 <b>KIẾN THỨC TÀI CHÍNH TỪ SÓI GIÀ: Lãi kép — Kỳ quan thứ 8</b>\n\n$240/tháng × 15 năm × lãi kép 20%/năm = <b>$1,000,000+</b>\nBí quyết là bắt đầu SỚM và kỷ luật ĐỀU ĐẶN. Đừng đánh bạc với thời gian. Còn ${daysLeft} ngày để lên tàu SWC Pass!`;
        await broadcastToAll(msg);
    }
    if (h === 19 && m === 30) {
        const msg = `📚 <b>THỜI GIAN CẬP NHẬT KIẾN THỨC BẢO VỆ TÀI SẢN!</b>\n\nVào Group cộng đồng ngay để:\n✅ Cập nhật tiến độ dự án ATLAS Dubai (RWA)\n✅ Thảo luận chiến lược đầu tư Lãi Kép\n✅ Kết nối 1.000+ nhà đầu tư tinh hoa\n\n⏳ Giữ chặt ví tiền! Còn <b>${daysLeft} ngày</b> để mua vị thế tốt nhất!`;
        await broadcastToAll(msg);
    }
    if (h === 20 && m === 30) {
        const msg = `🔥 <b>NHẮC NHỞ KHẨN CẤP — CÒN ĐÚNG ${daysLeft} NGÀY!</b>\n\nLúc này có 2 loại người:\nLoại 1: F0 đang lo lắng thị trường, nhìn chart đỏ mắt...\nLoại 2: Đã sở hữu SWC Pass — <b>đang ngủ ngon trong khi hệ thống tự động chạy</b>.\n\nGói <b>Ultimate (Vĩnh viễn)</b> — Giới hạn 1.000 suất — <b>Sẽ đóng cửa vĩnh viễn vào ${DEADLINE}</b>. Không có ngoại lệ.`;
        await broadcastToTag('hot_lead', msg); await broadcastToTag('interested', msg);
    }
}, 60000);

// ==========================================
// ADMIN PANEL & LỆNH GỬI TIN HÀNG LOẠT (SENDALL)
// ==========================================
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id, `👨‍💻 <b>ADMIN PANEL</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "📊 Thống kê Phễu", callback_data: 'admin_stats' }], [{ text: "📢 Bảng lệnh Quản trị", callback_data: 'admin_help' }]] } });
});

bot.on('callback_query', async (query) => {
    if(query.data === 'admin_stats' && query.from.id.toString() === ADMIN_ID) {
        const total = await User.countDocuments(); const hotLead = await User.countDocuments({ funnelStage: 'hot_lead' });
        bot.sendMessage(ADMIN_ID, `📊 <b>THỐNG KÊ SWC BOT</b>\n👥 Tổng users: ${total}\n🔥 Hot Lead: ${hotLead}\n⏳ Còn lại: ${getDaysLeft()} ngày`, { parse_mode: 'HTML' });
    }
    if(query.data === 'admin_help' && query.from.id.toString() === ADMIN_ID) {
        bot.sendMessage(ADMIN_ID, `📢 <b>LỆNH ADMIN BẰNG TAY:</b>\n1. <code>/tracuu [ID]</code>\n2. <code>/setpass [ID] [Gói]</code>\n3. <code>/sendall [Text]</code>: Bắn tin cho tất cả.\n4. <code>/sendgroup [Text]</code>: Gửi Group`, { parse_mode: 'HTML' });
    }
});

bot.onText(/\/sendall ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const textToSend = match[1];
    const users = await User.find({});
    
    bot.sendMessage(ADMIN_ID, `⏳ Bắt đầu gửi tin nhắn hàng loạt kèm ảnh cho ${users.length} người...`);
    let success = 0;
    for (const u of users) {
        try { 
            await bot.sendPhoto(u.userId, IMG_MAIN_MENU, { caption: textToSend, parse_mode: 'HTML', reply_markup: { inline_keyboard: getGlobalButtons() } }); 
            success++; 
        } catch (e) {}
        await new Promise(r => setTimeout(r, 70)); 
    }
    bot.sendMessage(ADMIN_ID, `✅ Gửi thành công: ${success}/${users.length} khách hàng.`);
});

// Các lệnh quản lý khác
bot.onText(/\/tracuu (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const user = await User.findOne({ userId: match[1] });
    if (!user) return bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy!`);
    bot.sendMessage(ADMIN_ID, `🔎 <b>HỒ SƠ KHÁCH HÀNG</b>\n🆔 <code>${match[1]}</code>\n👤 Tên: ${user.firstName} ${user.lastName}\n📞 SĐT: ${user.phone || 'Chưa có'}\n🎯 Phễu: ${user.funnelStage}\n💎 Gói Pass: ${user.swcPassTier}`, { parse_mode: 'HTML' });
});

bot.onText(/\/setpass (\d+) (\w+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const tier = match[2].toLowerCase();
    if (!['none', 'essential', 'plus', 'ultimate'].includes(tier)) return bot.sendMessage(ADMIN_ID, `❌ Sai gói! Dùng: essential / plus / ultimate`);
    await User.updateOne({ userId: match[1] }, { $set: { swcPassTier: tier, funnelStage: tier !== 'none' ? 'converted' : 'hot_lead' } });
    bot.sendMessage(ADMIN_ID, `✅ Đã Kích hoạt Gói: <b>${tier}</b> cho ${match[1]}`, { parse_mode: 'HTML' });
});

bot.onText(/\/sendgroup ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try { await bot.sendMessage(GROUP_USERNAME, `📢 <b>THÔNG BÁO TỪ BQT:</b>\n\n${match[1]}`, { parse_mode: 'HTML' }); bot.sendMessage(ADMIN_ID, `✅ Đã gửi Group!`);
    } catch (e) { bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`); }
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
    console.log(`🌐 Port ${PORT}`);
    console.log("🚀 MA TRẬN CHỐT SALE VÀ AI CLAUDE ĐÃ KÍCH HOẠT THÀNH CÔNG!");
});
