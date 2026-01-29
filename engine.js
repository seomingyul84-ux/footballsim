const canvas = document.getElementById('pitch');
const ctx = canvas.getContext('2d');

const PITCH = { W: 1050, H: 680, GOAL_Y: 340 };
let isPaused = false;
let selectedPlayer = null;

class Player {
    constructor(id, name, team, x, y, role) {
        this.id = id;
        this.name = name;
        this.team = team;
        this.x = x;
        this.y = y;
        this.anchorX = x; // 활동 중심점
        this.anchorY = y;
        this.role = role;
        
        // 감독 지시값 (기본값)
        this.radius = 150;
        this.xgThreshold = 0.3;
        this.tackleAggression = 50;
        this.passCrossRatio = 50;
    }

    // 복리 감소 xG 계산기 (감독님 공식)
    calculateXG(ball, goalkeeper, defenders) {
        let xg = 1.0;

        // 1. 거리 기반: 1.05m(100/1)마다 4% 복리 감소
        const dist = Math.hypot(PITCH.W - ball.x, PITCH.GOAL_Y - ball.y);
        const distUnits = Math.floor(dist / 10.5); 
        for(let i=0; i < distUnits; i++) xg *= 0.96;

        // 2. 각도 기반: 정중앙 기준 1도마다 2% 복리 감소
        const angleRad = Math.atan2(Math.abs(PITCH.GOAL_Y - ball.y), PITCH.W - ball.x);
        const angleDeg = Math.floor(angleRad * 180 / Math.PI);
        for(let i=0; i < angleDeg; i++) xg *= 0.98;

        // 3. 키퍼 시선: 키퍼와 보는 방향이 같아질수록(각도차 0일수록) 1% 복리 감소
        const angleToKeeper = Math.abs(angleDeg - 0); // 단순화: 키퍼는 항상 정면
        const keeperPenaltyUnits = Math.floor((180 - angleToKeeper) / 10);
        for(let i=0; i < keeperPenaltyUnits; i++) xg *= 0.99;

        // 4. 수비수 블로킹: 궤적 방해 시 50% 단판 감소
        const isBlocked = defenders.some(d => Math.hypot(d.x - ball.x, d.y - ball.y) < 30);
        if (isBlocked) xg *= 0.5;

        return Math.max(0.01, xg).toFixed(3);
    }

    update() {
        if (isPaused) return;
        // 오프더볼: 활동 범위(Radius) 내에서만 움직임 제한
        const d = Math.hypot(this.x - this.anchorX, this.y - this.anchorY);
        if (d > this.radius) {
            this.x -= (this.x - this.anchorX) * 0.05;
            this.y -= (this.y - this.anchorY) * 0.05;
        }
        // 미세 움직임 AI
        this.x += (Math.random() - 0.5) * 2;
        this.y += (Math.random() - 0.5) * 2;
    }

    draw() {
        // 활동 범위 원 그리기
        if (selectedPlayer === this) {
            ctx.beginPath();
            ctx.arc(this.anchorX, this.anchorY, this.radius, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,255,255,0.2)";
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.fillStyle = this.team === 'Leicester' ? '#003087' : '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(this.name, this.x - 10, this.y - 15);
    }
}

// 초기화 (레스터 시티 주요 선수)
const players = [
    new Player(1, "Vardy", "Leicester", 800, 340, "ST"),
    new Player(2, "Winks", "Leicester", 500, 340, "CM"),
    new Player(3, "Fatawu", "Leicester", 700, 100, "RW"),
    new Player(4, "Opponent GK", "Away", 1030, 340, "GK")
];

const ball = { x: 780, y: 340 };

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 경기장 중앙선 등 배경
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.strokeRect(0, 0, PITCH.W, PITCH.H);
    ctx.strokeRect(PITCH.W/2, 0, 1, PITCH.H);

    players.forEach(p => {
        p.update();
        p.draw();
    });

    // 실시간 xG 대시보드 업데이트
    if (selectedPlayer && selectedPlayer.team === 'Leicester') {
        const currentXG = selectedPlayer.calculateXG(ball, players[3], players.slice(3,4));
        document.getElementById('live-dashboard').innerHTML = `
            선수: ${selectedPlayer.name}<br>
            현재 위치 xG: ${currentXG}<br>
            슈팅 문턱값: ${selectedPlayer.xgThreshold}<br>
            상태: ${currentXG >= selectedPlayer.xgThreshold ? "🔥 슈팅 대기" : "🔄 패스 탐색"}
        `;
    }

    // 공 그리기
    ctx.fillStyle = "orange";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2);
    ctx.fill();

    requestAnimationFrame(gameLoop);
}

// 이벤트 리스너
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    selectedPlayer = players.find(p => Math.hypot(p.x - mx, p.y - my) < 20);
    if (selectedPlayer) {
        document.getElementById('tactics-ui').style.display = 'block';
        document.getElementById('player-name').innerText = selectedPlayer.name;
        document.getElementById('radius-slider').value = selectedPlayer.radius;
        document.getElementById('xg-slider').value = selectedPlayer.xgThreshold * 100;
    }
});

document.getElementById('radius-slider').oninput = function() {
    if(selectedPlayer) {
        selectedPlayer.radius = parseInt(this.value);
        document.getElementById('rad-val').innerText = this.value;
    }
};

document.getElementById('xg-slider').oninput = function() {
    if(selectedPlayer) {
        selectedPlayer.xgThreshold = this.value / 100;
        document.getElementById('xg-threshold-val').innerText = selectedPlayer.xgThreshold;
    }
};

window.onkeydown = (e) => { if(e.code === "Space") isPaused = !isPaused; };

gameLoop();
