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

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Đã kết nối MongoDB!'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// --- TẠO CẤU TRÚC LƯU TRỮ USER ---
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
// TÍNH NĂNG TỰ ĐỘNG NHẮC NHỞ ĐIỂM DANH LÚC 8H SÁNG
// ==========================================
setInterval(async () => {
    const now = new Date();
    const vnHour = (now.getUTCHours() + 7) % 24;
    const vnMinute = now.getUTCMinutes();

    if (vnHour === 8 && vnMinute === 0) {
        console.log('Bắt đầu gửi thông báo nhắc điểm danh sáng...');
        const todayStr = now.toDateString();
        const users = await User.find({});
        
        for (let user of users) {
            const lastCheckinStr = user.lastCheckInDate ? new Date(user.lastCheckInDate).toDateString() : '';
            if (lastCheckinStr !== todayStr) {
                const remindMsg = `☀️ <b>CHÀO BUỔI SÁNG!</b>\n\nPhần thưởng điểm danh SWGT ngày hôm nay của bạn đã sẵn sàng.\n\n⚠️ <i>Lưu ý: Nếu bỏ lỡ 1 ngày, chuỗi phần thưởng của bạn sẽ bị quay lại từ Ngày 1.</i>\n\n👉 Hãy bấm <b>"MỞ ỨNG DỤNG SWC NGAY"</b> ở menu bên dưới để nhận nhé!`;
                try { await bot.sendMessage(user.userId, remindMsg, {parse_mode: 'HTML'}); } catch (e) {} 
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
    
    if (parsedUrl.pathname === '/api/user' && req.method === 'GET') {
        const userId = parsedUrl.query.id;
        let userData = await User.findOne({ userId: userId });
        if (!userData) userData = { balance: 0, wallet: '', gatecode: '', fullName: '', email: '', phone: '', referralCount: 0, isPremium: false, joinDate: Date.now() };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...userData._doc }));
    } 
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
    else if (parsedUrl.pathname === '/api/claim-giftcode' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const inputCode = data.code ? data.code.trim().toUpperCase() : ""; 
                
                if (!inputCode) {
                    res.writeHead(400); return res.end(JSON.stringify({ success: false, message: "⚠️ Vui lòng nhập mã Giftcode!" }));
                }

                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                let gift = await GiftCode.findOne({ code: inputCode });
                
                if (!gift) {
                    res.writeHead(400); return res.end(JSON.stringify({ success: false, message: "❌ Mã Code không tồn tại hoặc viết sai!" }));
                }
                if (gift.usedBy.includes(user.userId)) {
                    res.writeHead(400); return res.end(JSON.stringify({ success: false, message: "⚠️ Bạn đã nhập mã này rồi, không thể nhập lại!" }));
                }
                if (gift.usedBy.length >= gift.maxUses) {
                    res.writeHead(400); return res.end(JSON.stringify({ success: false, message: "😭 Rất tiếc! Mã này đã có người khác nhanh tay nhập mất rồi." }));
                }

                user.balance = Math.round((user.balance + gift.reward) * 100) / 100;
                await user.save();
                gift.usedBy.push(user.userId);
                await gift.save();

                const fomoMsg = `🔥 <b>TING TING! CÓ NGƯỜI NHẬN QUÀ THÀNH CÔNG!</b> 🔥\n\nThành viên <b>${user.firstName} ${user.lastName}</b> vừa nhanh tay nhập mã <code>${inputCode}</code> và giật ngay <b>${gift.reward} SWGT</b> vào ví!\n\n👉 <i>Mọi người nhớ săn mã được từ Group để không bỏ lỡ những mã Code cực khủng tiếp theo từ Admin nhé!</i>`;
                bot.sendMessage(GROUP_USERNAME, fomoMsg, {parse_mode: 'HTML'}).catch(()=>{});
                bot.sendMessage(user.userId, `🎉 <b>CHÚC MỪNG!</b>\nBạn đã nhập đúng mã <code>${inputCode}</code>. Cộng ngay <b>${gift.reward} SWGT</b> vào tài khoản. Quá xuất sắc!`, {parse_mode: 'HTML'}).catch(()=>{});

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance, reward: gift.reward }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    else if (parsedUrl.pathname === '/api/claim-milestone' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                let reward = 0;
                if (data.milestone === 3 && user.referralCount >= 3 && !user.milestone3) { reward = 10; user.milestone3 = true; }
                else if (data.milestone === 10 && user.referralCount >= 10 && !user.milestone10) { reward = 25; user.milestone10 = true; }
                else if (data.milestone === 20 && user.referralCount >= 20 && !user.milestone20) { reward = 40; user.milestone20 = true; }
                else if (data.milestone === 50 && user.referralCount >= 50 && !user.milestone50) { reward = 100; user.milestone50 = true; }
                else if (data.milestone === 80 && user.referralCount >= 80 && !user.milestone80) { reward = 150; user.milestone80 = true; }
                else if (data.milestone === 120 && user.referralCount >= 120 && !user.milestone120) { reward = 250; user.milestone120 = true; }
                else if (data.milestone === 200 && user.referralCount >= 200 && !user.milestone200) { reward = 425; user.milestone200 = true; }
                else if (data.milestone === 350 && user.referralCount >= 350 && !user.milestone350) { reward = 800; user.milestone350 = true; }
                else if (data.milestone === 500 && user.referralCount >= 500 && !user.milestone500) { reward = 1200; user.milestone500 = true; }

                if (reward > 0) {
                    user.balance = Math.round((user.balance + reward) * 100) / 100;
                    await user.save();
                    if (data.milestone >= 50) {
                        const announceMsg = `🔥 <b>TIN NÓNG BÙNG NỔ!</b> 🔥\n\nChúc mừng thành viên <b>${user.firstName} ${user.lastName}</b> vừa xuất sắc cán mốc <b>${data.milestone} lượt giới thiệu</b> và ẵm trọn <b>${reward} SWGT</b>!\n\n👉 <i>Cơ hội đua top vẫn đang mở. Mọi người nhanh tay vào Bot lấy Link mời bạn bè nhé!</i>`;
                        bot.sendMessage(GROUP_USERNAME, announceMsg, {parse_mode: 'HTML'}).catch(()=>{});
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward }));
                } else {
                    res.writeHead(400); res.end(JSON.stringify({ success: false, message: "Chưa đủ điều kiện hoặc đã nhận rồi!" }));
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
                if (!user) return;

                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const lastCheckin = user.lastCheckInDate ? new Date(user.lastCheckInDate) : null;
                const lastCheckinDay = lastCheckin ? new Date(lastCheckin.getFullYear(), lastCheckin.getMonth(), lastCheckin.getDate()) : null;

                if (lastCheckinDay && today.getTime() === lastCheckinDay.getTime()) {
                    res.writeHead(400); return res.end(JSON.stringify({ success: false, message: 'Hôm nay bạn đã điểm danh rồi!' }));
                }

                // Kiểm tra liên tục để không mất chuỗi (Cho phép trễ tối đa 1 ngày)
                if (lastCheckinDay) {
                    const diffTime = today - lastCheckinDay;
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);
                    if (diffDays === 1) {
                        user.checkInStreak += 1;
                        if (user.checkInStreak > 7) user.checkInStreak = 1;
                    } else {
                        user.checkInStreak = 1;
                    }
                } else {
                    user.checkInStreak = 1;
                }

                const streakRewards = { 1: 0.5, 2: 1.5, 3: 3, 4: 3.5, 5: 5, 6: 7, 7: 9 };
                const reward = streakRewards[user.checkInStreak] || 0.5;

                user.balance = Math.round((user.balance + reward) * 10) / 10; 
                user.lastCheckInDate = now;
                await user.save();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward, streak: user.checkInStreak }));
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
                    bot.sendMessage(data.userId, `⏳ Yêu cầu đổi: <b>${data.itemName}</b> đang được xử lý!`, {parse_mode: 'HTML'}).catch(()=>{});
                    const reportMsg = `🎁 <b>YÊU CẦU ĐỔI QUÀ</b>\nKhách: ${user.firstName} (ID: <code>${user.userId}</code>)\nQuà: ${data.itemName}\nVí: ${user.wallet || 'Chưa cập nhật'}`;
                    bot.sendMessage(ADMIN_ID, reportMsg, { parse_mode: 'HTML' }).catch(()=>{});
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance }));
                } else { res.writeHead(400); res.end(); }
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    else if (parsedUrl.pathname === '/api/leaderboard' && req.method === 'GET') {
        try {
            const topUsers = await User.find({ referralCount: { $gt: 0 } }).sort({ referralCount: -1 }).limit(10);
            
            // Xử lý Cấp bậc quân đội dựa trên số lượt giới thiệu
            const leaderboardWithRanks = topUsers.map((u, index) => {
                let rankName = "Binh Nhì";
                const ref = u.referralCount;
                if (ref >= 500) rankName = "Đại Tướng";
                else if (ref >= 350) rankName = "Trung Tướng";
                else if (ref >= 200) rankName = "Thiếu Tướng";
                else if (ref >= 120) rankName = "Đại Tá";
                else if (ref >= 80) rankName = "Thượng Tá";
                else if (ref >= 50) rankName = "Trung Tá";
                else if (ref >= 20) rankName = "Thiếu Tá";
                else if (ref >= 10) rankName = "Đại Úy";
                else if (ref >= 3) rankName = "Trung Úy";

                let medal = "🏅";
                if (index === 0) medal = "🥇";
                else if (index === 1) medal = "🥈";
                else if (index === 2) medal = "🥉";

                return {
                    firstName: u.firstName,
                    lastName: u.lastName,
                    referralCount: u.referralCount,
                    rank: rankName,
                    medal: medal
                };
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(leaderboardWithRanks));
        } catch (e) { res.writeHead(400); res.end(); }
    }
    else { res.writeHead(200); res.end('API Online'); }
});
server.listen(process.env.PORT || 3000);

// --- Các hàm hỗ trợ Bot và Membership ---
async function checkMembership(userId) {
    try {
        const channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        const validStatuses = ['member', 'administrator', 'creator'];
        return { inChannel: validStatuses.includes(channelMember.status), inGroup: validStatuses.includes(groupMember.status) };
    } catch (error) { return { error: true }; }
}

// ==========================================
// CÁC LỆNH ADMIN (/createcode, /sendall, /deletecode)
// ==========================================
bot.onText(/\/createcode (\S+) (\d+) (\d+)/, async (msg, match) => {
    if (msg.chat.type !== 'private') return; 
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const codeInput = match[1].toUpperCase();
    const reward = parseInt(match[2]);
    const maxUses = parseInt(match[3]);
    try {
        const existing = await GiftCode.findOne({ code: codeInput });
        if (existing) return bot.sendMessage(ADMIN_ID, `❌ Lỗi: Mã <b>${codeInput}</b> đã tồn tại!`, {parse_mode: 'HTML'});
        const newGift = new GiftCode({ code: codeInput, reward: reward, maxUses: maxUses });
        await newGift.save();
        bot.sendMessage(ADMIN_ID, `✅ <b>TẠO MÃ THÀNH CÔNG!</b>\n\n🔑 Mã: <code>${codeInput}</code>\n💰 Thưởng: <b>${reward} SWGT</b>\n👥 Số lượng: <b>${maxUses} người</b>`, {parse_mode: 'HTML'});
    } catch (e) { bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`); }
});

bot.onText(/\/sendall ([\s\S]+)/, async (msg, match) => {
    if (msg.chat.type !== 'private') return;
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const broadcastMsg = match[1]; 
    const users = await User.find({});
    for (let user of users) {
        try {
            await bot.sendMessage(user.userId, broadcastMsg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ ỨNG DỤNG ĐỂ NHẬP MÃ NGAY", web_app: { url: webAppUrl } }]] }
            });
        } catch (err) {}
        await new Promise(r => setTimeout(r, 50));
    }
    bot.sendMessage(ADMIN_ID, `✅ Đã gửi xong tới ${users.length} người.`);
});

// ==========================================
// XỬ LÝ LỆNH /START VÀ CÁC SỰ KIỆN TIN NHẮN
// ==========================================
bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== 'private') return; 
    const userId = msg.from.id.toString();
    const refId = match[1].trim(); 
    const isPremium = msg.from.is_premium || false;

    let user = await User.findOne({ userId: userId });
    let isNewUser = false;

    if (!user) {
        isNewUser = true;
        user = new User({ userId: userId, firstName: msg.from.first_name || '', lastName: msg.from.last_name || '', username: msg.from.username ? `@${msg.from.username}` : '', isPremium: isPremium });
        if (refId && refId !== userId) {
            user.referredBy = refId;
            let referrer = await User.findOne({ userId: refId });
            if (referrer) {
                const startReward = referrer.isPremium ? 20 : 10;
                referrer.balance = Math.round((referrer.balance + startReward) * 100) / 100; 
                referrer.referralCount += 1; 
                await referrer.save();
                bot.sendMessage(refId, `🎉 <b>CÓ NGƯỜI MỚI THAM GIA!</b>\n\n👤 <b>Tên:</b> ${user.firstName}\n🎁 Bạn được cộng <b>${startReward} SWGT</b>.`, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    }
    await user.save();
    
    const welcomeText = `👋 <b>Chào mừng bạn đến với Cộng Đồng SWC Việt Nam!</b> 🚀\n\nBạn đã bước chân vào trung tâm kết nối của những nhà đầu tư tiên phong. Cơ hội sở hữu trước token SWGT và đón đầu xu hướng công nghệ giao thông uST đang ở ngay trước mắt!\n\n🎁 <b>Quà tặng Tân Binh:</b> Nhận ngay những đồng SWGT đầu tiên hoàn toàn miễn phí.\n\n👇 <b>HÀNH ĐỘNG NGAY:</b> Bấm nút <b>"MỞ ỨNG DỤNG SWC NGAY"</b> bên dưới để kích hoạt ví và gia tăng tài sản!`;
    const opts = { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "1️⃣ Nhiệm vụ Tân binh", callback_data: 'task_1' }], [{ text: "2️⃣ Nhiệm vụ Kiến thức", callback_data: 'task_2' }], [{ text: "3️⃣ Mời bạn bè", callback_data: 'task_3' }], [{ text: "🎁 Đặc quyền & Đổi thưởng", callback_data: 'task_4' }], [{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]] } };
    bot.sendMessage(chatId, welcomeText, opts);
});

bot.on('message', async (msg) => {
    if (msg.from && msg.from.id.toString() === ADMIN_ID && msg.reply_to_message) {
        const replyText = msg.text ? msg.text.toLowerCase() : '';
        if (replyText.includes('xong') || replyText.includes('done')) {
            const idMatch = msg.reply_to_message.text.match(/ID: (\d+)/);
            if (idMatch) {
                bot.sendMessage(idMatch[1], `🚀 <b>HÀNH TRÌNH SWC - GIAO DỊCH THÀNH CÔNG!</b>\n\nAdmin đã duyệt yêu cầu của bạn. Hãy kiểm tra ví nhé!`, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    }

    if (msg.chat.type === 'private' || !msg.text) return;
    const userId = msg.from.id.toString();
    let user = await User.findOne({ userId: userId });
    if (user) {
        user.groupMessageCount += 1;
        if (msg.text.trim().length >= 10) { user.balance = Math.round((user.balance + 0.3) * 100) / 100; }
        await user.save();
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;
    let user = await User.findOne({ userId: userId });
    if (!user) return;

    if (data === 'task_1') {
        bot.sendMessage(chatId, `🎯 <b>BƯỚC 1: LẤY VỐN KHỞI NGHIỆP</b>\n\nHoàn thành ngay để nhận <b>SWGT</b> miễn phí bằng cách tham gia Kênh và Nhóm cộng đồng!`, {parse_mode: 'HTML'});
    }
    else if (data === 'task_4') {
        const task4Text = `💎 <b>KHO ĐẶC QUYỀN VIP</b>\n\nHãy để lại số lượng Token để quy đổi:\n\n☕ <b>Cà Phê Chiến Lược:</b> 6000 SWGT\n🔓 <b>Mở Khóa Group Private:</b> 8000 SWGT\n🎟 <b>Phiếu Đầu Tư Ưu Đãi Đặc Biệt:</b> 9000 SWGT\n\n👉 <i>Bấm mở App để quy đổi!</i>`;
        bot.sendMessage(chatId, task4Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP ĐỂ QUY ĐỔI", web_app: { url: webAppUrl } }]] }});
    }
    bot.answerCallbackQuery(callbackQuery.id);
});
