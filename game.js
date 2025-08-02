const grid = document.getElementById("grid");
const timerEl = document.getElementById("timer");
const scoreEl = document.getElementById("score");
const gameOverEl = document.getElementById("game-over");
const retryBtn = document.getElementById("retry");
const videoElement = document.getElementById("video");

const tileSequence = [];
const colors = ["red", "green", "blue"];
let currentIndex = 0;
let score = 0;
let timer = 25;
let timerInterval;

// === TILE SETUP ===
for (let i = 0; i < 25; i++) {
  const tile = document.createElement("div");
  const color = colors[Math.floor(Math.random() * colors.length)];
  tile.classList.add("tile", color);
  grid.appendChild(tile);
  tileSequence.push({ color, element: tile });
}
tileSequence[0].element.classList.add("highlight");

// === FRAME BUFFER FOR SMOOTH DETECTION ===
let lastStates = [];

const BUFFER_SIZE = 5; // Increased from 3 → 5
let readyForNext = true;

// === HEURISTIC: IS HAND OPEN ===
function isHandOpen(landmarks) {
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  let openFingers = 0;

  for (let i = 0; i < tips.length; i++) {
    if (landmarks[tips[i]].y < landmarks[pips[i]].y) openFingers++;
  }

  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const wrist = landmarks[0];
  const isThumbOpen =
    Math.abs(thumbTip.x - wrist.x) > Math.abs(thumbIP.x - wrist.x);

  return openFingers >= 3 && isThumbOpen;
}

// === VALIDATE GESTURE AGAINST TILE ===
function validateGesture(gesture) {
  const currentTile = tileSequence[currentIndex];
  if (!currentTile || gesture === null || !readyForNext) return;

  const expectedColor = currentTile.color;
  const gestureMap = {
    right: "red",
    left: "green",
    both: "blue",
  };

  if (gestureMap[gesture] === expectedColor) {
    currentTile.element.classList.remove("highlight");
    score++;
    scoreEl.textContent = `Score: ${score}`;
    currentIndex++;
    readyForNext = false;

    if (currentIndex >= tileSequence.length) {
      endGame(true);
    } else {
      tileSequence[currentIndex].element.classList.add("highlight");
    }
  } else {
    endGame(false);
  }
}

function endGame(won) {
  clearInterval(timerInterval);
  gameOverEl.textContent = won
    ? "🎉 You Win!"
    : `❌ Game Over! Final Score: ${score}`;
  retryBtn.style.display = "inline-block";
  gameOver = true;
}

// === TIMER ===
function startTimer() {
  timerInterval = setInterval(() => {
    timer--;
    timerEl.textContent = `⏱️ ${timer}`;
    if (timer <= 0) endGame(false);
  }, 1000);
}

// === HAND DETECTION SETUP ===

let gameOver = false;

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  selfieMode: true,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

hands.onResults((results) => {
  if (gameOver) return;

  let openHandLabels = [];

  results.multiHandLandmarks.forEach((landmarks, index) => {
    if (isHandOpen(landmarks)) {
      const label = results.multiHandedness[index].label;
      openHandLabels.push(label);
    }
  });

  // Frame buffering
  lastStates.push(openHandLabels);
  if (lastStates.length > BUFFER_SIZE) lastStates.shift();

  const consistentBoth = lastStates.every(
    (state) => state.includes("Left") && state.includes("Right")
  );

  let gesture = null;
  if (consistentBoth) {
    gesture = "both";
  } else if (
    openHandLabels.includes("Left") &&
    !openHandLabels.includes("Right")
  ) {
    gesture = "left";
  } else if (
    openHandLabels.includes("Right") &&
    !openHandLabels.includes("Left")
  ) {
    gesture = "right";
  }

  if (gesture) {
    validateGesture(gesture);
  } else {
    // No gesture detected → allow next
    readyForNext = true;
  }
});

// === START CAMERA ===
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480,
});
camera.start();

// === START TIMER ===
startTimer();

// === RETRY ===
retryBtn.addEventListener("click", () => {
  window.location.href = "game.html"; // Reload cleanly
});
