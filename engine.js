// ... (클래스 정의 및 변수는 유지) ...

class SuperRealPlayer {
    constructor(data, team) {
        this.data = data;
        this.team = team;
        this.x = team === 'home' ? 300 : 700;
        this.y = Math.random() * 680;
        this.vx = 0; this.vy = 0;
        this.stamina = 1.0;
        this.mass = data.weight_kg;
        this.radius = (data.height_cm / 180) * 12;
    }

    // [감독님 요청] 복리 감소 xG 로직 (UI 출력용)
    calculateXG() {
        let xg = (this.data.shooting || 50) / 100;
        const dist = Math.hypot(1050 - this.x, 340 - this.y);
        const distUnits = Math.floor(dist / 10.5); 
        for(let i=0; i < distUnits; i++) xg *= 0.96;

        const angleRad = Math.atan2(Math.abs(340 - this.y), 1050 - this.x);
        const angleDeg = Math.floor(angleRad * 180 / Math.PI);
        for(let i=0; i < angleDeg; i++) xg *= 0.98;

        return Math.max(0.001, xg).toFixed(3);
    }

    update() {
        // 물리 업데이트 (이전 로직과 동일)
        // ... (vx, vy 계산) ...
        this.x += this.vx;
        this.y += this.vy;
    }
}

// [UI 핸들러] 선수 클릭 시 우측 UI에 실시간 데이터 바인딩
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    selectedPlayer = players.find(p => Math.hypot(p.x - mx, p.y - my) < 20);
    
    if (selectedPlayer) {
        document.getElementById('sel-name').innerText = selectedPlayer.data.short_name;
        document.getElementById('sel-phys').innerText = `${selectedPlayer.data.height_cm}cm / ${selectedPlayer.mass}kg`;
    }
});

function gameLoop() {
    if (!isMatchDay) return;
    
    ctx.clearRect(0, 0, 1050, 680);
    // 잔디 그리기
    ctx.fillStyle = "#14532d"; ctx.fillRect(0,0,1050,680);
    
    players.forEach(p => {
        p.update();
        p.draw(ctx);
        
        // 실시간 UI 업데이트 (선택된 선수)
        if (p === selectedPlayer) {
            document.getElementById('sel-xg').innerText = p.calculateXG();
            document.getElementById('sel-stam').innerText = (p.stamina * 100).toFixed(1) + "%";
            document.getElementById('sel-mom').innerText = (Math.abs(p.vx) + Math.abs(p.vy)).toFixed(2);
        }
    });

    requestAnimationFrame(gameLoop);
}

// 경기 종료 후 오피스로 복귀
function endMatch() {
    isMatchDay = false;
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('office-screen').style.display = 'flex';
    // 결과 반영 로직...
}
