/**
 * FC26 Hyper-Realistic Tactical Engine
 * 모든 로직에 선수의 110개 스탯과 감독님의 복리 공식 적용
 */

const PITCH = { W: 1050, H: 680, GOAL_Y: 340 };
const canvas = document.getElementById('pitch');
const ctx = canvas.getContext('2d');

let players = [];
let ball = { x: 525, y: 340, vx: 0, vy: 0, friction: 0.98 };

class SuperRealPlayer {
    constructor(data, team) {
        this.data = data; // 110개 전체 스탯
        this.team = team;
        
        // 1. 물리적 초기값 (질량 및 크기)
        this.mass = data.weight_kg || 75;
        this.height = data.height_cm || 180;
        this.radius = (this.height / 180) * 12;
        
        // 2. 가변 상태 (실시간 변동)
        this.x = Math.random() * PITCH.W;
        this.y = Math.random() * PITCH.H;
        this.vx = 0; this.vy = 0;
        this.stamina = 1.0; // 100%에서 시작
    }

    // [슈팅 로직] 감독님 공식 + 슈팅 스탯 최우선 적용
    calculateXG(defenders) {
        // 최우선: 슈팅 스탯 퍼센트로 기본값 설정
        let xg = (this.data.shooting || 50) / 100;

        // 1. 거리 기반: 10.5px당 4% 복리 감소
        const dist = Math.hypot(PITCH.W - this.x, PITCH.GOAL_Y - this.y);
        const distUnits = Math.floor(dist / 10.5); 
        for(let i=0; i < distUnits; i++) xg *= 0.96;

        // 2. 각도 기반: 정중앙 기준 1도마다 2% 복리 감소
        const angleRad = Math.atan2(Math.abs(PITCH.GOAL_Y - this.y), PITCH.W - this.x);
        const angleDeg = Math.floor(angleRad * 180 / Math.PI);
        for(let i=0; i < angleDeg; i++) xg *= 0.98;

        // 3. 키퍼/시야 방해: 각도차 기반 1% 복리 감소
        const keeperPenaltyUnits = Math.floor((180 - angleDeg) / 10);
        for(let i=0; i < keeperPenaltyUnits; i++) xg *= 0.99;

        // 4. 수비수 블로킹 (50% 감소)
        const isBlocked = defenders.some(d => Math.hypot(d.x - this.x, d.y - this.y) < 30);
        if (isBlocked) xg *= 0.5;

        // 추가 리얼리티: 체력(Stamina) 및 주발 반영
        xg *= this.stamina; 
        if(this.data.preferred_foot === "Left" && this.y > PITCH.GOAL_Y) xg *= 0.8;

        return Math.max(0.001, xg).toFixed(3);
    }

    // [패스 로직] Passing/Vision 스탯 기반 복리 오차 적용
    getPassAccuracy(targetDist) {
        let accuracy = (this.data.passing || 50) / 100;
        
        // 거리가 멀어질수록 정확도 10.5px당 2% 복리 감소
        const distUnits = Math.floor(targetDist / 10.5);
        for(let i=0; i < distUnits; i++) accuracy *= 0.98;

        // 시야(Vision) 스탯이 낮으면 오차 범위 증가
        const errorRange = (100 - this.data.mentality_vision) * (1 - accuracy);
        return errorRange;
    }

    // [물리 업데이트] 관성, 민첩성, 체력 반영
    update() {
        // 가속도: (가속 스탯 / 질량) * 체력
        const accelPower = (this.data.movement_acceleration / 100) * this.stamina;
        const force = accelPower * 0.5;
        
        // 공을 향한 이동 (단순 예시)
        const dx = ball.x - this.x;
        const dy = ball.y - this.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 5) {
            this.vx += (dx / dist) * force / (this.mass / 70);
            this.vy += (dy / dist) * force / (this.mass / 70);
        }

        // 마찰력: Agility(민첩성)가 높을수록 관성을 빨리 제어 (0.8 ~ 0.98)
        const agilityFactor = 0.85 + (this.data.movement_agility / 1000);
        this.vx *= agilityFactor;
        this.vy *= agilityFactor;

        this.x += this.vx;
        this.y += this.vy;

        // 스태미나 소모 (활동량에 비례)
        this.stamina -= (Math.abs(this.vx) + Math.abs(this.vy)) * 0.0001;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.team === 'home' ? '#1e40af' : '#b91c1c';
        ctx.fill();
        
        // 선수 이름과 xG 실시간 출력
        ctx.fillStyle = "white";
        ctx.font = "10px Arial";
        ctx.fillText(`${this.data.short_name} (xG: ${this.calculateXG([])})`, this.x - 20, this.y - 20);
    }
}

// 깃허브 JSON 데이터 로드 및 초기화
async function initGame() {
    const response = await fetch('./Premier_League_FC26.json');
    const allPlayers = await response.json();
    
    // 예시: 레스터 시티 선수들만 추출하여 경기장 배치
    const leicester = allPlayers.filter(p => p.club_name === "Leicester City");
    leicester.slice(0, 11).forEach(p => players.push(new SuperRealPlayer(p, 'home')));
    
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    ctx.clearRect(0, 0, PITCH.W, PITCH.H);
    // 잔디 배경색
    ctx.fillStyle = "#14532d"; ctx.fillRect(0, 0, PITCH.W, PITCH.H);
    
    players.forEach(p => {
        p.update();
        p.draw();
    });
    
    // 공 그리기
    ctx.fillStyle = "white";
    ctx.beginPath(); ctx.arc(ball.x, ball.y, 6, 0, Math.PI*2); ctx.fill();
    
    requestAnimationFrame(gameLoop);
}

initGame();
