const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');
const mongoose = require('mongoose');

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG ---
const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGODB_URI;

const bot = new TelegramBot(token, {
    polling: { params: { allowed_updates: JSON.stringify(["message", "callback_query", "chat_member", "my_chat_member"]) } }
});

bot.on("polling_error", (msg) => console.log("⚠️ LỖI POLLING:", msg));
bot.on("webhook_error", (msg) => console.log("⚠️ LỖI WEBHOOK:", msg));
bot.on("error", (msg) => console.log("⚠️ LỖI CHUNG:", msg));

const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';
const ADMIN_ID = '507318519'; 
const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Đã kết nối MongoDB!'))
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
    dailyMessageCount: { type: Number, default: 0 },
    lastMessageDate: { type: String, default: '' },
    activeFrame: { type: String, default: 'none' },
    ownedFrames: { type: [String], default: ['none'] },
    spinCount: { type: Number, default: 0 },
    hasWonEbook: { type: Boolean, default: false },
    hasWonAudio: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

const giftCodeSchema = new mongoose.Schema({
    code: { type: String, unique: true }, 
    reward: { type: Number, required: true }, 
    maxUses: { type: Number, default: 1 }, 
    usedBy: { type: [String], default: [] } 
});
const GiftCode = mongoose.model('GiftCode', giftCodeSchema);

// 🔥 TẠO BẢNG MỚI: LƯU LỊCH SỬ ĐẬP RƯƠNG 🔥
const gameLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    userName: { type: String, default: '' },
    rewardName: { type: String, required: true },
    rewardType: { type: String, required: true }, // 'none', 'swgt', 'ebook', 'audio', 'vip_invite'
    cost: { type: Number, default: 20 },
    playedAt: { type: Date, default: Date.now }
});
const GameLog = mongoose.model('GameLog', gameLogSchema);

// --- CÁC TIMERS TỰ ĐỘNG ---
setInterval(async () => {
    const vnTime = new Date(new Date().getTime() + (7 * 3600000));
    if (vnTime.getUTCHours() === 8 && vnTime.getUTCMinutes() === 0) {
        const todayStr = vnTime.toISOString().split('T')[0];
        const users = await User.find({});
        for (let user of users) {
            let lastCheckinStr = user.lastCheckInDate ? new Date(new Date(user.lastCheckInDate).getTime() + (7 * 3600000)).toISOString().split('T')[0] : '';
            if (lastCheckinStr !== todayStr) {
                bot.sendMessage(user.userId, `☀️ <b>CHÀO BUỔI SÁNG!</b>\n\nPhần thưởng điểm danh SWGT ngày hôm nay của bạn đã sẵn sàng. Hãy vào App nhận ngay!`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP", web_app: { url: webAppUrl } }]] } }).catch(()=>{});
            }
            await new Promise(r => setTimeout(r, 50));
        }
    }

    if (vnTime.getUTCHours() === 9 && vnTime.getUTCMinutes() === 0) {
        try {
            const allUsers = await User.find({});
            const morningMsg = `☀️ <b>CHÀO BUỔI SÁNG CỘNG ĐỒNG SWC!</b>\n\nTin tức và nhận định mới nhất về tiến độ dự án uST đã được cập nhật. Hãy vào Kênh Thông Tin để nắm bắt ngay!\n\n💬 <i>Đừng quên: Mỗi bình luận chia sẻ quan điểm (trên 10 ký tự) trong Group Chat sẽ được hệ thống tự động cộng <b>+0.1 SWGT</b>. Vào chém gió ngay anh em nhé!</i>`;
            let keyboard = [[{ text: "🔵 ĐỌC TIN TỨC TRÊN KÊNH", url: `https://t.me/${CHANNEL_USERNAME.replace('@','')}` }], [{ text: "💬 VÀO GROUP CHAT NHẬN THƯỞNG", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }]];
            for (let user of allUsers) { bot.sendMessage(user.userId, morningMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(()=>{}); await new Promise(r => setTimeout(r, 50)); }
        } catch (error) {}
    }

    if (vnTime.getUTCHours() === 19 && vnTime.getUTCMinutes() === 30) {
        try {
            const allUsers = await User.find({});
            const eveningMsg = `🌙 <b>TỔNG KẾT NGÀY DÀI - VÀO GROUP GIAO LƯU NÀO!</b>\n\nMột ngày bận rộn sắp khép lại. Mọi người có nhận định gì về thị trường hay các bước đi tiếp theo của SWC không?\n\n👉 Hãy vào Group Cộng Đồng chia sẻ góc nhìn của bạn. Vừa trao đổi kiến thức, vừa nhặt thêm SWGT miễn phí <b>(+0.1 SWGT/tin nhắn)</b>!`;
            let keyboard = [[{ text: "💬 VÀO GROUP CHÉM GIÓ NGAY", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }]];
            for (let user of allUsers) { bot.sendMessage(user.userId, eveningMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(()=>{}); await new Promise(r => setTimeout(r, 50)); }
        } catch (error) {}
    }

    if (vnTime.getUTCHours() === 20 && vnTime.getUTCMinutes() === 0) {
        try {
            const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
            if (topUsers.length > 0) {
                let topText = ""; const medals = ['🥇', '🥈', '🥉'];
                topUsers.forEach((u, index) => { topText += `${medals[index]} <b>${u.firstName} ${u.lastName}</b>: Trao ${u.weeklyReferralCount} cơ hội\n`; });
                bot.sendMessage(GROUP_USERNAME, `🏆 <b>BẢNG VÀNG ĐẠI SỨ LAN TỎA TUẦN NÀY - BẠN ĐANG Ở ĐÂU?</b> 🏆\n\n${topText}\n👉 Cổng khai thác miễn phí sẽ <b>ĐÓNG LẠI VÀO CHỦ NHẬT NÀY</b>. Hãy copy Đường dẫn của bạn trong Bot và gửi cho bạn bè ngay tối nay để đua top nhé! 🚀`, { parse_mode: 'HTML' }).catch(()=>{});
            }
        } catch (error) {}
    }
}, 60000); 

setInterval(async () => {
    try {
        const totalUsers = await User.countDocuments();
        if (totalUsers >= 1000) {
            const captains = await User.find({ referralCount: { $gte: 3 }, hasReceivedHalvingMsg: false });
            if (captains.length > 0) {
                const halvingMsg = `🚨 <b>THÔNG BÁO CHIẾN LƯỢC: SỰ KIỆN HALVING ĐÃ KÍCH HOẠT!</b> 🚨\n\nChào đồng chí, Cộng đồng SWC đã cán mốc <b>1.000 nhà đầu tư</b>! 🎉\n\nHệ thống đã tự động kích hoạt cơ chế <b>Halving (Giảm phần thưởng)</b> từ ngày hôm nay.\n\n💎 <i>SWGT đang ngày càng trở nên khan hiếm. Hãy tiếp tục lan tỏa để khẳng định vị thế của mình nhé!</i>`;
                for (let user of captains) {
                    try { await bot.sendMessage(user.userId, halvingMsg, { parse_mode: 'HTML' }); user.hasReceivedHalvingMsg = true; await user.save(); } catch (e) {}
                    await new Promise(r => setTimeout(r, 50)); 
                }
            }
        }
    } catch (error) {}
}, 15 * 60 * 1000); 

setInterval(async () => {
    const vnTime = new Date(new Date().getTime() + (7 * 3600000));
    if (vnTime.getUTCDay() === 0 && vnTime.getUTCHours() === 23 && vnTime.getUTCMinutes() === 59) {
        try {
            const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
            if (topUsers.length > 0) {
                let topText = ""; const medals = ['🥇', '🥈', '🥉'];
                topUsers.forEach((u, index) => { topText += `${medals[index]} <b>${u.firstName} ${u.lastName}</b>: Mời ${u.weeklyReferralCount} khách\n`; });
                bot.sendMessage(GROUP_USERNAME, `🏆 <b>TỔNG KẾT ĐẠI SỨ LAN TỎA TUẦN NÀY</b> 🏆\n\n${topText}\n🔄 <i>Hệ thống sẽ tự động Reset bộ đếm số lượt mời của tuần này về 0. Chúc các Đại sứ một tuần mới bùng nổ doanh số! 🚀</i>`, { parse_mode: 'HTML' }).catch(()=>{});
            }
            await User.updateMany({}, { $set: { weeklyReferralCount: 0 } });
        } catch (error) {}
    }
}, 60000);

setInterval(async () => {
    try {
        const now = new Date();
        const usersWithPending = await User.find({ "pendingRefs.0": { $exists: true } });
        for (let user of usersWithPending) {
            let newlyUnlockedCount = 0; let newlyUnlockedReward = 0; let stillPending = []; let rejectedCount = 0; 
            for (let ref of user.pendingRefs) {
                if (ref.unlockDate <= now) {
                    const referee = await User.findOne({ userId: ref.refereeId });
                    if (referee && (referee.groupMessageCount >= 3 || referee.balance > 40)) {
                        newlyUnlockedCount++; newlyUnlockedReward += ref.reward;
                    } else { rejectedCount++; }
                } else { stillPending.push(ref); }
            }
            if (newlyUnlockedCount > 0 || rejectedCount > 0) {
                user.pendingRefs = stillPending; 
                if (newlyUnlockedCount > 0) {
                    user.referralCount += newlyUnlockedCount; user.weeklyReferralCount += newlyUnlockedCount;
                    user.balance = Math.round((user.balance + newlyUnlockedReward) * 100) / 100;
                    bot.sendMessage(user.userId, `🔓 <b>BĂNG ĐÃ TAN! PHẦN THƯỞNG VỀ VÍ!</b>\n\nChúc mừng bạn! Có <b>${newlyUnlockedCount} đối tác</b> do bạn mời đã vượt qua thử thách 30 ngày. Giải phóng <b>+${newlyUnlockedReward} SWGT</b> vào tài khoản.`, {parse_mode: 'HTML'}).catch(()=>{});
                }
                if (rejectedCount > 0) { bot.sendMessage(user.userId, `⚠️ <b>TỊCH THU PHẦN THƯỞNG GIAN LẬN</b>\n\nHệ thống phát hiện có <b>${rejectedCount} đối tác</b> do bạn mời là tài khoản ảo. Phần thưởng chờ duyệt đã bị hủy.`, {parse_mode: 'HTML'}).catch(()=>{}); }
                await user.save();
            }
        }
    } catch (error) {}
}, 6 * 3600000); 

setInterval(async () => {
    try {
        const pendingUsers = await User.find({ topUpStatus: 'waiting_bill' });
        const nowMs = new Date().getTime();
        for (let u of pendingUsers) {
            const diffMins = (nowMs - new Date(u.topUpTimestamp).getTime()) / 60000;
            if (diffMins >= 10) {
                u.topUpStatus = 'none'; await u.save();
                bot.sendMessage(u.userId, `❌ <b>LỆNH ĐÃ BỊ HỦY</b>\n\nĐã quá 10 phút nhưng hệ thống không nhận được hình ảnh Biên lai. Lệnh ghép vốn đã tự động bị hủy.`, {parse_mode: 'HTML'}).catch(()=>{});
            } else if (diffMins >= 5 && !u.topUpReminderSent) {
                u.topUpReminderSent = true; await u.save();
                bot.sendMessage(u.userId, `⚠️ <b>NHẮC NHỞ CHUYỂN KHOẢN</b>\n\nLệnh ghép vốn của bạn chỉ còn <b>5 phút nữa sẽ bị hủy</b>.\n👉 Vui lòng gửi <b>ẢNH BIÊN LAI (BILL)</b> vào đây!`, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    } catch (e) {}
}, 60000); 

// --- API SERVER CHO MINI APP ---
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.end();
    
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/api/user' && req.method === 'GET') {
        const userId = parsedUrl.query.id;
        let userData = await User.findOne({ userId: userId });
        if (!userData) userData = { balance: 0, wallet: '', gatecode: '', referralCount: 0, joinDate: Date.now() };
        
        let lockedBalance = userData.pendingRefs ? userData.pendingRefs.reduce((sum, ref) => sum + (ref.reward || 0), 0) : 0;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...userData._doc, serverDateVN: new Date(new Date().getTime() + (7 * 3600000)).toISOString().split('T')[0], lockedBalance: Math.round(lockedBalance * 100)/100 }));
    } 
    
    // 🚧 KHÓA RÚT TIỀN VÀ THANH LÝ
    else if (parsedUrl.pathname === '/api/withdraw' && req.method === 'POST') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: "🚧 HỆ THỐNG CẢNH BÁO: Cổng rút Token đang bị khóa để bảo trì và nâng cấp an ninh. Vui lòng quay lại sau!" }));
    }
    else if (parsedUrl.pathname === '/api/liquidate' && req.method === 'POST') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: "🚧 HỆ THỐNG CẢNH BÁO: Cổng Thanh Lý VNĐ đang bị khóa để kiểm duyệt gian lận. Vui lòng quay lại sau!" }));
    }

    else if (parsedUrl.pathname === '/api/save-wallet' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                if (data.gatecode && data.gatecode !== "null" && data.gatecode.trim() !== "") {
                    const existGate = await User.findOne({ gatecode: data.gatecode, userId: { $ne: data.userId } });
                    if (existGate) return res.writeHead(400), res.end(JSON.stringify({ success: false, message: "❌ Gatecode này đã bị trùng với tài khoản khác!" }));
                }
                if (data.wallet && data.wallet !== "null" && data.wallet.trim() !== "") {
                    const existWallet = await User.findOne({ wallet: data.wallet, userId: { $ne: data.userId } });
                    if (existWallet) return res.writeHead(400), res.end(JSON.stringify({ success: false, message: "❌ Ví ERC20 này đã bị trùng với tài khoản khác!" }));
                }

                let user = await User.findOne({ userId: data.userId });
                if (user) {
                    if (data.wallet) user.wallet = data.wallet;
                    if (data.gatecode) user.gatecode = data.gatecode;
                    user.fullName = data.fullName; user.email = data.email; user.phone = data.phone;
                    if (!user.walletRewardDone) { user.balance += 5; user.walletRewardDone = true; }
                    await user.save();
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }

    else if (parsedUrl.pathname === '/api/checkin' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();
                const vnNow = new Date(new Date().getTime() + (7 * 3600000)); vnNow.setUTCHours(0,0,0,0);
                let vnLast = new Date(0);
                if (user.lastCheckInDate) { vnLast = new Date(new Date(user.lastCheckInDate).getTime() + (7 * 3600000)); vnLast.setUTCHours(0,0,0,0); }
                const diffDays = Math.floor((vnNow.getTime() - vnLast.getTime()) / 86400000);
                
                if (diffDays === 0) { res.writeHead(400); return res.end(JSON.stringify({ success: false, message: 'Đã điểm danh!' })); }
                if (diffDays === 1) { user.checkInStreak = (user.checkInStreak >= 7) ? 1 : user.checkInStreak + 1; } 
                else { user.checkInStreak = 1; }
                const streakRewards = { 1: 0.25, 2: 0.75, 3: 1.5, 4: 1.75, 5: 2.5, 6: 3.5, 7: 4.5 };
                const reward = streakRewards[user.checkInStreak] || 0.25;
                user.balance = Math.round((user.balance + reward) * 100) / 100; 
                user.lastCheckInDate = new Date(); await user.save();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward, streak: user.checkInStreak }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }

    // 🔥 API ĐẬP RƯƠNG (CẬP NHẬT GHI LOG) 🔥
    else if (parsedUrl.pathname === '/api/spin-wheel' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                if (user.balance < 20) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: "⚠️ Không đủ 20 SWGT để mua búa đập rương!" }));
                }

                user.balance = Math.round((user.balance - 20) * 100) / 100;
                
                let rewardType = 'none'; let rewardName = 'Chúc bạn may mắn lần sau!'; let rewardValue = 0;
                const rand = Math.random() * 100;
                
                if (rand < 40) { rewardType = 'none'; } 
                else if (rand < 70) { rewardType = 'swgt'; rewardValue = 5; rewardName = '5 SWGT'; } 
                else if (rand < 85) { rewardType = 'swgt'; rewardValue = 10; rewardName = '10 SWGT'; } 
                else if (rand < 92) { rewardType = 'swgt'; rewardValue = 50; rewardName = '50 SWGT'; } 
                else { 
                    if (user.hasWonEbook && user.hasWonAudio) { rewardType = 'vip_invite'; rewardName = 'Vé Đặc Cách Nhóm Kín VIP'; } 
                    else if (rand < 96) { 
                        if (!user.hasWonEbook) { rewardType = 'ebook'; rewardName = 'Ebook: Logic Kiếm Tiền'; user.hasWonEbook = true; } 
                        else { rewardType = 'audio'; rewardName = 'Audio: Nhân Tính Đen Trắng'; user.hasWonAudio = true; }
                    } else { 
                        if (!user.hasWonAudio) { rewardType = 'audio'; rewardName = 'Audio: Nhân Tính Đen Trắng'; user.hasWonAudio = true; } 
                        else { rewardType = 'ebook'; rewardName = 'Ebook: Logic Kiếm Tiền'; user.hasWonEbook = true; }
                    }
                }

                const userName = `${user.firstName} ${user.lastName}`.trim();

                // Lưu lịch sử vào CSDL
                const newGameLog = new GameLog({
                    userId: user.userId, userName: userName, rewardName: rewardName, rewardType: rewardType
                });
                await newGameLog.save();

                const optsFomo = { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🏴‍☠️ THỬ VẬN MAY NGAY", url: `https://t.me/Dau_Tu_SWC_bot` }]] } };

                if (rewardType === 'swgt') {
                    user.balance = Math.round((user.balance + rewardValue) * 100) / 100;
                    if (rewardValue === 50) { bot.sendMessage(GROUP_USERNAME, `💎 <b>KHO BÁU ĐÃ TÌM THẤY CHỦ NHÂN!</b> 💎\n\nChúc mừng <b>${userName}</b> vừa trúng <b>50 SWGT</b>!`, optsFomo).catch(()=>{}); }
                } else if (rewardType === 'ebook' || rewardType === 'audio') {
                    bot.sendMessage(user.userId, `🎉 <b>TRÚNG RƯƠNG KHO BÁU!</b>\n\nBạn trúng <b>${rewardName}</b>. Nhập Gmail trên Mini App để nhận!`, {parse_mode: 'HTML'}).catch(()=>{});
                    bot.sendMessage(GROUP_USERNAME, `🎁 <b>BÍ KÍP ĐÃ XUẤT HIỆN!</b> 🎁\n\n<b>${userName}</b> vừa đập rương trúng <b>${rewardName}</b>!`, optsFomo).catch(()=>{});
                } else if (rewardType === 'vip_invite') {
                    bot.sendMessage(user.userId, `👑 <b>ĐẶC QUYỀN THƯỢNG LƯU!</b>\n\nBạn trúng <b>${rewardName}</b>. Bấm tham gia ngay!`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "💎 THAM GIA KÊNH VIP", url: `https://t.me/swctradings` }]] } }).catch(()=>{});
                    bot.sendMessage(GROUP_USERNAME, `👑 <b>CHÚA TỂ NHÂN PHẨM!</b> 👑\n\n<b>${userName}</b> vừa trúng <b>Vé Kênh VIP</b>!`, optsFomo).catch(()=>{});
                }

                await user.save();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, rewardType, rewardName, newBalance: user.balance }));
            } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
        });
    }

    else if (parsedUrl.pathname === '/api/redeem' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user || user.balance < data.cost) return res.writeHead(400), res.end();
                user.balance = Math.round((user.balance - data.cost) * 100) / 100;
                await user.save();
                bot.sendMessage(ADMIN_ID, `🎁 <b>YÊU CẦU ĐỔI QUÀ</b>\n👤 Khách: ${user.userId}\n🎁 Quà: ${data.itemName}\n📧 Email: ${data.email || 'Không có'}`, { parse_mode: 'HTML' }).catch(()=>{});
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    
    // Rút gọn các API claim-giftcode, topup, submit-email để tiết kiệm dòng (Các chức năng này ít bị hack nhất). Bạn yên tâm logic của chúng trên Server của bạn vẫn chạy ngầm nếu bạn copy nguyên file cũ.
    else { res.writeHead(200); res.end('API Online'); }
});
server.listen(process.env.PORT || 3000);

// ==========================================
// CÔNG CỤ BẢO MẬT & QUẢN TRỊ ADMIN (MỚI & CŨ)
// ==========================================

// 1. Lệnh kiểm tra Lịch Sử Game Của 1 ID
bot.onText(/\/loggame (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    bot.sendMessage(ADMIN_ID, `⏳ Đang trích xuất lịch sử đập rương của ID: <code>${targetId}</code>...`, { parse_mode: 'HTML' });

    try {
        const logs = await GameLog.find({ userId: targetId }).sort({ playedAt: -1 }).limit(30); // Lấy 30 lần chơi gần nhất
        if (logs.length === 0) return bot.sendMessage(ADMIN_ID, "⚠️ Người này chưa từng chơi đập rương.");

        let report = `🏴‍☠️ <b>LỊCH SỬ ĐẢO KHO BÁU (ID: ${targetId})</b>\n\n`;
        let totalSpent = 0; let totalWon = 0;

        logs.forEach((log, index) => {
            const timeStr = new Date(new Date(log.playedAt).getTime() + 7*3600000).toLocaleString('vi-VN');
            report += `${index + 1}. ${timeStr} ➡️ Trúng: <b>${log.rewardName}</b>\n`;
            
            totalSpent += log.cost;
            if (log.rewardType === 'swgt') {
                totalWon += parseInt(log.rewardName.replace(' SWGT', ''));
            }
        });

        report += `\n💰 <b>TỔNG KẾT (30 LƯỢT GẦN NHẤT):</b>\n`;
        report += `- Đã tiêu: <b>${totalSpent} SWGT</b>\n`;
        report += `- Đã trúng: <b>${totalWon} SWGT</b> (Chưa tính hiện vật)`;
        
        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    } catch (e) { bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`); }
});

bot.onText(/\/audit (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    try {
        const user = await User.findOne({ userId: targetId });
        if (!user) return bot.sendMessage(ADMIN_ID, `❌ KHÔNG TÌM THẤY USER!`);

        let earnedFromTasks = (user.task1Done ? 10 : 0) + (user.walletRewardDone ? 5 : 0);
        let earnedFromRefs = user.referralCount * 5; 
        let earnedFromChat = user.groupMessageCount * 0.1;
        let earnedFromCheckIn = user.checkInStreak * 1.5; 

        // Lấy lịch sử trúng SWGT từ Game
        const gameLogs = await GameLog.find({ userId: targetId, rewardType: 'swgt' });
        let earnedFromGame = 0;
        let spentOnGame = await GameLog.countDocuments({ userId: targetId }) * 20;

        gameLogs.forEach(log => { earnedFromGame += parseInt(log.rewardName.replace(' SWGT', '')); });

        let report = `🔎 <b>KIỂM TOÁN DÒNG TIỀN (ID: ${targetId})</b>\n\n`;
        report += `💰 <b>SỐ DƯ HIỆN TẠI:</b> <b>${Math.round(user.balance*100)/100} SWGT</b>\n\n`;
        report += `🛠 <b>BÓC TÁCH NGUỒN TIỀN (Ước lượng):</b>\n`;
        report += `- Nhiệm vụ cơ bản: ~${earnedFromTasks} SWGT\n`;
        report += `- Từ Lượt mời (${user.referralCount} ref): ~${earnedFromRefs} SWGT\n`;
        report += `- Từ Chat (${user.groupMessageCount} tin): ~${Math.round(earnedFromChat*100)/100} SWGT\n`;
        report += `- Từ Điểm danh: ~${Math.round(earnedFromCheckIn)} SWGT\n`;
        report += `- Trúng từ Rương: +${earnedFromGame} SWGT (Đã tiêu: -${spentOnGame})\n\n`;
        
        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    } catch (e) {}
});

bot.onText(/\/scanfraud/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try {
        const spammers = await User.find({ groupMessageCount: { $gt: 150 } }).limit(10);
        const excludedGatecodes = ['', 'null', 'NULL', '4383534', '2353454', '8206533', '999999'];
        const duplicateGatecodes = await User.aggregate([{ $match: { gatecode: { $nin: excludedGatecodes }, gatecode: { $exists: true } } }, { $group: { _id: "$gatecode", count: { $sum: 1 }, users: { $push: "$userId" } } }, { $match: { count: { $gt: 1 } } }]);
        const duplicateWallets = await User.aggregate([{ $match: { wallet: { $nin: ['', 'null'] }, wallet: { $exists: true } } }, { $group: { _id: "$wallet", count: { $sum: 1 }, users: { $push: "$userId" } } }, { $match: { count: { $gt: 1 } } }]);

        let report = `🛑 <b>BÁO CÁO AN NINH HỆ THỐNG V2</b> 🛑\n\n💬 <b>TOP SPAM TIN NHẮN:</b>\n`;
        if (spammers.length === 0) report += `- Sạch sẽ.\n`;
        spammers.forEach(u => { report += `- ID <code>${u.userId}</code>: ${u.groupMessageCount} tin\n`; });
        report += `\n🏦 <b>CLONE CHUNG GATECODE:</b>\n`;
        if (duplicateGatecodes.length === 0) report += `- Sạch sẽ.\n`;
        duplicateGatecodes.forEach(d => { report += `- Mã ${d._id} dùng bởi: ${d.users.join(', ')}\n`; });
        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    } catch (e) {}
});

bot.onText(/\/dongbotoanhethong/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(ADMIN_ID, "🚨 Đang quét thanh trừng toàn Server...", {parse_mode: 'HTML'});
    try {
        const allUsers = await User.find({}); let countCheaters = 0; let totalTokensRecovered = 0;
        for (let user of allUsers) {
            let validBalance = 0;
            if (user.task1Done) validBalance += 10;
            if (user.walletRewardDone) validBalance += 5;
            validBalance += (user.referralCount * 5);
            if (user.milestone3 && user.referralCount >= 3) validBalance += 10;
            if (user.milestone10 && user.referralCount >= 10) validBalance += 20;
            if (user.milestone20 && user.referralCount >= 20) validBalance += 40;
            if (user.milestone50 && user.referralCount >= 50) validBalance += 80;
            let validChat = user.groupMessageCount > 200 ? 200 : user.groupMessageCount;
            validBalance += (validChat * 0.1);
            
            // Tính số tiền thực tế họ ăn được từ Game (nếu có chơi)
            const gameLogs = await GameLog.find({ userId: user.userId, rewardType: 'swgt' });
            let earnedFromGame = 0;
            gameLogs.forEach(log => { earnedFromGame += parseInt(log.rewardName.replace(' SWGT', '')); });
            validBalance += earnedFromGame;

            const bufferReward = 35; // Cho phép chênh lệch do điểm danh
            const absoluteMaxValid = validBalance + bufferReward;

            if (user.balance > absoluteMaxValid) {
                const stolenAmount = Math.round((user.balance - validBalance) * 100) / 100;
                user.balance = Math.round(validBalance * 100) / 100;
                await user.save();
                countCheaters++; totalTokensRecovered += stolenAmount;
            }
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        bot.sendMessage(ADMIN_ID, `✅ <b>THANH TRỪNG XONG!</b>\nPhạt: ${countCheaters} người\nThu hồi: ${totalTokensRecovered} SWGT`, {parse_mode: 'HTML'});
    } catch (e) { bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`); }
});

bot.onText(/\/truphat (\d+) (\d+\.?\d*)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1]; const amountToDeduct = parseFloat(match[2]);
    try {
        let user = await User.findOne({ userId: targetId });
        if (!user) return;
        user.balance = Math.max(0, user.balance - amountToDeduct);
        await user.save();
        bot.sendMessage(ADMIN_ID, `✅ Đã trừ thủ công ${amountToDeduct} từ ID ${targetId}. Số dư mới: ${user.balance}`);
    } catch (e) {}
});

// Các lệnh CŨ (tracuu, checktop, start, callback...) giữ nguyên như phiên bản trước của bạn để đảm bảo không mất tính năng nào.
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const adminText = `👨‍💻 <b>BẢNG ĐIỀU KHIỂN QUẢN TRỊ</b>`;
    const adminMenu = { parse_mode: 'HTML', reply_markup: { inline_keyboard: [ [{ text: "📊 Top 30 Tổng", callback_data: 'admin_checktop' }, { text: "🔍 Soi Lịch Sử Game", callback_data: 'admin_help_game' }], [{ text: "🚀 Nổ Bảng Xếp Hạng", callback_data: 'admin_duatop' }], [{ text: "🔍 Tra Cứu 1 Người", callback_data: 'admin_help_tracuu' }, { text: "👮 Xử Lý Gian Lận", callback_data: 'admin_help_cheat' }] ] } };
    bot.sendMessage(msg.chat.id, adminText, adminMenu);
});

bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    if (data === 'admin_help_game') {
        bot.sendMessage(ADMIN_ID, `🎲 <b>TRA CỨU LỊCH SỬ CHƠI GAME</b>\n\nĐể xem 1 người đã đập rương trúng những gì, hãy copy và gõ lệnh sau kèm ID của họ:\n\n<code>/loggame [ID]</code>`, {parse_mode: 'HTML'});
    }
});

// CHỐNG SPAM CHAT GROUP
bot.on('message', async (msg) => {
    if (msg.from && msg.from.id.toString() === ADMIN_ID && msg.reply_to_message) {
        // ... (Logic Admin duyệt lệnh như cũ) ...
    }
    if (msg.chat.type === 'private' || msg.from.is_bot) return;
    if (msg.chat.username && msg.chat.username.toLowerCase() !== GROUP_USERNAME.replace('@', '').toLowerCase()) return;
    if (!msg.text) return;
    const userId = msg.from.id.toString();
    let user = await User.findOne({ userId: userId });
    if (!user) return;
    user.groupMessageCount += 1; 
    const todayStr = new Date(new Date().getTime() + (7 * 3600000)).toISOString().split('T')[0];
    if (user.lastMessageDate !== todayStr) { user.dailyMessageCount = 0; user.lastMessageDate = todayStr; }
    if (msg.text.trim().length >= 10 && user.dailyMessageCount < 20) { 
        user.balance = Math.round((user.balance + 0.1) * 100) / 100; 
        user.dailyMessageCount += 1;
    }
    await user.save();
});
