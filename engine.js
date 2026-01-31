// --- [데이터 및 운영 변수] ---
let gameState = {
    currentDate: new Date('2025-07-21'),
    fixtures: [{ date: '2025-07-22', opp: 'Arsenal', played: false }],
    standings: [{name: 'Leicester', pts: 0}, {name: 'Arsenal', pts: 0}, {name: 'Man City', pts: 0}],
    isMatchRunning: false
};

let allPlayers = []; // JSON 로드 데이터
let activePlayers = []; // 현재 피치 위 선수 객체
let selectedPlayer = null;
let ball = { x: 525, y: 340, vx: 0, vy: 0 };

// --- [Logic A: 초현실 물리 클래스] ---
class SuperRealPlayer {
    constructor(data, teamSide) {
        this.data = data;
        this.team = teamSide;
        this.x = teamSide === 'home' ? 300 + Math.random()*50 : 700 + Math.random()*50;
        this.y = 100 + Math.random()*400;
        this.vx = 0; this.vy = 0;
        this.stamina = 1.0;
        
        // 스탯 기반 물리 계수
        this.mass = data.weight_kg || 75;
        this.agility = (data.movement_agility || 50) / 100;
        this.accelBase = (data.movement_acceleration || 50) / 100;
    }

    // 감독님 공식: 복리 감소 xG
    calculateXG() {
        let xg = (this.data.shooting || 50) / 100; // 1. 슈팅 스탯 기본값
        
        // 2. 거리 복리 감소 (10.5px당 4%)
        const dist = Math.hypot(1050 - this.x, 340 - this.y);
        for(let i=0; i < Math.floor(dist/10.5); i++) xg *= 0.96;
        
        // 3. 각도 복리 감소 (1도당 2%)
        const angleDeg = Math.abs(Math.atan2(340-this.y, 1050-this.x) * 180 / Math.PI);
        for(let i=0; i < Math.floor(angleDeg); i++) xg *= 0.98;

        // 4. 키퍼 방해 (복리 1%)
        for(let i=0; i < Math.floor((180-angleDeg)/10); i++) xg *= 0.99;

        return Math.max(0.001, xg).toFixed(3);
    }

    update() {
        // F=ma 물리 엔진
        const dx = ball.x - this.x;
        const dy = ball.y - this.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 5) {
            const force = this.accelBase * this.stamina * 0.4;
            this.vx += (dx/dist) * force / (this.mass/70);
            this.vy += (dy/dist) * force / (this.mass/70);
        }

        // 민첩성 기반 마찰 (관성 제어)
        const friction = 0.8 + (this.agility * 0.15);
        this.vx *= friction; this.vy *= friction;
        
        this.x += this.vx; this.y += this.vy;
        this.stamina -= (Math.abs(this.vx) + Math.abs(this.vy)) * 0.0001; // 실시간 체력 소모
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, (this.data.height_cm/180)*12, 0, Math.PI*2);
        ctx.fillStyle = this.team === 'home' ? '#0053a0' : '#ef4444';
        ctx.fill();
        ctx.strokeStyle = selectedPlayer === this ? 'white' : 'transparent';
        ctx.lineWidth = 3; ctx.stroke();
    }
}

// --- [Logic B: 날짜 진행 및 일정] ---
function advanceDay() {
    gameState.currentDate.setDate(gameState.currentDate.getDate() + 1);
    const dateStr = gameState.currentDate.toISOString().split('T')[0];
    
    document.getElementById('cur-date-display').innerText = 
        gameState.currentDate.toLocaleDateString('ko-KR', {year:'numeric', month:'long', day:'numeric', weekday:'long'});

    const todayMatch = gameState.fixtures.find(f => f.date === dateStr && !f.played);
    if (todayMatch) {
        if (confirm(`${todayMatch.opp}와의 경기일입니다. 진입할까요?`)) {
            startMatch(todayMatch);
        }
    }
}

async function startMatch(fixture) {
    gameState.isMatchRunning = true;
    document.getElementById('match-layer').style.display = 'flex';
    
    // 데이터 필터링 및 선수 객체화
    const homeData = allPlayers.filter(p => p.club_name === "Leicester City").slice(0, 11);
    const awayData = allPlayers.filter(p => p.club_name === fixture.opp).slice(0, 11);
    
    activePlayers = [
        ...homeData.map(p => new SuperRealPlayer(p, 'home')),
        ...awayData.map(p => new SuperRealPlayer(p, 'away'))
    ];
    
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (!gameState.isMatchRunning) return;
    const canvas = document.getElementById('pitch');
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, 1050, 680);
    ctx.fillStyle = "#14532d"; ctx.fillRect(0,0,1050,680); // 잔디
    
    activePlayers.forEach(p => {
        p.update();
        p.draw(ctx);
        if (p === selectedPlayer) {
            document.getElementById('sel-xg').innerText = p.calculateXG();
            document.getElementById('sel-stam').innerText = (p.stamina*100).toFixed(1) + "%";
            document.getElementById('sel-mom').innerText = (Math.abs(p.vx)+Math.abs(p.vy)).toFixed(2);
        }
    });

    requestAnimationFrame(gameLoop);
}

// 초기 데이터 로드
fetch('Premier_League_FC26.json').then(r => r.json()).then(data => {
    allPlayers = data;
    console.log("매니저 데이터 로드 완료");
});
