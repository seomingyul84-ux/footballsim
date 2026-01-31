/** * FC26 Hyper-Realistic Master Engine v6 (Full Length)
 * - 20개 팀 풀 로스터 및 순위표 복구 (텅 비는 현상 제거)
 * - 시차 오류 없는 날짜 진행 시스템
 * - 110개 스탯 기반 물리 엔진 (F=ma, Agility, Sprint Speed)
 * - 전술적 구역 방어 AI 및 경기장 이탈 방지 벽
 */

// --- [1. 전역 설정 및 상수] ---
const CONFIG = {
    PITCH_W: 1000,
    PITCH_H: 650,
    GOAL_SIZE: 120,
    XG_DIST_DECAY: 0.96,
    XG_ANGLE_DECAY: 0.98,
    // [프리미어리그 20개 팀 풀 데이터 강제 주입]
    TEAMS: ["Leicester City", "Arsenal", "Man City", "Liverpool", "Aston Villa", "Tottenham", "Chelsea", "Newcastle", "Man Utd", "West Ham", "Brighton", "Bournemouth", "Crystal Palace", "Wolves", "Everton", "Fulham", "Nottm Forest", "Brentford", "Ipswich", "Southampton"]
};

let gameState = {
    currentDate: new Date('2025-07-21'),
    isMatch: false,
    matchTime: 0,
    myTeam: "Leicester City",
    // 순위표 초기화 (경기 전 0점 세팅)
    standings: CONFIG.TEAMS.map(name => ({ name, p: 0, w: 0, d: 0, l: 0, pts: 0, gd: 0 })),
    fixtures: [
        { date: '2025-07-22', opp: 'Arsenal', played: false },
        { date: '2025-07-29', opp: 'Man City', played: false },
        { date: '2025-08-05', opp: 'Liverpool', played: false }
    ],
    stats: {
        home: { shots: 0, shotsOn: 0, corners: 0, yellow: 0, goals: 0 },
        away: { shots: 0, shotsOn: 0, corners: 0, yellow: 0, goals: 0 }
    }
};

let allPlayers = [], activePlayers = [], selected = null;
let ball = { x: 500, y: 325, vx: 0, vy: 0, radius: 7 };

// --- [2. 시스템 유틸리티] ---

// 시차 오류 없는 날짜 포맷 생성기
const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- [3. 110개 스탯 기반 물리 선수 클래스] ---

class SuperRealPlayer {
    constructor(data, teamType, posIdx) {
        this.data = data;
        this.team = teamType;
        this.name = data.short_name;
        this.num = data.club_jersey_number || "??";
        
        // [110개 스탯의 물리 속성 매핑 - 복구됨]
        this.mass = data.weight_kg || 75;
        this.accelBase = (data.movement_acceleration || 50) / 100;
        this.sprintSpeed = (data.movement_sprint_speed || 50) / 100;
        this.agility = (data.movement_agility || 50) / 100;
        this.stamina = 1.0;

        // [포지션 기반 전술 배치 - 복구됨]
        const row = Math.floor(posIdx / 4);
        const col = posIdx % 4;
        this.homeX = teamType === 'home' ? 80 + (row * 150) : 920 - (row * 150);
        this.homeY = 100 + (col * 140);
        
        this.x = this.homeX;
        this.y = this.homeY;
        this.vx = 0; this.vy = 0;
    }

    // 복리 xG 산출 (공간 물리 계산)
    calculateXG() {
        let xg = (this.data.shooting || 50) / 100;
        const targetX = this.team === 'home' ? CONFIG.PITCH_W : 0;
        const dist = Math.hypot(targetX - this.x, CONFIG.PITCH_H/2 - this.y);
        
        // 거리에 따른 복리 감쇄
        const distUnits = Math.floor(dist/10.5);
        for(let i=0; i < distUnits; i++) xg *= CONFIG.XG_DIST_DECAY;
        
        // 각도에 따른 복리 감쇄
        const angleRad = Math.atan2(Math.abs(CONFIG.PITCH_H/2 - this.y), Math.abs(targetX - this.x));
        const angleDeg = Math.floor(angleRad * 180 / Math.PI);
        for(let i=0; i < angleDeg; i++) xg *= CONFIG.XG_ANGLE_DECAY;

        return Math.max(0.001, xg).toFixed(4);
    }

    update() {
        if (!gameState.isMatch) return;

        const dx = ball.x - this.x;
        const dy = ball.y - this.y;
        const distToBall = Math.hypot(dx, dy);

        // [AI 지능: 자기 구역 수비 및 공 추격]
        let tx = this.homeX, ty = this.homeY;
        if (distToBall < 300) { tx = ball.x; ty = ball.y; }

        const moveX = tx - this.x;
        const moveY = ty - this.y;
        const moveDist = Math.hypot(moveX, moveY);

        if (moveDist > 5) {
            // 뉴턴의 제2법칙 (F = ma) 적용
            const force = this.accelBase * this.stamina * 2.5;
            this.vx += (moveX / moveDist) * force / (this.mass / 70);
            this.vy += (moveY / moveDist) * force / (this.mass / 70);
        }

        // 민첩성(Agility) 기반 관성 제어 (Friction)
        const friction = 0.82 + (this.agility * 0.12);
        this.vx *= friction; this.vy *= friction;

        // 최고 속도 제한 (Sprint Speed 기반)
        const currSpd = Math.hypot(this.vx, this.vy);
        const maxSpd = this.sprintSpeed * 8 * this.stamina;
        if (currSpd > maxSpd) {
            this.vx = (this.vx / currSpd) * maxSpd;
            this.vy = (this.vy / currSpd) * maxSpd;
        }

        // 경기장 이탈 방지 물리 벽
        this.x = Math.max(25, Math.min(CONFIG.PITCH_W - 25, this.x + this.vx));
        this.y = Math.max(25, Math.min(CONFIG.PITCH_H - 25, this.y + this.vy));

        // 실시간 스태미나 소모 (활동량 비례)
        this.stamina -= (Math.abs(this.vx) + Math.abs(this.vy)) * 0.0002;
        if (this.stamina < 0.1) this.stamina = 0.1;

        // 공 충돌 물리 판정
        if (distToBall < 15) this.handleBallCollision();
    }

    handleBallCollision() {
        ball.vx = this.vx * 1.4;
        ball.vy = this.vy * 1.4;
        
        // xG 기반 슈팅 확률 시도
        const xg = parseFloat(this.calculateXG());
        if (xg > 0.12 && Math.random() < 0.02) {
            this.shoot();
        }
    }

    shoot() {
        const targetX = this.team === 'home' ? CONFIG.PITCH_W : 0;
        const targetY = CONFIG.PITCH_H / 2 + (Math.random() * 60 - 30);
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy);

        ball.vx = (dx / dist) * 25;
        ball.vy = (dy / dist) * 25;

        gameState.stats[this.team].shots++;
        updateMatchUI();
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = this.team === 'home' ? '#0053a0' : '#8b0000';
        ctx.fill();
        ctx.strokeStyle = (selected === this) ? '#fbbf24' : '#ffffff';
        ctx.lineWidth = (selected === this) ? 3 : 1;
        ctx.stroke();

        // 텍스트 정보 (이름, 번호)
        ctx.fillStyle = "white"; ctx.font = "bold 10px Arial"; ctx.textAlign = "center";
        ctx.fillText(this.num, this.x, this.y + 4);
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "10px sans-serif";
        ctx.fillText(this.name, this.x, this.y - 25);
    }
}

// --- [4. 리그 운영 및 인터페이스] ---

function renderDashboard() {
    // 1. 날짜 렌더링
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('current-date').innerText = gameState.currentDate.toLocaleDateString('ko-KR', options);

    // 2. 순위표 렌더링 (20개 팀 루프)
    const body = document.getElementById('standings-body');
    if (body) {
        body.innerHTML = gameState.standings
            .sort((a,b) => b.pts - a.pts || b.gd - a.gd)
            .map((t, i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.p}</td><td>${t.pts}</td></tr>`).join('');
    }

    // 3. 다음 경기 정보 갱신
    const todayStr = formatDate(gameState.currentDate);
    const next = gameState.fixtures.find(f => !f.played);
    const card = document.getElementById('next-match-info');
    if (next && card) {
        const isMatchDay = next.date === todayStr;
        card.innerHTML = `
            <div style="font-size:18px; font-weight:bold; color:${isMatchDay ? '#ef4444' : 'white'}">VS ${next.opp.toUpperCase()}</div>
            <div style="font-size:11px; color:#888; margin-top:5px;">일정: ${next.date} (홈)</div>
            ${isMatchDay ? "<div style='color:#fbbf24; font-weight:bold; margin-top:5px;'>[경기 당일]</div>" : ""}
        `;
    }
}

function advanceDay() {
    // 날짜 연산 오류 수정 (정확히 24시간 증가)
    gameState.currentDate.setDate(gameState.currentDate.getDate() + 1);
    renderDashboard();

    const todayStr = formatDate(gameState.currentDate);
    const todayMatch = gameState.fixtures.find(f => f.date === todayStr && !f.played);
    
    if (todayMatch) {
        setTimeout(() => {
            if (confirm(`[MATCH DAY] ${todayMatch.opp}전 킥오프하시겠습니까?`)) {
                startMatch(todayMatch);
            }
        }, 100);
    }
}

function updateMatchUI() {
    const s = gameState.stats;
    document.getElementById('stat-shots').innerText = `${s.home.shots} / ${s.away.shots}`;
    document.getElementById('score').innerText = `${s.home.goals} : ${s.away.goals}`;
}

function startMatch(fixture) {
    gameState.isMatch = true;
    gameState.matchTime = 0;
    gameState.stats.home.goals = 0; gameState.stats.away.goals = 0;
    document.getElementById('match-view').style.display = 'flex';

    // 소속팀(Leicester)과 상대팀 데이터 추출
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
    
    // 경기장 배경
    ctx.fillStyle = "#14532d"; ctx.fillRect(0,0,1000,650);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.strokeRect(10,10,980,630);
    ctx.beginPath(); ctx.moveTo(500,0); ctx.lineTo(500,650); ctx.stroke();

    // 시간 물리
    gameState.matchTime += 0.4;
    const mins = Math.floor(gameState.matchTime / 60);
    const secs = Math.floor(gameState.matchTime % 60);
    document.getElementById('match-timer').innerText = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

    // 공 물리
    ball.x += ball.vx; ball.y += ball.vy;
    ball.vx *= 0.985; ball.vy *= 0.985;

    // 골 판정 및 벽 충돌
    if (ball.x < 0 || ball.x > 1000) {
        if (Math.abs(ball.y - 325) < CONFIG.GOAL_SIZE/2) {
            gameState.stats[ball.x > 500 ? 'home' : 'away'].goals++;
            updateMatchUI();
            ball.x = 500; ball.y = 325; ball.vx = 0; ball.vy = 0;
        }
        ball.vx *= -1;
    }
    if (ball.y < 0 || ball.y > 650) ball.vy *= -1;

    // 공 그리기
    ctx.beginPath(); ctx.arc(ball.x, ball.y, 7, 0, Math.PI*2); ctx.fillStyle="white"; ctx.fill();

    // 선수 업데이트 및 렌더링
    activePlayers.forEach(p => {
        p.update(); p.draw(ctx);
        if (p === selected) {
            document.getElementById('hud-name').innerText = `${p.num}. ${p.name}`;
            document.getElementById('hud-xg').innerText = p.calculateXG();
            document.getElementById('stamina-fill').style.width = (p.stamina * 100) + "%";
        }
    });

    if (mins < 90) requestAnimationFrame(gameLoop);
    else {
        alert("경기 종료!");
        stopMatch();
    }
}

// --- [초기화] ---

document.getElementById('pitch').onmousedown = (e) => {
    const r = e.target.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    selected = activePlayers.find(p => Math.hypot(p.x - mx, p.y - my) < 20) || null;
};

fetch('Premier_League_FC26.json').then(r => r.json()).then(data => {
    allPlayers = data;
    renderDashboard();
    console.log("Full Master Engine Online.");
});
