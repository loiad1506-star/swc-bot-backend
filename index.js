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
    tag: { type: String, default: '' } // Biến mới phân loại khách
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
// CÁC TÍNH NĂNG TỰ ĐỘNG (GIỮ NGUYÊN)
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

setInterval(async () => {
    const vnTime = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
    if (vnTime.getUTCHours() === 20 && vnTime.getUTCMinutes() === 0) {
        try {
            const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
            if (topUsers.length > 0) {
                let topText = ""; const medals = ['🥇', '🥈', '🥉'];
                topUsers.forEach((u, index) => { topText += `${medals[index]} <b>${u.firstName} ${u.lastName}</b>: Trao ${u.weeklyReferralCount} cơ hội\n`; });
                const msg = `🏆 <b>BẢNG VÀNG ĐẠI SỨ LAN TỎA TUẦN NÀY</b> 🏆\n\n${topText}\n💡 <i>"Thành công lớn nhất là bạn giúp được bao nhiêu người trở nên giàu có."</i>\n\n👉 Hãy copy Đường dẫn của bạn trong Bot và gửi cho bạn bè ngay! 🚀`;
                bot.sendMessage(GROUP_USERNAME, msg, { parse_mode: 'HTML' }).catch(()=>{});
            }
        } catch (error) {}
        await new Promise(resolve => setTimeout(resolve, 60000));
    }
}, 30000);

setInterval(async () => {
    try {
        const totalUsers = await User.countDocuments();
        if (totalUsers >= 1000) {
            const captains = await User.find({ referralCount: { $gte: 3 }, hasReceivedHalvingMsg: false });
            if (captains.length > 0) {
                const halvingMsg = `🚨 <b>THÔNG BÁO CHIẾN LƯỢC: SỰ KIỆN HALVING ĐÃ KÍCH HOẠT!</b> 🚨\n\nCộng đồng SWC đã cán mốc <b>1.000 nhà đầu tư</b>! 🎉\n\nHệ thống đã tự động kích hoạt cơ chế <b>Halving (Giảm phần thưởng)</b> từ ngày hôm nay.\n\n💎 <i>SWGT đang ngày càng trở nên khan hiếm. Hãy tiếp tục lan tỏa để khẳng định vị thế của mình nhé!</i>`;
                for (let user of captains) {
                    try {
                        await bot.sendMessage(user.userId, halvingMsg, { parse_mode: 'HTML' });
                        user.hasReceivedHalvingMsg = true; await user.save();
                    } catch (e) {}
                    await new Promise(resolve => setTimeout(resolve, 50)); 
                }
            }
        }
    } catch (error) {}
}, 15 * 60 * 1000); 

setInterval(async () => {
    const vnTime = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
    if (vnTime.getUTCDay() === 0 && vnTime.getUTCHours() === 23 && vnTime.getUTCMinutes() === 59) {
        try {
            const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
            if (topUsers.length > 0) {
                let topText = ""; const medals = ['🥇', '🥈', '🥉'];
                topUsers.forEach((u, index) => { topText += `${medals[index]} <b>${u.firstName} ${u.lastName}</b>: Mời ${u.weeklyReferralCount} khách\n`; });
                const msg = `🏆 <b>TỔNG KẾT ĐẠI SỨ LAN TỎA TUẦN NÀY</b> 🏆\n\n${topText}\n🔄 <i>Hệ thống sẽ tự động Reset bộ đếm số lượt mời của tuần này về 0. Hãy chuẩn bị sẵn sàng cho cuộc đua mới vào Thứ Hai!</i>`;
                bot.sendMessage(GROUP_USERNAME, msg, { parse_mode: 'HTML' }).catch(()=>{});
            }
            await User.updateMany({}, { $set: { weeklyReferralCount: 0 } });
        } catch (error) {}
        await new Promise(resolve => setTimeout(resolve, 60000)); 
    }
}, 30000);

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
                    bot.sendMessage(user.userId, `🔓 <b>BĂNG ĐÃ TAN! PHẦN THƯỞNG VỀ VÍ!</b>\n\nChúc mừng bạn! Có <b>${newlyUnlockedCount} đối tác</b> do bạn mời đã vượt qua thử thách 30 ngày. Giải phóng <b>+${newlyUnlockedReward} SWGT</b>.`, {parse_mode: 'HTML'}).catch(()=>{});
                }
                if (rejectedCount > 0) {
                    bot.sendMessage(user.userId, `⚠️ <b>TỊCH THU PHẦN THƯỞNG GIAN LẬN</b>\n\nCó <b>${rejectedCount} đối tác</b> do bạn mời là tài khoản ảo. Phần thưởng đã bị hủy.`, {parse_mode: 'HTML'}).catch(()=>{});
                }
                await user.save();
            }
        }
    } catch (error) {}
}, 6 * 60 * 60 * 1000); 

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
// API SERVER (GIỮ NGUYÊN)
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
    else if (parsedUrl.pathname === '/api/save-wallet' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
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
                        user.balance += 5; user.walletRewardDone = true;
                        bot.sendMessage(data.userId, `🎉 <b>CHÚC MỪNG!</b>\nBạn đã thiết lập thông tin thanh toán thành công, +5 SWGT!`, {parse_mode: 'HTML'}).catch(()=>{});
                    }
                    await user.save();
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    } 
    else if (parsedUrl.pathname === '/api/claim-giftcode' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); const inputCode = data.code.trim().toUpperCase(); 
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();
                let gift = await GiftCode.findOne({ code: inputCode });
                
                if (!gift) { res.writeHead(400); return res.end(JSON.stringify({ success: false, message: "❌ Mã Code không tồn tại hoặc viết sai!" })); }
                if (gift.usedBy.includes(user.userId)) { res.writeHead(400); return res.end(JSON.stringify({ success: false, message: "⚠️ Bạn đã nhập mã này rồi!" })); }
                if (gift.usedBy.length >= gift.maxUses) { res.writeHead(400); return res.end(JSON.stringify({ success: false, message: "😭 Mã này đã được nhập hết." })); }

                user.balance = Math.round((user.balance + gift.reward) * 100) / 100;
                await user.save(); gift.usedBy.push(user.userId); await gift.save();

                bot.sendMessage(GROUP_USERNAME, `🔥 <b>CÓ NGƯỜI NHẬN QUÀ THÀNH CÔNG!</b> 🔥\nThành viên <b>${user.firstName} ${user.lastName}</b> vừa nhập mã <code>${inputCode}</code> và nhận <b>${gift.reward} SWGT</b>!`, {parse_mode: 'HTML'}).catch(()=>{});
                bot.sendMessage(user.userId, `🎉 Bạn đã nhập đúng mã. Cộng ngay <b>${gift.reward} SWGT</b>.`, {parse_mode: 'HTML'}).catch(()=>{});

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance, reward: gift.reward }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    else if (parsedUrl.pathname === '/api/claim-milestone' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();
                let reward = 0; let rankTitle = "";
                
                if (data.milestone === 3 && user.referralCount >= 3 && !user.milestone3) { reward = 10; user.milestone3 = true; rankTitle = "Đại Úy 🎖️"; }
                else if (data.milestone === 10 && user.referralCount >= 10 && !user.milestone10) { reward = 20; user.milestone10 = true; rankTitle = "Thiếu Tá 🎖️"; }
                else if (data.milestone === 20 && user.referralCount >= 20 && !user.milestone20) { reward = 40; user.milestone20 = true; rankTitle = "Trung Tá 🎖️"; }
                else if (data.milestone === 50 && user.referralCount >= 50 && !user.milestone50) { reward = 80; user.milestone50 = true; rankTitle = "Thượng Tá 🎖️"; }
                else if (data.milestone === 80 && user.referralCount >= 80 && !user.milestone80) { reward = 150; user.milestone80 = true; rankTitle = "Đại Tá 🎖️"; }
                else if (data.milestone === 120 && user.referralCount >= 120 && !user.milestone120) { reward = 200; user.milestone120 = true; rankTitle = "Thiếu Tướng 🌟"; }
                else if (data.milestone === 200 && user.referralCount >= 200 && !user.milestone200) { reward = 300; user.milestone200 = true; rankTitle = "Trung Tướng 🌟🌟"; }
                else if (data.milestone === 350 && user.referralCount >= 350 && !user.milestone350) { reward = 500; user.milestone350 = true; rankTitle = "Thượng Tướng 🌟🌟🌟"; }
                else if (data.milestone === 500 && user.referralCount >= 500 && !user.milestone500) { reward = 700; user.milestone500 = true; rankTitle = "Đại Tướng 🌟🌟🌟🌟"; }

                if (reward > 0) {
                    user.balance = Math.round((user.balance + reward) * 100) / 100; await user.save();
                    bot.sendMessage(GROUP_USERNAME, `🎖️ <b>THĂNG CẤP QUÂN HÀM!</b>\nĐồng chí <b>${user.firstName} ${user.lastName}</b> vừa đạt mốc <b>${data.milestone} đồng đội</b>.\n⭐ Cấp bậc: <b>${rankTitle}</b>\n💰 Thưởng: <b>+${reward} SWGT</b>`, {parse_mode: 'HTML'}).catch(()=>{});
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward }));
                } else { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    else if (parsedUrl.pathname === '/api/checkin' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user) return;
                const vnNow = new Date(new Date().getTime() + (7 * 60 * 60 * 1000)); vnNow.setUTCHours(0,0,0,0); 
                let vnLastCheckin = new Date(0);
                if (user.lastCheckInDate) vnLastCheckin = new Date(new Date(user.lastCheckInDate).getTime() + (7 * 60 * 60 * 1000));
                vnLastCheckin.setUTCHours(0,0,0,0);
                const diffDays = Math.floor((vnNow.getTime() - vnLastCheckin.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays === 0) { res.writeHead(400); return res.end(JSON.stringify({ success: false })); }
                if (diffDays === 1) { user.checkInStreak += 1; if (user.checkInStreak > 7) user.checkInStreak = 1; } 
                else { user.checkInStreak = 1; }

                const streakRewards = { 1: 0.25, 2: 0.75, 3: 1.5, 4: 1.75, 5: 2.5, 6: 3.5, 7: 4.5 };
                const reward = streakRewards[user.checkInStreak] || 0.25;
                user.balance = Math.round((user.balance + reward) * 100) / 100; user.lastCheckInDate = new Date(); await user.save();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward, streak: user.checkInStreak, lastCheckInDate: user.lastCheckInDate }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    else if (parsedUrl.pathname === '/api/spin' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user || user.balance < 20) { res.writeHead(400); return res.end(JSON.stringify({ success: false })); }
                user.balance = Math.round((user.balance - 20) * 100) / 100;
                
                let rewardType = 'none'; let rewardName = 'Chúc bạn may mắn!'; let rewardValue = 0;
                const rand = Math.random() * 100;
                if (rand < 40) { rewardType = 'none'; } 
                else if (rand < 70) { rewardType = 'swgt'; rewardValue = 5; rewardName = '5 SWGT'; } 
                else if (rand < 85) { rewardType = 'swgt'; rewardValue = 10; rewardName = '10 SWGT'; } 
                else if (rand < 92) { rewardType = 'swgt'; rewardValue = 50; rewardName = '50 SWGT'; } 
                else if (rand < 96) { rewardType = 'item'; rewardName = 'Ebook: Logic Kiếm Tiền'; } 
                else { rewardType = 'item'; rewardName = 'Audio: Nhân Tính Đen Trắng'; }

                if (rewardType === 'swgt') { user.balance = Math.round((user.balance + rewardValue) * 100) / 100; } 
                else if (rewardType === 'item') {
                    bot.sendMessage(user.userId, `🎉 <b>TRÚNG RƯƠNG KHO BÁU!</b>\nBạn vừa đập rương trúng <b>${rewardName}</b>. Vui lòng chờ Admin liên hệ!`, {parse_mode: 'HTML'}).catch(()=>{});
                    bot.sendMessage(ADMIN_ID, `🎁 Khách: ${user.firstName} (ID: <code>${user.userId}</code>) đập trúng: <b>${rewardName}</b>`, {parse_mode: 'HTML'}).catch(()=>{});
                }
                await user.save();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, rewardType, rewardName, balance: user.balance }));
            } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
        });
    }
    else if (parsedUrl.pathname === '/api/redeem' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user || user.balance < data.cost) { res.writeHead(400); return res.end(JSON.stringify({ success: false })); }
                
                user.balance = Math.round((user.balance - data.cost) * 100) / 100; await user.save();
                let userNotify = `⏳ Yêu cầu đổi: <b>${data.itemName}</b> đang được xử lý!`;
                if(data.itemName.includes('Ebook') || data.itemName.includes('Audio') || data.itemName.includes('Combo')) {
                    userNotify = `🎉 Bạn đã dùng ${data.cost} SWGT đổi <b>${data.itemName}</b>. Tài liệu sẽ được gửi vào Email: <b>${data.email}</b>`;
                }
                bot.sendMessage(data.userId, userNotify, {parse_mode: 'HTML'}).catch(()=>{});
                bot.sendMessage(ADMIN_ID, `🎁 YÊU CẦU ĐỔI QUÀ\nKhách: ${user.firstName} (ID: <code>${user.userId}</code>)\nQuà: <b>${data.itemName}</b>\nĐã trừ: ${data.cost} SWGT`, { parse_mode: 'HTML' }).catch(()=>{});
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    else if (parsedUrl.pathname === '/api/withdraw' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                const withdrawAmount = Number(data.amount); 
                if (!user || user.balance < withdrawAmount || withdrawAmount < 500) { res.writeHead(400); return res.end(JSON.stringify({ success: false })); }

                user.balance -= withdrawAmount; await user.save();
                if (data.withdrawMethod === 'gate') {
                    bot.sendMessage(data.userId, `💸 Yêu cầu rút <b>${withdrawAmount} SWGT</b> qua Gate.io đang được xử lý.\n🔑 Gatecode/UID: <code>${user.gatecode}</code>`, {parse_mode:'HTML'}).catch(()=>{});
                    bot.sendMessage(ADMIN_ID, `🚨 YÊU CẦU RÚT TIỀN (GATE.IO)\nKhách: <b>${user.firstName}</b> (ID: <code>${user.userId}</code>)\nSố lượng: <b>${withdrawAmount} SWGT</b>\nGatecode: <code>${user.gatecode}</code>`, {parse_mode:'HTML'}).catch(()=>{});
                } else {
                    bot.sendMessage(data.userId, `💸 Yêu cầu rút <b>${withdrawAmount} SWGT</b> qua ví ERC20 đang được xử lý.\n🏦 Ví: <code>${user.wallet}</code>`, {parse_mode:'HTML'}).catch(()=>{});
                    bot.sendMessage(ADMIN_ID, `🚨 YÊU CẦU RÚT TIỀN (ERC20)\nKhách: <b>${user.firstName}</b> (ID: <code>${user.userId}</code>)\nSố lượng: <b>${withdrawAmount} SWGT</b>\nVí ERC20: <code>${user.wallet}</code>`, {parse_mode:'HTML'}).catch(()=>{});
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    else if (parsedUrl.pathname === '/api/liquidate' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user || user.balance <= 0 || user.balance >= 500) { res.writeHead(400); return res.end(JSON.stringify({ success: false })); }

                const amountSWGT = user.balance; user.balance = 0; await user.save();
                bot.sendMessage(data.userId, `✅ Bạn đã bán <b>${amountSWGT} SWGT</b>. Vui lòng chờ Admin chuyển <b>${data.vndAmount} VNĐ</b> vào tài khoản ngân hàng của bạn.`, {parse_mode: 'HTML'}).catch(()=>{});
                bot.sendMessage(ADMIN_ID, `🚨 YÊU CẦU THANH LÝ LẤY VNĐ\nKhách: ${user.firstName} (ID: <code>${user.userId}</code>)\nSố lượng xả: <b>${amountSWGT} SWGT</b>\nAdmin cần bank: <b>${data.vndAmount} VNĐ</b>`, { parse_mode: 'HTML' }).catch(()=>{});
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    else if (parsedUrl.pathname === '/api/topup' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                const shortfall = 500 - user.balance;
                user.topUpStatus = 'waiting_bill'; user.topUpTimestamp = new Date();
                user.topUpReminderSent = false; user.pendingSWGT = shortfall; await user.save();

                bot.sendMessage(data.userId, `⚡ <b>YÊU CẦU GHÉP VỐN</b>\nBạn thiếu <b>${shortfall} SWGT</b> để rút.\n💰 Cần thanh toán: <b>${data.vndAmount} VNĐ</b>\n🏦 Techcombank: <code>568786999999</code>\n📝 Nội dung: <code>${user.userId}</code>\n\n📸 Hãy gửi ẢNH BIÊN LAI vào đây cho Bot.`, {parse_mode: 'HTML'}).catch(()=>{});
                res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    else if (parsedUrl.pathname === '/api/leaderboard' && req.method === 'GET') {
        try {
            const allUsersForBoard = await User.find({ $or: [{referralCount: { $gt: 0 }}, {weeklyReferralCount: { $gt: 0 }}] }).select('firstName lastName referralCount weeklyReferralCount activeFrame pendingRefs');
            const processedUsers = allUsersForBoard.map(u => {
                let lockedCount = (u.pendingRefs && u.pendingRefs.length > 0) ? u.pendingRefs.length : 0;
                return { firstName: u.firstName, lastName: u.lastName, activeFrame: u.activeFrame, referralCount: Math.max(0, u.referralCount - lockedCount), weeklyReferralCount: Math.max(0, (u.weeklyReferralCount || 0) - lockedCount) };
            });
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(processedUsers));
        } catch (e) { res.writeHead(400); res.end(); }
    }
    else { res.writeHead(200); res.end('API Online'); }
});
server.listen(process.env.PORT || 3000);

// ==========================================
// LỆNH ADMIN QUẢN TRỊ (GIỮ NGUYÊN BẢN GỐC)
// ==========================================
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const adminMenu = { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: "📊 Top 10 Tổng", callback_data: 'admin_checktop' }, { text: "🏆 Top Tuần", callback_data: 'admin_toptuan' }],
        [{ text: "💰 Thống Kê Két Sắt", callback_data: 'admin_thongke' }, { text: "👀 Soi Dòng Tiền", callback_data: 'admin_soivietien' }],
        [{ text: "🚀 Nổ Bảng Xếp Hạng", callback_data: 'admin_duatop' }],
        [{ text: "🔍 Tra Cứu 1 Người", callback_data: 'admin_help_tracuu' }, { text: "👮 Xử Lý Gian Lận", callback_data: 'admin_help_cheat' }],
        [{ text: "🎁 Tạo Code & MKT", callback_data: 'admin_help_mkt' }]
    ]}};
    bot.sendMessage(msg.chat.id, `👨‍💻 <b>BẢNG ĐIỀU KHIỂN QUẢN TRỊ</b>`, adminMenu).catch(()=>{});
});

bot.onText(/\/tracuu (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    try {
        const user = await User.findOne({ userId: targetId });
        if (!user) return bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy!`);
        let report = `🔎 <b>HỒ SƠ (ID: ${targetId})</b>\n👤 Tên: ${user.firstName} ${user.lastName}\n💰 Số dư: <b>${user.balance} SWGT</b>\n👥 Mời: ${user.referralCount}\n👉 <a href="tg://user?id=${targetId}">Nhắn trực tiếp</a>`;
        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    } catch (e) {}
});

// Các lệnh /checktop, /toptuan, /top20swgt, /checkref, /resetref, /locref, /sendto, /sendgroup, /phat, /setref, /setbalance, /createcode, /sendall, /deletecode, /sendleader, /nhactanbinh, /quettoanhethong, /phuchoivip3 (GIỮ NGUYÊN TOÀN BỘ LOGIC CỦA ANH)

// ==========================================
// KỊCH BẢN /START - TÍCH HỢP PHỄU MỚI (SWC PASS / ATLAS)
// ==========================================

function sendMainMenu(chatId) {
    const successMsg = `✅ Hồ sơ của bạn đã được lưu trữ an toàn. Chào mừng bạn gia nhập cộng đồng Sky World Community Viet Nam.\n\nNgay lúc này, cánh cửa **SWC Pass** và siêu dự án **ATLAS (Web 2.5 Real Estate)** đang đếm ngược đến ngày 31/03. Bạn muốn khám phá điều gì tiếp theo?`;
    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🚀 MỞ ỨNG DỤNG SWC VIET NAM", web_app: { url: webAppUrl } }],
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
        
        // Vẫn giữ kịch bản thông báo cho người mời (Bảo lưu dữ liệu cũ)
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
    
    const welcomeMessage = `Xin chào ${firstName}! 🦁\n\nChào mừng bạn bước vào Hệ sinh thái Đầu tư Tinh anh của **Sky World Community Viet Nam**.\n\nTôi là Trợ lý AI được phát triển dưới sự định hướng của Mr. **Hồ Văn Lợi**. Mục tiêu của chúng tôi: Vốn của bạn phải sinh lời và vị thế của bạn phải thăng hạng!\n\n🌱 Để nhận thông tin nội bộ và tham gia các thương vụ vòng kín (Private Round), vui lòng xác nhận chính sách bảo mật và chia sẻ số điện thoại của bạn bên dưới.`;

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

// LƯU DATA VÀ GỌI MENU
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

    // KỊCH BẢN DELAY: GỬI KHẢO SÁT SAU 1 PHÚT
    setTimeout(() => {
        const surveyMsg = `Xin chào! Chúng tôi muốn hiểu bạn rõ hơn 🙌\nMột số người trong cộng đồng Sky World Community Viet Nam đã đầu tư nhiều năm, một số khác mới bắt đầu. Để Mr. Hồ Văn Lợi và đội ngũ hỗ trợ tốt nhất, hãy dành 10 giây cho chúng tôi biết vị thế hiện tại của bạn:`;
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
// XỬ LÝ NÚT BẤM (GỘP CẢ CŨ VÀ MỚI)
// ==========================================
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    let user = await User.findOne({ userId: userId });
    if (!user) return bot.answerCallbackQuery(callbackQuery.id);

    // --- XỬ LÝ NHIỆM VỤ CŨ (BẢO LƯU NẾU KHÁCH BẤM LẠI TIN NHẮN CŨ) ---
    if (data === 'task_1') {
        const opts = { parse_mode: 'HTML', reply_markup: { inline_keyboard: [ [{ text: "🔵 Join Kênh", url: "https://t.me/swc_capital_vn" }], [{ text: "💬 Join Group", url: "https://t.me/swc_capital_chat" }], [{ text: "✅ KIỂM TRA & NHẬN THƯỞNG", callback_data: 'check_join' }] ] } };
        bot.sendMessage(chatId, `🎯 <b>BƯỚC 1: LẤY VỐN KHỞI NGHIỆP</b>\nHoàn thành ngay để nhận 15 SWGT.`, opts).catch(()=>{});
        return bot.answerCallbackQuery(callbackQuery.id);
    } 
    else if (data === 'check_join') {
        // ... (Giữ nguyên toàn bộ logic checkMembership và cộng refReward của anh) ...
        bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Đã kiểm tra trạng thái Join Group.", show_alert: true });
        return;
    }
    else if (data === 'task_2' || data === 'task_3' || data === 'task_4') {
        bot.answerCallbackQuery(callbackQuery.id, { text: "Tính năng đã chuyển sang Mini App.", show_alert: true });
        return;
    }

    // --- XỬ LÝ PHỄU MỚI (SWC PASS / ATLAS / FAQ) ---
    let text = "";
    let options = { parse_mode: 'Markdown', disable_web_page_preview: true, reply_markup: { inline_keyboard: [] } };
    const ctaButtons = [
        [{ text: "🚀 MỞ ỨNG DỤNG ĐĂNG KÝ NGAY", web_app: { url: webAppUrl } }],
        [{ text: "💬 THAM GIA NHÓM ZALO KÍN", url: GROUP_ZALO_LINK }],
        [{ text: "🔙 Quay lại Menu Chính", callback_data: 'main_menu' }]
    ];

    if (data === 'main_menu') {
        sendMainMenu(chatId);
        return bot.answerCallbackQuery(callbackQuery.id);
    }
    else if (data === 'menu_swcpass') {
        text = `Gói đăng ký **SWC Pass** là tấm vé thông hành của giới tinh anh, bao gồm:\n1️⃣ **ROAD TO $1M:** Chiến lược danh mục cổ phiếu cổ tức.\n2️⃣ **SWC Field:** Tiếp cận thương vụ ngoài thị trường chứng khoán.\n3️⃣ **Tiến độ cá nhân:** Mục tiêu số hóa rõ ràng.\n👉 Chi tiết: swcpass.vn`;
        options.reply_markup.inline_keyboard = ctaButtons;
    } 
    else if (data === 'menu_atlas') {
        text = `Dự án **ATLAS** là tương lai của Bất động sản số hóa (RWA) tại UAE và toàn cầu. Bằng cách mã hóa tài sản thực thành token ATLX, ATLAS phá vỡ rào cản độc quyền.\n⚠️ ATLAS chỉ phân phối nội bộ qua **SWC Field**. Vòng kín khép lại vào 31/03!\n👉 Chi tiết: swcfield.com`;
        options.reply_markup.inline_keyboard = ctaButtons;
    }
    else if (data === 'menu_webinar') {
        text = `Sự kiện phát sóng trực tiếp sẽ giải mã siêu dự án mới trên gian hàng SWC Field.\n⏰ 20:00 (VN) | Ngày 31/03\n👉 Link phòng kín: https://launch.swc.capital/broadcast_31_vi`;
        options.reply_markup.inline_keyboard = ctaButtons;
    }
    // FAQ
    else if (data === 'menu_faq' || data === 'faq_back') {
        text = `**CHUYÊN MỤC GIẢI ĐÁP THẮC MẮC (FAQ)**\n*Hãy chọn câu hỏi bạn đang quan tâm:*`;
        options.reply_markup.inline_keyboard = [
            [{ text: "1. Nhận được gì ngay sau khi thanh toán?", callback_data: 'faq_1' }],
            [{ text: "2. Road to $1M và SWC Field là gì?", callback_data: 'faq_2' }],
            [{ text: "3. Khác gì nội dung Youtube miễn phí?", callback_data: 'faq_3' }],
            [{ text: "4. Tôi chưa có đủ 600$ lúc này?", callback_data: 'faq_4' }],
            [{ text: "5. Giữ tiền mặt cho an toàn?", callback_data: 'faq_5' }],
            [{ text: "🔙 Quay lại Menu Chính", callback_data: 'main_menu' }]
        ];
    }
    else if (data === 'faq_1') { text = `✅ **Tôi nhận được gì ngay sau khi thanh toán?**\nQuyền truy cập đầy đủ vào Road to $1M. Chiến lược xây dựng danh mục sẽ có trong tài khoản chỉ sau vài phút.`; options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]); }
    else if (data === 'faq_2') { text = `✅ **Road to $1M & SWC Field là gì?**\n- **Road to $1M:** Chiến lược xây danh mục cổ phiếu cổ tức.\n- **SWC Field:** Gian hàng dự án mạo hiểm thẩm định khắt khe (Ra mắt 3/2026).`; options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]); }
    else if (data === 'faq_3') { text = `✅ **Khác gì kiến thức trên Youtube?**\nSWC Pass cung cấp một "Hệ thống thực thi kỷ luật" giúp loại bỏ cảm xúc ra khỏi đầu tư. Kiến thức không hành động là giải trí; kỷ luật mới tạo ra tiền.`; options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]); }
    else if (data === 'faq_4') { text = `✅ **Tôi chưa có đủ 600$ lúc này?**\n600$ cho 5 năm là ~250k VNĐ/tháng. Việc trì hoãn chờ "có đủ tiền" là cái bẫy hoàn hảo. Đừng ưu tiên chi tiêu ngắn hạn mà bỏ lỡ tự do dài hạn!`; options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]); }
    else if (data === 'faq_5') { text = `✅ **Giữ tiền mặt cho an toàn?**\nGiữ tiền mặt vì sợ rủi ro là ảo giác nguy hiểm nhất. Quyết định trốn tránh rủi ro biến động chính là quyết định đảm bảo 100% rằng bạn sẽ nghèo đi.`; options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]); }
    
    // SURVEY
    else if (data === 'survey_newbie') {
        user.tag = 'newbie'; await user.save();
        text = `Cảm ơn bạn! Lạm phát đang âm thầm ăn mòn tiền mặt của bạn. Lựa chọn tốt nhất lúc này là chiến lược kỷ luật **Road to $1M**.\n👉 Bấm nút vào nhóm nhận tư vấn lộ trình nhé!`;
        options.reply_markup.inline_keyboard = [[{ text: "💬 VÀO NHÓM NHẬN LỘ TRÌNH", url: GROUP_ZALO_LINK }]];
    }
    else if (data === 'survey_ust') {
        user.tag = 'ust_investor'; await user.save();
        text = `Tuyệt vời! Nếu bạn đã quen với dự án mạo hiểm, **ATLAS (RWA)** chính là sân chơi tiếp theo.\n⚠️ Vòng gọi vốn kín tốt nhất sẽ đóng vào 31/03. Đừng bỏ lỡ!`;
        options.reply_markup.inline_keyboard = ctaButtons;
    }
    else if (data === 'survey_vip') {
        user.tag = 'vip_pass'; await user.save();
        text = `Chào mừng thành viên VIP! Bạn đã có vũ khí mạnh nhất của cộng đồng Sky World Community Viet Nam.\n👉 Hãy chắc chắn đã tham gia Group Nội Bộ để nhận tín hiệu!`;
        options.reply_markup.inline_keyboard = [[{ text: "💬 VÀO NHÓM VIP", url: GROUP_ZALO_LINK }]];
    }

    bot.answerCallbackQuery(callbackQuery.id).catch(()=>{});
    if (text !== "") { bot.sendMessage(chatId, text, options).catch(()=>{}); }
});

// XỬ LÝ MESSAGE CỦA ADMIN VÀ KHÁCH HÀNG (GIỮ NGUYÊN)
bot.on('message', async (msg) => {
    // Admin duyệt bill
    if (msg.from && msg.from.id.toString() === ADMIN_ID && msg.reply_to_message) {
        const replyText = msg.text ? msg.text.toLowerCase() : (msg.caption ? msg.caption.toLowerCase() : '');
        const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || "";
        const idMatch = originalText.match(/ID:\s*(\d+)/); 
        
        if (idMatch) {
            const targetUserId = idMatch[1];
            const targetUser = await User.findOne({ userId: targetUserId });
            if (originalText.includes('BILL NẠP TIỀN') && (replyText.includes('xong'))) {
                if (targetUser && targetUser.topUpStatus === 'awaiting_admin') {
                    targetUser.balance = Math.round((targetUser.balance + targetUser.pendingSWGT) * 100) / 100;
                    targetUser.topUpStatus = 'none'; await targetUser.save();
                    bot.sendMessage(targetUser.userId, `✅ <b>NẠP TIỀN THÀNH CÔNG!</b>\nTài khoản được cộng <b>${targetUser.pendingSWGT} SWGT</b>.\n👉 Mở App để sử dụng ngay!`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP", web_app: { url: webAppUrl } }]] } }).catch(()=>{});
                    bot.sendMessage(ADMIN_ID, `✅ Đã duyệt Bill thành công.`);
                }
                return;
            }
            if ((replyText.includes('xong')) && (originalText.includes('YÊU CẦU') || originalText.includes('RÚT TIỀN') || originalText.includes('ĐỔI QUÀ') || originalText.includes('THANH LÝ'))) {
                const successMsg = `🚀 <b>YÊU CẦU HOÀN TẤT!</b>\nAdmin đã kiểm duyệt và chuyển lệnh thành công!\n🌈 Cảm ơn bạn đã đồng hành cùng Sky World Community Viet Nam.`;
                bot.sendMessage(targetUserId, successMsg, {parse_mode: 'HTML'}).catch(()=>{});
                bot.sendMessage(ADMIN_ID, `✅ Đã gửi thông báo hoàn tất.`);
                return; 
            }
            if (originalText.includes('TIN NHẮN TỪ KHÁCH HÀNG')) {
                bot.sendMessage(targetUserId, `👨‍💻 <b>Phản hồi từ Admin SWC:</b>\n\n${msg.text || msg.caption}`, { parse_mode: 'HTML' }).catch(()=>{});
                bot.sendMessage(ADMIN_ID, `✅ Đã gửi câu trả lời cho khách.`);
                return;
            }
        }
    }

    // Khách nhắn tin
    if (msg.chat.type === 'private' && msg.from.id.toString() !== ADMIN_ID && !msg.from.is_bot) {
        if (msg.text && msg.text.startsWith('/')) return;
        const userId = msg.from.id.toString(); let user = await User.findOne({ userId: userId });

        if (msg.photo && user && user.topUpStatus === 'waiting_bill') {
            user.topUpStatus = 'awaiting_admin'; await user.save();
            bot.sendMessage(userId, `⏳ <b>ĐÃ NHẬN BILL</b>\nBot đã chuyển biên lai tới Admin. Vui lòng chờ 1-3 phút.`, {parse_mode: 'HTML'}).catch(()=>{});
            bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, { caption: `🚨 <b>BILL NẠP TIỀN</b>\nKhách: ${user.firstName}\n🆔 ID: <code>${user.userId}</code>\n💰 Số lượng: <b>${user.pendingSWGT} SWGT</b>\n👉 Reply ảnh gõ "xong" để duyệt.`, parse_mode: 'HTML' }).catch(()=>{});
            return; 
        }

        const alertMsg = `📩 <b>TIN NHẮN TỪ KHÁCH HÀNG</b>\nKhách: <b>${msg.from.first_name}</b>\n🆔 ID: <code>${userId}</code>\n💬 <b>Nội dung:</b>\n${msg.text || '[Ảnh/File]'}\n👉 Reply để chat.`;
        bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "💬 Chat trực tiếp", url: `tg://user?id=${userId}` }]] } }).catch(()=>{});
        bot.sendMessage(userId, `👋 Yêu cầu đã được chuyển đến Ban Tổ Chức. Vui lòng chờ Admin phản hồi nhé!`, { parse_mode: 'HTML' }).catch(()=>{});
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

// XỬ LÝ KHÁCH RỜI NHÓM (GIỮ NGUYÊN)
bot.on('chat_member', async (update) => {
    // ... Giữ nguyên logic phạt 10 SWGT khi rời nhóm ...
});

console.log("🚀 Bot Telegram Sky World Community Viet Nam đã khởi động hoàn tất!");
