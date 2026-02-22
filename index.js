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

// --- TẠO CẤU TRÚC LƯU TRỮ (BỔ SUNG CHUỖI ĐIỂM DANH VÀ 7 MỐC) ---
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
    
    // Chuỗi điểm danh
    checkInStreak: { type: Number, default: 0 },
    lastCheckInDate: { type: Date, default: null },
    
    // Mốc giới thiệu
    milestone3: { type: Boolean, default: false },
    milestone10: { type: Boolean, default: false }, 
    milestone20: { type: Boolean, default: false }, 
    milestone50: { type: Boolean, default: false },
    milestone100: { type: Boolean, default: false },
    milestone250: { type: Boolean, default: false },
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
        if (!userData) userData = { balance: 0, referralCount: 0, checkInStreak: 0 };
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
    // API: NHẬN THƯỞNG MỐC & THÔNG BÁO GROUP (HIỆU ỨNG CHIM MỒI)
    else if (parsedUrl.pathname === '/api/claim-milestone' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                let reward = 0;
                let msName = `milestone${data.milestone}`;

                if (data.milestone === 3 && user.referralCount >= 3 && !user.milestone3) { reward = 10; user.milestone3 = true; }
                else if (data.milestone === 10 && user.referralCount >= 10 && !user.milestone10) { reward = 50; user.milestone10 = true; }
                else if (data.milestone === 20 && user.referralCount >= 20 && !user.milestone20) { reward = 100; user.milestone20 = true; }
                else if (data.milestone === 50 && user.referralCount >= 50 && !user.milestone50) { reward = 300; user.milestone50 = true; }
                else if (data.milestone === 100 && user.referralCount >= 100 && !user.milestone100) { reward = 1000; user.milestone100 = true; }
                else if (data.milestone === 250 && user.referralCount >= 250 && !user.milestone250) { reward = 3000; user.milestone250 = true; }
                else if (data.milestone === 500 && user.referralCount >= 500 && !user.milestone500) { reward = 10000; user.milestone500 = true; }

                if (reward > 0) {
                    user.balance += reward;
                    await user.save();

                    // HIỆU ỨNG FOMO: NẾU ĐẠT TỪ 50 REF TRỞ LÊN SẼ BÁO VÀO GROUP CHAT
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
    // API: ĐIỂM DANH CHUỖI 7 NGÀY (HIỆU ỨNG SUNK COST)
    else if (parsedUrl.pathname === '/api/checkin' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return;

                const now = new Date();
                now.setHours(0,0,0,0); 
                const lastCheckin = user.lastCheckInDate ? new Date(user.lastCheckInDate) : new Date(0);
                lastCheckin.setHours(0,0,0,0);

                const diffTime = Math.abs(now - lastCheckin);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                    res.writeHead(400); return res.end(JSON.stringify({ success: false, message: 'Hôm nay bạn đã điểm danh rồi!' }));
                }

                // Nếu hôm qua điểm danh -> Tăng chuỗi. Nếu bỏ lỡ -> Về 1.
                if (diffDays === 1) {
                    user.checkInStreak += 1;
                    if (user.checkInStreak > 7) user.checkInStreak = 1; // Hết chuỗi 7 ngày thì quay lại ngày 1
                } else {
                    user.checkInStreak = 1; 
                }

                // Cơ cấu điểm: Ngày 1(2), N2(3), N3(4), N4(5), N5(6), N6(10), N7(20)
                const streakRewards = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 10, 7: 20 };
                const reward = streakRewards[user.checkInStreak] || 2;

                user.balance += reward; 
                user.lastCheckInDate = new Date();
                await user.save();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance, reward: reward, streak: user.checkInStreak }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    // API: NHẬN THƯỞNG NHIỆM VỤ APP (CẤP BẬC VIP X ĐIỂM THƯỞNG)
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
                    // HỆ THỐNG VIP NHÂN ĐIỂM THƯỞNG
                    let multiplier = 1;
                    if (user.referralCount >= 100) multiplier = 1.5; // Đối tác VIP x1.5 điểm
                    else if (user.referralCount >= 50) multiplier = 1.2; // Đại sứ x1.2 điểm
                    
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
                    user.balance -= data.cost;
                    await user.save();
                    const userNotify = `⏳ Yêu cầu đổi: <b>${data.itemName}</b> đang được xử lý!`;
                    bot.sendMessage(data.userId, userNotify, {parse_mode: 'HTML'}).catch(()=>{});
                    const reportMsg = `🎁 <b>YÊU CẦU ĐỔI QUÀ</b>\nKhách: ${user.firstName} (ID: <code>${user.userId}</code>)\nQuà: ${data.itemName}\nVí: ${user.wallet || 'Chưa cập nhật'}`;
                    bot.sendMessage(ADMIN_ID, reportMsg, { parse_mode: 'HTML' }).catch(()=>{});
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance }));
                } else { res.writeHead(400); res.end(); }
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

                if (new Date().getTime() < unlockDate) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: `⏳ Bạn chưa hết thời gian mở khóa (${lockDays} ngày). Vui lòng chờ đến khi đếm ngược kết thúc!` }));
                }

                const withdrawAmount = Number(data.amount); 

                if (user.balance >= withdrawAmount && withdrawAmount >= 300) {
                    user.balance -= withdrawAmount; 
                    await user.save();
                    
                    let userMsg = "";
                    let adminReport = "";

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

// --- CÁC LOGIC CÒN LẠI GIỮ NGUYÊN ---
async function checkMembership(userId) {
    try {
        const channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        const validStatuses = ['member', 'administrator', 'creator'];
        return { inChannel: validStatuses.includes(channelMember.status), inGroup: validStatuses.includes(groupMember.status) };
    } catch (error) { return { error: true }; }
}

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
        user = new User({ 
            userId: userId, firstName: firstName, lastName: lastName, username: username, isPremium: isPremium
        });
        
        if (refId && refId !== userId) {
            user.referredBy = refId;
            let referrer = await User.findOne({ userId: refId });
            if (referrer) {
                const startReward = referrer.isPremium ? 20 : 10;
                referrer.balance += startReward; 
                referrer.referralCount += 1; 
                await referrer.save();
                
                let notifyMsg = `🎉 <b>CÓ NGƯỜI MỚI THAM GIA!</b>\n\n👤 <b>Tên:</b> ${firstName} ${lastName}\nĐã bấm vào link mời của bạn!\n🎁 Bạn được cộng trước <b>${startReward} SWGT</b>.\n\n⚠️ Hãy hướng dẫn họ làm Nhiệm vụ Tân binh để nhận thêm <b>${startReward} SWGT</b> nữa!`;
                bot.sendMessage(refId, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    } else {
        user.firstName = firstName; user.lastName = lastName; user.username = username; user.isPremium = isPremium;
    }
    await user.save();
    
    let welcomeText = `👋 <b>Chào mừng bạn đến với Cộng Đồng SWC Việt Nam!</b> 🚀\n\nBạn đã bước chân vào trung tâm kết nối của những nhà đầu tư tiên phong. Cơ hội sở hữu trước token SWGT và đón đầu xu hướng công nghệ giao thông uST đang ở ngay trước mắt, nhưng số lượng thì có hạn!\n\n🎁 <b>Quà tặng Tân Binh:</b> Nhận ngay những đồng SWGT đầu tiên hoàn toàn miễn phí.\n\n👇 <b>HÀNH ĐỘNG NGAY:</b> Bấm nút <b>"MỞ ỨNG DỤNG SWC NGAY"</b> bên dưới để kích hoạt ví và gia tăng tài sản!`;
    
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

bot.on('message', async (msg) => {
    if (msg.from && msg.from.id.toString() === ADMIN_ID && msg.reply_to_message) {
        const replyText = msg.text ? msg.text.toLowerCase() : '';
        if (replyText.includes('xong') || replyText.includes('done')) {
            const originalText = msg.reply_to_message.text || "";
            const idMatch = originalText.match(/ID: (\d+)/);
            if (idMatch) {
                const targetUserId = idMatch[1];
                const targetUser = await User.findOne({ userId: targetUserId });
                const successMsg = `🚀 <b>HÀNH TRÌNH SWC - YÊU CẦU HOÀN TẤT!</b>\n\nChào <b>${targetUser ? targetUser.firstName : 'bạn'}</b>, Admin đã kiểm duyệt thành công và thực hiện chuyển lệnh cho bạn!\n\n🎉 <b>TRẠNG THÁI:</b> GIAO DỊCH THÀNH CÔNG!\n🌈 Cảm ơn bạn đã luôn tin tưởng và đồng hành!`;
                bot.sendMessage(targetUserId, successMsg, {parse_mode: 'HTML'}).catch(()=>{});
                bot.sendMessage(ADMIN_ID, `✅ Đã gửi thông báo cho ID: ${targetUserId}.`);
                return; 
            }
        }
    }

    if (msg.left_chat_member) {
        const leftUserId = msg.left_chat_member.id.toString();
        let leftUser = await User.findOne({ userId: leftUserId });
        if (leftUser && leftUser.task1Done) {
            const penalty = leftUser.isPremium ? 40 : 20;
            leftUser.balance = Math.max(0, leftUser.balance - penalty); 
            leftUser.task1Done = false; 
            await leftUser.save();
            bot.sendMessage(leftUserId, `⚠️ <b>CẢNH BÁO!</b>\nHệ thống phát hiện bạn đã rời nhóm. Trừ <b>${penalty} SWGT</b>. Hãy tham gia lại!`, {parse_mode: 'HTML'}).catch(()=>{});
        }
        return; 
    }

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
    if (msg.text.trim().length >= 10) { user.balance = Math.round((user.balance + 0.3) * 100) / 100; }
    await user.save();
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

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
        if (status.error) { bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bot chưa được cấp quyền Admin trong Nhóm/Kênh!", show_alert: true }); } 
        else if (status.inChannel && status.inGroup) {
            if (user.groupMessageCount < 1) {
                bot.answerCallbackQuery(callbackQuery.id, { text: `❌ TÀI KHOẢN CHƯA XÁC MINH!\n\nBạn đã vào nhóm nhưng chưa gửi tin nhắn chào hỏi nào.\n\nHãy vào Nhóm dán câu chào rồi quay lại kiểm tra nhé!`, show_alert: true });
            } else {
                if (!user.task1Done) {
                    const selfReward = user.isPremium ? 40 : 20;
                    user.balance += selfReward; user.task1Done = true; await user.save();
                    if (user.referredBy) {
                        let referrer = await User.findOne({ userId: user.referredBy });
                        if (referrer) {
                            const refReward = referrer.isPremium ? 20 : 10;
                            referrer.balance += refReward; await referrer.save();
                            bot.sendMessage(user.referredBy, `🔥 <b>TING TING!</b>\nThành viên (${user.firstName}) bạn mời vừa xác minh tài khoản thành công.\n🎁 Bạn được cộng thêm phần thưởng xác minh <b>+${refReward} SWGT</b>!`, {parse_mode: 'HTML'}).catch(()=>{});
                        }
                    }
                    bot.answerCallbackQuery(callbackQuery.id, { text: `🎉 Tuyệt vời! Xác minh thành công, +${selfReward} SWGT.`, show_alert: true });
                    bot.sendMessage(chatId, `🔥 <b>XÁC MINH TÀI KHOẢN THÀNH CÔNG!</b>\n\nHệ thống đã ghi nhận bạn là Nhà đầu tư thật.\n🎁 <b>Phần thưởng:</b> +${selfReward} SWGT.\n\n👉 <i>Bấm mở App ngay để kết nối ví nhận thêm +10 SWGT nữa nhé!</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]] }});
                } else { bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã hoàn thành nhiệm vụ này và nhận thưởng rồi nhé!", show_alert: true }); }
            }
        } else { bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Bạn chưa tham gia đủ Kênh và Nhóm. Hãy làm ngay kẻo mất phần thưởng!", show_alert: true }); }
    }
    else if (data === 'task_2') {
        const task2Text = `🧠 <b>NẠP KIẾN THỨC & LAN TỎA</b>\n\n<b>1. NGUỒN VỐN TRÍ TUỆ (+10 SWGT/Ngày)</b>\n⏱ Bấm đọc bài viết bất kỳ trên web đủ 60 giây.\n\n<b>2. SỨ GIẢ LAN TỎA (+15 SWGT/Ngày)</b>\n📢 Bấm nút Chia sẻ dự án đến bạn bè/nhóm.\n\n▶️ <b>3. CỘNG ĐỒNG YOUTUBE (+5 SWGT - 1 Lần)</b>\n🎥 Bấm Xem video và đợi ít nhất 6 giây.\n\n📘 <b>4. THEO DÕI FANPAGE (+5 SWGT - 1 Lần)</b>\n👍 Bấm Mở Fanpage và nhấn Theo dõi.`;
        bot.sendMessage(chatId, task2Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [ [{ text: "📖 ĐỌC BÀI VIẾT (Đợi 60s)", callback_data: 'go_read' }], [{ text: "🎁 NHẬN THƯỞNG ĐỌC BÀI", callback_data: 'claim_read' }], [{ text: "▶️ XEM YOUTUBE (Đợi 6s)", callback_data: 'go_youtube' }], [{ text: "🎁 NHẬN THƯỞNG YOUTUBE", callback_data: 'claim_youtube' }], [{ text: "📘 THEO DÕI FANPAGE", callback_data: 'go_facebook' }], [{ text: "🎁 NHẬN THƯỞNG FANPAGE", callback_data: 'claim_facebook' }], [{ text: "📢 CHIA SẺ MXH (Đợi 5s)", callback_data: 'go_share' }], [{ text: "🎁 NHẬN THƯỞNG CHIA SẺ", callback_data: 'claim_share' }] ] } });
    } 
    else if (data === 'go_read') {
        user.readTaskStartTime = new Date(); await user.save();
        bot.sendMessage(chatId, "⏱ <b>Bắt đầu tính giờ!</b>\n\nHãy nhấn vào link bên dưới để đọc bài viết. Lưu ý nán lại trên trang web ít nhất <b>60 giây</b> trước khi quay lại bấm Nhận thưởng nhé!", { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "👉 TỚI TRANG WEB", url: "https://swc.capital/" }]] } });
    }
    else if (data === 'claim_read') {
        if (!user.readTaskStartTime) return bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn chưa bấm nút ĐỌC BÀI VIẾT để bắt đầu tính giờ!", show_alert: true });
        const now = new Date(); const timeSpent = (now - new Date(user.readTaskStartTime)) / 1000; 
        const lastTask = user.lastDailyTask ? new Date(user.lastDailyTask) : new Date(0);
        if (lastTask.toDateString() === now.toDateString()) { bot.answerCallbackQuery(callbackQuery.id, { text: `⏳ Bạn đã nhận thưởng đọc bài hôm nay rồi! Quay lại vào ngày mai nhé.`, show_alert: true }); } 
        else if (timeSpent < 60) { bot.answerCallbackQuery(callbackQuery.id, { text: `⚠️ Bạn thao tác quá nhanh! Mới được ${Math.round(timeSpent)} giây. Vui lòng đọc đủ 60s!`, show_alert: true }); } 
        else { user.balance += 10; user.lastDailyTask = now; await user.save(); bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Tuyệt vời! Bạn đã nhận thành công +10 SWGT cho nhiệm vụ đọc bài!", show_alert: true }); }
    }
    else if (data === 'go_youtube') {
        if (user.youtubeTaskDone) return bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã hoàn thành nhiệm vụ này rồi!", show_alert: true });
        user.youtubeClickTime = new Date(); await user.save();
        bot.sendMessage(chatId, "▶️ <b>NHIỆM VỤ YOUTUBE (Bắt đầu tính giờ)</b>\n\nHãy bấm nút bên dưới mở YouTube. Xem video ít nhất <b>6 giây</b> để hệ thống ghi nhận, sau đó quay lại đây bấm Nhận thưởng!", { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "👉 MỞ KÊNH YOUTUBE", url: YOUTUBE_LINK }]] } });
    }
    else if (data === 'claim_youtube') {
        if (user.youtubeTaskDone) return bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã nhận phần thưởng YouTube này rồi!", show_alert: true });
        if (!user.youtubeClickTime) return bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn chưa bấm nút XEM YOUTUBE ở bước trên!", show_alert: true });
        const timeSpent = (new Date() - new Date(user.youtubeClickTime)) / 1000;
        if (timeSpent < 6) { bot.answerCallbackQuery(callbackQuery.id, { text: `⚠️ Thất bại! Bạn thao tác quá nhanh (${Math.round(timeSpent)} giây). Vui lòng đợi đủ 6 giây rồi hãy bấm Nhận thưởng!`, show_alert: true }); } 
        else { user.balance += 5; user.youtubeTaskDone = true; await user.save(); bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Xuất sắc! Hệ thống đã ghi nhận, +5 SWGT được cộng vào ví.", show_alert: true }); }
    }
    else if (data === 'go_facebook') {
        if (user.facebookTaskDone) return bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã theo dõi Fanpage rồi!", show_alert: true });
        user.facebookClickTime = new Date(); await user.save();
        bot.sendMessage(chatId, "📘 <b>NHIỆM VỤ FANPAGE</b>\n\nHãy bấm nút bên dưới để mở Facebook. Nhấn Like/Theo dõi trang và nán lại khoảng <b>5 giây</b> trước khi quay lại nhận thưởng nhé!", { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "👉 MỞ FANPAGE FACEBOOK", url: FACEBOOK_LINK }]] } });
    }
    else if (data === 'claim_facebook') {
        if (user.facebookTaskDone) return bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã nhận phần thưởng Fanpage này rồi!", show_alert: true });
        if (!user.facebookClickTime) return bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn chưa bấm nút THEO DÕI FANPAGE ở bước trên!", show_alert: true });
        const timeSpent = (new Date() - new Date(user.facebookClickTime)) / 1000;
        if (timeSpent < 5) { bot.answerCallbackQuery(callbackQuery.id, { text: `⚠️ Thất bại! Bạn thao tác quá nhanh. Vui lòng bấm mở trang và theo dõi trước khi nhận thưởng!`, show_alert: true }); } 
        else { user.balance += 5; user.facebookTaskDone = true; await user.save(); bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Xuất sắc! Cảm ơn bạn đã theo dõi Fanpage, +5 SWGT.", show_alert: true }); }
    }
    else if (data === 'go_share') {
        user.shareClickTime = new Date(); await user.save();
        const shareUrl = "https://t.me/share/url?url=https://t.me/Dau_Tu_SWC_bot&text=Cơ%20hội%20nhận%20SWGT%20miễn%20phí%20từ%20Cộng%20Đồng%20SWC!";
        bot.sendMessage(chatId, "📢 <b>NHIỆM VỤ CHIA SẺ</b>\n\nHãy bấm nút bên dưới để chọn một người bạn hoặc một nhóm và chuyển tiếp tin nhắn. Hệ thống cần khoảng <b>5 giây</b> để quét hành vi, sau đó bạn quay lại đây để nhận thưởng!", { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "👉 CHỌN NGƯỜI ĐỂ CHIA SẺ", url: shareUrl }]] } });
    }
    else if (data === 'claim_share') {
        if (!user.shareClickTime) return bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn chưa bấm nút CHIA SẺ MXH ở bước trên!", show_alert: true });
        const timeSpent = (new Date() - new Date(user.shareClickTime)) / 1000;
        if (timeSpent < 5) return bot.answerCallbackQuery(callbackQuery.id, { text: `⚠️ Thao tác quá nhanh! Vui lòng bấm nút chia sẻ và gửi cho bạn bè thật nhé.`, show_alert: true });
        const now = new Date(); const lastShare = user.lastShareTask ? new Date(user.lastShareTask) : new Date(0);
        if (lastShare.toDateString() === now.toDateString()) { bot.answerCallbackQuery(callbackQuery.id, { text: `⏳ Bạn đã nhận thưởng chia sẻ hôm nay rồi! Quay lại vào ngày mai nhé.`, show_alert: true }); } 
        else { user.balance += 15; user.lastShareTask = now; await user.save(); bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Cảm ơn bạn đã lan tỏa dự án! +15 SWGT đã được cộng vào ví.", show_alert: true }); }
    }
    else if (data === 'task_3') {
        const inviteReward = user.isPremium ? 40 : 20;
        const textTask3 = `🚀 <b>CƠ HỘI BỨT PHÁ - X10 TÀI SẢN</b>\n\nBạn đã mời được: <b>${user.referralCount || 0} người</b>.\n\n🔗 <b>Link giới thiệu của bạn:</b>\nhttps://t.me/Dau_Tu_SWC_bot?start=${userId}\n\n💎 Bạn đang là <b>${user.isPremium ? 'Thành viên Premium ⭐' : 'Thành viên Thường'}</b>, nhận ngay <b>+${inviteReward} SWGT</b> cho mỗi lượt mời thành công.\n\n👑 <b>THƯỞNG MỐC ĐẶC BIỆT:</b>\n- 3 người: <b>+10 SWGT</b>\n- 10 người: <b>+50 SWGT</b>\n- 20 người: <b>+100 SWGT</b>\n- 50 người: <b>+300 SWGT</b>\n- 100 người: <b>+1000 SWGT</b>`;
        bot.sendMessage(chatId, textTask3, { parse_mode: 'HTML' });
    } 
    else if (data === 'task_4') {
        const task4Text = `🏆 <b>KHO LƯU TRỮ ĐẶC QUYỀN VIP</b>\n\nSWGT là quyền lực của bạn! Dùng số dư quy đổi lấy "vũ khí" thực chiến:\n\n🔓 <b>1. Mở Khóa Group Private (500 SWGT)</b>\n☕️ <b>2. Cà Phê Chiến Lược 1:1 (300 SWGT)</b>\n🎟 <b>3. Voucher Ưu Đãi Đầu Tư (1000 SWGT)</b>\n\n👉 <i>Bấm mở App để quy đổi!</i>`;
        bot.sendMessage(chatId, task4Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP ĐỂ QUY ĐỔI", web_app: { url: webAppUrl } }]] }});
    }

    const validCallbacks = ['check_join', 'claim_read', 'go_read', 'claim_share', 'go_share', 'go_youtube', 'claim_youtube', 'go_facebook', 'claim_facebook', 'task_1', 'task_2', 'task_3', 'task_4'];
    if (!validCallbacks.includes(data)) { bot.answerCallbackQuery(callbackQuery.id); }
});
