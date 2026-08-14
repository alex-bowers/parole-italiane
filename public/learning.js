export function normalize(value) {
  return String(value ?? "")
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function buildChoices(answer, pool, count = 6, random = Math.random) {
  const seen = new Set([normalize(answer.italian)]);
  const alternatives = shuffle(pool.filter((item) => item.id !== answer.id), random)
    .filter((item) => {
      const key = normalize(item.italian);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, count - 1);

  return shuffle([answer, ...alternatives], random);
}

export function tokenizeSentence(value) {
  return String(value ?? "").match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu) ?? [];
}

export function joinTokens(tokens) {
  return tokens.join(" ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/([¿¡])\s+/g, "$1");
}

export function buildSentenceOptions(sentence, otherSentences, random = Math.random) {
  const correct = tokenizeSentence(sentence).map((text, index) => ({
    id: `correct-${index}`,
    text,
    correct: true,
  }));
  const answerWords = new Set(correct.map((token) => normalize(token.text)).filter(Boolean));
  const seen = new Set(answerWords);
  const candidates = shuffle(otherSentences.flatMap(tokenizeSentence), random).filter((text) => {
    if (!/[\p{L}\p{N}]/u.test(text)) return false;
    const key = normalize(text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const wordCount = correct.filter((token) => /[\p{L}\p{N}]/u.test(token.text)).length;
  const distractors = candidates.slice(0, wordCount).map((text, index) => ({
    id: `distractor-${index}`,
    text,
    correct: false,
  }));
  return shuffle([...correct, ...distractors], random);
}

export function transcriptMatches(transcript, expected) {
  return normalize(transcript) === normalize(expected);
}

function collapseRepeatedLetters(value) {
  return normalize(value).replace(/([bcdfghlmnpqrstvwz])\1+/g, "$1");
}

export function pronunciationMatches(transcript, expected) {
  return transcriptMatches(transcript, expected)
    || collapseRepeatedLetters(transcript) === collapseRepeatedLetters(expected);
}
