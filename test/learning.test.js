import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChoices,
  buildSentenceOptions,
  joinTokens,
  normalize,
  pronunciationMatches,
  shuffle,
  tokenizeSentence,
  transcriptMatches,
} from "../public/learning.js";

test("normalise ignores case, accents, apostrophes and punctuation", () => {
  assert.equal(normalize("  Dov’È, L'ACQUA? "), "dov e l acqua");
});

test("shuffle does not mutate its input", () => {
  const input = [1, 2, 3];
  assert.deepEqual(shuffle(input, () => 0), [2, 3, 1]);
  assert.deepEqual(input, [1, 2, 3]);
});

test("choices contain the answer and unique visible translations", () => {
  const answer = { id: "a", italian: "ciao" };
  const pool = [
    answer,
    { id: "b", italian: "grazie" },
    { id: "c", italian: "Grazie!" },
    { id: "d", italian: "prego" },
  ];
  const choices = buildChoices(answer, pool, 3, () => 0.5);
  assert.equal(choices.length, 3);
  assert.ok(choices.some((item) => item.id === answer.id));
  assert.equal(new Set(choices.map((item) => normalize(item.italian))).size, 3);
});

test("sentence tokenisation preserves apostrophes and punctuation", () => {
  const tokens = tokenizeSentence("Dov'è l'acqua?");
  assert.deepEqual(tokens, ["Dov'è", "l'acqua", "?"]);
  assert.equal(joinTokens(tokens), "Dov'è l'acqua?");
});

test("sentence options add an equal number of unique wrong words", () => {
  const options = buildSentenceOptions(
    "Io sono felice.",
    ["Tu bevi acqua.", "La casa è grande."],
    () => 0.5,
  );
  const correctWords = options.filter((token) => token.correct && normalize(token.text));
  const distractors = options.filter((token) => !token.correct);
  assert.equal(distractors.length, correctWords.length);
  assert.equal(new Set(options.map((token) => normalize(token.text)).filter(Boolean)).size, correctWords.length + distractors.length);
  assert.ok(distractors.every((token) => /[\p{L}\p{N}]/u.test(token.text)));
});

test("sentence options omit punctuation", () => {
  const options = buildSentenceOptions(
    "Dov'è l'acqua? Sì!",
    ["Io bevo acqua."],
    () => 0.5,
  );
  const correct = options.filter((token) => token.correct).map((token) => token.text);
  assert.deepEqual(correct.sort(), ["Dov'è", "Sì", "l'acqua"].sort());
  assert.ok(options.every((token) => /[\p{L}\p{N}]/u.test(token.text)));
});

test("transcript matching uses normalised text", () => {
  assert.equal(transcriptMatches("Perche?", "perché"), true);
  assert.equal(transcriptMatches("buona sera", "buongiorno"), false);
});

test("pronunciation tolerates ambiguous doubled Italian consonants", () => {
  assert.equal(pronunciationMatches("sonno", "sono"), true);
  assert.equal(pronunciationMatches("fato", "fatto"), true);
  assert.equal(pronunciationMatches("pane", "cane"), false);
});
