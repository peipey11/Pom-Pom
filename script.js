const outputText = document.getElementById("output");
const indicator = document.getElementById("indicator");
const videoElement = document.getElementById("camera");

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  selfieMode: true, // ✅ Flip camera input
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 480,
  height: 360,
});
camera.start();

// Frame buffer for temporal smoothing
let lastStates = [];
const BUFFER_SIZE = 3;

function onResults(results) {
  let openHandLabels = [];

  results.multiHandLandmarks.forEach((landmarks, index) => {
    const isOpen = isHandOpen(landmarks);
    if (isOpen) {
      const label = results.multiHandedness[index].label;
      openHandLabels.push(label);
    }
  });

  // Store recent states
  lastStates.push(openHandLabels);
  if (lastStates.length > BUFFER_SIZE) {
    lastStates.shift(); // Keep buffer size fixed
  }

  // Analyze buffered states
  const consistentBothHandsOpen = lastStates.every(
    (state) => state.includes("Left") && state.includes("Right")
  );

  if (consistentBothHandsOpen) {
    updateStatus("🔵 Both hands open", "blue");
  } else if (openHandLabels.length === 1) {
    if (openHandLabels[0] === "Left") {
      updateStatus("🟩 Open Left Hand", "green");
    } else {
      updateStatus("🟥 Open Right Hand", "red");
    }
  } else if (openHandLabels.length === 0) {
    updateStatus("No open hand detected", "gray");
  } else {
    updateStatus("🟧 Mixed/Transition", "orange");
  }
}

// Heuristic to check if hand is open
function isHandOpen(landmarks) {
  const tips = [8, 12, 16, 20]; // Tips of Index, Middle, Ring, Pinky
  const pips = [6, 10, 14, 18]; // Corresponding PIP joints

  let openFingers = 0;
  for (let i = 0; i < tips.length; i++) {
    if (landmarks[tips[i]].y < landmarks[pips[i]].y) {
      openFingers++;
    }
  }

  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const wrist = landmarks[0];
  const isThumbOpen =
    Math.abs(thumbTip.x - wrist.x) > Math.abs(thumbIP.x - wrist.x);

  return openFingers >= 3 && isThumbOpen;
}
function updateStatus(text, color) {
  outputText.innerText = text;
  indicator.style.backgroundColor = color;
}
