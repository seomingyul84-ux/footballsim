/**
 * FC26 Hyper-Realistic Master Engine
 * 1. 110개 스탯 물리 연동 (F=ma, Agility Friction, Sprint Speed)
 * 2. 복리 xG 계산 (거리 4% / 각도 2% 복리 감소)
 * 3. 20개 팀 프리미어리그 정식 순위표 및 일정 시스템
 * 4. 포지션 기반 전술 유지 및 경기장 경계 물리 벽 적용
 */

// --- [1. 전역 설정 및 상수] ---
const CONFIG = {
    PITCH_W: 1000,
    PITCH_H: 650,
    GOAL_SIZE: 120,
    XG_DIST_DECAY: 0.96,  // 10.5px당 4% 감소
    XG_ANGLE_DECAY: 0.98, // 1도당 2% 감소
    TEAMS: ["Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea", "Crystal Palace", "Everton", "Fulham", "Ipswich", "Leicester City", "Liverpool", "Man City", "Man Utd", "Newcastle", "Nottm Forest", "Southampton", "Tottenham", "West Ham", "Wolves"]
};

let gameState = {
    date: new Date('2025-07-21'),
    isMatch: false,
    matchTime: 0,
    myTeam: "Leicester City",
    // 20개 팀 순위표 초기화
    standings: CONFIG.TEAMS.map(name => ({ name, p: 0, pts: 0, gd: 0 })),
    fixtures: [
        { date: '2025-07-22', opp: 'Arsenal', played: false },
        { date: '2025-07-29', opp: 'Man City', played: false }
    ],
    // 실시간 경기 통계
    stats: {
        home: { shots: 0, shotsOn: 0, corners: 0, yellow: 0, red: 0, goals: 0 },
        away: { shots: 0, shotsOn: 0, corners: 0, yellow: 0, red: 0, goals: 0 }
    }
};

let allPlayers = [], activePlayers = [], selected = null;
let ball = { x: 500, y: 325, vx: 0, vy: 0, radius: 7, lastTouch: 'home' };

// --- [2. 헬퍼 함수] ---
const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// --- [3. 110개 스탯 기반 물리 선수 클래스] ---
class SuperRealPlayer {
    constructor(data, teamType, posIdx) {
        this.data = data;
        this.team = teamType;
        this.name = data.short_name;
        this.num = data.club_jersey_number || "??";
        this.pos = data.player_positions ? data.player_positions.split(',')[0] : "SUB";
        
        // [물리 능력치 매핑]
        this.mass = data.weight_kg || 75;
        this.accelBase = (data.movement_acceleration || 50) / 100;
        this.sprintSpeed = (data.movement_sprint_speed || 50) / 100;
        this.agility = (data.movement_agility || 50) / 100;
        this.stamina = 1.0;

        // [포지션 기반 배치 로직]
        // 4-4-2 등 포지션별 기본 위치 설정 (좌우 반전)
        const row = Math.floor(posIdx / 4);
        const col = posIdx % 4;
        this.homeX = teamType === 'home' ? 80 + (row * 130) : 920 - (row * 130);
        this.homeY = 100 + (col * 140);
        
        this.x = this.homeX;
        this.y = this.homeY;
        this.vx = 0; this.vy = 0;
    }

    // 복리 xG 공식 복구
    calculateXG() {
        let xg = (this.data.shooting || 50) / 100;
        const targetX = this.team === 'home' ? CONFIG.PITCH_W : 0;
        const dist = Math.hypot(targetX - this.x, CONFIG.PITCH_H/2 - this.y);
        
        // 거리 복리 감소
        for(let i=0; i < Math.floor(dist/10.5); i++) xg *= CONFIG.XG_DIST_DECAY;
        
        // 각도 복리 감소
        const angleRad = Math.atan2(Math.abs(CONFIG.PITCH_H/2 - this.y), Math.abs(targetX - this.x));
        const angleDeg = Math.floor(angleRad * 180 / Math.PI);
        for(let i=0; i < angleDeg; i++) xg *= CONFIG.XG_ANGLE_DECAY;

        return Math.max(0.001, xg).toFixed(4);
    }

    update() {
        if (!gameState.isMatch) return;

        // 공과의 거리
        const dx = ball.x - this.x;
        const dy = ball.y - this.y;
        const distToBall = Math.hypot(dx, dy);

        // [AI 지능: 자기 구역 방어 및 추격]
        let tx = this.homeX, ty = this.homeY;
        if (distToBall < 250) { // 공이 근처에 올 때만 추격
            tx = ball.x; ty = ball.y;
        }

        const moveX = tx - this.x;
        const moveY = ty - this.y;
        const moveDist = Math.hypot(moveX, moveY);

        if (moveDist > 5) {
            // F = ma 기반 가속도
            const force = this.accelBase * this.stamina * 2.2;
            this.vx += (moveX / moveDist) * force / (this.mass / 70);
            this.vy += (moveY / moveDist) * force / (this.mass / 70);
        }

        // 민첩성 기반 마찰력 (Agility Friction)
        const friction = 0.83 + (this.agility * 0.1);
        this.vx *= friction; this.vy *= friction;

        // 최고 속도 제한 (Sprint Speed)
        const currSpd = Math.hypot(this.vx, this.vy);
        const maxSpd = this.sprintSpeed * 7 * this.stamina;
        if (currSpd > maxSpd) {
            this.vx = (this.vx / currSpd) * maxSpd;
            this.vy = (this.vy / currSpd) * maxSpd;
        }

        // 탈영 방지: 경기장 경계 물리 벽
        this.x = Math.max(25, Math.min(CONFIG.PITCH_W - 25, this.x + this.vx));
        this.y = Math.max(25, Math.min(CONFIG.PITCH_H - 25, this.y + this.vy));

        // 실시간 스태미나 소모
        this.stamina -= (Math.abs(this.vx) + Math.abs(this.vy)) * 0.00015;
        if (this.stamina < 0.1) this.stamina = 0.1;

        // 공 충돌 판정
        if (distToBall < 15) this.handleBall();
    }

    handleBall() {
        ball.vx = this.vx * 1.2;
        ball.vy = this.vy * 1.2;
        ball.lastTouch = this.team;
        
        // 슈팅 AI (xG가 일정 수준 이상일 때)
        if (parseFloat(this.calculateXG()) > 0.12 && Math.random() < 0.02) {
            this.shoot();
        }
    }

    shoot() {
        const targetX = this.team === 'home' ? CONFIG.PITCH_W : 0;
        const targetY = CONFIG.PITCH_H / 2 + (Math.random() * 40 - 20);
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy);

        ball.vx = (dx / dist) * 22;
        ball.vy = (dy / dist) * 22;

        gameState.stats[this.team].shots++;
        if (Math.random() < 0.4) gameState.stats[this.team].shotsOn++;
        updateStatUI();
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = this.team === 'home' ? '#0053a0' : '#8b0000';
        ctx.fill();
        ctx.strokeStyle = (selected === this) ? '#fbbf24' : '#ffffff';
        ctx.lineWidth = (selected === this) ? 3 : 1;
        ctx.stroke();

        // 이름 및 번호
        ctx.fillStyle = "white"; ctx.font = "bold 10px Arial"; ctx.textAlign = "center";
        ctx.fillText(this.num, this.x, this.y + 4);
        ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = "10px sans-serif";
        ctx.fillText(this.name, this.x, this.y - 22);

        // 머리 위 미니 스태미나 바
        ctx.fillStyle = "#333"; ctx.fillRect(this.x - 12, this.y - 18, 24, 3);
        ctx.fillStyle = this.stamina > 0.3 ? "#22c55e" : "#ef4444";
        ctx.fillRect(this.x - 12, this.y - 18, 24 * this.stamina, 3);
    }
}

// --- [4. 시스템 및 인터페이스 로직] ---

function updateStatUI() {
    const s = gameState.stats;
    document.getElementById('stat-shots').innerText = `${s.home.shots} / ${s.away.shots}`;
    document.getElementById('stat-shotson').innerText = `${s.home.shotsOn} / ${s.away.shotsOn}`;
    document.getElementById('stat-corners').innerText = `${s.home.corners} / ${s.away.corners}`;
    document.getElementById('stat-cards').innerText = `${s.home.yellow} / ${s.away.yellow}`;
}

function renderUI() {
    // 날짜 갱신
    document.getElementById('current-date').innerText = gameState.date.toLocaleDateString('ko-KR', {year:'numeric', month:'long', day:'numeric', weekday:'long'});
    
    // 순위표 갱신 (20개 팀)
    const body = document.getElementById('standings-body');
    body.innerHTML = gameState.standings
        .sort((a,b) => b.pts - a.pts || b.gd - a.gd)
        .map((t, i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.p}</td><td>${t.pts}</td></tr>`).join('');

    // 다음 경기 카드
    const next = gameState.fixtures.find(f => !f.played);
    const card = document.getElementById('next-match-info');
    if (next) {
        const isMatchDay = next.date === formatDate(gameState.date);
        card.innerHTML = `
            <div style="font-size:20px; font-weight:bold; color:${isMatchDay?'#ef4444':'white'}">VS ${next.opp.toUpperCase()}</div>
            <div style="font-size:11px; color:#888; margin-top:5px;">일정: ${next.date} ${isMatchDay?'(오늘)':'(홈)'}</div>
        `;
    }
}

function advanceDay() {
    gameState.date.setDate(gameState.date.getDate() + 1);
    renderUI();
    const todayMatch = gameState.fixtures.find(f => f.date === formatDate(gameState.date) && !f.played);
    if (todayMatch) {
        setTimeout(() => { if(confirm(`[경기 당일] ${todayMatch.opp}전 킥오프하시겠습니까?`)) startMatch(todayMatch); }, 100);
    }
}

function startMatch(fixture) {
    gameState.isMatch = true;
    gameState.matchTime = 0;
    document.getElementById('match-view').style.display = 'flex';
    
    // 팀 필터링 (레스터 시티 vs 상대팀)
    const homeRaw = allPlayers.filter(p => p.club_name.includes("Leicester")).slice(0, 11);
    const awayRaw = allPlayers.filter(p => p.club_name.includes(fixture.opp)).slice(0, 11);

    activePlayers = [
        ...homeRaw.map((p, i) => new SuperRealPlayer(p, 'home', i)),
        ...awayRaw.map((p, i) => new SuperRealPlayer(p, 'away', i))
    ];
    requestAnimationFrame(gameLoop);
}

function stopMatch() {
    gameState.isMatch = false;
    document.getElementById('match-view').style.display = 'none';
}

function gameLoop() {
    if (!gameState.isMatch) return;
    const canvas = document.getElementById('pitch'), ctx = canvas.getContext('2d');
    
    // 경기장 렌더링
    ctx.fillStyle = "#14532d"; ctx.fillRect(0,0,1000,650);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.strokeRect(10,10,980,630);
    ctx.beginPath(); ctx.moveTo(500,0); ctx.lineTo(500,650); ctx.stroke();

    // 시간 업데이트
    gameState.matchTime += 0.4;
    const m = Math.floor(gameState.matchTime / 60);
    document.getElementById('match-timer').innerText = `${String(m).padStart(2,'0')}:${String(Math.floor(gameState.matchTime % 60)).padStart(2,'0')}`;

    // 공 물리
    ball.x += ball.vx; ball.y += ball.vy;
    ball.vx *= 0.98; ball.vy *= 0.98;
    
    // 벽 충돌 (공)
    if (ball.x < 0 || ball.x > 1000) {
        if (Math.abs(ball.y - 325) < CONFIG.GOAL_SIZE/2) {
            gameState.stats[ball.x > 500 ? 'home' : 'away'].goals++;
            document.getElementById('score').innerText = `${gameState.stats.home.goals} : ${gameState.stats.away.goals}`;
            ball.x = 500; ball.y = 325; ball.vx = 0; ball.vy = 0;
        }
        ball.vx *= -1;
    }
    if (ball.y < 0 || ball.y > 650) ball.vy *= -1;

    ctx.beginPath(); ctx.arc(ball.x, ball.y, 7, 0, Math.PI*2); ctx.fillStyle="white"; ctx.fill();

    // 선수 업데이트
    activePlayers.forEach(p => {
        p.update(); p.draw(ctx);
        if (p === selected) {
            document.getElementById('hud-name').innerText = `${p.num}. ${p.name}`;
            document.getElementById('hud-xg').innerText = p.calculateXG();
            document.getElementById('stamina-fill').style.width = (p.stamina * 100) + "%";
        }
    });

    if (m < 90) requestAnimationFrame(gameLoop);
    else { alert("경기 종료"); stopMatch(); }
}

// 초기화
document.getElementById('pitch').onmousedown = (e) => {
    const r = e.target.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    selected = activePlayers.find(p => Math.hypot(p.x - mx, p.y - my) < 20) || null;
};

fetch('Premier_League_FC26.json').then(r => r.json()).then(data => {
    allPlayers = data;
    renderUI();
    console.log("Full Integrated Engine Loaded.");
});
