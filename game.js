let scene, camera, renderer;
let player = { x: 0, y: 1.6, z: 4 };
let playerMesh;
let yaw = 0;
let keys = {};

const MAX_LEVELS = 5;
const ENEMY_SPEED = 0.02;
let currentLevel = 1;
let puzzles = [];
let walls = [];
let enemies = [];
let currentDoor = null;

let solved = false;
let quizActive = false;
let activePuzzle = null;
let activeEnemy = null;

let startTime = Date.now();
let score = 0;

const levelText  = document.getElementById("levelText");
const puzzleText = document.getElementById("puzzleText");
const timerText  = document.getElementById("timerText");
const scoreText  = document.getElementById("scoreText");

const quizUI       = document.getElementById("quizUI");
const quizQuestion = document.getElementById("quizQuestion");
const quizAnswer   = document.getElementById("quizAnswer");
const submitAnswer = document.getElementById("submitAnswer");

const popup = document.getElementById("popup");
const startScreen = document.getElementById("startScreen");

function getMainQuiz(level) {
    const quizzes = [
        ["3 + 2 = ?", "5"],
        ["6 × 2 = ?", "12"],
        ["15 − 7 = ?", "8"],
        ["9 × 3 = ?", "27"],
        ["36 ÷ 3 = ?", "12"]
    ];
    return quizzes[level - 1];
}

function getEnemyQuiz() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    return { q: `${a} + ${b} = ?`, a: String(a + b) };
}

startScreen.onclick = () => {
    startScreen.style.display = "none";
    init();
    animate();
    document.body.requestPointerLock?.();
};

document.addEventListener("mousemove", e => {
    if (document.pointerLockElement === document.body) yaw -= e.movementX * 0.002;
});

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.2);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    playerMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 1.0, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x2f4f4f })
    );
    scene.add(playerMesh);

    buildLevel();

    window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
    window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);
}

function buildLevel() {
    [...puzzles, ...walls, ...enemies].forEach(o => scene.remove(o));
    puzzles = []; walls = []; enemies = [];
    solved = false; currentDoor = null;

    const z = -(currentLevel - 1) * 20;

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 16),
        new THREE.MeshStandardMaterial({ color: 0xe6d3a3 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = z;
    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c });

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(16, 4, 0.6), wallMat);
    backWall.position.set(0, 2, z - 8);
    scene.add(backWall); walls.push(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 16), wallMat);
    leftWall.position.set(-8, 2, z);
    scene.add(leftWall); walls.push(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 16), wallMat);
    rightWall.position.set(8, 2, z);
    scene.add(rightWall); walls.push(rightWall);

    currentDoor = new THREE.Mesh(
        new THREE.BoxGeometry(3, 4, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xb8860b })
    );
    currentDoor.position.set(0, 2, z - 7);
    scene.add(currentDoor); walls.push(currentDoor);

    const puzzle = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0xffaa00 })
    );
    puzzle.position.set(0, 1, z - 3);
    puzzle.userData.quiz = getMainQuiz(currentLevel);
    puzzles.push(puzzle);
    scene.add(puzzle);

    for (let i = 0; i < 2; i++) {
        const enemy = new THREE.Mesh(
            new THREE.ConeGeometry(0.6, 1.5, 8),
            new THREE.MeshStandardMaterial({ color: 0x8b0000 })
        );
        enemy.position.set(-4 + i * 8, 0.75, z - 4);
        enemy.userData.quiz = getEnemyQuiz();
        enemy.userData.baseX = enemy.position.x;
        enemy.userData.direction = 1;
        enemies.push(enemy);
        scene.add(enemy);
    }

    player.x = 0; player.z = z + 6;
}

function animate() {
    requestAnimationFrame(animate);
    updateMovement();
    updateEnemies();
    checkPuzzle();
    checkEnemies();
    checkDoor();
    updateHUD();
    renderer.render(scene, camera);
}

function updateMovement() {
    const speed = 0.12;
    let nx = player.x;
    let nz = player.z;

    if (keys.w) nz -= speed;
    if (keys.s) nz += speed;
    if (keys.a) nx -= speed;
    if (keys.d) nx += speed;

    if (!checkCollision(nx, nz)) {
        player.x = nx; player.z = nz;
    }

    playerMesh.position.set(player.x, 0.9, player.z);

    const camDist = 3.5;
    camera.position.set(
        player.x + Math.sin(yaw) * camDist,
        2.5,
        player.z + Math.cos(yaw) * camDist
    );
    camera.lookAt(player.x, 1.2, player.z);
}

function updateEnemies() {
    enemies.forEach(e => {
        e.position.x += ENEMY_SPEED * e.userData.direction;
        if (Math.abs(e.position.x - e.userData.baseX) > 2) e.userData.direction *= -1;
    });
}

function checkCollision(x, z) {
    return walls.some(w => Math.abs(x - w.position.x) < 1.2 && Math.abs(z - w.position.z) < 1.2);
}

function checkPuzzle() {
    if (quizActive || solved) return;
    const p = puzzles[0];
    if (Math.hypot(player.x - p.position.x, player.z - p.position.z) < 1.3) {
        quizActive = true;
        activePuzzle = p;
        quizQuestion.textContent = p.userData.quiz[0];
        quizAnswer.value = "";
        quizUI.classList.remove("hidden");
    }
}

function checkEnemies() {
    if (quizActive) return;
    enemies.forEach(e => {
        if (Math.hypot(player.x - e.position.x, player.z - e.position.z) < 1.4) {
            quizActive = true;
            activeEnemy = e;
            quizQuestion.textContent = e.userData.quiz.q;
            quizAnswer.value = "";
            quizUI.classList.remove("hidden");
        }
    });
}

submitAnswer.onclick = () => {
    if (activeEnemy) {
        if (quizAnswer.value === activeEnemy.userData.quiz.a) {
            scene.remove(activeEnemy);
            enemies = enemies.filter(e => e !== activeEnemy);
            score += 50;
        }
        closeQuiz();
        return;
    }

    if (activePuzzle && quizAnswer.value === activePuzzle.userData.quiz[1]) {
        scene.remove(activePuzzle);
        puzzles = [];
        solved = true;
        score += 100 * currentLevel;
        showPopup();
    }
    closeQuiz();
};

function closeQuiz() {
    quizUI.classList.add("hidden");
    quizActive = false;
    activePuzzle = null;
    activeEnemy = null;
}

function checkDoor() {
    if (!solved || !currentDoor) return;
    if (Math.hypot(player.x - currentDoor.position.x, player.z - currentDoor.position.z) < 1.4) {
        currentDoor.position.y -= 0.05;
        if (currentDoor.position.y < -3) {
            walls = walls.filter(w => w !== currentDoor);
            nextLevel();
        }
    }
}

function nextLevel() {
    if (currentLevel < MAX_LEVELS) {
        currentLevel++;
        buildLevel();
    } else {
        alert("You have completed the Temple of Archimedes!");
    }
}

function updateHUD() {
    levelText.textContent  = `Level: ${currentLevel} / 5`;
    puzzleText.textContent = `Main Puzzle: ${solved ? "Solved" : "Pending"}`;
    timerText.textContent  = `Time: ${Math.floor((Date.now() - startTime) / 1000)}s`;
    scoreText.textContent  = `Score: ${score}`;
}

function showPopup() {
    popup.classList.remove("hidden");
    setTimeout(() => popup.classList.add("hidden"), 1000);
}
