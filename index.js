const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');
const mongoose = require('mongoose');

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG ---
const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGODB_URI;
const bot = new TelegramBot(token, {polling: true});
const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';

const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';

// --- KẾT NỐI MONGODB (KÉT SẮT DỮ LIỆU) ---
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Đã kết nối thành công với kho dữ liệu MongoDB!'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// --- TẠO CẤU TRÚC LƯU TRỮ NGƯỜI DÙNG (Thêm Ngày điểm danh) ---
const userSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    firstName: { type: String, default: '' }, 
    lastName: { type: String, default: '' },  
    username: { type: String, default: '' },  
    balance: { type: Number, default: 0 },
    wallet: { type: String, default: '' },
    referredBy: { type: String, default: null }, 
    referralCount: { type: Number, default: 0 }, 
    task1Done: { type: Boolean, default: false }, 
    walletRewardDone: { type: Boolean, default: false }, 
    lastDailyTask: { type: Date, default: null }, 
    readTaskStartTime: { type: Date, default: null }, 
    lastShareTask: { type: Date, default: null },
    groupMessageCount: { type: Number, default: 0 },
    lastCheckInDate: { type: Date, default: null } 
});
const User = mongoose.model('User', userSchema);

// --- 1. API SERVER CHO MINI APP ---
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.end(); return; }
    const parsedUrl = url.parse(req.url, true);
    
    // 1. API Lấy thông tin User
    if (parsedUrl.pathname === '/api/user' && req.method === 'GET') {
        const userId = parsedUrl.query.id;
        let userData = await User.findOne({ userId: userId });
        if (!userData) userData = { balance: 0, wallet: '', referralCount: 0 };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(userData));
    } 
    // 2. API Lưu Ví
    else if (parsedUrl.pathname === '/api/save-wallet' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (user) {
                    user.wallet = data.wallet;
                    if (!user.walletRewardDone) {
                        user.balance += 10;
                        user.walletRewardDone = true;
                        bot.sendMessage(data.userId, `🎉 <b>CHÚC MỪNG!</b>\nBạn đã kết nối ví thành công, +10 SWGT!`, {parse_mode: 'HTML'}).catch(()=>{});
                    }
                    await user.save();
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    } 
    // 3. API Đổi Quà VIP (O2O)
    else if (parsedUrl.pathname === '/api/redeem' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (user && user.balance >= data.cost) {
                    user.balance -= data.cost;
                    await user.save();
                    bot.sendMessage(data.userId, `🎉 <b>ĐỔI THƯỞNG THÀNH CÔNG!</b>\nQuản trị viên sẽ liên hệ để trao quyền lợi: <b>${data.itemName}</b>.`, {parse_mode: 'HTML'}).catch(()=>{});
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance }));
                } else {
                    res.writeHead(400); res.end(JSON.stringify({ success: false }));
                }
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    // 4. API Điểm danh mỗi ngày (+2 SWGT)
    else if (parsedUrl.pathname === '/api/checkin' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (user) {
                    const now = new Date();
                    const lastCheckin = user.lastCheckInDate ? new Date(user.lastCheckInDate) : new Date(0);
                    if (lastCheckin.toDateString() !== now.toDateString()) {
                        user.balance += 2; 
                        user.lastCheckInDate = now;
                        await user.save();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, balance: user.balance, lastCheckInDate: now }));
                        return;
                    }
                }
                res.writeHead(400); res.end(JSON.stringify({ success: false, message: 'Hôm nay đã điểm danh' }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    // 5. API Lấy Bảng xếp hạng Top 10
    else if (parsedUrl.pathname === '/api/leaderboard' && req.method === 'GET') {
        try {
            const topUsers = await User.find({ referralCount: { $gt: 0 } })
                                       .sort({ referralCount: -1 })
                                       .limit(10)
                                       .select('firstName lastName referralCount');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(topUsers));
        } catch (e) { res.writeHead(400); res.end(); }
    }
    else {
        res.writeHead(200); res.end('API SWC Online!\n');
    }
});
server.listen(process.env.PORT || 3000, () => console.log(`[HỆ THỐNG] Máy chủ API đang chạy`));

// --- 2. HÀM KIỂM TRA THÀNH VIÊN ---
async function checkMembership(userId) {
    try {
        const channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        const validStatuses = ['member', 'administrator', 'creator'];
        return { 
            inChannel: validStatuses.includes(channelMember.status), 
            inGroup: validStatuses.includes(groupMember.status) 
        };
    } catch (error) { return { error: true }; }
}

// --- 3. XỬ LÝ LỆNH /start ---
bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== 'private') return; 

    const userId = msg.from.id.toString();
    const refId = match[1].trim(); 

    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username ? `@${msg.from.username}` : '';

    let user = await User.findOne({ userId: userId });
    let isNewUser = false;

    if (!user) {
        isNewUser = true;
        user = new User({ 
            userId: userId, firstName: firstName, lastName: lastName, username: username 
        });
        
        // --- XỬ LÝ NGƯỜI MỜI (Cộng trước 10 SWGT & Bắn thông báo) ---
        if (refId && refId !== userId) {
            user.referredBy = refId;
            
            let referrer = await User.findOne({ userId: refId });
            if (referrer) {
                referrer.balance += 10; // Cộng trước 10 SWGT
                await referrer.save();
                
                const notifyMsg = `🎉 <b>CÓ NGƯỜI MỚI THAM GIA!</b>\n\n👤 <b>Tên:</b> ${firstName} ${lastName}\n🆔 <b>ID:</b> <code>${userId}</code>\nĐã bấm vào link mời của bạn!\n\n🎁 Bạn vừa được cộng trước <b>10 SWGT</b>.\n\n⚠️ <b>BƯỚC CUỐI:</b> Hãy nhắn tin hướng dẫn họ làm "Nhiệm vụ Tân binh" (tham gia nhóm và chat) để bạn được cộng thêm <b>10 SWGT</b> nữa nhé!`;
                bot.sendMessage(refId, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    } else {
        user.firstName = firstName; user.lastName = lastName; user.username = username;
    }
    await user.save();
    
    let welcomeText = `👋 <b>Chào mừng bạn đến với Cộng Đồng SWC Việt Nam!</b> 🚀\n\nBạn đã bước chân vào trung tâm kết nối của những nhà đầu tư tiên phong. Cơ hội sở hữu trước token SWGT và đón đầu xu hướng công nghệ giao thông uST đang ở ngay trước mắt, nhưng số lượng thì có hạn!\n\n🎁 <b>Quà tặng Tân Binh:</b> Nhận ngay những đồng SWGT đầu tiên hoàn toàn miễn phí.\n\n👇 <b>HÀNH ĐỘNG NGAY:</b> Bấm nút <b>"MỞ ỨNG DỤNG SWC NGAY"</b> bên dưới để kích hoạt ví và gia tăng tài sản!`;
    
    if (isNewUser && refId && refId !== userId) {
        welcomeText = `🎉 <i>Bạn được mời bởi thành viên ID: ${refId}</i>\n\n` + welcomeText;
    }

    const opts = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "1️⃣ Nhiệm vụ Tân binh", callback_data: 'task_1' }],
                [{ text: "2️⃣ Nhiệm vụ Kiến thức", callback_data: 'task_2' }],
                [{ text: "3️⃣ Tăng trưởng (Mời bạn bè)", callback_data: 'task_3' }],
                [{ text: "🎁 Đặc quyền & Đổi thưởng", callback_data: 'task_4' }],
                [{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]
            ]
        }
    };
    
    bot.sendPhoto(chatId, './Bia.jpg', {
        caption: welcomeText,
        parse_mode: 'HTML',
        reply_markup: opts.reply_markup
    }).catch(err => {
        bot.sendMessage(chatId, welcomeText, opts);
    });
});

// --- 4. CAMERA CHẠY NGẦM: LỌC BOT, ĐẾM TIN NHẮN, TRỪ TIỀN RỜI NHÓM ---
bot.on('message', async (msg) => {
    if (msg.left_chat_member) {
        const leftUserId = msg.left_chat_member.id.toString();
        let leftUser = await User.findOne({ userId: leftUserId });
        if (leftUser && leftUser.task1Done) {
            leftUser.balance = Math.max(0, leftUser.balance - 20); 
            leftUser.task1Done = false; 
            await leftUser.save();
            bot.sendMessage(leftUserId, `⚠️ <b>CẢNH BÁO!</b>\nHệ thống phát hiện bạn đã rời khỏi Cộng Đồng SWC. Tài khoản của bạn đã bị trừ <b>20 SWGT</b>. Hãy tham gia lại để khôi phục!`, {parse_mode: 'HTML'}).catch(()=>{});
        }
        return; 
    }

    if (msg.chat.type === 'private' || msg.from.is_bot) return;
    if (msg.chat.username && msg.chat.username.toLowerCase() !== GROUP_USERNAME.replace('@', '').toLowerCase()) return;

    try {
        const member = await bot.getChatMember(msg.chat.id, msg.from.id);
        if (['administrator', 'creator'].includes(member.status)) return;
    } catch(e) {}

    if (!msg.text) return;

    const userId = msg.from.id.toString();
    let user = await User.findOne({ userId: userId });
    
    if (!user) {
        user = new User({ 
            userId: userId, 
            firstName: msg.from.first_name || '', 
            lastName: msg.from.last_name || '', 
            username: msg.from.username ? `@${msg.from.username}` : '' 
        });
    }

    user.groupMessageCount += 1; 

    if (msg.text.trim().length >= 10) {
        user.balance = Math.round((user.balance + 0.3) * 100) / 100;
    }
    await user.save();
});

// --- 5. XỬ LÝ NÚT BẤM (Nâng cấp trả thưởng F1 & Milestone) ---
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    let user = await User.findOne({ userId: userId });
    if (!user) return bot.answerCallbackQuery(callbackQuery.id);

    // --- NÚT 1: TÂN BINH ---
    if (data === 'task_1') {
        const opts = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔵 Join Kênh Thông tin uST", url: "https://t.me/swc_capital_vn" }],
                    [{ text: "💬 Join Group Cộng Đồng SWC", url: "https://t.me/swc_capital_chat" }],
                    [{ text: "✅ KIỂM TRA & NHẬN THƯỞNG", callback_data: 'check_join' }]
                ]
            }
        };
        const task1Text = `🎯 <b>BƯỚC 1: LẤY VỐN KHỞI NGHIỆP</b>\n\nHoàn thành ngay để "bỏ túi" <b>30 SWGT</b> đầu tiên:\n\n1️⃣ <b>Join Kênh & Group Cộng Đồng SWC Việt Nam</b> (+20 SWGT).\n2️⃣ <b>Gửi ít nhất 2 tin nhắn chào hỏi</b> lên Group để xác minh NĐT thật.\n3️⃣ <b>Mở App Kết nối Ví Crypto</b> (+10 SWGT).\n\n⚠️ <i>Lưu ý: Rời nhóm = Trừ sạch điểm số!</i>`;
        bot.sendMessage(chatId, task1Text, opts);
    } 
    
    // --- KIỂM TRA THAM GIA NHÓM ---
    else if (data === 'check_join') {
        const status = await checkMembership(userId);
        if (status.error) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bot chưa được cấp quyền Admin trong Nhóm/Kênh!", show_alert: true });
        } else if (status.inChannel && status.inGroup) {
            
            if (user.groupMessageCount < 2) {
                bot.answerCallbackQuery(callbackQuery.id, { 
                    text: `❌ TÀI KHOẢN CHƯA XÁC MINH!\n\nBạn đã vào nhóm nhưng chưa gửi đủ 2 tin nhắn. Bạn mới gửi: ${user.groupMessageCount}/2.\n\nHãy vào Nhóm nhắn tin chào hỏi rồi quay lại kiểm tra nhé!`, 
                    show_alert: true 
                });
            } else {
                if (!user.task1Done) {
                    // 1. Thưởng cho người làm nhiệm vụ
                    user.balance += 20; 
                    user.task1Done = true;
                    await user.save();
                    
                    // 2. KÍCH HOẠT THƯỞNG CHO NGƯỜI GIỚI THIỆU (F1)
                    if (user.referredBy) {
                        let referrer = await User.findOne({ userId: user.referredBy });
                        if (referrer) {
                            referrer.balance += 10; // CỘNG NỐT 10 SWGT CUỐI CÙNG
                            referrer.referralCount += 1; // Chỉ khi làm xong mới tính là 1 ref thành công
                            
                            let milestoneMsg = "";
                            if (referrer.referralCount === 10) {
                                referrer.balance += 50;
                                milestoneMsg = "\n🌟 <b>THƯỞNG MỐC 10 NGƯỜI:</b> +50 SWGT!";
                            } else if (referrer.referralCount === 50) {
                                referrer.balance += 300;
                                milestoneMsg = "\n👑 <b>THƯỞNG MỐC 50 NGƯỜI:</b> +300 SWGT!";
                            }
                            await referrer.save();
                            
                            bot.sendMessage(user.referredBy, `🔥 <b>TING TING!</b>\nThành viên (${user.firstName}) bạn mời vừa xác minh tài khoản thành công.\n🎁 Bạn được cộng thêm <b>+10 SWGT</b> (Đã hoàn tất 20 SWGT/người)!${milestoneMsg}`, {parse_mode: 'HTML'}).catch(()=>{});
                        }
                    }

                    bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Tuyệt vời! Xác minh thành công, +20 SWGT.", show_alert: true });
                    bot.sendMessage(chatId, "🔥 <b>XÁC MINH TÀI KHOẢN THÀNH CÔNG!</b>\n\nHệ thống đã ghi nhận bạn là Nhà đầu tư thật.\n🎁 <b>Phần thưởng:</b> +20 SWGT.\n\n👉 <i>Bấm mở App ngay để kết nối ví nhận thêm +10 SWGT nữa nhé!</i>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]] }});
                } else {
                    bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã hoàn thành nhiệm vụ này và nhận thưởng rồi nhé!", show_alert: true });
                }
            }
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Bạn chưa tham gia đủ Kênh và Nhóm. Hãy làm ngay kẻo mất phần thưởng!", show_alert: true });
        }
    }
    
    // --- NÚT 2: KIẾN THỨC & CHIA SẺ ---
    else if (data === 'task_2') {
        user.readTaskStartTime = new Date();
        await user.save();

        const task2Text = `🧠 <b>NẠP KIẾN THỨC & LAN TỎA (Nhiệm vụ hàng ngày)</b>\n\n` +
                          `<b>1. NGUỒN VỐN TRÍ TUỆ (+10 SWGT)</b>\n` +
                          `⏱ Yêu cầu: Bấm đọc 1 bài viết bất kỳ trên web đủ 60 giây.\n\n` +
                          `<b>2. SỨ GIẢ LAN TỎA (+15 SWGT)</b>\n` +
                          `📢 Yêu cầu: Chia sẻ dự án lên các nhóm chat hoặc mạng xã hội.\n\n` +
                          `<i>Lưu ý: Hệ thống đếm giờ tự động. Nếu chưa đủ 60s sẽ không thể nhận thưởng!</i>`;
        
        bot.sendMessage(chatId, task2Text, { 
            parse_mode: 'HTML', 
            reply_markup: { inline_keyboard: [
                [{ text: "📖 ĐỌC BÀI VIẾT (Đợi 60s)", url: "https://hovanloi.net" }],
                [{ text: "🎁 NHẬN THƯỞNG ĐỌC BÀI (+10 SWGT)", callback_data: 'claim_read' }],
                [{ text: "📢 CHIA SẺ LÊN MXH / NHÓM CHAT", url: "https://t.me/share/url?url=https://t.me/Dau_Tu_SWC_bot&text=Cơ%20hội%20nhận%20SWGT%20miễn%20phí%20từ%20Cộng%20Đồng%20SWC!" }],
                [{ text: "🎁 NHẬN THƯỞNG CHIA SẺ (+15 SWGT)", callback_data: 'claim_share' }]
            ] } 
        });
    } 
    
    else if (data === 'claim_read') {
        const now = new Date();
        const startTime = user.readTaskStartTime ? new Date(user.readTaskStartTime) : now;
        const timeSpent = (now - startTime) / 1000; 
        
        const lastTask = user.lastDailyTask ? new Date(user.lastDailyTask) : new Date(0);
        const diffInHours = Math.abs(now - lastTask) / 36e5;
        
        if (diffInHours < 24) {
            const waitHours = Math.ceil(24 - diffInHours);
            bot.answerCallbackQuery(callbackQuery.id, { text: `⏳ Bạn đã nhận thưởng đọc bài hôm nay rồi! Quay lại sau ${waitHours} tiếng nhé.`, show_alert: true });
        } else if (timeSpent < 60) {
            bot.answerCallbackQuery(callbackQuery.id, { text: `⚠️ Bạn chưa đọc đủ 1 phút! Hãy nán lại trang web lâu hơn nhé!`, show_alert: true });
        } else {
            user.balance += 10;
            user.lastDailyTask = now;
            await user.save();
            bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Tuyệt vời! Bạn đã nhận thành công +10 SWGT cho nhiệm vụ đọc bài!", show_alert: true });
        }
    }

    else if (data === 'claim_share') {
        const now = new Date();
        const lastShare = user.lastShareTask ? new Date(user.lastShareTask) : new Date(0);
        const diffInHours = Math.abs(now - lastShare) / 36e5;
        
        if (diffInHours < 24) {
            const waitHours = Math.ceil(24 - diffInHours);
            bot.answerCallbackQuery(callbackQuery.id, { text: `⏳ Bạn đã nhận thưởng chia sẻ hôm nay rồi! Quay lại sau ${waitHours} tiếng nhé.`, show_alert: true });
        } else {
            user.balance += 15; 
            user.lastShareTask = now;
            await user.save();
            bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Cảm ơn bạn đã lan tỏa dự án! +15 SWGT đã được cộng vào ví.", show_alert: true });
        }
    }

    else if (data === 'task_3') {
        const textTask3 = `🚀 <b>CƠ HỘI BỨT PHÁ - X10 TÀI SẢN</b>\n\nBạn đã mời được: <b>${user.referralCount || 0} người</b>.\n\n🔗 <b>Link giới thiệu của bạn:</b>\nhttps://t.me/Dau_Tu_SWC_bot?start=${userId}\n\n💎 Nhận ngay <b>+20 SWGT</b> cho mỗi lượt mời thành công. Hãy rải link ngay hôm nay trước khi thị trường bão hòa!\n\n👑 <b>THƯỞNG MỐC ĐẶC BIỆT:</b>\n- Đạt 10 lượt mời: Thưởng nóng <b>+50 SWGT</b>\n- Đạt 50 lượt mời: Thưởng nóng <b>+300 SWGT</b>`;
        bot.sendMessage(chatId, textTask3, { parse_mode: 'HTML' });
    } 
    
    else if (data === 'task_4') {
        const task4Text = `🏆 <b>KHO LƯU TRỮ ĐẶC QUYỀN VIP</b>\n\nSWGT là quyền lực của bạn! Dùng số dư quy đổi lấy "vũ khí" thực chiến:\n\n🔓 <b>1. Mở Khóa Group Private (500 SWGT)</b>\n☕️ <b>2. Cà Phê Chiến Lược 1:1 (300 SWGT)</b>\n🎟 <b>3. Voucher Ưu Đãi Đầu Tư (1000 SWGT)</b>\n\n👉 <i>Bấm mở App để quy đổi!</i>`;
        bot.sendMessage(chatId, task4Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP ĐỂ QUY ĐỔI", web_app: { url: webAppUrl } }]] }});
    }

    if (!['check_join', 'claim_read', 'claim_share'].includes(data)) {
        bot.answerCallbackQuery(callbackQuery.id);
    }
});
