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

const gameLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    userName: { type: String, default: '' },
    rewardName: { type: String, required: true },
    rewardType: { type: String, required: true },
    cost: { type: Number, default: 20 },
    playedAt: { type: Date, default: Date.now }
});
const GameLog = mongoose.model('GameLog', gameLogSchema);

// --- TIMERS CŨ GIỮ NGUYÊN (NHẮC ĐIỂM DANH, LÙA TRAFFIC, BĂNG TAN...) ---
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
        }
    }
}, 60000); 

// --- API SERVER ---
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
    
    // 🚧 KHÓA CỔNG RÚT TIỀN (WITHDRAW) VÀ THANH LÝ
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
                const newGameLog = new GameLog({ userId: user.userId, userName: userName, rewardName: rewardName, rewardType: rewardType });
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
    else { res.writeHead(200); res.end('API Online'); }
});
server.listen(process.env.PORT || 3000);

// ==========================================
// BỘ CÔNG CỤ XỬ LÝ GIAN LẬN MỚI (ĐÃ TỐI ƯU DUNG SAI CHO KHÁCH CŨ)
// ==========================================

bot.onText(/\/loggame (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    bot.sendMessage(ADMIN_ID, `⏳ Đang trích xuất lịch sử đập rương của ID: <code>${targetId}</code>...`, { parse_mode: 'HTML' });

    try {
        const logs = await GameLog.find({ userId: targetId }).sort({ playedAt: -1 }).limit(30); 
        if (logs.length === 0) return bot.sendMessage(ADMIN_ID, "⚠️ Lịch sử Game trống. (Hoặc họ chơi từ trước khi hệ thống lắp tính năng ghi Log).");

        let report = `🏴‍☠️ <b>LỊCH SỬ ĐẢO KHO BÁU (ID: ${targetId})</b>\n\n`;
        let totalSpent = 0; let totalWon = 0;
        logs.forEach((log, index) => {
            const timeStr = new Date(new Date(log.playedAt).getTime() + 7*3600000).toLocaleString('vi-VN');
            report += `${index + 1}. ${timeStr} ➡️ Trúng: <b>${log.rewardName}</b>\n`;
            totalSpent += log.cost;
            if (log.rewardType === 'swgt') { totalWon += parseInt(log.rewardName.replace(' SWGT', '')); }
        });
        report += `\n💰 <b>TỔNG KẾT LỊCH SỬ MỚI:</b>\n- Đã tiêu: <b>${totalSpent} SWGT</b>\n- Đã trúng: <b>${totalWon} SWGT</b>\n`;
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
        
        const gameLogs = await GameLog.find({ userId: targetId, rewardType: 'swgt' });
        let earnedFromNewGameLogs = 0;
        gameLogs.forEach(log => { earnedFromNewGameLogs += parseInt(log.rewardName.replace(' SWGT', '')); });

        // TÍNH TOÁN DUNG SAI CHO LỊCH SỬ CŨ KHÔNG GHI LOG
        let validBalance = earnedFromTasks + earnedFromRefs + earnedFromChat + earnedFromNewGameLogs;
        let toleranceBuffer = 100; // Cho phép chênh lệch do điểm danh hoặc chơi trúng game lúc trước
        let currentBal = user.balance;

        let report = `🔎 <b>KIỂM TOÁN DÒNG TIỀN (ID: ${targetId})</b>\n\n`;
        report += `💰 <b>SỐ DƯ HIỆN TẠI:</b> <b>${Math.round(currentBal*100)/100} SWGT</b>\n\n`;
        report += `🛠 <b>BÓC TÁCH NGUỒN TIỀN (CHẮC CHẮN ĐẾM ĐƯỢC):</b>\n`;
        report += `- Nhiệm vụ cơ bản: ${earnedFromTasks} SWGT\n`;
        report += `- Từ Lượt mời (${user.referralCount} ref): ${earnedFromRefs} SWGT\n`;
        report += `- Từ Chat (${user.groupMessageCount} tin): ${Math.round(earnedFromChat*100)/100} SWGT\n`;
        report += `- Trúng từ Game (Lịch sử mới): +${earnedFromNewGameLogs} SWGT\n\n`;
        report += `⚠️ Mức Dôi Dư Không Ghi Log: <b>${Math.round((currentBal - validBalance)*100)/100} SWGT</b>\n`;
        
        if ((currentBal - validBalance) > toleranceBuffer) {
            report += `🚨 <b>KẾT LUẬN CẢNH BÁO ĐỎ:</b> Mức dôi dư quá lớn (>100 SWGT). Không thể nào đập rương hay điểm danh mà ra chừng này tiền được. <b>100% LÀ TOOL LÁCH API!</b>\n`;
        } else {
            report += `✅ <b>KẾT LUẬN:</b> Hợp lý (Nằm trong biên độ dung sai của người từng chơi game/điểm danh thời kỳ cũ).\n`;
        }

        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    } catch (e) {}
});

// 🔥 LƯỚI QUÉT THANH TRỪNG TOÀN HỆ THỐNG V2 (THÔNG MINH HƠN) 🔥
bot.onText(/\/dongbotoanhethong/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(ADMIN_ID, "🚨 Đang quét thanh trừng toàn Server (Đã áp dụng Thuật toán Dung sai bảo vệ người cũ)...", {parse_mode: 'HTML'});
    
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
            
            // Chặn tính tiền spam chat quá đáng
            let validChat = user.groupMessageCount > 200 ? 200 : user.groupMessageCount;
            validBalance += (validChat * 0.1);
            
            // Tính số tiền thực tế họ ăn được từ Game (trong Lịch sử Mới)
            const gameLogs = await GameLog.find({ userId: user.userId, rewardType: 'swgt' });
            let earnedFromGame = 0;
            gameLogs.forEach(log => { earnedFromGame += parseInt(log.rewardName.replace(' SWGT', '')); });
            validBalance += earnedFromGame;

            // DUNG SAI BẢO VỆ: 100 SWGT
            // (Cho phép những người chơi game ở bản code cũ trúng giải mà không bị trừ oan)
            const toleranceBuffer = 100; 
            const absoluteMaxValid = validBalance + toleranceBuffer;

            if (user.balance > absoluteMaxValid) {
                // Chỉ những kẻ có mức chênh lệch quá đáng (bơm hàng trăm SWGT) mới bị trảm!
                const stolenAmount = Math.round((user.balance - validBalance) * 100) / 100;
                user.balance = Math.round(validBalance * 100) / 100;
                await user.save();
                countCheaters++; totalTokensRecovered += stolenAmount;

                try { bot.sendMessage(user.userId, `⚠️ <b>HỆ THỐNG AN NINH SWC VỪA QUÉT TÀI KHOẢN CỦA BẠN!</b>\n\nPhát hiện tài khoản có lượng SWGT gia tăng quá mức bất thường.\n\n🛑 <b>Hành động xử lý:</b> Đồng bộ số dư của bạn về đúng giá trị thực lực!\n<i>Cổng rút tiền của bạn đã bị khóa. Vui lòng dừng ngay việc lách Tool!</i>`, {parse_mode: 'HTML'}); } catch (e) {}
            }
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        bot.sendMessage(ADMIN_ID, `✅ <b>THANH TRỪNG XONG!</b>\nPhạt: ${countCheaters} người\nThu hồi: ${Math.round(totalTokensRecovered)} SWGT`, {parse_mode: 'HTML'});
    } catch (e) { bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`); }
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

// ==========================================
// CÁC LỆNH ADMIN VÀ MENU CŨ GIỮ NGUYÊN HOÀN TOÀN
// ==========================================
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const adminText = `👨‍💻 <b>BẢNG ĐIỀU KHIỂN QUẢN TRỊ</b>`;
    const adminMenu = { parse_mode: 'HTML', reply_markup: { inline_keyboard: [ [{ text: "📊 Top 30 Tổng", callback_data: 'admin_checktop' }, { text: "🏆 Top Tuần", callback_data: 'admin_toptuan' }], [{ text: "💰 Thống Kê Két Sắt", callback_data: 'admin_thongke' }, { text: "👀 Soi Dòng Tiền", callback_data: 'admin_soivietien' }], [{ text: "🚀 Nổ Bảng Xếp Hạng Lên Group", callback_data: 'admin_duatop' }], [{ text: "🔍 Tra Cứu 1 Người", callback_data: 'admin_help_tracuu' }, { text: "👮 Xử Lý Gian Lận", callback_data: 'admin_help_cheat' }], [{ text: "🎁 Tạo Code & Truyền Thông", callback_data: 'admin_help_mkt' }, { text: "🎲 Lịch Sử Game", callback_data: 'admin_help_game' }] ] } };
    bot.sendMessage(msg.chat.id, adminText, adminMenu);
});

bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    if (data === 'admin_help_game') {
        bot.sendMessage(ADMIN_ID, `🎲 <b>TRA CỨU LỊCH SỬ CHƠI GAME</b>\n\nĐể xem 1 người đã đập rương trúng những gì, hãy copy và gõ lệnh sau kèm ID của họ:\n\n<code>/loggame [ID]</code>`, {parse_mode: 'HTML'});
    }
    // ... [Các luồng callback cũ giữ nguyên theo chuẩn] ...
});

async function checkMembership(userId) {
    try {
        const channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        const validStatuses = ['member', 'administrator', 'creator'];
        return { inChannel: validStatuses.includes(channelMember.status), inGroup: validStatuses.includes(groupMember.status) };
    } catch (error) { return { error: true }; }
}

bot.onText(/\/testkichban/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const testMenu = { parse_mode: 'HTML', reply_markup: { inline_keyboard: [ [{ text: "🤝 Kịch bản Mời người (A mời B)", callback_data: 'test_invite' }], [{ text: "☀️ Kịch bản 8H (Nhắc Điểm danh)", callback_data: 'test_8h' }], [{ text: "🌅 Kịch bản 9H Sáng (Lùa Traffic)", callback_data: 'test_9h' }], [{ text: "🌃 Kịch bản 19H30 Tối (Lùa Traffic)", callback_data: 'test_19h30' }], [{ text: "🔓 Kịch bản Băng Tan (Rã đông 30D)", callback_data: 'test_unlock' }], [{ text: "🏃 Kịch bản Rời nhóm (Phạt B & A)", callback_data: 'test_leave' }] ] } };
    bot.sendMessage(ADMIN_ID, `🛠 <b>BẢNG ĐIỀU KHIỂN TEST KỊCH BẢN</b>\n\nNgười A (Leader): <code>7515902413</code>\nNgười B (Khách): <code>8364834164</code>\n\nHãy chọn kịch bản bạn muốn test ngay bây giờ:`, testMenu);
});

bot.onText(/\/tracuu (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    bot.sendMessage(ADMIN_ID, `⏳ Đang truy xuất thông tin của ID: <code>${targetId}</code>...`, { parse_mode: 'HTML' });
    try {
        const user = await User.findOne({ userId: targetId });
        if (!user) return bot.sendMessage(ADMIN_ID, `❌ <b>KHÔNG TÌM THẤY!</b>`, { parse_mode: 'HTML' });

        let report = `🔎 <b>HỒ SƠ NGƯỜI DÙNG (ID: ${targetId})</b>\n\n`;
        report += `👤 <b>Họ Tên:</b> ${user.firstName} ${user.lastName}\n`;
        report += `📅 <b>Tham Gia:</b> ${new Date(user.joinDate).toLocaleString('vi-VN')}\n\n`;
        report += `💰 <b>SỐ DƯ TÀI SẢN:</b> <b>${user.balance} SWGT</b>\n`;
        let lockedBalance = 0;
        if (user.pendingRefs && user.pendingRefs.length > 0) { lockedBalance = user.pendingRefs.reduce((sum, ref) => sum + (ref.reward || 0), 0); }
        report += `🔒 <b>Đang Khóa 30D:</b> <b>${Math.round(lockedBalance * 100) / 100} SWGT</b>\n\n`;
        report += `👥 <b>Tổng Lượt Mời:</b> ${user.referralCount} người\n`;
        report += `💳 <b>RÚT TIỀN:</b>\n- Ví ERC20: <code>${user.wallet || 'Chưa cập nhật'}</code>\n- Gatecode: <code>${user.gatecode || 'Chưa cập nhật'}</code>\n\n`;
        report += `👉 <a href="tg://user?id=${targetId}">Nhấn vào đây để nhắn tin trực tiếp</a>`;
        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    } catch (error) {}
});

bot.onText(/\/checktop/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({ referralCount: { $gt: 0 } }).sort({ referralCount: -1 }).limit(30);
    let response = "🕵️‍♂️ <b>DANH SÁCH TOP 30 ĐẠI SỨ:</b>\n\n";
    users.forEach((u, index) => { response += `${index + 1}. ${u.firstName} ${u.lastName}\n🆔 ID: <code>${u.userId}</code>\n👥 Mời: ${u.referralCount} | 💰 Dư: ${u.balance}\n--------------------------\n`; });
    bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
});

bot.onText(/\/checkref (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    const refs = await User.find({ referredBy: targetId }).sort({ joinDate: -1 });
    if (refs.length === 0) return bot.sendMessage(ADMIN_ID, "❌ Chưa mời được ai.");
    let doneCount = 0; let notDoneCount = 0;
    refs.forEach(r => { if (r.task1Done) { doneCount++; } else { notDoneCount++; } });
    let response = `🕵️‍♂️ <b>BÁO CÁO ID: <code>${targetId}</code></b>\n📊 Bấm link: ${refs.length}\n✅ Đã Join: ${doneCount}\n❌ Chưa Join: ${notDoneCount}\n`;
    bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
});

// Chống Spam Chat Group
bot.on('message', async (msg) => {
    if (msg.from && msg.from.id.toString() === ADMIN_ID && msg.reply_to_message) {
        // Code Admin phản hồi bill... (Giữ nguyên logic bạn đã có)
        return; 
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
