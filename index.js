const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');
const mongoose = require('mongoose');

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG ---
const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGODB_URI;

// Bật chế độ lắng nghe sự kiện biến động thành viên
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
    
    // BIẾN CHO TÍNH NĂNG GHÉP VỐN MUA THÊM
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
    spinCount: { type: Number, default: 0 }
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
// 1. TÍNH NĂNG TỰ ĐỘNG NHẮC NHỞ ĐIỂM DANH LÚC 8H SÁNG
// ==========================================
setInterval(async () => {
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const vnHour = vnTime.getUTCHours();
    const vnMinute = vnTime.getUTCMinutes();

    if (vnHour === 8 && vnMinute === 0) {
        const todayStr = vnTime.toISOString().split('T')[0];
        const users = await User.find({});
        
        for (let user of users) {
            let lastCheckinStr = '';
            if (user.lastCheckInDate) {
                lastCheckinStr = new Date(new Date(user.lastCheckInDate).getTime() + (7 * 60 * 60 * 1000)).toISOString().split('T')[0];
            }

            if (lastCheckinStr !== todayStr) {
                const remindMsg = `☀️ <b>CHÀO BUỔI SÁNG!</b>\n\nPhần thưởng điểm danh SWGT ngày hôm nay của bạn đã sẵn sàng.\n\n⚠️ <i>Lưu ý: Nếu bỏ lỡ 1 ngày, chuỗi phần thưởng của bạn sẽ bị quay lại từ Ngày 1.</i>\n\n👉 Hãy bấm <b>"MỞ ỨNG DỤNG ĐIỂM DANH"</b> ở menu bên dưới để nhận nhé!`;
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

// ==========================================
// 2. KÉO TRAFFIC VÀO KÊNH/GROUP (9H SÁNG VÀ 19H30 TỐI)
// ==========================================
setInterval(async () => {
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const vnHour = vnTime.getUTCHours();
    const vnMinute = vnTime.getUTCMinutes();

    if (vnHour === 9 && vnMinute === 0) {
        try {
            const allUsers = await User.find({});
            const morningMsg = `☀️ <b>CHÀO BUỔI SÁNG CỘNG ĐỒNG SWC!</b>\n\nTin tức và nhận định mới nhất về tiến độ dự án uST đã được cập nhật. Hãy vào Kênh Thông Tin để nắm bắt ngay!\n\n💬 <i>Đừng quên: Mỗi bình luận chia sẻ quan điểm (trên 10 ký tự) trong Group Chat sẽ được hệ thống tự động cộng <b>+0.1 SWGT</b>. Vào chém gió ngay anh em nhé!</i>`;
            
            let keyboard = [
                [{ text: "🔵 ĐỌC TIN TỨC TRÊN KÊNH", url: `https://t.me/${CHANNEL_USERNAME.replace('@','')}` }],
                [{ text: "💬 VÀO GROUP CHAT NHẬN THƯỞNG", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }]
            ];

            for (let user of allUsers) {
                bot.sendMessage(user.userId, morningMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(()=>{});
                await new Promise(resolve => setTimeout(resolve, 50)); 
            }
        } catch (error) {}
    }

    if (vnHour === 19 && vnMinute === 30) {
        try {
            const allUsers = await User.find({});
            const eveningMsg = `🌙 <b>TỔNG KẾT NGÀY DÀI - VÀO GROUP GIAO LƯU NÀO!</b>\n\nMột ngày bận rộn sắp khép lại. Mọi người có nhận định gì về thị trường hay các bước đi tiếp theo của SWC không?\n\n👉 Hãy vào Group Cộng Đồng chia sẻ góc nhìn của bạn. Vừa trao đổi kiến thức, vừa nhặt thêm SWGT miễn phí <b>(+0.1 SWGT/tin nhắn)</b>!`;
            
            let keyboard = [
                [{ text: "💬 VÀO GROUP CHÉM GIÓ NGAY", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }]
            ];

            for (let user of allUsers) {
                bot.sendMessage(user.userId, eveningMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(()=>{});
                await new Promise(resolve => setTimeout(resolve, 50)); 
            }
        } catch (error) {}
    }
}, 60000); 

// ==========================================
// 3. TÍNH NĂNG TỰ ĐỘNG BÁO CÁO ĐUA TOP LAN TỎA LÚC 20H TỐI
// ==========================================
setInterval(async () => {
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const vnHour = vnTime.getUTCHours();
    const vnMinute = vnTime.getUTCMinutes();

    if (vnHour === 20 && vnMinute === 0) {
        try {
            const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
            if (topUsers.length > 0) {
                let topText = "";
                const medals = ['🥇', '🥈', '🥉'];
                topUsers.forEach((u, index) => {
                    topText += `${medals[index]} <b>${u.firstName} ${u.lastName}</b>: Trao ${u.weeklyReferralCount} cơ hội\n`;
                });
                const msg = `🏆 <b>BẢNG VÀNG ĐẠI SỨ LAN TỎA TUẦN NÀY - BẠN ĐANG Ở ĐÂU?</b> 🏆\n\n` +
                            `Hành trình kiến tạo tự do tài chính cùng Cộng đồng SWC đang lan tỏa mạnh mẽ hơn bao giờ hết! Hôm nay, những Đại sứ xuất sắc nhất đã tiếp tục trao đi giá trị:\n\n` +
                            `${topText}\n` +
                            `💡 <i>"Thành công lớn nhất không phải là bạn có bao nhiêu tiền, mà là bạn giúp được bao nhiêu người trở nên giàu có."</i>\n\n` +
                            `👉 Cổng khai thác miễn phí sẽ <b>ĐÓNG LẠI VÀO CHỦ NHẬT NÀY</b>. Hãy copy Đường dẫn của bạn trong Bot và gửi cho bạn bè ngay tối nay để đua top nhé! 🚀`;
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
                    try {
                        await bot.sendMessage(user.userId, halvingMsg, { parse_mode: 'HTML' });
                        user.hasReceivedHalvingMsg = true;
                        await user.save();
                    } catch (e) {}
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
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const vnDay = vnTime.getUTCDay(); 
    const vnHour = vnTime.getUTCHours();
    const vnMinute = vnTime.getUTCMinutes();

    if (vnDay === 0 && vnHour === 23 && vnMinute === 59) {
        try {
            const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
            if (topUsers.length > 0) {
                let topText = "";
                const medals = ['🥇', '🥈', '🥉'];
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
                // Quá 10 phút -> Hủy lệnh
                u.topUpStatus = 'none';
                await u.save();
                bot.sendMessage(u.userId, `❌ <b>LỆNH ĐÃ BỊ HỦY</b>\n\nĐã quá 10 phút nhưng hệ thống không nhận được hình ảnh Biên lai chuyển khoản của bạn. Lệnh ghép vốn đã tự động bị hủy.\n\nNếu bạn vẫn muốn nạp, vui lòng lên Mini App thao tác lại nhé.`, {parse_mode: 'HTML'}).catch(()=>{});
            } 
            else if (diffMins >= 5 && !u.topUpReminderSent) {
                // Quá 5 phút -> Nhắc nhở
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
        
        let lockedBalance = 0;
        let lockedRefsCount = 0;
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
                        user.balance += 5; // Giảm xuống 5 SWGT
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
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const inputCode = data.code.trim().toUpperCase(); 
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

                const fomoMsg = `🔥 <b>TING TING! CÓ NGƯỜI NHẬN QUÀ THÀNH CÔNG!</b> 🔥\n\nThành viên <b>${user.firstName} ${user.lastName}</b> vừa nhanh tay nhập mã <code>${inputCode}</code> và giật ngay <b>${gift.reward} SWGT</b> vào ví!\n\n👉 <i>Mọi người nhớ bật thông báo Group để không bỏ lỡ những mã Code cực khủng tiếp theo từ Admin nhé!</i>`;
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
                    user.balance = Math.round((user.balance + reward) * 100) / 100;
                    await user.save();
                    const promoteMsg = `🎖️ <b>THĂNG CẤP QUÂN HÀM!</b> 🎖️\n\nChúc mừng đồng chí <b>${user.firstName} ${user.lastName}</b> vừa xuất sắc cán mốc <b>${data.milestone} đồng đội</b>.\n\n⭐ Cấp bậc mới: <b>${rankTitle}</b>\n💰 Thưởng nóng: <b>+${reward} SWGT</b>\n\n👉 <i>Tiếp tục chiến đấu để lên hàm Tướng nào!</i>`;
                    bot.sendMessage(GROUP_USERNAME, promoteMsg, {parse_mode: 'HTML'}).catch(()=>{});
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward }));
                } else { res.writeHead(400); res.end(JSON.stringify({ success: false, message: "Chưa đủ điều kiện!" })); }
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
                const vnNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
                vnNow.setUTCHours(0,0,0,0); 

                let vnLastCheckin = new Date(0);
                if (user.lastCheckInDate) {
                    vnLastCheckin = new Date(new Date(user.lastCheckInDate).getTime() + (7 * 60 * 60 * 1000));
                }
                vnLastCheckin.setUTCHours(0,0,0,0);

                const diffTime = vnNow.getTime() - vnLastCheckin.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                    res.writeHead(400); return res.end(JSON.stringify({ success: false, message: 'Hôm nay bạn đã điểm danh rồi, hãy quay lại vào ngày mai!' }));
                }

                if (diffDays === 1) {
                    user.checkInStreak += 1;
                    if (user.checkInStreak > 7) user.checkInStreak = 1; 
                } else {
                    user.checkInStreak = 1; 
                }

                const streakRewards = { 1: 0.25, 2: 0.75, 3: 1.5, 4: 1.75, 5: 2.5, 6: 3.5, 7: 4.5 };
                const reward = streakRewards[user.checkInStreak] || 0.25;

                user.balance = Math.round((user.balance + reward) * 100) / 100; 
                user.lastCheckInDate = new Date(); 
                await user.save();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward, streak: user.checkInStreak, lastCheckInDate: user.lastCheckInDate }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }

    else if (parsedUrl.pathname === '/api/spin-wheel' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                if (user.balance < 20) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: "⚠️ Không đủ 20 SWGT để mua búa đập rương!" }));
                }

                user.balance = Math.round((user.balance - 20) * 100) / 100;
                user.spinCount = (user.spinCount || 0) + 1;
                
                let reward = 0;
                if (user.spinCount >= 30) {
                    reward = 500;
                    user.spinCount = 0; 
                } else {
                    const weights = [
                        { reward: 0, chance: 45 },
                        { reward: 5, chance: 35 },
                        { reward: 10, chance: 12 },
                        { reward: 20, chance: 5 },
                        { reward: 50, chance: 1.5 },
                        { reward: -2, chance: 1.5 } 
                    ];
                    let rand = Math.random() * 100;
                    let cumulative = 0;
                    for (let w of weights) {
                        cumulative += w.chance;
                        if (rand <= cumulative) { reward = w.reward; break; }
                    }
                }

                if (reward === -2) {
                    if (!user.ownedFrames.includes('light')) { user.ownedFrames.push('light'); }
                } else if (reward > 0) {
                    user.balance = Math.round((user.balance + reward) * 100) / 100;
                }
                await user.save();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, reward: reward, newBalance: user.balance }));

            } catch (e) {
                res.writeHead(400); res.end(JSON.stringify({ success: false }));
            }
        });
    }

    else if (parsedUrl.pathname === '/api/redeem' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: "Không tìm thấy người dùng" }));
                }
                
                const frameIds = ['bronze', 'silver', 'gold', 'dragon', 'light']; 
                if (frameIds.includes(data.itemName)) {
                    if (data.cost > 0) {
                        if (user.balance < data.cost) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            return res.end(JSON.stringify({ success: false, message: "Không đủ số dư!" }));
                        }
                        user.balance = Math.round((user.balance - data.cost) * 100) / 100;
                    }
                    user.activeFrame = data.itemName;
                    if (!user.ownedFrames) user.ownedFrames = ['none'];
                    if (!user.ownedFrames.includes(data.itemName)) {
                        user.ownedFrames.push(data.itemName);
                    }
                    await user.save();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: true, balance: user.balance }));
                }

                if (user.balance < data.cost) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: `Bạn cần tích lũy đủ ${data.cost} SWGT để đổi quyền lợi này!` }));
                }
                
                user.balance = Math.round((user.balance - data.cost) * 100) / 100;
                await user.save();

                let userNotify = `⏳ Yêu cầu đổi: <b>${data.itemName}</b> đang được xử lý!`;
                
                if(data.itemName.includes('Ebook') || data.itemName.includes('Audio') || data.itemName.includes('Combo')) {
                    userNotify = `🎉 <b>ĐỔI QUÀ THÀNH CÔNG!</b>\n\nBạn đã dùng ${data.cost} SWGT đổi lấy <b>${data.itemName}</b>.\n👉 Vui lòng chờ Admin gửi Link/File tài liệu trực tiếp vào tin nhắn này nhé!`;
                }

                bot.sendMessage(data.userId, userNotify, {parse_mode: 'HTML'}).catch(()=>{});
                
                const reportMsg = `🎁 <b>YÊU CẦU ĐỔI QUÀ / MUA TÀI LIỆU</b>\nKhách: ${user.firstName} (ID: <code>${user.userId}</code>)\nQuà: <b>${data.itemName}</b>\n💰 Đã trừ: ${data.cost} SWGT\n👉 <a href="tg://user?id=${user.userId}">BẤM VÀO ĐÂY ĐỂ GỬI TÀI LIỆU/TƯ VẤN CHO KHÁCH</a>`;
                bot.sendMessage(ADMIN_ID, reportMsg, { parse_mode: 'HTML' }).catch(()=>{});
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance }));
            } catch (e) { 
                res.writeHead(400, { 'Content-Type': 'application/json' }); 
                res.end(JSON.stringify({ success: false, message: 'Lỗi server' })); 
            }
        });
    }

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
                if (user.balance >= withdrawAmount && withdrawAmount >= 500) {
                    user.balance -= withdrawAmount; 
                    await user.save();
                    
                    let userMsg = ""; let adminReport = "";

                    if (data.withdrawMethod === 'gate') {
                        userMsg = `💸 <b>YÊU CẦU RÚT TIỀN ĐANG ĐƯỢC TIẾN HÀNH!</b>\n\nYêu cầu rút <b>${withdrawAmount} SWGT</b> (Miễn phí) qua Gate.io đang được xử lý.\n\n🔑 Gatecode/UID: <code>${user.gatecode}</code>`;
                        adminReport = `🚨 <b>YÊU CẦU RÚT TIỀN (GATE.IO)</b>\n\n👤 Khách: <b>${user.firstName} ${user.lastName}</b>\n🆔 ID: <code>${user.userId}</code>\n⭐ Hạng TK: ${user.isPremium ? 'Premium' : 'Thường'}\n💰 Số lượng: <b>${withdrawAmount} SWGT</b>\n\n📝 <b>Thông tin thanh toán:</b>\n- Gatecode/UID: <code>${user.gatecode}</code>\n- Họ tên: ${user.fullName || 'Không có'}\n- SĐT: ${user.phone || 'Không có'}\n- Email: ${user.email || 'Không có'}\n\n👉 <i>Admin hãy gửi SWGT nội bộ qua Gate.io và Reply tin nhắn này gõ "xong".</i>`;
                    } else {
                        userMsg = `💸 <b>YÊU CẦU RÚT TIỀN ĐANG ĐƯỢC TIẾN HÀNH!</b>\n\nYêu cầu rút <b>${withdrawAmount} SWGT</b> qua ví ERC20 đang được xử lý (Sẽ trừ 70 SWGT phí mạng).\n\n🏦 Ví nhận: <code>${user.wallet}</code>`;
                        adminReport = `🚨 <b>YÊU CẦU RÚT TIỀN (ERC20)</b>\n\n👤 Khách: <b>${user.firstName} ${user.lastName}</b>\n🆔 ID: <code>${user.userId}</code>\n⭐ Hạng TK: ${user.isPremium ? 'Premium' : 'Thường'}\n💰 Số lượng khách rút: <b>${withdrawAmount} SWGT</b>\n⚠️ (Nhớ trừ 70 SWGT phí mạng khi chuyển)\n🏦 Ví ERC20: <code>${user.wallet}</code>\n\n👉 <i>Admin hãy Reply tin nhắn này gõ "xong" để báo cho khách.</i>`;
                    }

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

    // --- CHÈN THÊM API THANH KHOẢN VNĐ (BÁN CHO ADMIN) ---
    else if (parsedUrl.pathname === '/api/liquidate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                const usdtRate = 25400;
                const liquidateVND = Math.floor(user.balance * 0.008 * usdtRate);

                if (user.balance <= 0 || user.balance >= 500) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: "Chỉ áp dụng cho số dư dưới 500 SWGT!" }));
                }

                if (liquidateVND < 5000) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: "Số dư của bạn quy đổi chưa đạt Min tối thiểu 5.000 VNĐ." }));
                }

                const amountSWGT = user.balance;
                user.balance = 0; // Trừ sạch tiền
                await user.save();

                const safeBankName = data.bankName ? data.bankName.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
                const safeAccountName = data.accountName ? data.accountName.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "Không rõ";
                const safeBankAccount = data.bankAccount ? data.bankAccount.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

                bot.sendMessage(data.userId, `✅ <b>YÊU CẦU THANH KHOẢN THÀNH CÔNG!</b>\n\nBạn đã bán <b>${amountSWGT} SWGT</b>. Vui lòng chờ Admin chuyển <b>${data.vndAmount} VNĐ</b> vào tài khoản ngân hàng của bạn.`, {parse_mode: 'HTML'}).catch(()=>{});
                
                const adminReport = `🚨 <b>YÊU CẦU THANH LÝ LẤY VNĐ</b>\n\n👤 Khách: ${user.firstName} (ID: <code>${user.userId}</code>)\n💰 Số lượng xả: <b>${amountSWGT} SWGT</b>\n💵 Số tiền Admin cần bank: <b>${data.vndAmount} VNĐ</b>\n\n🏦 <b>Thông tin nhận tiền:</b>\n- Ngân hàng: ${safeBankName}\n- Chủ TK: <b>${safeAccountName.toUpperCase()}</b>\n- Số TK: <code>${safeBankAccount}</code>\n\n👉 <i>Admin hãy Bank tiền và Reply tin nhắn này gõ "xong" nhé.</i>`;
                bot.sendMessage(ADMIN_ID, adminReport, { parse_mode: 'HTML' }).catch(()=>{});

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }

    // --- API GHÉP VỐN (MUA THÊM TỪ ADMIN) ---
    else if (parsedUrl.pathname === '/api/topup' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                const shortfall = 500 - user.balance;

                user.topUpStatus = 'waiting_bill';
                user.topUpTimestamp = new Date();
                user.topUpReminderSent = false;
                user.pendingSWGT = shortfall;
                await user.save();

                const bankMsg = `⚡ <b>YÊU CẦU GHÉP VỐN ĐÃ ĐƯỢC TẠO</b>\n\nBạn đang thiếu <b>${shortfall} SWGT</b> để đủ hạn mức rút.\n💰 Số tiền cần thanh toán: <b>${data.vndAmount} VNĐ</b> (Vui lòng chuyển chính xác số tiền)\n\n🏦 <b>THÔNG TIN CHUYỂN KHOẢN:</b>\n- Ngân hàng: <b>Techcombank</b>\n- Số tài khoản: <code>568786999999</code>\n- Nội dung chuyển tiền: <code>${user.userId}</code>\n\n📸 <i>Hành động: Vui lòng chuyển ĐÚNG nội dung và <b>GỬI ẢNH BIÊN LAI (BILL)</b> vào đây cho Bot. Lệnh sẽ tự động hủy nếu sau 10 phút Bot không nhận được ảnh!</i>`;
                
                bot.sendMessage(data.userId, bankMsg, {parse_mode: 'HTML'}).catch(()=>{});

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    
    else if (parsedUrl.pathname === '/api/leaderboard' && req.method === 'GET') {
        try {
            const allUsersForBoard = await User.find({ $or: [{referralCount: { $gt: 0 }}, {weeklyReferralCount: { $gt: 0 }}] })
                                       .select('firstName lastName referralCount weeklyReferralCount activeFrame pendingRefs');
            
            const processedUsers = allUsersForBoard.map(u => {
                let lockedCount = (u.pendingRefs && u.pendingRefs.length > 0) ? u.pendingRefs.length : 0;
                return {
                    firstName: u.firstName,
                    lastName: u.lastName,
                    activeFrame: u.activeFrame,
                    referralCount: Math.max(0, u.referralCount - lockedCount), 
                    weeklyReferralCount: Math.max(0, (u.weeklyReferralCount || 0) - lockedCount) 
                };
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(processedUsers));
        } catch (e) { res.writeHead(400); res.end(); }
    }
    else { res.writeHead(200); res.end('API Online'); }
});
server.listen(process.env.PORT || 3000);

// --- 8. LỆNH BOT VÀ XỬ LÝ SỰ KIỆN ---

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
    const adminText = `👨‍💻 <b>BẢNG ĐIỀU KHIỂN QUẢN TRỊ (ADMIN PANEL)</b>`;
    const adminMenu = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Top 10 Tổng", callback_data: 'admin_checktop' }, { text: "🏆 Top Tuần", callback_data: 'admin_toptuan' }],
                [{ text: "💰 Thống Kê Két Sắt", callback_data: 'admin_thongke' }, { text: "👀 Soi Dòng Tiền", callback_data: 'admin_soivietien' }],
                [{ text: "🚀 Nổ Bảng Xếp Hạng Lên Group", callback_data: 'admin_duatop' }],
                [{ text: "🔍 Tra Cứu 1 Người", callback_data: 'admin_help_tracuu' }, { text: "👮 Xử Lý Gian Lận", callback_data: 'admin_help_cheat' }],
                [{ text: "🎁 Tạo Code & Truyền Thông", callback_data: 'admin_help_mkt' }]
            ]
        }
    };
    bot.sendMessage(msg.chat.id, adminText, adminMenu).catch(err => console.log("Lỗi gửi menu:", err));
});

bot.onText(/\/testkichban/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;

    const testMenu = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🤝 Kịch bản Mời người (A mời B)", callback_data: 'test_invite' }],
                [{ text: "☀️ Kịch bản 8H (Nhắc Điểm danh)", callback_data: 'test_8h' }],
                [{ text: "🌅 Kịch bản 9H Sáng (Lùa Traffic)", callback_data: 'test_9h' }],
                [{ text: "🌃 Kịch bản 19H30 Tối (Lùa Traffic)", callback_data: 'test_19h30' }],
                [{ text: "🔓 Kịch bản Băng Tan (Rã đông 30D)", callback_data: 'test_unlock' }],
                [{ text: "🏃 Kịch bản Rời nhóm (Phạt B & A)", callback_data: 'test_leave' }]
            ]
        }
    };
    
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
        report += `👤 <b>Họ và Tên:</b> ${user.firstName} ${user.lastName}\n`;
        report += `🔗 <b>Username:</b> ${user.username || 'Không có'}\n`;
        report += `⭐️ <b>Hạng Tài Khoản:</b> ${user.isPremium ? 'Premium' : 'Thường'}\n`;
        report += `📅 <b>Ngày Tham Gia:</b> ${new Date(user.joinDate).toLocaleString('vi-VN')}\n\n`;
        report += `💰 <b>SỐ DƯ TÀI SẢN:</b> <b>${user.balance} SWGT</b>\n`;
        
        let lockedBalance = 0;
        if (user.pendingRefs && user.pendingRefs.length > 0) {
            lockedBalance = user.pendingRefs.reduce((sum, ref) => sum + (ref.reward || 0), 0);
        }
        report += `🔒 <b>Đang Khóa (Chờ duyệt 30D):</b> <b>${Math.round(lockedBalance * 100) / 100} SWGT</b>\n\n`;

        report += `👥 <b>Tổng Lượt Mời:</b> ${user.referralCount} người\n`;
        report += `🏆 <b>Mời Tuần Này:</b> ${user.weeklyReferralCount} người\n\n`;
        report += `⚙️ <b>TRẠNG THÁI NHIỆM VỤ:</b>\n`;
        report += `- Xác minh Tân Binh: ${user.task1Done ? '✅ Hoàn thành' : '❌ Chưa làm'}\n`;
        report += `- Chuỗi Điểm Danh: ${user.checkInStreak} ngày liên tiếp\n`;
        report += `💳 <b>THÔNG TIN RÚT TIỀN:</b>\n`;
        report += `- Ví ERC20: <code>${user.wallet || 'Chưa cập nhật'}</code>\n`;
        report += `- Gatecode: <code>${user.gatecode || 'Chưa cập nhật'}</code>\n`;
        report += `- Số điện thoại: ${user.phone || 'Chưa cập nhật'}\n`;
        report += `- Email: ${user.email || 'Chưa cập nhật'}\n\n`;
        report += `👉 <a href="tg://user?id=${targetId}">Nhấn vào đây để nhắn tin trực tiếp</a>`;
        bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
    } catch (error) { bot.sendMessage(ADMIN_ID, `❌ Lỗi khi tra cứu: ${error.message}`); }
});

bot.onText(/\/checktop/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({ referralCount: { $gt: 0 } }).sort({ referralCount: -1 }).limit(10);
    let response = "🕵️‍♂️ <b>DANH SÁCH TOP 10 TỔNG CỘNG ĐỒNG (KÈM ID):</b>\n\n";
    users.forEach((u, index) => {
        response += `${index + 1}. ${u.firstName} ${u.lastName}\n🆔 ID: <code>${u.userId}</code>\n👥 Mời: ${u.referralCount} | 💰 Dư: ${u.balance}\n--------------------------\n`;
    });
    bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
});

bot.onText(/\/toptuan/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(10);
    if (users.length === 0) return bot.sendMessage(ADMIN_ID, "⚠️ Tuần này chưa có ai mời được khách nào.");
    let response = "🏆 <b>BẢNG XẾP HẠNG ĐẠI SỨ TUẦN NÀY:</b>\n\n";
    users.forEach((u, index) => {
        response += `${index + 1}. ${u.firstName} ${u.lastName} - <b>${u.weeklyReferralCount}</b> khách\n🆔 ID: <code>${u.userId}</code>\n--------------------------\n`;
    });
    bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
});

bot.onText(/\/checkref (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    bot.sendMessage(ADMIN_ID, "⏳ Đang trích xuất và thống kê dữ liệu...");
    const refs = await User.find({ referredBy: targetId }).sort({ joinDate: -1 });
    if (refs.length === 0) return bot.sendMessage(ADMIN_ID, "❌ Tài khoản này chưa mời được ai bấm vào link.");
    let doneCount = 0; let notDoneCount = 0;
    refs.forEach(r => { if (r.task1Done) { doneCount++; } else { notDoneCount++; } });

    let response = `🕵️‍♂️ <b>BÁO CÁO CHI TIẾT ID: <code>${targetId}</code></b>\n`;
    response += `📊 <b>Tổng số đã bấm link:</b> ${refs.length} người\n`;
    response += `✅ <b>Đã hoàn thành NV:</b> ${doneCount} người\n`;
    response += `❌ <b>Chưa làm NV (Nick rác):</b> ${notDoneCount} người\n`;
    response += `--------------------------\n📝 <b>Danh sách chi tiết (50 người mới nhất):</b>\n\n`;
    const displayRefs = refs.slice(0, 50); 
    displayRefs.forEach((r, index) => {
        const status = r.task1Done ? "✅ Đã Join" : "❌ Chưa xong NV";
        response += `${index + 1}. <b>${r.firstName} ${r.lastName}</b>\n   Trạng thái: ${status} | ID: <code>${r.userId}</code>\n`;
    });
    if (refs.length > 50) response += `\n<i>... và ${refs.length - 50} người khác.</i>`;
    bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
});

bot.onText(/\/resetref (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    bot.sendMessage(ADMIN_ID, "⏳ Đang tự động quét, trừ tiền và gửi thông báo...");
    const refs = await User.find({ referredBy: targetId });
    let referrer = await User.findOne({ userId: targetId });
    if (!referrer) return bot.sendMessage(ADMIN_ID, "❌ Không tìm thấy thông tin người này trong hệ thống.");

    let doneCount = 0; let notDoneCount = 0;
    refs.forEach(r => { if (r.task1Done) doneCount++; else notDoneCount++; });
    if (notDoneCount === 0) return bot.sendMessage(ADMIN_ID, "✅ Tài khoản này rất sạch, 100% khách đã làm nhiệm vụ, không có gì để trừ.");

    const penalty = notDoneCount * 5; 
    const oldBal = referrer.balance; const oldRef = referrer.referralCount;
    referrer.referralCount = doneCount; referrer.balance = Math.max(0, referrer.balance - penalty);

    if (doneCount < 500) referrer.milestone500 = false;
    if (doneCount < 350) referrer.milestone350 = false;
    if (doneCount < 200) referrer.milestone200 = false;
    if (doneCount < 120) referrer.milestone120 = false;
    if (doneCount < 80) referrer.milestone80 = false;
    if (doneCount < 50) referrer.milestone50 = false;
    if (doneCount < 20) referrer.milestone20 = false;
    if (doneCount < 10) referrer.milestone10 = false;
    if (doneCount < 3) referrer.milestone3 = false;
    await referrer.save();

    let adminMsg = `✅ <b>ĐÃ XỬ LÝ XONG ID: <code>${targetId}</code></b>\n\n`;
    adminMsg += `📉 <b>Lượt mời:</b> ${oldRef} ➡️ <b>${doneCount}</b>\n`;
    adminMsg += `💸 <b>Số dư SWGT:</b> ${oldBal} ➡️ <b>${referrer.balance}</b> (Đã trừ ${penalty} SWGT)\n\n`;
    bot.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'HTML' });

    let userMsg = `⚠️ <b>THÔNG BÁO TỪ HỆ THỐNG KIỂM DUYỆT SWC</b> ⚠️\n\nChào <b>${referrer.firstName}</b>, hệ thống Anti-Cheat vừa quét đối soát.\n\n📊 <b>Kết quả:</b>\n- Bấm link: <b>${refs.length}</b>\n- Đã Join: <b>${doneCount}</b>\n- Ảo/Chưa Join: <b>${notDoneCount}</b>\n\n⚖️ Lượt mời của bạn đã cập nhật về <b>${doneCount} người</b>. Trừ ${notDoneCount} tài khoản chưa hợp lệ.\n💡 <i>Nếu họ vào Group xác minh thành công, bạn sẽ tự động được cộng lại phần thưởng.</i>`;
    bot.sendMessage(targetId, userMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/locref (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    bot.sendMessage(ADMIN_ID, "⏳ Đang quét và dọn dẹp dữ liệu rác...");
    const allRefs = await User.find({ referredBy: targetId });
    if (allRefs.length === 0) return bot.sendMessage(ADMIN_ID, "❌ Không có ai bấm link.");

    let realCount = 0; let fakeCount = 0; let fakeIds = [];
    allRefs.forEach(r => { if (r.task1Done) realCount++; else { fakeCount++; fakeIds.push(r._id); } });
    if (fakeIds.length > 0) await User.deleteMany({ _id: { $in: fakeIds } });
    let user = await User.findOne({ userId: targetId }); let oldRef = 0;
    if (user) { oldRef = user.referralCount; user.referralCount = realCount; await user.save(); }

    let response = `✅ <b>LỌC REF THÀNH CÔNG CHO ID: <code>${targetId}</code></b>\n\n🗑 <b>Xóa vĩnh viễn:</b> ${fakeCount} nick rác.\n✅ <b>Giữ lại:</b> ${realCount} nick thật.\n📉 <b>Cập nhật lượt mời:</b> ${oldRef} ➡️ <b>${realCount}</b> người.\n⚠️ Dùng lệnh <code>/setref ${targetId} ${realCount} [Số_tiền_chuẩn]</code> để trừ đi số tiền ảo!`;
    bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
});

// Lệnh gửi tin nhắn riêng cho 1 ID bất kỳ
bot.onText(/\/sendto (\d+) ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    const content = match[2];
    
    try {
        await bot.sendMessage(targetId, `👨‍💻 <b>THÔNG BÁO TỪ BQT SWC:</b>\n\n${content}`, { parse_mode: 'HTML' });
        bot.sendMessage(ADMIN_ID, `✅ Đã gửi tin nhắn thành công tới ID: <code>${targetId}</code>`, { parse_mode: 'HTML' });
    } catch (error) {
        bot.sendMessage(ADMIN_ID, `❌ Lỗi: Không thể gửi (Có thể do sai ID hoặc khách đã block Bot).`);
    }
});

bot.onText(/\/phat (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    bot.sendMessage(ADMIN_ID, "⏳ Đang quét dữ liệu gian lận để xử phạt...");
    const user = await User.findOne({ userId: targetId });
    if (!user) return bot.sendMessage(ADMIN_ID, "❌ Không tìm thấy User ID này!");

    const refs = await User.find({ referredBy: targetId });
    let doneCount = 0; let notDoneCount = 0;
    refs.forEach(r => { if (r.task1Done) doneCount++; else notDoneCount++; });

    if (notDoneCount === 0) return bot.sendMessage(ADMIN_ID, "⚠️ Không có nick ảo nào để phạt!");

    const oldRef = user.referralCount; const oldBal = user.balance; const penalty = notDoneCount * 5; 
    user.referralCount = doneCount; user.balance = Math.max(0, user.balance - penalty); 
    
    if (doneCount < 500) user.milestone500 = false;
    if (doneCount < 350) user.milestone350 = false;
    if (doneCount < 200) user.milestone200 = false;
    if (doneCount < 120) user.milestone120 = false;
    if (doneCount < 80) user.milestone80 = false;
    if (doneCount < 50) user.milestone50 = false;
    if (doneCount < 20) user.milestone20 = false;
    if (doneCount < 10) user.milestone10 = false;
    if (doneCount < 3) user.milestone3 = false;
    await user.save();

    bot.sendMessage(ADMIN_ID, `✅ <b>ĐÃ THỰC THI CÔNG LÝ!</b>\n\n👤 Đối tượng: ${user.firstName} ${user.lastName}\n📉 Ref: ${oldRef} ➡️ <b>${doneCount}</b> (Đã xóa ${notDoneCount} nick ảo)\n💸 Số dư: ${oldBal} ➡️ <b>${user.balance}</b>\n<i>Đã gửi tin nhắn cảnh cáo dằn mặt!</i>`, { parse_mode: 'HTML' });
    bot.sendMessage(targetId, `⚠️ <b>CẢNH BÁO VI PHẠM TỪ HỆ THỐNG!</b>\n\nHệ thống phát hiện tài khoản có hành vi Tool/Clone.\n👮‍♂️ <b>Xử phạt:</b>\n- Xóa <b>${notDoneCount}</b> lượt mời ảo.\n- Thu hồi <b>${penalty} SWGT</b>.\nNếu tiếp tục, tài khoản sẽ bị khóa vĩnh viễn!`, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/setref (\d+) (\d+) (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1]; const newRef = parseInt(match[2]); const newBal = parseFloat(match[3]);
    let user = await User.findOne({ userId: targetId });
    if (!user) return bot.sendMessage(ADMIN_ID, "❌ Không tìm thấy User!");
    user.referralCount = newRef; user.balance = newBal; await user.save();
    bot.sendMessage(ADMIN_ID, `✅ Đã chỉnh sửa thủ công:\nUser ${targetId} -> Ref: ${newRef}, Balance: ${newBal}`);
});

bot.onText(/\/createcode (\S+) (\d+) (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const codeInput = match[1].toUpperCase(); const reward = parseInt(match[2]); const maxUses = parseInt(match[3]);
    try {
        const existing = await GiftCode.findOne({ code: codeInput });
        if (existing) return bot.sendMessage(ADMIN_ID, `❌ Lỗi: Mã tồn tại!`);
        const newGift = new GiftCode({ code: codeInput, reward: reward, maxUses: maxUses });
        await newGift.save();
        bot.sendMessage(ADMIN_ID, `✅ Tạo mã thành công: ${codeInput}`);
    } catch (e) {}
});

bot.onText(/\/sendall ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const broadcastMsg = match[1];
    const users = await User.find({});
    for (let i = 0; i < users.length; i++) {
        try { await bot.sendMessage(users[i].userId, broadcastMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP NGAY", web_app: { url: webAppUrl } }]] } }); } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    bot.sendMessage(ADMIN_ID, `✅ Đã gửi tin nhắn hàng loạt.`);
});

bot.onText(/\/deletecode (\S+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    await GiftCode.findOneAndDelete({ code: match[1].toUpperCase() });
    bot.sendMessage(ADMIN_ID, `✅ Đã xóa mã ${match[1]}`);
});

bot.onText(/\/sendleader ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const broadcastMsg = match[1];
    
    const leaders = await User.find({ referralCount: { $gt: 0 } });
    
    bot.sendMessage(ADMIN_ID, `⏳ Đang lọc dữ liệu... Bắt đầu gửi thông báo cho ${leaders.length} Đại sứ.`);

    let successCount = 0;
    for (let i = 0; i < leaders.length; i++) {
        try { 
            await bot.sendMessage(leaders[i].userId, broadcastMsg, { 
                parse_mode: 'HTML', 
                reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP NGAY", web_app: { url: webAppUrl } }]] } 
            }); 
            successCount++;
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }
    bot.sendMessage(ADMIN_ID, `✅ Đã gửi xong cảnh báo cho ${successCount}/${leaders.length} Đại sứ.`);
});

bot.onText(/\/quettoanhethong/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(ADMIN_ID, `🚨 BẮT ĐẦU KÍCH HOẠT RADAR QUÉT TOÀN HỆ THỐNG...\nQuá trình này sẽ mất một vài phút, vui lòng không thao tác gì thêm.`);
    
    try {
        const leaders = await User.find({ referralCount: { $gt: 0 } });
        let totalFakeRefsRemoved = 0;
        let totalTokensRecovered = 0;

        for (let referrer of leaders) {
            const refs = await User.find({ referredBy: referrer.userId });
            let doneCount = 0;
            let notDoneCount = 0;

            refs.forEach(r => { if (r.task1Done) doneCount++; else notDoneCount++; });

            if (notDoneCount > 0) {
                const penalty = notDoneCount * 5; 
                referrer.referralCount = doneCount; 
                referrer.balance = Math.max(0, referrer.balance - penalty);
                
                if (doneCount < 500) referrer.milestone500 = false;
                if (doneCount < 350) referrer.milestone350 = false;
                if (doneCount < 200) referrer.milestone200 = false;
                if (doneCount < 120) referrer.milestone120 = false;
                if (doneCount < 80) referrer.milestone80 = false;
                if (doneCount < 50) referrer.milestone50 = false;
                if (doneCount < 20) referrer.milestone20 = false;
                if (doneCount < 10) referrer.milestone10 = false;
                if (doneCount < 3) referrer.milestone3 = false;

                await referrer.save();
                totalFakeRefsRemoved += notDoneCount;
                totalTokensRecovered += penalty;

                let userMsg = `⚠️ <b>HỆ THỐNG VỪA QUÉT ĐỐI SOÁT</b> ⚠️\n\nPhát hiện <b>${notDoneCount}</b> tài khoản do bạn mời CHƯA THAM GIA Group xác minh (Tài khoản ảo/spam). Hệ thống đã tự động thu hồi <b>${penalty} SWGT</b>.\n\n💡 <i>Luật chơi rất rõ ràng: Khách của bạn phải vào Group Chat thì bạn mới được nhận thưởng. Khách ảo sẽ bị loại bỏ để bảo vệ giá trị SWGT cho toàn cộng đồng!</i>\n\n✅ Đừng lo lắng! Những tài khoản đang bị giam 30 ngày (do là nick Telegram người thật mới tạo nhưng ĐÃ VÀO GROUP) vẫn được bảo lưu an toàn 100%.`;
                bot.sendMessage(referrer.userId, userMsg, { parse_mode: 'HTML' }).catch(()=>{});
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        const finalReport = `✅ <b>ĐÃ QUÉT VÀ THANH TRỪNG HOÀN TẤT!</b>\n\n` +
                            `🗑 Tổng số nick rác/ảo đã bị loại bỏ: <b>${totalFakeRefsRemoved} nick</b>\n` +
                            `💰 Tổng số tiền SWGT cứu vãn về kho: <b>+${totalTokensRecovered} SWGT</b>\n\n` +
                            `<i>Két sắt của anh đã được làm sạch thành công! Dùng lệnh /admin để kiểm tra lại thống kê.</i>`;
        bot.sendMessage(ADMIN_ID, finalReport, { parse_mode: 'HTML' });

    } catch (error) {
        bot.sendMessage(ADMIN_ID, `❌ Lỗi khi càn quét: ${error.message}`);
    }
});


bot.onText(/\/duatop/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(ADMIN_ID, "⏳ Đang đẩy Bảng Xếp Hạng lên Group...");
    try {
        const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
        if (topUsers.length > 0) {
            let topText = ""; const medals = ['🥇', '🥈', '🥉'];
            topUsers.forEach((u, index) => { topText += `${medals[index]} <b>${u.firstName} ${u.lastName}</b>: Trao ${u.weeklyReferralCount} cơ hội\n`; });
            const msgGroup = `🏆 <b>BẢNG VÀNG ĐẠI SỨ LAN TỎA TUẦN NÀY - BẠN ĐANG Ở ĐÂU?</b> 🏆\n\nHành trình kiến tạo tự do tài chính cùng SWC đang lan tỏa mạnh mẽ:\n\n${topText}\n👉 Đua top tuần này để nhận phần thưởng xứng đáng! 🚀`;
            bot.sendMessage(GROUP_USERNAME, msgGroup, { parse_mode: 'HTML' }).catch(()=>{});
            bot.sendMessage(ADMIN_ID, "✅ Đã nổ Bảng Xếp Hạng Top Tuần lên Group!");
        } else { bot.sendMessage(ADMIN_ID, "⚠️ Tuần này chưa có ai mời được khách!"); }
    } catch (error) { bot.sendMessage(ADMIN_ID, "❌ Lỗi: " + error.message); }
});

bot.onText(/\/soivietien/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(ADMIN_ID, "⏳ Đang bật Radar quét các giao dịch sinh tiền gần nhất...");
    try {
        const recentUsers = await User.find({ $or: [ { lastCheckInDate: { $ne: null } }, { lastDailyTask: { $ne: null } }, { lastShareTask: { $ne: null } } ] }).sort({ lastCheckInDate: -1, lastDailyTask: -1, lastShareTask: -1 }).limit(10);
        if (recentUsers.length === 0) return bot.sendMessage(ADMIN_ID, "⚠️ Hệ thống chưa ghi nhận hoạt động nào gần đây.");
        let response = "🕵️‍♂️ <b>BÁO CÁO: 10 NGƯỜI VỪA CÀY SWGT GẦN NHẤT</b> 🕵️‍♂️\n\n";
        recentUsers.forEach((u, i) => {
            response += `${i + 1}. <b>${u.firstName} ${u.lastName}</b> (ID: <code>${u.userId}</code>)\n💰 Tổng tài sản: <b>${u.balance} SWGT</b>\n⏱ <b>Hoạt động hái ra tiền gần nhất:</b>\n`;
            if (u.lastCheckInDate) response += ` 🔹 Điểm danh: ${new Date(new Date(u.lastCheckInDate).getTime() + 7*3600000).toLocaleString('vi-VN')}\n`;
            if (u.lastDailyTask) response += ` 🔹 Đọc bài web: ${new Date(new Date(u.lastDailyTask).getTime() + 7*3600000).toLocaleString('vi-VN')}\n`;
            if (u.lastShareTask) response += ` 🔹 Chia sẻ MXH: ${new Date(new Date(u.lastShareTask).getTime() + 7*3600000).toLocaleString('vi-VN')}\n`;
            response += `--------------------------\n`;
        });
        bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
    } catch (error) { bot.sendMessage(ADMIN_ID, "❌ Lỗi khi soi ví: " + error.message); }
});

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
                let notifyMsg = `🎉 <b>CÓ NGƯỜI MỚI VỪA BẤM VÀO LINK CỦA BẠN!</b>\n\n` +
                                `👤 <b>Tên đối tác:</b> ${firstName} ${lastName}\n` +
                                `🔗 <b>Trang cá nhân:</b> <a href="tg://user?id=${userId}">Bấm vào đây để xem</a>\n\n` +
                                `⚠️ <b>CHIẾN THUẬT KẾT NỐI:</b>\n` +
                                `Để tránh bị Telegram chặn vì nhắn tin cho người lạ, Bot đã tạo sẵn nút <b>"Liên hệ Người Hướng Dẫn"</b> bên máy của khách để yêu cầu họ nhắn cho bạn trước.\n\n` +
                                `👉 <i>Nếu một lúc sau vẫn chưa thấy họ nhắn, bạn hãy chủ động bấm vào chữ "Bấm vào đây để xem" ở trên, gửi lời chào và hướng dẫn họ làm Nhiệm vụ Tân Binh nhé!</i>`;
                bot.sendMessage(refId, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    } else {
        user.firstName = firstName; user.lastName = lastName; user.username = username; user.isPremium = isPremium;
    }
    await user.save();
    
    let welcomeText = `👋 <b>Chào mừng bạn đến với Cộng Đồng SWC Việt Nam!</b> 🚀\n\nBạn đã bước chân vào trung tâm kết nối của những nhà đầu tư tiên phong. Cơ hội sở hữu trước token SWGT đang ở ngay trước mắt!\n\n👇 <b>HÀNH ĐỘNG NGAY:</b> Bấm nút <b>"MỞ ỨNG DỤNG SWC NGAY"</b> bên dưới để kích hoạt ví và gia tăng tài sản!`;
    if (isNewUser && refId && refId !== userId) { welcomeText = `🎉 <i>Bạn được mời tham gia bởi một Đại sứ SWC!</i>\n\n` + welcomeText; }
    
    let keyboardArray = [
        [{ text: "1️⃣ Nhiệm vụ Tân binh", callback_data: 'task_1' }],
        [{ text: "2️⃣ Lan tỏa Cộng Đồng", callback_data: 'task_3' }],
        [{ text: "🎁 Đặc quyền & Đổi thưởng", callback_data: 'task_4' }],
        [{ text: "❓ Đặt Câu hỏi (FAQ)", callback_data: 'show_faq' }],
        [{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]
    ];

    if (user.referredBy && user.referredBy !== userId) {
        keyboardArray.unshift([
            { text: "💬 LIÊN HỆ NGƯỜI HƯỚNG DẪN CỦA BẠN", url: `tg://user?id=${user.referredBy}` }
        ]);
    }

    const opts = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: keyboardArray
        }
    };
    bot.sendPhoto(chatId, './Bia.jpg', { caption: welcomeText, parse_mode: 'HTML', reply_markup: opts.reply_markup }).catch(err => { bot.sendMessage(chatId, welcomeText, opts); });
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    if (data.startsWith('test_')) {
        if (userId !== ADMIN_ID) return bot.answerCallbackQuery(callbackQuery.id, { text: "⛔ Cấm!" });
        bot.answerCallbackQuery(callbackQuery.id).catch(()=>{});

        const idA = '7515902413'; 
        const idB = '8364834164';

        if (data === 'test_invite') {
            let notifyMsg = `🎉 <b>CÓ NGƯỜI MỚI VỪA BẤM VÀO LINK CỦA BẠN! (TEST)</b>\n\n👤 <b>Tên đối tác:</b> Khách Test\n🔗 <b>Trang cá nhân:</b> <a href="tg://user?id=${idB}">Bấm vào đây để xem</a>\n\n⚠️ <b>CHIẾN THUẬT KẾT NỐI:</b>\nĐể tránh bị Telegram chặn vì nhắn tin cho người lạ, Bot đã tạo sẵn nút <b>"Liên hệ Người Hướng Dẫn"</b> bên máy của khách để yêu cầu họ nhắn cho bạn trước.\n\n👉 <i>Nếu một lúc sau vẫn chưa thấy họ nhắn, bạn hãy chủ động bấm vào chữ "Bấm vào đây để xem" ở trên, gửi lời chào và hướng dẫn họ làm Nhiệm vụ Tân Binh nhé!</i>`;
            bot.sendMessage(idA, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});

            let welcomeText = `🎉 <i>Bạn được mời tham gia bởi một Đại sứ SWC! (TEST)</i>\n\n👋 <b>Chào mừng bạn đến với Cộng Đồng SWC Việt Nam!</b> 🚀\n\nBạn đã bước chân vào trung tâm kết nối của những nhà đầu tư tiên phong. Cơ hội sở hữu trước token SWGT đang ở ngay trước mắt!\n\n👇 <b>HÀNH ĐỘNG NGAY:</b> Bấm nút <b>"MỞ ỨNG DỤNG SWC NGAY"</b> bên dưới để kích hoạt ví và gia tăng tài sản!`;
            let keyboardArray = [
                [{ text: "💬 LIÊN HỆ NGƯỜI HƯỚNG DẪN CỦA BẠN", url: `tg://user?id=${idA}` }],
                [{ text: "1️⃣ Nhiệm vụ Tân binh", callback_data: 'task_1' }],
                [{ text: "2️⃣ Lan tỏa Cộng Đồng", callback_data: 'task_3' }],
                [{ text: "🎁 Đặc quyền & Đổi thưởng", callback_data: 'task_4' }],
                [{ text: "❓ Đặt Câu hỏi (FAQ)", callback_data: 'show_faq' }],
                [{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]
            ];
            bot.sendMessage(idB, welcomeText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboardArray } }).catch(()=>{});
            bot.sendMessage(ADMIN_ID, "✅ Đã gửi kịch bản A mời B thành công!");
        }
        else if (data === 'test_8h') {
            const remindMsg = `☀️ <b>CHÀO BUỔI SÁNG! (TEST)</b>\n\nPhần thưởng điểm danh SWGT ngày hôm nay của bạn đã sẵn sàng.\n\n⚠️ <i>Lưu ý: Nếu bỏ lỡ 1 ngày, chuỗi phần thưởng của bạn sẽ bị quay lại từ Ngày 1.</i>\n\n👉 Hãy bấm <b>"MỞ ỨNG DỤNG ĐIỂM DANH"</b> ở menu bên dưới để nhận nhé!`;
            bot.sendMessage(idB, remindMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ ỨNG DỤNG ĐIỂM DANH", web_app: { url: webAppUrl } }]] } }).catch(()=>{});
            bot.sendMessage(ADMIN_ID, "✅ Đã gửi nhắc điểm danh (8H) cho B.");
        }
        else if (data === 'test_9h') {
            const morningMsg = `☀️ <b>CHÀO BUỔI SÁNG CỘNG ĐỒNG SWC! (TEST)</b>\n\nTin tức và nhận định mới nhất về tiến độ dự án uST đã được cập nhật. Hãy vào Kênh Thông Tin để nắm bắt ngay!\n\n💬 <i>Đừng quên: Mỗi bình luận chia sẻ quan điểm (trên 10 ký tự) trong Group Chat sẽ được hệ thống tự động cộng <b>+0.1 SWGT</b>. Vào chém gió ngay anh em nhé!</i>`;
            let keyboard = [
                [{ text: "🔵 ĐỌC TIN TỨC TRÊN KÊNH", url: `https://t.me/${CHANNEL_USERNAME.replace('@','')}` }],
                [{ text: "💬 VÀO GROUP CHAT NHẬN THƯỞNG", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }]
            ];
            bot.sendMessage(idB, morningMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(()=>{});
            bot.sendMessage(ADMIN_ID, "✅ Đã gửi kịch bản Lùa Traffic 9H Sáng cho B.");
        }
        else if (data === 'test_19h30') {
            const eveningMsg = `🌙 <b>TỔNG KẾT NGÀY DÀI - VÀO GROUP GIAO LƯU NÀO! (TEST)</b>\n\nMột ngày bận rộn sắp khép lại. Mọi người có nhận định gì về thị trường hay các bước đi tiếp theo của SWC không?\n\n👉 Hãy vào Group Cộng Đồng chia sẻ góc nhìn của bạn. Vừa trao đổi kiến thức, vừa nhặt thêm SWGT miễn phí <b>(+0.1 SWGT/tin nhắn)</b>!`;
            let keyboard = [
                [{ text: "💬 VÀO GROUP CHÉM GIÓ NGAY", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }]
            ];
            bot.sendMessage(idB, eveningMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(()=>{});
            bot.sendMessage(ADMIN_ID, "✅ Đã gửi kịch bản Lùa Traffic 19h30 Tối cho B.");
        }
        else if (data === 'test_unlock') {
            let notifyMsg = `🔓 <b>BĂNG ĐÃ TAN! PHẦN THƯỞNG VỀ VÍ! (TEST)</b>\n\nChúc mừng bạn! Có <b>1 đối tác</b> do bạn mời đã vượt qua thử thách 30 ngày. Giải phóng <b>+5 SWGT</b> vào tài khoản.`;
            bot.sendMessage(idA, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});
            bot.sendMessage(ADMIN_ID, "✅ Đã gửi tin nhắn rã đông tiền cho A.");
        }
        else if (data === 'test_leave') {
            let penaltyMsgB = `⚠️ <b>CẢNH BÁO TỪ HỆ THỐNG! (TEST)</b>\nRadar phát hiện bạn đã rời khỏi Cộng Đồng SWC khi chưa đủ 21 ngày gắn bó. Bạn đã bị trừ <b>10 SWGT</b>. Hãy tham gia lại và làm lại nhiệm vụ để khôi phục!`;
            bot.sendMessage(idB, penaltyMsgB, {parse_mode: 'HTML'}).catch(()=>{});

            let notifyReferrerMsg = `⚠️ <b>THÔNG BÁO THU HỒI LƯỢT MỜI! (TEST)</b> ⚠️\n\nThành viên <b>Khách Test</b> do bạn mời vừa <b>RỜI KHỎI</b> mạng lưới Cộng đồng SWC khi chưa gắn bó đủ 21 ngày.\n\n📉 Hệ thống đã tự động thu hồi <b>1 lượt mời</b> và trừ <b>5 SWGT</b> tiền thưởng tương ứng khỏi ví của bạn.`;
            bot.sendMessage(idA, notifyReferrerMsg, {parse_mode: 'HTML'}).catch(()=>{});

            bot.sendMessage(ADMIN_ID, "✅ Đã test kịch bản B rời nhóm (Phạt A và B) thành công!");
        }
        return;
    }

    if (data.startsWith('faq_')) {
        bot.answerCallbackQuery(callbackQuery.id).catch(()=>{});
        let answerText = "";
        if (data === 'faq_1') answerText = `👮  <b>HỎI: Trợ lý này mang lại giá trị gì?</b>\n\n<b>ĐÁP:</b> Bot Đầu Tư Chiến Lược là "vũ khí" giúp bạn tiếp cận các vòng gọi vốn kín...`;
        else if (data === 'faq_2') answerText = `🎁 <b>HỎI: Cách cày SWGT tạo thu nhập thụ động mỗi ngày?</b>\n\n<b>ĐÁP:</b> Mở App điểm danh nhận lãi suất đều đặn...`;
        else if (data === 'faq_3') answerText = `💸 <b>HỎI: Hướng dẫn Chốt lời & Rút tiền ra sao?</b>\n\n<b>ĐÁP:</b> Khi số dư tài sản đạt tối thiểu <b>500 SWGT</b>, bạn có thể chốt lời ngay!...`;
        else if (data === 'faq_4') answerText = `🚀 <b>HỎI: Bí quyết tạo Dòng Tiền lớn với Vốn 0 đồng?</b>\n\n<b>ĐÁP:</b> Mời bạn bè tham gia và nhận SWGT...`;
        else if (data === 'faq_5') answerText = `⏳ <b>HỎI: Thanh khoản và thời gian rút tiền?</b>\n\n<b>ĐÁP:</b> Khóa 7-15 ngày. Đặc quyền cày 1500 SWGT sẽ được rút ngay.`;
        else if (data === 'faq_6') answerText = `💎 <b>HỎI: Các Thương Vụ Đầu Tư Chiến Lược là gì?</b>\n\n<b>ĐÁP:</b> Đầu tư Pre-IPO uST...`;

        bot.sendMessage(chatId, answerText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 M MỞ APP & BẮT ĐẦU TẠO DÒNG TIỀN", web_app: { url: webAppUrl } }]] } });
        return;
    }

    if (data.startsWith('admin_')) {
        if (userId !== ADMIN_ID) return bot.answerCallbackQuery(callbackQuery.id, { text: "⛔ Bạn không có quyền truy cập chức năng này!", show_alert: true });
        bot.answerCallbackQuery(callbackQuery.id).catch(()=>{});

        try {
            if (data === 'admin_checktop') {
                const users = await User.find({ referralCount: { $gt: 0 } }).sort({ referralCount: -1 }).limit(10);
                let response = "🕵️‍♂️ <b>DANH SÁCH TOP 10 TỔNG CỘNG ĐỒNG:</b>\n\n";
                users.forEach((u, index) => { response += `${index + 1}. ${u.firstName} ${u.lastName}\n🆔 ID: <code>${u.userId}</code>\n👥 Mời: ${u.referralCount} | 💰 Dư: ${u.balance}\n--------------------------\n`; });
                bot.sendMessage(ADMIN_ID, response || "Chưa có dữ liệu.", { parse_mode: 'HTML' });
            }
            else if (data === 'admin_toptuan') {
                const users = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(10);
                if (users.length === 0) return bot.sendMessage(ADMIN_ID, "⚠️ Tuần này chưa có ai mời được khách nào.");
                let response = "🏆 <b>BẢNG XẾP HẠNG ĐẠI SỨ TUẦN NÀY:</b>\n\n";
                users.forEach((u, index) => { response += `${index + 1}. ${u.firstName} ${u.lastName} - <b>${u.weeklyReferralCount}</b> khách\n🆔 ID: <code>${u.userId}</code>\n--------------------------\n`; });
                bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
            }
            else if (data === 'admin_thongke') {
                bot.sendMessage(ADMIN_ID, "⏳ Đang quét két sắt...");
                const allUsers = await User.find();
                const nowMs = new Date().getTime();
                let totalAll = 0; let eligibleUsersCount = 0; let totalEligibleDebt = 0; 
                let pendingOver500Count = 0; let pendingOver500Amount = 0; 
                let potentialDebtCount = 0; let potentialDebtAmount = 0; 

                allUsers.forEach(u => {
                    totalAll += u.balance;
                    const lockDays = u.isPremium ? 7 : 15;
                    const joinMs = u.joinDate ? new Date(u.joinDate).getTime() : new Date("2026-02-22T00:00:00Z").getTime();
                    const unlockDateMs = joinMs + (lockDays * 24 * 60 * 60 * 1000);

                    if (u.balance >= 500) {
                        if (nowMs >= unlockDateMs || u.balance >= 1500) { eligibleUsersCount++; totalEligibleDebt += u.balance; } 
                        else { pendingOver500Count++; pendingOver500Amount += u.balance; }
                    } else if (u.balance >= 300) { potentialDebtCount++; potentialDebtAmount += u.balance; }
                });

                const reportMsg = `📊 <b>BÁO CÁO KẾT SẮT CHI TIẾT & DỰ BÁO</b> 📊\n\n` +
                    `👥 <b>Tổng thành viên:</b> ${allUsers.length} người\n💰 <b>Tổng SWGT đã phát:</b> ${totalAll.toFixed(1)} SWGT\n\n` +
                    `🔴 <b>1. NỢ THỰC TẾ:</b>\n- Số người: <b>${eligibleUsersCount}</b>\n- Số tiền: <b>${totalEligibleDebt.toFixed(1)} SWGT</b>\n\n` +
                    `🟠 <b>2. NỢ CHỜ GIẢI PHÓNG:</b>\n- Số người: <b>${pendingOver500Count}</b>\n- Số tiền: <b>${pendingOver500Amount.toFixed(1)} SWGT</b>\n\n` +
                    `🟡 <b>3. NỢ TIỀM NĂNG:</b>\n- Số người: <b>${potentialDebtCount}</b>\n- Số tiền: <b>${potentialDebtAmount.toFixed(1)} SWGT</b>\n\n` +
                    `💎 <b>TỔNG QUY TRÌNH THANH KHOẢN:</b>\nDự kiến cần chuẩn bị khoảng <b>${(totalEligibleDebt + pendingOver500Amount).toFixed(1)} SWGT</b>.`;
                bot.sendMessage(ADMIN_ID, reportMsg, { parse_mode: 'HTML' });
            }
            else if (data === 'admin_soivietien') {
                bot.sendMessage(ADMIN_ID, "⏳ Đang bật Radar quét các giao dịch sinh tiền gần nhất...");
                const recentUsers = await User.find({
                    $or: [ { lastCheckInDate: { $ne: null } }, { lastDailyTask: { $ne: null } }, { lastShareTask: { $ne: null } } ]
                }).sort({ lastCheckInDate: -1, lastDailyTask: -1, lastShareTask: -1 }).limit(10);
                if (recentUsers.length === 0) return bot.sendMessage(ADMIN_ID, "⚠️ Hệ thống chưa ghi nhận hoạt động nào gần đây.");
                let response = "🕵️‍♂️ <b>BÁO CÁO: 10 NGƯỜI VỪA CÀY SWGT GẦN NHẤT</b> 🕵️‍♂️\n\n";
                recentUsers.forEach((u, i) => {
                    response += `${i + 1}. <b>${u.firstName} ${u.lastName}</b> (ID: <code>${u.userId}</code>)\n💰 Tổng tài sản: <b>${u.balance} SWGT</b>\n⏱ <b>Hoạt động gần nhất:</b>\n`;
                    if (u.lastCheckInDate) response += ` 🔹 Điểm danh: ${new Date(new Date(u.lastCheckInDate).getTime() + 7*3600000).toLocaleString('vi-VN')}\n`;
                    if (u.lastDailyTask) response += ` 🔹 Đọc bài web: ${new Date(new Date(u.lastDailyTask).getTime() + 7*3600000).toLocaleString('vi-VN')}\n`;
                    if (u.lastShareTask) response += ` 🔹 Chia sẻ MXH: ${new Date(new Date(u.lastShareTask).getTime() + 7*3600000).toLocaleString('vi-VN')}\n`;
                    response += `--------------------------\n`;
                });
                bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
            }
            else if (data === 'admin_duatop') {
                bot.sendMessage(ADMIN_ID, "✅ Bảng xếp hạng đang được hệ thống đẩy lên Group chính. Vui lòng đợi trong giây lát...");
                const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
                if (topUsers.length > 0) {
                    let topText = ""; const medals = ['🥇', '🥈', '🥉'];
                    topUsers.forEach((u, index) => { topText += `${medals[index]} <b>${u.firstName} ${u.lastName}</b>: Trao ${u.weeklyReferralCount} cơ hội\n`; });
                    const msgGroup = `🏆 <b>BẢNG VÀNG ĐẠI SỨ LAN TỎA TUẦN NÀY - BẠN ĐANG Ở ĐÂU?</b> 🏆\n\nHành trình kiến tạo tự do tài chính cùng SWC đang lan tỏa mạnh mẽ! Hôm nay, những Đại sứ xuất sắc nhất đã tiếp tục trao đi giá trị:\n\n${topText}\n💡 <i>"Thành công lớn nhất không phải là bạn có bao nhiêu tiền, mà là bạn giúp được bao nhiêu người trở nên giàu có."</i>\n\n👉 Đua top tuần này để nhận phần thưởng xứng đáng! 🚀`;
                    bot.sendMessage(GROUP_USERNAME, msgGroup, { parse_mode: 'HTML' }).catch(()=>{});
                }
            }
            else if (data === 'admin_help_tracuu') {
                bot.sendMessage(ADMIN_ID, `🔍 <b>TRA CỨU THÔNG TIN 1 NGƯỜI DÙNG</b>\n\n<i>👉 Chạm vào lệnh dưới đây để copy, dán ra khung chat và điền ID của người đó vào cuối (nhớ có dấu cách):</i>\n\n<code>/tracuu </code>`, { parse_mode: 'HTML' });
            }
            else if (data === 'admin_help_cheat') {
                bot.sendMessage(ADMIN_ID, `👮 <b>CÔNG CỤ XỬ LÝ GIAN LẬN (ANTI-CHEAT)</b>\n\n1. Soi danh sách khách của 1 người:\n<code>/checkref </code>\n2. Lọc & xóa vĩnh viễn nick ảo:\n<code>/locref </code>\n3. Phạt nặng (Trừ tiền & Ref ảo):\n<code>/phat </code>\n4. Đối soát & giải thích (Nhẹ nhàng):\n<code>/resetref </code>\n5. Chỉnh thông số thủ công:\n<code>/setref [ID] [Lượt_mời] [Tiền]</code>`, { parse_mode: 'HTML' });
            }
            else if (data === 'admin_help_mkt') {
                bot.sendMessage(ADMIN_ID, `🎁 <b>CÔNG CỤ MARKETING & THÔNG BÁO</b>\n\n1. Gửi Broadcast:\n<code>/sendall [Nội_dung_tin_nhắn]</code>\n2. Tạo mã Giftcode:\n<code>/createcode [MÃ_CODE] [Số_SWGT] [Số_Lượt]</code>\n3. Xóa mã Giftcode:\n<code>/deletecode [MÃ_CODE]</code>`, { parse_mode: 'HTML' });
            }
        } catch (error) { bot.sendMessage(ADMIN_ID, "❌ Lỗi Menu Admin: " + error.message); }
        return; 
    }

    let user = await User.findOne({ userId: userId });
    if (!user) return bot.answerCallbackQuery(callbackQuery.id);

    if (data === 'task_1') {
        const opts = { parse_mode: 'HTML', reply_markup: { inline_keyboard: [ [{ text: "🔵 Join Kênh Thông tin", url: "https://t.me/swc_capital_vn" }], [{ text: "💬 Join Group Cộng Đồng", url: "https://t.me/swc_capital_chat" }], [{ text: "✅ KIỂM TRA & NHẬN THƯỞNG", callback_data: 'check_join' }] ] } };
        const totalReward = 10;
        const task1Text = `🎯 <b>BƯỚC 1: LẤY VỐN KHỞI NGHIỆP</b>\n\nHoàn thành ngay để "bỏ túi" <b>15 SWGT</b> đầu tiên:\n\n1️⃣ <b>Join Kênh & Group Cộng Đồng SWC Việt Nam</b> (+10 SWGT).\n\n2️⃣ <b>Gửi tin nhắn chào hỏi</b> lên Group để xác minh.\n👉 <i>Chạm vào khung bên dưới để tự động copy câu chào, sau đó ấn nút Join Group để dán và gửi:</i>\n\n<code>Xin chào cả nhà, mình là thành viên mới, rất vui được làm quen với cộng đồng đầu tư</code>\n\n3️⃣ <b>Mở App Kết nối Ví Crypto</b> (+5 SWGT).\n\n⚠️ <i>Lưu ý: Rời nhóm = Trừ sạch điểm số!</i>`;
        bot.sendMessage(chatId, task1Text, opts);
    } 
    else if (data === 'check_join') {
        const status = await checkMembership(userId);
        if (status.error) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bot chưa được cấp quyền Admin trong Nhóm/Kênh!", show_alert: true });
        } else if (status.inChannel && status.inGroup) {
            if (user.groupMessageCount < 1) {
                bot.answerCallbackQuery(callbackQuery.id, { text: `❌ TÀI KHOẢN CHƯA XÁC MINH!\n\nBạn đã vào nhóm nhưng chưa gửi tin nhắn chào hỏi nào.\n\nHãy vào Nhóm dán câu chào rồi quay lại kiểm tra nhé!`, show_alert: true });
            } else {
                if (!user.task1Done) {
                    const selfReward = 10;
                    user.balance += selfReward; user.task1Done = true; await user.save();
                    
                    if (user.referredBy) {
                        let referrer = await User.findOne({ userId: user.referredBy });
                        if (referrer) {
                            const refReward = 5;
                            const isNewAccount = parseInt(user.userId) >= 6500000000;

                            if (!isNewAccount) {
                                referrer.balance = Math.round((referrer.balance + refReward) * 100) / 100;
                                referrer.referralCount += 1;
                                referrer.weeklyReferralCount = (referrer.weeklyReferralCount || 0) + 1;
                                await referrer.save();

                                let rankUpMsg = "";
                                switch (referrer.referralCount) {
                                    case 3:   rankUpMsg = "🎖 <b>THĂNG CẤP: ĐẠI ÚY</b>"; break;
                                    case 10:  rankUpMsg = "🎖 <b>THĂNG CẤP: THIẾU TÁ</b>"; break;
                                    case 20:  rankUpMsg = "🎖 <b>THĂNG CẤP: TRUNG TÁ</b>"; break;
                                    case 50:  rankUpMsg = "🎖 <b>THĂNG CẤP: THƯỢNG TÁ</b>"; break;
                                    case 80:  rankUpMsg = "🎖 <b>THĂNG CẤP: ĐẠI TÁ</b>"; break;
                                    case 120: rankUpMsg = "🌟 <b>THĂNG CẤP: THIẾU TƯỚNG</b>"; break;
                                    case 200: rankUpMsg = "🌟🌟 <b>THĂNG CẤP: TRUNG TƯỚNG</b>"; break;
                                    case 350: rankUpMsg = "🌟🌟🌟 <b>THĂNG CẤP: THƯỢNG TƯỚNG</b>"; break;
                                    case 500: rankUpMsg = "🌟🌟🌟🌟 <b>THĂNG CẤP: ĐẠI TƯỚNG</b>"; break;
                                }

                                let notifyMsg = `🎉 <b>BẠN NHẬN ĐƯỢC +${refReward} SWGT!</b>\n\nĐối tác <b>${user.firstName}</b> do bạn mời đã hoàn thành nhiệm vụ Tân Binh.\nTổng mời hiện tại: ${referrer.referralCount} người.`;
                                if (rankUpMsg) notifyMsg += `\n\n${rankUpMsg}\n🛑 <b>CHÚC MỪNG! CÓ QUÀ THĂNG HẠNG!</b> Hãy mở App nhận ngay phần thưởng nóng!`;
                                bot.sendMessage(user.referredBy, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});
                            } else {
                                const unlockDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 ngày
                                referrer.pendingRefs.push({ refereeId: user.userId, unlockDate: unlockDate, reward: refReward });
                                await referrer.save();
                                let notifyPendingMsg = `⏳ <b>GHI NHẬN LƯỢT MỜI BỊ ĐÓNG BĂNG (30 NGÀY)</b>\n\nThành viên <b>${user.firstName}</b> do bạn mời đã hoàn thành nhiệm vụ.\n\n⚠️ <i>Hệ thống Anti-Cheat phát hiện đây là tài khoản Telegram mới khởi tạo. Để chống gian lận (Tool/Clone), phần thưởng <b>+${refReward} SWGT</b> và <b>1 Lượt mời</b> của bạn sẽ bị đóng băng 30 ngày!</i>`;
                                bot.sendMessage(user.referredBy, notifyPendingMsg, {parse_mode: 'HTML'}).catch(()=>{});
                            }
                        }
                    }

                    bot.answerCallbackQuery(callbackQuery.id, { text: `🎉 Tuyệt vời! Xác minh thành công, +${selfReward} SWGT.`, show_alert: true });
                    bot.sendMessage(chatId, `🔥 <b>XÁC MINH TÀI KHOẢN THÀNH CÔNG!</b>\n\nHệ thống đã ghi nhận bạn là Nhà đầu tư thật.\n🎁 <b>Phần thưởng:</b> +${selfReward} SWGT.\n\n👉 <i>Bấm mở App ngay để kết nối ví nhận thêm +5 SWGT nữa nhé!</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]] }});
                    
                } else {
                    bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã hoàn thành nhiệm vụ này và nhận thưởng rồi nhé!", show_alert: true });
                }
            }
        } else { bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Bạn chưa tham gia đủ Kênh và Nhóm. Hãy làm ngay kẻo mất phần thưởng!", show_alert: true }); }
    }
    
    // Nút task_2 đã được gỡ khỏi Kịch bản, giữ lại xử lý nhẹ phòng người dùng click nút cũ
    else if (data === 'task_2') {
        bot.sendMessage(chatId, `⚠️ <b>THÔNG BÁO:</b>\n\nChương trình Nhiệm vụ cá nhân (Đọc bài, Chia sẻ) đã kết thúc.\n\nHiện tại bạn có thể kiếm SWGT bằng cách:\n1. Điểm danh hàng ngày trên App.\n2. Mời bạn bè tham gia.\n3. Chat và chia sẻ quan điểm trong Group Cộng Đồng (+0.1 SWGT/tin nhắn).`, { parse_mode: 'HTML' });
    } 

    else if (data === 'task_3') {
        const inviteReward = 5; 
        const textTask3 = `💎 <b>CHẶNG 2: LAN TỎA GIÁ TRỊ - KIẾN TẠO DI SẢN</b>\n\n` +
                          `<i>"Của cho không bằng cách cho. Chúng ta không đi thuyết phục người tham gia, chúng ta đang trao cơ hội nắm giữ cổ phần công nghệ giao thông uST trước khi nó trở thành kỳ lân!"</i>\n\n` +
                          `🤝 Bạn đã trao cơ hội thành công cho: <b>${user.referralCount || 0} đối tác</b>.\n\n` +
                          `🔗 <b>Đường dẫn trao đặc quyền của bạn:</b>\nhttps://t.me/Dau_Tu_SWC_bot?start=${userId}\n\n` +
                          `🎁 <b>QUÀ TẶNG TRI ÂN TỪ HỆ THỐNG:</b>\n` +
                          `- Nhận tri ân <b>+${inviteReward} SWGT</b> cho mỗi đối tác bạn giúp đỡ kích hoạt thành công.\n` +
                          `- Mở khóa Quỹ Thưởng Đặc Quyền khi đạt các mốc vinh danh.\n\n` +
                          `👉 <b>MỞ APP VÀO MỤC PHẦN THƯỞNG ĐỂ ĐUA TOP NGAY!</b>`;
        bot.sendMessage(chatId, textTask3, { parse_mode: 'HTML' });
    } 
    
    else if (data === 'task_4') {
        const task4Text = `🏆 <b>KHO LƯU TRỮ ĐẶC QUYỀN VIP</b>\n\nSWGT là quyền lực của bạn! Dùng số dư quy đổi lấy "vũ khí" thực chiến:\n\n🔓 <b>1. Mở Khóa Group Private (8000 SWGT)</b>\n☕️ <b>2. Cà Phê Chiến Lược 1:1 (6000 SWGT)</b>\n🎟 <b>3. Voucher Ưu Đãi Đầu Tư (9000 SWGT)</b>\n\n👉 <i>Bấm mở App để quy đổi!</i>`;
        bot.sendMessage(chatId, task4Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP ĐỂ QUY ĐỔI", web_app: { url: webAppUrl } }]] }});
    }

    const validCallbacks = ['check_join', 'task_1', 'task_2', 'task_3', 'task_4', 'show_faq'];
    if (!data.startsWith('admin_') && !data.startsWith('test_') && !validCallbacks.includes(data)) {
        bot.answerCallbackQuery(callbackQuery.id);
    }
});

bot.on('message', async (msg) => {
    // 1. ADMIN REPLY LỆNH DUYỆT BILL HOẶC RÚT TIỀN / TRẢ LỜI KHÁCH
    if (msg.from && msg.from.id.toString() === ADMIN_ID && msg.reply_to_message) {
        const replyText = msg.text ? msg.text.toLowerCase() : (msg.caption ? msg.caption.toLowerCase() : '');
        const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || "";
        const idMatch = originalText.match(/ID:\s*(\d+)/); 
        
        if (idMatch) {
            const targetUserId = idMatch[1];
            const targetUser = await User.findOne({ userId: targetUserId });
            
            // Xử lý Admin duyệt Bill nạp tiền
            if (originalText.includes('BILL NẠP TIỀN') && (replyText.includes('xong') || replyText.includes('nạp xong'))) {
                if (targetUser && targetUser.topUpStatus === 'awaiting_admin') {
                    targetUser.balance = Math.round((targetUser.balance + targetUser.pendingSWGT) * 100) / 100;
                    targetUser.topUpStatus = 'none';
                    await targetUser.save();

                    const successMsg = `✅ <b>NẠP TIỀN THÀNH CÔNG!</b>\n\nTài khoản của bạn đã được cộng thêm <b>${targetUser.pendingSWGT} SWGT</b>. Tổng số dư hiện tại là <b>${targetUser.balance} SWGT</b>.\n\n👉 <b>BẠN CÓ MUỐN RÚT SWGT NGAY KHÔNG?</b>\nHãy mở App và vào mục Ví để thực hiện rút Token về ví cá nhân nhé!`;
                    
                    bot.sendMessage(targetUser.userId, successMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP RÚT TIỀN", web_app: { url: webAppUrl } }]] } }).catch(()=>{});
                    bot.sendMessage(ADMIN_ID, `✅ Đã duyệt Bill và cộng đủ 500 SWGT cho khách ${targetUser.firstName}.`);
                } else {
                    bot.sendMessage(ADMIN_ID, `⚠️ Lỗi: Khách này không có trạng thái chờ duyệt hoặc đã được duyệt rồi.`);
                }
                return;
            }

            // Xử lý Admin duyệt Rút tiền / Đổi quà
            if ((replyText.includes('xong') || replyText.includes('done')) && (originalText.includes('YÊU CẦU') || originalText.includes('RÚT TIỀN') || originalText.includes('ĐỔI QUÀ') || originalText.includes('THANH LÝ'))) {
                const successMsg = `🚀 <b>ĐẦU TƯ CHIẾN LƯỢC SWC - YÊU CẦU HOÀN TẤT!</b>\n\nChào <b>${targetUser ? targetUser.firstName : 'bạn'}</b>, Admin đã kiểm duyệt thành công và thực hiện chuyển lệnh cho bạn!\n\n🎉 <b>TRẠNG THÁI:</b> GIAO DỊCH THÀNH CÔNG!\n🌈 Cảm ơn bạn đã luôn tin tưởng và đồng hành cùng Cộng đồng SWC.`;
                if (msg.photo) {
                    const photoId = msg.photo[msg.photo.length - 1].file_id; 
                    bot.sendPhoto(targetUserId, photoId, { caption: successMsg, parse_mode: 'HTML' }).catch(()=>{});
                } else { bot.sendMessage(targetUserId, successMsg, {parse_mode: 'HTML'}).catch(()=>{}); }
                bot.sendMessage(ADMIN_ID, `✅ Đã gửi thông báo hoàn tất cho khách.`);
                return; 
            }

            // Xử lý Admin Reply trực tiếp tin nhắn chat của khách (PHỤC HỒI)
            if (originalText.includes('TIN NHẮN TỪ KHÁCH HÀNG')) {
                const adminReplyMsg = `👨‍💻 <b>Phản hồi từ Admin SWC:</b>\n\n${msg.text || msg.caption || '[File/Ảnh đính kèm]'}`;
                if (msg.photo) {
                    const photoId = msg.photo[msg.photo.length - 1].file_id;
                    bot.sendPhoto(targetUserId, photoId, { caption: adminReplyMsg, parse_mode: 'HTML' }).catch(()=>{});
                } else { bot.sendMessage(targetUserId, adminReplyMsg, { parse_mode: 'HTML' }).catch(()=>{}); }
                bot.sendMessage(ADMIN_ID, `✅ Đã gửi câu trả lời cho khách hàng.`);
                return;
            }
        }
    }

    // 2. KHÁCH NHẮN TIN CHO BOT
    if (msg.chat.type === 'private' && msg.from.id.toString() !== ADMIN_ID && !msg.from.is_bot) {
        if (msg.text && msg.text.startsWith('/')) return;
        const userId = msg.from.id.toString();
        let user = await User.findOne({ userId: userId });

        // Khách gửi Ảnh (Bắt Bill chuyển khoản)
        if (msg.photo && user && user.topUpStatus === 'waiting_bill') {
            user.topUpStatus = 'awaiting_admin';
            await user.save();

            bot.sendMessage(userId, `⏳ <b>ĐÃ NHẬN BILL CHUYỂN KHOẢN</b>\n\nBot đã chuyển biên lai của bạn tới Admin để kiểm tra. Số dư sẽ tự động được cộng sau 1-3 phút. Vui lòng không gửi lại để tránh trôi lệnh!`, {parse_mode: 'HTML'}).catch(()=>{});

            const photoId = msg.photo[msg.photo.length - 1].file_id;
            const adminCaption = `🚨 <b>BILL NẠP TIỀN (GHÉP VỐN)</b>\n\n👤 Khách: ${user ? user.firstName : ''} ${user ? user.lastName : ''}\n🆔 ID: <code>${user ? user.userId : userId}</code>\n💰 Số lượng khách mua: <b>${user ? user.pendingSWGT : 0} SWGT</b>\n\n👉 <i>Admin hãy kiểm tra App Techcombank. Nếu đã nhận được tiền, hãy REPLY (Trả lời) bức ảnh này và gõ chữ <b>"xong"</b>. Bot sẽ tự động cộng tiền cho khách và mời khách rút SWGT!</i>`;
            bot.sendPhoto(ADMIN_ID, photoId, { caption: adminCaption, parse_mode: 'HTML' }).catch(()=>{});
            return; 
        }

        // Nếu gửi text/ảnh bình thường (PHỤC HỒI NÚT LIÊN HỆ NGƯỜI HƯỚNG DẪN)
        const name = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
        const username = msg.from.username ? `@${msg.from.username}` : 'Không có';
        const content = msg.text || msg.caption || '[Khách gửi Tệp/Ảnh/Video]';
        
        const alertMsg = `📩 <b>TIN NHẮN TỪ KHÁCH HÀNG</b>\n\n👤 Khách: <b>${name}</b>\n🔗 Username: ${username}\n🆔 ID: <code>${userId}</code>\n\n💬 <b>Nội dung:</b>\n${content}\n\n👉 <i>Admin hãy Reply (Trả lời) tin nhắn này để chat lại với khách nhé!</i>`;
        const replyMarkupAdmin = { inline_keyboard: [[{ text: "💬 Chat trực tiếp với khách", url: `tg://user?id=${userId}` }]] };
        
        if (msg.photo) {
            bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, { caption: alertMsg, parse_mode: 'HTML', reply_markup: replyMarkupAdmin }).catch(()=>{});
        } else { bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML', reply_markup: replyMarkupAdmin }).catch(()=>{}); }

        // Khôi phục lại menu FAQ và nút Liên hệ
        let faqKeyboard = [
            [{ text: "💬 VÀO GROUP CHAT CỘNG ĐỒNG NGAY", url: "https://t.me/swc_capital_chat" }],
            [{ text: "👮 Trợ lý này mang lại giá trị gì?", callback_data: 'faq_1' }],
            [{ text: "🚀 Bí quyết tạo Dòng Tiền với Vốn 0đ?", callback_data: 'faq_4' }],
            [{ text: "🎁 Cách cày SWGT tạo thu nhập thụ động?", callback_data: 'faq_2' }],
            [{ text: "💸 Hướng dẫn Chốt lời & Rút tiền", callback_data: 'faq_3' }],
            [{ text: "⏳ Thanh khoản & Thời gian rút tiền?", callback_data: 'faq_5' }]
        ];

        if (user && user.referredBy && user.referredBy !== userId) {
            faqKeyboard.unshift([
                { text: "💬 LIÊN HỆ NGƯỜI HƯỚNG DẪN CỦA BẠN", url: `tg://user?id=${user.referredBy}` }
            ]);
        }

        const autoReplyMsg = `👋 Chào <b>${name}</b>, hệ thống đã ghi nhận yêu cầu của bạn và chuyển đến Ban Tổ Chức. Vui lòng chờ Admin phản hồi nhé!\n\n👇 <b>HOẶC XEM NHANH CÁC BÍ MẬT TÀI CHÍNH DƯỚI ĐÂY:</b>`;
        const faqMenu = { parse_mode: 'HTML', reply_markup: { inline_keyboard: faqKeyboard } };
        
        bot.sendMessage(userId, autoReplyMsg, faqMenu).catch(()=>{});
        return; 
    }

    // 3. TÍNH TIỀN CHAT TRONG GROUP
    if (msg.chat.type === 'private' || msg.from.is_bot) return;
    if (msg.chat.username && msg.chat.username.toLowerCase() !== GROUP_USERNAME.replace('@', '').toLowerCase()) return;

    try {
        const member = await bot.getChatMember(msg.chat.id, msg.from.id);
        if (['administrator', 'creator'].includes(member.status)) return;
    } catch(e) {}

    if (!msg.text) return;
    const userId = msg.from.id.toString();
    const isPremium = msg.from.is_premium || false;
    let user = await User.findOne({ userId: userId });
    
    if (!user) {
        user = new User({ userId: userId, firstName: msg.from.first_name || '', lastName: msg.from.last_name || '', username: msg.from.username ? `@${msg.from.username}` : '', isPremium: isPremium });
    } else { user.isPremium = isPremium; }

    user.groupMessageCount += 1; 
    if (msg.text.trim().length >= 10) { user.balance = Math.round((user.balance + 0.1) * 100) / 100; }
    await user.save();
});

bot.on('chat_member', async (update) => {
    const debugUser = update.new_chat_member.user;
    const chat = update.chat;
    const chatUsername = chat.username ? chat.username.toLowerCase() : '';
    const targetChannel = CHANNEL_USERNAME.replace('@', '').toLowerCase();
    const targetGroup = GROUP_USERNAME.replace('@', '').toLowerCase();
    if (chatUsername !== targetChannel && chatUsername !== targetGroup) return; 

    const newStatus = update.new_chat_member.status;
    const oldStatus = update.old_chat_member.status;
    const leftUserId = update.new_chat_member.user.id.toString();

    if ((oldStatus === 'member' || oldStatus === 'restricted' || oldStatus === 'administrator') && 
        (newStatus === 'left' || newStatus === 'kicked')) {
        let leftUser = await User.findOne({ userId: leftUserId });
        if (leftUser && leftUser.task1Done) {
            const joinDate = new Date(leftUser.joinDate || Date.now());
            const daysSinceJoin = (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceJoin <= 21) {
                const penalty = 10;
                leftUser.balance = Math.max(0, leftUser.balance - penalty); leftUser.task1Done = false; 
                if (leftUser.referredBy) {
                    let referrer = await User.findOne({ userId: leftUser.referredBy });
                    if (referrer) {
                        const refPenalty = 5; 
                        referrer.balance = Math.max(0, referrer.balance - refPenalty);
                        referrer.referralCount = Math.max(0, referrer.referralCount - 1);
                        referrer.weeklyReferralCount = Math.max(0, (referrer.weeklyReferralCount || 0) - 1);
                        
                        const dCount = referrer.referralCount;
                        if (dCount < 500) referrer.milestone500 = false;
                        if (dCount < 350) referrer.milestone350 = false;
                        if (dCount < 200) referrer.milestone200 = false;
                        if (dCount < 120) referrer.milestone120 = false;
                        if (dCount < 80) referrer.milestone80 = false;
                        if (dCount < 50) referrer.milestone50 = false;
                        if (dCount < 20) referrer.milestone20 = false;
                        if (dCount < 10) referrer.milestone10 = false;
                        if (dCount < 3) referrer.milestone3 = false;

                        await referrer.save();
                        let notifyReferrerMsg = `⚠️ <b>THÔNG BÁO THU HỒI LƯỢT MỜI!</b> ⚠️\n\nThành viên <b>${leftUser.firstName} ${leftUser.lastName}</b> do bạn mời vừa <b>RỜI KHỎI</b> mạng lưới Cộng đồng SWC khi chưa gắn bó đủ 21 ngày.\n\n📉 Hệ thống đã tự động thu hồi <b>1 lượt mời</b> và trừ <b>${refPenalty} SWGT</b> tiền thưởng tương ứng khỏi ví của bạn.`;
                        bot.sendMessage(referrer.userId, notifyReferrerMsg, {parse_mode: 'HTML'}).catch(()=>{});
                    }
                }
                await leftUser.save();
                bot.sendMessage(leftUserId, `⚠️ <b>CẢNH BÁO TỪ HỆ THỐNG!</b>\nRadar phát hiện bạn đã rời khỏi Cộng Đồng SWC khi chưa đủ 21 ngày gắn bó. Bạn đã bị trừ <b>${penalty} SWGT</b>. Hãy tham gia lại và làm lại nhiệm vụ để khôi phục!`, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    }
});
