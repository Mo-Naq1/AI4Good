import {
  activateBeat,
  clearBeatHighlights,
  setTalking,
  wait
} from "../dom.js";

export function stopSpeaking() {
  setTalking(false);
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  clearBeatHighlights();
}

export function speak(text, rate) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.pitch = 1.02;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

export async function playWord(word, rate) {
  stopSpeaking();
  setTalking(true);
  await speak(word, rate);
  setTalking(false);
}

export async function playBeats(lesson) {
  stopSpeaking();
  setTalking(true);

  for (let index = 0; index < lesson.beats.length; index += 1) {
    activateBeat(index);
    await speak(lesson.beats[index], 0.68);
    await wait(180);
  }

  clearBeatHighlights();
  await speak(lesson.word, 0.86);
  setTalking(false);
}
