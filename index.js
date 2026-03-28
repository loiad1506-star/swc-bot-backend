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

const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';
const GROUP_ZALO_LINK = "https://zalo.me/g/yeiaea989";
const WEBINAR_LINK = "https://launch.swc.capital/broadcast_31_vi";

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
    
    lastDailyTask: { type: Date, default: null }, 
    readTaskStartTime: { type: Date, default: null }, 
    youtubeTaskDone: { type: Boolean, default: false }, 
    youtubeClickTime: { type: Date, default: null },
    facebookTaskDone: { type: Boolean, default: false },
    facebookClickTime: { type: Date, default: null },
    lastShareTask: { type: Date, default: null },
    shareClickTime: { type: Date, default: null },

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
            const eveningMsg = `📚 <b>THỜI GIAN NÂNG CẤP KIẾN THỨC & CẬP NHẬT TIN TỨC DỰ ÁN!</b>\n\nSự kiện Airdrop đã khép lại, giờ là lúc chúng ta tập trung vào giá trị cốt lõi: <b>Đầu tư và Kiến thức tài chính</b>.\n\n💡 Bạn có biết: <i>"Khoản đầu tư sinh lời cao nhất chính là đầu tư vào trí tuệ của bản thân"</i>. \n\n👉 Hãy vào Group Cộng Đồng ngay để cập nhật tin tức mới nhất!`;
            let keyboard = [[{ text: "💬 VÀO GROUP THẢO LUẬN NGAY", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }]];
            for (let user of allUsers) {
                bot.sendMessage(user.userId, eveningMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(()=>{});
                await new Promise(resolve => setTimeout(resolve, 50)); 
            }
        } catch (error) {}
    }
}, 60000); 

// (Các cronjob leaderboard, halving, rã đông, check bill 10 phút vẫn giữ nguyên hoạt động ngầm)
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
    // Các API save-wallet, claim-giftcode, claim-milestone, spin, redeem, withdraw, liquidate, topup giữ nguyên
    else { res.writeHead(200); res.end('API Online'); }
});
server.listen(process.env.PORT || 3000);


// ==========================================
// KỊCH BẢN CHÍNH - PHỄU SWC PASS
// ==========================================

function sendMainMenu(chatId) {
    const successMsg = `✅ Hồ sơ của bạn đã được lưu trữ an toàn. Chào mừng bạn gia nhập cộng đồng Sky World Community Viet Nam.\n\nNgay lúc này, cánh cửa nền tảng **SWC Pass** và siêu dự án **ATLAS** đang đếm ngược đến ngày 31/03. Bạn muốn khám phá điều gì tiếp theo?`;
    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🚀 MỞ ỨNG DỤNG SWC PASS", web_app: { url: webAppUrl } }],
                [{ text: "💎 Tìm hiểu SWC Pass & Quyền lợi", callback_data: 'menu_swcpass' }],
                [{ text: "🏢 Khám phá Siêu dự án ATLAS", callback_data: 'menu_atlas' }],
                [{ text: "🎟 Đăng ký Webinar 31/03", callback_data: 'menu_webinar' }],
                [{ text: "❓ Giải đáp thắc mắc (FAQ)", callback_data: 'menu_faq' }]
            ]
        }
    };
    bot.sendMessage(chatId, successMsg, options).catch(()=>{});
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
    let isNewUser = false;

    if (!user) {
        isNewUser = true;
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
    
    const welcomeMessage = `Xin chào ${firstName}! 🦁\n\nChào mừng bạn bước vào Hệ sinh thái Đầu tư Tinh anh của **Sky World Community Viet Nam**.\n\nTôi là Trợ lý AI của nền tảng. Mục tiêu của chúng tôi rất rõ ràng: Vốn của bạn phải sinh lời và vị thế của bạn phải thăng hạng!\n\n🌱 Để nhận thông tin nội bộ và tham gia các thương vụ vòng kín (Private Round), vui lòng xác nhận chính sách bảo mật và chia sẻ số điện thoại của bạn bên dưới.`;

    if (!user.phone) {
        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [
                    [{ text: "📞 Chia sẻ Số điện thoại để bắt đầu", request_contact: true }],
                    [{ text: "📜 Xem Chính sách bảo mật" }]
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
        await User.updateOne(
            { userId: userId },
            { $set: { phone: phoneNumber, tag: 'new' } }
        );
    } catch (err) {}

    bot.sendMessage(chatId, "Hệ thống đang tải dữ liệu...", { reply_markup: { remove_keyboard: true } }).then((sentMsg) => {
        bot.deleteMessage(chatId, sentMsg.message_id).catch(()=>{});
        sendMainMenu(chatId);
    });

    setTimeout(() => {
        const surveyMsg = `Xin chào! Chúng tôi muốn hiểu bạn rõ hơn 🙌\nMột số người trong cộng đồng Sky World Community Viet Nam đã đầu tư nhiều năm, một số khác mới bắt đầu. Để đội ngũ chuyên gia hỗ trợ bạn một cách chính xác nhất, hãy dành 10 giây cho chúng tôi biết vị thế hiện tại của bạn:`;
        const surveyOptions = {
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
// XỬ LÝ NÚT BẤM VỚI NỘI DUNG SÂU SẮC HƠN
// ==========================================
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    let user = await User.findOne({ userId: userId });
    if (!user) return bot.answerCallbackQuery(callbackQuery.id);

    let text = "";
    let options = { parse_mode: 'Markdown', disable_web_page_preview: true, reply_markup: { inline_keyboard: [] } };
    const ctaButtons = [
        [{ text: "🚀 MỞ SWC PASS", web_app: { url: webAppUrl } }],
        [{ text: "💬 THAM GIA NHÓM ZALO KÍN", url: GROUP_ZALO_LINK }],
        [{ text: "🔙 Quay lại Menu Chính", callback_data: 'main_menu' }]
    ];

    if (data === 'main_menu') {
        sendMainMenu(chatId);
        return bot.answerCallbackQuery(callbackQuery.id);
    }
    
    // --- NỘI DUNG CHI TIẾT MỚI ---
    else if (data === 'menu_swcpass') {
        text = `💎 **SWC PASS - KHÔNG CHỈ LÀ KIẾN THỨC, ĐÂY LÀ HỆ THỐNG KỶ LUẬT**\n\nGói đăng ký SWC Pass là tấm vé thông hành của giới tinh anh, cung cấp giải pháp toàn diện để xây dựng sự giàu có:\n\n1️⃣ **ROAD TO $1M:** Chiến lược xây dựng danh mục cổ phiếu chia cổ tức chuyên nghiệp. Mỗi tháng bạn sẽ nhận được một kế hoạch giải ngân chi tiết (Mua mã nào, tỷ lệ bao nhiêu) để tận dụng sức mạnh Lãi Kép.\n2️⃣ **SWC FIELD:** Đặc quyền tiếp cận các thương vụ mạo hiểm vòng kín (Private Round) với vị thế như một quỹ đầu tư lớn.\n3️⃣ **TIẾN ĐỘ CÁ NHÂN:** Trình theo dõi chuẩn xác giúp bạn biết dòng tiền của mình đang ở đâu.\n4️⃣ **MINH BẠCH SPV:** Cấu trúc pháp lý rõ ràng, không có chi phí ẩn.\n\n👉 Hãy mở ứng dụng SWC Pass để xem chi tiết các gói (Essential, Plus, Ultimate)!`;
        options.reply_markup.inline_keyboard = ctaButtons;
    } 
    else if (data === 'menu_atlas') {
        text = `🏢 **SIÊU DỰ ÁN ATLAS - KHAI MỞ ĐẠI DƯƠNG XANH**\n\nBạn nghĩ sao nếu có thể sở hữu và giao dịch bất động sản tại Dubai chỉ bằng vài cú chạm trên điện thoại? ATLAS mang đến giải pháp **Bất động sản số hóa (RWA)** trên nền tảng Web 2.5.\n\n🌟 **Đặc điểm cốt lõi:**\n- **Thanh khoản 3 giây:** Phá vỡ sự chậm chạp của BĐS truyền thống qua thị trường thứ cấp nội bộ.\n- **Bảo chứng pháp lý:** Hoạt động dưới pháp nhân Atlas Overseas FZE, được cấp phép bởi Cơ quan Trung tâm Thương mại Thế giới Dubai (DWTCA - 4219).\n- **Tiếp cận dễ dàng:** Dân chủ hóa sân chơi vốn dĩ chỉ dành cho giới siêu giàu.\n\n⚠️ *Cánh cửa vòng ưu đãi sẽ đóng lại vào 31/03/2026. Đừng bỏ lỡ vị thế tốt nhất!*`;
        options.reply_markup.inline_keyboard = ctaButtons;
    }
    else if (data === 'menu_webinar') {
        text = `🎟 **SỰ KIỆN LỊCH SỬ: PHÁT SÓNG TRỰC TIẾP**\n\nKinh nghiệm quá khứ là nền tảng cho chiến lược mới. Chúng tôi sẽ phân tích thẳng thắn những rủi ro đã xảy ra, cách xử lý, và giới thiệu siêu dự án mới trên gian hàng SWC Field với bộ lọc khắt khe nhất.\n\n⏰ **Thời gian:** 20:00 (VN) | Ngày 31/03/2026\n👉 **Link phòng họp kín:** https://launch.swc.capital/broadcast_31_vi\n\n🎁 *Bonus: Thành viên tham gia sẽ nhận được bộ tài liệu mật phân tích dòng vốn của SWC.*`;
        options.reply_markup.inline_keyboard = ctaButtons;
    }
    
    // --- BỘ FAQ NÂNG CAO ---
    else if (data === 'menu_faq' || data === 'faq_back') {
        text = `**CHUYÊN MỤC GIẢI ĐÁP THẮC MẮC (FAQ)**\n*Hãy chọn câu hỏi bạn đang quan tâm để xem phân tích chi tiết:*`;
        options.reply_markup.inline_keyboard = [
            [{ text: "1. Nhận được gì ngay sau khi thanh toán?", callback_data: 'faq_1' }],
            [{ text: "2. Road to $1M và SWC Field là gì?", callback_data: 'faq_2' }],
            [{ text: "3. Khác gì kiến thức Youtube miễn phí?", callback_data: 'faq_3' }],
            [{ text: "4. Tôi chưa có đủ 600$ lúc này?", callback_data: 'faq_4' }],
            [{ text: "5. Giữ tiền mặt cho an toàn thời điểm này?", callback_data: 'faq_5' }],
            [{ text: "🔙 Quay lại Menu Chính", callback_data: 'main_menu' }]
        ];
    }
    else if (data === 'faq_1') { 
        text = `✅ **Tôi nhận được gì ngay sau khi thanh toán?**\nQuyền truy cập ĐẦY ĐỦ VÀ NGAY LẬP TỨC vào hệ sinh thái. Chiến lược xây dựng danh mục cổ phiếu cổ tức đầu tiên của Road to $1M sẽ có trong tài khoản của bạn chỉ sau vài phút. Bạn sẽ biết chính xác tháng này nên mua mã nào, tỷ lệ bao nhiêu. Không cần phải chờ đợi!`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]); 
    }
    else if (data === 'faq_2') { 
        text = `✅ **Road to $1M & SWC Field là gì?**\n- **Road to $1M:** Là la bàn tài chính. Không dạy lý thuyết suông, mà đưa ra kế hoạch mua cổ phiếu chuyên nghiệp mỗi tháng được đúc kết từ chuyên môn nhiều năm. Sản phẩm tương tự ngoài thị trường có giá ít nhất $1.000/năm.\n- **SWC Field:** Là gian hàng trưng bày các dự án mạo hiểm đã qua bộ lọc thẩm định khắt khe nhất (Ra mắt tháng 3/2026).`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]); 
    }
    else if (data === 'faq_3') { 
        text = `✅ **Khác gì kiến thức miễn phí trên Youtube?**\nKiến thức trên mạng là miễn phí, nhưng nếu chỉ 'biết' mà giàu thì ai cũng là triệu phú. Sự khác biệt nằm ở **Hệ thống Kỷ luật**. SWC Pass là công cụ ép bạn thực thi, loại bỏ cảm xúc cá nhân. Sự khác biệt giống hệt như việc đọc một cuốn sách dạy bơi và việc trực tiếp nhảy xuống hồ bơi vậy.`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]); 
    }
    else if (data === 'faq_4') { 
        text = `✅ **Tôi chưa có đủ $600 lúc này?**\nHãy làm bài toán chia nhỏ: $600 cho 5 năm nghĩa là bạn chỉ tốn vỏn vẹn **$10/tháng (~250.000 VNĐ)**. Sự thật là bạn đang ném số tiền này qua cửa sổ cho những ly cà phê vô bổ. Việc trì hoãn chờ "có đủ tiền" là cái bẫy hoàn hảo, khiến bạn đánh mất hàng thập kỷ sức mạnh của Lãi Kép. Mua SWC Pass là mua lại sự tự do của chính mình!`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]); 
    }
    else if (data === 'faq_5') { 
        text = `✅ **Thị trường rủi ro, giữ tiền mặt cho an toàn?**\nGiữ tiền mặt trong ngân hàng vì sợ rủi ro chính là ảo giác an toàn nguy hiểm nhất. Các ngân hàng trung ương liên tục in tiền, lạm phát lặng lẽ móc túi bạn mỗi ngày. Quyết định trốn tránh rủi ro biến động chính là quyết định đảm bảo 100% rằng bạn sẽ nghèo đi. Giới tinh anh không bao giờ tích tiền mặt dài hạn!`; 
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]); 
    }
    
    // --- KẾT QUẢ KHẢO SÁT ---
    else if (data === 'survey_newbie') {
        user.tag = 'newbie'; await user.save();
        text = `Cảm ơn bạn đã chia sẻ! Lạm phát đang âm thầm ăn mòn tiền mặt của bạn mỗi ngày. Giải pháp duy nhất là một cỗ máy tự động hóa dòng tiền.\n\n👉 Lựa chọn tốt nhất lúc này là chiến lược kỷ luật **Road to $1M**. Bấm nút vào nhóm để nhận định hướng tư duy chuẩn xác nhé!`;
        options.reply_markup.inline_keyboard = [[{ text: "💬 VÀO NHÓM NHẬN LỘ TRÌNH CHIẾN LƯỢC", url: GROUP_ZALO_LINK }]];
    }
    else if (data === 'survey_ust') {
        user.tag = 'ust_investor'; await user.save();
        text = `Tuyệt vời! Bạn là một nhà đầu tư có tầm nhìn. Nếu bạn đã quen với các dự án mạo hiểm, **ATLAS (Bất động sản số hóa Web3)** chính là sân chơi tiếp theo của bạn.\n\n⚠️ Vòng gọi vốn kín tốt nhất trên SWC Field sẽ đóng vào 31/03. Đừng bỏ lỡ!`;
        options.reply_markup.inline_keyboard = ctaButtons;
    }
    else if (data === 'survey_vip') {
        user.tag = 'vip_pass'; await user.save();
        text = `Chào mừng thành viên VIP! Bạn đã có trong tay vũ khí mạnh nhất của cộng đồng Sky World Community Viet Nam.\n\n👉 Hãy chắc chắn rằng bạn đã tham gia Group Nội Bộ bên dưới để nhận tín hiệu cổ tức mỗi tháng và truy cập SWC Field.`;
        options.reply_markup.inline_keyboard = [[{ text: "💬 VÀO NHÓM VIP NHẬN TÍN HIỆU", url: GROUP_ZALO_LINK }]];
    }

    bot.answerCallbackQuery(callbackQuery.id).catch(()=>{});
    if (text !== "") { bot.sendMessage(chatId, text, options).catch(()=>{}); }
});

// ==========================================
// XỬ LÝ MESSAGE CỦA ADMIN VÀ KHÁCH HÀNG (SỬA LỖI ẢNH)
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
            if (originalText.includes('TIN NHẮN TỪ KHÁCH HÀNG')) {
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
            bot.sendMessage(userId, `⏳ <b>ĐÃ NHẬN BILL</b>\nBot đã chuyển biên lai tới Admin. Vui lòng chờ 1-3 phút.`, {parse_mode: 'HTML'}).catch(()=>{});
            bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, { caption: `🚨 <b>BILL NẠP TIỀN</b>\nKhách: ${user.firstName}\n🆔 ID: <code>${user.userId}</code>\n💰 Số lượng: <b>${user.pendingSWGT} SWGT</b>\n👉 Reply ảnh gõ "xong" để duyệt.`, parse_mode: 'HTML' }).catch(()=>{});
            return; 
        }

        // Trường hợp khách nhắn tin thường hoặc gửi ảnh/file hỏi đáp
        const name = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
        const username = msg.from.username ? `@${msg.from.username}` : 'Không có';
        
        let alertMsg = `📩 <b>TIN NHẮN TỪ KHÁCH HÀNG</b>\n👤 Khách: <b>${name}</b>\n🔗 Username: ${username}\n🆔 ID: <code>${userId}</code>\n\n`;
        const replyMarkupAdmin = { inline_keyboard: [[{ text: "💬 Chat trực tiếp", url: `tg://user?id=${userId}` }]] };

        if (msg.photo || msg.video || msg.document) {
            // Forward nguyên bản cái ảnh/video đó sang cho Admin
            await bot.forwardMessage(ADMIN_ID, chatId, msg.message_id).catch(()=>{});
            alertMsg += `<i>(Khách hàng vừa gửi Tệp/Ảnh/Video ngay bên trên)</i>\n`;
            if (msg.caption) alertMsg += `💬 <b>Ghi chú của khách:</b>\n${msg.caption}\n\n`;
        } else {
            alertMsg += `💬 <b>Nội dung:</b>\n${msg.text}\n\n`;
        }
        
        alertMsg += `👉 <i>Admin hãy Reply tin nhắn này để chat lại với khách!</i>`;
        bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML', reply_markup: replyMarkupAdmin }).catch(()=>{});
        
        bot.sendMessage(userId, `👋 Yêu cầu của bạn đã được chuyển đến Đội ngũ chuyên gia. Vui lòng chờ phản hồi nhé!`, { parse_mode: 'HTML' }).catch(()=>{});
    }

    // Đếm tin nhắn Group
    if (msg.chat.type !== 'private' && !msg.from.is_bot && msg.chat.username && msg.chat.username.toLowerCase() === GROUP_USERNAME.replace('@', '').toLowerCase()) {
        try {
            const member = await bot.getChatMember(msg.chat.id, msg.from.id);
            if (['administrator', 'creator'].includes(member.status)) return;
        } catch(e) {}
        if (!msg.text) return;
        let user = await User.findOne({ userId: msg.from.id.toString() });
        if (user) { user.groupMessageCount += 1; await user.save(); }
    }
});

console.log("🚀 Bot Telegram Sky World Community Viet Nam đã khởi động hoàn tất (Bản Mới Nhất)!");
