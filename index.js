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

    // Biến chống Spam Chat
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

// --- BẢNG LƯU TRỮ LỊCH SỬ ĐẬP RƯƠNG MỚI ---
const gameLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    userName: { type: String, default: '' },
    rewardName: { type: String, required: true },
    rewardType: { type: String, required: true },
    cost: { type: Number, default: 20 },
    playedAt: { type: Date, default: Date.now }
});
const GameLog = mongoose.model('GameLog', gameLogSchema);


// ==========================================
// 1. TÍNH NĂNG TỰ ĐỘNG NHẮC NHỞ ĐIỂM DANH LÚC 8H SÁNG
// ==========================================
setInterval(async () => {
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    if (vnTime.getUTCHours() === 8 && vnTime.getUTCMinutes() === 0) {
        const todayStr = vnTime.toISOString().split('T')[0];
        const users = await User.find({});
        for (let user of users) {
            let lastCheckinStr = '';
            if (user.lastCheckInDate) { lastCheckinStr = new Date(new Date(user.lastCheckInDate).getTime() + (7 * 60 * 60 * 1000)).toISOString().split('T')[0]; }
            if (lastCheckinStr !== todayStr) {
                const remindMsg = `☀️ <b>CHÀO BUỔI SÁNG!</b>\n\nPhần thưởng điểm danh SWGT ngày hôm nay của bạn đã sẵn sàng.\n\n⚠️ <i>Lưu ý: Nếu bỏ lỡ 1 ngày, chuỗi phần thưởng của bạn sẽ bị quay lại từ Ngày 1.</i>\n\n👉 Hãy bấm <b>"MỞ ỨNG DỤNG ĐIỂM DANH"</b> ở menu bên dưới để nhận nhé!`;
                try { bot.sendMessage(user.userId, remindMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ ỨNG DỤNG ĐIỂM DANH", web_app: { url: webAppUrl } }]] } }); } catch (e) {} 
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    }
}, 60000); 

// ==========================================
// 2. KÉO TRAFFIC VÀO KÊNH/GROUP (9H SÁNG VÀ 19H30 TỐI)
// ==========================================
setInterval(async () => {
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    if (vnTime.getUTCHours() === 9 && vnTime.getUTCMinutes() === 0) {
        try {
            const allUsers = await User.find({});
            const morningMsg = `☀️ <b>CHÀO BUỔI SÁNG CỘNG ĐỒNG SWC!</b>\n\nTin tức và nhận định mới nhất về tiến độ dự án uST đã được cập nhật. Hãy vào Kênh Thông Tin để nắm bắt ngay!\n\n💬 <i>Đừng quên: Mỗi bình luận chia sẻ quan điểm (trên 10 ký tự) trong Group Chat sẽ được hệ thống tự động cộng <b>+0.1 SWGT</b>. Vào chém gió ngay anh em nhé!</i>`;
            let keyboard = [ [{ text: "🔵 ĐỌC TIN TỨC TRÊN KÊNH", url: `https://t.me/${CHANNEL_USERNAME.replace('@','')}` }], [{ text: "💬 VÀO GROUP CHAT NHẬN THƯỞNG", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }] ];
            for (let user of allUsers) { bot.sendMessage(user.userId, morningMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(()=>{}); await new Promise(r => setTimeout(r, 50)); }
        } catch (error) {}
    }
    if (vnTime.getUTCHours() === 19 && vnTime.getUTCMinutes() === 30) {
        try {
            const allUsers = await User.find({});
            const eveningMsg = `🌙 <b>TỔNG KẾT NGÀY DÀI - VÀO GROUP GIAO LƯU NÀO!</b>\n\nMột ngày bận rộn sắp khép lại. Mọi người có nhận định gì về thị trường hay các bước đi tiếp theo của SWC không?\n\n👉 Hãy vào Group Cộng Đồng chia sẻ góc nhìn của bạn. Vừa trao đổi kiến thức, vừa nhặt thêm SWGT miễn phí <b>(+0.1 SWGT/tin nhắn)</b>!`;
            let keyboard = [ [{ text: "💬 VÀO GROUP CHÉM GIÓ NGAY", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }] ];
            for (let user of allUsers) { bot.sendMessage(user.userId, eveningMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(()=>{}); await new Promise(r => setTimeout(r, 50)); }
        } catch (error) {}
    }
}, 60000); 

// ==========================================
// 3. TÍNH NĂNG TỰ ĐỘNG BÁO CÁO ĐUA TOP LAN TỎA LÚC 20H TỐI
// ==========================================
setInterval(async () => {
    const vnTime = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
    if (vnTime.getUTCHours() === 20 && vnTime.getUTCMinutes() === 0) {
        try {
            const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
            if (topUsers.length > 0) {
                let topText = ""; const medals = ['🥇', '🥈', '🥉'];
                topUsers.forEach((u, index) => { topText += `${medals[index]} <b>${u.firstName} ${u.lastName}</b>: Trao ${u.weeklyReferralCount} cơ hội\n`; });
                const msg = `🏆 <b>BẢNG VÀNG ĐẠI SỨ LAN TỎA TUẦN NÀY - BẠN ĐANG Ở ĐÂU?</b> 🏆\n\nHành trình kiến tạo tự do tài chính cùng Cộng đồng SWC đang lan tỏa mạnh mẽ hơn bao giờ hết! Hôm nay, những Đại sứ xuất sắc nhất đã tiếp tục trao đi giá trị:\n\n${topText}\n💡 <i>"Thành công lớn nhất không phải là bạn có bao nhiêu tiền, mà là bạn giúp được bao nhiêu người trở nên giàu có."</i>\n\n👉 Cổng khai thác miễn phí sẽ <b>ĐÓNG LẠI VÀO CHỦ NHẬT NÀY</b>. Hãy copy Đường dẫn của bạn trong Bot và gửi cho bạn bè ngay tối nay để đua top nhé! 🚀`;
                bot.sendMessage(GROUP_USERNAME, msg, { parse_mode: 'HTML' }).catch(()=>{});
            }
        } catch (error) {}
        await new Promise(resolve => setTimeout(resolve, 60000));
    }
}, 30000);

// ==========================================
// 4. TÍNH NĂNG TỰ ĐỘNG THÔNG BÁO HALVING 
// ==========================================
setInterval(async () => {
    try {
        const totalUsers = await User.countDocuments();
        if (totalUsers >= 1000) {
            const captains = await User.find({ referralCount: { $gte: 3 }, hasReceivedHalvingMsg: false });
            if (captains.length > 0) {
                const halvingMsg = `🚨 <b>THÔNG BÁO CHIẾN LƯỢC: SỰ KIỆN HALVING ĐÃ KÍCH HOẠT!</b> 🚨\n\nChào đồng chí, Cộng đồng SWC đã cán mốc <b>1.000 nhà đầu tư</b>! 🎉\n\nHệ thống đã tự động kích hoạt cơ chế <b>Halving (Giảm phần thưởng)</b> từ ngày hôm nay.\n\n📉 <b>Bảng phần thưởng Quân Hàm mới:</b>\n- Các mốc từ Thiếu Tá đến Đại Tướng sẽ được điều chỉnh giảm phần thưởng xuống.\n- Những ai đã kịp nhận thưởng trước đó sẽ được giữ nguyên tài sản.\n\n💎 <i>SWGT đang ngày càng trở nên khan hiếm. Chúc mừng bạn đã là những người tiên phong tích lũy được SWGT trong giai đoạn Vàng! Hãy tiếp tục lan tỏa để khẳng định vị thế của mình nhé!</i>`;
                for (let user of captains) {
                    try { await bot.sendMessage(user.userId, halvingMsg, { parse_mode: 'HTML' }); user.hasReceivedHalvingMsg = true; await user.save(); } catch (e) {}
                    await new Promise(resolve => setTimeout(resolve, 50)); 
                }
            }
        }
    } catch (error) {}
}, 15 * 60 * 1000); 

// ==========================================
// 5. TÍNH NĂNG CHỐT TOP TUẦN & RESET VÀO 23:59 CHỦ NHẬT
// ==========================================
setInterval(async () => {
    const vnTime = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
    if (vnTime.getUTCDay() === 0 && vnTime.getUTCHours() === 23 && vnTime.getUTCMinutes() === 59) {
        try {
            const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
            if (topUsers.length > 0) {
                let topText = ""; const medals = ['🥇', '🥈', '🥉'];
                topUsers.forEach((u, index) => { topText += `${medals[index]} <b>${u.firstName} ${u.lastName}</b>: Mời ${u.weeklyReferralCount} khách\n`; });
                const msg = `🏆 <b>TỔNG KẾT ĐẠI SỨ LAN TỎA TUẦN NÀY</b> 🏆\n\nKhép lại một tuần hoạt động bùng nổ, xin vinh danh những chiến binh xuất sắc nhất đã mang cơ hội SWC đến với nhiều đối tác nhất trong tuần qua:\n\n${topText}\n🔄 <i>Hệ thống sẽ tự động Reset bộ đếm số lượt mời của tuần này về 0. Hãy chuẩn bị sẵn sàng cho một cuộc đua mới công bằng cho tất cả mọi người vào Thứ Hai nhé!</i>\n\n👉 <b>Chúc các Đại sứ một tuần mới bùng nổ doanh số! 🚀</b>`;
                bot.sendMessage(GROUP_USERNAME, msg, { parse_mode: 'HTML' }).catch(()=>{});
            }
            await User.updateMany({}, { $set: { weeklyReferralCount: 0 } });
        } catch (error) {}
        await new Promise(resolve => setTimeout(resolve, 60000)); 
    }
}, 30000);

// ==========================================
// 6. TÍNH NĂNG TỰ ĐỘNG RÃ ĐÔNG REF (SAU 30 NGÀY)
// ==========================================
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
                    user.referralCount += newlyUnlockedCount;
                    user.weeklyReferralCount += newlyUnlockedCount;
                    user.balance = Math.round((user.balance + newlyUnlockedReward) * 100) / 100;
                    let notifyMsg = `🔓 <b>BĂNG ĐÃ TAN! PHẦN THƯỞNG VỀ VÍ!</b>\n\nChúc mừng bạn! Có <b>${newlyUnlockedCount} đối tác</b> do bạn mời đã vượt qua thử thách 30 ngày. Giải phóng <b>+${newlyUnlockedReward} SWGT</b> vào tài khoản.`;
                    bot.sendMessage(user.userId, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});
                }
                if (rejectedCount > 0) {
                    let rejectMsg = `⚠️ <b>TỊCH THU PHẦN THƯỞNG GIAN LẬN</b>\n\nHệ thống phát hiện có <b>${rejectedCount} đối tác</b> do bạn mời là tài khoản ảo. Phần thưởng chờ duyệt đã bị hủy.`;
                    bot.sendMessage(user.userId, rejectMsg, {parse_mode: 'HTML'}).catch(()=>{});
                }
                await user.save();
            }
        }
    } catch (error) {}
}, 6 * 60 * 60 * 1000); 

// ==========================================
// TÍNH NĂNG TỰ ĐỘNG ĐẾM NGƯỢC 10 PHÚT CHỜ BILL NẠP TIỀN
// ==========================================
setInterval(async () => {
    try {
        const now = new Date().getTime();
        const pendingUsers = await User.find({ topUpStatus: 'waiting_bill' });
        for (let u of pendingUsers) {
            const diffMins = (now - new Date(u.topUpTimestamp).getTime()) / 60000;
            if (diffMins >= 10) {
                u.topUpStatus = 'none';
                await u.save();
                bot.sendMessage(u.userId, `❌ <b>LỆNH ĐÃ BỊ HỦY</b>\n\nĐã quá 10 phút nhưng hệ thống không nhận được hình ảnh Biên lai chuyển khoản của bạn. Lệnh ghép vốn đã tự động bị hủy.\n\nNếu bạn vẫn muốn nạp, vui lòng lên Mini App thao tác lại nhé.`, {parse_mode: 'HTML'}).catch(()=>{});
            } else if (diffMins >= 5 && !u.topUpReminderSent) {
                u.topUpReminderSent = true;
                await u.save();
                bot.sendMessage(u.userId, `⚠️ <b>NHẮC NHỞ CHUYỂN KHOẢN</b>\n\nLệnh ghép vốn của bạn chỉ còn <b>5 phút nữa sẽ bị hủy</b>.\n\n👉 Nếu bạn đã chuyển khoản, vui lòng gửi ngay <b>ẢNH BIÊN LAI (BILL)</b> vào đoạn chat này cho Bot để hệ thống duyệt tiền nhé!`, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    } catch (e) {}
}, 60000); 

// ==========================================
// 7. API SERVER CHO MINI APP 
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
    
    // 🚧 BẢO MẬT: KHÓA CỔNG RÚT TIỀN (WITHDRAW) VÀ THANH LÝ
    else if (parsedUrl.pathname === '/api/withdraw' && req.method === 'POST') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: "🚧 HỆ THỐNG CẢNH BÁO: Cổng rút Token đang bị khóa để bảo trì và nâng cấp an ninh. Vui lòng quay lại sau!" }));
    }
    else if (parsedUrl.pathname === '/api/liquidate' && req.method === 'POST') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: "🚧 HỆ THỐNG CẢNH BÁO: Cổng Thanh Lý VNĐ đang bị khóa để kiểm duyệt gian lận. Vui lòng quay lại sau!" }));
    }

    // 🛡 BẢO MẬT CHỐNG CLONE VÍ / GATECODE
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
                    if (data.fullName) user.fullName = data.fullName;
                    if (data.email) user.email = data.email;
                    if (data.phone) user.phone = data.phone;
                    if (!user.walletRewardDone) {
                        user.balance += 5; 
                        user.walletRewardDone = true;
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
                if (!gift) return res.writeHead(400), res.end(JSON.stringify({ success: false, message: "❌ Mã Code không tồn tại hoặc viết sai!" }));
                if (gift.usedBy.includes(user.userId)) return res.writeHead(400), res.end(JSON.stringify({ success: false, message: "⚠️ Bạn đã nhập mã này rồi!" }));
                if (gift.usedBy.length >= gift.maxUses) return res.writeHead(400), res.end(JSON.stringify({ success: false, message: "😭 Mã này đã có người khác nhập mất rồi." }));

                user.balance = Math.round((user.balance + gift.reward) * 100) / 100;
                await user.save(); gift.usedBy.push(user.userId); await gift.save();

                bot.sendMessage(GROUP_USERNAME, `🔥 <b>TING TING! CÓ NGƯỜI NHẬN QUÀ THÀNH CÔNG!</b> 🔥\n\nThành viên <b>${user.firstName} ${user.lastName}</b> vừa nhanh tay nhập mã <code>${inputCode}</code> và giật ngay <b>${gift.reward} SWGT</b> vào ví!\n\n👉 <i>Bật thông báo Group để không bỏ lỡ mã tiếp theo!</i>`, {parse_mode: 'HTML'}).catch(()=>{});
                bot.sendMessage(user.userId, `🎉 <b>CHÚC MỪNG!</b>\nBạn đã nhập đúng mã. Cộng ngay <b>${gift.reward} SWGT</b> vào tài khoản!`, {parse_mode: 'HTML'}).catch(()=>{});

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
                    bot.sendMessage(GROUP_USERNAME, `🎖️ <b>THĂNG CẤP QUÂN HÀM!</b> 🎖️\n\nChúc mừng đồng chí <b>${user.firstName} ${user.lastName}</b> vừa cán mốc <b>${data.milestone} đồng đội</b>.\n\n⭐ Cấp bậc mới: <b>${rankTitle}</b>\n💰 Thưởng nóng: <b>+${reward} SWGT</b>`, {parse_mode: 'HTML'}).catch(()=>{});
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward }));
                } else { res.writeHead(400); res.end(JSON.stringify({ success: false, message: "Chưa đủ điều kiện!" })); }
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
        
    else if (parsedUrl.pathname === '/api/checkin' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user) return;
                const vnNow = new Date(new Date().getTime() + (7 * 3600000)); vnNow.setUTCHours(0,0,0,0); 
                let vnLastCheckin = new Date(0);
                if (user.lastCheckInDate) { vnLastCheckin = new Date(new Date(user.lastCheckInDate).getTime() + (7 * 3600000)); }
                vnLastCheckin.setUTCHours(0,0,0,0);
                const diffDays = Math.floor((vnNow.getTime() - vnLastCheckin.getTime()) / 86400000);

                if (diffDays === 0) return res.writeHead(400), res.end(JSON.stringify({ success: false, message: 'Đã điểm danh!' }));
                if (diffDays === 1) { user.checkInStreak = (user.checkInStreak >= 7) ? 1 : user.checkInStreak + 1; } else { user.checkInStreak = 1; }
                const streakRewards = { 1: 0.25, 2: 0.75, 3: 1.5, 4: 1.75, 5: 2.5, 6: 3.5, 7: 4.5 };
                const reward = streakRewards[user.checkInStreak] || 0.25;

                user.balance = Math.round((user.balance + reward) * 100) / 100; 
                user.lastCheckInDate = new Date(); await user.save();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward, streak: user.checkInStreak, lastCheckInDate: user.lastCheckInDate }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }

    // 🔥 API ĐẬP RƯƠNG (CẬP NHẬT GHI LOG MỚI) 🔥
    else if (parsedUrl.pathname === '/api/spin-wheel' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();
                if (user.balance < 20) return res.writeHead(400), res.end(JSON.stringify({ success: false, message: "⚠️ Không đủ 20 SWGT để mua búa!" }));

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

    else if (parsedUrl.pathname === '/api/submit-game-email' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();
                const alertMsg = `📩 <b>TIN NHẮN TỪ KHÁCH HÀNG (NHẬN QUÀ GAME)</b>\n\n👤 Khách: <b>${user.firstName} ${user.lastName}</b>\n🆔 ID: <code>${user.userId}</code>\n🎁 Quà: <b>${data.rewardName}</b>\n💬 <b>Gmail:</b>\n${data.email}`;
                bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "💬 Chat trực tiếp", url: `tg://user?id=${user.userId}` }]] } }).catch(()=>{});
                bot.sendMessage(user.userId, `✅ Đã ghi nhận Gmail: <b>${data.email}</b>. Admin sẽ sớm gửi quà!`, {parse_mode: 'HTML'}).catch(()=>{});
                res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }

    else if (parsedUrl.pathname === '/api/redeem' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body); let user = await User.findOne({ userId: data.userId });
                if (!user || user.balance < data.cost) return res.writeHead(400), res.end();
                user.balance = Math.round((user.balance - data.cost) * 100) / 100;
                if(data.itemName.includes('Ebook') || data.itemName.includes('Combo') || data.itemName.includes('Gói')) user.hasWonEbook = true;
                if(data.itemName.includes('Audio') || data.itemName.includes('Combo') || data.itemName.includes('Gói')) user.hasWonAudio = true;
                await user.save();
                
                bot.sendMessage(data.userId, `🎉 <b>ĐỔI QUÀ THÀNH CÔNG: ${data.itemName}</b>\n\nAdmin sẽ sớm liên hệ xử lý!`, {parse_mode: 'HTML'}).catch(()=>{});
                bot.sendMessage(ADMIN_ID, `🎁 <b>YÊU CẦU ĐỔI QUÀ</b>\n👤 Khách: ${user.firstName} (ID: <code>${user.userId}</code>)\n🎁 Quà: <b>${data.itemName}</b>\n📧 Email: <code>${data.email || 'Không'}</code>`, { parse_mode: 'HTML' }).catch(()=>{});
                
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
                user.topUpStatus = 'waiting_bill'; user.topUpTimestamp = new Date(); user.topUpReminderSent = false; user.pendingSWGT = 500 - user.balance;
                await user.save();
                bot.sendMessage(data.userId, `⚡ <b>YÊU CẦU GHÉP VỐN ĐÃ TẠO</b>\n\n💰 Cần nạp: <b>${data.vndAmount} VNĐ</b>\n🏦 Techcombank - <code>568786999999</code>\nNội dung: <code>${user.userId}</code>\n\n📸 Vui lòng gửi ảnh Bill vào đây!`, {parse_mode: 'HTML'}).catch(()=>{});
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
// 8. LỆNH BOT ADMIN VÀ XỬ LÝ SỰ KIỆN (MỚI + CŨ)
// ==========================================

async function checkMembership(userId) {
    try {
        const channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        const validStatuses = ['member', 'administrator', 'creator'];
        return { inChannel: validStatuses.includes(channelMember.status), inGroup: validStatuses.includes(groupMember.status) };
    } catch (error) { return { error: true }; }
}

bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const adminText = `👨‍💻 <b>BẢNG ĐIỀU KHIỂN QUẢN TRỊ</b>`;
    const adminMenu = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Top 30 Tổng", callback_data: 'admin_checktop' }, { text: "🏆 Top Tuần", callback_data: 'admin_toptuan' }],
                [{ text: "💰 Thống Kê Két Sắt", callback_data: 'admin_thongke' }, { text: "👀 Soi Dòng Tiền", callback_data: 'admin_soivietien' }],
                [{ text: "🚀 Nổ Bảng Xếp Hạng", callback_data: 'admin_duatop' }],
                [{ text: "🔍 Tra Cứu 1 Người", callback_data: 'admin_help_tracuu' }, { text: "👮 Xử Lý Gian Lận", callback_data: 'admin_help_cheat' }],
                [{ text: "🎁 Tạo Code & Truyền Thông", callback_data: 'admin_help_mkt' }, { text: "🎲 Lịch Sử Game", callback_data: 'admin_help_game' }]
            ]
        }
    };
    bot.sendMessage(msg.chat.id, adminText, adminMenu).catch(()=>{});
});

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

        let validBalance = earnedFromTasks + earnedFromRefs + earnedFromChat + earnedFromNewGameLogs;
        let currentBal = user.balance;

        let report = `🔎 <b>KIỂM TOÁN DÒNG TIỀN (ID: ${targetId})</b>\n\n`;
        report += `💰 <b>SỐ DƯ HIỆN TẠI:</b> <b>${Math.round(currentBal*100)/100} SWGT</b>\n\n`;
        report += `🛠 <b>BÓC TÁCH NGUỒN TIỀN (CHẮC CHẮN ĐẾM ĐƯỢC):</b>\n`;
        report += `- Nhiệm vụ cơ bản: ${earnedFromTasks} SWGT\n`;
        report += `- Từ Lượt mời (${user.referralCount} ref): ${earnedFromRefs} SWGT\n`;
        report += `- Từ Chat (${user.groupMessageCount} tin): ${Math.round(earnedFromChat*100)/100} SWGT\n`;
        report += `- Trúng từ Game (Lịch sử mới): +${earnedFromNewGameLogs} SWGT\n\n`;
        report += `⚠️ Mức Dôi Dư Không Ghi Log: <b>${Math.round((currentBal - validBalance)*100)/100} SWGT</b>\n`;
        
        if ((currentBal - validBalance) > 200) {
            report += `🚨 <b>CẢNH BÁO ĐỎ:</b> Mức dôi dư quá lớn. Khả năng cao là Tool lách API!\n`;
        } else {
            report += `✅ <b>KẾT LUẬN:</b> Hợp lý (Nằm trong biên độ dung sai của người từng chơi game/điểm danh thời kỳ cũ).\n`;
        }
        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    } catch (e) {}
});

// 🔥 LƯỚI QUÉT THANH TRỪNG BẢO VỆ NGƯỜI CŨ 🔥
bot.onText(/\/dongbotoanhethong/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(ADMIN_ID, "🚨 Đang quét thanh trừng toàn Server (Đã TĂNG DUNG SAI bảo vệ tài khoản cũ)...", {parse_mode: 'HTML'});
    
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
            
            const gameLogs = await GameLog.find({ userId: user.userId, rewardType: 'swgt' });
            let earnedFromGame = 0;
            gameLogs.forEach(log => { earnedFromGame += parseInt(log.rewardName.replace(' SWGT', '')); });
            validBalance += earnedFromGame;

            // 🛡 TĂNG MỨC BẢO VỆ LÊN 250 SWGT
            // Để đảm bảo tuyệt đối không phạt nhầm bất kỳ người chơi cũ nào đã từng trúng lớn
            const toleranceBuffer = 250; 
            const absoluteMaxValid = validBalance + toleranceBuffer;

            if (user.balance > absoluteMaxValid) {
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

// Các lệnh CŨ
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

bot.onText(/\/toptuan/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(10);
    if (users.length === 0) return bot.sendMessage(ADMIN_ID, "⚠️ Tuần này chưa có ai mời được khách nào.");
    let response = "🏆 <b>BẢNG XẾP HẠNG ĐẠI SỨ TUẦN NÀY:</b>\n\n";
    users.forEach((u, index) => { response += `${index + 1}. ${u.firstName} ${u.lastName} - <b>${u.weeklyReferralCount}</b> khách\n🆔 ID: <code>${u.userId}</code>\n--------------------------\n`; });
    bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
});

bot.onText(/\/top20swgt/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(ADMIN_ID, "⏳ Đang truy xuất dữ liệu Top 20 Phú Hộ SWGT...");
    try {
        const users = await User.find({ balance: { $gt: 0 } }).sort({ balance: -1 }).limit(20);
        if (users.length === 0) return bot.sendMessage(ADMIN_ID, "⚠️ Hệ thống chưa có ai có số dư SWGT.");
        let response = "💰 <b>DANH SÁCH TOP 20 NGƯỜI GIÀU NHẤT (SỐ DƯ SWGT):</b>\n\n";
        users.forEach((u, index) => {
            let medal = "👤"; if (index === 0) medal = "🥇"; if (index === 1) medal = "🥈"; if (index === 2) medal = "🥉";
            response += `${medal} <b>Top ${index + 1}: ${u.firstName} ${u.lastName}</b>\n🆔 ID: <code>${u.userId}</code>\n💎 Số dư: <b>${u.balance} SWGT</b>\n--------------------------\n`;
        });
        bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
    } catch (error) { bot.sendMessage(ADMIN_ID, `❌ Lỗi truy xuất: ${error.message}`); }
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

bot.onText(/\/resetref (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    const refs = await User.find({ referredBy: targetId });
    let referrer = await User.findOne({ userId: targetId });
    if (!referrer) return bot.sendMessage(ADMIN_ID, "❌ Không tìm thấy thông tin.");
    let doneCount = 0; let notDoneCount = 0;
    refs.forEach(r => { if (r.task1Done) doneCount++; else notDoneCount++; });
    const penalty = notDoneCount * 5; 
    referrer.referralCount = doneCount; referrer.balance = Math.max(0, referrer.balance - penalty);
    await referrer.save();
    bot.sendMessage(ADMIN_ID, `✅ Đã đối soát ID: ${targetId}\nRef cập nhật: ${doneCount}\nĐã trừ: ${penalty} SWGT`);
});

bot.onText(/\/locref (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    const allRefs = await User.find({ referredBy: targetId });
    let realCount = 0; let fakeIds = [];
    allRefs.forEach(r => { if (r.task1Done) realCount++; else { fakeIds.push(r._id); } });
    if (fakeIds.length > 0) await User.deleteMany({ _id: { $in: fakeIds } });
    let user = await User.findOne({ userId: targetId }); 
    if (user) { user.referralCount = realCount; await user.save(); }
    bot.sendMessage(ADMIN_ID, `✅ Đã xóa ${fakeIds.length} nick rác của ID ${targetId}. Ref thực: ${realCount}`);
});

bot.onText(/\/phat (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    const user = await User.findOne({ userId: targetId });
    if (!user) return bot.sendMessage(ADMIN_ID, "❌ Không tìm thấy!");
    const refs = await User.find({ referredBy: targetId });
    let doneCount = 0; let notDoneCount = 0;
    refs.forEach(r => { if (r.task1Done) doneCount++; else notDoneCount++; });
    const penalty = notDoneCount * 5; 
    user.referralCount = doneCount; user.balance = Math.max(0, user.balance - penalty); 
    await user.save();
    bot.sendMessage(ADMIN_ID, `✅ Đã phạt ID ${targetId}\nXóa ${notDoneCount} nick ảo\nTrừ ${penalty} SWGT.`);
});

bot.onText(/\/setref (\d+) (\d+) (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1]; const newRef = parseInt(match[2]); const newBal = parseFloat(match[3]);
    let user = await User.findOne({ userId: targetId });
    if (!user) return bot.sendMessage(ADMIN_ID, "❌ Không tìm thấy User!");
    user.referralCount = newRef; user.balance = newBal; await user.save();
    bot.sendMessage(ADMIN_ID, `✅ Đã set ID ${targetId} -> Ref: ${newRef}, Balance: ${newBal}`);
});

bot.onText(/\/sendto (\d+) ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try {
        await bot.sendMessage(match[1], `👨‍💻 <b>THÔNG BÁO TỪ BQT SWC:</b>\n\n${match[2]}`, { parse_mode: 'HTML' });
        bot.sendMessage(ADMIN_ID, `✅ Đã gửi tin nhắn.`);
    } catch (error) { bot.sendMessage(ADMIN_ID, `❌ Lỗi gửi tin nhắn.`); }
});

// START VÀ CALLBACK CŨ
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
            if (referrer) { bot.sendMessage(refId, `🎉 <b>CÓ NGƯỜI MỚI VỪA BẤM VÀO LINK CỦA BẠN!</b>\n👤 <b>${firstName} ${lastName}</b>`, {parse_mode: 'HTML'}).catch(()=>{}); }
        }
    } else {
        user.firstName = firstName; user.lastName = lastName; user.username = username; user.isPremium = isPremium;
    }
    await user.save();
    
    let welcomeText = `👋 <b>Chào mừng bạn đến với Cộng Đồng SWC Việt Nam!</b> 🚀\n\n👇 <b>HÀNH ĐỘNG NGAY:</b> Bấm nút <b>"MỞ ỨNG DỤNG SWC NGAY"</b> bên dưới để kích hoạt ví và gia tăng tài sản!`;
    let keyboardArray = [ [{ text: "1️⃣ Nhiệm vụ Tân binh", callback_data: 'task_1' }], [{ text: "2️⃣ Lan tỏa Cộng Đồng", callback_data: 'task_3' }], [{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }] ];
    bot.sendPhoto(chatId, './Bia.jpg', { caption: welcomeText, parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboardArray} }).catch(err => { bot.sendMessage(chatId, welcomeText, {parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboardArray}}); });
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id; const userId = callbackQuery.from.id.toString(); const data = callbackQuery.data;
    if (data === 'admin_help_game') { return bot.sendMessage(ADMIN_ID, `🎲 <b>TRA CỨU LỊCH SỬ CHƠI GAME</b>\n\n<code>/loggame [ID]</code>`, {parse_mode: 'HTML'}); }
    if (data === 'admin_help_tracuu') { return bot.sendMessage(ADMIN_ID, `🔍 <b>TRA CỨU THÔNG TIN</b>\n\n<code>/tracuu [ID]</code>`, { parse_mode: 'HTML' }); }
    if (data === 'admin_help_cheat') { return bot.sendMessage(ADMIN_ID, `👮 <b>XỬ LÝ GIAN LẬN</b>\n\n<code>/checkref [ID]</code>\n<code>/locref [ID]</code>\n<code>/phat [ID]</code>\n<code>/resetref [ID]</code>`, { parse_mode: 'HTML' }); }
    if (data === 'admin_help_mkt') { return bot.sendMessage(ADMIN_ID, `🎁 <b>MARKETING</b>\n\n<code>/sendall [Nội_dung]</code>`, { parse_mode: 'HTML' }); }

    let user = await User.findOne({ userId: userId }); if (!user) return bot.answerCallbackQuery(callbackQuery.id);

    if (data === 'task_1') {
        const task1Text = `🎯 <b>BƯỚC 1: LẤY VỐN KHỞI NGHIỆP</b>\n\n1️⃣ <b>Join Kênh & Group</b> (+10 SWGT).\n2️⃣ <b>Mở App Kết nối Ví</b> (+5 SWGT).`;
        bot.sendMessage(chatId, task1Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [ [{ text: "🔵 Join Kênh", url: "https://t.me/swc_capital_vn" }], [{ text: "💬 Join Group", url: "https://t.me/swc_capital_chat" }], [{ text: "✅ KIỂM TRA & NHẬN THƯỞNG", callback_data: 'check_join' }] ] } });
    } 
    else if (data === 'check_join') {
        if (!user.task1Done) {
            user.balance += 10; user.task1Done = true; await user.save();
            bot.answerCallbackQuery(callbackQuery.id, { text: `🎉 Tuyệt vời! Xác minh thành công, +10 SWGT.`, show_alert: true });
        } else { bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Đã nhận thưởng!", show_alert: true }); }
    }
    else if (data === 'task_3') {
        bot.sendMessage(chatId, `💎 <b>CHẶNG 2: LAN TỎA GIÁ TRỊ</b>\n\n🤝 Bạn đã mời: <b>${user.referralCount || 0} đối tác</b>.\n🔗 Link của bạn: https://t.me/Dau_Tu_SWC_bot?start=${userId}`, { parse_mode: 'HTML' });
    } 
    bot.answerCallbackQuery(callbackQuery.id).catch(()=>{});
});

// CHỐNG SPAM CHAT GROUP (CŨ)
bot.on('message', async (msg) => {
    if (msg.from && msg.from.id.toString() === ADMIN_ID && msg.reply_to_message) { return; }
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
