require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');

process.on('uncaughtException', (err) => console.error('Loi Uncaught Exception:', err.message));
process.on('unhandledRejection', (err) => console.error('Loi Unhandled Rejection:', err.message));

const token = process.env.BOT_TOKEN || 'MISSING_TOKEN';
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swc';
const claudeApiKey = process.env.CLAUDE_API_KEY || 'MISSING_KEY';

const bot = new TelegramBot(token, {
    polling: token !== 'MISSING_TOKEN' ? {
        params: { allowed_updates: JSON.stringify(["message", "callback_query", "chat_member", "my_chat_member"]) }
    } : false
});

const claude = new Anthropic({ apiKey: claudeApiKey });
bot.on("polling_error", (msg) => console.log("LOI POLLING:", msg.message));
bot.on("error", (msg) => console.log("LOI CHUNG:", msg.message));

// ==========================================================
// HANG SO & LINK
// ==========================================================
const ADMIN_ID = process.env.ADMIN_ID || '507318519';
const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';
const SWC_PASS_WEB = 'https://www.swcpass.vn/';
const SWC_FIELD_WEB = 'https://swcfield.com/vi/';
const ACTIVATE_URL = 'https://launch.swc.capital/broadcast_31_vi';
const VIDEO_MOBILE = 'https://www.youtube.com/watch?v=SEB7RJrutxg';
const VIDEO_PC = 'https://www.youtube.com/watch?v=gy_sxh9WCCM';
const DEADLINE = '31/03/2026';

const IMG_MAIN_MENU = 'https://photos.app.goo.gl/6SC4mNCBawpMfMgj6';
const IMG_SWCPASS = 'https://photos.app.goo.gl/cbECmeni7rhuBAst5';
const IMG_MEMBERSHIP = 'https://photos.app.goo.gl/yZU4FjisXcrQVMuf7';
const IMG_ROAD1M = 'https://photos.app.goo.gl/Ca3xJzrWPaxzLSur7';
const IMG_FIELD_ROAD1M = 'https://photos.app.goo.gl/pcfu5PUhz8Xs61kt7';
const IMG_SWCFIELD = 'https://photos.app.goo.gl/9nub7vRX5h9buGwr8';
const IMG_ATLAS = 'https://photos.app.goo.gl/9nub7vRX5h9buGwr8';
const IMG_FIELD_SAFE = 'https://photos.app.goo.gl/9nub7vRX5h9buGwr8';

function getDaysLeft() {
    const deadline = new Date('2026-03-31T23:59:00+07:00');
    const diff = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
}

function getGlobalButtons() {
    return [
        [{ text: `NHAN THUONG TU SU KIEN (CON ${getDaysLeft()} NGAY)`, url: ACTIVATE_URL }],
        [{ text: "KICH HOAT SWC PASS", url: SWC_PASS_WEB }],
        [{ text: "Huong dan Kich hoat SWC Field (MOBILE)", url: VIDEO_MOBILE }],
        [{ text: "Huong dan Kich hoat SWC Field (PC)", url: VIDEO_PC }],
        [{ text: "Vao Nhom Chat Dinh Huong", url: `https://t.me/${GROUP_USERNAME.replace('@','')}` }],
        [{ text: "Tro ve Menu Chinh", callback_data: 'main_menu' }]
    ];
}

// ==========================================================
// MONGODB & SCHEMA - NANG CAP THEO DOI HANH VI
// ==========================================================
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Da ket noi MongoDB!'))
    .catch(err => console.error('Loi MongoDB:', err.message));

const userSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    username: { type: String, default: '' },
    phone: { type: String, default: '' },
    joinDate: { type: Date, default: Date.now },
    lastSeenDate: { type: Date, default: Date.now },
    messageCount: { type: Number, default: 0 },
    tag: { type: String, default: 'new', enum: ['new', 'newbie', 'experienced', 'vip_pass', 'atlas_investor'] },
    swcPassTier: { type: String, default: 'none', enum: ['none', 'essential', 'plus', 'ultimate'] },
    funnelStage: { type: String, default: 'new', enum: ['new', 'interested', 'hot_lead', 'converted'] },
    funnelDay: { type: Number, default: 0 },
    lastFunnelSent: { type: Date, default: null },
    broadcastOptOut: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    adminPausedAiUntil: { type: Date, default: null },
    chatHistory: { type: Array, default: [] },
    // THEO DOI CAM XUC & HANH VI
    lastTone: { type: String, default: 'normal' },
    mainConcern: { type: String, default: '' },
    lastTopics: { type: Array, default: [] },
    preferredName: { type: String, default: '' }
});
const User = mongoose.model('User', userSchema);

// ==========================================================
// BO 4 KHO KIEN THUC NANG CAP
// ==========================================================
const KNOWLEDGE_PERSONAL_GROWTH = `
[LOAI 1 - PHAT TRIEN BAN THAN]
17 TU DUY TRIEU PHU (T. Harv Eker): Nguoi giau tin "Toi tao ra cuoc doi toi". Nguoi giau choi de THANG. Nguoi giau QUYET TAM giau. Nguoi giau suy nghi LON, tap trung vao CO HOI, NGUONG MO nguoi giau khac, ket giao nguoi THANH CONG, ton vinh ban than, dung cao hon van de, biet don nhan, muon tra cong theo KET QUA, chon CA HAI, chu trong TONG TAI SAN, QUAN LY TIEN gioi, bat tien PHUC VU minh, hanh dong bat chap noi so, luon HOC HOI phat trien.
Quy tac 6 chiec lo: 55% Thiet yeu - 10% Tiet kiem - 10% Giao duc - 10% Huong thu - 10% Tu do TC - 5% Cho di.
7 Canh gioi tu duong: Nhan loi - Nhu hoa - Nhan nhin - Thau hieu - Buong bo - Cam dong - Sinh ton.
Triet ly co nhan: Luat Nhan Qua (Tien la Qua, Dao duc la Nhan). Lao Tu: Nguoi gioi quan ly von nhu nuoc. Tam Quoc: Chu NHAN cua Tu Ma Y.
4 buoc tien hoa tai chinh: (1) Giam chi tieu (bit lo hong) (2) Tang thu nhap (bom nuoc vao thuyen) (3) Dau tu (bat tien lam no le) (4) Don bay (chi dung khi da thang 1-2-3). 90% dam dong lam nguoc = cong thuc tu sat.
`;

const KNOWLEDGE_HUMAN_NATURE = `
[LOAI 2 - THAU HIEU NHAN TINH VA NGHE THUAT THUYET PHUC]
Dale Carnegie - Dac Nhan Tam: (1) Khong chich bai, len an — lam nguoi cam thay tot ve ban than truoc. (2) Tan thanh chan thanh — moi nguoi doi khat duoc thua nhan. (3) Khoi day khat khao — hoi "Anh/Chi dang so dieu gi nhat trong 5 nam toi?" (4) Quan tam that su — nho ten, hoi gia dinh. (5) Lam nguoi khac noi nhieu — nguoi noi nhieu thua. (6) De nguoi khac giu the dien — sua loi lam rieng.
Storytelling SWC: Meo Vang bat ca (Road to $1M: nhin oi $8/ngay, 15 nam = 1 trieu con ca). Tau danh ca (SWC Field: gom 10.000 chu meo, moi chu $50 = co dong Tau Lon via SPV). SWC Pass = the hoi vien de len Tau Lon.
5 Tang bac: Tang 1 (In tien, tao luat) → Tang 2 (Thu thue thanh khoan) → Tang 3 Gurus (Ban cuoc xuong) → Tang 4 Smart Investors (Ky luat, ty le song 5-10%) → Tang 5 Dam dong (90% nguoi tham gia, giao dich bang cam xuc, la moi cua 4 tang tren). Muc tieu: dua khach tu Tang 5 len Tang 4.
3 cau hoi mo cua long nguoi: (1) "Anh/Chi dang so dieu gi nhat trong 5 nam toi?" (2) "Neu khong co rang buoc tai chinh, Anh/Chi muon cuoc song the nao?" (3) "Anh/Chi da tung mat tien vi quyet dinh nao roi?"
`;

const KNOWLEDGE_INVESTMENT = `
[LOAI 3 - DAU TU, KINH DOANH, VI MO]
Warren Buffett: "Gia ca la nhung gi ban phai tra. Gia tri la nhung gi ban nhan duoc." Chi dau tu vao thu minh HIEU (Circle of Competence). Mua DOANH NGHIEP, khong mua manh giay. Moat (lao tao bao ve). "Tot hon la mua cong ty tuyet voi voi gia hop ly hon mua cong ty hop ly voi gia tuyet voi" — Munger. "Thi truong la cong cu chuyen tien tu nguoi nang dong sang nguoi kien nhan." So khi nguoi khac THAM LAM, THAM LAM khi nguoi khac SO HANG. 2 QUY TAC: Khong mat von. Khong quen Quy tac 1. Lai kep = Ky quan thu 8 (Einstein).
Gia ca vs Gia tri (21 Bai giang SWC): Gia ca = hien tuong, cam xuc dam dong, ngan han, de bi thao tung. Gia tri = ban chat, ben vung. Bi kich 90% F0: tu duy Trader nhung hanh dong nhu Holder khi that bai.
4 buoc giai ma tin tuc (Smart Money): B1-Boc tran su that (binh phong). B2-Doi chieu M2/DXY. B3-Chi ra cam xuc Tang 5. B4-Hanh dong: Phong thu/Rut kiem/Chot loi.
Du lieu vi mo (03/2026): FED 3.625%. M2 YoY +4.29% (Vung Hoang Kim 3-5%). DXY 98-100. CPI 2.4%. → TIN HIEU: M2 Vung Hoang Kim + Tang 5 hoang loan = RUT KIEM, gom tai san loi.
Ban do dong tien 4 mua: Xuan (lai suat ha → CS/Crypto) → Ha (BDS sot) → Thu (NHTW tang lai suat) → Dong (Tiet kiem/Vang/USD). Ke thang chuc cho o binh CHUAN BI DON nuoc.
Quan ly von "3 mang": 3% von/giao dich, R/R toi thieu 1:2. "Loi tren giay khong phai tien cua minh."
Khoi nghiep: Xac suat that bai lan 1 = 95%. 4 yeu to thanh cong: San pham tot + Thi truong dung + Thoi diem + Team. Loi nhuan den tu noi KHONG CO canh tranh.
`;

const KNOWLEDGE_PROJECTS = `
[LOAI 4 - KIEN THUC DU AN SWC]
SWC - Sky World Community: Website swc001.netlify.app. Crowdinvesting Platform quoc te, 10+ nam, Giay phep quy dau tu SEC My. Su menh: giup NDT ca nhan tiep can Pre-IPO, Venture Capital. SPV: moi du an co SPV rieng, NDT mua co phan hop phap tu $50, khong phi an. Phap ly: SEC My, MiFID II Chau Au. Chi 1% du an lot qua tham dinh.
SWC Pass (swcpass.vn): HE THONG TIN HIEU & LO TRINH HANG THANG. Chi 10-15 phut/thang. Essential (Silver): $240/nam = $20/thang + tang 90 ngay. Plus (Gold): $600/5 nam = $10/thang, KHOA GIA 5 nam, 80% NDT tinh anh chon. Ultimate (Diamond): $2,600 vinh vien, mot lan, truyen cho con chau.
SWC Field: San choi ca map. Chi 1% du an duoc chon. Bao ve von All-or-Nothing (khong du KPI → hoan 100%). Tu $50.
Du an ATLAS (swc001.netlify.app/chi-tiet-du-an-atlas): "Grab cua nganh BDS tai UAE." Gom toan bo quy trinh mua-ban BDS vao 1 app. Giai quyet: Tin ao, ke gia (moi gioi an chenh), moi gioi khong phep. Win-Win-Win. Lo trinh: MVP UAE → Mo rong UAE → Singapore, HK, Anh, Phap. Bao ve von All-or-Nothing.
Road to $1M (swcfield.com): DCA $8/ngay = $240/thang, Buy & Hold, lai kep 15-20 nam. $240/thang × 20%/nam: 10 nam ~$55K, 20 nam ~$480K, 30 nam ~$3.4M (x64 von goc). 3 triet ly: Commercial Cows + DCA (thi truong sap = sale-off) + Buy & Hold (loai cam tinh).
uST: Cong nghe giao thong tren cao, dinh gia 400 ty USD, can 3-5 nam. uTerra: Nong nghiep sinh hoc. SWGT: KHONG lien quan Quy SWC.
`;

const FULL_KNOWLEDGE = `${KNOWLEDGE_PERSONAL_GROWTH}\n${KNOWLEDGE_HUMAN_NATURE}\n${KNOWLEDGE_INVESTMENT}\n${KNOWLEDGE_PROJECTS}`;

// ==========================================================
// NHAN DIEN CAM XUC & TONE TIN NHAN
// ==========================================================
function detectTone(text) {
    const t = text.toLowerCase();
    if (['thua', 'lo ', 'mat het', 'that bai', 'buon', 'bi lua'].some(k => t.includes(k))) return 'sad';
    if (['lua dao', 'scam', 'da cap', 'khong tin', 'bang chung', 'chung minh'].some(k => t.includes(k))) return 'skeptic';
    if (['so ', 'lo lang', 'rui ro', 'mat tien', 'co that khong', 'an toan khong', 'chac khong'].some(k => t.includes(k))) return 'anxious';
    if (['x10', 'x100', 'giau nhanh', 'all in', 'doi doi', 'muon mua ngay'].some(k => t.includes(k))) return 'excited';
    if (text.split(' ').length <= 5) return 'casual';
    return 'normal';
}

function detectMainConcern(text) {
    const t = text.toLowerCase();
    if (['gia', 'phi', 'bao nhieu', 'tien', 'dat', 're'].some(k => t.includes(k))) return 'price';
    if (['lua', 'scam', 'an toan', 'phap ly', 'uy tin'].some(k => t.includes(k))) return 'trust';
    if (['atlas', 'dubai', 'bds', 'bat dong san'].some(k => t.includes(k))) return 'atlas';
    if (['road', '1m', 'trieu', 'lai kep', 'dca'].some(k => t.includes(k))) return 'road1m';
    if (['pass', 'the', 'essential', 'plus', 'ultimate'].some(k => t.includes(k))) return 'swcpass';
    return 'general';
}

// ==========================================================
// SYSTEM PROMPT NANG CAP - NHAN CACH "Ti" THAT SU
// ==========================================================
function buildSystemPrompt(user, tone) {
    const daysLeft = getDaysLeft();
    const msgCount = user.messageCount || 0;
    const familiarityHint = msgCount === 0
        ? '[Lan dau noi chuyen. Chao hoi than thien, gioi thieu ngan gon ve Ti.]'
        : msgCount >= 10
            ? `[Quen roi (${msgCount} lan nhan tin). Noi thang, khong gioi thieu lai. Biet ten ho la ${user.firstName}.]`
            : `[Da quen mot chut (${msgCount} lan). Tu nhien nhu ban be.]`;

    const toneHint = {
        sad: `[TONE: ${user.firstName} dang co cam xuc tieu cuc. DONG CAM TRUOC, khong voi tu van. Noi nhe nhang, ngan gon.]`,
        anxious: `[TONE: ${user.firstName} dang lo lang. TRAN AN TRUOC bang 1-2 cau thuc te. Sau do moi giai thich.]`,
        skeptic: `[TONE: ${user.firstName} dang hoai nghi. Khong thuyet phuc. Chi dua FACT lanh. Diem tinh, khong phong thu.]`,
        excited: `[TONE: ${user.firstName} phan khich qua muc. LAM NGUOI nhe bang 1 rui ro cu the truoc khi dong tinh.]`,
        casual: `[TONE: Chat ngan. Tra loi 2-3 dong thoi, nhu chat ban be.]`,
        normal: ''
    }[tone] || '';

    const concernHint = {
        price: '[CONCERN: Khach dang hoi ve GIA. Dua so sanh chi phi co hoi, khong giam gia.]',
        trust: '[CONCERN: Khach dang lo LUA DAO. Dua chung cu phap ly SPV, SEC My, khong cam ket loi nhuan ao.]',
        atlas: '[CONCERN: Khach quan tam ATLAS/Dubai. Tap trung RWA, thanh khoan 3s, bao ve von All-or-Nothing.]',
        road1m: '[CONCERN: Khach quan tam ROAD TO $1M. Dua toan hoc lai kep, $8/ngay, 15 nam.]',
        swcpass: '[CONCERN: Khach hoi ve SWC PASS. Goi y Gold 5 nam ($10/thang) hoac Ultimate ($2600 vinh vien).]',
        general: ''
    }[user.mainConcern] || '';

    return `Anh/chi la "Ti" — tro ly AI phan tich tam ly va tu van tai chinh cua quy Sky World Community Viet Nam, duoi quyen anh Ho Van Loi.

TINH CACH: Thau hieu nhan tinh, sac ben, nhu Soi gia Pho Wall. Xung "em" hoac "Ti", goi khach la "anh/chi". Dung vi du doi thuc, ke chuyen, khong van mau kho khan.
KHONG BIET BAO GIO: Dung **, khong viet tieu de muc kieu bao cao, khong bat dau "Chao anh/chi" neu da quen, khong xung la "Bot".
DO DAI: Toi da 200 tu. Ngat dong lien tuc. Ngan gon khi ho hoi ngan, sau khi ho can chieu sau.

${toneHint}
${concernHint}
${familiarityHint}

KIEN THUC TOI CAN BIET:
${FULL_KNOWLEDGE}

NHIEM VU CHINH:
1. Go bo tam ly phong thu F0. Khai sang cho ho thay tu trade la tu sat (chuoi thuc an tai chinh).
2. Chot sale the SWC Pass truoc deadline ${DEADLINE} (CON ${daysLeft} NGAY). Khuyen manh Goi Plus 5 nam ($600) va Ultimate Vinh vien ($2600).
3. Huong khach xem Video huong dan va vao Group Chat.
4. Lam nguoi khac NOI NHIEU: Dat cau hoi, lang nghe, de khach tu thuyet phuc ban than.

TIN TONG HOP (KHI DUOC HOI VE TIN TUC):
Dong 1: Tieu de + Emoji. Gach dong tom y chinh. 1 cau ca khia dam dong. "Chi cung cap thong tin, khong phai loi khuyen dau tu!" 3-5 hashtag.

XU LY TU CHOI:
"Gia cao": "$10/thang chua bang 1 ly tra da, doi lai tam ban do $1M bao ve gia san 5 nam"
"De nghi them": "Lac phat 2.4% dang an mon tien mat cua anh/chi moi ngay. Tri hoan hom nay = tra gia dat hon ngay mai"
"Co lua dao?": "SPV chuan muc phap ly quoc te. SEC My ky phep. Khac hoan toan Ponzi — chung toi khong giu tien cua anh/chi, anh/chi tu giu tien trong app chung khoan rieng"
"Tu dau tu cung duoc": "Co Pass, anh/chi ngoi mam Tang 1 Venture Capital — mua gia truoc khi len san. Tu di thi xa, di voi SWC thi vua an toan vua nam thong tin truoc dam dong"

QUY TAC CUOI: Luon ket thuc bang 1 cau hoi mo nham vao NOI DAU. KHONG NHAC Token, SWGT.`;
}

// ==========================================================
// HAM GOI CLAUDE API - NANG CAP QUAN LY LICH SU
// ==========================================================
async function callClaude(user, userMessage) {
    try {
        const tone = detectTone(userMessage);
        const concern = detectMainConcern(userMessage);
        user.lastTone = tone;
        if (concern !== 'general') user.mainConcern = concern;

        let history = user.chatHistory || [];
        history.push({ role: 'user', content: userMessage });

        let validHistory = [];
        for (let msg of history) {
            if (validHistory.length === 0) {
                if (msg.role === 'user') validHistory.push({ role: msg.role, content: msg.content });
                continue;
            }
            let lastMsg = validHistory[validHistory.length - 1];
            if (lastMsg.role === msg.role) {
                lastMsg.content += '\n' + msg.content;
            } else {
                validHistory.push({ role: msg.role, content: msg.content });
            }
        }
        if (validHistory.length > 20) validHistory = validHistory.slice(-20);
        if (validHistory.length > 0 && validHistory[0].role === 'assistant') validHistory.shift();

        const response = await claude.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1000,
            system: buildSystemPrompt(user, tone),
            messages: validHistory
        });

        const reply = response.content[0].text.replace(/\*\*/g, '').replace(/\*/g, '');
        history.push({ role: 'assistant', content: reply });
        user.chatHistory = history.slice(-24);
        user.lastSeenDate = new Date();
        user.messageCount = (user.messageCount || 0) + 1;

        if (user.funnelStage === 'new') user.funnelStage = 'interested';
        if (user.funnelStage === 'interested' && (user.messageCount || 0) > 4) user.funnelStage = 'hot_lead';
        await user.save();
        return reply;
    } catch (err) {
        console.error('Loi API Claude:', err.message);
        return `Hien tai doi ngu chuyen gia SWC dang xu ly du lieu. Anh/chi vui long tham gia Nhom Chat hoac xem Video Huong Dan o Menu ben duoi nhe!`;
    }
}

// ==========================================================
// DRIP FUNNEL 7 NGAY - CHAM SOC THEO HANH TRINH
// ==========================================================
const DRIP_MESSAGES = {
    1: {
        subject: 'Chao mung',
        text: (name, daysLeft) => `Anh/chi ${name} oi, em la Ti — tro ly SWC cua anh Ho Van Loi.

Rat vui duoc ket noi! Em biet anh/chi dang co rat nhieu cau hoi ve tai chinh — do cung la dieu binh thuong, vi thi truong luc nao cung day nhung bap bay va tin don.

Mot cau hoi nho de bat dau: "Neu ngan mai anh/chi phai ngung lam viec 6 thang, cuoc song co bi anh huong khong?"

Neu co — thi chung ta can noi chuyen rat nghiem tuc ve viec xay dung dong tien thu dong. Con ${daysLeft} ngay de anh/chi co co hoi tot nhat.`,
        image: IMG_MAIN_MENU
    },
    3: {
        subject: 'Noi dau that su',
        text: (name, daysLeft) => `Anh/chi ${name} oi, em Tu nhan ra mot dieu —

95% nguoi tu trade thi truong deu thua lo. Khong phai vi ho thieu thong tin. Ma vi ho dang choi trong mot san choi ma LUAT DO KE KHAC VIET.

Nhu Pho Wall co cau: "Biet minh la ca map hay la moi?"

SWC Pass khong phai khoa hoc. No la cai bom xe keo anh/chi ra khoi vung lau cua Tang 5, dat anh/chi ngoi tren lung Ca Voi de cung san moi.

Con ${daysLeft} ngay. Em co the giai thich chi tiet hon khong?`,
        image: IMG_ROAD1M
    },
    7: {
        subject: 'Loi kep cuoi cung',
        text: (name, daysLeft) => `Anh/chi ${name}, day la tin nhan quan trong nhat em gui.

Mot nguoi bat dau luc 25 tuoi voi $8/ngay se NGHIEN NAT ket qua tai chinh cua nguoi bat dau luc 40 tuoi voi $100/ngay.

Nguon luc quy gia nhat khong phai tien. La THOI GIAN.

Moi ngay tri hoan = mot ngay suc manh lai kep vinh vien mat di.

Con ${daysLeft} ngay. Anh/chi dang o Tang nao trong 5 tang tai chinh? Em muon giup anh/chi leo len.`,
        image: IMG_FIELD_ROAD1M
    },
    14: {
        subject: 'Atlas Dubai',
        text: (name, daysLeft) => `Anh/chi ${name}, em co tin nong!

Du an ATLAS tai Dubai dang o giai doan nap von vong Private — tuc la gia tot nhat, truoc khi cong chung biet den.

Tuong tuong: So huu BDS Dubai, nhan tien thue hang thang, co the ban trong 3 giay khi can. Tat ca chi can $50 de bat dau.

Day chinh xac la cach gioi tinh hoa tao ra tai san — ho khong mua BDS bang ca khoi vang nua, ho mua PHAN TRAM so huu qua cau truc SPV phap ly.

Anh/chi quan tam khong? Em gui chi tiet nhe!`,
        image: IMG_ATLAS
    },
    21: {
        subject: 'Cua sap dong',
        text: (name, daysLeft) => `Anh/chi ${name} — em phai noi thang.

Con ${daysLeft} ngay nua, cua vao SWC Pass se dong.

Khong phai chieu marketing. Khi du 1000 thanh vien, he thong se khoa hoan toan — vi quy tai san trong SWC Field co gioi han.

Anh/chi da noi chuyen voi em nhieu lan. Em biet anh/chi hieu gia tri cua viec nay.

Cau hoi thang: "Anh/chi dang can them gi de bat dau?"

Em o day de giai dap bat ky thac mac nao.`,
        image: IMG_MEMBERSHIP
    }
};

async function sendDripMessage(userId, dayKey) {
    try {
        const user = await User.findOne({ userId });
        if (!user || user.broadcastOptOut || user.swcPassTier !== 'none') return;
        const msg = DRIP_MESSAGES[dayKey];
        if (!msg) return;
        const daysLeft = getDaysLeft();
        const text = msg.text(user.firstName || 'ban', daysLeft);
        const keyboard = { inline_keyboard: getGlobalButtons() };
        await bot.sendPhoto(userId, msg.image, { caption: text, parse_mode: 'HTML', reply_markup: keyboard })
            .catch(() => bot.sendMessage(userId, text, { parse_mode: 'HTML', reply_markup: keyboard }));
        user.funnelDay = dayKey;
        user.lastFunnelSent = new Date();
        await user.save();
    } catch (e) { console.error('Loi drip:', e.message); }
}

// Scheduler drip funnel - check moi 1h
setInterval(async () => {
    const now = new Date();
    const users = await User.find({ broadcastOptOut: false, swcPassTier: 'none' }).catch(() => []);
    for (const user of users) {
        const joinDate = new Date(user.joinDate);
        const daysSinceJoin = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24));
        const lastFunnelDay = user.funnelDay || 0;
        const dripDays = [1, 3, 7, 14, 21];
        for (const d of dripDays) {
            if (daysSinceJoin >= d && lastFunnelDay < d) {
                await sendDripMessage(user.userId, d);
                await new Promise(r => setTimeout(r, 500));
                break;
            }
        }
    }
}, 3600000);

// ==========================================================
// CHUC NANG RE-ENGAGEMENT - NHAN NHUNG NGUOI IM LANG
// ==========================================================
async function reEngageInactiveUsers() {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const inactiveUsers = await User.find({
        broadcastOptOut: false,
        swcPassTier: 'none',
        lastSeenDate: { $lt: threeDaysAgo },
        funnelStage: { $in: ['interested', 'hot_lead'] }
    }).catch(() => []);

    const reEngageTexts = [
        (name) => `Anh/chi ${name} oi, Ti nho anh/chi qua! Dao nay thi truong dang nhieu bien dong — anh/chi co can em cap nhat gi khong?`,
        (name) => `Chao anh/chi ${name}! Ti vua doc xong bai phan tich vi mo thang nay — co nhieu dieu thu vi. Anh/chi con quan tam khong?`,
        (name) => `${name} oi, goi Plus 5 nam hien tai chi $10/thang. Em nghi no phu hop voi anh/chi — muon nghe Ti giai thich them khong?`
    ];

    for (const user of inactiveUsers) {
        const randomText = reEngageTexts[Math.floor(Math.random() * reEngageTexts.length)](user.firstName || 'ban');
        const keyboard = { inline_keyboard: [[{ text: "Muon biet them", callback_data: 'main_menu' }], ...getGlobalButtons().slice(-2)] };
        await bot.sendMessage(user.userId, randomText, { reply_markup: keyboard })
            .catch(() => {});
        await new Promise(r => setTimeout(r, 300));
    }
}

// Chay re-engagement moi ngay luc 10h sang
setInterval(async () => {
    const vnTime = getVNTime();
    const h = vnTime.getUTCHours();
    const m = vnTime.getUTCMinutes();
    if (h === 10 && m === 0) await reEngageInactiveUsers();
}, 60000);

// ==========================================================
// GUI MAIN MENU
// ==========================================================
async function sendMainMenu(chatId, messageId = null) {
    const daysLeft = getDaysLeft();
    const text = `CONG DAU TU TRI TUE SWC CAPITAL

Thi truong tai chinh la mot chien truong khoc liet. O day, tien khong tu sinh ra ma chi chuyen tu tui cua nhung nguoi yeu bong via, thieu ky luat sang tui cua nhung bo oc co he thong chien luoc bai ban.

CANH BAO TU HUYET: Dac quyen dang ky goi thanh vien Ultimate (Vinh vien) se chinh thuc DONG CUA VINH VIEN vao luc 23:59 ngay ${DEADLINE}. Chi con dung ${daysLeft} ngay nua.

HAY CHON MOT DANH MUC DE BAT DAU:`;

    const keyboard = {
        inline_keyboard: [
            [{ text: "Doi Tieng Viet (Danh cho nguoi moi)", url: "https://t.me/setlanguage/vi" }],
            [{ text: "GIAI MA BI MAT THE SWC PASS", callback_data: 'menu_swcpass_main' }],
            [{ text: "SWC FIELD & SIEU DU AN ATLAS", callback_data: 'menu_swcfield_main' }],
            [{ text: "ROAD TO $1M (Ban do Lai kep)", callback_data: 'menu_road1m_main' }],
            [{ text: "HOI DAP DAU TU (Pha vo rao can)", callback_data: 'menu_faq_main' }],
            ...getGlobalButtons().slice(0, -1)
        ]
    };

    if (messageId) bot.deleteMessage(chatId, messageId).catch(() => {});
    bot.sendPhoto(chatId, IMG_MAIN_MENU, { caption: text, parse_mode: 'HTML', reply_markup: keyboard })
        .catch(() => bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard }));
}

// ==========================================================
// /START & THU THAP SDT
// ==========================================================
bot.onText(/\/start(.*)/i, async (msg) => {
    if (msg.chat.type !== 'private') return;
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    let user = await User.findOne({ userId });
    if (!user) {
        user = new User({
            userId,
            firstName: msg.from.first_name || '',
            lastName: msg.from.last_name || '',
            username: msg.from.username ? `@${msg.from.username}` : '',
            joinDate: new Date()
        });
        await user.save();
        // Thong bao admin co lead moi
        bot.sendMessage(ADMIN_ID, `LEAD MOI TRUY CAP!\nTen: ${user.firstName} ${user.lastName}\nID: ${userId}\nUsername: ${user.username}`).catch(() => {});
    }

    if (!user.phone) {
        const welcomeMsg = `Xin chao ${user.firstName || 'ban'}!\n\nToi la Ti — tro ly phan tich tam ly va dau tu cua SWC Capital.\n\nDe he thong chuan doan dung vi the tai chinh va cung cap tai lieu mat, vui long bam nut Chia se so dien thoai ben duoi nhe!`;
        bot.sendMessage(chatId, welcomeMsg, {
            reply_markup: {
                keyboard: [[{ text: "Chia se So dien thoai", request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }).catch(() => {});
    } else {
        sendMainMenu(chatId);
    }
});

bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    await User.updateOne({ userId }, { $set: { phone: msg.contact.phone_number } });
    bot.sendMessage(chatId, "Dang trich xuat ho so nha dau tu...", {
        reply_markup: { remove_keyboard: true }
    }).then(sent => {
        bot.deleteMessage(chatId, sent.message_id).catch(() => {});
        sendMainMenu(chatId);
    });
    // Thong bao admin co SDT
    bot.sendMessage(ADMIN_ID, `KHACH MOI CO SDT!\nTen: ${msg.from.first_name}\nSDT: ${msg.contact.phone_number}\nID: ${userId}`).catch(() => {});
});

// ==========================================================
// CALLBACK QUERY - MA TRAN TAM LY
// ==========================================================
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    const daysLeft = getDaysLeft();
    let text = ''; let keyboard = []; let imageUrl = '';
    bot.answerCallbackQuery(callbackQuery.id).catch(() => {});

    if (data === 'main_menu') return sendMainMenu(chatId, messageId);

    // NHANH SWC PASS
    if (data === 'menu_swcpass_main') {
        imageUrl = IMG_SWCPASS;
        text = `BI MAT CUA TAM THE SWC PASS\n\nHay tuong tuong ban muon boi qua mot dong song chay xiet. Tu boi, ban co the duoi suc va chim nghim. Nhung neu ban thue duoc mot chiec du thuyen sieu toc co thuyen truong day dan kinh nghiem, ban chi viec buoc len tau va tan huong hanh trinh.\n\nSWC Pass KHONG PHAI la mot khoa hoc lam giau hay hoi nhom ho hao phim lenh. No chinh la "Chiec du thuyen" do. No la mot Tu cach thanh vien (Membership) bao chung cho viec ban duoc buoc chan vao the gioi dau tu cua gioi tinh anh.\n\nThong qua SWC Pass, ban thoat khoi kiep lam "nho le F0", duoc quyen mua gom tai san chat luong cao tu som (vong Private) va duoc thiet lap mot ky luat dau tu sac lanh ma khong bi cam xuc chi phoi.`;
        keyboard = [
            [{ text: "Phan Tich 3 Goi The: Chon Bat Pho hay Di San?", callback_data: 'swcpass_compare' }],
            [{ text: "4 Dac Quyen Ke Huy Diet Phi An", callback_data: 'swcpass_benefits' }],
            ...getGlobalButtons()
        ];
    }
    else if (data === 'swcpass_compare') {
        imageUrl = IMG_MEMBERSHIP;
        text = `BANG GIA SWC PASS - BAN CHON VI THE NAO?\n\n1. GOI ESSENTIAL (1 Nam - $240): "Ca Phe Trai Nghiem"\nChi $20/thang. Bang dung tien mot chan ca phe cuoi tuan. Nhung thay vi uong xong la het, $20 nay giup ban thue duoc ca mot doi ngu chuyen gia My phan tich thi truong.\n\n2. GOI PLUS (5 Nam - $600): "Ky Luat Thep" [KHUYEN DUNG]\nChi CON $10/THANG. Bang mot bat pho moi tuan. Ban mua quyen truy cap danh muc gioi sieu giau va bi "ep" vao ky luat thep. Moi cong cu AI moi ra mat, ban deu duoc dung mien phi.\n\n3. GOI ULTIMATE (Vinh Vien - $2.600): "Di San Gia Toc"\nDau tu 20 nam thi moi nam chi ton $130. Ban mua DUT nen tang tai chinh nay de lam be phong, lam di san cho con cai.\n\nCUP CHOT HA: Goi Ultimate se DONG CUA VINH VIEN vao ngay ${DEADLINE} (Chi con ${daysLeft} ngay). Qua ngay nay, mang $10.000 den cung khong the mua dut duoc nua!`;
        keyboard = getGlobalButtons();
    }
    else if (data === 'swcpass_benefits') {
        imageUrl = IMG_SWCPASS;
        text = `KE HUY DIET PHI AN VA 4 DAC QUYEN TOI THUONG\n\nCac Quy mo ngoai kia cat xen 2% tren TONG tai san moi nam. Neu co 1 ty, mat 20 trieu phi. Co 10 ty, mat dut 200 trieu. SWC Pass choi song phang: chi $10/thang, du tien co nhieu den dau.\n\n1. Co May Toan Hoc Road to $1M: Nhan ban do chi tiet hang thang. Mua ma nao, mua bao nhieu, vung gia an toan. Khong can phan tich nen, khong can cang mat nhin man hinh.\n\n2. Tien Ai Nay Giu: SWC Pass KHONG GIU TIEN cua ban. Ban mo app chung khoan ca nhan, tu tay thao tac trong 10 phut roi tat may. An toan 100%.\n\n3. San Choi Cua Ca Map: Khoi diem dau tu vong Private chi tu $50, dap tan rao can $500.000 cua gioi tai phiet.\n\n4. Dong Tien Thu Dong Vinh Cuu: Khi doi tac cua ban gia han Pass hang nam, tien hoa hong se do ve tui ban deu dan ma khong can ton suc chot sale lai.`;
        keyboard = [[{ text: "Xem Lai Phan Tich 3 Goi Pass", callback_data: 'swcpass_compare' }], ...getGlobalButtons()];
    }

    // NHANH ROAD TO $1M
    else if (data === 'menu_road1m_main') {
        imageUrl = IMG_ROAD1M;
        text = `HANH TRINH ROAD TO $1M (BAN DO TRIEU DO)\n\nBao nhieu lan ban de dang vung 200.000 VND cho mot bua an nhau, mot chiec ao moi ma khong mang suy nghi?\n\nChuyen gi se xay ra neu ban co tinh ky luat, tu dong trich ra dung $8/ngay (khoang $240/thang), nem no vao mot co may sinh loi da duoc tinh chinh hoan hao, va de mac cho "Ky quan thu 8" la Lai Kep tu do phat huy suc manh?\n\nTrong 15 nam, con so do se can moc 1 Trieu Do La.\n\nNo khong phai phep thuat hay trung so. No chi la Toan hoc co ban ket hop voi Thoi gian va Su Ky Luat Vo Cam. Nhung de lam duoc, ban can mot He thong chi duong.`;
        keyboard = [
            [{ text: "Loi Ich Thuc Chien (Su That Dang Sau Ky Luat)", callback_data: 'road1m_benefits' }],
            [{ text: "Tai Sao 95% F0 Sap Chet? (Chuoi Thuc An)", callback_data: 'road1m_foodchain' }],
            ...getGlobalButtons()
        ];
    }
    else if (data === 'road1m_benefits') {
        imageUrl = IMG_FIELD_ROAD1M;
        text = `LOI ICH THUC CHIEN: CHUNG TOI KHONG BAN GIAC MO, CHUNG TOI BAN SU GIAI THOAT\n\nVi The Cua Dong Tien: Muc tieu thuc su cua Road to $1M la tao ra Dong tien Co tuc Thu Dong. Khi co tuc sinh ra moi thang lon hon so tien gia dinh ban chi tieu sinh hoat, do la khoanh khac ban chinh thuc "Nghi huu" va tu do, bat ke ban dang 30 hay 50 tuoi.\n\nTriet Tieu Cam Xuc Hoang Loan: Ke thu lon nhat cuop tien cua ban khong phai doi lai, ma la tam ly So hai cua chinh ban. Khi thi truong do mau, sap 30%, nguoi binh thuong se khoc loc cat lo. Nhung he thong DCA cua chung toi se bao tin hieu lanh lung: "Co hoi ngan nam co mot, gom manh tai san gia re!"\n\nTiet Kiem 10.000 Gio Mau Va Nuoc Mat: Dung lang phi tuoi tre co gang doc hieu bao cao tai chinh hay canh bieu do nen xanh do. Ban co gia dinh, co chuyen mon rieng. Chuyen gia SWC da phan tich san mam co. Ban chi can ton dung 10 phut moi thang de copy va xac nhan.`;
        keyboard = [[{ text: "Quay Lai Lo Trinh", callback_data: 'menu_road1m_main' }], ...getGlobalButtons()];
    }
    else if (data === 'road1m_foodchain') {
        imageUrl = IMG_ROAD1M;
        text = `5 TANG CHUOI THUC AN: SU THAT TAN NHAN CUA THI TRUONG\n\nBan khong ngheo di vi ban thieu thong tin. Ban ngheo vi ban ngay tho buoc vao song bac va choi bang bo luat do ke khac viet ra.\n\nTang 1 — Dang Sang Tao (Chinh Phu & NHTW): Nguoi in tien, nguoi that chat lai suat. Ho khong can trade, ho dieu khien toan bo dong chay dai duong.\n\nTang 2 — Ca Voi (Cac Quy Dau Tu Tai Phiet): Chung co hang ty do la. Chung am tham gom mua duoi day khi ban hoang loan ban ra, va xa hang ngap dau khi ban dang hung phan tot do du dinh.\n\nTang 3 — Doi Lai (Market Maker): Nhung ke co tinh ve bieu do, tao ra nhung cay nen do cam thang dung luc 2 gio sang de ru bo nhung ke yeu bong via.\n\nTang 4 — Soi Gia: Nhung tay Trader song sot bang ky luat thep, chot loi cat lo khong cam xuc.\n\nTang 5 — F0 (Sinh Vat Phu Du): Chinh la Dam dong. Mua bang lo tai nghe phim hang, ban bang cam giac so hai. Day chinh la mo thanh khoan doi dao nuoi song 4 tang tren. 95% nhung ke tu trade deu dang chim o day nay.\n\nNHAN RA DIEU GI CHUA? Tu trade la tu sat. SWC Pass la chiec can cau keo ban ra khoi vung lam Tang 5!`;
        keyboard = [[{ text: "Quay Lai", callback_data: 'menu_road1m_main' }], ...getGlobalButtons()];
    }

    // NHANH SWC FIELD & ATLAS
    else if (data === 'menu_swcfield_main') {
        imageUrl = IMG_SWCFIELD;
        text = `SWC FIELD & QUYEN LUC CUA KE THACH THUC\n\nTheo le thuong, de mua duoc co phan cua mot du an cong nghe o "Gia Si" (vong Private) truoc khi chung duoc bom thoi len san, ban phai chung minh minh la nha dau tu chuyen nghiep va co trong tay it nhat 500.000 Do La.\n\nNhung SWC Field ra doi de pha vo dac quyen do. Nen tang Showcase nay go bo rao can, cho phep ban duoc rot von, chia phan chiec banh beo bo do chi voi so von tu $50.\n\n$50 khong lam ban ngheo di, nhung no cap cho ban mot tam ve buoc vao san choi cua gioi tinh hoa.`;
        keyboard = [
            [{ text: "Bo Loc SPV (La Chan Chong Lua Dao)", callback_data: 'swcfield_spv' }],
            [{ text: "Du An ATLAS (So Huu BDS Dubai Trong 3 Giay)", callback_data: 'swcfield_atlas' }],
            [{ text: "Kham pha Website SWC Field", url: SWC_FIELD_WEB }],
            ...getGlobalButtons()
        ];
    }
    else if (data === 'swcfield_spv') {
        imageUrl = IMG_FIELD_SAFE;
        text = `BO LOC CHONG FOMO & AO GIAP PHAP LY SPV\n\n"Nhung ngo nho du an sap thi sao? So lua dao lam!"\n\nDo la noi so hoan toan chinh dang. Va do la ly do SWC Field khong bao gio ban cho ban nhung "Co phan truu tuong" hay nhung dong Coin rac bom thoi.\n\nMoi mot du an xuat hien tren SWC Field deu phai vuot qua bai kiem tra Sinh tu cua Doi ngu tham dinh. Sau do, no duoc dong goi can than vao mot SPV (Special Purpose Vehicle - Phap nhan muc dich dac biet).\n\nKhi ban xuong tien, ban dang mua Co phieu hop phap cua chinh SPV do, duoc bao chung boi he thong luat phap khat khe cua My, Lien Minh Chau Au hoac Nga. Tien cua ban khong bay vao hu khong, no duoc khoa trong mot lop ao giap phap ly y het nhu cach cac ty phu bao ve tai san cua ho!`;
        keyboard = [[{ text: "Quay lai SWC Field", callback_data: 'menu_swcfield_main' }], ...getGlobalButtons()];
    }
    else if (data === 'swcfield_atlas') {
        imageUrl = IMG_ATLAS;
        text = `SIEU DU AN ATLAS — SU TIEN HOA CUA BAT DONG SAN DUBAI (RWA)\n\nBan nghi rang dau tu Bat dong san la phai co vai chuc ty dong, mua mot cuc gach roi chon von o do 5-10 nam khong rut ra duoc? Quen di, do la tu duy cua thap ky truoc.\n\nXu huong thau tom tai san cua tuong lai goi ten RWA (Real World Assets - Tai san thuc duoc so hoa). Sieu du an ATLAS bien nhung toa thap choc troi tai Dubai thanh nhung phan tai san so hoa.\n\nSU DOT PHA TAN NHAN:\n- Thanh khoan trong 3 giay: Dap tan su ket von cua BDS truyen thong. Can tien? Bam ban, tien ve vi. Nhanh nhu chop.\n- Bao chung quyen luc: Duoc phap nhan Atlas Overseas FZE (Cap phep boi chinh phu Dubai) dung ra bao lanh.\n- Khoi diem chi tu $50: Ban, voi so von cua nguoi binh thuong, gio day co the so huu BDS trung tam Dubai va nhan Tien thue nha that chay ve vi moi thang.\n\nLOI CANH BAO TU HUYET: Vong uu dai Mua si Private cua du an ATLAS se dong cua khong thuong tiec vao ${DEADLINE}. Dung de lo chuyen tau tao ra gia san nay!`;
        keyboard = [[{ text: "Quay lai SWC Field", callback_data: 'menu_swcfield_main' }], ...getGlobalButtons()];
    }

    // NHANH FAQ
    else if (data === 'menu_faq_main' || data === 'faq_back') {
        text = `GIAI MA TAM LY TU CHOI (FAQ)\n\nGiua viec "Bat tay vao hanh dong" va "Tiep tuc dung nhin", con nguoi luon tu bia ra nhung ly do de bien minh cho su chan chu cua minh.\n\nDung de su nghi ngo cuop di tuong lai cua ban. Hay chon mot noi so ban dang gap phai de chung toi dap tan no:`;
        keyboard = [
            [{ text: "1. Chuyen tien mua Pass xong thi nhan duoc gi?", callback_data: 'faq_1' }],
            [{ text: "2. Tai sao khong tu len YouTube hoc cho do ton tien?", callback_data: 'faq_3' }],
            [{ text: "3. Toi khong co du $600 luc nay thi tinh sao?", callback_data: 'faq_4' }],
            [{ text: "4. Tha toi de tien o ket hoac ngan hang cho an toan?", callback_data: 'faq_5' }],
            [{ text: "Tro ve Menu Chinh", callback_data: 'main_menu' }]
        ];
    }
    else if (data === 'faq_1') {
        text = `Chuyen tien mua Pass xong, ban nhan duoc gi?\n\nBan khong mua mot loi hua. Ban mua mot Ket qua ngay lap tuc.\n\nNgay khi kich hoat thanh cong the SWC Pass, tin hieu chien luoc cua thang dau tien se hien thi ngay trong man hinh he thong chi sau vai phut.\n\nBan se duoc he thong chi diem cuc ky chinh xac:\n- Can mua ma co phieu/tai san nao?\n- Rot bao nhieu % von vao do?\n- Vung gia an toan nhat de mua la bao nhieu?\n\nBan khong can ton thoi gian di hoc cach ve bieu do nen, cung chang can hieu bao cao tai chinh la gi. Chuyen gia da nau co san, viec cua ban chi la cam dua len va an!`;
        keyboard = [[{ text: "Quay lai Danh sach Cau hoi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }
    else if (data === 'faq_3') {
        text = `Tai sao khong tu hoc kien thuc mien phi tren YouTube?\n\nKien thuc mien phi tren mang thi nhieu nhu rac. Nhung neu chi can "Biet kien thuc" ma giau, thi the gioi nay ai cung la trieu phu do la ca roi.\n\nSu khac biet sinh tu cua SWC Pass nam o cho: No cung cap mot He Thong Ky Luat ep ban phai thuc thi. No troi tay ban lai, ngan khong cho cam xuc ca nhan xen vao, xoa so long tham du dinh va su so hai ban thao duoi day.\n\nViec tu hoc tren mang giong nhu ban nam tren giuong em nem am doc cuon sach "Day boi cap toc". Con SWC Pass la viec ban thuc su nhay xuong ho nuoc sau voi mot Huan luyen vien Olympic boi loi ke ben kep co keo ban di dung huong. Ban chon cach nao de khong bi chet duoi trong thi truong nay?`;
        keyboard = [[{ text: "Quay lai Danh sach Cau hoi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }
    else if (data === 'faq_4') {
        text = `Ban chua co du $600 luc nay de mua Goi 5 nam?\n\nHay lam mot phep toan cua ke tinh tao: $600 / 5 nam = dung $10/thang (Khoang 250.000 VND).\n\nMuc gia nay chi bang so tien ban vung tay qua cua so cho 1 bat pho hoac 1 tai khoan Netflix ma ban thinh thoang moi dong den moi tuan.\n\nViec ban cu chan chu, tri hoan voi ly do "Doi de gom cho du tien" dong nghia voi viec ban dang tu tay danh mat hang thap ky suc manh cua Lai Kep. Cai gia thuc su dat do tan nhan khong phai la 600 do la — ma la Chi phi co hoi thay doi vi the gia toc ma ban da vinh vien bo lo.`;
        keyboard = [[{ text: "Quay lai Danh sach Cau hoi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }
    else if (data === 'faq_5') {
        text = `Tha giu tien mat trong ket sat hoac ngan hang cho an toan?\n\nThua ban, tu duy "Tien mat la vua" chinh la Ao giac an toan nguy hiem nhat cua tang lop trung luu va nguoi ngheo.\n\nCac Ngan hang Trung uong khong ngung in them tien moi moi ngay. He qua tat yeu la "Lam phat" - Mot bong ma khong lo lang le moc tui ban, an mon suc mua cua ban moi khi ban chim vao giac ngu ma khong he phat ra mot tieng dong nao.\n\nGiu khur khur tien mat dai han = Dam bao 100% ban se ngheo di theo thoi gian. Gioi tinh anh va tang lop sieu giau khong bao gio tich tru tien mat ngu ngoc, ho luon dung moi cach muon no de chuyen hoa no thanh Tai san sinh loi. Dung tu dim chet minh trong su "an toan" gia tao do!`;
        keyboard = [[{ text: "Quay lai Danh sach Cau hoi", callback_data: 'faq_back' }], ...getGlobalButtons()];
    }

    // ADMIN CALLBACKS
    else if (data === 'admin_stats' && callbackQuery.from.id.toString() === ADMIN_ID) {
        const total = await User.countDocuments();
        const hotLead = await User.countDocuments({ funnelStage: 'hot_lead' });
        const interested = await User.countDocuments({ funnelStage: 'interested' });
        const converted = await User.countDocuments({ funnelStage: 'converted' });
        const hasPhone = await User.countDocuments({ phone: { $ne: '' } });
        const last24h = await User.countDocuments({ lastSeenDate: { $gte: new Date(Date.now() - 24*3600000) } });
        bot.sendMessage(ADMIN_ID, `THONG KE SWC BOT V5\n\nTong users: ${total}\nCo SDT: ${hasPhone}\nHot Lead: ${hotLead}\nInterested: ${interested}\nConverted: ${converted}\nHoat dong 24h qua: ${last24h}\nCon lai: ${getDaysLeft()} ngay`, { parse_mode: 'HTML' });
        return;
    }
    else if (data === 'admin_help' && callbackQuery.from.id.toString() === ADMIN_ID) {
        bot.sendMessage(ADMIN_ID, `LENH ADMIN:\n/tracuu [ID]\n/setpass [ID] [goi]\n/settag [ID] [tag]\n/sendall [Text]\n/sendgroup [Text]\n/broadcast [tag] [Text]\n/reset [ID] — reset lich su AI\n/note [ID] [ghi chu]`, { parse_mode: 'HTML' });
        return;
    }

    if (text !== '') {
        bot.deleteMessage(chatId, messageId).catch(() => {});
        if (imageUrl !== '') {
            bot.sendPhoto(chatId, imageUrl, { caption: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } })
                .catch(() => bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }));
        } else {
            bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
        }
    }
});

// ==========================================================
// XU LY TIN NHAN TU DO - AI TI & ADMIN
// ==========================================================
bot.on('message', async (msg) => {
    if (!msg.from || msg.from.is_bot || msg.chat.type !== 'private') return;
    if (msg.contact || (msg.text && msg.text.startsWith('/'))) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // ADMIN TRA LOI LAI KHACH
    if (userId === ADMIN_ID && msg.reply_to_message) {
        const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
        const idMatch = originalText.match(/ID:\s*(\d+)/);
        if (idMatch) {
            const targetId = idMatch[1];
            await bot.sendMessage(targetId, `Phan hoi tu Doi ngu Chuyen gia SWC:\n\n${msg.text || msg.caption}`, { parse_mode: 'HTML' }).catch(() => {});
            bot.sendMessage(ADMIN_ID, `Da gui cau tra loi cho khach ID: ${targetId}`, { parse_mode: 'HTML' });
            await User.updateOne({ userId: targetId }, { $set: { adminPausedAiUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) } });
            return;
        }
    }

    // KHACH NHAN TIN - GOI AI CLAUDE
    if (userId !== ADMIN_ID) {
        let user = await User.findOne({ userId });
        if (!user) {
            user = new User({ userId, firstName: msg.from.first_name || '', lastName: msg.from.last_name || '', username: msg.from.username ? `@${msg.from.username}` : '' });
            await user.save();
        }
        user.lastSeenDate = new Date();

        // Forward file/anh/video cho admin
        if (msg.photo || msg.video || msg.document) {
            await bot.forwardMessage(ADMIN_ID, chatId, msg.message_id).catch(() => {});
            bot.sendMessage(ADMIN_ID, `TEP TU KHACH HANG\nTen: ${user.firstName}\nID: ${userId}\nGhi chu: ${msg.caption || 'Khong co'}\nReply tin nay de chat truc tiep (AI bi khoa 2h).`, { parse_mode: 'HTML' }).catch(() => {});
        }

        // Neu admin dang xu ly - chi forward, khong tra loi AI
        const now = new Date();
        if (user.adminPausedAiUntil && user.adminPausedAiUntil > now) {
            bot.sendMessage(ADMIN_ID, `KHACH TRA LOI (CHE DO ADMIN)\nTen: ${user.firstName}\nID: ${userId}\nNoi dung: ${msg.text || '[Tep]'}\nReply de tiep tuc chat.`, { parse_mode: 'HTML' }).catch(() => {});
            return;
        }

        bot.sendChatAction(chatId, 'typing').catch(() => {});

        // Typing delay tu nhien theo do dai va tone
        const userText = msg.text || msg.caption || '[Khach gui tep]';
        const tone = detectTone(userText);
        const delayMs = tone === 'casual' ? 800 :
                       tone === 'skeptic' ? 2500 :
                       tone === 'sad' ? 2000 :
                       Math.min(userText.length * 15, 3000);
        await new Promise(r => setTimeout(r, delayMs));

        const aiReply = await callClaude(user, userText);

        await bot.sendMessage(chatId, aiReply, { parse_mode: 'HTML' }).catch(() => {
            bot.sendMessage(chatId, aiReply);
        });

        // Thong bao admin khi hot lead
        if (['interested', 'hot_lead'].includes(user.funnelStage)) {
            const alertMsg = `HOT LEAD DANG CHAT VE AI\nTen: ${user.firstName} ${user.lastName}\nID: ${userId}\nTone: ${tone} | Quan tam: ${user.mainConcern}\nFunnel: ${user.funnelStage}\n\nKhach: ${userText.substring(0, 200)}\nTi: ${aiReply.substring(0, 300)}\n\nReply tin nay de cuop quyen chat.`;
            bot.sendMessage(ADMIN_ID, alertMsg).catch(() => {});
        }
    }
});

// ==========================================================
// BROADCAST THEO LICH & THONG BAO HE THONG
// ==========================================================
function getVNTime() { return new Date(new Date().getTime() + (7 * 60 * 60 * 1000)); }

async function broadcastToAll(message, imageUrl = null) {
    const users = await User.find({ broadcastOptOut: false });
    let success = 0;
    for (const user of users) {
        try {
            if (imageUrl) {
                await bot.sendPhoto(user.userId, imageUrl, { caption: message, parse_mode: 'HTML', reply_markup: { inline_keyboard: getGlobalButtons() } });
            } else {
                await bot.sendMessage(user.userId, message, { parse_mode: 'HTML', reply_markup: { inline_keyboard: getGlobalButtons() } });
            }
            success++;
        } catch (e) {}
        await new Promise(r => setTimeout(r, 70));
    }
    return success;
}

async function broadcastToStage(stage, message) {
    const users = await User.find({ funnelStage: stage, broadcastOptOut: false });
    for (const user of users) {
        try { await bot.sendPhoto(user.userId, IMG_MAIN_MENU, { caption: message, parse_mode: 'HTML', reply_markup: { inline_keyboard: getGlobalButtons() } }); } catch (e) {}
        await new Promise(r => setTimeout(r, 70));
    }
}

setInterval(async () => {
    const vnTime = getVNTime();
    const h = vnTime.getUTCHours();
    const m = vnTime.getUTCMinutes();
    const daysLeft = getDaysLeft();

    if (h === 8 && m === 0) {
        const msg = `CHAO BUOI SANG — F0 DANG LO, TA DANG CO KE HOACH!\n\nDa so F0 dang so hai khong biet hom nay thi truong di dau... Nhung thanh vien SWC da co ke hoach tu dau thang.\n\nSu that tan nhan: 95% nguoi tu trade thua lo khong phai vi thieu thong tin — ma vi thieu he thong ky luat.\n\nCon ${daysLeft} ngay de gia nhap he thong truoc khi cua dong vinh vien!`;
        await broadcastToAll(msg, IMG_MAIN_MENU);
    }

    if (h === 12 && m === 0) {
        const msg = `KIEN THUC TAI CHINH: Lai kep — Ky quan thu 8\n\n$240/thang × 15 nam × lai kep 20%/nam = $1,000,000+\n\nBi quyet la bat dau SOM va ky luat DEU DAN. Dung danh bac voi thoi gian. Con ${daysLeft} ngay de len tau SWC Pass!`;
        await broadcastToAll(msg, IMG_ROAD1M);
    }

    if (h === 19 && m === 30) {
        const msg = `THOI GIAN CAP NHAT KIEN THUC BAO VE TAI SAN!\n\nVao Group cong dong ngay de:\n- Cap nhat tien do du an ATLAS Dubai (RWA)\n- Thao luan chien luoc dau tu Lai Kep\n- Ket noi 1.000+ nha dau tu tinh hoa\n\nGiu chat vi tien! Con ${daysLeft} ngay de mua vi the tot nhat!`;
        await broadcastToAll(msg, IMG_SWCFIELD);
    }

    if (h === 20 && m === 30) {
        const msg = `NHAC NHO KHAN CAP — CON DUNG ${daysLeft} NGAY!\n\nLuc nay co 2 loai nguoi:\nLoai 1: F0 dang lo lang thi truong, nhin chart do mat...\nLoai 2: Da so huu SWC Pass — dang ngu ngon trong khi he thong tu dong chay.\n\nGoi Ultimate (Vinh vien) — Gioi han 1.000 suat — Se dong cua vinh vien vao ${DEADLINE}. Khong co ngoai le.`;
        await broadcastToStage('hot_lead', msg);
        await broadcastToStage('interested', msg);
    }
}, 60000);

// ==========================================================
// ADMIN PANEL & CAC LENH QUAN TRI
// ==========================================================
bot.onText(/\/(admin|menu)/i, async (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id, `ADMIN PANEL SWC BOT V5`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Thong ke Pheu", callback_data: 'admin_stats' }],
                [{ text: "Bang lenh Quan tri", callback_data: 'admin_help' }]
            ]
        }
    });
});

bot.onText(/\/sendall ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const users = await User.find({});
    bot.sendMessage(ADMIN_ID, `Bat dau gui tin nhan hang loat kem anh cho ${users.length} nguoi...`);
    const success = await broadcastToAll(match[1], IMG_MAIN_MENU);
    bot.sendMessage(ADMIN_ID, `Gui thanh cong: ${success}/${users.length} khach hang.`);
});

bot.onText(/\/broadcast (\w+) ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const [, stage, text] = match;
    await broadcastToStage(stage, text);
    bot.sendMessage(ADMIN_ID, `Da gui tin den nhom: ${stage}`);
});

bot.onText(/\/tracuu (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const user = await User.findOne({ userId: match[1] });
    if (!user) return bot.sendMessage(ADMIN_ID, `Khong tim thay!`);
    const lastSeen = user.lastSeenDate ? new Date(user.lastSeenDate).toLocaleString('vi-VN') : 'Chua co';
    bot.sendMessage(ADMIN_ID, `HO SO KHACH HANG\nID: ${match[1]}\nTen: ${user.firstName} ${user.lastName}\nSDT: ${user.phone || 'Chua co'}\nFunnel: ${user.funnelStage}\nGoi Pass: ${user.swcPassTier}\nSo tin nhan: ${user.messageCount || 0}\nLan cuoi hoat dong: ${lastSeen}\nTone gan nhat: ${user.lastTone || 'chua xac dinh'}\nQuan tam chinh: ${user.mainConcern || 'chua xac dinh'}\nGhi chu: ${user.notes || 'Khong co'}`, { parse_mode: 'HTML' });
});

bot.onText(/\/setpass (\d+) (\w+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const tier = match[2].toLowerCase();
    if (!['none', 'essential', 'plus', 'ultimate'].includes(tier)) return bot.sendMessage(ADMIN_ID, `Sai goi! Dung: essential / plus / ultimate`);
    await User.updateOne({ userId: match[1] }, { $set: { swcPassTier: tier, funnelStage: tier !== 'none' ? 'converted' : 'hot_lead' } });
    bot.sendMessage(ADMIN_ID, `Da cap nhat Goi: ${tier} cho ${match[1]}`);
});

bot.onText(/\/settag (\d+) (\w+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    await User.updateOne({ userId: match[1] }, { $set: { tag: match[2] } });
    bot.sendMessage(ADMIN_ID, `Da cap nhat tag: ${match[2]} cho ${match[1]}`);
});

bot.onText(/\/reset (\d+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    await User.updateOne({ userId: match[1] }, { $set: { chatHistory: [], adminPausedAiUntil: null } });
    bot.sendMessage(ADMIN_ID, `Da reset lich su AI cho ${match[1]}`);
});

bot.onText(/\/note (\d+) ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    await User.updateOne({ userId: match[1] }, { $set: { notes: match[2] } });
    bot.sendMessage(ADMIN_ID, `Da luu ghi chu cho ${match[1]}: ${match[2]}`);
});

bot.onText(/\/sendgroup ([\s\S]+)/i, async (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    try {
        await bot.sendMessage(GROUP_USERNAME, `THONG BAO TU BQT:\n\n${match[1]}`, { parse_mode: 'HTML' });
        bot.sendMessage(ADMIN_ID, `Da gui Group!`);
    } catch (e) { bot.sendMessage(ADMIN_ID, `Loi: ${e.message}`); }
});

// ==========================================================
// HTTP SERVER (BAT BUOC DE RENDER KHONG SAP)
// ==========================================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SWC Bot v5.0 - Running OK!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Port ${PORT}`);
    console.log("MA TRAN CHOT SALE VA AI CLAUDE DA KICH HOAT THANH CONG!");
});
