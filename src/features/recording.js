import { elements } from "../dom.js";
import { state } from "../state.js";
import { stopSpeaking } from "./speech.js";

function getRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function normalizePhrase(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(source, target) {
  if (!source.length) {
    return target.length;
  }

  if (!target.length) {
    return source.length;
  }

  const previous = Array.from({ length: target.length + 1 }, (_, index) => index);
  const current = new Array(target.length + 1).fill(0);

  for (let row = 1; row <= source.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= target.length; column += 1) {
      const substitutionCost = source[row - 1] === target[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost
      );
    }

    for (let column = 0; column <= target.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[target.length];
}

function scoreCandidate(candidate, target) {
  if (!candidate.length || !target.length) {
    return 0;
  }

  const distance = levenshteinDistance(candidate, target);
  const longest = Math.max(candidate.length, target.length);
  return Math.max(0, Math.round((1 - distance / longest) * 100));
}

function evaluatePronunciation(transcript, lessonWord) {
  const normalizedTranscript = normalizePhrase(transcript);
  const normalizedTarget = normalizePhrase(lessonWord);

  if (!normalizedTranscript) {
    return {
      score: 0,
      heard: "",
      message: `I couldn't hear "${lessonWord}". Try again a little closer to the microphone.`
    };
  }

  const transcriptWords = normalizedTranscript.split(" ");
  const targetWords = normalizedTarget.split(" ");
  const candidatePhrases = new Set([normalizedTranscript]);

  for (let size = Math.max(1, targetWords.length - 1); size <= targetWords.length + 1; size += 1) {
    if (size > transcriptWords.length) {
      continue;
    }

    for (let index = 0; index <= transcriptWords.length - size; index += 1) {
      candidatePhrases.add(transcriptWords.slice(index, index + size).join(" "));
    }
  }

  let bestHeard = normalizedTranscript;
  let bestScore = 0;

  candidatePhrases.forEach((candidate) => {
    const score = scoreCandidate(candidate, normalizedTarget);
    if (score > bestScore) {
      bestScore = score;
      bestHeard = candidate;
    }
  });

  if (bestScore >= 92) {
    return {
      score: bestScore,
      heard: bestHeard,
      message: `Excellent. I heard "${bestHeard}" and that matches "${lessonWord}" very well.`
    };
  }

  if (bestScore >= 75) {
    return {
      score: bestScore,
      heard: bestHeard,
      message: `Pretty close. I heard "${bestHeard}". Try saying "${lessonWord}" one more time.`
    };
  }

  return {
    score: bestScore,
    heard: bestHeard,
    message: `I heard "${bestHeard}". That doesn't sound close enough to "${lessonWord}" yet. Listen once more and try again.`
  };
}

function cleanupRecognition(recognition) {
  if (state.recordTimeout) {
    window.clearTimeout(state.recordTimeout);
    state.recordTimeout = null;
  }

  if (state.speechRecognition === recognition) {
    state.speechRecognition = null;
  }

  elements.recordButton.classList.remove("recording");
}

export function updateRecordingAvailability() {
  const supported = Boolean(getRecognitionConstructor());

  elements.recordButton.disabled = !supported;
  if (!supported) {
    elements.recordButton.querySelector("span").textContent = "Pronunciation check unavailable";
  }
}

export async function toggleRecording() {
  if (state.speechRecognition) {
    stopRecording();
    return;
  }

  const Recognition = getRecognitionConstructor();
  if (!Recognition) {
    elements.lessonDescription.textContent = "Pronunciation check is not available on this device.";
    return;
  }

  if (!state.currentLesson?.word) {
    elements.lessonDescription.textContent = "Open a lesson before checking pronunciation.";
    return;
  }

  try {
    stopSpeaking();
    state.recognitionErrored = false;
    state.lastTranscript = "";

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      state.lastTranscript = transcript;

      const latestResult = event.results[event.results.length - 1];
      if (!latestResult?.isFinal && transcript) {
        elements.lessonDescription.textContent = `Listening... I hear "${normalizePhrase(transcript)}".`;
      }
    };

    recognition.onerror = (event) => {
      state.recognitionErrored = true;
      cleanupRecognition(recognition);

      if (event.error === "no-speech") {
        elements.lessonDescription.textContent = `I couldn't hear "${state.currentLesson.word}". Try again.`;
        return;
      }

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        elements.lessonDescription.textContent = "Microphone permission is blocked for pronunciation checks.";
        return;
      }

      elements.lessonDescription.textContent = "Pronunciation check failed. Try again.";
    };

    recognition.onend = () => {
      cleanupRecognition(recognition);

      if (state.recognitionErrored) {
        state.recognitionErrored = false;
        state.lastTranscript = "";
        return;
      }

      if (!state.currentLesson?.word) {
        elements.lessonDescription.textContent = "Choose an action below.";
        return;
      }

      const feedback = evaluatePronunciation(state.lastTranscript, state.currentLesson.word);
      elements.lessonDescription.textContent = `${feedback.message} Score: ${feedback.score}%.`;
      state.lastTranscript = "";
    };

    state.speechRecognition = recognition;
    elements.recordButton.classList.add("recording");
    elements.lessonDescription.textContent = `Listening... say "${state.currentLesson.word}".`;
    recognition.start();
    state.recordTimeout = window.setTimeout(() => {
      stopRecording();
    }, 2500);
  } catch (error) {
    console.error("Pronunciation check unavailable", error);
    elements.lessonDescription.textContent = "Pronunciation check could not start.";
  }
}

export function stopRecording() {
  const recognition = state.speechRecognition;
  if (!recognition) {
    cleanupRecognition(null);
    if (!state.currentLesson) {
      return;
    }
    elements.lessonDescription.textContent = "Choose an action below.";
    return;
  }

  recognition.stop();
}
