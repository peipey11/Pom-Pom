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

function onResults(results) {
  const handsDetected = results.multiHandLandmarks.length;
  const labels = results.multiHandedness.map((h) => h.label); // "Left", "Right"

  if (handsDetected === 0) {
    updateStatus("No hands detected", "gray");
  } else if (handsDetected === 1) {
    const hand = labels[0];
    if (hand === "Left") {
      updateStatus("🟩 Left hand", "green");
    } else if (hand === "Right") {
      updateStatus("🟥 Right hand", "red");
    }
  } else if (handsDetected === 2) {
    updateStatus("🔵 Both hands", "blue");
  }
}

function updateStatus(text, color) {
  outputText.innerText = text;
  indicator.style.backgroundColor = color;
}
