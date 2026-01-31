// --- [전역 상태] ---
let ball = { x: 525, y: 340, vx: 0, vy: 0, radius: 7 }; // 공 추가
let activePlayers = [];
let selectedPlayer = null;

// --- [Logic A: 선수 클래스 보정] ---
class SuperRealPlayer {
    constructor(data, teamSide) {
        this.data = data;
        this.team = teamSide;
        this.name = data.short_name;
        this.number = data.club_jersey_number || "??";
        
        // 초기 배치: 아군은 왼쪽(200~400), 적군은 오른쪽(600~800)
        this.x = teamSide === 'home' ? 100 + Math.random()*300 : 650 + Math.random()*300;
        this.y = 50 + Math.random()*580;
        
        this.vx = 0; this.vy = 0;
        this.stamina = 1.0;
        this.mass = data.weight_kg || 75;
    }

    update() {
        // 공을 향해 이동 (뭉침 방지 로직 포함)
        const dx = ball.x - this.x;
        const dy = ball.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 15) { // 공과 일정 거리 유지 (너무 뭉치지 않게)
            const accel = (this.data.movement_acceleration / 100) * this.stamina * 0.3;
            this.vx += (dx / dist) * accel;
            this.vy += (dy / dist) * accel;
        }

        this.vx *= 0.9; this.vy *= 0.9; // 마찰력
        this.x += this.vx; this.y += this.vy;
    }

    draw(ctx) {
        // 1. 선수 몸체 (유니폼 색상)
        ctx.beginPath();
        ctx.arc(this.x, this.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = this.team === 'home' ? '#0053a0' : '#8b0000'; // 레스터 블루 vs 원정 레드
        ctx.fill();
        ctx.strokeStyle = (selectedPlayer === this) ? '#fbbf24' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 2. 등번호 표시
        ctx.fillStyle = "white";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.number, this.x, this.y + 4);

        // 3. 이름 표시 (머리 위)
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "11px sans-serif";
        ctx.fillText(this.name, this.x, this.y - 18);
    }
}

// --- [Logic B: 경기 루프 및 공 렌더링] ---
function gameLoop() {
    if (!gameState.isMatchRunning) return;
    const canvas = document.getElementById('pitch');
    const ctx = canvas.getContext('2d');

    // 경기장 배경
    ctx.fillStyle = "#14532d"; 
    ctx.fillRect(0, 0, 1050, 680);
    
    // 센터라인 및 골대 가이드 (FM 느낌)
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.strokeRect(0, 0, 1050, 680);
    ctx.beginPath(); ctx.moveTo(525, 0); ctx.lineTo(525, 680); ctx.stroke();

    // 공 그리기
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.shadowBlur = 10; ctx.shadowColor = "white"; // 공에 광택 효과

    // 선수 업데이트 및 그리기
    activePlayers.forEach(p => {
        p.update();
        p.draw(ctx);
        
        // 선택된 선수 UI 업데이트
        if (p === selectedPlayer) {
            document.getElementById('sel-player-name').innerText = `${p.number}. ${p.name}`;
            document.getElementById('sel-xg').innerText = p.calculateXG ? p.calculateXG() : "0.000";
        }
    });

    requestAnimationFrame(gameLoop);
}
