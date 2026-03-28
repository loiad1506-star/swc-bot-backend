require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');
const mongoose = require('mongoose');

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG ---
const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGODB_URI;

// Bật chế độ lắng nghe sự kiện
const bot = new TelegramBot(token, {
    polling: {
        params: { allowed_updates: JSON.stringify(["message", "callback_query"]) }
    }
});

bot.on("polling_error", (msg) => console.log("⚠️ LỖI POLLING:", msg));
bot.on("error", (msg) => console.log("⚠️ LỖI CHUNG:", msg));

// --- TỔNG HỢP CÁC ĐƯỜNG LINK CHUẨN ---
const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';
const NEWS_CHANNEL = "https://t.me/swc_capital_vn";
const DISCUSSION_GROUP = "https://t.me/swc_capital_chat";
const SWC_PASS_WEB = "https://swcpass.vn";
const SWC_FIELD_WEB = "https://swcfield.com/vi";
const EVENT_WEBINAR_LINK = "https://launch.swc.capital/broadcast_31_vi";
const PRIVATE_TG_GROUP = "https://t.me/+1M_PlogMd_M1ZjNl";
const PRIVATE_ZALO_GROUP = "https://zalo.me/g/yeiaea989";

const ADMIN_ID = '507318519'; 
const GROUP_USERNAME = '@swc_capital_chat';
const NÚT_ĐĂNG_KÝ_SỰ_KIỆN = [{ text: "🚨 ĐĂNG KÝ SỰ KIỆN ATLAS (31/03)", url: EVENT_WEBINAR_LINK }];

// --- KẾT NỐI MONGODB ---
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Đã kết nối thành công với kho dữ liệu MongoDB!'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// --- TẠO CẤU TRÚC LƯU TRỮ NGƯỜI DÙNG ---
const userSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    firstName: { type: String, default: '' }, 
    lastName: { type: String, default: '' },  
    username: { type: String, default: '' },  
    phone: { type: String, default: '' }, 
    joinDate: { type: Date, default: Date.now },  
    referralCount: { type: Number, default: 0 },
    tag: { type: String, default: '' },
    nurturingDay: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

// ==========================================
// 🚀 KẾ HOẠCH CHĂM SÓC FOLLOW-UP TỰ ĐỘNG 7 NGÀY
// ==========================================
const NURTURING_MESSAGES = [
    `💡 <b>BẠN MUỐN TRÔNG CÓ VẺ GIÀU, HAY THỰC SỰ GIÀU?</b>\n\nChào bạn, xã hội đang tẩy não chúng ta rằng mua xe trả góp, dùng đồ hiệu là thành công. Sự thật tàn nhẫn: đó là "tiêu sản" rút cạn tương lai. Mỗi đồng ném vào khoe mẽ là một đồng bạn đánh cắp từ sự tự do của mình.\n\n👉 <b>Đã đến lúc ngừng làm giàu cho người khác.</b> Hãy tìm hiểu chiến lược <b>Road to $1M</b> của chúng tôi để bắt đầu xây dựng cỗ máy sinh lời thực sự!`,
    `📉 <b>ẢO GIÁC CỦA SỰ AN TOÀN VÀ KẺ CẮP LẠM PHÁT</b>\n\nĐể tiền trong tài khoản tiết kiệm là lời nói dối đắt giá nhất. Lạm phát đang âm thầm ăn mòn sức mua của bạn mỗi ngày. Tiết kiệm mù quáng chỉ đảm bảo bạn sẽ nghèo đi một cách chắc chắn.\n\n👉 <b>Giải pháp:</b> Cần một hệ thống kỷ luật tự động hóa dòng tiền. Cùng với gói đăng ký <b>SWC Pass</b>, bạn sẽ học được cách bảo vệ và gia tăng tài sản dài hạn.`,
    `💎 <b>BÍ MẬT CỦA LÃI KÉP VÀ HÀNH TRÌNH ĐẾN $1.000.000</b>\n\nCột mốc 100.000$ đầu tiên rất khó, nhưng sau đó lãi kép sẽ tự đẻ ra tiền thay bạn. Không cần số vốn khổng lồ, chỉ cần <b>đầu tư 8$/ngày có kỷ luật</b>, bạn có thể hướng tới 1.000.000$ trong 15 năm.\n\n👉 Khám phá chiến lược <b>Road to $1M</b> trên hệ thống SWC Pass - Chỉ tốn 10-15 phút mỗi tháng quản lý.`,
    `🦈 <b>SÂN CHƠI CỦA CÁ MẬP: BẠN ĐANG THIỆT THÒI?</b>\n\nTại sao 90% nhà đầu tư cá nhân thua lỗ? Vì họ không được tiếp cận các Vòng gọi vốn kín (Private Round) với giá ưu đãi. Sân chơi đó trước đây chỉ dành cho các quỹ khổng lồ.\n\n👉 <b>Luật chơi đã thay đổi:</b> Gian hàng <b>SWC Field</b> ra đời để trao quyền cho bạn tiếp cận các dự án khởi nghiệp siêu tiềm năng đã qua bộ lọc khắt khe nhất!`,
    `🏢 <b>SIÊU DỰ ÁN ATLAS VÀ KỶ NGUYÊN RWA</b>\n\nBất động sản truyền thống đang giam lỏng vốn của bạn với thanh khoản cực chậm. Xu hướng <b>Web 2.5 và RWA (Mã hóa tài sản thực)</b> của dự án <b>ATLAS</b> sẽ phá vỡ thế độc quyền đó. Sở hữu, giao dịch, thanh khoản BĐS Dubai chỉ trong 3 giây!\n\n⚠️ <b>Sắp đóng vòng ưu đãi!</b> Hãy đăng ký sự kiện 31/03 để biết thêm chi tiết.`,
    `🔥 <b>LỰA CHỌN QUYẾT ĐỊNH TƯƠNG LAI CỦA BẠN</b>\n\nWarren Buffett nói: <i>"Thị trường chứng khoán là công cụ chuyển tiền từ kẻ thiếu kiên nhẫn sang người kiên nhẫn"</i>. Bạn cần một "Lồng kính kỷ luật".\n\n👉 Gói <b>SWC Pass Plus (5 Năm)</b> với chi phí chưa tới $10/tháng (bằng 1 ly cà phê) sẽ giúp bạn khóa giá cố định và cam kết với sự giàu có của mình.`,
    `🚨 <b>HÀNH ĐỘNG NGAY HOẶC BỊ BỎ LẠI PHÍA SAU</b>\n\nSự kiện ra mắt dự án <b>ATLAS</b> trên gian hàng SWC Field đang đến rất gần (31/03). Vị thế quyết định tài sản, những người nắm bắt thông tin sớm nhất sẽ làm chủ cuộc chơi.\n\n👉 Đừng đứng ngoài quan sát nữa! Hãy <b>đăng ký Webinar</b> và tham gia <b>Nhóm Kín</b> cùng hàng trăm nhà đầu tư tinh anh của chúng tôi.`
];

setInterval(async () => {
    const vnTime = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
    if (vnTime.getUTCHours() === 9 && vnTime.getUTCMinutes() === 0) {
        try {
            const users = await User.find({ nurturingDay: { $lt: 7 }, phone: { $ne: '' } });
            for (let user of users) {
                const msgContent = NURTURING_MESSAGES[user.nurturingDay];
                let opts = { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: [] } };
                
                if (user.nurturingDay === 4 || user.nurturingDay === 6) opts.reply_markup.inline_keyboard.push(NÚT_ĐĂNG_KÝ_SỰ_KIỆN);
                else if (user.nurturingDay === 3) opts.reply_markup.inline_keyboard.push([{ text: "🌐 Truy cập SWC Field", url: SWC_FIELD_WEB }]);
                else opts.reply_markup.inline_keyboard.push([{ text: "🚀 Tìm hiểu SWC Pass", url: SWC_PASS_WEB }]);

                bot.sendMessage(user.userId, msgContent, opts).catch(()=>{});
                user.nurturingDay += 1; await user.save();
                await new Promise(resolve => setTimeout(resolve, 50)); 
            }
        } catch (error) {}
    }
}, 60000);

// ==========================================
// API SERVER KẾT NỐI VỚI MINI APP
// ==========================================
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.end(); return; }
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/api/user' && req.method === 'GET') {
        const userId = parsedUrl.query.id;
        let userData = await User.findOne({ userId: userId });
        if (!userData) userData = { referralCount: 0 };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(userData));
    } 
    else { res.writeHead(200); res.end('API Online'); }
});
server.listen(process.env.PORT || 3000);

// ==========================================
// KỊCH BẢN CHÍNH - TỰ ĐỘNG THAY THẾ TIN NHẮN
// ==========================================
function sendMainMenu(chatId, messageIdToEdit = null) {
    const msg = `✅ <b>Hồ sơ của bạn đã được lưu trữ an toàn.</b> Chào mừng bạn gia nhập cộng đồng <b>Sky World Community Viet Nam</b>.\n\nNgay lúc này, nền tảng <b>SWC Pass</b> và siêu dự án <b>ATLAS</b> đang đếm ngược đến ngày 31/03. Bạn muốn khám phá điều gì tiếp theo?\n\n<b>🌐 HỆ SINH THÁI CỦA CHÚNG TÔI:</b>\n📡 Kênh tin tức chính thức: <a href="${NEWS_CHANNEL}">Bấm vào đây</a>\n🗣 Nhóm thảo luận cộng đồng: <a href="${DISCUSSION_GROUP}">Bấm vào đây</a>`;
    
    const options = {
        parse_mode: 'HTML', disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [{ text: "🚀 MỞ ỨNG DỤNG SWC PASS", web_app: { url: webAppUrl } }],
                [{ text: "💎 Đặc quyền & Tính năng SWC Pass", callback_data: 'menu_swcpass' }],
                [{ text: "🏢 Khám phá Siêu dự án ATLAS", callback_data: 'menu_atlas' }],
                [{ text: "❓ Giải đáp thắc mắc (FAQ)", callback_data: 'menu_faq' }],
                NÚT_ĐĂNG_KÝ_SỰ_KIỆN
            ]
        }
    };

    if (messageIdToEdit) {
        options.chat_id = chatId; options.message_id = messageIdToEdit;
        bot.editMessageText(msg, options).catch(()=>{});
    } else {
        bot.sendMessage(chatId, msg, options).catch(()=>{});
    }
}

bot.onText(/\/start(.*)/i, async (msg) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== 'private') return; 

    const userId = msg.from.id.toString();
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username ? `@${msg.from.username}` : '';

    let user = await User.findOne({ userId: userId });
    if (!user) user = new User({ userId, firstName, lastName, username });
    else { user.firstName = firstName; user.lastName = lastName; user.username = username; }
    await user.save();
    
    const welcomeMessage = `Xin chào <b>${firstName}</b>! 🦁\n\nChào mừng bạn bước vào Hệ sinh thái Đầu tư Tinh anh của <b>Sky World Community Viet Nam</b>.\n\nTôi là Trợ lý AI của <b>SWC Pass</b>. Mục tiêu của chúng tôi rất rõ ràng: <b>Vốn của bạn phải sinh lời và vị thế của bạn phải thăng hạng!</b>\n\n🌱 Để nhận thông tin nội bộ và tham gia các thương vụ vòng kín (Private Round), vui lòng <b>xác nhận chính sách bảo mật và chia sẻ số điện thoại</b> của bạn bên dưới.`;

    if (!user.phone) {
        const options = { parse_mode: 'HTML', reply_markup: { keyboard: [[{ text: "📞 Chia sẻ Số điện thoại để bắt đầu", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } };
        bot.sendMessage(chatId, welcomeMessage, options).catch(()=>{});
    } else { sendMainMenu(chatId); }
});

bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const phoneNumber = msg.contact.phone_number;
    const userId = msg.from.id.toString();

    try { await User.updateOne({ userId: userId }, { $set: { phone: phoneNumber, tag: 'new' } }); } catch (err) {}

    bot.sendMessage(chatId, "⏳ Đang thiết lập hồ sơ...", { reply_markup: { remove_keyboard: true } }).then((sentMsg) => {
        bot.deleteMessage(chatId, sentMsg.message_id).catch(()=>{});
        sendMainMenu(chatId);
    });

    setTimeout(() => {
        const surveyMsg = `👋 Xin chào! Chúng tôi muốn hiểu bạn rõ hơn.\n\n<b>Để đội ngũ chuyên gia hỗ trợ bạn một cách chính xác nhất</b>, hãy dành 10 giây cho chúng tôi biết vị thế hiện tại của bạn:`;
        const surveyOptions = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🙋‍♂️ Tôi là nhà đầu tư mới", callback_data: 'survey_newbie' }],
                    [{ text: "💼 Tôi đã có kinh nghiệm đầu tư", callback_data: 'survey_experienced' }],
                    [{ text: "🔥 Tôi đã có thẻ SWC Pass", callback_data: 'survey_vip' }]
                ]
            }
        };
        bot.sendMessage(chatId, surveyMsg, surveyOptions).catch(()=>{});
    }, 15000); 
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id; 
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    let user = await User.findOne({ userId: userId });
    if (!user) return bot.answerCallbackQuery(callbackQuery.id);

    let text = "";
    let options = { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: [] } };

    const commonCtaButtons = [
        [{ text: "🚀 MỞ ỨNG DỤNG SWC PASS", web_app: { url: webAppUrl } }],
        [{ text: "💬 THAM GIA NHÓM KÍN ZALO", url: PRIVATE_ZALO_GROUP }],
        [{ text: "🔙 Quay lại Menu Chính", callback_data: 'main_menu' }],
        NÚT_ĐĂNG_KÝ_SỰ_KIỆN
    ];

    if (data === 'main_menu') {
        sendMainMenu(chatId, messageId);
        return bot.answerCallbackQuery(callbackQuery.id);
    }
    
    else if (data === 'menu_swcpass') {
        text = `💎 <b>SWC PASS - TẤM VÉ THÔNG HÀNH CỦA GIỚI TINH ANH</b>\n\nĐây không chỉ là kiến thức, đây là <b>Hệ thống Kỷ luật</b> để xây dựng sự giàu có bền vững.\n\n1️⃣ <b>ROAD TO $1M:</b> Chiến lược xây dựng danh mục cổ phiếu chia cổ tức chuyên nghiệp. <b>Mỗi tháng bạn sẽ nhận được một kế hoạch giải ngân chi tiết</b> để tận dụng sức mạnh Lãi Kép.\n\n2️⃣ <b>SWC FIELD:</b> Đặc quyền tiếp cận các thương vụ mạo hiểm vòng kín (Private Round) với <b>vị thế như một quỹ đầu tư lớn</b>.\n\n3️⃣ <b>TIẾN ĐỘ CÁ NHÂN:</b> Trình theo dõi chuẩn xác giúp bạn biết dòng tiền của mình đang ở đâu.\n\n4️⃣ <b>MINH BẠCH 100%:</b> Quản lý tài sản qua cấu trúc SPV, <b>loại bỏ hoàn toàn các loại phí ẩn</b>.\n\n👉 <b>Hãy xem chi tiết Hành trình đến $1M bằng cách bấm nút bên dưới:</b>`;
        options.reply_markup.inline_keyboard = [
            [{ text: "🎯 Chi tiết Hành Trình Đến $1M", callback_data: 'road_to_1m' }],
            [{ text: "🌐 Truy cập Website SWC Pass", url: SWC_PASS_WEB }],
            ...commonCtaButtons
        ];
    } 
    
    // ĐƯA NGUYÊN VĂN 100% NỘI DUNG VÀO (KHÔNG TÓM TẮT)
    else if (data === 'road_to_1m' || data === 'faq_2') {
        text = `💎 <b>Hành trình đến $1M (Road to $1M)</b>\n\n<b>Chiến lược do SWC Field phát triển.</b> Đây là một chương trình đầu tư dài hạn: <b>chỉ cần đầu tư 8 đô la mỗi ngày (khoảng 240 đô la mỗi tháng) có kỷ luật</b>, đảm bảo đầu tư đều đặn và với <b>sức mạnh lãi kép</b>, bạn có thể hướng đến mục tiêu đạt số vốn <b>1.000.000 đô la trong 15 năm</b>. Sản phẩm là một hệ thống hoàn chỉnh cho phép bạn bắt đầu đầu tư <b>mà không cần kinh nghiệm hay các khóa đào tạo</b> — và không cần tốn nhiều thời gian (chỉ 10-15 phút mỗi tháng).\n\n<i>Cập nhật: thg 3 5, 2026</i>\n\n🎯 <b>Mục tiêu</b>\nDự án "Hành trình đến $1M" nhằm mục đích giúp người tham gia:\n1. <b>Xây dựng vốn tài chính dài hạn:</b> Cung cấp cho người tham gia một chiến lược sẵn có để xây dựng giá trị tài sản ròng từ 1.000.000 đô la trở lên trong khoảng thời gian 15-20 năm, bằng cách sử dụng lãi kép.\n2. <b>Đạt sự tự do và độc lập tài chính:</b> Cung cấp phương pháp có hệ thống giúp người tham gia vượt qua áp lực tài chính ("sống dựa vào đồng lương") và xây dựng thu nhập thụ động cao hơn các chi phí của họ.\n3. <b>Xây dựng nền tảng tài chính cho gia đình và các thế hệ tương lai:</b> Cung cấp cho cha mẹ công cụ tích lũy vốn mục tiêu, giúp họ có thể đảm bảo cho con cháu mình ăn học tốt hơn, có sự khởi đầu tự tin trong cuộc sống và một di sản tài chính vững chắc.\n\n🔥 <b>Lợi ích</b>\n1. <b>Chiến lược đã được kiểm chứng và chứng minh hiệu quả.</b> Người tham gia sẽ nhận được tín hiệu hàng tháng (nên mua gì, mua bao nhiêu và mua với giá thế nào) và có thể làm theo chiến lược đã được hơn 7.000 người thực hiện.\n2. <b>Tiết kiệm thời gian.</b> Không cần phải dành hơn 10.000 giờ để nghiên cứu lý thuyết, đọc sách và tham gia các khóa học tài chính. Để quản lý danh mục đầu tư bạn chỉ mất 10-15 phút mỗi tháng.\n3. <b>Bảo vệ khỏi những sai lầm cảm tính.</b> Chiến lược bình quân giá mua (DCA) và Buy & Hold giúp giảm căng thẳng, ngăn ngừa hoảng loạn trong thời kỳ khủng hoảng và tránh các giao dịch đầu cơ thiếu cân nhắc.`;
        options.reply_markup.inline_keyboard = [
            [{ text: "🔙 Quay lại", callback_data: data === 'faq_2' ? 'faq_back' : 'menu_swcpass' }],
            NÚT_ĐĂNG_KÝ_SỰ_KIỆN
        ];
    }

    else if (data === 'menu_atlas') {
        text = `🏢 <b>SIÊU DỰ ÁN ATLAS - KHAI MỞ ĐẠI DƯƠNG XANH</b>\n\nBạn nghĩ sao nếu có thể <b>sở hữu và giao dịch bất động sản tại Dubai</b> chỉ bằng vài cú chạm trên điện thoại? ATLAS mang đến giải pháp <b>Bất động sản số hóa (RWA)</b> tiên tiến nhất.\n\n🌟 <b>ĐẶC ĐIỂM CỐT LÕI:</b>\n- <b>Thanh khoản 3 giây:</b> Phá vỡ sự chậm chạp của BĐS truyền thống qua thị trường thứ cấp nội bộ.\n- <b>Bảo chứng pháp lý:</b> Hoạt động dưới pháp nhân Atlas Overseas FZE, được <b>cấp phép bởi Cơ quan Trung tâm Thương mại Thế giới Dubai</b>.\n- <b>Tiếp cận dễ dàng:</b> Dân chủ hóa sân chơi vốn dĩ chỉ dành cho giới siêu giàu.\n\n⚠️ <b>Cánh cửa vòng ưu đãi sẽ đóng lại vào 31/03/2026. Đừng bỏ lỡ vị thế tốt nhất!</b>\n🌐 Khám phá hệ sinh thái SWC Field: <a href="${SWC_FIELD_WEB}">${SWC_FIELD_WEB}</a>`;
        options.reply_markup.inline_keyboard = commonCtaButtons;
    }
    
    else if (data === 'menu_faq' || data === 'faq_back') {
        text = `<b>CHUYÊN MỤC GIẢI ĐÁP THẮC MẮC (FAQ)</b>\n<i>Hãy chọn câu hỏi bạn đang quan tâm để xem phân tích chi tiết:</i>`;
        options.reply_markup.inline_keyboard = [
            [{ text: "1. Nhận được gì ngay sau khi thanh toán?", callback_data: 'faq_1' }],
            [{ text: "2. Hành trình đến $1M là gì?", callback_data: 'faq_2' }],
            [{ text: "3. Khác gì kiến thức Youtube miễn phí?", callback_data: 'faq_3' }],
            [{ text: "4. Tôi chưa có đủ $600 lúc này?", callback_data: 'faq_4' }],
            [{ text: "5. Giữ tiền mặt cho an toàn thời điểm này?", callback_data: 'faq_5' }],
            [{ text: "🔙 Quay lại Menu Chính", callback_data: 'main_menu' }],
            NÚT_ĐĂNG_KÝ_SỰ_KIỆN
        ];
    }
    else if (data === 'faq_1') { 
        text = `✅ <b>Tôi nhận được gì ngay sau khi thanh toán?</b>\n\nQuyền truy cập <b>ĐẦY ĐỦ VÀ NGAY LẬP TỨC</b> vào hệ sinh thái.\nChiến lược xây dựng danh mục cổ phiếu cổ tức đầu tiên của Hành trình đến $1M sẽ có trong tài khoản của bạn chỉ sau vài phút. <b>Bạn sẽ biết chính xác tháng này nên mua mã nào, tỷ lệ bao nhiêu.</b> Không cần phải chờ đợi!`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN); 
    }
    else if (data === 'faq_3') { 
        text = `✅ <b>Khác gì kiến thức miễn phí trên Youtube?</b>\n\nKiến thức trên mạng là miễn phí, nhưng nếu chỉ 'biết' mà giàu thì ai cũng là triệu phú. Sự khác biệt nằm ở <b>Hệ thống Kỷ luật</b>.\n\nSWC Pass là <b>công cụ ép bạn thực thi</b>, loại bỏ cảm xúc cá nhân. Sự khác biệt giống hệt như việc đọc một cuốn sách dạy bơi và việc trực tiếp nhảy xuống hồ bơi vậy.`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN); 
    }
    else if (data === 'faq_4') { 
        text = `✅ <b>Tôi chưa có đủ $600 lúc này?</b>\n\nHãy làm bài toán chia nhỏ: $600 cho 5 năm nghĩa là bạn chỉ tốn vỏn vẹn <b>$10/tháng (~250.000 VNĐ)</b>. Sự thật là bạn đang ném số tiền này qua cửa sổ cho những ly cà phê vô bổ.\n\nViệc trì hoãn chờ "có đủ tiền" là cái bẫy hoàn hảo, khiến bạn <b>vĩnh viễn đánh mất hàng thập kỷ sức mạnh của Lãi Kép</b>. Mua SWC Pass là mua lại sự tự do của chính mình!`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN); 
    }
    else if (data === 'faq_5') { 
        text = `✅ <b>Thị trường rủi ro, giữ tiền mặt cho an toàn?</b>\n\nGiữ tiền mặt trong ngân hàng vì sợ rủi ro chính là <b>ảo giác an toàn nguy hiểm nhất</b>. Các ngân hàng trung ương liên tục in tiền, <b>lạm phát lặng lẽ móc túi bạn mỗi ngày</b>.\n\nQuyết định trốn tránh rủi ro biến động chính là quyết định <b>đảm bảo 100% rằng bạn sẽ nghèo đi</b>. Giới tinh anh không bao giờ tích trữ tiền mặt trong dài hạn!`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN); 
    }
    
    // --- KẾT QUẢ KHẢO SÁT ---
    else if (data === 'survey_newbie') {
        user.tag = 'newbie'; await user.save();
        text = `✅ Cảm ơn bạn đã chia sẻ!\n\nLà người mới, <b>lạm phát đang âm thầm ăn mòn tiền mặt của bạn mỗi ngày</b>. Giải pháp duy nhất là xây dựng một cỗ máy tự động hóa dòng tiền.\n\n👉 Lựa chọn tốt nhất lúc này là chiến lược kỷ luật <b>Road to $1M</b>. Bấm nút tham gia nhóm bên dưới để Đội ngũ chuyên gia hỗ trợ bạn định hướng tư duy chuẩn xác nhé!`;
        options.reply_markup.inline_keyboard = [[{ text: "💬 VÀO NHÓM ZALO NHẬN LỘ TRÌNH CHIẾN LƯỢC", url: PRIVATE_ZALO_GROUP }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN];
    }
    else if (data === 'survey_experienced') {
        user.tag = 'experienced'; await user.save();
        text = `✅ Tuyệt vời! Bạn là một nhà đầu tư có tầm nhìn.\n\nNếu bạn đã quen với thị trường đầu tư, <b>ATLAS (Bất động sản số hóa Web3)</b> chính là sân chơi tiếp theo của bạn để nhân x lần tài sản.\n\n⚠️ <b>Vòng gọi vốn kín tốt nhất trên SWC Field sẽ khép lại vào 31/03. Đừng bỏ lỡ!</b>`;
        options.reply_markup.inline_keyboard = commonCtaButtons;
    }
    else if (data === 'survey_vip') {
        user.tag = 'vip_pass'; await user.save();
        text = `✅ <b>Chào mừng thành viên VIP!</b>\nBạn đã có trong tay vũ khí mạnh nhất của hệ sinh thái SWC.\n\n👉 Hãy chắc chắn rằng bạn đã tham gia các Group Nội Bộ bên dưới để <b>nhận tín hiệu cổ tức mỗi tháng</b> và hướng dẫn truy cập SWC Field.`;
        options.reply_markup.inline_keyboard = [[{ text: "💬 VÀO NHÓM VIP TELEGRAM NHẬN TÍN HIỆU", url: PRIVATE_TG_GROUP }], NÚT_ĐĂNG_KÝ_SỰ_KIỆN];
    }

    bot.answerCallbackQuery(callbackQuery.id).catch(()=>{});
    if (text !== "") { bot.editMessageText(text, options).catch(()=>{}); }
});

// ==========================================
// BẢNG ĐIỀU KHIỂN DÀNH CHO ADMIN
// ==========================================
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const adminText = `👨‍💻 <b>BẢNG ĐIỀU KHIỂN QUẢN TRỊ (ADMIN PANEL)</b>`;
    const adminMenu = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📢 Gửi Tin Nhắn Toàn Hệ Thống", callback_data: 'admin_broadcast' }],
                [{ text: "🔍 Hướng Dẫn Tra Cứu User", callback_data: 'admin_help_tracuu' }]
            ]
        }
    };
    bot.sendMessage(msg.chat.id, adminText, adminMenu).catch(()=>{});
});

bot.onText(/\/tracuu (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    bot.sendMessage(ADMIN_ID, `⏳ Đang truy xuất thông tin của ID: <code>${targetId}</code>...`, { parse_mode: 'HTML' });
    try {
        const user = await User.findOne({ userId: targetId });
        if (!user) return bot.sendMessage(ADMIN_ID, `❌ <b>KHÔNG TÌM THẤY TRONG HỆ THỐNG!</b>`, { parse_mode: 'HTML' });

        let report = `🔎 <b>HỒ SƠ KHÁCH HÀNG (ID: ${targetId})</b>\n\n`;
        report += `👤 <b>Họ và Tên:</b> ${user.firstName} ${user.lastName}\n`;
        report += `🔗 <b>Username:</b> ${user.username || 'Không có'}\n`;
        report += `📞 <b>Số điện thoại:</b> ${user.phone || 'Chưa cung cấp'}\n`;
        report += `📅 <b>Ngày Tham Gia:</b> ${new Date(user.joinDate).toLocaleString('vi-VN')}\n`;
        report += `🏷 <b>Nhãn Khách:</b> ${user.tag === 'newbie' ? 'Người mới' : (user.tag === 'vip_pass' ? 'Đã có Pass' : 'Kinh nghiệm')}\n\n`;
        report += `👉 <a href="tg://user?id=${targetId}">Nhấn vào đây để nhắn tin trực tiếp</a>`;
        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    } catch (error) { bot.sendMessage(ADMIN_ID, `❌ Lỗi khi tra cứu: ${error.message}`); }
});

bot.onText(/\/sendall ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const broadcastMsg = match[1];
    const users = await User.find({});
    bot.sendMessage(ADMIN_ID, `⏳ Bắt đầu gửi tin nhắn hàng loạt cho ${users.length} người...`);
    let successCount = 0;
    for (let i = 0; i < users.length; i++) {
        try { 
            await bot.sendMessage(users[i].userId, broadcastMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [NÚT_ĐĂNG_KÝ_SỰ_KIỆN] } }); 
            successCount++;
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    bot.sendMessage(ADMIN_ID, `✅ Đã gửi tin nhắn thành công cho ${successCount} khách hàng.`);
});

bot.onText(/\/sendto (\d+) ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    const content = match[2];
    try {
        await bot.sendMessage(targetId, `👨‍💻 <b>THÔNG BÁO TỪ ĐỘI NGŨ CHUYÊN GIA:</b>\n\n${content}`, { parse_mode: 'HTML' });
        bot.sendMessage(ADMIN_ID, `✅ Đã gửi tin nhắn thành công tới ID: <code>${targetId}</code>`, { parse_mode: 'HTML' });
    } catch (error) { bot.sendMessage(ADMIN_ID, `❌ Lỗi: Không thể gửi (Khách đã block Bot).`); }
});

bot.onText(/\/sendgroup ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const broadcastMsg = match[1];
    try {
        await bot.sendMessage(GROUP_USERNAME, `📢 <b>THÔNG BÁO TỪ ĐỘI NGŨ SWC:</b>\n\n${broadcastMsg}`, { parse_mode: 'HTML' });
        bot.sendMessage(ADMIN_ID, `✅ Đã gửi thông báo lên Group cộng đồng!`);
    } catch (error) { bot.sendMessage(ADMIN_ID, `❌ Lỗi khi gửi lên Group: ${error.message}`); }
});

// XỬ LÝ MESSAGE CỦA ADMIN VÀ KHÁCH HÀNG
bot.on('message', async (msg) => {
    if (msg.from && msg.from.id.toString() === ADMIN_ID && msg.reply_to_message) {
        const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || "";
        const idMatch = originalText.match(/ID:\s*(\d+)/); 
        if (idMatch) {
            const targetUserId = idMatch[1];
            bot.sendMessage(targetUserId, `👨‍💻 <b>Phản hồi từ Đội ngũ Chuyên gia:</b>\n\n${msg.text || msg.caption}`, { parse_mode: 'HTML' }).catch(()=>{});
            bot.sendMessage(ADMIN_ID, `✅ Đã gửi câu trả lời cho khách.`);
            return;
        }
    }

    if (msg.chat.type === 'private' && msg.from.id.toString() !== ADMIN_ID && !msg.from.is_bot) {
        if (msg.text && msg.text.startsWith('/')) return;
        const userId = msg.from.id.toString(); 

        const name = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
        const username = msg.from.username ? `@${msg.from.username}` : 'Không có';
        
        let alertMsg = `📩 <b>TIN NHẮN TỪ KHÁCH HÀNG</b>\n👤 Khách: <b>${name}</b>\n🔗 Username: ${username}\n🆔 ID: <code>${userId}</code>\n\n`;
        const replyMarkupAdmin = { inline_keyboard: [[{ text: "💬 Chat trực tiếp", url: `tg://user?id=${userId}` }]] };

        if (msg.photo || msg.video || msg.document) {
            await bot.forwardMessage(ADMIN_ID, msg.chat.id, msg.message_id).catch(()=>{});
            alertMsg += `<i>(Khách hàng vừa gửi Tệp/Ảnh/Video ngay bên trên)</i>\n`;
            if (msg.caption) alertMsg += `💬 <b>Ghi chú của khách:</b>\n${msg.caption}\n\n`;
        } else { alertMsg += `💬 <b>Nội dung:</b>\n${msg.text}\n\n`; }
        
        alertMsg += `👉 <i>Admin hãy Reply tin nhắn này để chat lại với khách!</i>`;
        bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML', reply_markup: replyMarkupAdmin }).catch(()=>{});
        bot.sendMessage(userId, `👋 Yêu cầu của bạn đã được chuyển đến <b>Đội ngũ chuyên gia</b>. Vui lòng chờ phản hồi nhé!`, { parse_mode: 'HTML' }).catch(()=>{});
    }
});

console.log("🚀 Bot Telegram SWC Pass đã khởi động với ĐẦY ĐỦ KIẾN THỨC + QUẢN TRỊ!");
