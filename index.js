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
        params: {
            allowed_updates: JSON.stringify(["message", "callback_query", "chat_member", "my_chat_member"])
        }
    }
});

bot.on("polling_error", (msg) => console.log("⚠️ LỖI POLLING:", msg));
bot.on("webhook_error", (msg) => console.log("⚠️ LỖI WEBHOOK:", msg));
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
const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';

// --- KẾT NỐI MONGODB ---
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Đã kết nối thành công với kho dữ liệu MongoDB!'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// --- TẠO CẤU TRÚC LƯU TRỮ NGƯỜI DÙNG ---
const userSchema = new mongoose.Schema({
    hasReceivedHalvingMsg: { type: Boolean, default: false },
    pendingRefs: [{ refereeId: String, unlockDate: Date, reward: Number }],
    userId: { type: String, unique: true },
    firstName: { type: String, default: '' }, 
    lastName: { type: String, default: '' },  
    username: { type: String, default: '' },  
    isPremium: { type: Boolean, default: false }, 
    joinDate: { type: Date, default: Date.now },  
    balance: { type: Number, default: 0 },
    wallet: { type: String, default: '' },
    gatecode: { type: String, default: '' }, 
    fullName: { type: String, default: '' }, 
    email: { type: String, default: '' }, 
    phone: { type: String, default: '' }, 
    referredBy: { type: String, default: null }, 
    referralCount: { type: Number, default: 0 }, 
    weeklyReferralCount: { type: Number, default: 0 }, 
    
    topUpStatus: { type: String, default: 'none' }, 
    topUpTimestamp: { type: Date, default: null }, 
    topUpReminderSent: { type: Boolean, default: false }, 
    pendingSWGT: { type: Number, default: 0 }, 
    
    checkInStreak: { type: Number, default: 0 },
    lastCheckInDate: { type: Date, default: null },
    
    milestone3: { type: Boolean, default: false },
    milestone10: { type: Boolean, default: false }, 
    milestone20: { type: Boolean, default: false }, 
    milestone50: { type: Boolean, default: false },
    milestone80: { type: Boolean, default: false },
    milestone120: { type: Boolean, default: false },
    milestone200: { type: Boolean, default: false },
    milestone350: { type: Boolean, default: false },
    milestone500: { type: Boolean, default: false },

    task1Done: { type: Boolean, default: false }, 
    walletRewardDone: { type: Boolean, default: false }, 
    groupMessageCount: { type: Number, default: 0 },
    activeFrame: { type: String, default: 'none' },
    ownedFrames: { type: [String], default: ['none'] },
    spinCount: { type: Number, default: 0 },
    tag: { type: String, default: '' } 
});
const User = mongoose.model('User', userSchema);

const giftCodeSchema = new mongoose.Schema({
    code: { type: String, unique: true }, 
    reward: { type: Number, required: true }, 
    maxUses: { type: Number, default: 1 }, 
    usedBy: { type: [String], default: [] } 
});
const GiftCode = mongoose.model('GiftCode', giftCodeSchema);

// ==========================================
// CÁC TÍNH NĂNG TỰ ĐỘNG CRONJOB
// ==========================================
setInterval(async () => {
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    if (vnTime.getUTCHours() === 19 && vnTime.getUTCMinutes() === 30) {
        try {
            const allUsers = await User.find({});
            const eveningMsg = `📚 <b>THỜI GIAN NÂNG CẤP KIẾN THỨC & CẬP NHẬT TIN TỨC DỰ ÁN!</b>\n\nGiờ là lúc chúng ta tập trung vào giá trị cốt lõi: <b>Đầu tư và Kiến thức tài chính</b>.\n\n💡 Bạn có biết: <i>"Khoản đầu tư sinh lời cao nhất chính là đầu tư vào trí tuệ của bản thân"</i>. \n\n👉 Hãy vào Group Cộng Đồng ngay để cập nhật tin tức mới nhất!`;
            let keyboard = [[{ text: "💬 VÀO GROUP THẢO LUẬN NGAY", url: DISCUSSION_GROUP }]];
            for (let user of allUsers) {
                bot.sendMessage(user.userId, eveningMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(()=>{});
                await new Promise(resolve => setTimeout(resolve, 50)); 
            }
        } catch (error) {}
    }
}, 60000); 

setInterval(async () => {
    try {
        const now = new Date().getTime();
        const pendingUsers = await User.find({ topUpStatus: 'waiting_bill' });
        for (let u of pendingUsers) {
            const diffMins = (now - new Date(u.topUpTimestamp).getTime()) / 60000;
            if (diffMins >= 10) {
                u.topUpStatus = 'none'; await u.save();
                bot.sendMessage(u.userId, `❌ <b>LỆNH ĐÃ BỊ HỦY</b>\n\nĐã quá 10 phút nhưng hệ thống không nhận được hình ảnh Biên lai chuyển khoản của bạn. Lệnh tự hủy.`, {parse_mode: 'HTML'}).catch(()=>{});
            } else if (diffMins >= 5 && !u.topUpReminderSent) {
                u.topUpReminderSent = true; await u.save();
                bot.sendMessage(u.userId, `⚠️ <b>NHẮC NHỞ CHUYỂN KHOẢN</b>\n\nLệnh ghép vốn của bạn chỉ còn <b>5 phút nữa sẽ bị hủy</b>.\n\n👉 Vui lòng gửi ngay <b>ẢNH BIÊN LAI (BILL)</b> vào đây cho Bot!`, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    } catch (e) {}
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
        if (!userData) userData = { balance: 0, wallet: '', gatecode: '', fullName: '', email: '', phone: '', referralCount: 0, isPremium: false, joinDate: Date.now(), activeFrame: 'none', ownedFrames: ['none'], spinCount: 0 };
        
        let lockedBalance = 0; let lockedRefsCount = 0;
        if (userData && userData.pendingRefs && userData.pendingRefs.length > 0) {
            lockedBalance = userData.pendingRefs.reduce((sum, ref) => sum + (ref.reward || 0), 0);
            lockedRefsCount = userData.pendingRefs.length;
        }
        lockedBalance = Math.round(lockedBalance * 100) / 100;
        const vnNowStr = new Date(new Date().getTime() + (7 * 60 * 60 * 1000)).toISOString().split('T')[0];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...userData._doc, serverDateVN: vnNowStr, lockedBalance: lockedBalance, lockedRefsCount: lockedRefsCount }));
    } 
    else { res.writeHead(200); res.end('API Online'); }
});
server.listen(process.env.PORT || 3000);


// ==========================================
// KỊCH BẢN CHÍNH - PHỄU SWC PASS
// ==========================================

// NÚT SỰ KIỆN LUÔN GHIM Ở ĐÁY MÀN HÌNH CỦA MỌI MENU
const persistentEventBtn = [{ text: "🚨 ĐĂNG KÝ SỰ KIỆN ATLAS (31/03)", url: EVENT_WEBINAR_LINK }];

function sendMainMenu(chatId, messageIdToEdit = null) {
    const msg = `✅ <b>Hồ sơ của bạn đã được lưu trữ an toàn.</b> Chào mừng bạn gia nhập cộng đồng <b>Sky World Community Viet Nam</b>.\n\nNgay lúc này, cánh cửa nền tảng <b>SWC Pass</b> và siêu dự án <b>ATLAS</b> đang đếm ngược đến ngày 31/03. Bạn muốn khám phá điều gì tiếp theo?\n\n<b>🌐 HỆ SINH THÁI CỦA CHÚNG TÔI:</b>\n📡 Kênh tin tức chính thức: <a href="${NEWS_CHANNEL}">Bấm vào đây</a>\n🗣 Nhóm thảo luận cộng đồng: <a href="${DISCUSSION_GROUP}">Bấm vào đây</a>`;
    
    const options = {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [{ text: "🚀 MỞ ỨNG DỤNG SWC PASS", web_app: { url: webAppUrl } }],
                [{ text: "💎 Đặc quyền & Tính năng SWC Pass", callback_data: 'menu_swcpass' }],
                [{ text: "🏢 Khám phá Siêu dự án ATLAS", callback_data: 'menu_atlas' }],
                [{ text: "❓ Giải đáp thắc mắc (FAQ)", callback_data: 'menu_faq' }],
                persistentEventBtn
            ]
        }
    };

    if (messageIdToEdit) {
        options.chat_id = chatId;
        options.message_id = messageIdToEdit;
        bot.editMessageText(msg, options).catch(()=>{});
    } else {
        bot.sendMessage(chatId, msg, options).catch(()=>{});
    }
}

bot.onText(/\/start(.*)/i, async (msg, match) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== 'private') return; 

    const userId = msg.from.id.toString();
    const refId = match[1].trim(); 
    const isPremium = msg.from.is_premium || false;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username ? `@${msg.from.username}` : '';

    let user = await User.findOne({ userId: userId });

    if (!user) {
        user = new User({ userId: userId, firstName: firstName, lastName: lastName, username: username, isPremium: isPremium });
        if (refId && refId !== userId) {
            user.referredBy = refId;
            let referrer = await User.findOne({ userId: refId });
            if (referrer) {
                let notifyMsg = `🎉 <b>CÓ NGƯỜI MỚI VỪA BẤM VÀO LINK CỦA BẠN!</b>\n👤 <b>Tên đối tác:</b> ${firstName} ${lastName}\n🔗 <a href="tg://user?id=${userId}">Bấm vào đây để xem</a>`;
                bot.sendMessage(refId, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    } else {
        user.firstName = firstName; user.lastName = lastName; user.username = username; user.isPremium = isPremium;
    }
    await user.save();
    
    const welcomeMessage = `Xin chào <b>${firstName}</b>! 🦁\n\nChào mừng bạn bước vào Hệ sinh thái Đầu tư Tinh anh của <b>Sky World Community Viet Nam</b>.\n\nTôi là Trợ lý AI của <b>SWC Pass</b>. Mục tiêu của chúng tôi rất rõ ràng: <b>Vốn của bạn phải sinh lời và vị thế của bạn phải thăng hạng!</b>\n\n🌱 Để nhận thông tin nội bộ và tham gia các thương vụ vòng kín (Private Round), vui lòng <b>xác nhận chính sách bảo mật và chia sẻ số điện thoại</b> của bạn bên dưới.`;

    if (!user.phone) {
        const options = {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    [{ text: "📞 Chia sẻ Số điện thoại để bắt đầu", request_contact: true }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        };
        bot.sendMessage(chatId, welcomeMessage, options).catch(()=>{});
    } else {
        sendMainMenu(chatId);
    }
});

// LƯU DATA VÀ GỌI MENU KHẢO SÁT
bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const phoneNumber = msg.contact.phone_number;
    const userId = msg.from.id.toString();

    try {
        await User.updateOne({ userId: userId }, { $set: { phone: phoneNumber, tag: 'new' } });
    } catch (err) {}

    bot.sendMessage(chatId, "⏳ Đang tải dữ liệu...", { reply_markup: { remove_keyboard: true } }).then((sentMsg) => {
        bot.deleteMessage(chatId, sentMsg.message_id).catch(()=>{});
        sendMainMenu(chatId);
    });

    setTimeout(() => {
        const surveyMsg = `👋 Xin chào! Chúng tôi muốn hiểu bạn rõ hơn.\nMột số người trong cộng đồng <b>Sky World Community Viet Nam</b> đã đầu tư nhiều năm, một số khác mới bắt đầu.\n\n<b>Để đội ngũ chuyên gia hỗ trợ bạn một cách chính xác nhất</b>, hãy dành 10 giây cho chúng tôi biết vị thế hiện tại của bạn:`;
        const surveyOptions = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🙋‍♂️ Tôi là nhà đầu tư mới", callback_data: 'survey_newbie' }],
                    [{ text: "💼 Tôi đã đầu tư uST từ lâu", callback_data: 'survey_ust' }],
                    [{ text: "🔥 Tôi đã có thẻ SWC Pass", callback_data: 'survey_vip' }]
                ]
            }
        };
        bot.sendMessage(chatId, surveyMsg, surveyOptions).catch(()=>{});
    }, 60000); 
});

// ==========================================
// XỬ LÝ NÚT BẤM (TỰ ĐỘNG EDIT TIN NHẮN)
// ==========================================
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id; // Lấy ID tin nhắn hiện tại để ghi đè
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    let user = await User.findOne({ userId: userId });
    if (!user) return bot.answerCallbackQuery(callbackQuery.id);

    let text = "";
    let options = { 
        chat_id: chatId, 
        message_id: messageId, 
        parse_mode: 'HTML', 
        disable_web_page_preview: true, 
        reply_markup: { inline_keyboard: [] } 
    };

    const commonCtaButtons = [
        [{ text: "🚀 MỞ ỨNG DỤNG SWC PASS", web_app: { url: webAppUrl } }],
        [{ text: "💬 THAM GIA NHÓM KÍN ZALO", url: PRIVATE_ZALO_GROUP }],
        [{ text: "✈️ THAM GIA NHÓM KÍN TELEGRAM", url: PRIVATE_TG_GROUP }],
        [{ text: "🔙 Quay lại Menu Chính", callback_data: 'main_menu' }],
        persistentEventBtn
    ];

    if (data === 'main_menu') {
        sendMainMenu(chatId, messageId);
        return bot.answerCallbackQuery(callbackQuery.id);
    }
    
    // --- NỘI DUNG CHI TIẾT SWC PASS ---
    else if (data === 'menu_swcpass') {
        text = `💎 <b>SWC PASS - TẤM VÉ THÔNG HÀNH CỦA GIỚI TINH ANH</b>\n\nĐây không chỉ là kiến thức, đây là <b>Hệ thống Kỷ luật</b> để xây dựng sự giàu có bền vững.\n\n1️⃣ <b>ROAD TO $1M:</b> Chiến lược xây dựng danh mục cổ phiếu chia cổ tức chuyên nghiệp. <b>Mỗi tháng bạn sẽ nhận được một kế hoạch giải ngân chi tiết</b> (Mua mã nào, tỷ lệ bao nhiêu) để tận dụng sức mạnh Lãi Kép.\n\n2️⃣ <b>SWC FIELD:</b> Đặc quyền tiếp cận các thương vụ mạo hiểm vòng kín (Private Round) với <b>vị thế như một quỹ đầu tư lớn</b>.\n\n3️⃣ <b>TIẾN ĐỘ CÁ NHÂN:</b> Trình theo dõi chuẩn xác giúp bạn biết dòng tiền của mình đang ở đâu.\n\n4️⃣ <b>MINH BẠCH 100%:</b> Quản lý tài sản qua cấu trúc SPV, <b>loại bỏ hoàn toàn các loại phí ẩn</b>.\n\n👉 <b>Hãy xem chi tiết Hành trình đến $1M bằng cách bấm vào nút bên dưới:</b>\n🌐 Website tham khảo: <a href="${SWC_PASS_WEB}">${SWC_PASS_WEB}</a>`;
        
        // Thêm nút xem chi tiết Road to $1M
        options.reply_markup.inline_keyboard = [
            [{ text: "🎯 Chi tiết Hành Trình Đến $1M", callback_data: 'road_to_1m' }],
            ...commonCtaButtons
        ];
    } 
    
    // --- NỘI DUNG CHI TIẾT ROAD TO $1M (FULL KIẾN THỨC) ---
    else if (data === 'road_to_1m' || data === 'faq_2') {
        text = `💎 <b>HÀNH TRÌNH ĐẾN $1M (ROAD TO $1M)</b>\n\n<b>Chiến lược do SWC Field phát triển.</b> Đây là một chương trình đầu tư dài hạn: <b>chỉ cần đầu tư 8 đô la mỗi ngày (khoảng 240 đô la mỗi tháng) có kỷ luật</b>, đảm bảo đầu tư đều đặn và với <b>sức mạnh lãi kép</b>, bạn có thể hướng đến mục tiêu đạt số vốn <b>1.000.000 đô la trong 15 năm</b>. Sản phẩm là một hệ thống hoàn chỉnh cho phép bạn bắt đầu đầu tư <b>mà không cần kinh nghiệm hay các khóa đào tạo</b> — và không cần tốn nhiều thời gian (<b>chỉ 10-15 phút mỗi tháng</b>).\n\n🎯 <b>MỤC TIÊU CỦA DỰ ÁN:</b>\n1. <b>Xây dựng vốn tài chính dài hạn:</b> Cung cấp cho người tham gia một chiến lược sẵn có để xây dựng giá trị tài sản ròng từ <b>1.000.000 đô la trở lên trong khoảng thời gian 15-20 năm</b>, bằng cách sử dụng lãi kép.\n2. <b>Đạt sự tự do và độc lập tài chính:</b> Cung cấp phương pháp có hệ thống giúp người tham gia <b>vượt qua áp lực tài chính</b> ("sống dựa vào đồng lương") và xây dựng thu nhập thụ động cao hơn các chi phí của họ.\n3. <b>Xây dựng nền tảng tài chính cho gia đình và thế hệ tương lai:</b> Đảm bảo cho con cháu ăn học tốt hơn, có sự khởi đầu tự tin và một di sản vững chắc.\n\n🔥 <b>LỢI ÍCH CỐT LÕI:</b>\n1. <b>Chiến lược đã được kiểm chứng:</b> Nhận tín hiệu hàng tháng (nên mua gì, bao nhiêu, giá nào). Đã được <b>hơn 7.000 người thực hiện</b>.\n2. <b>Tiết kiệm thời gian:</b> Không cần tốn hơn 10.000 giờ nghiên cứu. Chỉ mất <b>10-15 phút mỗi tháng</b>.\n3. <b>Bảo vệ khỏi sai lầm cảm tính:</b> Chiến lược bình quân giá mua (DCA) và Buy & Hold giúp giảm căng thẳng, <b>ngăn ngừa hoảng loạn</b> trong thời kỳ khủng hoảng và tránh đầu cơ thiếu cân nhắc.\n\n<i>Cập nhật: Tháng 3/2026</i>`;
        
        options.reply_markup.inline_keyboard = [
            [{ text: "🔙 Quay lại", callback_data: data === 'faq_2' ? 'faq_back' : 'menu_swcpass' }],
            persistentEventBtn
        ];
    }

    else if (data === 'menu_atlas') {
        text = `🏢 <b>SIÊU DỰ ÁN ATLAS - KHAI MỞ ĐẠI DƯƠNG XANH</b>\n\nBạn nghĩ sao nếu có thể <b>sở hữu và giao dịch bất động sản tại Dubai</b> chỉ bằng vài cú chạm trên điện thoại? ATLAS mang đến giải pháp <b>Bất động sản số hóa (RWA)</b> tiên tiến nhất.\n\n🌟 <b>ĐẶC ĐIỂM CỐT LÕI:</b>\n- <b>Thanh khoản 3 giây:</b> Phá vỡ sự chậm chạp của BĐS truyền thống qua thị trường thứ cấp nội bộ.\n- <b>Bảo chứng pháp lý:</b> Hoạt động dưới pháp nhân Atlas Overseas FZE, được <b>cấp phép bởi Cơ quan Trung tâm Thương mại Thế giới Dubai</b> (DWTCA - 4219).\n- <b>Tiếp cận dễ dàng:</b> Dân chủ hóa sân chơi vốn dĩ chỉ dành cho giới siêu giàu.\n\n⚠️ <b>Cánh cửa vòng ưu đãi sẽ đóng lại vào 31/03/2026. Đừng bỏ lỡ vị thế tốt nhất!</b>\n🌐 Khám phá hệ sinh thái SWC Field: <a href="${SWC_FIELD_WEB}">${SWC_FIELD_WEB}</a>`;
        options.reply_markup.inline_keyboard = commonCtaButtons;
    }
    
    // --- BỘ FAQ NÂNG CAO ---
    else if (data === 'menu_faq' || data === 'faq_back') {
        text = `<b>CHUYÊN MỤC GIẢI ĐÁP THẮC MẮC (FAQ)</b>\n<i>Hãy chọn câu hỏi bạn đang quan tâm để xem phân tích chi tiết:</i>`;
        options.reply_markup.inline_keyboard = [
            [{ text: "1. Nhận được gì ngay sau khi thanh toán?", callback_data: 'faq_1' }],
            [{ text: "2. Road to $1M và SWC Field là gì?", callback_data: 'faq_2' }],
            [{ text: "3. Khác gì kiến thức Youtube miễn phí?", callback_data: 'faq_3' }],
            [{ text: "4. Tôi chưa có đủ $600 lúc này?", callback_data: 'faq_4' }],
            [{ text: "5. Giữ tiền mặt cho an toàn thời điểm này?", callback_data: 'faq_5' }],
            [{ text: "🔙 Quay lại Menu Chính", callback_data: 'main_menu' }],
            persistentEventBtn
        ];
    }
    else if (data === 'faq_1') { 
        text = `✅ <b>Tôi nhận được gì ngay sau khi thanh toán?</b>\n\nQuyền truy cập <b>ĐẦY ĐỦ VÀ NGAY LẬP TỨC</b> vào hệ sinh thái.\nChiến lược xây dựng danh mục cổ phiếu cổ tức đầu tiên của Road to $1M sẽ có trong tài khoản của bạn chỉ sau vài phút. <b>Bạn sẽ biết chính xác tháng này nên mua mã nào, tỷ lệ bao nhiêu.</b> Không cần phải chờ đợi!`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], persistentEventBtn); 
    }
    else if (data === 'faq_3') { 
        text = `✅ <b>Khác gì kiến thức miễn phí trên Youtube?</b>\n\nKiến thức trên mạng là miễn phí, nhưng nếu chỉ 'biết' mà giàu thì ai cũng là triệu phú. Sự khác biệt nằm ở <b>Hệ thống Kỷ luật</b>.\n\nSWC Pass là <b>công cụ ép bạn thực thi</b>, loại bỏ cảm xúc cá nhân. Sự khác biệt giống hệt như việc đọc một cuốn sách dạy bơi và việc trực tiếp nhảy xuống hồ bơi vậy.`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], persistentEventBtn); 
    }
    else if (data === 'faq_4') { 
        text = `✅ <b>Tôi chưa có đủ $600 lúc này?</b>\n\nHãy làm bài toán chia nhỏ: $600 cho 5 năm nghĩa là bạn chỉ tốn vỏn vẹn <b>$10/tháng (~250.000 VNĐ)</b>. Sự thật là bạn đang ném số tiền này qua cửa sổ cho những ly cà phê vô bổ.\n\nViệc trì hoãn chờ "có đủ tiền" là cái bẫy hoàn hảo, khiến bạn <b>vĩnh viễn đánh mất hàng thập kỷ sức mạnh của Lãi Kép</b>. Mua SWC Pass là mua lại sự tự do của chính mình!`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], persistentEventBtn); 
    }
    else if (data === 'faq_5') { 
        text = `✅ <b>Thị trường rủi ro, giữ tiền mặt cho an toàn?</b>\n\nGiữ tiền mặt trong ngân hàng vì sợ rủi ro chính là <b>ảo giác an toàn nguy hiểm nhất</b>. Các ngân hàng trung ương liên tục in tiền, <b>lạm phát lặng lẽ móc túi bạn mỗi ngày</b>.\n\nQuyết định trốn tránh rủi ro biến động chính là quyết định <b>đảm bảo 100% rằng bạn sẽ nghèo đi</b>. Giới tinh anh không bao giờ tích trữ tiền mặt trong dài hạn!`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], persistentEventBtn); 
    }
    
    // --- KẾT QUẢ KHẢO SÁT (Thay thế tin nhắn khảo sát) ---
    else if (data === 'survey_newbie') {
        user.tag = 'newbie'; await user.save();
        text = `✅ Cảm ơn bạn đã chia sẻ!\n\nLà người mới, <b>lạm phát đang âm thầm ăn mòn tiền mặt của bạn mỗi ngày</b>. Giải pháp duy nhất là xây dựng một cỗ máy tự động hóa dòng tiền.\n\n👉 Lựa chọn tốt nhất lúc này là chiến lược kỷ luật <b>Road to $1M</b>. Bấm nút tham gia nhóm bên dưới để Đội ngũ chuyên gia hỗ trợ bạn định hướng tư duy chuẩn xác nhé!`;
        options.reply_markup.inline_keyboard = [[{ text: "💬 VÀO NHÓM ZALO NHẬN LỘ TRÌNH CHIẾN LƯỢC", url: PRIVATE_ZALO_GROUP }], persistentEventBtn];
    }
    else if (data === 'survey_ust') {
        user.tag = 'ust_investor'; await user.save();
        text = `✅ Tuyệt vời! Bạn là một nhà đầu tư có tầm nhìn.\n\nNếu bạn đã quen với các dự án mạo hiểm, <b>ATLAS (Bất động sản số hóa Web3)</b> chính là sân chơi tiếp theo của bạn để nhân x lần tài sản.\n\n⚠️ <b>Vòng gọi vốn kín tốt nhất trên SWC Field sẽ khép lại vào 31/03. Đừng bỏ lỡ!</b>`;
        options.reply_markup.inline_keyboard = commonCtaButtons;
    }
    else if (data === 'survey_vip') {
        user.tag = 'vip_pass'; await user.save();
        text = `✅ <b>Chào mừng thành viên VIP!</b>\nBạn đã có trong tay vũ khí mạnh nhất của cộng đồng Sky World Community Viet Nam.\n\n👉 Hãy chắc chắn rằng bạn đã tham gia các Group Nội Bộ bên dưới để <b>nhận tín hiệu cổ tức mỗi tháng</b> và hướng dẫn truy cập SWC Field.`;
        options.reply_markup.inline_keyboard = [[{ text: "💬 VÀO NHÓM VIP TELEGRAM NHẬN TÍN HIỆU", url: PRIVATE_TG_GROUP }], persistentEventBtn];
    }

    bot.answerCallbackQuery(callbackQuery.id).catch(()=>{});
    
    // Thực thi Edit Message thay vì Send Message mới
    if (text !== "") { 
        bot.editMessageText(text, options).catch(()=>{}); 
    }
});

// ==========================================
// XỬ LÝ MESSAGE CỦA ADMIN VÀ KHÁCH HÀNG
// ==========================================
bot.on('message', async (msg) => {
    // 1. Admin duyệt bill hoặc Reply chat
    if (msg.from && msg.from.id.toString() === ADMIN_ID && msg.reply_to_message) {
        const replyText = msg.text ? msg.text.toLowerCase() : (msg.caption ? msg.caption.toLowerCase() : '');
        const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || "";
        const idMatch = originalText.match(/ID:\s*(\d+)/); 
        
        if (idMatch) {
            const targetUserId = idMatch[1];
            const targetUser = await User.findOne({ userId: targetUserId });
            
            // Duyệt bill nạp tiền
            if (originalText.includes('BILL NẠP TIỀN') && (replyText.includes('xong'))) {
                if (targetUser && targetUser.topUpStatus === 'awaiting_admin') {
                    targetUser.balance = Math.round((targetUser.balance + targetUser.pendingSWGT) * 100) / 100;
                    targetUser.topUpStatus = 'none'; await targetUser.save();
                    bot.sendMessage(targetUser.userId, `✅ <b>NẠP TIỀN THÀNH CÔNG!</b>\nTài khoản được cộng <b>${targetUser.pendingSWGT} SWGT</b>.\n👉 Mở App để sử dụng ngay!`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ SWC PASS", web_app: { url: webAppUrl } }]] } }).catch(()=>{});
                    bot.sendMessage(ADMIN_ID, `✅ Đã duyệt Bill thành công.`);
                }
                return;
            }
            // Admin reply chat thủ công
            if (originalText.includes('TỪ KHÁCH HÀNG')) {
                bot.sendMessage(targetUserId, `👨‍💻 <b>Phản hồi từ Đội ngũ SWC:</b>\n\n${msg.text || msg.caption}`, { parse_mode: 'HTML' }).catch(()=>{});
                bot.sendMessage(ADMIN_ID, `✅ Đã gửi câu trả lời cho khách.`);
                return;
            }
        }
    }

    // 2. Khách nhắn tin cho Bot (Xử lý Ảnh/Tệp chuẩn xác)
    if (msg.chat.type === 'private' && msg.from.id.toString() !== ADMIN_ID && !msg.from.is_bot) {
        if (msg.text && msg.text.startsWith('/')) return;
        const userId = msg.from.id.toString(); 
        let user = await User.findOne({ userId: userId });

        // Trường hợp khách gửi Bill nạp tiền
        if (msg.photo && user && user.topUpStatus === 'waiting_bill') {
            user.topUpStatus = 'awaiting_admin'; await user.save();
            bot.sendMessage(userId, `⏳ <b>ĐÃ NHẬN BILL</b>\nBot đã chuyển biên lai tới Đội ngũ. Vui lòng chờ 1-3 phút.`, {parse_mode: 'HTML'}).catch(()=>{});
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            bot.sendPhoto(ADMIN_ID, photoId, { caption: `🚨 <b>BILL NẠP TIỀN</b>\nKhách: ${user.firstName}\n🆔 ID: <code>${user.userId}</code>\n💰 Số lượng: <b>${user.pendingSWGT} SWGT</b>\n👉 Reply ảnh gõ "xong" để duyệt.`, parse_mode: 'HTML' }).catch(()=>{});
            return; 
        }

        // Trường hợp khách nhắn tin thường hoặc gửi ảnh/file hỏi đáp
        const name = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
        const username = msg.from.username ? `@${msg.from.username}` : 'Không có';
        const replyMarkupAdmin = { inline_keyboard: [[{ text: "💬 Chat trực tiếp với khách", url: `tg://user?id=${userId}` }]] };

        if (msg.photo) {
            // Lấy id của bức ảnh có độ phân giải cao nhất
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            let alertMsg = `📩 <b>ẢNH TỪ KHÁCH HÀNG</b>\n👤 Khách: <b>${name}</b>\n🔗 Username: ${username}\n🆔 ID: <code>${userId}</code>\n`;
            if (msg.caption) alertMsg += `\n💬 <b>Nội dung:</b> ${msg.caption}\n`;
            alertMsg += `\n👉 <i>Admin hãy Reply trực tiếp lên bức ảnh này để chat lại với khách!</i>`;
            
            // Gửi trực tiếp ảnh cho admin kèm caption chứa ID
            bot.sendPhoto(ADMIN_ID, photoId, { caption: alertMsg, parse_mode: 'HTML', reply_markup: replyMarkupAdmin }).catch(()=>{});
        } 
        else if (msg.video || msg.document) {
            // Forward tệp/video
            bot.forwardMessage(ADMIN_ID, chatId, msg.message_id).catch(()=>{});
            let alertMsg = `📩 <b>TỆP/VIDEO TỪ KHÁCH HÀNG</b>\n👤 Khách: <b>${name}</b>\n🔗 Username: ${username}\n🆔 ID: <code>${userId}</code>\n`;
            if (msg.caption) alertMsg += `\n💬 <b>Nội dung:</b> ${msg.caption}\n`;
            alertMsg += `\n👉 <i>Admin hãy Reply tin nhắn này để chat lại với khách!</i>`;
            bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML', reply_markup: replyMarkupAdmin }).catch(()=>{});
        }
        else {
            // Khách gửi chữ bình thường
            let alertMsg = `📩 <b>TIN NHẮN TỪ KHÁCH HÀNG</b>\n👤 Khách: <b>${name}</b>\n🔗 Username: ${username}\n🆔 ID: <code>${userId}</code>\n\n💬 <b>Nội dung:</b>\n${msg.text}\n\n👉 <i>Admin hãy Reply tin nhắn này để chat lại với khách!</i>`;
            bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML', reply_markup: replyMarkupAdmin }).catch(()=>{});
        }
        
        bot.sendMessage(userId, `👋 Yêu cầu của bạn đã được chuyển đến <b>Đội ngũ chuyên gia</b>. Vui lòng chờ phản hồi nhé!`, { parse_mode: 'HTML' }).catch(()=>{});
    }
});

console.log("🚀 Bot Telegram SWC Pass đã khởi động (Bản Mới Nhất - Bổ sung thông tin)! ");
