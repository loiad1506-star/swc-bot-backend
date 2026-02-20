const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');
const mongoose = require('mongoose');

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG ---
const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGODB_URI;
const bot = new TelegramBot(token, {polling: true});
const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';

const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';

// --- KẾT NỐI MONGODB (KÉT SẮT DỮ LIỆU) ---
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Đã kết nối thành công với kho dữ liệu MongoDB!'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// --- TẠO CẤU TRÚC LƯU TRỮ NGƯỜI DÙNG (Cập nhật thêm lưu số tin nhắn) ---
const userSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    firstName: { type: String, default: '' }, 
    lastName: { type: String, default: '' },  
    username: { type: String, default: '' },  
    balance: { type: Number, default: 0 },
    wallet: { type: String, default: '' },
    referredBy: { type: String, default: null }, 
    referralCount: { type: Number, default: 0 }, 
    task1Done: { type: Boolean, default: false }, 
    walletRewardDone: { type: Boolean, default: false }, 
    lastDailyTask: { type: Date, default: null }, 
    readTaskStartTime: { type: Date, default: null }, 
    lastShareTask: { type: Date, default: null },
    groupMessageCount: { type: Number, default: 0 } // BỔ SUNG: Theo dõi số tin nhắn trên nhóm
});
const User = mongoose.model('User', userSchema);

// --- 1. API SERVER CHO MINI APP ---
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.end(); return; }
    const parsedUrl = url.parse(req.url, true);
    
    // Lấy thông tin user
    if (parsedUrl.pathname === '/api/user' && req.method === 'GET') {
        const userId = parsedUrl.query.id;
        let userData = await User.findOne({ userId: userId });
        if (!userData) userData = { balance: 0, wallet: '', referralCount: 0 };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(userData));
    } 
    // Lưu ví và thưởng
    else if (parsedUrl.pathname === '/api/save-wallet' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (user) {
                    user.wallet = data.wallet;
                    if (!user.walletRewardDone) {
                        user.balance += 10;
                        user.walletRewardDone = true;
                        bot.sendMessage(data.userId, `🎉 <b>CHÚC MỪNG!</b>\nBạn đã kết nối ví thành công và được cộng <b>+10 SWGT</b> vào tài khoản!`, {parse_mode: 'HTML'});
                    }
                    await user.save();
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    } else {
        res.writeHead(200); res.end('API SWC Online!\n');
    }
});
server.listen(process.env.PORT || 3000, () => console.log(`[HỆ THỐNG] Máy chủ API đang chạy`));

// --- 2. HÀM KIỂM TRA THÀNH VIÊN ---
async function checkMembership(userId) {
    try {
        const channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        const validStatuses = ['member', 'administrator', 'creator'];
        return { 
            inChannel: validStatuses.includes(channelMember.status), 
            inGroup: validStatuses.includes(groupMember.status) 
        };
    } catch (error) { return { error: true }; }
}

// --- 3. XỬ LÝ LỆNH /start ---
bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== 'private') return; // Chặn spam trong nhóm

    const userId = msg.from.id.toString();
    const refId = match[1].trim(); 

    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username ? `@${msg.from.username}` : '';

    let user = await User.findOne({ userId: userId });
    let isNewUser = false;

    if (!user) {
        isNewUser = true;
        user = new User({ 
            userId: userId, firstName: firstName, lastName: lastName, username: username 
        });
        
        // --- XỬ LÝ REF ---
        if (refId && refId !== userId) {
            user.referredBy = refId;
            let referrer = await User.findOne({ userId: refId });
            if (referrer) {
                referrer.balance += 20; 
                referrer.referralCount += 1;
                await referrer.save();
                bot.sendMessage(refId, `🔥 <b>TING TING!</b>\nCó NĐT (${firstName}) vừa tham gia.\n🎁 Bạn được thưởng nóng <b>+20 SWGT</b>!`, {parse_mode: 'HTML'});
            }
        }
    } else {
        user.firstName = firstName; user.lastName = lastName; user.username = username;
    }
    await user.save();
    
    const opts = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "1️⃣ Nhiệm vụ Tân binh", callback_data: 'task_1' }],
                [{ text: "2️⃣ Nhiệm vụ Kiến thức", callback_data: 'task_2' }],
                [{ text: "3️⃣ Tăng trưởng (Mời bạn bè)", callback_data: 'task_3' }],
                [{ text: "🎁 Đặc quyền & Đổi thưởng", callback_data: 'task_4' }],
                [{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]
            ]
        }
    };
    
    let welcomeText = `👋 <b>Chào mừng bạn đến với Cộng Đồng SWC Việt Nam!</b> 🚀\n\nBạn đã bước chân vào trung tâm kết nối của những nhà đầu tư tiên phong. Cơ hội sở hữu trước token SWGT và đón đầu xu hướng công nghệ giao thông uST đang ở ngay trước mắt, nhưng số lượng thì có hạn!\n\n🎁 <b>Quà tặng Tân Binh:</b> Nhận ngay những đồng SWGT đầu tiên hoàn toàn miễn phí.\n\n👇 <b>HÀNH ĐỘNG NGAY:</b> Bấm nút <b>"MỞ ỨNG DỤNG SWC NGAY"</b> bên dưới để kích hoạt ví và gia tăng tài sản!`;
    
    if (isNewUser && refId && refId !== userId) {
        welcomeText = `🎉 <i>Bạn được mời bởi thành viên ID: ${refId}</i>\n\n` + welcomeText;
    }
    bot.sendMessage(chatId, welcomeText, opts);
});

// --- 4. CAMERA CHẠY NGẦM: LỌC BOT, ĐẾM TIN NHẮN & CỘNG TIỀN (CHAT-TO-EARN) ---
bot.on('message', async (msg) => {
    // Chỉ hoạt động khi tin nhắn nằm trong nhóm
    if (msg.chat.type === 'private') return;
    
    // CHỐNG CLONE/BOT: Nếu người gửi là Bot -> Bỏ qua ngay lập tức
    if (msg.from.is_bot) return;

    // Đảm bảo chỉ bắt tin nhắn ở đúng Nhóm Thảo Luận của bạn
    if (msg.chat.username && msg.chat.username.toLowerCase() !== GROUP_USERNAME.replace('@', '').toLowerCase()) return;

    // LỌC ADMIN: Bỏ qua không tính điểm cho Admin/Creator
    try {
        const member = await bot.getChatMember(msg.chat.id, msg.from.id);
        if (['administrator', 'creator'].includes(member.status)) return;
    } catch(e) { console.error("Lỗi check admin:", e.message); }

    // Chỉ đếm tin nhắn có văn bản
    if (!msg.text) return;

    const userId = msg.from.id.toString();
    let user = await User.findOne({ userId: userId });
    
    if (!user) {
        user = new User({ 
            userId: userId, 
            firstName: msg.from.first_name || '', 
            lastName: msg.from.last_name || '', 
            username: msg.from.username ? `@${msg.from.username}` : '' 
        });
    }

    // 1. Tăng bộ đếm để hoàn thành nhiệm vụ Tân Binh (Yêu cầu 2 tin)
    user.groupMessageCount += 1;

    // 2. Chat-To-Earn: Tin nhắn từ 10 ký tự trở lên -> Cộng 0.3 SWGT
    if (msg.text.trim().length >= 10) {
        // Cộng 0.3 và làm tròn 2 chữ số thập phân để tránh lỗi của JavaScript
        user.balance = Math.round((user.balance + 0.3) * 100) / 100;
    }

    await user.save();
});

// --- 5. XỬ LÝ NÚT BẤM (Cập nhật điều kiện Tân Binh) ---
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    const firstName = callbackQuery.from.first_name || '';
    const lastName = callbackQuery.from.last_name || '';
    const username = callbackQuery.from.username ? `@${callbackQuery.from.username}` : '';

    let user = await User.findOne({ userId: userId });
    if (!user) {
        user = new User({ userId: userId, firstName: firstName, lastName: lastName, username: username });
    } else {
        user.firstName = firstName; user.lastName = lastName; user.username = username;
    }
    await user.save();

    // --- NÚT 1: TÂN BINH ---
    if (data === 'task_1') {
        const opts = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔵 Join Kênh Thông tin uST", url: "https://t.me/swc_capital_vn" }],
                    [{ text: "💬 Join Group Cộng Đồng SWC", url: "https://t.me/swc_capital_chat" }],
                    [{ text: "✅ KIỂM TRA & NHẬN THƯỞNG", callback_data: 'check_join' }]
                ]
            }
        };
        // Đã cập nhật Text hướng dẫn luật 2 tin nhắn
        const task1Text = `🎯 <b>BƯỚC 1: LẤY VỐN KHỞI NGHIỆP</b>\n\nHoàn thành ngay để "bỏ túi" <b>30 SWGT</b> đầu tiên:\n\n1️⃣ <b>Join Kênh & Group Cộng Đồng SWC Việt Nam</b> (+20 SWGT).\n2️⃣ <b>Gửi ít nhất 2 tin nhắn chào hỏi</b> lên Group để xác minh bạn là NĐT thật.\n3️⃣ <b>Mở App Kết nối Ví Crypto</b> (+10 SWGT).\n\n⚠️ <i>Lưu ý: Rời nhóm = Trừ sạch điểm số. Cố gắng lên nhé!</i>`;
        bot.sendMessage(chatId, task1Text, opts);
    } 
    
    // --- KIỂM TRA THAM GIA NHÓM (CẬP NHẬT KIỂM TRA 2 TIN NHẮN) ---
    else if (data === 'check_join') {
        const status = await checkMembership(userId);
        if (status.error) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bot chưa được cấp quyền Admin trong Nhóm/Kênh!", show_alert: true });
        } else if (status.inChannel && status.inGroup) {
            
            // KIỂM TRA ĐIỀU KIỆN 2 TIN NHẮN CHÁT TRONG NHÓM
            if (user.groupMessageCount < 2) {
                bot.answerCallbackQuery(callbackQuery.id, { 
                    text: `❌ TÀI KHOẢN CHƯA XÁC MINH!\n\nBạn đã vào nhóm nhưng chưa gửi đủ 2 tin nhắn. Bạn mới gửi: ${user.groupMessageCount}/2.\n\nHãy vào Nhóm nhắn tin chào hỏi rồi quay lại kiểm tra nhé!`, 
                    show_alert: true 
                });
            } else {
                if (!user.task1Done) {
                    user.balance += 20; 
                    user.task1Done = true;
                    await user.save();
                    
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
    
    // ... (Toàn bộ các logic nút Task_2, Task_3, Task_4 cũ của bạn được GIỮ NGUYÊN HOÀN TOÀN TỪ ĐÂY) ...
    else if (data === 'task_2') {
        user.readTaskStartTime = new Date();
        await user.save();

        const task2Text = `🧠 <b>NẠP KIẾN THỨC & LAN TỎA (Nhiệm vụ hàng ngày)</b>\n\n` +
                          `<b>1. NGUỒN VỐN TRÍ TUỆ (+10 SWGT)</b>\n` +
                          `⏱ Yêu cầu: Bấm đọc 1 bài viết bất kỳ trên web đủ 60 giây.\n\n` +
                          `<b>2. SỨ GIẢ LAN TỎA (+10 SWGT)</b>\n` +
                          `📢 Yêu cầu: Chia sẻ dự án lên các nhóm chat hoặc mạng xã hội.\n\n` +
                          `<i>Lưu ý: Hệ thống đếm giờ tự động. Nếu chưa đủ 60s sẽ không thể nhận thưởng!</i>`;
        
        bot.sendMessage(chatId, task2Text, { 
            parse_mode: 'HTML', 
            reply_markup: { inline_keyboard: [
                [{ text: "📖 ĐỌC BÀI VIẾT (Đợi 60s)", url: "https://hovanloi.net" }],
                [{ text: "🎁 NHẬN THƯỞNG ĐỌC BÀI (+10 SWGT)", callback_data: 'claim_read' }],
                [{ text: "📢 CHIA SẺ LÊN NHÓM CHAT", url: "https://t.me/share/url?url=https://t.me/Dau_Tu_SWC_bot&text=Cơ%20hội%20nhận%20SWGT%20miễn%20phí%20từ%20Cộng%20Đồng%20SWC!" }],
                [{ text: "🎁 NHẬN THƯỞNG CHIA SẺ (+10 SWGT)", callback_data: 'claim_share' }]
            ] } 
        });
    } 
    
    else if (data === 'claim_read') {
        const now = new Date();
        const startTime = user.readTaskStartTime ? new Date(user.readTaskStartTime) : now;
        const timeSpent = (now - startTime) / 1000; 
        
        const lastTask = user.lastDailyTask ? new Date(user.lastDailyTask) : new Date(0);
        const diffInHours = Math.abs(now - lastTask) / 36e5;
        
        if (diffInHours < 24) {
            const waitHours = Math.ceil(24 - diffInHours);
            bot.answerCallbackQuery(callbackQuery.id, { text: `⏳ Bạn đã nhận thưởng đọc bài hôm nay rồi! Quay lại sau ${waitHours} tiếng nhé.`, show_alert: true });
        } else if (timeSpent < 60) {
            bot.answerCallbackQuery(callbackQuery.id, { text: `⚠️ Bạn chưa đọc đủ 1 phút! Hãy nán lại trang web lâu hơn nhé!`, show_alert: true });
        } else {
            user.balance += 10;
            user.lastDailyTask = now;
            await user.save();
            bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Tuyệt vời! Bạn đã nhận thành công +10 SWGT cho nhiệm vụ đọc bài!", show_alert: true });
        }
    }

    else if (data === 'claim_share') {
        const now = new Date();
        const lastShare = user.lastShareTask ? new Date(user.lastShareTask) : new Date(0);
        const diffInHours = Math.abs(now - lastShare) / 36e5;
        
        if (diffInHours < 24) {
            const waitHours = Math.ceil(24 - diffInHours);
            bot.answerCallbackQuery(callbackQuery.id, { text: `⏳ Bạn đã nhận thưởng chia sẻ hôm nay rồi! Quay lại sau ${waitHours} tiếng nhé.`, show_alert: true });
        } else {
            user.balance += 10;
            user.lastShareTask = now;
            await user.save();
            bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Cảm ơn bạn đã lan tỏa dự án! +10 SWGT đã được cộng vào ví.", show_alert: true });
        }
    }

    else if (data === 'task_3') {
        const textTask3 = `🚀 <b>CƠ HỘI BỨT PHÁ - X10 TÀI SẢN</b>\n\nBạn đã mời được: <b>${user.referralCount || 0} người</b>.\n\n🔗 <b>Link giới thiệu của bạn:</b>\nhttps://t.me/Dau_Tu_SWC_bot?start=${userId}\n\n💎 Nhận ngay <b>+20 SWGT</b> cho mỗi lượt mời thành công. Hãy rải link ngay hôm nay trước khi thị trường bão hòa!`;
        bot.sendMessage(chatId, textTask3, { parse_mode: 'HTML' });
    } 
    
    else if (data === 'task_4') {
        const task4Text = `🏆 <b>KHO LƯU TRỮ ĐẶC QUYỀN VIP</b>\n\nSWGT là quyền lực của bạn! Dùng số dư quy đổi lấy "vũ khí" thực chiến:\n\n🔓 <b>1. Mở Khóa Group Private (500 SWGT)</b>\n☕️ <b>2. Cà Phê Chiến Lược 1:1 (300 SWGT)</b>\n🎟 <b>3. Voucher Ưu Đãi Đầu Tư (1000 SWGT)</b>\n\n👉 <i>Bấm mở App để quy đổi!</i>`;
        bot.sendMessage(chatId, task4Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP ĐỂ QUY ĐỔI", web_app: { url: webAppUrl } }]] }});
    }

    if (!['check_join', 'claim_read', 'claim_share'].includes(data)) {
        bot.answerCallbackQuery(callbackQuery.id);
    }
});
