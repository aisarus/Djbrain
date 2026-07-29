import { createCognitiveEvent } from '../contracts/cognitive-event.js';

const RULES = [
  { speechAct: 'correction', intent: 'correct_previous_behavior', test: /\b(нет|не так|ошиб|исправ|я имел в виду|не надо)\b/i },
  { speechAct: 'decision', intent: 'set_project_direction', test: /\b(решил|делаем|начинаем|приступаем|замораживаем|надо делать|давай выполнять)\b/i },
  { speechAct: 'request', intent: 'request_action', test: /\b(сделай|дай|построй|добавь|запусти|проверь|давай)\b/i },
  { speechAct: 'question', intent: 'ask_information', test: /\?|\b(что|как|почему|можем|можно ли)\b/i }
];

const ENTITY_PATTERNS = [
  ['Djbrain', /\b(djbrain|мозг)\b/i],
  ['Codex', /\b(кодекс|codex)\b/i],
  ['backend', /\b(бэкенд|backend)\b/i],
  ['visual', /\b(визуал|интерфейс|3d)\b/i],
  ['data_pipeline', /\b(данн|корпус|архив|dataset|pipeline)\b/i]
];

export function interpretMessage(input) {
  const text = typeof input === 'string' ? input : input.text;
  const rule = RULES.find((candidate) => candidate.test.test(text)) ?? {
    speechAct: 'statement',
    intent: 'share_information'
  };

  const entities = ENTITY_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const decisions = rule.speechAct === 'decision' ? [normalizeDecision(text)] : [];
  const corrections = rule.speechAct === 'correction' ? [text.trim()] : [];
  const explicitRequests = ['request', 'decision'].includes(rule.speechAct) ? [text.trim()] : [];

  return createCognitiveEvent({
    ...(typeof input === 'object' ? input : {}),
    text,
    language: detectLanguage(text),
    speechAct: rule.speechAct,
    intent: rule.intent,
    entities,
    explicitRequests,
    decisions,
    corrections,
    tone: detectTone(text),
    confidence: rule.speechAct === 'statement' ? 0.62 : 0.84
  });
}

function detectLanguage(text) {
  const cyrillic = (text.match(/[а-яё]/gi) ?? []).length;
  const latin = (text.match(/[a-z]/gi) ?? []).length;
  return cyrillic > latin ? 'ru' : latin > 0 ? 'en' : 'und';
}

function detectTone(text) {
  if (/!{2,}|\b(нахуя|бляд|хули|ебан|тупорыл)\b/i.test(text)) return 'intense_direct';
  if (/\b(отлично|прикольно|круто)\b/i.test(text)) return 'positive';
  return 'direct';
}

function normalizeDecision(text) {
  return text.trim().replace(/\s+/g, ' ');
}
