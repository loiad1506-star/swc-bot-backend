const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');
const mongoose = require('mongoose');

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG ---
const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGODB_URI;
const bot = new TelegramBot(token, {polling: true});
const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';

const ADMIN_ID = '507318519'; 
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
    lastShareTask: { type: Date, default: null },
    groupMessageCount: { type: Number, default: 0 },
    youtubeTaskDone: { type: Boolean, default: false }, 
    youtubeClickTime: { type: Date, default: null },
    facebookTaskDone: { type: Boolean, default: false },
    facebookClickTime: { type: Date, default: null },
    shareClickTime: { type: Date, default: null }
});
const User = mongoose.model('User', userSchema);

// --- TẠO CẤU TRÚC LƯU TRỮ MÃ GIFTCODE ---
const giftCodeSchema = new mongoose.Schema({
    code: { type: String, unique: true }, 
    reward: { type: Number, required: true }, 
    maxUses: { type: Number, default: 1 }, 
    usedBy: { type: [String], default: [] } 
});
const GiftCode = mongoose.model('GiftCode', giftCodeSchema);

// ==========================================
// TÍNH NĂNG TỰ ĐỘNG NHẮC NHỞ ĐIỂM DANH LÚC 8H SÁNG (GIỜ VIỆT NAM)
// ==========================================
setInterval(async () => {
    const now = new Date();
    // Chuyển đổi sang giờ Việt Nam (UTC+7)
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const vnHour = vnTime.getUTCHours();
    const vnMinute = vnTime.getUTCMinutes();

    if (vnHour === 8 && vnMinute === 0) {
        console.log('Bắt đầu gửi thông báo nhắc điểm danh sáng...');
        const todayStr = vnTime.toDateString();
        const users = await User.find({});
        
        for (let user of users) {
            // Kiểm tra ngày checkin cuối cùng theo giờ VN
            let lastCheckinStr = '';
            if (user.lastCheckInDate) {
                const lastCheckinVN = new Date(new Date(user.lastCheckInDate).getTime() + (7 * 60 * 60 * 1000));
                lastCheckinStr = lastCheckinVN.toDateString();
            }

            if (lastCheckinStr !== todayStr) {
                const remindMsg = `☀️ <b>CHÀO BUỔI SÁNG!</b>\n\nPhần thưởng điểm danh SWGT ngày hôm nay của bạn đã sẵn sàng.\n\n⚠️ <i>Lưu ý: Nếu bỏ lỡ 1 ngày, chuỗi phần thưởng của bạn sẽ bị quay lại từ Ngày 1.</i>\n\n👉 Hãy bấm <b>"MỞ ỨNG DỤNG SWC NGAY"</b> ở menu bên dưới để nhận nhé!`;
                try { 
                    await bot.sendMessage(user.userId, remindMsg, {
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ ỨNG DỤNG ĐIỂM DANH", web_app: { url: webAppUrl } }]] }
                    }); 
                } catch (e) {} 
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    }
}, 60000); 

// --- 1. API SERVER CHO MINI APP ---
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.end(); return; }
    const parsedUrl = url.parse(req.url, true);
    
    // API: LẤY THÔNG TIN USER
    if (parsedUrl.pathname === '/api/user' && req.method === 'GET') {
        const userId = parsedUrl.query.id;
        let userData = await User.findOne({ userId: userId });
        if (!userData) userData = { balance: 0, wallet: '', gatecode: '', fullName: '', email: '', phone: '', referralCount: 0, isPremium: false, joinDate: Date.now() };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...userData._doc }));
    } 
    // API: LƯU VÍ
    else if (parsedUrl.pathname === '/api/save-wallet' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (user) {
                    if (data.wallet) user.wallet = data.wallet;
                    if (data.gatecode) user.gatecode = data.gatecode;
                    if (data.fullName) user.fullName = data.fullName;
                    if (data.email) user.email = data.email;
                    if (data.phone) user.phone = data.phone;

                    if (!user.walletRewardDone) {
                        user.balance += 10;
                        user.walletRewardDone = true;
                        bot.sendMessage(data.userId, `🎉 <b>CHÚC MỪNG!</b>\nBạn đã thiết lập thông tin thanh toán thành công, +10 SWGT!`, {parse_mode: 'HTML'}).catch(()=>{});
                    }
                    await user.save();
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    } 
    // API: TỰ BẤM NHẬN THƯỞNG MỐC (CẬP NHẬT BÁO CÁO CẤP BẬC)
    else if (parsedUrl.pathname === '/api/claim-milestone' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                let reward = 0;
                let rankTitle = ""; // Biến lưu tên cấp bậc

                // Logic phần thưởng và gán cấp bậc
                if (data.milestone === 3 && user.referralCount >= 3 && !user.milestone3) { reward = 10; user.milestone3 = true; rankTitle = "Đại Úy 🎖️"; }
                else if (data.milestone === 10 && user.referralCount >= 10 && !user.milestone10) { reward = 25; user.milestone10 = true; rankTitle = "Thiếu Tá 🎖️"; }
                else if (data.milestone === 20 && user.referralCount >= 20 && !user.milestone20) { reward = 40; user.milestone20 = true; rankTitle = "Trung Tá 🎖️"; }
                else if (data.milestone === 50 && user.referralCount >= 50 && !user.milestone50) { reward = 100; user.milestone50 = true; rankTitle = "Thượng Tá 🎖️"; }
                else if (data.milestone === 80 && user.referralCount >= 80 && !user.milestone80) { reward = 150; user.milestone80 = true; rankTitle = "Đại Tá 🎖️"; }
                else if (data.milestone === 120 && user.referralCount >= 120 && !user.milestone120) { reward = 250; user.milestone120 = true; rankTitle = "Thiếu Tướng 🌟"; }
                else if (data.milestone === 200 && user.referralCount >= 200 && !user.milestone200) { reward = 425; user.milestone200 = true; rankTitle = "Trung Tướng 🌟🌟"; }
                else if (data.milestone === 350 && user.referralCount >= 350 && !user.milestone350) { reward = 800; user.milestone350 = true; rankTitle = "Thượng Tướng 🌟🌟🌟"; }
                else if (data.milestone === 500 && user.referralCount >= 500 && !user.milestone500) { reward = 1200; user.milestone500 = true; rankTitle = "Đại Tướng 🌟🌟🌟🌟"; }

                if (reward > 0) {
                    user.balance = Math.round((user.balance + reward) * 100) / 100;
                    await user.save();

                    // Gửi thông báo vinh danh vào Group
                    const promoteMsg = `🎖️ <b>THĂNG CẤP QUÂN HÀM!</b> 🎖️\n\nChúc mừng đồng chí <b>${user.firstName} ${user.lastName}</b> vừa xuất sắc cán mốc <b>${data.milestone} đồng đội</b>.\n\n⭐ Cấp bậc mới: <b>${rankTitle}</b>\n💰 Thưởng nóng: <b>+${reward} SWGT</b>\n\n👉 <i>Tiếp tục chiến đấu để lên hàm Tướng nào anh em!</i>`;
                    bot.sendMessage(GROUP_USERNAME, promoteMsg, {parse_mode: 'HTML'}).catch(()=>{});

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward }));
                } else {
                    res.writeHead(400); res.end(JSON.stringify({ success: false, message: "Chưa đủ điều kiện hoặc đã nhận rồi!" }));
                }
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    // API: ĐIỂM DANH (FIX LỖI NGÀY GIỜ VIỆT NAM)
    else if (parsedUrl.pathname === '/api/checkin' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return;

                // --- LOGIC TÍNH NGÀY THEO GIỜ VN (UTC+7) ---
                const now = new Date();
                const vnNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
                vnNow.setUTCHours(0,0,0,0); // Đưa về 0h sáng ngày VN hiện tại

                let vnLastCheckin = new Date(0);
                if (user.lastCheckInDate) {
                    vnLastCheckin = new Date(new Date(user.lastCheckInDate).getTime() + (7 * 60 * 60 * 1000));
                }
                vnLastCheckin.setUTCHours(0,0,0,0); // Đưa về 0h sáng ngày checkin cũ

                const diffTime = vnNow.getTime() - vnLastCheckin.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                    res.writeHead(400); return res.end(JSON.stringify({ success: false, message: 'Hôm nay bạn đã điểm danh rồi!' }));
                }

                if (diffDays === 1) {
                    user.checkInStreak += 1;
                    if (user.checkInStreak > 7) user.checkInStreak = 1; 
                } else {
                    user.checkInStreak = 1; // Mất chuỗi, quay về 1
                }

                const streakRewards = { 1: 0.5, 2: 1.5, 3: 3, 4: 3.5, 5: 5, 6: 7, 7: 9 };
                const reward = streakRewards[user.checkInStreak] || 0.5;

                user.balance = Math.round((user.balance + reward) * 10) / 10; 
                user.lastCheckInDate = new Date(); // Lưu thời gian thực tế để tham chiếu
                await user.save();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward, streak: user.checkInStreak, lastCheckInDate: user.lastCheckInDate }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    // API: NHẬN THƯỞNG NHIỆM VỤ APP
    else if (parsedUrl.pathname === '/api/claim-app-task' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                const now = new Date();
                let baseReward = 0;

                if (data.taskType === 'read') {
                    const lastDaily = user.lastDailyTask ? new Date(user.lastDailyTask) : new Date(0);
                    if (lastDaily.toDateString() !== now.toDateString()) { baseReward = 10; user.lastDailyTask = now; }
                } else if (data.taskType === 'youtube' && !user.youtubeTaskDone) {
                    baseReward = 5; user.youtubeTaskDone = true;
                } else if (data.taskType === 'facebook' && !user.facebookTaskDone) {
                    baseReward = 5; user.facebookTaskDone = true;
                } else if (data.taskType === 'share') {
                    const lastShare = user.lastShareTask ? new Date(user.lastShareTask) : new Date(0);
                    if (lastShare.toDateString() !== now.toDateString()) { baseReward = 15; user.lastShareTask = now; }
                }

                if (baseReward > 0) {
                    let multiplier = 1;
                    if (user.referralCount >= 100) multiplier = 1.5; 
                    else if (user.referralCount >= 50) multiplier = 1.2; 
                    
                    let finalReward = Math.round(baseReward * multiplier);
                    user.balance += finalReward;
                    await user.save();
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance, reward: finalReward }));
                } else {
                    res.writeHead(400); res.end(JSON.stringify({ success: false, message: "Đã nhận rồi hoặc chưa qua ngày mới!" }));
                }
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    // API: ĐỔI QUÀ VIP (ĐÃ CẬP NHẬT LOGIC CHECK TIỀN)
    else if (parsedUrl.pathname === '/api/redeem' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                // Check đủ tiền (6000, 8000, 9000) nhưng chưa trừ ngay
                if (user && user.balance >= data.cost) {
                    // user.balance -= data.cost; // Bỏ comment nếu muốn trừ tiền
                    // await user.save();
                    
                    const userNotify = `⏳ <b>YÊU CẦU ĐANG ĐƯỢC TIẾN HÀNH!</b>\n\nYêu cầu quyền lợi của bạn đang được xử lý: <b>${data.itemName}</b>\n💎 Yêu cầu số dư: ${data.cost} SWGT\n\nAdmin sẽ kiểm tra và liên hệ bạn trong giây lát!`;
                    bot.sendMessage(data.userId, userNotify, {parse_mode: 'HTML'}).catch(()=>{});
                    
                    const reportMsg = `🎁 <b>YÊU CẦU ĐỔI QUÀ VIP</b>\n\n👤 Khách: <b>${user.firstName} ${user.lastName}</b>\n🆔 ID: <code>${user.userId}</code>\n💎 Quà: <b>${data.itemName}</b>\n💰 Đang có: <b>${user.balance} SWGT</b> (Đủ điều kiện >= ${data.cost})\n\n👉 <a href="tg://user?id=${user.userId}">BẤM VÀO ĐÂY ĐỂ CHAT VỚI KHÁCH</a>`;
                    bot.sendMessage(ADMIN_ID, reportMsg, { parse_mode: 'HTML' }).catch(()=>{});

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance }));
                } else { 
                    res.writeHead(400); 
                    res.end(JSON.stringify({ success: false, message: `Bạn cần tích lũy đủ ${data.cost} SWGT để đổi quyền lợi này!` })); 
                }
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    // API: NHẬP MÃ GIFTCODE
    else if (parsedUrl.pathname === '/api/claim-giftcode' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const inputCode = data.code.trim().toUpperCase(); 
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();
                let gift = await GiftCode.findOne({ code: inputCode });
                if (!gift) { res.writeHead(400); return res.end(JSON.stringify({ success: false, message: "❌ Mã Code không tồn tại hoặc viết sai!" })); }
                if (gift.usedBy.includes(user.userId)) { res.writeHead(400); return res.end(JSON.stringify({ success: false, message: "⚠️ Bạn đã nhập mã này rồi!" })); }
                if (gift.usedBy.length >= gift.maxUses) { res.writeHead(400); return res.end(JSON.stringify({ success: false, message: "😭 Rất tiếc! Mã này đã hết lượt nhận." })); }

                user.balance = Math.round((user.balance + gift.reward) * 100) / 100;
                await user.save();
                gift.usedBy.push(user.userId);
                await gift.save();

                const fomoMsg = `🔥 <b>TING TING! CÓ NGƯỜI NHẬN QUÀ THÀNH CÔNG!</b> 🔥\n\nThành viên <b>${user.firstName} ${user.lastName}</b> vừa nhanh tay nhập mã <code>${inputCode}</code> và giật ngay <b>${gift.reward} SWGT</b> vào ví!`;
                bot.sendMessage(GROUP_USERNAME, fomoMsg, {parse_mode: 'HTML'}).catch(()=>{});
                bot.sendMessage(user.userId, `🎉 <b>CHÚC MỪNG!</b>\nBạn đã nhập đúng mã. Cộng ngay <b>${gift.reward} SWGT</b>.`, {parse_mode: 'HTML'}).catch(()=>{});

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance, reward: gift.reward }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    // API: RÚT TIỀN (VƯỢT RÀO 1500)
    else if (parsedUrl.pathname === '/api/withdraw' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                const lockDays = user.isPremium ? 7 : 15;
                const joinMs = user.joinDate ? new Date(user.joinDate).getTime() : new Date("2026-02-22T00:00:00Z").getTime();
                const unlockDate = joinMs + (lockDays * 24 * 60 * 60 * 1000);

                if (user.balance < 1500 && new Date().getTime() < unlockDate) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: `⏳ Bạn chưa hết thời gian mở khóa (${lockDays} ngày). Cày lên 1500 SWGT để được rút ngay nhé!` }));
                }

                const withdrawAmount = Number(data.amount); 
                if (user.balance >= withdrawAmount && withdrawAmount >= 300) {
                    user.balance -= withdrawAmount; 
                    await user.save();
                    
                    let userMsg = `💸 <b>YÊU CẦU RÚT TIỀN ĐANG XỬ LÝ!</b>\n\nSố lượng: <b>${withdrawAmount} SWGT</b>.\nAdmin sẽ duyệt trong 24h.`;
                    let adminReport = `🚨 <b>RÚT TIỀN</b>\nKhách: ${user.firstName}\nSố lượng: ${withdrawAmount}\nVí: ${user.wallet || user.gatecode}`;
                    
                    bot.sendMessage(data.userId, userMsg, {parse_mode: 'HTML'}).catch(()=>{});
                    bot.sendMessage(ADMIN_ID, adminReport, { parse_mode: 'HTML' }).catch(()=>{});

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance }));
                } else { 
                    res.writeHead(400, { 'Content-Type': 'application/json' }); 
                    res.end(JSON.stringify({ success: false, message: "Số dư không đủ hoặc chưa đạt mức tối thiểu!" })); 
                }
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

async function checkMembership(userId) {
    try {
        const channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        const validStatuses = ['member', 'administrator', 'creator'];
        return { inChannel: validStatuses.includes(channelMember.status), inGroup: validStatuses.includes(groupMember.status) };
    } catch (error) { return { error: true }; }
}

// ... (Giữ nguyên các lệnh Admin) ...
bot.onText(/\/createcode (\S+) (\d+) (\d+)/, async (msg, match) => {
    if (msg.chat.type !== 'private') return; if (msg.from.id.toString() !== ADMIN_ID) return;
    const codeInput = match[1].toUpperCase(); const reward = parseInt(match[2]); const maxUses = parseInt(match[3]);
    try {
        const existing = await GiftCode.findOne({ code: codeInput });
        if (existing) return bot.sendMessage(ADMIN_ID, `❌ Lỗi: Mã tồn tại!`);
        const newGift = new GiftCode({ code: codeInput, reward: reward, maxUses: maxUses });
        await newGift.save();
        bot.sendMessage(ADMIN_ID, `✅ Tạo mã thành công: ${codeInput}`);
    } catch (e) {}
});
bot.onText(/\/sendall ([\s\S]+)/, async (msg, match) => {
    if (msg.chat.type !== 'private') return; if (msg.from.id.toString() !== ADMIN_ID) return;
    const broadcastMsg = match[1];
    const users = await User.find({});
    for (let i = 0; i < users.length; i++) {
        try { await bot.sendMessage(users[i].userId, broadcastMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP NGAY", web_app: { url: webAppUrl } }]] } }); } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    bot.sendMessage(ADMIN_ID, `✅ Đã gửi tin nhắn hàng loạt.`);
});
bot.onText(/\/deletecode (\S+)/, async (msg, match) => {
    if (msg.chat.type !== 'private') return; if (msg.from.id.toString() !== ADMIN_ID) return;
    await GiftCode.findOneAndDelete({ code: match[1].toUpperCase() });
    bot.sendMessage(ADMIN_ID, `✅ Đã xóa mã ${match[1]}`);
});

bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== 'private') return; 
    const userId = msg.from.id.toString();
    const refId = match[1].trim(); 
    
    let user = await User.findOne({ userId: userId });
    let isNewUser = false;
    if (!user) {
        isNewUser = true;
        user = new User({ userId: userId, firstName: msg.from.first_name, lastName: msg.from.last_name, username: msg.from.username });
        if (refId && refId !== userId) {
            user.referredBy = refId;
            let referrer = await User.findOne({ userId: refId });
            if (referrer) {
                const startReward = referrer.isPremium ? 20 : 10;
                referrer.balance = Math.round((referrer.balance + startReward) * 100) / 100;
                referrer.referralCount += 1; 
                await referrer.save();
                
                let notifyMsg = `🎉 <b>CÓ NGƯỜI MỚI THAM GIA!</b>\n\n👤 <b>Tên:</b> ${msg.from.first_name}\nĐã bấm vào link mời của bạn!\n🎁 Bạn được cộng trước <b>${startReward} SWGT</b>.\n\n⚠️ Mở App vào mục Phần Thưởng để nhận mốc SWGT khổng lồ nhé!`;
                bot.sendMessage(refId, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    }
    await user.save();
    
    const welcomeText = `👋 <b>Chào mừng bạn đến với SWC Capital!</b>\n\n👇 Bấm nút bên dưới để bắt đầu:`;
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
    bot.sendPhoto(chatId, './Bia.jpg', { caption: welcomeText, parse_mode: 'HTML', reply_markup: opts.reply_markup }).catch(() => { bot.sendMessage(chatId, welcomeText, opts); });
});

// LOGIC TỰ ĐỘNG ĐẨY TIN NHẮN TIẾP THEO (AUTO FLOW)
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;
    let user = await User.findOne({ userId: userId });

    if (data === 'task_1') {
        const text = `🎯 <b>BƯỚC 1: LẤY VỐN KHỞI NGHIỆP</b>\n\n1. Join Kênh & Group.\n2. Gửi lời chào vào Group.\n3. Kết nối ví.`;
        bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [ [{ text: "🔵 Join Kênh", url: "https://t.me/swc_capital_vn" }], [{ text: "💬 Join Group", url: "https://t.me/swc_capital_chat" }], [{ text: "✅ KIỂM TRA & NHẬN THƯỞNG", callback_data: 'check_join' }] ] } });
    } 
    else if (data === 'check_join') {
        const status = await checkMembership(userId);
        if (status.inChannel && status.inGroup) {
            if (!user.task1Done) {
                user.balance += 20; user.task1Done = true; await user.save();
                await bot.sendMessage(chatId, `🎉 <b>XÁC MINH THÀNH CÔNG!</b>\n\n🎁 Bạn nhận được +20 SWGT.\n\n👇 <i>Nhiệm vụ tiếp theo sẽ được gửi tự động trong 2 giây...</i>`, {parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]] }});
                
                // AUTO FLOW: GỬI NHIỆM VỤ 2
                setTimeout(() => {
                    const task2Text = `🧠 <b>BƯỚC 2: NẠP KIẾN THỨC & LAN TỎA</b>\n\nKiếm thêm SWGT hàng ngày cực dễ:\n\n<b>1. NGUỒN VỐN TRÍ TUỆ (+10 SWGT/Ngày)</b>\n⏱ Bấm đọc bài viết bất kỳ trên web đủ 60 giây.\n\n<b>2. SỨ GIẢ LAN TỎA (+15 SWGT/Ngày)</b>\n📢 Bấm nút Chia sẻ dự án đến bạn bè/nhóm.\n\n👇 <b>BẤM NÚT DƯỚI ĐỂ LÀM NGAY:</b>`;
                    bot.sendMessage(chatId, task2Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [ [{ text: "📖 ĐỌC BÀI VIẾT (Đợi 60s)", callback_data: 'go_read' }], [{ text: "🎁 NHẬN THƯỞNG ĐỌC BÀI", callback_data: 'claim_read' }], [{ text: "⬇️ XEM TIẾP BƯỚC 3 (TĂNG TỐC)", callback_data: 'task_3' }] ] } });
                }, 2000);
            } else {
                bot.sendMessage(chatId, "✅ Bạn đã làm xong bước này rồi! Chuyển sang bước 2 nhé.", { reply_markup: { inline_keyboard: [[{text: "➡️ Sang Bước 2", callback_data: 'task_2'}]] } });
            }
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Bạn chưa join đủ nhóm!", show_alert: true });
        }
    }
    else if (data === 'task_2') {
         const task2Text = `🧠 <b>NẠP KIẾN THỨC & LAN TỎA</b>...`;
         bot.sendMessage(chatId, task2Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [ [{ text: "📖 ĐỌC BÀI VIẾT", callback_data: 'go_read' }], [{ text: "🎁 NHẬN THƯỞNG", callback_data: 'claim_read' }] ] } });
    }
    else if (data === 'task_3') {
        bot.sendMessage(chatId, `🚀 <b>BƯỚC 3: TĂNG TRƯỞNG (MỜI BẠN)</b>\n\nLink của bạn: https://t.me/Dau_Tu_SWC_bot?start=${userId}\n\nMỗi lượt mời +20 SWGT.`, { parse_mode: 'HTML' });
    }
    else if (data === 'task_4') {
        const task4Text = `🏆 <b>KHO LƯU TRỮ ĐẶC QUYỀN VIP</b>\n\nSWGT là quyền lực của bạn! Dùng số dư quy đổi lấy "vũ khí" thực chiến:\n\n🔓 <b>1. Mở Khóa Group Private (8000 SWGT)</b>\n☕️ <b>2. Cà Phê Chiến Lược 1:1 (6000 SWGT)</b>\n🎟 <b>3. Phiếu Đầu Tư Ưu Đãi (9000 SWGT)</b>\n\n👉 <i>Bấm mở App để quy đổi!</i>`;
        bot.sendMessage(chatId, task4Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP ĐỂ QUY ĐỔI", web_app: { url: webAppUrl } }]] }});
    }
    
    if (!['task_1', 'check_join', 'task_2', 'task_3', 'task_4'].includes(data)) {
        // ... (Logic con giữ nguyên)
    }
});
