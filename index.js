const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');
const mongoose = require('mongoose');

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG ---
const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGODB_URI;
const bot = new TelegramBot(token, {polling: true});
const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';

const ADMIN_ID = '507318519'; // ID của anh Hồ Văn Lợi
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
    
    // API: Lấy thông tin user
    if (parsedUrl.pathname === '/api/user' && req.method === 'GET') {
        const userId = parsedUrl.query.id;
        let userData = await User.findOne({ userId: userId });
        if (!userData) userData = { balance: 0, wallet: '', referralCount: 0 };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(userData));
    } 
    // API: Lưu ví
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
    // API: Đổi quà (Cơ chế xác nhận Admin)
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
                    
                    // 1. Thông báo "Đang xử lý" cho User
                    const userNotify = `⏳ <b>YÊU CẦU ĐANG ĐƯỢC TIẾN HÀNH!</b>\n\nYêu cầu quyền lợi của bạn đang được xử lý: <b>${data.itemName}</b>\n💎 Phí đổi: ${data.cost} SWGT\n\nAdmin sẽ kiểm tra và hoàn tất cho bạn trong giây lát!`;
                    bot.sendMessage(data.userId, userNotify, {parse_mode: 'HTML'}).catch(()=>{});
                    
                    // 2. Báo cáo cho Admin Lợi
                    const reportMsg = `🎁 <b>YÊU CẦU ĐỔI QUÀ</b>\n\n👤 Khách: <b>${user.firstName} ${user.lastName}</b>\n🆔 ID: <code>${user.userId}</code>\n💎 Quà: <b>${data.itemName}</b>\n🏦 Ví: <code>${user.wallet || 'Chưa có'}</code>\n\n👉 <i>Admin hãy Reply tin nhắn này gõ "xong" để báo cho khách.</i>`;
                    bot.sendMessage(ADMIN_ID, reportMsg, { parse_mode: 'HTML' }).catch(()=>{});

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance }));
                } else { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    // API: Yêu cầu rút tiền
    else if (parsedUrl.pathname === '/api/withdraw' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (user && user.balance >= 50) {
                    const withdrawAmount = user.balance;
                    user.balance = 0; 
                    await user.save();
                    
                    // 1. Thông báo cho User
                    bot.sendMessage(data.userId, `⏳ <b>YÊU CẦU RÚT TIỀN ĐANG ĐƯỢC TIẾN HÀNH!</b>\n\nYêu cầu rút <b>${withdrawAmount} SWGT</b> của bạn đã được gửi đi. Hệ thống đang phê duyệt!`, {parse_mode: 'HTML'}).catch(()=>{});
                    
                    // 2. Báo cáo Admin
                    const reportWithdraw = `🚨 <b>YÊU CẦU RÚT TIỀN</b>\n\n👤 Người rút: <b>${user.firstName} ${user.lastName}</b>\n🆔 ID: <code>${user.userId}</code>\n💰 Số lượng: <b>${withdrawAmount} SWGT</b>\n🏦 Ví: <code>${user.wallet}</code>\n\n👉 <i>Admin hãy Reply tin nhắn này gõ "xong" để báo cho khách.</i>`;
                    bot.sendMessage(ADMIN_ID, reportWithdraw, { parse_mode: 'HTML' }).catch(()=>{});

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: 0 }));
                } else { res.writeHead(400); res.end(); }
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
            const topUsers = await User.find({ referralCount: { $gt: 0 } }).sort({ referralCount: -1 }).limit(10).select('firstName lastName referralCount');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(topUsers));
        } catch (e) { res.writeHead(400); res.end(); }
    }
    else { res.writeHead(200); res.end('API Online'); }
});
server.listen(process.env.PORT || 3000);

// --- 2. HÀM KIỂM TRA THÀNH VIÊN ---
async function checkMembership(userId) {
    try {
        const channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        const validStatuses = ['member', 'administrator', 'creator'];
        return { inChannel: validStatuses.includes(channelMember.status), inGroup: validStatuses.includes(groupMember.status) };
    } catch (error) { return { error: true }; }
}

// --- 3. XỬ LÝ LỆNH /start ---
bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== 'private') return; 
    const userId = msg.from.id.toString();
    const refId = match[1].trim(); 

    let user = await User.findOne({ userId: userId });
    let isNewUser = false;
    if (!user) {
        isNewUser = true;
        user = new User({ userId, firstName: msg.from.first_name || '', lastName: msg.from.last_name || '', username: msg.from.username ? `@${msg.from.username}` : '' });
        if (refId && refId !== userId) {
            user.referredBy = refId;
            let referrer = await User.findOne({ userId: refId });
            if (referrer) {
                referrer.balance += 10; referrer.referralCount += 1;
                await referrer.save();
                bot.sendMessage(refId, `🎉 <b>CÓ NGƯỜI MỚI!</b>\nBạn được cộng <b>10 SWGT</b> từ ${user.firstName}.`, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    }
    await user.save();
    
    const opts = { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: "1️⃣ Nhiệm vụ Tân binh", callback_data: 'task_1' }],
        [{ text: "2️⃣ Nhiệm vụ Kiến thức & Lan tỏa", callback_data: 'task_2' }],
        [{ text: "3️⃣ Tăng trưởng (Mời bạn bè)", callback_data: 'task_3' }],
        [{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]
    ]}};
    bot.sendMessage(chatId, `👋 Chào mừng bạn đến với Cộng Đồng SWC Việt Nam!`, opts);
});

// --- 4. CAMERA CHẠY NGẦM ---
bot.on('message', async (msg) => {
    // A. XỬ LÝ KHI ADMIN BÁO "XONG" (Xác nhận chuyển tiền)
    if (msg.from.id.toString() === ADMIN_ID && msg.reply_to_message) {
        const replyText = msg.text ? msg.text.toLowerCase() : '';
        if (replyText.includes('xong') || replyText.includes('done')) {
            const originalText = msg.reply_to_message.text || "";
            // Tìm ID người dùng từ tin nhắn báo cáo cũ
            const idMatch = originalText.match(/ID: (\d+)/);
            if (idMatch) {
                const targetUserId = idMatch[1];
                const targetUser = await User.findOne({ userId: targetUserId });
                
                // Gửi thông báo sinh động cho User
                const successMsg = `🚀 <b>HÀNH TRÌNH SWC - PHẦN THƯỞNG ĐÃ CẬP BẾN!</b>\n\n` +
                                   `Chào <b>${targetUser ? targetUser.firstName : 'bạn'}</b>, Admin đã hoàn tất kiểm duyệt và thực hiện lệnh chuyển thưởng cho bạn!\n\n` +
                                   `🎉 <b>TRẠNG THÁI:</b> ĐỔI THƯỞNG THÀNH CÔNG!\n` +
                                   `🌈 Cảm ơn bạn đã luôn tin tưởng và đồng hành cùng Cộng đồng SWC. Hãy kiểm tra ví và tiếp tục lan tỏa nhé! 🚀`;
                
                bot.sendMessage(targetUserId, successMsg, {parse_mode: 'HTML'}).catch(()=>{});
                bot.sendMessage(ADMIN_ID, `✅ Đã gửi thông báo thành công cho khách hàng (ID: ${targetUserId}).`);
                return;
            }
        }
    }

    // B. XỬ LÝ RỜI NHÓM
    if (msg.left_chat_member) {
        const leftId = msg.left_chat_member.id.toString();
        let user = await User.findOne({ userId: leftId });
        if (user && user.task1Done) {
            user.balance = Math.max(0, user.balance - 20); user.task1Done = false;
            await user.save();
            bot.sendMessage(leftId, `⚠️ Bạn đã bị trừ 20 SWGT do rời nhóm!`).catch(()=>{});
        }
    }

    // C. CỘNG TIỀN CHAT NHÓM
    if (msg.chat.type === 'private' || msg.from.is_bot) return;
    const userId = msg.from.id.toString();
    let user = await User.findOne({ userId });
    if (user) {
        user.groupMessageCount += 1;
        if (msg.text && msg.text.trim().length >= 10) user.balance = Math.round((user.balance + 0.3) * 100) / 100;
        await user.save();
    }
});

// --- 5. XỬ LÝ CALLBACK QUERIES ---
bot.on('callback_query', async (q) => {
    const chatId = q.message.chat.id;
    const userId = q.from.id.toString();
    const data = q.data;
    let user = await User.findOne({ userId });

    if (data === 'task_1') {
        bot.sendMessage(chatId, `🎯 Join Kênh & Group để nhận 20 SWGT!`, { reply_markup: { inline_keyboard: [[{ text: "✅ KIỂM TRA", callback_data: 'check_join' }]] }});
    }
    else if (data === 'check_join') {
        const status = await checkMembership(userId);
        if (status.inChannel && status.inGroup && user.groupMessageCount >= 1 && !user.task1Done) {
            user.balance += 20; user.task1Done = true; await user.save();
            bot.answerCallbackQuery(q.id, { text: "🎉 +20 SWGT thành công!", show_alert: true });
        } else { bot.answerCallbackQuery(q.id, { text: "Chưa hoàn thành!", show_alert: true }); }
    }
    else if (data === 'task_2') {
        const task2Text = `🧠 <b>NHIỆM VỤ HÀNG NGÀY</b>`;
        bot.sendMessage(chatId, task2Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
            [{ text: "📖 Đọc Báo (60s)", callback_data: 'go_read' }, { text: "🎁", callback_data: 'claim_read' }],
            [{ text: "▶️ Youtube (6s)", callback_data: 'go_yt' }, { text: "🎁", callback_data: 'claim_yt' }],
            [{ text: "📢 Share (5s)", callback_data: 'go_sh' }, { text: "🎁", callback_data: 'claim_sh' }]
        ]}});
    }
    else if (data === 'go_yt') {
        user.youtubeClickTime = new Date(); await user.save();
        bot.sendMessage(chatId, `Xem 6s rồi quay lại nhận quà!`, { reply_markup: { inline_keyboard: [[{ text: "👉 XEM VIDEO", url: YOUTUBE_LINK }]] }});
    }
    else if (data === 'claim_yt') {
        const diff = (new Date() - new Date(user.youtubeClickTime || 0)) / 1000;
        if (diff >= 6) {
            user.balance += 5; user.youtubeClickTime = null; await user.save();
            bot.answerCallbackQuery(q.id, { text: "🎉 +5 SWGT thành công!", show_alert: true });
        } else { bot.answerCallbackQuery(q.id, { text: "Chưa đủ 6 giây!", show_alert: true }); }
    }
    else if (data === 'go_sh') {
        user.shareClickTime = new Date(); await user.save();
        bot.sendMessage(chatId, `Chia sẻ 5s rồi quay lại!`, { reply_markup: { inline_keyboard: [[{ text: "👉 CHIA SẺ", url: `https://t.me/share/url?url=https://t.me/Dau_Tu_SWC_bot?start=${userId}` }]] }});
    }
    else if (data === 'claim_sh') {
        const diff = (new Date() - new Date(user.shareClickTime || 0)) / 1000;
        if (diff >= 5) {
            user.balance += 15; user.shareClickTime = null; await user.save();
            bot.answerCallbackQuery(q.id, { text: "🎉 +15 SWGT thành công!", show_alert: true });
        } else { bot.answerCallbackQuery(q.id, { text: "Chưa đủ 5 giây!", show_alert: true }); }
    }
    else if (data === 'go_read') {
        user.readTaskStartTime = new Date(); await user.save();
        bot.sendMessage(chatId, "Bắt đầu 60s...", { reply_markup: { inline_keyboard: [[{ text: "👉 ĐỌC BÁO", url: "https://hovanloi.net" }]] }});
    }
    else if (data === 'claim_read') {
        const diff = (new Date() - new Date(user.readTaskStartTime || 0)) / 1000;
        if (diff >= 60) {
            user.balance += 10; user.readTaskStartTime = null; await user.save();
            bot.answerCallbackQuery(q.id, { text: "🎉 +10 SWGT thành công!", show_alert: true });
        } else { bot.answerCallbackQuery(q.id, { text: "Chưa đủ 60 giây!", show_alert: true }); }
    }
    
    bot.answerCallbackQuery(q.id).catch(()=>{});
});
