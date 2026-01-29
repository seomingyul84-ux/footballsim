// 시뮬레이션 설정
const PITCH_WIDTH = 800;
const PITCH_HEIGHT = 500;

class Player {
    constructor(id, team, x, y, role) {
        this.id = id;
        this.team = team;
        this.x = x;
        this.y = y;
        this.baseX = x; // 전술적 기본 위치
        this.baseY = y;
        this.role = role;
        this.speed = 2.5;
        this.stamina = 100;
        this.color = team === 'Leicester' ? '#003087' : '#ffffff';
    }

    // AI 오프더볼 무브먼트 로직
    update(ball, teammates, opponents) {
        // 1. 공과의 거리 계산
        const distToBall = Math.hypot(ball.x - this.x, ball.y - this.y);

        // 2. 공격 시: 공간 찾아 들어가기 (Space Seeking)
        if (this.team === ball.possession) {
            this.offTheBallAttack(ball, opponents);
        } else {
            // 3. 수비 시: 마킹 및 라인 유지
            this.defend(ball);
        }
    }

    offTheBallAttack(ball, opponents) {
        // 상대 수비수들로부터 먼 좌표로 조금씩 이동 (간단한 벡터합)
        let pushX = 0, pushY = 0;
        opponents.forEach(opp => {
            const d = Math.hypot(this.x - opp.x, this.y - opp.y);
            if (d < 50) { // 너무 가까우면 피함
                pushX += (this.x - opp.x) / d;
                pushY += (this.y - opp.y) / d;
            }
        });
        this.x += pushX * 0.5;
        this.y += pushY * 0.5;

        // 제이미 바디 특성: 최전방 공격수면 골대 쪽으로 침투
        if (this.role === 'ST') this.x += 0.3; 
    }

    defend(ball) {
        // 기본 위치로 복귀하며 공 방향으로 압박
        const targetX = (this.baseX + ball.x) / 2;
        this.x += (targetX - this.x) * 0.02;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

class Match {
    constructor() {
        this.canvas = document.getElementById('pitch');
        this.ctx = this.canvas.getContext('2d');
        this.ball = { x: 400, y: 250, possession: 'Leicester' };
        this.players = [
            new Player(1, 'Leicester', 100, 250, 'GK'),
            new Player(2, 'Leicester', 700, 250, 'ST'), // 제이미 바디
            new Player(3, 'Opponent', 750, 250, 'GK'),
            new Player(4, 'Opponent', 450, 150, 'DF')
        ];
        this.timer = 0;
        this.isPaused = false;
        this.loop();
    }

    update() {
        if (this.isPaused) return;

        this.timer += 0.1; // 실제 시간보다 빠르게
        this.players.forEach(p => {
            const teammates = this.players.filter(other => other.team === p.team && other !== p);
            const opponents = this.players.filter(other => other.team !== p.team);
            p.update(this.ball, teammates, opponents);
        });

        // 공 위치 업데이트 (간단화: 점유 팀 선수 중 가장 가까운 자를 따라감)
        const owner = this.players.find(p => p.team === this.ball.possession && p.role === 'ST');
        if (owner) {
            this.ball.x = owner.x + 10;
            this.ball.y = owner.y;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, PITCH_WIDTH, PITCH_HEIGHT);
        // 경기장 선 그리기 (간단화)
        this.ctx.strokeStyle = "rgba(255,255,255,0.5)";
        this.ctx.strokeRect(0,0,800,500);
        
        this.players.forEach(p => p.draw(this.ctx));
        
        // 공 그리기
        this.ctx.fillStyle = "orange";
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, 5, 0, Math.PI * 2);
        this.ctx.fill();

        document.getElementById('scoreboard').innerText = 
            `Time: ${Math.floor(this.timer)}:00 | Leicester Ball`;
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

const game = new Match();
function togglePause() { game.isPaused = !game.isPaused; }
