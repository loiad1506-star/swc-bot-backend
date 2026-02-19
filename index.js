import { useState, useEffect } from 'react';

function App() {
    const [activeTab, setActiveTab] = useState('home');
    const [balance, setBalance] = useState(0);
    const [wallet, setWallet] = useState('');
    const [userId, setUserId] = useState('');

    // LINK NÃO BỘ (BACKEND) CỦA BẠN
    const BACKEND_URL = 'https://swc-bot-backend.onrender.com'; 

    const theme = { bg: '#0F0F0F', cardBg: '#1C1C1E', gold: '#F4D03F', textLight: '#FFFFFF', textDim: '#8E8E93', border: '#333333' };

    // --- NỐI DÂY LẤY DỮ LIỆU TỪ BACKEND ---
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.ready();
            const user = tg.initDataUnsafe?.user;
            if (user) {
                setUserId(user.id.toString());
                // Chạy sang API của Bot hỏi: "Tài khoản của tôi có bao nhiêu tiền?"
                fetch(`${BACKEND_URL}/api/user?id=${user.id}`)
                    .then(res => res.json())
                    .then(data => {
                        setBalance(data.balance);
                        setWallet(data.wallet || '');
                    })
                    .catch(err => console.log("Lỗi kết nối Backend:", err));
            }
        }
    }, []);

    const saveWallet = () => {
        if (!wallet) return alert("Vui lòng nhập địa chỉ ví!");
        fetch(`${BACKEND_URL}/api/save-wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, wallet })
        }).then(() => alert('Đã lưu ví Gate.io thành công!'));
    };

    const renderWallet = () => (
        <div style={{ padding: '20px' }}>
            <div style={{ backgroundColor: theme.cardBg, borderRadius: '15px', padding: '25px 20px', border: `1px solid ${theme.border}`, textAlign: 'center' }}>
                <p style={{ color: theme.textDim, fontSize: '14px' }}>Số dư hiện tại</p>
                <h1 style={{ color: theme.gold, fontSize: '40px', fontWeight: '900', margin: '10px 0' }}>{balance} <span style={{fontSize: '20px'}}>SWGT</span></h1>
            </div>

            <div style={{ marginTop: '25px', textAlign: 'left' }}>
                <p style={{ color: theme.textDim, fontSize: '13px' }}>Ví nhận SWGT (BEP20) trên Gate.io:</p>
                <input 
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                    placeholder="Dán địa chỉ 0x..."
                    style={{ width: '100%', padding: '15px', borderRadius: '10px', backgroundColor: '#000', color: theme.gold, border: `1px solid ${theme.border}`, marginTop: '8px', boxSizing: 'border-box' }}
                />
                <button onClick={saveWallet} style={{ width: '100%', backgroundColor: theme.gold, color: '#000', padding: '15px', borderRadius: '10px', fontWeight: 'bold', border: 'none', marginTop: '15px', fontSize: '16px' }}>
                    💾 LƯU ĐỊA CHỈ VÍ
                </button>
            </div>
        </div>
    );

    const renderHome = () => (
        <div style={{ padding: '20px' }}>
            <div style={{ backgroundColor: theme.cardBg, borderRadius: '15px', padding: '20px', marginBottom: '15px', border: `1px solid ${theme.border}` }}>
                <h2 style={{ color: theme.gold, margin: '0 0 10px 0', fontSize: '18px' }}>🚀 Cách Hoạt Động</h2>
                <p style={{ color: theme.textDim, fontSize: '14px', lineHeight: '1.6' }}>
                    <b style={{color: theme.textLight}}>Bước 1:</b> Liên kết với Bot trên Telegram.<br/>
                    <b style={{color: theme.textLight}}>Bước 2:</b> Chia sẻ link giới thiệu.<br/>
                    <b style={{color: theme.textLight}}>Bước 3:</b> Nhận SWGT thưởng.<br/>
                    <b style={{color: theme.textLight}}>Bước 4:</b> Rút về ví cá nhân.
                </p>
            </div>
        </div>
    );

    return (
        <div style={{ backgroundColor: theme.bg, color: theme.textLight, minHeight: '100vh', fontFamily: 'sans-serif', paddingBottom: '80px' }}>
            <div style={{ padding: '15px 20px', borderBottom: `1px solid ${theme.border}`, color: theme.gold }}><b>CỘNG ĐỒNG SWC</b></div>
            {activeTab === 'home' && renderHome()}
            {activeTab === 'rewards' && <div style={{padding:'20px'}}>Mời bạn bè để nhận thưởng.</div>}
            {activeTab === 'wallet' && renderWallet()}
            
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: theme.cardBg, display: 'flex', padding: '15px 0' }}>
                <div onClick={() => setActiveTab('home')} style={{ width: '33%', textAlign: 'center', color: activeTab === 'home' ? theme.gold : theme.textDim }}>🏠</div>
                <div onClick={() => setActiveTab('rewards')} style={{ width: '33%', textAlign: 'center', color: activeTab === 'rewards' ? theme.gold : theme.textDim }}>🎁</div>
                <div onClick={() => setActiveTab('wallet')} style={{ width: '33%', textAlign: 'center', color: activeTab === 'wallet' ? theme.gold : theme.textDim }}>👛</div>
            </div>
        </div>
    );
}

export default App;
