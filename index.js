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

const YOUTUBE_LINK = 'https://www.youtube.com/c/SkyWorldCommunityVietNam/videos'; 
const FACEBOOK_LINK = 'https://www.facebook.com/swc.capital.vn';

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
    lastCheckInDate: { type: Date, default: null },
    youtubeTaskDone: { type: Boolean, default: false }, 
    youtubeClickTime: { type: Date, default: null },
    facebookTaskDone: { type: Boolean, default: false },
    facebookClickTime: { type: Date, default: null },
    shareClickTime: { type: Date, default: null }
});
const User = mongoose.model('User', userSchema);

// --- 1. API SERVER CHO MINI APP ---
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.end(); return; }
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/api/user' && req.method === 'GET') {
        const userId = parsedUrl.query.id;
        let userData = await User.findOne({ userId: userId });
        if (!userData) userData = { balance: 0, wallet: '', referralCount: 0 };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(userData));
    } 
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
    // --- 6. YÊU CẦU RÚT TIỀN (Test mốc 50 SWGT) ---
    else if (parsedUrl.pathname === '/api/withdraw' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                
                // Kiểm tra xem số dư có đủ 50 SWGT không
                if (user && user.balance >= 50) {
                    const withdrawAmount = user.balance; // Rút toàn bộ số dư hiện có
                    user.balance = 0; // Trừ sạch tiền sau khi rút
                    await user.save();
                    
                    // Gửi tin nhắn thông báo cho người dùng
                    const msgToUser = `💸 <b>YÊU CẦU RÚT TIỀN THÀNH CÔNG!</b>\n\nBạn vừa yêu cầu rút <b>${withdrawAmount} SWGT</b>.\n💳 <b>Ví nhận:</b> <code>${user.wallet || 'Chưa cập nhật'}</code>\n\n⏳ Hệ thống đang xử lý và Admin sẽ chuyển token cho bạn trong thời gian sớm nhất!`;
                    bot.sendMessage(data.userId, msgToUser, {parse_mode: 'HTML'}).catch(()=>{});
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Chưa đủ điều kiện rút (tối thiểu 50 SWGT)' }));
                }
            } catch (e) { res.writeHead(400); res.end(); }
        });
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
        
        if (refId && refId !== userId) {
            user.referredBy = refId;
            let referrer = await User.findOne({ userId: refId });
            if (referrer) {
                referrer.balance += 10; 
                referrer.referralCount += 1; 
                
                let milestoneMsg = "";
                if (referrer.referralCount === 10) {
                    referrer.balance += 50;
                    milestoneMsg = "\n🌟 <b>THƯỞNG MỐC 10 NGƯỜI:</b> +50 SWGT!";
                } else if (referrer.referralCount === 50) {
                    referrer.balance += 300;
                    milestoneMsg = "\n👑 <b>THƯỞNG MỐC 50 NGƯỜI:</b> +300 SWGT!";
                }

                await referrer.save();
                
                const notifyMsg = `🎉 <b>CÓ NGƯỜI MỚI THAM GIA!</b>\n\n👤 <b>Tên:</b> ${firstName} ${lastName}\n🆔 <b>ID:</b> <code>${userId}</code>\nĐã bấm vào link mời của bạn!\n\n🎁 Bạn vừa được cộng trước <b>10 SWGT</b>.\n\n⚠️ <b>BƯỚC CUỐI:</b> Hãy nhắn tin hướng dẫn họ làm "Nhiệm vụ Tân binh" (tham gia nhóm và chat) để bạn được cộng thêm <b>10 SWGT</b> nữa nhé!${milestoneMsg}`;
                bot.sendMessage(refId, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    } else {
        user.firstName = firstName; user.lastName = lastName; user.username = username;
    }
    await user.save();
    
    let welcomeText = `👋 <b>Chào mừng bạn đến với Cộng Đồng SWC Việt Nam!</b> 🚀\n\nBạn đã bước chân vào trung tâm kết nối của những nhà đầu tư tiên phong. Cơ hội sở hữu trước token SWGT và đón đầu xu hướng công nghệ giao thông uST đang ở ngay trước mắt!\n\n🎁 <b>Quà tặng Tân Binh:</b> Nhận ngay những đồng SWGT đầu tiên hoàn toàn miễn phí.\n\n👇 <b>HÀNH ĐỘNG NGAY:</b> Bấm nút <b>"MỞ ỨNG DỤNG SWC NGAY"</b> bên dưới để kích hoạt ví và gia tăng tài sản!`;
    
    if (isNewUser && refId && refId !== userId) {
        welcomeText = `🎉 <i>Bạn được mời bởi thành viên ID: ${refId}</i>\n\n` + welcomeText;
    }

    const opts = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "1️⃣ Nhiệm vụ Tân binh", callback_data: 'task_1' }],
                [{ text: "2️⃣ Nhiệm vụ Kiến thức & Lan tỏa", callback_data: 'task_2' }],
                [{ text: "3️⃣ Tăng trưởng (Mời bạn bè)", callback_data: 'task_3' }],
                [{ text: "🎁 Đặc quyền & Đổi thưởng", callback_data: 'task_4' }],
                [{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]
            ]
        }
    };
    
    bot.sendMessage(chatId, welcomeText, opts).catch(err => console.log(err));
});

// --- 4. CAMERA CHẠY NGẦM (Xử lý tin nhắn nhóm & rời nhóm) ---
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

    if (msg.text && msg.text.trim().length >= 10) {
        user.balance = Math.round((user.balance + 0.3) * 100) / 100;
    }
    await user.save();
});

// --- 5. XỬ LÝ NÚT BẤM ---
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    let user = await User.findOne({ userId: userId });
    if (!user) return bot.answerCallbackQuery(callbackQuery.id);

    if (data === 'task_1') {
        const opts = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔵 Join Kênh Thông tin", url: "https://t.me/swc_capital_vn" }],
                    [{ text: "💬 Join Group Cộng Đồng", url: "https://t.me/swc_capital_chat" }],
                    [{ text: "✅ KIỂM TRA & NHẬN THƯỞNG", callback_data: 'check_join' }]
                ]
            }
        };
        const task1Text = `🎯 <b>BƯỚC 1: LẤY VỐN KHỞI NGHIỆP</b>\n\nHoàn thành ngay để "bỏ túi" <b>30 SWGT</b> đầu tiên:\n\n1️⃣ <b>Join Kênh & Group Cộng Đồng SWC Việt Nam</b> (+20 SWGT).\n\n2️⃣ <b>Gửi tin nhắn chào hỏi</b> lên Group để xác minh.\n\n3️⃣ <b>Mở App Kết nối Ví Crypto</b> (+10 SWGT).`;
        bot.sendMessage(chatId, task1Text, opts);
    } 
    
    else if (data === 'check_join') {
        const status = await checkMembership(userId);
        if (status.error) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bot chưa có quyền Admin!", show_alert: true });
        } else if (status.inChannel && status.inGroup) {
            if (user.groupMessageCount < 1) {
                bot.answerCallbackQuery(callbackQuery.id, { text: `❌ Hãy nhắn tin vào nhóm trước!`, show_alert: true });
            } else if (!user.task1Done) {
                user.balance += 20; 
                user.task1Done = true;
                await user.save();
                bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 +20 SWGT thành công!", show_alert: true });
            } else {
                bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Đã nhận thưởng trước đó.", show_alert: true });
            }
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Bạn chưa tham gia đủ nhóm/kênh!", show_alert: true });
        }
    }
    
    else if (data === 'task_2') {
        const task2Text = `🧠 <b>NẠP KIẾN THỨC & LAN TỎA</b>\n\n1. Đọc bài viết (+10 SWGT)\n2. Chia sẻ dự án (+15 SWGT)\n3. Xem YouTube (+5 SWGT)\n4. Theo dõi Fanpage (+5 SWGT)`;
        bot.sendMessage(chatId, task2Text, { 
            parse_mode: 'HTML', 
            reply_markup: { inline_keyboard: [
                [{ text: "📖 ĐỌC BÀI VIẾT (60s)", callback_data: 'go_read' }, { text: "🎁 NHẬN", callback_data: 'claim_read' }],
                [{ text: "▶️ YOUTUBE (6s)", callback_data: 'go_youtube' }, { text: "🎁 NHẬN", callback_data: 'claim_youtube' }],
                [{ text: "📘 FANPAGE", callback_data: 'go_facebook' }, { text: "🎁 NHẬN", callback_data: 'claim_facebook' }],
                [{ text: "📢 CHIA SẺ (5s)", callback_data: 'go_share' }, { text: "🎁 NHẬN", callback_data: 'claim_share' }]
            ] } 
        });
    }

    // --- LOGIC NHIỆM VỤ (Đọc, Youtube, FB, Share) ---
    else if (data === 'go_read') {
        user.readTaskStartTime = new Date();
        await user.save();
        bot.sendMessage(chatId, "⏱ Bắt đầu tính giờ 60s...", { reply_markup: { inline_keyboard: [[{ text: "👉 TỚI TRANG WEB", url: "https://hovanloi.net" }]] }});
    }
    else if (data === 'claim_read') {
        const now = new Date();
        const timeSpent = (now - new Date(user.readTaskStartTime || 0)) / 1000;
        if (timeSpent >= 60) {
            user.balance += 10;
            user.readTaskStartTime = null;
            await user.save();
            bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 +10 SWGT thành công!", show_alert: true });
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Chưa đủ 60 giây!", show_alert: true });
        }
    }
    
    // ... (Tương tự cho các nút go_youtube, go_facebook, go_share và các nút claim tương ứng)
    
    else if (data === 'task_3') {
        const textTask3 = `🚀 <b>MỜI BẠN BÈ</b>\n\nLink: https://t.me/Dau_Tu_SWC_bot?start=${userId}\nThưởng: +20 SWGT/người.`;
        bot.sendMessage(chatId, textTask3, { parse_mode: 'HTML' });
    } 
    
    else if (data === 'task_4') {
        bot.sendMessage(chatId, `🏆 <b>ĐỔI THƯỞNG</b>\nSử dụng SWGT trong App để quy đổi quà tặng!`, { reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP", web_app: { url: webAppUrl } }]] }});
    }

    bot.answerCallbackQuery(callbackQuery.id).catch(()=>{});
});

