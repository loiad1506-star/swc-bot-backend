const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');
const mongoose = require('mongoose');

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG ---
const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGODB_URI; // Mã kết nối MongoDB của bạn
const bot = new TelegramBot(token, {polling: true});
const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';

const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';

// --- KẾT NỐI MONGODB (KÉT SẮT DỮ LIỆU) ---
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Đã kết nối thành công với kho dữ liệu MongoDB!'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// --- TẠO CẤU TRÚC LƯU TRỮ NGƯỜI DÙNG ---
const userSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    balance: { type: Number, default: 0 },
    wallet: { type: String, default: '' },
    referredBy: { type: String, default: null }, // ID của người đã mời
    referralCount: { type: Number, default: 0 }, // Số người đã mời
    task1Done: { type: Boolean, default: false }, // Đã làm NV Tân binh chưa
    walletRewardDone: { type: Boolean, default: false }, // Đã nhận thưởng ví chưa
    lastDailyTask: { type: Date, default: null } // Lần cuối làm NV Hàng ngày
});
const User = mongoose.model('User', userSchema);

// --- 1. API SERVER CHO MINI APP ---
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.end(); return; }
    const parsedUrl = url.parse(req.url, true);
    
    // API: Lấy thông tin user hiển thị lên App
    if (parsedUrl.pathname === '/api/user' && req.method === 'GET') {
        const userId = parsedUrl.query.id;
        let userData = await User.findOne({ userId: userId });
        if (!userData) userData = { balance: 0, wallet: '', referralCount: 0 };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(userData));
    } 
    // API: Lưu ví từ App gửi về và cộng thưởng
    else if (parsedUrl.pathname === '/api/save-wallet' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let user = await User.findOne({ userId: data.userId });
                if (user) {
                    user.wallet = data.wallet;
                    // Nếu chưa nhận thưởng nối ví thì cộng 10 SWGT
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
    } catch (error) { 
        return { error: true }; 
    }
}

// --- 3. XỬ LÝ LỆNH /start ---
bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const refId = match[1].trim(); 

    // Tìm hoặc tạo người dùng mới trong Két sắt MongoDB
    let user = await User.findOne({ userId: userId });
    let isNewUser = false;

    if (!user) {
        isNewUser = true;
        user = new User({ userId: userId });
        
        // --- XỬ LÝ NGƯỜI GIỚI THIỆU (REF) ---
        if (refId && refId !== userId) {
            user.referredBy = refId;
            let referrer = await User.findOne({ userId: refId });
            if (referrer) {
                referrer.balance += 20; // Thưởng 20 SWGT cho người mời
                referrer.referralCount += 1;
                await referrer.save();
                
                // Thông báo ngay cho người mời (Yêu cầu số 6)
                bot.sendMessage(refId, `🔥 <b>TING TING!</b>\nCó một NĐT vừa tham gia qua link giới thiệu của bạn.\n🎁 Bạn được thưởng nóng <b>+20 SWGT</b>!\n👉 <i>Mở App để kiểm tra số dư và tổng số lượt mời nhé!</i>`, {parse_mode: 'HTML'});
            }
        }
        await user.save();
    }
    
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

// --- 4. XỬ LÝ NÚT BẤM VÀ CỘNG TIỀN ---
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    // Lấy thông tin người dùng từ DB
    let user = await User.findOne({ userId: userId });
    if (!user) {
        user = new User({ userId: userId });
        await user.save();
    }

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
        const task1Text = `🎯 <b>BƯỚC 1: LẤY VỐN KHỞI NGHIỆP</b>\n\nHoàn thành ngay để "bỏ túi" <b>30 SWGT</b> đầu tiên:\n\n1️⃣ <b>Join Kênh & Group Cộng Đồng SWC Việt Nam</b> (+20 SWGT).\n2️⃣ <b>Mở App Kết nối Ví Crypto</b> (+10 SWGT).\n\n⚠️ <i>Lưu ý: Rời nhóm = Trừ sạch điểm số. Cố gắng lên nhé!</i>`;
        bot.sendMessage(chatId, task1Text, opts);
    } 
    
    // --- KIỂM TRA THAM GIA NHÓM ---
    else if (data === 'check_join') {
        const status = await checkMembership(userId);
        if (status.error) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bot chưa được cấp quyền Admin trong Nhóm/Kênh!", show_alert: true });
        } else if (status.inChannel && status.inGroup) {
            if (!user.task1Done) {
                user.balance += 20; // Thưởng 20 SWGT như yêu cầu
                user.task1Done = true;
                await user.save();
                
                bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Tuyệt vời! Bạn đã được cộng +20 SWGT.", show_alert: true });
                bot.sendMessage(chatId, "🔥 <b>NHIỆM VỤ HOÀN THÀNH!</b>\n\nHệ thống đã ghi nhận bạn tham gia đầy đủ 2 nhóm.\n🎁 <b>Phần thưởng:</b> +20 SWGT.\n\n👉 <i>Bấm mở App ngay để kết nối ví nhận thêm +10 SWGT nữa nhé!</i>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]] }});
            } else {
                bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã hoàn thành nhiệm vụ này và nhận thưởng rồi nhé!", show_alert: true });
            }
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Bạn chưa tham gia đủ Kênh và Nhóm. Hãy làm ngay kẻo mất phần thưởng!", show_alert: true });
        }
    }
    
    // --- NÚT 2: KIẾN THỨC ---
    else if (data === 'task_2') {
        const task2Text = `🧠 <b>NẠP KIẾN THỨC - KIẾM TIỀN MỖI NGÀY</b>\n\nDành đúng 1 phút để đọc báo cáo phân tích mới nhất về uTerra & tiềm năng vận tải dây trên hovanloi.net.\n\n⏱ <b>Luật chơi:</b> Bấm link -> Đọc bài -> Quay lại bấm xác nhận.\n🎁 <b>Phần thưởng:</b> +5 SWGT/ngày.`;
        
        bot.sendMessage(chatId, task2Text, { 
            parse_mode: 'HTML', 
            reply_markup: { inline_keyboard: [
                [{ text: "📖 BƯỚC 1: ĐỌC BÀI NGAY", url: "https://hovanloi.net" }],
                [{ text: "🎁 BƯỚC 2: NHẬN THƯỞNG (+5 SWGT)", callback_data: 'claim_daily' }]
            ] } 
        });
    } 
    
    // --- XÁC NHẬN NHẬN THƯỞNG HÀNG NGÀY ---
    else if (data === 'claim_daily') {
        const now = new Date();
        const lastTask = user.lastDailyTask ? new Date(user.lastDailyTask) : new Date(0);
        
        // Kiểm tra xem đã qua 24 giờ kể từ lần cuối nhận chưa
        const diffInHours = Math.abs(now - lastTask) / 36e5;
        
        if (diffInHours >= 24) {
            user.balance += 5;
            user.lastDailyTask = now;
            await user.save();
            bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Bạn đã đọc bài và nhận thành công +5 SWGT hôm nay!", show_alert: true });
        } else {
            const waitHours = Math.ceil(24 - diffInHours);
            bot.answerCallbackQuery(callbackQuery.id, { text: `⏳ Bạn đã nhận thưởng hôm nay rồi! Vui lòng quay lại sau ${waitHours} tiếng nữa nhé.`, show_alert: true });
        }
    }

    // --- NÚT 3: TĂNG TRƯỞNG ---
    else if (data === 'task_3') {
        const textTask3 = `🚀 <b>CƠ HỘI BỨT PHÁ - X10 TÀI SẢN</b>\n\nBạn đã mời được: <b>${user.referralCount || 0} người</b>.\n\n🔗 <b>Link giới thiệu của bạn:</b>\nhttps://t.me/Dau_Tu_SWC_bot?start=${userId}\n\n💎 Nhận ngay <b>+20 SWGT</b> cho mỗi lượt mời thành công. Hãy rải link ngay hôm nay trước khi thị trường bão hòa!`;
        bot.sendMessage(chatId, textTask3, { parse_mode: 'HTML' });
    } 
    
    // --- NÚT 4: ĐỔI THƯỞNG ---
    else if (data === 'task_4') {
        const task4Text = `🏆 <b>KHO LƯU TRỮ ĐẶC QUYỀN VIP</b>\n\nSWGT là quyền lực của bạn! Dùng số dư quy đổi lấy "vũ khí" thực chiến:\n\n🔓 <b>1. Mở Khóa Group Private (500 SWGT)</b>\n☕️ <b>2. Cà Phê Chiến Lược 1:1 (300 SWGT)</b>\n🎟 <b>3. Voucher Ưu Đãi Đầu Tư (1000 SWGT)</b>\n\n👉 <i>Bấm mở App để quy đổi!</i>`;
        bot.sendMessage(chatId, task4Text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 MỞ APP ĐỂ QUY ĐỔI", web_app: { url: webAppUrl } }]] }});
    }

    if (data !== 'check_join' && data !== 'claim_daily') {
        bot.answerCallbackQuery(callbackQuery.id);
    }
});
