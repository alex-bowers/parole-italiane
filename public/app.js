import { buildChoices, buildSentenceOptions, joinTokens, normalize, pronunciationMatches, shuffle } from "./learning.js";

let words = [];
let activity = "choice";
let deck = "word";
let direction = "english-italian";
let current = null;
let answered = false;
let nextTimer = null;
let speechToken = 0;
let recognition = null;

const WORDS_KEY = "parole-italiane.words";
const QUEUE_KEY = "parole-italiane.additions";
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const $ = (selector) => document.querySelector(selector);
const kind = (word) => word.type || "word";
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
const poolForDeck = () => deck === "mixed" ? words : words.filter((word) => kind(word) === deck);
const readStored = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const saveWords = () => localStorage.setItem(WORDS_KEY, JSON.stringify(words));
const readQueue = () => readStored(QUEUE_KEY, []);
const saveQueue = (queue) => localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
const activityTitles = {
  choice: "Multiple choice",
  translate: "Translation",
  "listen-choice": "Listen & choose",
  dictation: "Listen & type",
  pronunciation: "Pronunciation",
  matching: "Matching",
  "sentence-builder": "Build a sentence",
};

function showScreen(screen, title = "Parole italiane") {
  stopMedia();
  $("#menu-screen").hidden = screen !== "menu";
  $("#game-screen").hidden = screen !== "game";
  $("#add-screen").hidden = screen !== "add";
  $("#back").hidden = screen === "menu";
  $("#page-title").innerHTML = screen === "menu" ? "Parole <i>italiane</i>" : escapeHtml(title);
  document.title = screen === "menu" ? "Parole italiane" : `${title} · Parole italiane`;
}

function showNote(message, good = false) {
  $("#note").textContent = message;
  $("#note").style.color = good ? "var(--accent)" : "var(--wrong)";
}

async function syncAdditions() {
  const queue = readQueue();
  if (!queue.length || !navigator.onLine) return;
  const remaining = [];
  for (const addition of queue) {
    try {
      const response = await fetch("/api/words", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(addition),
      });
      const data = await response.json();
      if (!response.ok && response.status !== 409) {
        remaining.push(addition);
      } else if (response.ok) {
        const index = words.findIndex((word) => word.id === addition.localId);
        if (index !== -1) words[index] = data.word;
      } else {
        words = words.filter((word) => word.id !== addition.localId);
      }
    } catch {
      remaining.push(addition);
    }
  }
  saveQueue(remaining);
  saveWords();
  if (!remaining.length) showNote("Offline additions synced.", true);
}

function speakItalian(text, { rate = 1, onDone } = {}) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    onDone?.();
    return false;
  }
  const token = ++speechToken;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "it-IT";
  utterance.rate = rate;
  const voice = speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith("it"));
  if (voice) utterance.voice = voice;
  let finished = false;
  const done = () => {
    if (finished || token !== speechToken) return;
    finished = true;
    clearTimeout(nextTimer);
    nextTimer = null;
    onDone?.();
  };
  utterance.onend = done;
  utterance.onerror = done;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
  nextTimer = setTimeout(done, 15000);
  return true;
}

function audioControls() {
  return `<div class="audio-controls" aria-label="Audio controls">
    <button type="button" data-speak="normal" aria-label="Play Italian audio">▶ Play</button>
    <button type="button" data-speak="slow" aria-label="Play Italian audio slowly">🐢 Slower</button>
  </div>`;
}

function wireAudioControls(text) {
  document.querySelectorAll("[data-speak]").forEach((button) => {
    button.onclick = () => speakItalian(text, { rate: button.dataset.speak === "slow" ? 0.5 : 1 });
  });
}

function stopMedia() {
  clearTimeout(nextTimer);
  nextTimer = null;
  speechToken++;
  recognition?.abort();
  recognition = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function resetQuestion(label, question) {
  answered = false;
  $("#prompt").textContent = label;
  $("#question").textContent = question;
  $("#feedback").textContent = "";
  $("#feedback").className = "feedback";
  $("#next").hidden = true;
}

function showFeedback(ok, message, { autoAdvance = false, speak = false } = {}) {
  answered = true;
  $("#feedback").textContent = message;
  $("#feedback").className = `feedback ${ok ? "good" : "bad"}`;
  $("#next").hidden = autoAdvance;
  if (autoAdvance) {
    const advance = () => { nextTimer = setTimeout(next, 350); };
    if (!speak || !speakItalian(current.italian, { onDone: advance })) advance();
  } else if (speak) {
    speakItalian(current.italian);
  }
}

function renderChoices(listen = false) {
  const pool = poolForDeck();
  current = randomItem(pool);
  const choices = buildChoices(current, pool);
  resetQuestion(listen ? "Listen and choose" : "English → Italian", listen ? "Listen to the Italian" : current.english);
  $("#play").innerHTML = `${listen ? audioControls() : ""}<div class="options">${choices.map((word) => `<button class="option" data-id="${escapeHtml(word.id)}">${escapeHtml(word.italian)}</button>`).join("")}</div>`;
  if (listen) {
    wireAudioControls(current.italian);
    if (!speakItalian(current.italian)) {
      $("#question").textContent = current.italian;
      $("#feedback").textContent = "Audio is unavailable in this browser, so the Italian text is shown instead.";
    }
  }
  document.querySelectorAll(".option").forEach((button) => {
    button.onclick = () => {
      if (answered) return;
      const ok = button.dataset.id === current.id;
      document.querySelectorAll(".option").forEach((option) => {
        option.disabled = true;
        if (option.dataset.id === current.id) option.classList.add("correct");
        else if (option === button) option.classList.add("incorrect");
      });
      showFeedback(ok, ok ? "Correct. Bravissimo!" : `The answer is “${current.italian}”.`, { autoAdvance: ok, speak: !listen });
    };
  });
}

function renderTranslation() {
  current = randomItem(poolForDeck());
  const toItalian = direction === "english-italian";
  const answer = toItalian ? current.italian : current.english;
  resetQuestion(toItalian ? "English → Italian" : "Italian → English", toItalian ? current.english : current.italian);
  $("#play").innerHTML = `<form class="answer" id="answer">
    <input aria-label="Your translation" autocomplete="off" autofocus placeholder="Type the ${toItalian ? "Italian" : "English"} translation">
    <button>Check</button>
  </form>`;
  $("#answer").onsubmit = (event) => {
    event.preventDefault();
    if (answered) return;
    const input = event.target.querySelector("input");
    const ok = normalize(input.value) === normalize(answer);
    input.disabled = true;
    event.target.querySelector("button").disabled = true;
    showFeedback(ok, ok ? "Correct. Bravissimo!" : `The answer is “${answer}”.`, { autoAdvance: ok, speak: true });
  };
}

function renderDictation() {
  current = randomItem(poolForDeck());
  resetQuestion("Listen and type", "What do you hear?");
  $("#play").innerHTML = `${audioControls()}<form class="answer" id="answer">
    <input aria-label="Type what you hear" autocomplete="off" autofocus placeholder="Type the Italian"><button>Check</button>
  </form>`;
  wireAudioControls(current.italian);
  if (!speakItalian(current.italian)) {
    $("#question").textContent = current.italian;
    $("#feedback").textContent = "Audio is unavailable in this browser, so the Italian text is shown instead.";
  }
  $("#answer").onsubmit = (event) => {
    event.preventDefault();
    if (answered) return;
    const input = event.target.querySelector("input");
    const ok = normalize(input.value) === normalize(current.italian);
    input.disabled = true;
    event.target.querySelector("button").disabled = true;
    showFeedback(ok, ok ? "Correct. Bravissimo!" : `You heard “${current.italian}”.`, { autoAdvance: ok, speak: !ok });
  };
}

function renderPronunciation() {
  current = randomItem(poolForDeck());
  resetQuestion("Pronunciation practice", current.italian);
  const support = SpeechRecognition
    ? `<button class="primary" id="speak">🎙 Speak</button><p class="status" id="speech-status" aria-live="polite">Press Speak when you are ready.</p>`
    : `<p class="status">Speech recognition is unavailable in this browser. Listen and repeat aloud, then reveal the translation.</p>`;
  $("#play").innerHTML = `${audioControls()}<div class="pronunciation">${support}<button class="secondary" id="reveal">Reveal translation</button></div>`;
  wireAudioControls(current.italian);
  $("#reveal").onclick = () => showFeedback(true, `${current.italian} means “${current.english}”.`);
  if (!SpeechRecognition) return;

  $("#speak").onclick = () => {
    if (recognition) return;
    recognition = new SpeechRecognition();
    recognition.lang = "it-IT";
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    const button = $("#speak");
    const status = $("#speech-status");
    button.disabled = true;
    status.textContent = "Listening…";
    recognition.onresult = (event) => {
      status.textContent = "Checking what I heard…";
      const alternatives = Array.from(event.results[0], (result) => result.transcript);
      const heard = alternatives[0] || "";
      const exact = alternatives.some((result) => normalize(result) === normalize(current.italian));
      const ok = alternatives.some((result) => pronunciationMatches(result, current.italian));
      recognition = null;
      button.disabled = false;
      showFeedback(ok, ok
        ? `I heard “${heard}”. ${exact ? "That matches." : "That sounds close enough."}`
        : `I heard “${heard}”. Try again or play the example.`);
      if (!ok) answered = false;
    };
    recognition.onerror = (event) => {
      recognition = null;
      button.disabled = false;
      const messages = {
        "not-allowed": "Microphone access was denied. Allow it in browser settings or use listen-and-repeat practice.",
        "no-speech": "I did not hear anything. Try again when you are ready.",
        network: "Speech recognition could not connect. Try again or use listen-and-repeat practice.",
      };
      status.textContent = messages[event.error] || "Speech recognition stopped. Please try again.";
    };
    recognition.onend = () => {
      if (!recognition) return;
      recognition = null;
      button.disabled = false;
      if (status.textContent === "Listening…") status.textContent = "I did not hear anything. Please try again.";
    };
    try { recognition.start(); } catch {
      recognition = null;
      button.disabled = false;
      status.textContent = "Speech recognition could not start. Please try again.";
    }
  };
}

function renderMatching() {
  const pairs = shuffle(poolForDeck()).slice(0, 5);
  current = pairs[0];
  let selected = null;
  let matched = 0;
  resetQuestion("Match the pairs", "Pair each English phrase with its Italian translation");
  const cards = shuffle(pairs.flatMap((word) => [
    { id: word.id, side: "english", text: word.english },
    { id: word.id, side: "italian", text: word.italian },
  ]));
  $("#play").innerHTML = `<div class="matching">${cards.map((card) => `<button class="match-card" aria-pressed="false" data-id="${escapeHtml(card.id)}" data-side="${card.side}">${escapeHtml(card.text)}</button>`).join("")}</div>`;
  document.querySelectorAll(".match-card").forEach((button) => {
    button.onclick = () => {
      if (button.classList.contains("matched")) return;
      if (!selected) {
        selected = button;
        button.classList.add("selected");
        button.setAttribute("aria-pressed", "true");
        return;
      }
      if (selected === button) {
        selected.classList.remove("selected");
        selected.setAttribute("aria-pressed", "false");
        selected = null;
        return;
      }
      const ok = selected.dataset.id === button.dataset.id && selected.dataset.side !== button.dataset.side;
      if (ok) {
        selected.classList.remove("selected");
        selected.classList.add("matched");
        button.classList.add("matched");
        selected.disabled = true;
        button.disabled = true;
        selected = null;
        matched++;
        $("#feedback").textContent = `${matched} of ${pairs.length} pairs matched.`;
        $("#feedback").className = "feedback good";
        if (matched === pairs.length) {
          answered = true;
          $("#feedback").textContent = "All matched. Bravissimo!";
          nextTimer = setTimeout(next, 700);
        }
      } else {
        const first = selected;
        first.classList.remove("selected");
        first.setAttribute("aria-pressed", "false");
        first.classList.add("incorrect");
        button.classList.add("incorrect");
        selected = null;
        $("#feedback").textContent = "Those do not match. Try again.";
        $("#feedback").className = "feedback bad";
        setTimeout(() => {
          first.classList.remove("incorrect");
          button.classList.remove("incorrect");
        }, 500);
      }
    };
  });
}

function renderSentenceBuilder() {
  const sentences = poolForDeck().filter((word) => kind(word) === "sentence");
  current = randomItem(sentences);
  let available = buildSentenceOptions(
    current.italian,
    sentences.filter((word) => word.id !== current.id).map((word) => word.italian),
  );
  let chosen = [];
  resetQuestion("Build the Italian sentence", current.english);
  const renderTokens = () => {
    $("#play").innerHTML = `<div class="sentence-answer" aria-label="Your sentence">${chosen.length ? chosen.map((token) => `<button data-remove="${token.id}">${escapeHtml(token.text)}</button>`).join("") : "<span>Choose words below</span>"}</div>
      <div class="token-bank" aria-label="Available words">${available.map((token) => `<button data-add="${token.id}">${escapeHtml(token.text)}</button>`).join("")}</div>
      <button class="primary check-sentence" ${chosen.length ? "" : "disabled"}>Check</button>`;
    document.querySelectorAll("[data-add]").forEach((button) => {
      button.onclick = () => {
        const index = available.findIndex((token) => token.id === button.dataset.add);
        chosen.push(available.splice(index, 1)[0]);
        renderTokens();
      };
    });
    document.querySelectorAll("[data-remove]").forEach((button) => {
      button.onclick = () => {
        const index = chosen.findIndex((token) => token.id === button.dataset.remove);
        available.push(chosen.splice(index, 1)[0]);
        renderTokens();
      };
    });
    $(".check-sentence").onclick = () => {
      const ok = normalize(joinTokens(chosen.map((token) => token.text))) === normalize(current.italian);
      showFeedback(ok, ok ? "Correct. Bravissimo!" : `The answer is “${current.italian}”.`, { autoAdvance: ok, speak: true });
      if (!ok) {
        answered = false;
        $("#next").hidden = false;
      }
    };
  };
  renderTokens();
}

const activities = {
  choice: { minimum: 2, render: () => renderChoices(false) },
  translate: { minimum: 1, render: renderTranslation },
  "listen-choice": { minimum: 2, render: () => renderChoices(true) },
  dictation: { minimum: 1, render: renderDictation },
  pronunciation: { minimum: 1, render: renderPronunciation },
  matching: { minimum: 5, render: renderMatching },
  "sentence-builder": { minimum: 1, sentencesOnly: true, render: renderSentenceBuilder },
};

function updateControls() {
  document.querySelectorAll("[data-deck]").forEach((button) => {
    button.disabled = activity === "sentence-builder" && button.dataset.deck !== "sentence";
    button.classList.toggle("active", button.dataset.deck === deck);
  });
  $("#direction-control").hidden = activity !== "translate";
}

function next() {
  stopMedia();
  updateControls();
  const config = activities[activity];
  const pool = config.sentencesOnly ? poolForDeck().filter((word) => kind(word) === "sentence") : poolForDeck();
  if (pool.length < config.minimum) {
    resetQuestion("Not enough content", "Add more practice content");
    const noun = config.sentencesOnly ? "sentence" : "entry";
    const plural = config.minimum === 1 ? noun : noun === "entry" ? "entries" : "sentences";
    $("#play").innerHTML = `<p>This activity needs at least ${config.minimum} ${plural} in the selected deck.</p>`;
    return;
  }
  config.render();
}

document.querySelectorAll("[data-activity]").forEach((button) => {
  button.onclick = () => {
    activity = button.dataset.activity;
    if (activity === "sentence-builder") deck = "sentence";
    showScreen("game", activityTitles[activity]);
    next();
  };
});
document.querySelectorAll("[data-deck]").forEach((button) => {
  button.onclick = () => { deck = button.dataset.deck; next(); };
});
document.querySelectorAll("[data-direction]").forEach((button) => {
  button.onclick = () => {
    direction = button.dataset.direction;
    document.querySelectorAll("[data-direction]").forEach((item) => item.classList.toggle("active", item === button));
    next();
  };
});

$("#next").onclick = next;
$("#show-add").onclick = () => showScreen("add", "Add words");
$("#back").onclick = () => showScreen("menu");
$("#add").onsubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const addition = {
    english: form.english.value.trim().replace(/\s+/g, " "),
    italian: form.italian.value.trim().replace(/\s+/g, " "),
    type: form.type.value === "sentence" ? "sentence" : "word",
  };
  if (!addition.english || !addition.italian || addition.english.length > 80 || addition.italian.length > 80) {
    showNote("Add an English and Italian word (up to 80 characters each).");
    return;
  }
  if (words.some((word) => normalize(word.english) === normalize(addition.english) && normalize(word.italian) === normalize(addition.italian))) {
    showNote("That translation is already in your list.");
    return;
  }
  addition.localId = `local-${crypto.randomUUID()}`;
  words.push({ ...addition, id: addition.localId });
  saveWords();
  saveQueue([...readQueue(), addition]);
  form.reset();
  showNote(navigator.onLine ? "Saving…" : "Saved on this device — it will sync when you are online.", true);
  await syncAdditions();
};

async function loadWords() {
  const stored = readStored(WORDS_KEY, []);
  if (stored.length) { words = stored; next(); }
  try {
    const response = await fetch("/api/words");
    if (!response.ok) throw new Error("Could not load words");
    const data = await response.json();
    const pending = readQueue().map((addition) => ({ ...addition, id: addition.localId }));
    words = [...data.words, ...pending.filter((item) => !data.words.some((word) => normalize(word.english) === normalize(item.english) && normalize(word.italian) === normalize(item.italian)))];
    saveWords();
    next();
    await syncAdditions();
  } catch {
    if (!stored.length) {
      $("#question").textContent = "You are offline";
      $("#play").innerHTML = "<p>Connect once to download your vocabulary for offline use.</p>";
    }
  }
}

window.addEventListener("online", syncAdditions);
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js"));
loadWords();
