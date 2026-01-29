// engine.js
class MatchEngine {
    constructor(teamA, teamB) {
        this.teamA = teamA;
        this.teamB = teamB;
        this.ballOwner = teamA; // 시작 시 점유 팀
        this.score = { A: 0, B: 0 };
        this.minute = 0;
        this.isGameOver = false;
    }

    // 경기 흐름 한 스텝 (1분 또는 특정 틱)
    update() {
        if (this.minute >= 90) {
            this.isGameOver = true;
            return "경기 종료!";
        }

        this.minute++;
        return this.simulatePlay();
    }

    simulatePlay() {
        const attackingTeam = this.ballOwner;
        const defendingTeam = attackingTeam === this.teamA ? this.teamB : this.teamA;

        // 1. 패스 시도 (공격수 vs 수비수 능력치 대결)
        const passSuccess = Math.random() * attackingTeam.midfield > Math.random() * defendingTeam.defense;

        if (passSuccess) {
            // 2. 슈팅 기회 창출
            if (Math.random() > 0.7) { 
                return this.attemptShot(attackingTeam, defendingTeam);
            }
            return `${attackingTeam.name}이(가) 점유율을 유지하며 압박합니다.`;
        } else {
            // 3. 턴오버 (점유권 변경)
            this.ballOwner = defendingTeam;
            return `${defendingTeam.name}이(가) 공을 탈취했습니다!`;
        }
    }

    attemptShot(att, def) {
        if (Math.random() * att.offense > Math.random() * def.goalkeeper) {
            this.score[att === this.teamA ? 'A' : 'B']++;
            return `⚽ GOAL! ${att.name}의 멋진 득점! (현재 스코어 ${this.score.A}:${this.score.B})`;
        }
        return `아차! ${att.name}의 슈팅이 골키퍼 정면으로 향합니다.`;
    }
}
