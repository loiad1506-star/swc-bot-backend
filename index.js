const TelegramBot = require('node-telegram-bot-api');

// Lấy "Chìa khóa" bot từ hệ thống
const token = process.env.BOT_TOKEN;

// Khởi tạo bot
const bot = new TelegramBot(token, {polling: true});

// Đường link Mini App của bạn đã làm thành công lúc nãy
const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';

// -----------------------------------------------------
// KỊCH BẢN 1: LỜI CHÀO KHI NGƯỜI DÙNG BẤM /start
// -----------------------------------------------------
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    // Tạo bộ nút bấm hiển thị dưới tin nhắn
    const opts = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "1️⃣ Nhiệm vụ Tân binh", callback_data: 'task_1' }],
                [{ text: "2️⃣ Nhiệm vụ Kiến thức", callback_data: 'task_2' }],
                [{ text: "3️⃣ Tăng trưởng (Mời bạn bè)", callback_data: 'task_3' }],
                [{ text: "🎁 Đặc quyền & Đổi thưởng", callback_data: 'task_4' }],
                [{ text: "🚀 MỞ ỨNG DỤNG SWC (Kết nối ví)", web_app: { url: webAppUrl } }]
            ]
        }
    };

    const welcomeText = `Chào mừng bạn đến với <b>Cộng Đồng SWC Việt Nam</b>! 🚂\n\nĐây là hệ thống tự động giúp bạn nhận thưởng Token SWGT và cập nhật tiến độ công nghệ uST, uTerra nhanh nhất.\n\n👇 Hãy chọn một nhiệm vụ bên dưới để bắt đầu:`;
    
    bot.sendMessage(chatId, welcomeText, opts);
});

// -----------------------------------------------------
// XỬ LÝ CÁC KỊCH BẢN KHI BẤM NÚT (FUNNEL)
// -----------------------------------------------------
bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const category = callbackQuery.data;

    let responseText = '';

    // Kịch bản 2: Nhiệm vụ Tân Binh
    if (category === 'task_1') {
        responseText = "<b>🎯 Nhiệm vụ Tân binh:</b>\n\n1. Theo dõi kênh Telegram cộng đồng SWC.\n2. Bấm nút [MỞ ỨNG DỤNG SWC] để liên kết ví cá nhân của bạn.\n\n<i>🎁 Phần thưởng: 50 SWGT</i>";
    } 
    // Kịch bản 3: Nhiệm vụ Kiến thức
    else if (category === 'task_2') {
        responseText = "<b>📚 Nhiệm vụ Kiến thức (Daily Task):</b>\n\nHôm nay, hãy đọc bài viết mới nhất về công nghệ vận tải uST và trả lời câu hỏi trắc nghiệm để nhận thưởng.\n\n<i>🎁 Phần thưởng: 10 SWGT/ngày</i>";
    } 
    // Kịch bản 4: Nhiệm vụ Tăng trưởng
    else if (category === 'task_3') {
        responseText = `<b>🤝 Nhiệm vụ Tăng trưởng:</b>\n\nMời bạn bè tham gia hệ sinh thái để cùng nhau phát triển mạng lưới nhà đầu tư.\n\n👉 Gửi Link giới thiệu này cho bạn bè: https://t.me/Dau_Tu_SWC_bot?start=${message.chat.id}\n\n<i>🎁 Phần thưởng: 20 SWGT cho mỗi lượt mời thành công!</i>`;
    } 
    // Kịch bản 5: Đặc quyền & Đổi thưởng
    else if (category === 'task_4') {
        responseText = "<b>👑 Đặc quyền & Đổi thưởng:</b>\n\nSử dụng token SWGT bạn kiếm được để:\n- Đổi vé tham dự sự kiện VIP.\n- Mua các khóa học đầu tư chiến lược.\n- Nâng cấp hạng thành viên cộng đồng.";
    }

    bot.sendMessage(message.chat.id, responseText, {parse_mode: 'HTML'});
    bot.answerCallbackQuery(callbackQuery.id);
});

console.log("Hệ thống Não bộ Bot SWC đã khởi động thành công!");
