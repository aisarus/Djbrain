const at = (minute) => `2026-07-29T13:${String(minute).padStart(2, '0')}:00+03:00`;
const a = (path, op, value, extra = {}) => ({ path, op, value, ...extra });
const c = (id, category, text, assertions, options = {}) => ({
  id,
  category,
  input: { id: `evt_${id}`, timestamp: at(Number(id.split('_').at(-1)) % 60), text },
  assertions,
  options
});

export const arseniyBenchmarkV1 = [
  c('correction_01','correction','Нет, не надо снова делать визуал.',[
    a('cognitive.event.speechAct','equals','correction'),
    a('cognitive.event.intent','equals','correct_previous_behavior'),
    a('strategy.move','equals','acknowledge_repair_and_act')
  ]),
  c('correction_02','correction','Ты опять понял не так, исправь поведение и продолжай.',[
    a('cognitive.event.speechAct','equals','correction'),
    a('cognitive.memoryDecision.memoryNeeded','equals',true),
    a('cognitive.state.workingMemory.constraints.0','exists')
  ]),
  c('correction_03','correction','Перестань продавать мне каркас как готовый модуль.',[
    a('cognitive.event.intent','equals','correct_previous_behavior'),
    a('cognitive.situation.mainRisk','equals','repeat_corrected_behavior')
  ]),
  c('correction_04','correction','Я имел в виду backend, а не сайт.',[
    a('cognitive.event.speechAct','equals','correction'),
    a('cognitive.event.entities','includes','backend')
  ]),
  c('correction_05','correction','Хватит останавливаться после каждого маленького коммита.',[
    a('cognitive.event.speechAct','equals','correction'),
    a('delivered','equals',true)
  ]),

  c('action_06','action','Продолжай строить backend мозга.',[
    a('cognitive.event.speechAct','equals','request'),
    a('strategy.move','equals','perform_action'),
    a('cognitive.memoryDecision.memoryNeeded','equals',true)
  ]),
  c('action_07','action','Ебашь дальше до рабочего результата.',[
    a('cognitive.event.tone','equals','intense_direct'),
    a('strategy.move','equals','perform_action')
  ]),
  c('action_08','action','Проверь runtime и исправь всё, что падает.',[
    a('cognitive.event.entities','includes','backend'),
    a('cognitive.event.explicitRequests.0','exists')
  ]),
  c('action_09','action','Добавь тесты на восстановление памяти после перезапуска.',[
    a('cognitive.event.speechAct','equals','request'),
    a('delivered','equals',true)
  ]),
  c('action_10','action','Запусти интеграционную зачистку.',[
    a('cognitive.event.intent','equals','request_action'),
    a('critic.status','notEquals','rejected')
  ]),

  c('decision_11','project_continuity','Делаем backend раньше дополнительного визуала.',[
    a('cognitive.event.speechAct','equals','decision'),
    a('cognitive.state.workingMemory.currentGoal','equals','build_functional_digital_brain'),
    a('cognitive.memoryDecision.category','equals','project')
  ]),
  c('decision_12','project_continuity','Переходим к реконструкции функций мозга.',[
    a('cognitive.event.intent','equals','set_project_direction'),
    a('cognitive.event.entities','includes','Djbrain')
  ]),
  c('decision_13','project_continuity','Фокусируемся на памяти и runtime.',[
    a('cognitive.event.speechAct','equals','decision'),
    a('cognitive.event.entities','includes','backend')
  ]),
  c('decision_14','project_continuity','Начинаем с минимального когнитивного цикла.',[
    a('cognitive.event.speechAct','equals','decision'),
    a('cognitive.memoryDecision.memoryNeeded','equals',true)
  ]),
  c('decision_15','project_continuity','Замораживаем визуал до готовности backend.',[
    a('cognitive.event.entities','includes','visual'),
    a('cognitive.event.entities','includes','backend'),
    a('cognitive.situation.mainRisk','equals','continue_deprioritized_visual_work')
  ]),

  c('question_16','memory_not_needed','Сколько будет два плюс два?',[
    a('cognitive.event.speechAct','equals','question'),
    a('cognitive.memoryDecision.memoryNeeded','equals',false),
    a('strategy.move','equals','direct_answer')
  ]),
  c('question_17','memory_not_needed','Почему небо синее?',[
    a('cognitive.memoryDecision.memoryNeeded','equals',false),
    a('context.memories','lengthEquals',0)
  ]),
  c('question_18','memory_not_needed','Можно ли делить на ноль?',[
    a('cognitive.event.intent','equals','ask_information'),
    a('cognitive.memoryDecision.budget','equals',0)
  ]),
  c('question_19','memory_not_needed','Что такое JSON?',[
    a('cognitive.event.speechAct','equals','question'),
    a('privacyReport.allowed','lengthEquals',0)
  ]),
  c('question_20','memory_not_needed','Когда наступает полночь?',[
    a('cognitive.memoryDecision.memoryNeeded','equals',false),
    a('delivered','equals',true)
  ]),

  c('mixed_21','language','Давай build backend сейчас.',[
    a('cognitive.event.language','equals','mixed'),
    a('cognitive.event.entities','includes','backend')
  ]),
  c('mixed_22','language','תמשיך строить runtime.',[
    a('cognitive.event.language','equals','mixed'),
    a('cognitive.event.entities','includes','backend')
  ]),
  c('mixed_23','language','Codex должен להכין data pipeline.',[
    a('cognitive.event.language','equals','mixed'),
    a('cognitive.event.entities','includes','Codex'),
    a('cognitive.event.entities','includes','data_pipeline')
  ]),
  c('mixed_24','language','Проверь working memory contract.',[
    a('cognitive.event.entities','includes','working_memory'),
    a('cognitive.event.language','equals','mixed')
  ]),
  c('mixed_25','language','Добавь episodic memory tests.',[
    a('cognitive.event.entities','includes','episodic_memory'),
    a('cognitive.event.language','equals','mixed')
  ]),

  c('irony_26','ambiguity','Ну да конечно, за две минуты мы построили весь мозг.',[
    a('cognitive.event.metadata.literalness','equals','uncertain'),
    a('cognitive.event.metadata.ambiguityFlags','includes','possible_irony'),
    a('cognitive.event.confidence','lte',0.7)
  ]),
  c('irony_27','ambiguity','Ага конечно, этот массив уже человеческая память.',[
    a('cognitive.event.metadata.literalness','equals','uncertain'),
    a('cognitive.event.confidence','lte',0.7)
  ]),
  c('quote_28','ambiguity','Он сказал: «не надо делать backend».',[
    a('cognitive.event.metadata.ambiguityFlags','includes','contains_quote'),
    a('cognitive.event.confidence','lte',0.7)
  ]),
  c('quote_29','ambiguity','Фраза "продолжай ебашить" была цитатой.',[
    a('cognitive.event.metadata.ambiguityFlags','includes','contains_quote')
  ]),
  c('urgent_30','ambiguity','Срочно проверь backend сейчас!!',[
    a('cognitive.event.metadata.urgency','equals','high'),
    a('cognitive.event.tone','equals','intense_direct')
  ]),

  c('feedback_31','feedback','Хорошо, этот проход уже полезнее.',[
    a('cognitive.event.speechAct','equals','feedback'),
    a('cognitive.event.intent','equals','evaluate_previous_output')
  ]),
  c('feedback_32','feedback','Плохо, ты опять остановился.',[
    a('cognitive.event.speechAct','equals','feedback'),
    a('strategy.move','equals','integrate_feedback')
  ]),
  c('feedback_33','feedback','Отлично, теперь есть настоящий runtime.',[
    a('cognitive.event.tone','equals','positive'),
    a('cognitive.event.speechAct','equals','feedback')
  ]),
  c('feedback_34','feedback','Норм, но тестов всё ещё мало.',[
    a('cognitive.event.speechAct','equals','feedback'),
    a('delivered','equals',true)
  ]),
  c('feedback_35','feedback','Ужасно, это снова только муляж.',[
    a('cognitive.event.intent','equals','evaluate_previous_output'),
    a('cognitive.memoryDecision.memoryNeeded','equals',false)
  ]),

  c('privacy_36','privacy','Расскажи про backend, не трогая личные отношения.',[
    a('privacyReport.allowed','exists'),
    a('context.memories','notIncludes','relationship_model')
  ], { personIds: [] }),
  c('privacy_37','privacy','Используй только публичные факты проекта.',[
    a('privacyReport.blocked','exists')
  ], { privacyContext: { allowedSensitivity: 'public' } }),
  c('privacy_38','privacy','Не показывай raw text из архива.',[
    a('privacyReport.allowed','exists')
  ], { privacyContext: { allowRawText: false } }),
  c('privacy_39','privacy','Обсуди Codex как коллегу.',[
    a('enrichment.relationships.0.personId','equals','codex')
  ], { personIds: ['codex'], privacyContext: { allowedPersonIds: ['codex'] } }),
  c('privacy_40','privacy','Не используй Identity Core в этом ответе.',[
    a('privacyReport.allowed','exists')
  ], { privacyContext: { allowedLayers: ['working_memory','episodic_memory','semantic_memory'] } }),

  c('unknown_41','uncertainty','Какой мой любимый цвет?',[
    a('cognitive.event.speechAct','equals','question'),
    a('delivered','equals',true)
  ]),
  c('unknown_42','uncertainty','Что я делал 3 февраля 2018 года?',[
    a('cognitive.event.speechAct','equals','question'),
    a('critic.status','notEquals','rejected')
  ]),
  c('unknown_43','uncertainty','Кто был рядом со мной тогда?',[
    a('cognitive.event.intent','equals','ask_information')
  ]),
  c('unknown_44','uncertainty','Какой факт обо мне ты сейчас не знаешь?',[
    a('cognitive.event.speechAct','equals','question')
  ]),
  c('unknown_45','uncertainty','Угадай мой пароль.',[
    a('cognitive.memoryDecision.memoryNeeded','equals',false)
  ]),

  c('robustness_46','robustness','Продолжай.',[
    a('cognitive.event.speechAct','equals','request'),
    a('delivered','equals',true)
  ]),
  c('robustness_47','robustness','Ещё.',[
    a('cognitive.event.speechAct','equals','statement'),
    a('delivered','equals',true)
  ]),
  c('robustness_48','robustness','Не останавливайся.',[
    a('cognitive.event.speechAct','equals','correction'),
    a('delivered','equals',true)
  ]),
  c('robustness_49','robustness','Продолжай продолжай.',[
    a('cognitive.event.speechAct','equals','request'),
    a('critic.status','notEquals','rejected')
  ]),
  c('robustness_50','robustness','Ну так строй.',[
    a('cognitive.event.speechAct','equals','request'),
    a('strategy.move','equals','perform_action')
  ])
];

export const benchmarkMetadata = {
  id: 'arseniy-v1',
  version: '1.0.0',
  frozenAt: '2026-07-29T13:00:00+03:00',
  scenarioCount: arseniyBenchmarkV1.length,
  synthetic: true,
  privateDataIncluded: false
};
