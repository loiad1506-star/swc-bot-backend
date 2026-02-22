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

// --- TẠO CẤU TRÚC LƯU TRỮ NGƯỜI DÙNG (THÊM PREMIUM & NGÀY THAM GIA) ---
const userSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    firstName: { type: String, default: '' }, 
    lastName: { type: String, default: '' },  
    username: { type: String, default: '' },  
    isPremium: { type: Boolean, default: false }, // Nhận diện Premium
    joinDate: { type: Date, default: Date.now },  // Ngày tham gia để tính thời gian mở khóa
    balance: { type: Number, default: 0 },
    wallet: { type: String, default: '' },
    gatecode: { type: String, default: '' }, 
    fullName: { type: String, default: '' }, 
    email: { type: String, default: '' }, 
    phone: { type: String, default: '' }, 
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
    shareClickTime: { type: Date, default: null },
    milestone10: { type: Boolean, default: false }, 
    milestone50: { type: Boolean, default: false }  
});
const User = mongoose.model('User', userSchema);

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
    // API: TỰ BẤM NHẬN THƯỞNG MỐC
    else if (parsedUrl.pathname === '/api/claim-milestone' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                if (data.milestone === 10 && user.referralCount >= 10 && !user.milestone10) {
                    user.balance += 50; user.milestone10 = true;
                } else if (data.milestone === 50 && user.referralCount >= 50 && !user.milestone50) {
                    user.balance += 300; user.milestone50 = true;
                } else {
                    return res.writeHead(400), res.end(JSON.stringify({ success: false, message: "Chưa đủ điều kiện hoặc đã nhận rồi!" }));
                }
                
                await user.save();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, balance: user.balance }));
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
                let reward = 0;

                if (data.taskType === 'read') {
                    const lastDaily = user.lastDailyTask ? new Date(user.lastDailyTask) : new Date(0);
                    if ((now - lastDaily) >= 86400000) { reward = 10; user.lastDailyTask = now; }
                } else if (data.taskType === 'youtube' && !user.youtubeTaskDone) {
                    reward = 5; user.youtubeTaskDone = true;
                } else if (data.taskType === 'facebook' && !user.facebookTaskDone) {
                    reward = 5; user.facebookTaskDone = true;
                } else if (data.taskType === 'share') {
                    const lastShare = user.lastShareTask ? new Date(user.lastShareTask) : new Date(0);
                    if ((now - lastShare) >= 86400000) { reward = 15; user.lastShareTask = now; }
                }

                if (reward > 0) {
                    user.balance += reward;
                    await user.save();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance, reward }));
                } else {
                    res.writeHead(400); res.end(JSON.stringify({ success: false, message: "Đã nhận rồi hoặc chưa đủ thời gian!" }));
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
                    
                    const userNotify = `⏳ <b>YÊU CẦU ĐANG ĐƯỢC TIẾN HÀNH!</b>\n\nYêu cầu quyền lợi của bạn đang được xử lý: <b>${data.itemName}</b>\n💎 Phí đổi: ${data.cost} SWGT\n\nAdmin sẽ kiểm tra và hoàn tất cho bạn trong giây lát!`;
                    bot.sendMessage(data.userId, userNotify, {parse_mode: 'HTML'}).catch(()=>{});
                    
                    const reportMsg = `🎁 <b>YÊU CẦU ĐỔI QUÀ</b>\n\n👤 Khách: <b>${user.firstName} ${user.lastName}</b>\n🆔 ID: <code>${user.userId}</code>\n💎 Quà: <b>${data.itemName}</b>\n🏦 Ví: <code>${user.wallet || 'Chưa cập nhật'}</code>\n\n👉 <i>Admin hãy Reply tin nhắn này gõ "xong" để báo cho khách.</i>`;
                    bot.sendMessage(ADMIN_ID, reportMsg, { parse_mode: 'HTML' }).catch(()=>{});

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, balance: user.balance }));
                } else { res.writeHead(400); res.end(JSON.stringify({ success: false })); }
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    // API: YÊU CẦU RÚT TIỀN (KIỂM TRA CHẶT PREMIUM 7 NGÀY / THƯỜNG 15 NGÀY)
    else if (parsedUrl.pathname === '/api/withdraw' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (!user) return res.writeHead(400), res.end();

                // KIỂM TRA THỜI GIAN MỞ KHÓA THEO HẠNG TÀI KHOẢN
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
    // API: ĐIỂM DANH
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

// --- 3. XỬ LÝ LỆNH /start ---
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
                referrer.balance += 10; 
                referrer.referralCount += 1; 
                await referrer.save();
                
                let milestoneMsg = "";
                if (referrer.referralCount === 10) milestoneMsg = "\n🌟 Bạn đã đạt mốc 10 người! Mở App ngay để TỰ BẤM NHẬN +50 SWGT nhé!"; 
                if (referrer.referralCount === 50) milestoneMsg = "\n👑 Bạn đã đạt mốc 50 người! Mở App ngay để TỰ BẤM NHẬN +300 SWGT nhé!"; 

                const notifyMsg = `🎉 <b>CÓ NGƯỜI MỚI THAM GIA!</b>\n\n👤 <b>Tên:</b> ${firstName} ${lastName}\n🆔 <b>ID:</b> <code>${userId}</code>\nĐã bấm vào link mời của bạn!\n\n🎁 Bạn vừa được cộng trước <b>10 SWGT</b>.\n\n⚠️ <b>BƯỚC CUỐI:</b> Hãy nhắn tin hướng dẫn họ làm "Nhiệm vụ Tân binh" để bạn được cộng thêm <b>10 SWGT</b> nữa nhé!${milestoneMsg}`;
                bot.sendMessage(refId, notifyMsg, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
    } else {
        user.firstName = firstName; user.lastName = lastName; user.username = username; user.isPremium = isPremium;
    }
    await user.save();
    
    let welcomeText = `👋 <b>Chào mừng bạn đến với Cộng Đồng SWC Việt Nam!</b> 🚀\n\nBạn đã bước chân vào trung tâm kết nối của những nhà đầu tư tiên phong. Cơ hội sở hữu trước token SWGT và đón đầu xu hướng công nghệ giao thông uST đang ở ngay trước mắt, nhưng số lượng thì có hạn!\n\n🎁 <b>Quà tặng Tân Binh:</b> Nhận ngay những đồng SWGT đầu tiên hoàn toàn miễn phí.\n\n👇 <b>HÀNH ĐỘNG NGAY:</b> Bấm nút <b>"MỞ ỨNG DỤNG SWC NGAY"</b> bên dưới để kích hoạt ví và gia tăng tài sản!`;
    
    if (isNewUser && refId && refId !== userId) {
        welcomeText = `🎉 <i>Bạn được mời bởi thành viên ID: ${refId}</i>\n\n` + welcomeText;
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
    
    bot.sendPhoto(chatId, './Bia.jpg', {
        caption: welcomeText,
        parse_mode: 'HTML',
        reply_markup: opts.reply_markup
    }).catch(err => {
        bot.sendMessage(chatId, welcomeText, opts);
    });
});

// --- 4. CAMERA CHẠY NGẦM ---
bot.on('message', async (msg) => {
    
    // --- A. XỬ LÝ KHI ADMIN BÁO "XONG" ---
    if (msg.from && msg.from.id.toString() === ADMIN_ID && msg.reply_to_message) {
        const replyText = msg.text ? msg.text.toLowerCase() : '';
        if (replyText.includes('xong') || replyText.includes('done')) {
            const originalText = msg.reply_to_message.text || "";
            const idMatch = originalText.match(/ID: (\d+)/);
            if (idMatch) {
                const targetUserId = idMatch[1];
                const targetUser = await User.findOne({ userId: targetUserId });
                
                const successMsg = `🚀 <b>HÀNH TRÌNH SWC - YÊU CẦU HOÀN TẤT!</b>\n\n` +
                                   `Chào <b>${targetUser ? targetUser.firstName : 'bạn'}</b>, Admin đã kiểm duyệt thành công và thực hiện chuyển lệnh cho bạn!\n\n` +
                                   `🎉 <b>TRẠNG THÁI:</b> GIAO DỊCH THÀNH CÔNG!\n` +
                                   `🌈 Cảm ơn bạn đã luôn tin tưởng và đồng hành cùng Cộng đồng SWC. Hãy kiểm tra ví và tiếp tục lan tỏa dự án nhé! 🚀`;
                
                bot.sendMessage(targetUserId, successMsg, {parse_mode: 'HTML'}).catch(()=>{});
                bot.sendMessage(ADMIN_ID, `✅ Đã gửi thông báo thành công cho khách hàng (ID: ${targetUserId}).`);
                return; 
            }
        }
    }

    // --- B. XỬ LÝ RỜI NHÓM ---
    if (msg.left_chat_member) {
        const leftUserId = msg.left_chat_member.id.toString();
        let leftUser = await User.findOne({ userId: leftUserId });
        if (leftUser && leftUser.task1Done) {
            leftUser.balance = Math.max(0, leftUser.balance - 20); 
            leftUser.task1Done = false; 
            await leftUser.save();
            bot.sendMessage(leftUserId, `⚠️ <b>CẢNH BÁO!</b>\nHệ thống phát hiện bạn đã rời khỏi Cộng Đồng SWC. Tài khoản của bạn đã bị trừ <b>20 SWGT</b>. Hãy tham gia lại để khôi phục!`, {parse_mode: 'HTML'}).catch(()=>{});
        }
        return; 
    }

    // --- C. XỬ LÝ CỘNG TIỀN KHI CHAT TƯƠNG TÁC ---
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
        user = new User({ 
            userId: userId, 
            firstName: msg.from.first_name || '', 
            lastName: msg.from.last_name || '', 
            username: msg.from.username ? `@${msg.from.username}` : '',
            isPremium: isPremium
        });
    } else {
        user.isPremium = isPremium; // Cập nhật Premium liên tục
    }

    user.groupMessageCount += 1; 

    if (msg.text.trim().length >= 10) {
        user.balance = Math.round((user.balance + 0.3) * 100) / 100;
    }
    await user.save();
});

// --- 5. XỬ LÝ NÚT BẤM CỦA BOT ---
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    let user = await User.findOne({ userId: userId });
    if (!user) return bot.answerCallbackQuery(callbackQuery.id);

    if (data === 'task_1') {
        const opts = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔵 Join Kênh Thông tin", url: "https://t.me/swc_capital_vn" }],
                    [{ text: "💬 Join Group Cộng Đồng", url: "https://t.me/swc_capital_chat" }],
                    [{ text: "✅ KIỂM TRA & NHẬN THƯỞNG", callback_data: 'check_join' }]
                ]
            }
        };
        const task1Text = `🎯 <b>BƯỚC 1: LẤY VỐN KHỞI NGHIỆP</b>\n\nHoàn thành ngay để "bỏ túi" <b>30 SWGT</b> đầu tiên:\n\n1️⃣ <b>Join Kênh & Group Cộng Đồng SWC Việt Nam</b> (+20 SWGT).\n\n2️⃣ <b>Gửi tin nhắn chào hỏi</b> lên Group để xác minh.\n👉 <i>Chạm vào khung bên dưới để tự động copy câu chào, sau đó ấn nút Join Group để dán và gửi:</i>\n\n<code>Xin chào cả nhà, mình là thành viên mới, rất vui được làm quen với cộng đồng đầu tư</code>\n\n3️⃣ <b>Mở App Kết nối Ví Crypto</b> (+10 SWGT).\n\n⚠️ <i>Lưu ý: Rời nhóm = Trừ sạch điểm số!</i>`;
        bot.sendMessage(chatId, task1Text, opts);
    } 
    
    else if (data === 'check_join') {
        const status = await checkMembership(userId);
        if (status.error) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bot chưa được cấp quyền Admin trong Nhóm/Kênh!", show_alert: true });
        } else if (status.inChannel && status.inGroup) {
            
            if (user.groupMessageCount < 1) {
                bot.answerCallbackQuery(callbackQuery.id, { 
                    text: `❌ TÀI KHOẢN CHƯA XÁC MINH!\n\nBạn đã vào nhóm nhưng chưa gửi tin nhắn chào hỏi nào.\n\nHãy vào Nhóm dán câu chào rồi quay lại kiểm tra nhé!`, 
                    show_alert: true 
                });
            } else {
                if (!user.task1Done) {
                    user.balance += 20; 
                    user.task1Done = true;
                    await user.save();
                    
                    if (user.referredBy) {
                        let referrer = await User.findOne({ userId: user.referredBy });
                        if (referrer) {
                            referrer.balance += 10; 
                            await referrer.save();
                            bot.sendMessage(user.referredBy, `🔥 <b>TING TING!</b>\nThành viên (${user.firstName}) bạn mời vừa xác minh tài khoản thành công.\n🎁 Bạn được cộng thêm phần thưởng xác minh <b>+10 SWGT</b> (Đã hoàn tất 20 SWGT/người)!`, {parse_mode: 'HTML'}).catch(()=>{});
                        }
                    }

                    bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Tuyệt vời! Xác minh thành công, +20 SWGT.", show_alert: true });
                    bot.sendMessage(chatId, "🔥 <b>XÁC MINH TÀI KHOẢN THÀNH CÔNG!</b>\n\nHệ thống đã ghi nhận bạn là Nhà đầu tư thật.\n🎁 <b>Phần thưởng:</b> +20 SWGT.\n\n👉 <i>Bấm mở App ngay để kết nối ví nhận thêm +10 SWGT nữa nhé!</i>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]] }});
                } else {
                    bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã hoàn thành nhiệm vụ này và nhận thưởng rồi nhé!", show_alert: true });
                }
            }
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Bạn chưa tham gia đủ Kênh và Nhóm. Hãy làm ngay kẻo mất phần thưởng!", show_alert: true });
        }
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
                [{ text: "🎁 NHẬN THƯỞNG CHIA SẺ", callback_data: 'claim_share' }]
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
        const diffInHours = Math.abs(now - lastTask) / 36e5;
        
        if (diffInHours < 24) {
            const waitHours = Math.ceil(24 - diffInHours);
            bot.answerCallbackQuery(callbackQuery.id, { text: `⏳ Bạn đã nhận thưởng đọc bài hôm nay rồi! Quay lại sau ${waitHours} tiếng nhé.`, show_alert: true });
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
        if (user.youtubeTaskDone) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã hoàn thành nhiệm vụ này rồi!", show_alert: true });
        }
        user.youtubeClickTime = new Date();
        await user.save();
        bot.sendMessage(chatId, "▶️ <b>NHIỆM VỤ YOUTUBE (Bắt đầu tính giờ)</b>\n\nHãy bấm nút bên dưới mở YouTube. Xem video ít nhất <b>6 giây</b> để hệ thống ghi nhận, sau đó quay lại đây bấm Nhận thưởng!", {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: "👉 MỞ KÊNH YOUTUBE", url: YOUTUBE_LINK }]] }
        });
    }
    else if (data === 'claim_youtube') {
        if (user.youtubeTaskDone) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã nhận phần thưởng YouTube này rồi!", show_alert: true });
        }
        if (!user.youtubeClickTime) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn chưa bấm nút XEM YOUTUBE ở bước trên!", show_alert: true });
        }
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
        if (user.facebookTaskDone) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã theo dõi Fanpage rồi!", show_alert: true });
        }
        user.facebookClickTime = new Date();
        await user.save();
        bot.sendMessage(chatId, "📘 <b>NHIỆM VỤ FANPAGE</b>\n\nHãy bấm nút bên dưới để mở Facebook. Nhấn Like/Theo dõi trang và nán lại khoảng <b>5 giây</b> trước khi quay lại nhận thưởng nhé!", {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: "👉 MỞ FANPAGE FACEBOOK", url: FACEBOOK_LINK }]] }
        });
    }
    else if (data === 'claim_facebook') {
        if (user.facebookTaskDone) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã nhận phần thưởng Fanpage này rồi!", show_alert: true });
        }
        if (!user.facebookClickTime) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn chưa bấm nút THEO DÕI FANPAGE ở bước trên!", show_alert: true });
        }
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
        bot.sendMessage(chatId, "📢 <b>NHIỆM VỤ CHIA SẺ</b>\n\nHãy bấm nút bên dưới để chọn một người bạn hoặc một nhóm và chuyển tiếp tin nhắn. Hệ thống cần khoảng <b>5 giây</b> để quét hành vi, sau đó bạn quay lại đây để nhận thưởng!", {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: "👉 CHỌN NGƯỜI ĐỂ CHIA SẺ", url: shareUrl }]] }
        });
    }
    else if (data === 'claim_share') {
        if (!user.shareClickTime) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn chưa bấm nút CHIA SẺ MXH ở bước trên!", show_alert: true });
        }
        const timeSpent = (new Date() - new Date(user.shareClickTime)) / 1000;
        if (timeSpent < 5) { 
            return bot.answerCallbackQuery(callbackQuery.id, { text: `⚠️ Thao tác quá nhanh! Hệ thống chưa kịp ghi nhận. Vui lòng bấm nút chia sẻ và gửi cho bạn bè thật nhé.`, show_alert: true });
        }
        const now = new Date();
        const lastShare = user.lastShareTask ? new Date(user.lastShareTask) : new Date(0);
        const diffInHours = Math.abs(now - lastShare) / 36e5;
        
        if (diffInHours < 24) {
            const waitHours = Math.ceil(24 - diffInHours);
            bot.answerCallbackQuery(callbackQuery.id, { text: `⏳ Bạn đã nhận thưởng chia sẻ hôm nay rồi! Quay lại sau ${waitHours} tiếng nhé.`, show_alert: true });
        } else {
            user.balance += 15; 
            user.lastShareTask = now;
            await user.save();
            bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Cảm ơn bạn đã lan tỏa dự án! +15 SWGT đã được cộng vào ví.", show_alert: true });
        }
    }

    else if (data === 'task_3') {
        const textTask3 = `🚀 <b>CƠ HỘI BỨT PHÁ - X10 TÀI SẢN</b>\n\nBạn đã mời được: <b>${user.referralCount || 0} người</b>.\n\n🔗 <b>Link giới thiệu của bạn:</b>\nhttps://t.me/Dau_Tu_SWC_bot?start=${userId}\n\n💎 Nhận ngay <b>+20 SWGT</b> cho mỗi lượt mời thành công.\n\n👑 <b>THƯỞNG MỐC ĐẶC BIỆT:</b>\n- Đạt 10 lượt mời: Thưởng nóng <b>+50 SWGT</b>\n- Đạt 50 lượt mời: Thưởng nóng <b>+300 SWGT</b>`;
        bot.sendMessage(chatId, textTask3, { parse_mode: 'HTML' });
    } 
    
    else if (data === 'task_4') {
        const task4Text = `🏆 <b>KHO LƯU TRỮ ĐẶC QUYỀN VIP</b>\n\nSWGT là quyền lực của bạn! Dùng số dư quy đổi lấy "vũ khí" thực chiến:\n\n🔓 <b>1. Mở Khóa Group Private (500 SWGT)</b>\n☕️ <b>2. Cà Phê Chiến Lược 1:1 (300 SWGT)</b>\n🎟 <b>3. Voucher Ưu Đãi Đầu Tư (1000 SWGT)</b>\n\n👉 <i>Bấm mở App để quy đổi!</i>`;
        bot.sendMessage(chatId, task4Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP ĐỂ QUY ĐỔI", web_app: { url: webAppUrl } }]] }});
    }

    const validCallbacks = ['check_join', 'claim_read', 'go_read', 'claim_share', 'go_share', 'go_youtube', 'claim_youtube', 'go_facebook', 'claim_facebook', 'task_1', 'task_2', 'task_3', 'task_4'];
    if (!validCallbacks.includes(data)) {
        bot.answerCallbackQuery(callbackQuery.id);
    }
});
