/**
 * FC26 Hyper-Realistic Tactical Engine (Full Integration)
 * 로직 A: 110개 스탯 기반 물리 + 복리 xG
 * 로직 B: 경기 시간, 통계(슈팅, 카드, 코너킥), 실시간 스태미나 HUD
 */

// --- [1. 전역 상태 관리] ---
let gameState = {
    currentDate: new Date('2025-07-21'),
    isMatchRunning: false,
    matchTime: 0, // 초 단위 경기 시간
    myTeam: "Leicester City",
    fixtures: [{ date: '2025-07-22', opp: 'Arsenal', played: false }],
    stats: {
        home: { shots: 0, shotsOn: 0, corners: 0, yellow: 0, red: 0, goals: 0 },
        away: { shots: 0, shotsOn: 0, corners: 0, yellow: 0, red: 0, goals: 0 }
    }
};

let allPlayers = []; 
let activePlayers = [];
let selectedPlayer = null;
let ball = { x: 525, y: 340, vx: 0, vy: 0, radius: 6 };

// --- [2. 초현실 물리 선수 클래스] ---
class SuperRealPlayer {
    constructor(data, teamSide) {
        this.data = data;
        this.team = teamSide;
        this.name = data.short_name;
        this.number = data.club_jersey_number || "??";
        this.pos = data.player_positions ? data.player_positions.split(',')[0] : "SUB";
        
        // 초기 배치
        this.x = teamSide === 'home' ? 100 + Math.random()*300 : 650 + Math.random()*300;
        this.y = 50 + Math.random()*580;
        
        this.vx = 0; this.vy = 0;
        this.stamina = 1.0; // 100%
        
        // 물리 상수 (110개 스탯 기반)
        this.mass = data.weight_kg || 75;
        this.accelBase = (data.movement_acceleration || 50) / 100;
        this.agility = (data.movement_agility || 50) / 100;
    }

    // 감독님 공식: 복리 감소 xG 계산
    calculateXG() {
        let xg = (this.data.shooting || 50) / 100;
        const targetX = this.team === 'home' ? 1050 : 0; // 상대 골대 위치
        const dist = Math.hypot(targetX - this.x, 340 - this.y);
        
        // 거리 10.5px당 4% 복리 감소
        for(let i=0; i < Math.floor(dist/10.5); i++) xg *= 0.96;
        
        // 각도 1도당 2% 복리 감소
        const angleDeg = Math.abs(Math.atan2(340-this.y, Math.abs(targetX-this.x)) * 180 / Math.PI);
        for(let i=0; i < Math.floor(angleDeg); i++) xg *= 0.98;

        return Math.max(0.001, xg).toFixed(3);
    }

    update() {
        if (!gameState.isMatchRunning) return;

        // 공 추적 로직 (간단한 AI)
        const dx = ball.x - this.x;
        const dy = ball.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 10) {
            const force = this.accelBase * this.stamina * 0.5;
            this.vx += (dx / dist) * force / (this.mass / 70);
            this.vy += (dy / dist) * force / (this.mass / 70);
        }

        // 민첩성(Agility) 기반 관성 제어
        const friction = 0.85 + (this.agility * 0.1);
        this.vx *= friction; this.vy *= friction;
        
        this.x += this.vx; this.y += this.vy;

        // 실시간 스태미나 소모 (이동 거리에 비례)
        this.stamina -= (Math.abs(this.vx) + Math.abs(this.vy)) * 0.00015;
        if (this.stamina < 0) this.stamina = 0;
    }

    draw(ctx) {
        // 몸체
        ctx.beginPath();
        ctx.arc(this.x, this.y, 13, 0, Math.PI * 2);
        ctx.fillStyle = this.team === 'home' ? '#0053a0' : '#8b0000';
        ctx.fill();
        ctx.strokeStyle = (selectedPlayer === this) ? '#fbbf24' : '#ffffff';
        ctx.lineWidth = (selectedPlayer === this) ? 3 : 1;
        ctx.stroke();

        // 번호
        ctx.fillStyle = "white";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.number, this.x, this.y + 4);

        // 이름 & 스태미나 바 (머리 위)
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "11px sans-serif";
        ctx.fillText(this.name, this.x, this.y - 22);

        // 선수 개별 미니 스태미나 바
        ctx.fillStyle = "#333";
        ctx.fillRect(this.x - 10, this.y - 18, 20, 3);
        ctx.fillStyle = this.stamina > 0.3 ? "#22c55e" : "#ef4444";
        ctx.fillRect(this.x - 10, this.y - 18, 20 * this.stamina, 3);
    }
}

// --- [3. 경기 운영 시스템 (Logic B)] ---

function updateMatchStats() {
    // 경기 시간 업데이트 (현실 1초 = 경기 1분 가정)
    gameState.matchTime += 0.5; 
    let mins = Math.floor(gameState.matchTime / 60);
    let secs = Math.floor(gameState.matchTime % 60);
    document.getElementById('match-time').innerText = 
        `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

    if (mins >= 90) stopMatch(); // 90분 종료

    // 실시간 통계 UI 업데이트
    document.getElementById('stat-shots').innerText = `${gameState.stats.home.shots} / ${gameState.stats.away.shots}`;
    document.getElementById('stat-shots-on').innerText = `${gameState.stats.home.shotsOn} / ${gameState.stats.away.shotsOn}`;
    document.getElementById('stat-corners').innerText = `${gameState.stats.home.corners} / ${gameState.stats.away.corners}`;
    document.getElementById('stat-yellows').innerText = `${gameState.stats.home.yellow} / ${gameState.stats.away.yellow}`;
    document.getElementById('stat-reds').innerText = `${gameState.stats.home.red} / ${gameState.stats.away.red}`;
}

function advanceDay() {
    gameState.currentDate.setDate(gameState.currentDate.getDate() + 1);
    const dateStr = gameState.currentDate.toISOString().split('T')[0];
    
    document.getElementById('display-date').innerText = 
        gameState.currentDate.toLocaleDateString('ko-KR', {year:'numeric', month:'long', day:'numeric', weekday:'long'});

    const todayMatch = gameState.fixtures.find(f => f.date === dateStr && !f.played);
    if (todayMatch) {
        if (confirm(`${todayMatch.opp}와의 경기일입니다. 킥오프하시겠습니까?`)) {
            startMatch(todayMatch);
        }
    }
}

async function startMatch(fixture) {
    gameState.isMatchRunning = true;
    gameState.matchTime = 0;
    document.getElementById('match-view').style.display = 'flex';
    document.getElementById('home-team-name').innerText = gameState.myTeam.toUpperCase();
    document.getElementById('away-team-name').innerText = fixture.opp.toUpperCase();

    const homeData = allPlayers.filter(p => p.club_name === gameState.myTeam).slice(0, 11);
    const awayData = allPlayers.filter(p => p.club_name === fixture.opp).slice(0, 11);
    
    activePlayers = [
        ...homeData.map(p => new SuperRealPlayer(p, 'home')),
        ...awayData.map(p => new SuperRealPlayer(p, 'away'))
    ];
    
    requestAnimationFrame(gameLoop);
}

function stopMatch() {
    gameState.isMatchRunning = false;
    document.getElementById('match-view').style.display = 'none';
}

// --- [4. 메인 루프 & 인터랙션] ---

function gameLoop() {
    if (!gameState.isMatchRunning) return;
    
    const canvas = document.getElementById('pitch');
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, 1050, 680);
    ctx.fillStyle = "#14532d"; ctx.fillRect(0,0,1050,680); // 잔디
    
    // 중앙선/골대 시각화
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0,0,1050,680);
    ctx.beginPath(); ctx.moveTo(525, 0); ctx.lineTo(525, 680); ctx.stroke();

    // 공 그리기
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2);
    ctx.fillStyle = "white"; ctx.fill();

    // 선수 업데이트
    activePlayers.forEach(p => {
        p.update();
        p.draw(ctx);
        
        // HUD 연동 (선택된 선수)
        if (p === selectedPlayer) {
            document.getElementById('hud-name').innerText = `${p.number}. ${p.name}`;
            document.getElementById('hud-pos').innerText = p.pos;
            document.getElementById('hud-xg').innerText = p.calculateXG();
            document.getElementById('hud-mom').innerText = (Math.abs(p.vx)+Math.abs(p.vy)).toFixed(2);
            document.getElementById('hud-stamina-fill').style.width = (p.stamina * 100) + "%";
            document.getElementById('hud-stamina-fill').style.background = p.stamina > 0.3 ? "#22c55e" : "#ef4444";
        }
    });

    updateMatchStats();
    requestAnimationFrame(gameLoop);
}

// 클릭으로 선수 선택
document.getElementById('pitch').addEventListener('mousedown', (e) => {
    const rect = e.target.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    selectedPlayer = activePlayers.find(p => Math.hypot(p.x - mx, p.y - my) < 20) || null;
});

// 데이터 로드
fetch('Premier_League_FC26.json').then(r => r.json()).then(data => {
    allPlayers = data;
    console.log("엔진 준비 완료: " + allPlayers.length + "명 로드됨");
});
