const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');

const userDB = {}; // Nơi lưu trữ tiền tạm thời

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});
const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';

const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';

// --- 1. API SERVER CHO MINI APP ---
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.end(); return; }

    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/api/user' && req.method === 'GET') {
        const userId = parsedUrl.query.id;
        const userData = userDB[userId] || { balance: 0, wallet: '' };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(userData));
    } 
    else if (parsedUrl.pathname === '/api/save-wallet' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (!userDB[data.userId]) userDB[data.userId] = { balance: 0, wallet: '' };
                userDB[data.userId].wallet = data.wallet;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('API SWC Online!\n');
    }
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`[HỆ THỐNG] Đã khởi chạy trên cổng ${port}`));

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

// --- 3. XỬ LÝ LỆNH /start (KỊCH BẢN 1) ---
bot.onText(/\/start(.*)/, (msg, match) => {
    const chatId = msg.chat.id;
    const refId = match[1].trim(); 
    
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
    
    let welcomeText = `👋 <b>Chào mừng bạn đến với Cộng Đồng SWC Việt Nam!</b> 🚀\n\nBạn đã bước chân vào trung tâm kết nối của những nhà đầu tư tiên phong. Cơ hội sở hữu trước token SWGT và đón đầu xu hướng công nghệ giao thông uST đang ở ngay trước mắt, nhưng số lượng thì có hạn!\n\n🎁 <b>Quà tặng Tân Binh:</b> Nhận ngay những đồng SWGT đầu tiên hoàn toàn miễn phí.\n\n👇 <b>HÀNH ĐỘNG NGAY:</b> Bấm nút <b>"MỞ ỨNG DỤNG SWC NGAY"</b> bên dưới để kích hoạt ví và gia tăng tài sản của bạn trước khi sự kiện kết thúc!`;
    
    if (refId && refId !== chatId.toString()) {
        welcomeText = `🎉 <i>Bạn được mời bởi thành viên ID: ${refId}</i>\n\n` + welcomeText;
    }

    bot.sendMessage(chatId, welcomeText, opts);
});

// --- 4. XỬ LÝ NÚT BẤM VÀ CỘNG TIỀN ---
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    // --- NÚT 1: TÂN BINH (KỊCH BẢN 2) ---
    if (data === 'task_1') {
        const opts = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔵 Join Kênh Thông tin uST", url: "https://t.me/swc_capital_vn" }],
                    [{ text: "💬 Join Group Thảo luận TCL", url: "https://t.me/swc_capital_chat" }],
                    [{ text: "✅ KIỂM TRA & NHẬN THƯỞNG", callback_data: 'check_join' }]
                ]
            }
        };
        const task1Text = `🎯 <b>BƯỚC 1: LẤY VỐN KHỞI NGHIỆP</b>\n\nChỉ còn một lượng nhỏ suất nhận thưởng trong hôm nay! Hoàn thành ngay để "bỏ túi" <b>30 SWGT</b> đầu tiên:\n\n1️⃣ <b>Join Kênh Thông tin</b> (+10 SWGT) - Cập nhật tin nội bộ.\n2️⃣ <b>Join Group Thảo luận</b> (+10 SWGT) - Nhận phím kèo & chiến lược.\n3️⃣ <b>Mở App Kết nối Ví Crypto</b> (+10 SWGT) - Chuẩn bị nhận lúa.\n\n⚠️ <i>Lưu ý: Hệ thống quét tự động 24/7. Rời nhóm = Trừ sạch điểm số. Đừng để tuột mất thành quả của bạn!</i>`;
        
        bot.sendMessage(chatId, task1Text, opts);
    } 
    
    // --- NÚT KIỂM TRA THAM GIA ---
    else if (data === 'check_join') {
        const status = await checkMembership(userId);
        if (status.error) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Hệ thống đang bảo trì hoặc Bot chưa được cấp quyền Admin!", show_alert: true });
        } else if (status.inChannel && status.inGroup) {
            if (!userDB[userId]) userDB[userId] = { balance: 0, wallet: '' };
            
            if (userDB[userId].balance === 0) {
                userDB[userId].balance = 10; 
                bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Tuyệt vời! Hệ thống đã xác nhận bạn tham gia đầy đủ! +10 SWGT.", show_alert: true });
                
                const successOpts = {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]
                        ]
                    }
                };
                bot.sendMessage(chatId, "🔥 <b>BẠN ĐÃ LƯU TRỮ THÀNH CÔNG!</b>\n\nHệ thống đã ghi nhận bạn tham gia.\n🎁 <b>Phần thưởng:</b> +10 SWGT.\n\n👉 <i>Bấm mở App ngay để kết nối ví nhận thêm thưởng và kiểm tra số dư!</i>", successOpts);
            } else {
                bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã hoàn thành nhiệm vụ này và nhận thưởng rồi nhé!", show_alert: true });
            }
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Bạn chưa tham gia đủ Kênh và Nhóm. Hãy làm ngay kẻo mất phần thưởng!", show_alert: true });
        }
    }
    
    // --- NÚT 2: KIẾN THỨC (KỊCH BẢN 3) ---
    else if (data === 'task_2') {
        const task2Text = `🧠 <b>NẠP KIẾN THỨC - KIẾM TIỀN MỖI NGÀY</b>\n\nTrong đầu tư, "Thông tin là Tiền". Đừng để người khác đi trước bạn!\n\nDành đúng 1 phút hôm nay để đọc báo cáo phân tích mới nhất về uTerra & tiềm năng vận tải dây.\n\n⏱ <b>Luật chơi:</b> Bấm link -> Đọc và ở lại trang 60 giây -> Quay lại App.\n🎁 <b>Phần thưởng:</b> +5 SWGT <i>(Chỉ áp dụng cho 500 người đầu tiên hôm nay)</i>.`;
        
        bot.sendMessage(chatId, task2Text, { 
            parse_mode: 'HTML', 
            reply_markup: { inline_keyboard: [[{ text: "📖 ĐỌC BÀI & NHẬN THƯỞNG", url: "https://hovanloi.net" }]] } 
        });
    } 
    
    // --- NÚT 3: TĂNG TRƯỞNG (KỊCH BẢN 4 - GIAO THOA VỚI CƠ CẤU CỦA BẠN) ---
    else if (data === 'task_3') {
        const textTask3 = `🚀 <b>CƠ HỘI BỨT PHÁ - X10 TÀI SẢN</b>\n\nBạn muốn dừng lại ở số dư hiện tại, hay muốn sở hữu hàng ngàn SWGT như các Top Leader? Hãy rải link độc quyền của bạn ngay:\n\n🔗 <b>Link của bạn:</b> https://t.me/Dau_Tu_SWC_bot?start=${userId}\n\n💎 <b>CƠ CẤU PHẦN THƯỞNG:</b>\n📌 <b>Thành viên Thường:</b>\n- Tham gia Channel: +10 SWGT/người\n- Tham gia Nhóm Chat: +10 SWGT/người\n\n⭐ <b>Thành Viên Premium (+5 SWGT):</b>\n- Tham gia Channel: +20 SWGT/người\n- Tham gia Nhóm Chat: +20 SWGT/người\n- 💫 Cộng ngay: +5 SWGT bonus!\n\n👉 <i>Vị thế của bạn phụ thuộc vào cộng đồng của bạn. Bắt đầu ngay hôm nay trước khi thị trường bão hòa!</i>`;

        bot.sendMessage(chatId, textTask3, { parse_mode: 'HTML' });
    } 
    
    // --- NÚT 4: ĐỔI THƯỞNG (KỊCH BẢN 5) ---
    else if (data === 'task_4') {
        const task4Text = `🏆 <b>KHO LƯU TRỮ ĐẶC QUYỀN VIP</b>\n\nSWGT không chỉ là con số, nó là quyền lực của bạn! Dùng số dư hiện tại để quy đổi lấy "vũ khí" thực chiến:\n\n🔓 <b>1. Mở Khóa Group Private (500 SWGT):</b> Vé vàng vào nhóm kín NĐH - Nhận chiến lược & tín hiệu VIP.\n☕️ <b>2. Cà Phê Chiến Lược 1:1 (300 SWGT):</b> 1 buổi tư vấn danh mục đầu tư trực tiếp tại Ucity Coffee <i>(Chỉ còn 3 slot tuần này!)</i>\n🎟 <b>3. Voucher Ưu Đãi Đầu Tư (1000 SWGT):</b> Trực tiếp quy đổi thành chiết khấu tiền mặt khi mua các gói sở hữu cổ phần uST.\n\n⏳ <i>Kho đặc quyền sẽ tự động thay đổi phần thưởng vào cuối tháng. Hãy tích lũy và đổi ngay kẻo lỡ!</i>`;
        
        bot.sendMessage(chatId, task4Text, { 
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🚀 MỞ APP ĐỂ QUY ĐỔI", web_app: { url: webAppUrl } }]
                ]
            }
        });
    }

    // Tắt loading cho các nút
    if (data !== 'check_join') {
        bot.answerCallbackQuery(callbackQuery.id);
    }
});
