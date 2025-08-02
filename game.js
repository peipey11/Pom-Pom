const grid = document.getElementById("grid");
const timerEl = document.getElementById("timer");
const scoreEl = document.getElementById("score");
const gameOverEl = document.getElementById("game-over");
const retryBtn = document.getElementById("retry");
const videoElement = document.getElementById("video");

const tileSequence = [];
const colors = ["red", "green"];
let currentRow = 0;
let currentTileIndex = 0;
let score = 0;
let timer = 25;
let timerInterval;
let gameOver = false;

function createRow() {
  const newRow = [];
  for (let i = 0; i < 5; i++) {
    const tile = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    tile.classList.add("tile", color);
    grid.appendChild(tile);
    newRow.push({ color, element: tile });
  }
  return newRow;
}

function highlightCurrentTile() {
  tileSequence[currentRow][currentTileIndex].element.classList.add("highlight");
}

for (let r = 0; r < 5; r++) {
  tileSequence.push(createRow());
}
highlightCurrentTile();

let lastStates = [];
const BUFFER_SIZE = 5;

let readyForNext = true;
let gestureCooldown = false;
let handsPreviouslyOpen = false;
let lastGesture = null;

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

function validateGesture(gesture) {
  if (!readyForNext || gameOver) return;

  const tile = tileSequence[currentRow][currentTileIndex];
  const expected = tile.color;
  const gestureMap = { right: "red", left: "green" };
  const expectedGesture = Object.keys(gestureMap).find(
    (key) => gestureMap[key] === expected
  );

  if (gesture === lastGesture) return;

  if (gesture === expectedGesture && !gestureCooldown) {
    tile.element.classList.remove("highlight");
    score++;
    scoreEl.textContent = `Score: ${score}`;
    currentTileIndex++;
    readyForNext = false;
    gestureCooldown = true;
    lastGesture = gesture;

    if (currentTileIndex >= 5) {
      for (let t of tileSequence[currentRow]) grid.removeChild(t.element);
      tileSequence[currentRow] = null;
      tileSequence.push(createRow());
      currentRow++;
      currentTileIndex = 0;
    }

    highlightCurrentTile();
  } else if (gesture !== expectedGesture && !gestureCooldown) {
    endGame(false);
  }
}

// ✅ FINAL Fixed endGame logic
function endGame(won) {
  clearInterval(timerInterval);
  gameOver = true;
  gameOverEl.textContent = won
    ? "🎉 You Win!"
    : `❌ Game Over! Final Score: ${score}`;
  retryBtn.style.display = "inline-block";

  const user = firebase.auth().currentUser;
  if (!user) return;

  const userRef = firebase.firestore().collection("users").doc(user.uid);
  const scoreRef = firebase.firestore().collection("scores").doc(user.uid);

  userRef.get().then((doc) => {
    if (!doc.exists) return;

    const username = doc.data().username || "unknown";
    const currentHigh = doc.data().highscore || 0;

    if (score > currentHigh) {
      userRef.update({ highscore: score });
    }

    scoreRef.get().then((scoreDoc) => {
      const existingHigh = scoreDoc.exists ? scoreDoc.data().highscore || 0 : 0;

      if (score > existingHigh) {
        scoreRef.set(
          {
            username: username,
            highscore: score,
          },
          { merge: true }
        );
      }
    });
  });
}

function startTimer() {
  timerInterval = setInterval(() => {
    timer--;
    timerEl.textContent = `⏱️ ${timer}`;
    if (timer <= 0) endGame(true);
  }, 1000);
}

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

  lastStates.push(openHandLabels);
  if (lastStates.length > BUFFER_SIZE) lastStates.shift();

  let gesture = null;
  if (openHandLabels.includes("Left") && !openHandLabels.includes("Right")) {
    gesture = "left";
  } else if (
    openHandLabels.includes("Right") &&
    !openHandLabels.includes("Left")
  ) {
    gesture = "right";
  }

  const handsAreOpen = openHandLabels.length > 0;
  if (!handsAreOpen && handsPreviouslyOpen) {
    readyForNext = true;
    gestureCooldown = false;
    lastGesture = null;
  }
  handsPreviouslyOpen = handsAreOpen;

  if (gesture && readyForNext) {
    validateGesture(gesture);
  }
});

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480,
});
camera.start();

startTimer();

retryBtn.addEventListener("click", () => {
  window.location.href = "game.html";
});
