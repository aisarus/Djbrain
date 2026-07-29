import { createCognitiveEvent } from '../contracts/cognitive-event.js';

const RULES = [
  {
    speechAct: 'correction',
    intent: 'correct_previous_behavior',
    priority: 100,
    test: /\b(нет|не так|ошиб\p{L}*|исправ\p{L}*|я имел в виду|не надо|перестань|хватит|не останавливайся|не повторяй|не делай снова)\b/iu
  },
  {
    speechAct: 'decision',
    intent: 'set_project_direction',
    priority: 90,
    test: /\b(решил\p{L}*|делаем|начинаем|приступаем|замораживаем|надо делать|давай выполнять|переходим|фокусируемся)\b/iu
  },
  {
    speechAct: 'request',
    intent: 'request_action',
    priority: 80,
    test: /\b(сделай|дай|построй|строй|добавь|запусти|проверь|продолжай|ебашь|ебашить|используй|покажи|расскажи|обсуди|угадай|давай)\b/iu
  },
  {
    speechAct: 'question',
    intent: 'ask_information',
    priority: 70,
    test: /\?|\b(что|как|почему|можем|можно ли|зачем|когда|где|кто|какой|какая|какие|сколько)\b/iu
  },
  {
    speechAct: 'feedback',
    intent: 'evaluate_previous_output',
    priority: 60,
    test: /\b(хорошо|плохо|норм|отлично|прикольно|неплохо|ужасно|полезнее|лучше|хуже)\b/iu
  }
];

const ENTITY_PATTERNS = [
  ['Djbrain', /\b(djbrain|цифровой мозг|мозг)\b/i],
  ['Codex', /\b(кодекс|codex)\b/i],
  ['backend', /\b(бэкенд|backend|runtime|сервер)\b/i],
  ['visual', /\b(визуал|интерфейс|3d|three\.js|сайт)\b/i],
  ['data_pipeline', /\b(данн\p{L}*|корпус|архив|dataset|pipeline|разметк\p{L}*|json)\b/iu],
  ['working_memory', /\b(рабочая память|working memory)\b/i],
  ['episodic_memory', /\b(эпизодическ\p{L}*|episodic memory)\b/iu],
  ['identity_core', /\b(identity core|ядро идентичности|личностн\p{L}*\s+ядр\p{L}*)\b/iu],
  ['memory_router', /\b(memory router|маршрутизатор памяти|retrieval)\b/i]
];

export function interpretMessage(input) {
  const text = typeof input === 'string' ? input : input.text;
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('input text is required');

  const rule = RULES
    .filter((candidate) => candidate.test.test(text))
    .sort((a, b) => b.priority - a.priority)[0] ?? {
      speechAct: 'statement',
      intent: 'share_information',
      priority: 0
    };

  const entities = ENTITY_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);

  const decisions = rule.speechAct === 'decision' ? [normalizeText(text)] : [];
  const corrections = rule.speechAct === 'correction' ? [normalizeText(text)] : [];
  const explicitRequests = ['request', 'decision'].includes(rule.speechAct) ? [normalizeText(text)] : [];
  const modifiers = detectModifiers(text);

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
    confidence: calculateConfidence(rule, entities, modifiers),
    metadata: {
      ...(typeof input === 'object' ? input.metadata : {}),
      negated: modifiers.negated,
      urgency: modifiers.urgency,
      literalness: modifiers.literalness,
      ambiguityFlags: modifiers.ambiguityFlags
    }
  });
}

function detectLanguage(text) {
  const cyrillic = (text.match(/[а-яё]/gi) ?? []).length;
  const latin = (text.match(/[a-z]/gi) ?? []).length;
  const hebrew = (text.match(/[\u0590-\u05FF]/g) ?? []).length;
  const total = cyrillic + latin + hebrew;
  if (total === 0) return 'und';
  const shares = { ru: cyrillic / total, en: latin / total, he: hebrew / total };
  const sorted = Object.entries(shares).sort((a, b) => b[1] - a[1]);
  if (sorted[1][1] >= 0.2) return 'mixed';
  return sorted[0][0];
}

function detectTone(text) {
  if (/!{2,}|\b(нахуя|бляд\p{L}*|хули|ебан\p{L}*|тупорыл\p{L}*|ебаш\p{L}*)\b/iu.test(text)) return 'intense_direct';
  if (/\b(отлично|прикольно|круто|супер)\b/i.test(text)) return 'positive';
  if (/\b(пожалуйста|будь добр|можешь ли)\b/i.test(text)) return 'polite';
  return 'direct';
}

function detectModifiers(text) {
  const ambiguityFlags = [];
  const quoted = /[«“"].+[»”"]/.test(text);
  const ironyCue = /\b(ага конечно|ну да конечно|смешно|лол|сарказм)\b/i.test(text);
  if (quoted) ambiguityFlags.push('contains_quote');
  if (ironyCue) ambiguityFlags.push('possible_irony');
  return {
    negated: /\b(не|нет|никогда|ни за что)\b/i.test(text),
    urgency: /!{2,}|\b(срочно|сейчас|немедленно|быстро)\b/i.test(text) ? 'high' : 'normal',
    literalness: ironyCue ? 'uncertain' : 'likely_literal',
    ambiguityFlags
  };
}

function calculateConfidence(rule, entities, modifiers) {
  let score = rule.speechAct === 'statement' ? 0.58 : 0.82;
  if (entities.length > 0) score += 0.06;
  if (modifiers.ambiguityFlags.length > 0) score -= 0.18;
  return Number(Math.max(0.35, Math.min(0.96, score)).toFixed(2));
}

function normalizeText(text) {
  return text.trim().replace(/\s+/g, ' ');
}
