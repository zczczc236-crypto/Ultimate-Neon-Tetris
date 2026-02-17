const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');

context.scale(20, 20);
nextContext.scale(20, 20);

// 사운드 시스템
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSfx(f, t, d, v=0.1) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = t; o.frequency.value = f;
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + d);
}

// 블록 색상 & 모양
const colors = [null, '#00f3ff', '#ff00ff', '#ffff00', '#00ff00', '#ff0000', '#ff8800', '#7700ff'];
function createPiece(t) {
    if (t === 'I') return [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]];
    if (t === 'L') return [[0,2,0],[0,2,0],[0,2,2]];
    if (t === 'J') return [[0,3,0],[0,3,0],[3,3,0]];
    if (t === 'O') return [[4,4],[4,4]];
    if (t === 'Z') return [[5,5,0],[0,5,5],[0,0,0]];
    if (t === 'S') return [[0,6,6],[6,6,0],[0,0,0]];
    if (t === 'T') return [[0,7,0],[7,7,7],[0,0,0]];
}

// 게임 상태
const arena = Array.from({length: 20}, () => Array(12).fill(0));
const player = { pos: {x: 0, y: 0}, matrix: null, next: null, score: 0, level: 1, lines: 0 };

function playerReset() {
    const pieces = 'ILJOTSZ';
    if (!player.next) player.next = createPiece(pieces[Math.random() * 7 | 0]);
    player.matrix = player.next;
    player.next = createPiece(pieces[Math.random() * 7 | 0]);
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    
    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        player.score = 0; player.level = 1; player.lines = 0;
        dropInterval = 1000;
        playSfx(100, 'sawtooth', 0.8);
    }
    drawNext();
}

function drawNext() {
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, 100, 100);
    drawMatrix(player.next, {x: 1, y: 1}, nextContext);
}

// 핵심 기능: 고스트 블록 (떨어질 위치 표시)
function getGhostPos() {
    let ghostY = player.pos.y;
    while (!collide(arena, {pos: {x: player.pos.x, y: ghostY + 1}, matrix: player.matrix})) {
        ghostY++;
    }
    return ghostY;
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // 고스트 그리기
    const ghostY = getGhostPos();
    context.globalAlpha = 0.2;
    drawMatrix(player.matrix, {x: player.pos.x, y: ghostY}, context);
    context.globalAlpha = 1.0;

    drawMatrix(arena, {x: 0, y: 0}, context);
    drawMatrix(player.matrix, player.pos, context);
}

function drawMatrix(matrix, offset, ctx = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.fillStyle = colors[value];
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

// 충돌 및 이동
function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) return true;
        }
    }
    return false;
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
        });
    });
}

function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        player.score += rowCount * 10;
        player.lines++;
        rowCount *= 2;
        if (player.lines % 10 === 0) {
            player.level++;
            dropInterval *= 0.8;
        }
        playSfx(800, 'sine', 0.2);
        if (navigator.vibrate) navigator.vibrate(50); // 모바일 진동
    }
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) matrix.forEach(row => row.reverse());
    else matrix.reverse();
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
    playSfx(400, 'triangle', 0.05);
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
        playSfx(200, 'square', 0.1);
    }
    dropCounter = 0;
}

function hardDrop() {
    player.pos.y = getGhostPos();
    playerDrop();
}

function updateScore() {
    document.getElementById('score').innerText = player.score;
    document.getElementById('level').innerText = player.level;
}

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) playerDrop();
    draw();
    requestAnimationFrame(update);
}

// 컨트롤 핸들러
const handleInput = (key) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (key === 'left') { player.pos.x--; if(collide(arena, player)) player.pos.x++; }
    if (key === 'right') { player.pos.x++; if(collide(arena, player)) player.pos.x--; }
    if (key === 'down') playerDrop();
    if (key === 'up') playerRotate(1);
    if (key === 'space') hardDrop();
};

document.addEventListener('keydown', e => {
    const keys = {37:'left', 39:'right', 40:'down', 38:'up', 32:'space'};
    if (keys[e.keyCode]) handleInput(keys[e.keyCode]);
});

// --- 기존 컨트롤 코드를 지우고 이 부분을 넣으세요 ---

const handleInput = (key) => {
    // 게임이 시작되지 않았을 때는 작동 안 함
    if (!player.matrix) return;
    
    // 오디오 컨텍스트 재개 (브라우저 보안 정책 대응)
    if (audioCtx.state === 'suspended') audioCtx.resume();

    if (key === 'left') { 
        player.pos.x--; 
        if(collide(arena, player)) player.pos.x++; 
    }
    else if (key === 'right') { 
        player.pos.x++; 
        if(collide(arena, player)) player.pos.x--; 
    }
    else if (key === 'down') {
        playerDrop();
    }
    else if (key === 'up') {
        playerRotate(1);
    }
    else if (key === 'space') {
        hardDrop();
    }
    draw(); // 입력 즉시 화면 갱신
};

// 키보드 조작
document.addEventListener('keydown', e => {
    const keys = {37:'left', 39:'right', 40:'down', 38:'up', 32:'space'};
    if (keys[e.keyCode]) {
        e.preventDefault(); // 방향키로 인한 화면 스크롤 방지
        handleInput(keys[e.keyCode]);
    }
});

/**
 * 모바일 전용: 터치 지연 없이 즉시 반응하도록 pointerdown 사용
 */
const mobileButtons = {
    'btn-left': 'left',
    'btn-right': 'right',
    'btn-down': 'down',
    'btn-rotate': 'up',
    'btn-drop': 'space'
};

Object.keys(mobileButtons).forEach(id => {
    const btn = document.getElementById(id);
    
    // pointerdown은 마우스 클릭과 터치 모두에 즉각 반응합니다.
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); // 롱클릭 시 메뉴 뜨는 것 방지 및 확대 방지
        handleInput(mobileButtons[id]);
        
        // 버튼 누를 때 진동 효과 (지원되는 모바일 기기만)
        if (navigator.vibrate) navigator.vibrate(10);
    });
});

// 시작 버튼
document.getElementById('start-btn').addEventListener('pointerdown', (e) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playerReset();
    updateScore();
    update();
    e.target.innerText = "RESTART";
});
