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
            // FIX: Bắt buộc dùng JSON.stringify để Telegram API nhận diện đúng danh sách
            allowed_updates: JSON.stringify(["message", "callback_query", "chat_member", "my_chat_member"])
        }
    }
});
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
    weeklyReferralCount: { type: Number, default: 0 }, // TÍNH NĂNG MỚI: Đếm lượt mời theo tuần
    
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
// TÍNH NĂNG TỰ ĐỘNG NHẮC NHỞ ĐIỂM DANH LÚC 8H SÁNG (GIỜ VN)
// ==========================================
setInterval(async () => {
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const vnHour = vnTime.getUTCHours();
    const vnMinute = vnTime.getUTCMinutes();

    if (vnHour === 8 && vnMinute === 0) {
        console.log('Bắt đầu gửi thông báo nhắc điểm danh sáng...');
        const todayStr = vnTime.toDateString(); 
        const users = await User.find({});
        
        for (let user of users) {
            let lastCheckinStr = '';
            if (user.lastCheckInDate) {
                const lastCheckinVN = new Date(new Date(user.lastCheckInDate).getTime() + (7 * 60 * 60 * 1000));
                lastCheckinStr = lastCheckinVN.toDateString();
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
// TÍNH NĂNG TỰ ĐỘNG BÁO CÁO ĐUA TOP LAN TỎA LÚC 20H TỐI (GIỜ VN) - ĐÃ CẬP NHẬT THEO TUẦN
// ==========================================
setInterval(async () => {
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const vnHour = vnTime.getUTCHours();
    const vnMinute = vnTime.getUTCMinutes();

    if (vnHour === 20 && vnMinute === 0) {
        console.log('Bắt đầu gửi thông báo đua top lan tỏa...');
        try {
            const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
            if (topUsers.length > 0) {
                let topText = "";
                const medals = ['🥇', '🥈', '🥉'];
                topUsers.forEach((u, index) => {
                    topText += `${medals[index]} <b>${u.firstName} ${u.lastName}</b>: Trao ${u.weeklyReferralCount} cơ hội\n`;
                });

                const msg = `🏆 <b>BẢNG VÀNG ĐẠI SỨ LAN TỎA TUẦN NÀY - BẠN ĐANG Ở ĐÂU?</b> 🏆\n\n` +
                            `Hành trình kiến tạo tự do tài chính cùng Cộng đồng SWC đang lan tỏa mạnh mẽ hơn bao giờ hết! Hôm nay, những Đại sứ xuất sắc nhất đã tiếp tục trao đi giá trị, giúp thêm hàng chục người anh em bước chân vào bệ phóng thịnh vượng này:\n\n` +
                            `${topText}\n` +
                            `💡 <i>"Thành công lớn nhất không phải là bạn có bao nhiêu tiền, mà là bạn giúp được bao nhiêu người trở nên giàu có."</i>\n\n` +
                            `👉 Hãy copy <b>Đường dẫn đặc quyền</b> của bạn trong Bot và gửi cho những người bạn trân quý nhất ngay tối nay nhé! Đua top tuần này để nhận phần thưởng xứng đáng! 🚀`;
                
                bot.sendMessage(GROUP_USERNAME, msg, { parse_mode: 'HTML' }).catch(()=>{});
            }
        } catch (error) { console.error("Lỗi gửi thông báo Top:", error); }
        
        await new Promise(resolve => setTimeout(resolve, 60000));
    }
}, 30000);

// ==========================================
// TÍNH NĂNG MỚI: TỰ ĐỘNG CHỐT TOP TUẦN & RESET VÀO 23:59 CHỦ NHẬT
// ==========================================
setInterval(async () => {
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const vnDay = vnTime.getUTCDay(); // 0 là Chủ Nhật
    const vnHour = vnTime.getUTCHours();
    const vnMinute = vnTime.getUTCMinutes();

    // Chạy đúng vào 23h59 phút tối Chủ Nhật
    if (vnDay === 0 && vnHour === 23 && vnMinute === 59) {
        console.log('Bắt đầu chốt Top Tuần...');
        try {
            const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
            if (topUsers.length > 0) {
                let topText = "";
                const medals = ['🥇', '🥈', '🥉'];
                topUsers.forEach((u, index) => {
                    topText += `${medals[index]} <b>${u.firstName} ${u.lastName}</b>: Mời ${u.weeklyReferralCount} khách\n`;
                });

                const msg = `🏆 <b>TỔNG KẾT ĐẠI SỨ LAN TỎA TUẦN NÀY</b> 🏆\n\n` +
                            `Khép lại một tuần hoạt động bùng nổ, xin vinh danh những chiến binh xuất sắc nhất đã mang cơ hội SWC đến với nhiều đối tác nhất trong tuần qua:\n\n` +
                            `${topText}\n` +
                            `🔄 <i>Hệ thống sẽ tự động Reset bộ đếm số lượt mời của tuần này về 0. Hãy chuẩn bị sẵn sàng cho một cuộc đua mới công bằng cho tất cả mọi người vào Thứ Hai nhé!</i>\n\n` +
                            `👉 <b>Chúc các Đại sứ một tuần mới bùng nổ doanh số! 🚀</b>`;
                
                bot.sendMessage(GROUP_USERNAME, msg, { parse_mode: 'HTML' }).catch(()=>{});
            }
            
            // TỰ ĐỘNG RESET TOÀN BỘ TOP TUẦN VỀ 0
            await User.updateMany({}, { $set: { weeklyReferralCount: 0 } });
            console.log('✅ Đã reset xong Top Tuần!');
            
        } catch (error) { console.error("Lỗi chốt Top Tuần:", error); }
        
        await new Promise(resolve => setTimeout(resolve, 60000)); // Nghỉ 1 phút để không bị lặp lại
    }
}, 30000);

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
    // API: TỰ BẤM NHẬN THƯỞNG MỐC + BÁO CÁO GROUP
    else if (parsedUrl.pathname === '/api/claim-milestone' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                let reward = 0;
                let rankTitle = "";
                
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

                    const promoteMsg = `🎖️ <b>THĂNG CẤP QUÂN HÀM!</b> 🎖️\n\nChúc mừng đồng chí <b>${user.firstName} ${user.lastName}</b> vừa xuất sắc cán mốc <b>${data.milestone} đồng đội</b>.\n\n⭐ Cấp bậc mới: <b>${rankTitle}</b>\n💰 Thưởng nóng: <b>+${reward} SWGT</b>\n\n👉 <i>Tiếp tục chiến đấu để lên hàm Tướng nào!</i>`;
                    bot.sendMessage(GROUP_USERNAME, promoteMsg, {parse_mode: 'HTML'}).catch(()=>{});

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward }));
                } else {
                    res.writeHead(400); res.end(JSON.stringify({ success: false, message: "Chưa đủ điều kiện hoặc đã nhận rồi!" }));
                }
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    // API: ĐIỂM DANH
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

                const streakRewards = { 1: 0.5, 2: 1.5, 3: 3, 4: 3.5, 5: 5, 6: 7, 7: 9 };
                const reward = streakRewards[user.checkInStreak] || 0.5;

                user.balance = Math.round((user.balance + reward) * 10) / 10; 
                user.lastCheckInDate = new Date(); 
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
    // API: ĐỔI QUÀ VIP
    else if (parsedUrl.pathname === '/api/redeem' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (user && user.balance >= data.cost) {
                    const userNotify = `⏳ Yêu cầu đổi: <b>${data.itemName}</b> đang được xử lý!`;
                    bot.sendMessage(data.userId, userNotify, {parse_mode: 'HTML'}).catch(()=>{});
                    
                    const reportMsg = `🎁 <b>YÊU CẦU ĐỔI QUÀ</b>\nKhách: ${user.firstName} (ID: <code>${user.userId}</code>)\nQuà: ${data.itemName}\nVí: ${user.wallet || 'Chưa cập nhật'}\n💰 Đang có: ${user.balance} SWGT (Check đủ >= ${data.cost})\n\n👉 <a href="tg://user?id=${user.userId}">BẤM VÀO ĐÂY ĐỂ CHAT VỚI KHÁCH</a>`;
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
    // API: YÊU CẦU RÚT TIỀN
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
    // API: BẢNG XẾP HẠNG
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

// =========================================================
// 👮 BỘ CÔNG CỤ CẢNH SÁT TRƯỞNG & QUẢN LÝ (Dành riêng cho Admin)
// =========================================================

// 1. Xem Top 10 Tổng + Lấy ID
bot.onText(/\/checktop/, async (msg) => {
    if (msg.chat.type !== 'private' || msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({ referralCount: { $gt: 0 } }).sort({ referralCount: -1 }).limit(10);
    let response = "🕵️‍♂️ <b>DANH SÁCH TOP 10 TỔNG CỘNG ĐỒNG (KÈM ID):</b>\n\n";
    users.forEach((u, index) => {
        response += `${index + 1}. ${u.firstName} ${u.lastName}\n`;
        response += `🆔 ID: <code>${u.userId}</code>\n`;
        response += `👥 Mời: ${u.referralCount} | 💰 Dư: ${u.balance}\n`;
        response += `--------------------------\n`;
    });
    bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
});

// TÍNH NĂNG MỚI: Xem Top Tuần hiện tại
bot.onText(/\/toptuan/, async (msg) => {
    if (msg.chat.type !== 'private' || msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(10);
    
    if (users.length === 0) return bot.sendMessage(ADMIN_ID, "⚠️ Tuần này chưa có ai mời được khách nào.");
    
    let response = "🏆 <b>BẢNG XẾP HẠNG ĐẠI SỨ TUẦN NÀY:</b>\n\n";
    users.forEach((u, index) => {
        response += `${index + 1}. ${u.firstName} ${u.lastName} - <b>${u.weeklyReferralCount}</b> khách\n`;
        response += `🆔 ID: <code>${u.userId}</code>\n`;
        response += `--------------------------\n`;
    });
    bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
});

// 2. Soi danh sách Ref của 1 người cụ thể (BẢN NÂNG CẤP CÓ THỐNG KÊ)
bot.onText(/\/checkref (\d+)/, async (msg, match) => {
    if (msg.chat.type !== 'private' || msg.from.id.toString() !== ADMIN_ID) return;
    
    const targetId = match[1];
    bot.sendMessage(ADMIN_ID, "⏳ Đang trích xuất và thống kê dữ liệu...");

    const refs = await User.find({ referredBy: targetId }).sort({ joinDate: -1 });
    
    if (refs.length === 0) {
        return bot.sendMessage(ADMIN_ID, "❌ Tài khoản này chưa mời được ai bấm vào link.");
    }

    // -- PHẦN MỚI: ĐẾM SỐ LƯỢNG --
    let doneCount = 0;
    let notDoneCount = 0;
    refs.forEach(r => {
        if (r.task1Done) {
            doneCount++;
        } else {
            notDoneCount++;
        }
    });

    // -- TẠO BẢN BÁO CÁO --
    let response = `🕵️‍♂️ <b>BÁO CÁO CHI TIẾT ID: <code>${targetId}</code></b>\n`;
    response += `📊 <b>Tổng số đã bấm link:</b> ${refs.length} người\n`;
    response += `✅ <b>Đã hoàn thành NV:</b> ${doneCount} người\n`;
    response += `❌ <b>Chưa làm NV (Nick rác):</b> ${notDoneCount} người\n`;
    response += `--------------------------\n`;
    response += `📝 <b>Danh sách chi tiết (50 người mới nhất):</b>\n\n`;
    
    const displayRefs = refs.slice(0, 50); 
    
    displayRefs.forEach((r, index) => {
        const status = r.task1Done ? "✅ Đã Join" : "❌ Chưa xong NV";
        response += `${index + 1}. <b>${r.firstName} ${r.lastName}</b>\n`;
        response += `   Trạng thái: ${status} | ID: <code>${r.userId}</code>\n`;
    });

    if (refs.length > 50) response += `\n<i>... và ${refs.length - 50} người khác.</i>`;

    bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
});

// TỰ ĐỘNG RESET REF, TRỪ TIỀN VÀ GỬI THÔNG BÁO THUYẾT PHỤC
bot.onText(/\/resetref (\d+)/, async (msg, match) => {
    if (msg.chat.type !== 'private' || msg.from.id.toString() !== ADMIN_ID) return;
    
    const targetId = match[1];
    bot.sendMessage(ADMIN_ID, "⏳ Đang tự động quét, trừ tiền và gửi thông báo...");

    const refs = await User.find({ referredBy: targetId });
    let referrer = await User.findOne({ userId: targetId });

    if (!referrer) {
        return bot.sendMessage(ADMIN_ID, "❌ Không tìm thấy thông tin người này trong hệ thống.");
    }

    // 1. Phân loại Thật - Ảo
    let doneCount = 0;
    let notDoneCount = 0;

    refs.forEach(r => {
        if (r.task1Done) doneCount++;
        else notDoneCount++;
    });

    if (notDoneCount === 0) {
        return bot.sendMessage(ADMIN_ID, "✅ Tài khoản này rất sạch, 100% khách đã làm nhiệm vụ, không có gì để trừ.");
    }

    // 2. Tính toán khấu trừ (Mặc định trừ 10 SWGT cho 1 nick ảo)
    const penalty = notDoneCount * 10; 
    const oldBal = referrer.balance;
    const oldRef = referrer.referralCount;

    // 3. Cập nhật lại Database
    referrer.referralCount = doneCount;
    referrer.balance = Math.max(0, referrer.balance - penalty); // Không cho âm tiền

    // Thu hồi các mốc Quân hàm nếu số Ref thật bị rớt xuống dưới mốc
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

    // 4. Báo cáo lại cho Admin
    let adminMsg = `✅ <b>ĐÃ XỬ LÝ XONG ID: <code>${targetId}</code></b>\n\n`;
    adminMsg += `📉 <b>Lượt mời:</b> ${oldRef} ➡️ <b>${doneCount}</b>\n`;
    adminMsg += `💸 <b>Số dư SWGT:</b> ${oldBal} ➡️ <b>${referrer.balance}</b> (Đã trừ ${penalty} SWGT)\n\n`;
    adminMsg += `<i>Bot đã tự động gửi tin nhắn giải thích cho họ!</i>`;
    bot.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'HTML' });

    // 5. Gửi thông báo cực kỳ thuyết phục cho Người vi phạm
    let userMsg = `⚠️ <b>THÔNG BÁO TỪ HỆ THỐNG KIỂM DUYỆT SWC</b> ⚠️\n\n`;
    userMsg += `Chào <b>${referrer.firstName}</b>, hệ thống Anti-Cheat của chúng tôi vừa tiến hành quét và đối soát dữ liệu lượt giới thiệu của bạn.\n\n`;
    userMsg += `📊 <b>Kết quả đối soát:</b>\n`;
    userMsg += `- Tổng người đã bấm link: <b>${refs.length}</b> người\n`;
    userMsg += `- Số người dùng thật (Đã Join Group): <b>${doneCount}</b> người\n`;
    userMsg += `- Số tài khoản ảo/chưa làm NV: <b>${notDoneCount}</b> người\n\n`;
    userMsg += `⚖️ <b>Quyết định xử lý:</b>\n`;
    userMsg += `Để đảm bảo công bằng cho toàn bộ cộng đồng, hệ thống <b>chỉ trả thưởng cho các tài khoản hợp lệ (đã vào Group và Chat xác minh)</b>.\n\n`;
    userMsg += `🔄 Lượt mời của bạn đã được hệ thống cập nhật về đúng thực tế là: <b>${doneCount} người</b>.\n`;
    userMsg += `💸 Số dư SWGT cũng đã được tự động khấu trừ phần thưởng từ ${notDoneCount} tài khoản chưa hợp lệ.\n\n`;
    userMsg += `💡 <i><b>Lưu ý:</b> Những người bạn mời vẫn có thể tiếp tục làm nhiệm vụ. Bất cứ khi nào họ vào Group xác minh thành công, bạn sẽ tự động được cộng lại phần thưởng. Hãy hướng dẫn họ hoàn tất nhé!</i>\n\n`;
    userMsg += `Trân trọng!`;

    bot.sendMessage(targetId, userMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

// Lọc nick ảo và tính lại Ref chuẩn
bot.onText(/\/locref (\d+)/, async (msg, match) => {
    if (msg.chat.type !== 'private' || msg.from.id.toString() !== ADMIN_ID) return;
    
    const targetId = match[1];
    bot.sendMessage(ADMIN_ID, "⏳ Đang quét và dọn dẹp dữ liệu rác...");

    // 1. Tìm tất cả những người được mời bởi targetId
    const allRefs = await User.find({ referredBy: targetId });
    
    if (allRefs.length === 0) {
        return bot.sendMessage(ADMIN_ID, "❌ Tài khoản này không có ai bấm vào link.");
    }

    let realCount = 0;
    let fakeCount = 0;
    let fakeIds = [];

    // 2. Phân loại Thật/Ảo
    allRefs.forEach(r => {
        if (r.task1Done) {
            realCount++;
        } else {
            fakeCount++;
            fakeIds.push(r._id); // Lưu ID của nick ảo trong DB
        }
    });

    // 3. Xóa sổ các nick ảo khỏi Database
    if (fakeIds.length > 0) {
        await User.deleteMany({ _id: { $in: fakeIds } });
    }

    // 4. Cập nhật lại User chính
    let user = await User.findOne({ userId: targetId });
    let oldRef = 0;
    if (user) {
        oldRef = user.referralCount;
        user.referralCount = realCount; // Trả về con số thật
        await user.save();
    }

    let response = `✅ <b>LỌC REF THÀNH CÔNG CHO ID: <code>${targetId}</code></b>\n\n`;
    response += `🗑 <b>Đã xóa vĩnh viễn:</b> ${fakeCount} nick rác (Chưa làm nhiệm vụ).\n`;
    response += `✅ <b>Giữ lại:</b> ${realCount} nick thật (Đã Join Group).\n\n`;
    response += `📉 <b>Cập nhật lượt mời:</b> ${oldRef} ➡️ <b>${realCount}</b> người.\n\n`;
    response += `⚠️ <b>Lưu ý về Tiền:</b> Số lượt mời đã chuẩn. Bây giờ bạn hãy nhẩm tính số tiền thực tế họ đáng được nhận, rồi dùng lệnh <code>/setref ${targetId} ${realCount} [Số_tiền_chuẩn]</code> để trừ đi số tiền ảo họ đang có nhé!`;

    bot.sendMessage(ADMIN_ID, response, { parse_mode: 'HTML' });
});

// 3. Phạt gian lận (Đã sửa: Chỉ trừ nick ảo và tiền ảo)
bot.onText(/\/phat (\d+)/, async (msg, match) => {
    if (msg.chat.type !== 'private' || msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1];
    bot.sendMessage(ADMIN_ID, "⏳ Đang quét dữ liệu gian lận để xử phạt...");

    const user = await User.findOne({ userId: targetId });
    if (!user) return bot.sendMessage(ADMIN_ID, "❌ Không tìm thấy User ID này!");

    const refs = await User.find({ referredBy: targetId });
    
    let doneCount = 0;
    let notDoneCount = 0;

    refs.forEach(r => {
        if (r.task1Done) doneCount++;
        else notDoneCount++;
    });

    if (notDoneCount === 0) {
        return bot.sendMessage(ADMIN_ID, "⚠️ Tài khoản này không có nick ảo nào để phạt!");
    }

    const oldRef = user.referralCount;
    const oldBal = user.balance;

    // Trừ chính xác 10 SWGT cho mỗi nick ảo
    const penalty = notDoneCount * 10; 

    user.referralCount = doneCount; 
    user.balance = Math.max(0, user.balance - penalty); 
    
    // Thu hồi quân hàm nếu tụt hạng do bị trừ nick ảo
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

    // Báo cáo cho Admin
    bot.sendMessage(ADMIN_ID, `✅ <b>ĐĐÃ THỰC THI CÔNG LÝ!</b>\n\n👤 Đối tượng: ${user.firstName} ${user.lastName}\n📉 Ref: ${oldRef} ➡️ <b>${doneCount}</b> (Đã xóa ${notDoneCount} nick ảo)\n💸 Số dư: ${oldBal} ➡️ <b>${user.balance}</b> (Đã thu hồi ${penalty} SWGT)\n\n<i>Đã gửi tin nhắn cảnh cáo dằn mặt!</i>`, { parse_mode: 'HTML' });
    
    // Gửi tin nhắn dằn mặt đối tượng
    let userMsg = `⚠️ <b>CẢNH BÁO VI PHẠM TỪ HỆ THỐNG!</b> ⚠️\n\n`;
    userMsg += `Hệ thống phát hiện tài khoản của bạn có hành vi sử dụng Tool/Clone để tạo lượt mời ảo nhằm trục lợi.\n\n`;
    userMsg += `👮‍♂️ <b>Quyết định xử phạt:</b>\n`;
    userMsg += `- Xóa bỏ <b>${notDoneCount}</b> lượt mời không hợp lệ (Chưa xác minh).\n`;
    userMsg += `- Thu hồi <b>${penalty} SWGT</b> gian lận từ các nick ảo.\n\n`;
    userMsg += `Lượt mời của bạn đã được đưa về đúng số người thật (<b>${doneCount} người</b>). Nếu bạn tiếp tục có hành vi gian lận, tài khoản sẽ bị khóa vĩnh viễn!`;
    
    bot.sendMessage(targetId, userMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

// 4. Set số liệu thủ công
bot.onText(/\/setref (\d+) (\d+) (\d+)/, async (msg, match) => {
    if (msg.chat.type !== 'private' || msg.from.id.toString() !== ADMIN_ID) return;
    const targetId = match[1]; const newRef = parseInt(match[2]); const newBal = parseFloat(match[3]);
    let user = await User.findOne({ userId: targetId });
    if (!user) return bot.sendMessage(ADMIN_ID, "❌ Không tìm thấy User!");
    user.referralCount = newRef; user.balance = newBal; await user.save();
    bot.sendMessage(ADMIN_ID, `✅ Đã chỉnh sửa thủ công:\nUser ${targetId} -> Ref: ${newRef}, Balance: ${newBal}`);
});

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

// Đẩy thông báo đua top thủ công (Cập nhật thành Top Tuần)
bot.onText(/\/duatop/, async (msg) => {
    if (msg.chat.type !== 'private' || msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(ADMIN_ID, "⏳ Đang lấy dữ liệu Top Tuần và đẩy Bảng Xếp Hạng lên Group...");
    try {
        const topUsers = await User.find({ weeklyReferralCount: { $gt: 0 } }).sort({ weeklyReferralCount: -1 }).limit(3);
        if (topUsers.length > 0) {
            let topText = "";
            const medals = ['🥇', '🥈', '🥉'];
            topUsers.forEach((u, index) => { topText += `${medals[index]} <b>${u.firstName} ${u.lastName}</b>: Trao ${u.weeklyReferralCount} cơ hội\n`; });

            const msgGroup = `🏆 <b>BẢNG VÀNG ĐẠI SỨ LAN TỎA TUẦN NÀY - BẠN ĐANG Ở ĐÂU?</b> 🏆\n\n` +
                             `Hành trình kiến tạo tự do tài chính cùng Cộng đồng SWC đang lan tỏa mạnh mẽ hơn bao giờ hết! Hôm nay, những Đại sứ xuất sắc nhất đã tiếp tục trao đi giá trị, giúp thêm hàng chục người anh em bước chân vào bệ phóng thịnh vượng này:\n\n` +
                             `${topText}\n` +
                             `💡 <i>"Thành công lớn nhất không phải là bạn có bao nhiêu tiền, mà là bạn giúp được bao nhiêu người trở nên giàu có."</i>\n\n` +
                             `👉 Hãy copy <b>Đường dẫn đặc quyền</b> của bạn trong Bot và gửi cho những người bạn trân quý nhất ngay hôm nay nhé! Đua top tuần này để nhận phần thưởng xứng đáng! 🚀`;
            
            bot.sendMessage(GROUP_USERNAME, msgGroup, { parse_mode: 'HTML' }).catch(()=>{});
            bot.sendMessage(ADMIN_ID, "✅ Đã nổ Bảng Xếp Hạng Top Tuần lên Group thành công!");
        } else {
            bot.sendMessage(ADMIN_ID, "⚠️ Tuần này chưa có thành viên nào mời được khách để xếp hạng!");
        }
    } catch (error) { bot.sendMessage(ADMIN_ID, "❌ Lỗi: " + error.message); }
});

// --- 3. XỬ LÝ LỆNH /start (BẢO VỆ CHỐNG CHEAT & KHÔNG TRẢ THƯỞNG NGAY) ---
bot.onText(/\/start(.*)/, async (msg, match) => {
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
        
        // --- CHỐNG CHEAT: CHỈ LƯU NGƯỜI GIỚI THIỆU, KHÔNG CỘNG TIỀN NGAY ---
        if (refId && refId !== userId) {
            user.referredBy = refId;
            let referrer = await User.findOne({ userId: refId });
            if (referrer) {
                // ĐÃ SỬA LẠI CÂU CHÀO GIỐNG CŨ NHƯNG THÊM LƯU Ý
                let notifyMsg = `🎉 <b>CÓ NGƯỜI MỚI THAM GIA!</b>\n\n` +
                                `👤 <b>Tên:</b> ${firstName} ${lastName}\n` +
                                `🆔 <b>ID:</b> <code>${userId}</code>\n` +
                                `Đã bấm vào link mời của bạn!\n\n` +
                                `⚠️ <b>LƯU Ý QUAN TRỌNG:</b>\nHãy nhắn tin hướng dẫn họ làm "Nhiệm vụ Tân binh" (Join Group & Chat) để hệ thống xác minh tài khoản thật. Ngay sau khi họ hoàn tất, bạn sẽ được cộng thưởng SWGT và tính 1 lượt mời thành công nhé!`;
                bot.sendMessage(refId, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    } else {
        user.firstName = firstName; user.lastName = lastName; user.username = username; user.isPremium = isPremium;
    }
    await user.save();
    
    // --- TIN NHẮN CHÀO MỪNG ---
    let welcomeText = `👋 <b>Chào mừng bạn đến với Cộng Đồng SWC Việt Nam!</b> 🚀\n\nBạn đã bước chân vào trung tâm kết nối của những nhà đầu tư tiên phong. Cơ hội sở hữu trước token SWGT và đón đầu xu hướng công nghệ giao thông uST đang ở ngay trước mắt!\n\n🎁 <b>Quà tặng Tân Binh:</b> Nhận ngay những đồng SWGT đầu tiên hoàn toàn miễn phí.\n\n👇 <b>HÀNH ĐỘNG NGAY:</b> Bấm nút <b>"MỞ ỨNG DỤNG SWC NGAY"</b> bên dưới để kích hoạt ví và gia tăng tài sản!`;
    
    if (isNewUser && refId && refId !== userId) {
        welcomeText = `🎉 <i>Bạn được mời bởi ID: ${refId}</i>\n\n` + welcomeText;
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
    
    bot.sendPhoto(chatId, './Bia.jpg', { caption: welcomeText, parse_mode: 'HTML', reply_markup: opts.reply_markup }).catch(err => { bot.sendMessage(chatId, welcomeText, opts); });
});

// --- 4. CAMERA CHẠY NGẦM & MESSAGE HANDLER ---
bot.on('message', async (msg) => {
    // ==========================================
    // A. XỬ LÝ ADMIN DUYỆT LỆNH BẰNG CHỮ "XONG" & TRẢ LỜI KHÁCH HÀNG
    // ==========================================
    if (msg.from && msg.from.id.toString() === ADMIN_ID && msg.reply_to_message) {
        const replyText = msg.text ? msg.text.toLowerCase() : (msg.caption ? msg.caption.toLowerCase() : '');
        const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || "";
        const idMatch = originalText.match(/ID:\s*(\d+)/); 
        
        if (idMatch) {
            const targetUserId = idMatch[1];
            const targetUser = await User.findOne({ userId: targetUserId });
            
            // TRƯỜNG HỢP 1: DUYỆT RÚT TIỀN/ĐỔI QUÀ
            if ((replyText.includes('xong') || replyText.includes('done')) && 
                (originalText.includes('YÊU CẦU') || originalText.includes('RÚT TIỀN') || originalText.includes('ĐỔI QUÀ'))) {
                
                const successMsg = `🚀 <b>ĐẦU TƯ CHIẾN LƯỢC SWC - YÊU CẦU HOÀN TẤT!</b>\n\nChào <b>${targetUser ? targetUser.firstName : 'bạn'}</b>, Admin đã kiểm duyệt thành công và thực hiện chuyển lệnh cho bạn!\n\n🎉 <b>TRẠNG THÁI:</b> GIAO DỊCH THÀNH CÔNG!\n🌈 Cảm ơn bạn đã luôn tin tưởng và đồng hành cùng Cộng đồng SWC. Hãy kiểm tra ví và tiếp tục lan tỏa dự án nhé! 🚀`;
                
                if (msg.photo) {
                    const photoId = msg.photo[msg.photo.length - 1].file_id; 
                    bot.sendPhoto(targetUserId, photoId, { caption: successMsg, parse_mode: 'HTML' }).catch(()=>{});
                } else {
                    bot.sendMessage(targetUserId, successMsg, {parse_mode: 'HTML'}).catch(()=>{});
                }
                
                // Hiệu ứng FOMO lên Group
                if (originalText.includes('RÚT TIỀN')) {
                    const amountMatch = originalText.match(/Số lượng.*:\s*([0-9,\.]+)\s*SWGT/);
                    const amount = amountMatch ? amountMatch[1] : '...';
                    
                    let rankTitle = "Tân Binh 🚀";
                    if (targetUser) {
                        const refCount = targetUser.referralCount || 0;
                        if (refCount >= 500) rankTitle = "Đại Tướng 🌟🌟🌟🌟";
                        else if (refCount >= 350) rankTitle = "Thượng Tướng 🌟🌟🌟";
                        else if (refCount >= 200) rankTitle = "Trung Tướng 🌟🌟";
                        else if (refCount >= 120) rankTitle = "Thiếu Tướng 🌟";
                        else if (refCount >= 80) rankTitle = "Đại Tá 🎖️";
                        else if (refCount >= 50) rankTitle = "Thượng Tá 🎖️";
                        else if (refCount >= 20) rankTitle = "Trung Tá 🎖️";
                        else if (refCount >= 10) rankTitle = "Thiếu Tá 🎖️";
                        else if (refCount >= 3) rankTitle = "Đại Úy 🎖️";
                    }
                    
                    const userName = targetUser ? `${targetUser.firstName} ${targetUser.lastName}`.trim() : 'Thành viên';
                    const fomoGroupMsg = `🔥🔥 <b>TING TING! VÍ LẠI NỔ THÊM LẦN NỮA!</b> 🔥🔥\n\n` +
                                         `Quá đẳng cấp! Chúc mừng <b>${rankTitle} ${userName}</b> vừa "bỏ túi" thành công <b>${amount} SWGT</b> thẳng về ví cá nhân! 💸\n\n` +
                                         `Người thật việc thật, bill chuyển nóng hổi! Những đồng SWGT vô giá đang liên tục tìm thấy chủ nhân!\n\n` +
                                         `👀 <i>Còn bạn thì sao? Sẽ đứng nhìn ${userName} lấy thưởng hay tự mình hành động?</i>\n` +
                                         `👉 <b>Vào Bot làm nhiệm vụ và lấy Link đặc quyền ngay! Cơ hội x10 tài sản không chờ đợi ai!</b> 🚀👇`;
                    
                    const optsFomo = { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 VÀO BOT CÀY SWGT NGAY", url: `https://t.me/Dau_Tu_SWC_bot` }]] } };

                    if (msg.photo) {
                        const photoId = msg.photo[msg.photo.length - 1].file_id;
                        bot.sendPhoto(GROUP_USERNAME, photoId, { caption: fomoGroupMsg, ...optsFomo }).catch(()=>{});
                    } else {
                        bot.sendMessage(GROUP_USERNAME, fomoGroupMsg, optsFomo).catch(()=>{});
                    }
                }
                bot.sendMessage(ADMIN_ID, `✅ Đã gửi thông báo cho khách hàng (ID: ${targetUserId}).`);
                return; 
            }
            
            // TRƯỜNG HỢP 2: ADMIN TRẢ LỜI TIN NHẮN TỪ KHÁCH HÀNG
            else if (originalText.includes('TIN NHẮN TỪ KHÁCH HÀNG')) {
                const adminReplyMsg = `👨‍💻 <b>Phản hồi từ Admin SWC:</b>\n\n${msg.text || msg.caption || '[File/Ảnh đính kèm]'}`;
                if (msg.photo) {
                    const photoId = msg.photo[msg.photo.length - 1].file_id;
                    bot.sendPhoto(targetUserId, photoId, { caption: adminReplyMsg, parse_mode: 'HTML' }).catch(()=>{});
                } else {
                    bot.sendMessage(targetUserId, adminReplyMsg, { parse_mode: 'HTML' }).catch(()=>{});
                }
                bot.sendMessage(ADMIN_ID, `✅ Đã gửi câu trả lời cho khách hàng (ID: ${targetUserId}).`);
                return;
            }
        }
    }

    // ==========================================
    // B. XỬ LÝ KHÁCH HÀNG NHẮN TIN CHO BOT (CHUYỂN TIẾP VỀ ADMIN)
    // ==========================================
    if (msg.chat.type === 'private' && msg.from.id.toString() !== ADMIN_ID && !msg.from.is_bot) {
        // Bỏ qua các lệnh có dấu / (như /start)
        if (msg.text && msg.text.startsWith('/')) return;

        const userId = msg.from.id.toString();
        const name = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
        const username = msg.from.username ? `@${msg.from.username}` : 'Không có';
        const content = msg.text || msg.caption || '[Khách gửi Tệp/Ảnh/Video]';

        const alertMsg = `📩 <b>TIN NHẮN TỪ KHÁCH HÀNG</b>\n\n👤 Khách: <b>${name}</b>\n🔗 Username: ${username}\n🆔 ID: <code>${userId}</code>\n\n💬 <b>Nội dung:</b>\n${content}\n\n👉 <i>Admin hãy Reply (Trả lời) tin nhắn này để chat lại với khách nhé! Hoặc bấm nút bên dưới để vào chat trực tiếp.</i>`;

        const replyMarkup = {
            inline_keyboard: [[{ text: "💬 Chat trực tiếp với khách", url: `tg://user?id=${userId}` }]]
        };

        if (msg.photo) {
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            bot.sendPhoto(ADMIN_ID, photoId, { caption: alertMsg, parse_mode: 'HTML', reply_markup: replyMarkup }).catch(()=>{});
        } else {
            bot.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'HTML', reply_markup: replyMarkup }).catch(()=>{});
        }
        
        return; // Dừng luồng ở đây để không bị chạy xuống phần tính tiền Group
    }

    // ==========================================
    // D. XỬ LÝ CỘNG TIỀN KHI CHAT TƯƠNG TÁC TẠI GROUP CHÍNH
    // ==========================================
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
    // Cộng 0.1 SWGT mỗi tin nhắn dài hơn 10 ký tự
    if (msg.text.trim().length >= 10) { user.balance = Math.round((user.balance + 0.1) * 100) / 100; }
    await user.save();
});

// ==========================================
// MENU ĐIỀU KHIỂN DÀNH CHO ADMIN (/admin hoặc /menu)
// ==========================================
bot.onText(/^\/(admin|menu)/i, async (msg) => {
    // Chỉ cần đúng ID là Admin, bỏ qua các điều kiện rườm rà khác!
    if (msg.from.id.toString() !== ADMIN_ID) return;

    const adminText = `👨‍💻 <b>BẢNG ĐIỀU KHIỂN QUẢN TRỊ (ADMIN PANEL)</b>\n\nXin chào Boss! Hãy chọn chức năng bạn muốn sử dụng bên dưới. Đối với các lệnh cần nhập ID, bot sẽ gửi cú pháp để bạn ấn copy nhanh.`;
    
    const adminMenu = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Xem Top 10 Tổng", callback_data: 'admin_checktop' }, { text: "🏆 Xem Top Tuần", callback_data: 'admin_toptuan' }],
                [{ text: "🚀 Nổ Bảng Xếp Hạng Lên Group", callback_data: 'admin_duatop' }],
                [{ text: "👮 Xử Lý Gian Lận (Anti-Cheat)", callback_data: 'admin_help_cheat' }],
                [{ text: "🎁 Tạo Code & Broadcast", callback_data: 'admin_help_mkt' }]
            ]
        }
    };
    
    bot.sendMessage(msg.chat.id, adminText, adminMenu).catch(err => console.log("Lỗi gửi menu:", err));
});

// --- 5. XỬ LÝ NÚT BẤM (CÓ TÍCH HỢP TRẢ THƯỞNG REF & MENU ADMIN) ---
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    // ==========================================
    // A. KHỐI XỬ LÝ DÀNH RIÊNG CHO MENU ADMIN (BẤM NÚT)
    // ==========================================
    if (data.startsWith('admin_')) {
        if (userId !== ADMIN_ID) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "⛔ Bạn không có quyền truy cập chức năng này!", show_alert: true });
        }
        
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
            else if (data === 'admin_help_cheat') {
                const text = `👮 <b>CÔNG CỤ XỬ LÝ GIAN LẬN (ANTI-CHEAT)</b>\n\n<i>👉 Chạm vào lệnh dưới đây để tự động Copy, sau đó dán ra khung chat và điền ID vào cuối:</i>\n\n1. Soi danh sách khách của 1 người:\n<code>/checkref </code>\n\n2. Lọc & xóa vĩnh viễn nick ảo:\n<code>/locref </code>\n\n3. Phạt nặng (Trừ tiền & Ref ảo):\n<code>/phat </code>\n\n4. Đối soát & giải thích (Nhẹ nhàng):\n<code>/resetref </code>\n\n5. Chỉnh thông số thủ công:\n<code>/setref [ID] [Lượt_mời] [Tiền]</code>`;
                bot.sendMessage(ADMIN_ID, text, { parse_mode: 'HTML' });
            }
            else if (data === 'admin_help_mkt') {
                const text = `🎁 <b>CÔNG CỤ MARKETING & THÔNG BÁO</b>\n\n<i>👉 Chạm vào lệnh dưới đây để tự động Copy, sau đó dán ra khung chat và điền thông tin:</i>\n\n1. Tạo mã Giftcode:\n<code>/createcode [MÃ_CODE] [Số_SWGT] [Số_Lượt]</code>\n<i>VD:</i> <code>/createcode VIP500 500 10</code>\n\n2. Xóa mã Giftcode:\n<code>/deletecode [MÃ_CODE]</code>\n\n3. Gửi tin nhắn Broadcast toàn hệ thống:\n<code>/sendall [Nội_dung_tin_nhắn]</code>`;
                bot.sendMessage(ADMIN_ID, text, { parse_mode: 'HTML' });
            }
        } catch (error) {
            bot.sendMessage(ADMIN_ID, "❌ Lỗi Menu Admin: " + error.message);
        }
        
        return; // QUAN TRỌNG: Lệnh này chặn không cho code chạy tiếp xuống phần User
    }

    // ==========================================
    // B. KHỐI XỬ LÝ NHIỆM VỤ CHO USER BÌNH THƯỜNG
    // ==========================================
    let user = await User.findOne({ userId: userId });
    if (!user) return bot.answerCallbackQuery(callbackQuery.id);

    if (data === 'task_1') {
        const opts = { parse_mode: 'HTML', reply_markup: { inline_keyboard: [ [{ text: "🔵 Join Kênh Thông tin", url: "https://t.me/swc_capital_vn" }], [{ text: "💬 Join Group Cộng Đồng", url: "https://t.me/swc_capital_chat" }], [{ text: "✅ KIỂM TRA & NHẬN THƯỞNG", callback_data: 'check_join' }] ] } };
        const totalReward = user.isPremium ? 40 : 20;
        const task1Text = `🎯 <b>BƯỚC 1: LẤY VỐN KHỞI NGHIỆP</b>\n\nHoàn thành ngay để "bỏ túi" <b>${totalReward + 10} SWGT</b> đầu tiên:\n\n1️⃣ <b>Join Kênh & Group Cộng Đồng SWC Việt Nam</b> (+${totalReward} SWGT).\n\n2️⃣ <b>Gửi tin nhắn chào hỏi</b> lên Group để xác minh.\n👉 <i>Chạm vào khung bên dưới để tự động copy câu chào, sau đó ấn nút Join Group để dán và gửi:</i>\n\n<code>Xin chào cả nhà, mình là thành viên mới, rất vui được làm quen với cộng đồng đầu tư</code>\n\n3️⃣ <b>Mở App Kết nối Ví Crypto</b> (+10 SWGT).\n\n⚠️ <i>Lưu ý: Rời nhóm = Trừ sạch điểm số!</i>`;
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
                    const selfReward = user.isPremium ? 40 : 20;
                    user.balance += selfReward; 
                    user.task1Done = true;
                    await user.save();
                    
                    if (user.referredBy) {
                        let referrer = await User.findOne({ userId: user.referredBy });
                        if (referrer) {
                            const refReward = referrer.isPremium ? 20 : 10;
                            referrer.balance = Math.round((referrer.balance + refReward) * 100) / 100;
                            referrer.referralCount += 1;
                            referrer.weeklyReferralCount = (referrer.weeklyReferralCount || 0) + 1;
                            
                            await referrer.save();

                            let rankUpMsg = "";
                            switch (referrer.referralCount) {
                                case 3:   rankUpMsg = "🎖 <b>THĂNG CẤP: ĐẠI ÚY</b> (Đã mở khóa mốc 3)"; break;
                                case 10:  rankUpMsg = "🎖 <b>THĂNG CẤP: THIẾU TÁ</b> (Đã mở khóa mốc 10)"; break;
                                case 20:  rankUpMsg = "🎖 <b>THĂNG CẤP: TRUNG TÁ</b> (Đã mở khóa mốc 20)"; break;
                                case 50:  rankUpMsg = "🎖 <b>THĂNG CẤP: THƯỢNG TÁ</b> (Đã mở khóa mốc 50)"; break;
                                case 80:  rankUpMsg = "🎖 <b>THĂNG CẤP: ĐẠI TÁ</b> (Đã mở khóa mốc 80)"; break;
                                case 120: rankUpMsg = "🌟 <b>THĂNG CẤP: THIẾU TƯỚNG</b> (Đã mở khóa mốc 120)"; break;
                                case 200: rankUpMsg = "🌟🌟 <b>THĂNG CẤP: TRUNG TƯỚNG</b> (Đã mở khóa mốc 200)"; break;
                                case 350: rankUpMsg = "🌟🌟🌟 <b>THĂNG CẤP: THƯỢNG TƯỚNG</b> (Đã mở khóa mốc 350)"; break;
                                case 500: rankUpMsg = "🌟🌟🌟🌟 <b>THĂNG CẤP: ĐẠI TƯỚNG</b> (Đã mở khóa mốc 500)"; break;
                            }

                            let notifyMsg = `🎉 <b>BẠN NHẬN ĐƯỢC +${refReward} SWGT!</b>\n\nĐối tác <b>${user.firstName}</b> do bạn mời đã hoàn thành nhiệm vụ Tân Binh.\nTổng mời hiện tại: ${referrer.referralCount} người.`;
                            if (rankUpMsg) {
                                notifyMsg += `\n\n${rankUpMsg}\n🛑 <b>CHÚC MỪNG! CÓ QUÀ THĂNG HẠNG!</b> Hãy mở App nhận ngay phần thưởng nóng!`;
                            }
                            bot.sendMessage(user.referredBy, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});
                        }
                    }

                    bot.answerCallbackQuery(callbackQuery.id, { text: `🎉 Tuyệt vời! Xác minh thành công, +${selfReward} SWGT.`, show_alert: true });
                    bot.sendMessage(chatId, `🔥 <b>XÁC MINH TÀI KHOẢN THÀNH CÔNG!</b>\n\nHệ thống đã ghi nhận bạn là Nhà đầu tư thật.\n🎁 <b>Phần thưởng:</b> +${selfReward} SWGT.\n\n👉 <i>Bấm mở App ngay để kết nối ví nhận thêm +10 SWGT nữa nhé!</i>\n\n👇 <i>Nhiệm vụ tiếp theo sẽ được tự động mở sau 2 giây...</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]] }});
                    
                    setTimeout(() => {
                        const task2Text = `🧠 <b>BƯỚC 2: NẠP KIẾN THỨC & LAN TỎA</b>\n\n` +
                                          `<b>1. NGUỒN VỐN TRÍ TUỆ (+10 SWGT/Ngày)</b>\n` +
                                          `⏱ Bấm đọc bài viết bất kỳ trên web đủ 60 giây.\n\n` +
                                          `<b>2. SỨ GIẢ LAN TỎA (+15 SWGT/Ngày)</b>\n` +
                                          `📢 Bấm nút Chia sẻ dự án đến bạn bè/nhóm.\n\n` +
                                          `▶️ <b>3. CỘNG ĐỒNG YOUTUBE (+5 SWGT - 1 Lần)</b>\n` + 
                                          `🎥 Bấm Xem video và đợi ít nhất 6 giây.\n\n` +
                                          `📘 <b>4. THEO DÕI FANPAGE (+5 SWGT - 1 Lần)</b>\n` + 
                                          `👍 Bấm Mở Fanpage và nhấn Theo dõi.\n\n` +
                                          `👇 <b>BẤM NÚT DƯỚI ĐỂ LÀM NGAY:</b>`;
                        bot.sendMessage(chatId, task2Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [ [{ text: "📖 ĐỌC BÀI VIẾT (Đợi 60s)", callback_data: 'go_read' }], [{ text: "🎁 NHẬN THƯỞNG ĐỌC BÀI", callback_data: 'claim_read' }], [{ text: "▶️ XEM YOUTUBE (Đợi 6s)", callback_data: 'go_youtube' }], [{ text: "🎁 NHẬN THƯỞNG YOUTUBE", callback_data: 'claim_youtube' }], [{ text: "📘 THEO DÕI FANPAGE", callback_data: 'go_facebook' }], [{ text: "🎁 NHẬN THƯỞNG FANPAGE", callback_data: 'claim_facebook' }], [{ text: "📢 CHIA SẺ MXH (Đợi 5s)", callback_data: 'go_share' }], [{ text: "🎁 NHẬN THƯỞNG CHIA SẺ", callback_data: 'claim_share' }], [{ text: "⬇️ XEM TIẾP BƯỚC 3 (TĂNG TỐC)", callback_data: 'task_3' }] ] } });
                    }, 2000);

                } else {
                    bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã hoàn thành nhiệm vụ này và nhận thưởng rồi nhé!", show_alert: true });
                    bot.sendMessage(chatId, "✅ Bạn đã làm xong bước này rồi! Chuyển sang bước 2 nhé.", { reply_markup: { inline_keyboard: [[{text: "➡️ Sang Bước 2", callback_data: 'task_2'}]] } });
                }
            }
        } else { bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Bạn chưa tham gia đủ Kênh và Nhóm. Hãy làm ngay kẻo mất phần thưởng!", show_alert: true }); }
    }
    
    else if (data === 'task_2') {
        const task2Text = `🧠 <b>NẠP KIẾN THỨC & LAN TỎA</b>\n\n` +
                          `<b>1. NGUỒN VỐN TRÍ TUỆ (+10 SWGT/Ngày)</b>\n` +
                          `⏱ Bấm đọc bài viết bất kỳ trên web đủ 60 giây.\n\n` +
                          `<b>2. SỨ GIẢ LAN TỎA (+15 SWGT/Ngày)</b>\n` +
                          `📢 Bấm nút Chia sẻ dự án đến bạn bè/nhóm.\n\n` +
                          `▶️ <b>3. CỘNG ĐỒNG YOUTUBE (+5 SWGT - 1 Lần)</b>\n` + 
                          `🎥 Bấm Xem video và đợi ít nhất 6 giây.\n\n` +
                          `📘 <b>4. THEO DÕI FANPAGE (+5 SWGT - 1 Lần)</b>\n` + 
                          `👍 Bấm Mở Fanpage và nhấn Theo dõi.`;
        
        bot.sendMessage(chatId, task2Text, { 
            parse_mode: 'HTML', 
            reply_markup: { inline_keyboard: [
                [{ text: "📖 ĐỌC BÀI VIẾT (Đợi 60s)", callback_data: 'go_read' }],
                [{ text: "🎁 NHẬN THƯỞNG ĐỌC BÀI", callback_data: 'claim_read' }],
                [{ text: "▶️ XEM YOUTUBE (Đợi 6s)", callback_data: 'go_youtube' }],
                [{ text: "🎁 NHẬN THƯỞNG YOUTUBE", callback_data: 'claim_youtube' }],
                [{ text: "📘 THEO DÕI FANPAGE", callback_data: 'go_facebook' }], 
                [{ text: "🎁 NHẬN THƯỞNG FANPAGE", callback_data: 'claim_facebook' }], 
                [{ text: "📢 CHIA SẺ MXH (Đợi 5s)", callback_data: 'go_share' }], 
                [{ text: "🎁 NHẬN THƯỞNG CHIA SẺ", callback_data: 'claim_share' }],
                [{ text: "⬇️ XEM TIẾP BƯỚC 3 (TĂNG TỐC)", callback_data: 'task_3' }]
            ] } 
        });
    } 

    else if (data === 'go_read') {
        user.readTaskStartTime = new Date();
        await user.save();
        bot.sendMessage(chatId, "⏱ <b>Bắt đầu tính giờ!</b>\n\nHãy nhấn vào link bên dưới để đọc bài viết. Lưu ý nán lại trên trang web ít nhất <b>60 giây</b> trước khi quay lại bấm Nhận thưởng nhé!", {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: "👉 TỚI TRANG WEB", url: "https://swc.capital/" }]] }
        });
    }
    else if (data === 'claim_read') {
        if (!user.readTaskStartTime) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn chưa bấm nút ĐỌC BÀI VIẾT để bắt đầu tính giờ!", show_alert: true });
        }
        const now = new Date();
        const timeSpent = (now - new Date(user.readTaskStartTime)) / 1000; 
        const lastTask = user.lastDailyTask ? new Date(user.lastDailyTask) : new Date(0);
        
        if (lastTask.toDateString() === now.toDateString()) {
            bot.answerCallbackQuery(callbackQuery.id, { text: `⏳ Bạn đã nhận thưởng đọc bài hôm nay rồi! Quay lại vào ngày mai nhé.`, show_alert: true });
        } else if (timeSpent < 60) {
            bot.answerCallbackQuery(callbackQuery.id, { text: `⚠️ Bạn thao tác quá nhanh! Mới được ${Math.round(timeSpent)} giây. Vui lòng đọc đủ 60s!`, show_alert: true });
        } else {
            user.balance += 10;
            user.lastDailyTask = now;
            await user.save();
            bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Tuyệt vời! Bạn đã nhận thành công +10 SWGT cho nhiệm vụ đọc bài!", show_alert: true });
        }
    }

    else if (data === 'go_youtube') {
        if (user.youtubeTaskDone) return bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã hoàn thành nhiệm vụ này rồi!", show_alert: true });
        user.youtubeClickTime = new Date();
        await user.save();
        bot.sendMessage(chatId, "▶️ <b>NHIỆM VỤ YOUTUBE (Bắt đầu tính giờ)</b>\n\nHãy bấm nút bên dưới mở YouTube. Xem video ít nhất <b>6 giây</b> để hệ thống ghi nhận, sau đó quay lại đây bấm Nhận thưởng!", { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "👉 MỞ KÊNH YOUTUBE", url: YOUTUBE_LINK }]] } });
    }
    else if (data === 'claim_youtube') {
        if (user.youtubeTaskDone) return bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã nhận phần thưởng YouTube này rồi!", show_alert: true });
        if (!user.youtubeClickTime) return bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn chưa bấm nút XEM YOUTUBE ở bước trên!", show_alert: true });
        const timeSpent = (new Date() - new Date(user.youtubeClickTime)) / 1000;
        if (timeSpent < 6) {
            bot.answerCallbackQuery(callbackQuery.id, { text: `⚠️ Thất bại! Bạn thao tác quá nhanh (${Math.round(timeSpent)} giây). Vui lòng đợi đủ 6 giây rồi hãy bấm Nhận thưởng!`, show_alert: true });
        } else {
            user.balance += 5; 
            user.youtubeTaskDone = true;
            await user.save();
            bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Xuất sắc! Hệ thống đã ghi nhận, +5 SWGT được cộng vào ví.", show_alert: true });
        }
    }

    else if (data === 'go_facebook') {
        if (user.facebookTaskDone) return bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã theo dõi Fanpage rồi!", show_alert: true });
        user.facebookClickTime = new Date();
        await user.save();
        bot.sendMessage(chatId, "📘 <b>NHIỆM VỤ FANPAGE</b>\n\nHãy bấm nút bên dưới để mở Facebook. Nhấn Like/Theo dõi trang và nán lại khoảng <b>5 giây</b> trước khi quay lại nhận thưởng nhé!", { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "👉 MỞ FANPAGE FACEBOOK", url: FACEBOOK_LINK }]] } });
    }
    else if (data === 'claim_facebook') {
        if (user.facebookTaskDone) return bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã nhận phần thưởng Fanpage này rồi!", show_alert: true });
        if (!user.facebookClickTime) return bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn chưa bấm nút THEO DÕI FANPAGE ở bước trên!", show_alert: true });
        const timeSpent = (new Date() - new Date(user.facebookClickTime)) / 1000;
        if (timeSpent < 5) { 
            bot.answerCallbackQuery(callbackQuery.id, { text: `⚠️ Thất bại! Bạn thao tác quá nhanh. Vui lòng bấm mở trang và theo dõi trước khi nhận thưởng!`, show_alert: true });
        } else {
            user.balance += 5; 
            user.facebookTaskDone = true;
            await user.save();
            bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Xuất sắc! Cảm ơn bạn đã theo dõi Fanpage, +5 SWGT.", show_alert: true });
        }
    }

    else if (data === 'go_share') {
        user.shareClickTime = new Date();
        await user.save();
        const shareUrl = "https://t.me/share/url?url=https://t.me/Dau_Tu_SWC_bot&text=Cơ%20hội%20nhận%20SWGT%20miễn%20phí%20từ%20Cộng%20Đồng%20SWC!";
        bot.sendMessage(chatId, "📢 <b>NHIỆM VỤ CHIA SẺ</b>\n\nHãy bấm nút bên dưới để chọn một người bạn hoặc một nhóm và chuyển tiếp tin nhắn. Hệ thống cần khoảng <b>5 giây</b> để quét hành vi, sau đó bạn quay lại đây để nhận thưởng!", { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "👉 CHỌN NGƯỜI ĐỂ CHIA SẺ", url: shareUrl }]] } });
    }
    else if (data === 'claim_share') {
        if (!user.shareClickTime) return bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn chưa bấm nút CHIA SẺ MXH ở bước trên!", show_alert: true });
        const timeSpent = (new Date() - new Date(user.shareClickTime)) / 1000;
        if (timeSpent < 5) { 
            return bot.answerCallbackQuery(callbackQuery.id, { text: `⚠️ Thao tác quá nhanh! Hệ thống chưa kịp ghi nhận. Vui lòng bấm nút chia sẻ và gửi cho bạn bè thật nhé.`, show_alert: true });
        }
        const now = new Date();
        const lastShare = user.lastShareTask ? new Date(user.lastShareTask) : new Date(0);
        
        if (lastShare.toDateString() === now.toDateString()) {
            bot.answerCallbackQuery(callbackQuery.id, { text: `⏳ Bạn đã nhận thưởng chia sẻ hôm nay rồi! Quay lại vào ngày mai nhé.`, show_alert: true });
        } else {
            user.balance += 15; 
            user.lastShareTask = now;
            await user.save();
            bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Cảm ơn bạn đã lan tỏa dự án! +15 SWGT đã được cộng vào ví.", show_alert: true });
        }
    }

    else if (data === 'task_3') {
        const inviteReward = user.isPremium ? 40 : 20;
        const textTask3 = `💎 <b>CHẶNG 3: LAN TỎA GIÁ TRỊ - KIẾN TẠO DI SẢN</b>\n\n` +
                          `<i>"Của cho không bằng cách cho. Chúng ta không đi thuyết phục người tham gia, chúng ta đang trao cơ hội nắm giữ cổ phần công nghệ giao thông uST trước khi nó trở thành kỳ lân!"</i>\n\n` +
                          `🤝 Bạn đã trao cơ hội thành công cho: <b>${user.referralCount || 0} đối tác</b>.\n\n` +
                          `🔗 <b>Đường dẫn trao đặc quyền của bạn:</b>\nhttps://t.me/Dau_Tu_SWC_bot?start=${userId}\n\n` +
                          `🎁 <b>QUÀ TẶNG TRI ÂN TỪ HỆ THỐNG:</b>\n` +
                          `- Nhận tri ân <b>+${inviteReward} SWGT</b> cho mỗi đối tác bạn giúp đỡ kích hoạt thành công.\n` +
                          `- Mở khóa Quỹ Thưởng Đặc Quyền khi đạt các mốc vinh danh:\n` +
                          `  👑 Đạt 10 lượt trao cơ hội: Thưởng nóng <b>+25 SWGT</b>\n` +
                          `  👑 Đạt 50 lượt trao cơ hội: Thưởng nóng <b>+100 SWGT</b>\n\n` +
                          `👉 <b>MỞ APP VÀO MỤC PHẦN THƯỞNG ĐỂ NHẬN QUÂN HÀM VÀ QUÀ TẶNG CỦA BẠN!</b>`;
        bot.sendMessage(chatId, textTask3, { parse_mode: 'HTML' });
    } 
    
    else if (data === 'task_4') {
        const task4Text = `🏆 <b>KHO LƯU TRỮ ĐẶC QUYỀN VIP</b>\n\nSWGT là quyền lực của bạn! Dùng số dư quy đổi lấy "vũ khí" thực chiến:\n\n🔓 <b>1. Mở Khóa Group Private (500 SWGT)</b>\n☕️ <b>2. Cà Phê Chiến Lược 1:1 (300 SWGT)</b>\n🎟 <b>3. Voucher Ưu Đãi Đầu Tư (1000 SWGT)</b>\n\n👉 <i>Bấm mở App để quy đổi!</i>`;
        bot.sendMessage(chatId, task4Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP ĐỂ QUY ĐỔI", web_app: { url: webAppUrl } }]] }});
    }

    const validCallbacks = ['check_join', 'claim_read', 'go_read', 'claim_share', 'go_share', 'go_youtube', 'claim_youtube', 'go_facebook', 'claim_facebook', 'task_1', 'task_2', 'task_3', 'task_4'];
    if (!data.startsWith('admin_') && !validCallbacks.includes(data)) {
        bot.answerCallbackQuery(callbackQuery.id);
    }
});

// ==========================================
// HỆ THỐNG RADAR THEO DÕI RỜI NHÓM & XỬ PHẠT (ĐIỀU KIỆN 21 NGÀY)
// ==========================================
bot.on('chat_member', async (update) => {
    const debugUser = update.new_chat_member.user;
    const chat = update.chat;
    
    const chatUsername = chat.username ? chat.username.toLowerCase() : '';
    const targetChannel = CHANNEL_USERNAME.replace('@', '').toLowerCase();
    const targetGroup = GROUP_USERNAME.replace('@', '').toLowerCase();

    // Chặn đứng mọi sự kiện từ các group/channel không khớp chính xác username
    if (chatUsername !== targetChannel && chatUsername !== targetGroup) {
        return; 
    }

    console.log(`📡 RADAR: Phát hiện ${debugUser.first_name} (ID: ${debugUser.id}) đổi trạng thái thành: ${update.new_chat_member.status}`);

    const newStatus = update.new_chat_member.status;
    const oldStatus = update.old_chat_member.status;
    const leftUserId = update.new_chat_member.user.id.toString();

    // Phát hiện hành vi Rời đi (left) hoặc Bị kick (kicked)
    if ((oldStatus === 'member' || oldStatus === 'restricted' || oldStatus === 'administrator') && 
        (newStatus === 'left' || newStatus === 'kicked')) {
        
        let leftUser = await User.findOne({ userId: leftUserId });
        
        if (leftUser && leftUser.task1Done) {
            // TÍNH TOÁN THỜI GIAN ĐÃ THAM GIA
            const joinDate = new Date(leftUser.joinDate || Date.now());
            const daysSinceJoin = (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24);

            // CHỈ PHẠT NẾU RỜI NHÓM TRƯỚC 21 NGÀY
            if (daysSinceJoin <= 21) {
                // ---> PHẠT NGƯỜI RỜI NHÓM
                const penalty = leftUser.isPremium ? 40 : 20;
                leftUser.balance = Math.max(0, leftUser.balance - penalty); 
                leftUser.task1Done = false; // Reset trạng thái

                // ---> THU HỒI PHẦN THƯỞNG CỦA NGƯỜI MỜI
                if (leftUser.referredBy) {
                    let referrer = await User.findOne({ userId: leftUser.referredBy });
                    if (referrer) {
                        const refPenalty = referrer.isPremium ? 20 : 10; 
                        
                        referrer.balance = Math.max(0, referrer.balance - refPenalty);
                        referrer.referralCount = Math.max(0, referrer.referralCount - 1);
                        referrer.weeklyReferralCount = Math.max(0, (referrer.weeklyReferralCount || 0) - 1);
                        
                        // Thu hồi quân hàm nếu rớt hạng
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

                        // Báo tin buồn cho người mời
                        let notifyReferrerMsg = `⚠️ <b>THÔNG BÁO THU HỒI LƯỢT MỜI!</b> ⚠️\n\nThành viên <b>${leftUser.firstName} ${leftUser.lastName}</b> do bạn mời vừa <b>RỜI KHỎI</b> mạng lưới Cộng đồng SWC khi chưa gắn bó đủ 21 ngày.\n\n📉 Hệ thống đã tự động thu hồi <b>1 lượt mời</b> và trừ <b>${refPenalty} SWGT</b> tiền thưởng tương ứng khỏi ví của bạn.`;
                        bot.sendMessage(referrer.userId, notifyReferrerMsg, {parse_mode: 'HTML'}).catch(()=>{});
                    }
                }

                await leftUser.save();
                
                // Bắn tin nhắn phạt kẻ bỏ trốn
                bot.sendMessage(leftUserId, `⚠️ <b>CẢNH BÁO TỪ HỆ THỐNG!</b>\nRadar phát hiện bạn đã rời khỏi Cộng Đồng SWC khi chưa đủ 21 ngày gắn bó. Bạn đã bị trừ <b>${penalty} SWGT</b>. Hãy tham gia lại và làm lại nhiệm vụ để khôi phục!`, {parse_mode: 'HTML'}).catch(()=>{});
            } else {
                console.log(`✅ Bỏ qua phạt do ${leftUser.userId} đã tham gia được ${Math.round(daysSinceJoin)} ngày (An toàn > 21 ngày).`);
            }
        }
    }
});
