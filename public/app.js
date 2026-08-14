let words = [];
let mode = "easy";
let deck = "word";
let current = null;
let answered = false;
let nextTimer = null;
let speechToken = 0;

const $ = (selector) => document.querySelector(selector);
const normalize = (value) => value
  .toLocaleLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);
const kind = (word) => word.type || "word";

function speakItalian(text, onDone) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    nextTimer = setTimeout(() => onDone?.(), 750);
    return;
  }

  const token = ++speechToken;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "it-IT";
  utterance.rate = 0.9;

  const voice = speechSynthesis
    .getVoices()
    .find((item) => item.lang.toLowerCase().startsWith("it"));

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
  utterance.onerror = () => {
    nextTimer = setTimeout(done, 750);
  };

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
  nextTimer = setTimeout(done, 15000);
}

function next() {
  clearTimeout(nextTimer);
  nextTimer = null;
  speechToken++;

  if ("speechSynthesis" in window) speechSynthesis.cancel();

  const pool = deck === "mixed" ? words : words.filter((word) => kind(word) === deck);

  if (pool.length < 6) {
    const entryName = deck === "sentence" ? "sentences" : "words";
    $("#play").innerHTML = `<p>Add at least six ${entryName} to start playing.</p>`;
    return;
  }

  answered = false;
  $("#feedback").textContent = "";
  $("#feedback").className = "feedback";
  $("#next").hidden = true;

  const italianPrompt = mode === "normal";
  current = pick(pool);
  $("#question").textContent = italianPrompt ? current.italian : current.english;
  $("#prompt").textContent = italianPrompt ? "Italian → English" : "English → Italian";

  if (mode === "easy") {
    const alternatives = shuffle(pool.filter((word) => word.id !== current.id)).slice(0, 5);
    const choices = shuffle([current, ...alternatives]);
    const buttons = choices
      .map((word) => `<button class="option" data-id="${word.id}">${word.italian}</button>`)
      .join("");

    $("#play").innerHTML = `<div class="options">${buttons}</div>`;
    document.querySelectorAll(".option").forEach((button) => {
      button.onclick = () => checkEasy(button);
    });
    return;
  }

  const targetLanguage = mode === "hard" ? "Italian" : "English";
  $("#play").innerHTML = `
    <form class="answer" id="answer">
      <input autocomplete="off" autofocus placeholder="Type the ${targetLanguage} translation">
      <button>Check</button>
    </form>
  `;
  $("#answer").onsubmit = (event) => {
    event.preventDefault();
    checkTyped(event.target.querySelector("input"));
  };
}

function finish(ok, message) {
  answered = true;

  const feedback = $("#feedback");
  feedback.textContent = message;
  feedback.className = `feedback ${ok ? "good" : "bad"}`;

  if (ok) {
    speakItalian(current.italian, () => {
      nextTimer = setTimeout(next, 250);
    });
    return;
  }

  speakItalian(current.italian);
  $("#next").hidden = false;
}

function checkEasy(button) {
  if (answered) return;

  const ok = button.dataset.id === current.id;
  document.querySelectorAll(".option").forEach((option) => {
    option.disabled = true;
    if (option.dataset.id === current.id) option.classList.add("correct");
    else if (option === button && !ok) option.classList.add("incorrect");
  });

  finish(ok, ok ? "Correct. Bravissimo!" : `The answer is “${current.italian}”.`);
}

function checkTyped(input) {
  if (answered) return;

  const answer = mode === "hard" ? current.italian : current.english;
  const ok = normalize(input.value) === normalize(answer);

  input.disabled = true;
  input.parentElement.querySelector("button").disabled = true;
  finish(ok, ok ? "Correct. Bravissimo!" : `The answer is “${answer}”.`);
}

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.onclick = () => {
    mode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    next();
  };
});

document.querySelectorAll("[data-deck]").forEach((button) => {
  button.onclick = () => {
    deck = button.dataset.deck;
    document.querySelectorAll("[data-deck]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    next();
  };
});

$("#next").onclick = next;
$("#add").onsubmit = async (event) => {
  event.preventDefault();

  const form = event.target;
  const note = $("#note");
  note.textContent = "Saving…";

  const response = await fetch("/api/words", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      english: form.english.value,
      italian: form.italian.value,
      type: form.type.value,
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    note.textContent = data.error;
    note.style.color = "var(--wrong)";
    return;
  }

  words.push(data.word);
  form.reset();
  note.textContent = `Saved — ${data.word.english} → ${data.word.italian}`;
  note.style.color = "var(--accent)";
};

fetch("/api/words")
  .then((response) => response.json())
  .then((data) => {
    words = data.words;
    next();
  })
  .catch(() => {
    $("#question").textContent = "Could not load words";
    $("#play").innerHTML = "<p>Check your Cloudflare KV binding and refresh.</p>";
  });
