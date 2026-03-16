import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import Draco from '../src';

const RAW_CARS = require('./data/cars.json');
const QRCode = require('qrcode');
const FLOW_VIDEO_MP4 = require('./media/draco-operation-demo.mp4');
const FLOW_VIDEO_POSTER = require('./media/draco-operation-demo-poster.png');
const SOLVER_URL = 'https://unpkg.com/wasm-clingo@0.3.0';
const VOTE_SOCKET_PORT = 8787;
const VOTE_POLL_INTERVAL = 1200;

function normalizeKey(key: string) {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeRow(row: any) {
  const normalized: any = {};
  Object.keys(row).forEach(function mapKey(key) {
    normalized[normalizeKey(key)] = row[key];
  });
  return normalized;
}

const CARS_DATA = RAW_CARS.map(normalizeRow);

function fieldCardinality(field: string) {
  const values: { [value: string]: boolean } = {};

  CARS_DATA.forEach(function collect(row: any) {
    const value = row[field];
    if (value !== null && value !== undefined && value !== '') {
      values[String(value)] = true;
    }
  });

  return Object.keys(values).length;
}

function fieldType(field: string) {
  const value = CARS_DATA[0][field];
  return typeof value === 'number' ? 'number' : 'string';
}

function createProgram(fields: string[], queryLines: string[]) {
  const lines = ['% ====== Data definitions ======', 'data("cars.json").', `num_rows(${CARS_DATA.length}).`, ''];

  fields.forEach(function appendField(field) {
    lines.push(`fieldtype(${field},${fieldType(field)}).`);
    lines.push(`cardinality(${field},${fieldCardinality(field)}).`);
    lines.push('');
  });

  lines.push('% ====== Query constraints ======');
  queryLines.forEach(function appendQuery(line) {
    lines.push(line);
  });

  return lines.join('\n');
}

function createSessionId() {
  return Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();
}

function getOrCreateAudienceClientId() {
  const key = 'draco-discussion-client-id';
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const next = `client-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(key, next);
  return next;
}

const EXAMPLES: { [name: string]: { label: string; description: string; program: string } } = {
  scatter: {
    label: 'scatter',
    description: 'Scatter example with two quantitative encodings.',
    program: createProgram(['horsepower', 'acceleration'], [
      'encoding(e0).',
      ':- not field(e0,acceleration).',
      '',
      'encoding(e1).',
      ':- not field(e1,horsepower).',
    ]),
  },
  histogram: {
    label: 'histogram',
    description: 'Histogram example that asks Draco to bin horsepower.',
    program: createProgram(['horsepower'], ['encoding(e0).', ':- not field(e0,horsepower).', ':- not bin(e0,_).']),
  },
  strip: {
    label: 'strip',
    description: 'Strip plot example with a fixed quantitative field.',
    program: createProgram(['horsepower'], ['encoding(e0).', ':- not type(e0,quantitative).', ':- not field(e0,horsepower).']),
  },
};

type DiscussionStage = {
  kind?: 'quiz' | 'closing';
  title: string;
  question: string;
  choices: string[];
  correctIndex: number;
  answerTitle: string;
  answerBody: string;
  demoTitle: string;
  demoBase: string;
  demoInsert: string;
  demoMode: 'single' | 'grid';
  closingTitle?: string;
  closingBody?: string;
};

const DISCUSSION_STAGES: DiscussionStage[] = [
  {
    title: 'What Does Draco Actually Do?',
    question: 'In the paper, what is Draco’s core technical move?',
    choices: [
      'It directly learns the best chart template from raw datasets.',
      'It turns an incomplete visualization specification into a weighted constraint search problem.',
      'It mostly acts as a Vega-Lite renderer with a faster backend.',
      'It works mainly as a crowdsourced chart-rating interface for visualization examples.',
    ],
    correctIndex: 1,
    answerTitle: 'Correct answer: Draco reframes recommendation as weighted constraint search.',
    answerBody:
      'The paper’s real center is not “Draco always finds the perfect chart”. It is that design knowledge becomes explicit hard and soft constraints, and an incomplete spec becomes a search over admissible completions.',
    demoTitle: 'Demo 1 · Partial Spec Completion',
    demoBase: EXAMPLES.scatter.program,
    demoInsert: '',
    demoMode: 'single',
  },
  {
    title: 'Why Separate Hard And Soft Constraints?',
    question: 'Why does the paper separate hard constraints from soft constraints?',
    choices: [
      'Because ASP can only optimize soft constraints after a rendering pass.',
      'Because hard constraints define validity, while soft constraints rank the valid candidates that remain.',
      'Because hard constraints are learned from user studies, while soft constraints are handwritten.',
      'Because hard constraints only affect speed, while soft constraints affect correctness.',
    ],
    correctIndex: 1,
    answerTitle: 'Correct answer: Draco separates validity from preference.',
    answerBody:
      'Hard constraints define whether a visualization is admissible at all. Soft constraints only apply after that, expressing trade-offs among legal candidates. That separation is what lets Draco both reject bad designs and still rank multiple valid ones.',
    demoTitle: 'Demo 2 · Validity Versus Preference',
    demoBase: EXAMPLES.scatter.program,
    demoInsert: '',
    demoMode: 'grid',
  },
  {
    title: 'What Changes When You Add One Constraint?',
    question: 'If we add `:- not bin(e0,_).`, what is the best way to interpret the result?',
    choices: [
      'It only reorders the same candidate charts without changing the design space.',
      'It changes the feasible design space and pushes Draco toward a different family of solutions.',
      'It changes the dataset statistics, so the solver learns a new preference model.',
      'It only changes chart styling while leaving the logical specification untouched.',
    ],
    correctIndex: 1,
    answerTitle: 'Correct answer: one extra rule changes the admissible solution space.',
    answerBody:
      'This is the extensibility argument in miniature. You are not hand-editing a scoring heuristic buried in imperative code; you are adding a new declarative condition that changes which completions survive.',
    demoTitle: 'Demo 3 · One-Line Constraint Shift',
    demoBase: EXAMPLES.scatter.program,
    demoInsert: ':- not bin(e0,_).',
    demoMode: 'grid',
  },
  {
    title: 'What Do Learned Weights Actually Learn?',
    question: 'In the paper, what do learned weights most directly control?',
    choices: [
      'They decide which visualization constraints exist in the language.',
      'They decide how expensive different soft-constraint violations are relative to each other.',
      'They decide the Vega-Lite grammar and mark syntax.',
      'They decide which fields are present in the dataset before search begins.',
    ],
    correctIndex: 1,
    answerTitle: 'Correct answer: learned weights adjust the trade-offs among soft constraints.',
    answerBody:
      'The weights do not invent new rules or change the grammar. They change ranking by saying which soft violations cost more, which is why multiple legal charts can still appear in different orders.',
    demoTitle: 'Demo 4 · Cost And Ranking',
    demoBase: EXAMPLES.scatter.program,
    demoInsert: '',
    demoMode: 'grid',
  },
  {
    title: 'Why Show More Than One Answer?',
    question: 'Why is it useful to show Draco’s top-k recommendations instead of only one chart?',
    choices: [
      'Because the solver is too weak to commit to a single result.',
      'Because optimal only means optimal under the encoded preferences, so nearby alternatives still matter.',
      'Because users always prefer more visual variety, regardless of quality.',
      'Because the paper’s interface would look incomplete with only one chart on screen.',
    ],
    correctIndex: 1,
    answerTitle: 'Correct answer: top-k results expose the limits of the encoded preference model.',
    answerBody:
      'The paper is careful here: optimal does not mean universally correct. Showing several candidates helps the class see both the strength and the boundary of the current model.',
    demoTitle: 'Demo 5 · Top-K Instead Of One True Chart',
    demoBase: EXAMPLES.scatter.program,
    demoInsert: '',
    demoMode: 'grid',
  },
  {
    title: 'What Happens When the Input Conflicts?',
    question: 'If we force `origin` to be quantitative in this tiny example, what does the current system really demonstrate?',
    choices: [
      'It already behaves like a smart spell checker that automatically repairs the chart for you.',
      'It behaves like a constraint solver that can fail cleanly, but still needs an explanation layer on top.',
      'It infers the user’s true intent and silently rewrites the query.',
      'It falls back to the nearest nominal encoding and hides the conflict from the user.',
    ],
    correctIndex: 1,
    answerTitle: 'Correct answer: Draco can surface failure, but explanation remains a separate problem.',
    answerBody:
      'The paper explicitly mentions spell checking and auto-correction as future directions. This means the current contribution is stronger on synthesis and validation than on human-readable explanation.',
    demoTitle: 'Demo 6 · Break The Spec On Purpose',
    demoBase: createProgram(['origin'], ['encoding(e0).', ':- not field(e0,origin).']),
    demoInsert: ':- not type(e0,quantitative).',
    demoMode: 'single',
  },
  {
    title: 'What Would It Take To Extend Draco?',
    question: 'If you wanted Draco to work well in a different visualization domain, what is the main thing you would need to add?',
    choices: [
      'A different Vega renderer, because the knowledge model is already universal.',
      'A larger benchmark dataset, because more data alone removes the need for new rules.',
      'New explicit domain knowledge encoded as constraints, plus updated preference weights if needed.',
      'Only softer constraints, because hard constraints do not transfer across domains.',
    ],
    correctIndex: 2,
    answerTitle: 'Correct answer: extending Draco means encoding new domain knowledge, not just swapping the renderer.',
    answerBody:
      'The reusable idea is the formal framework. What still takes work is translating a new domain’s design knowledge into explicit rules and, when necessary, relearning preference weights for that domain.',
    demoTitle: 'Demo 7 · Extending The Knowledge Base',
    demoBase: EXAMPLES.scatter.program,
    demoInsert: ':- not bin(e0,_).',
    demoMode: 'grid',
  },
  {
    title: 'What Does The CompassQL Comparison Actually Prove?',
    question: 'What is the strongest fair claim from the paper’s comparison to CompassQL?',
    choices: [
      'Draco proves that its charts are always more accurate for end users.',
      'Draco shows this class of preference model can be expressed and searched more transparently and flexibly.',
      'Draco proves imperative recommendation systems should no longer be used.',
      'Draco proves ASP is universally faster than every other recommendation approach on every task.',
    ],
    correctIndex: 1,
    answerTitle: 'Correct answer: the comparison is strongest on representation and extensibility, not universal user superiority.',
    answerBody:
      'The convincing part of the paper is that visualization knowledge is made explicit, testable, and easy to extend. That is a stronger and cleaner claim than saying Draco has solved the final end-user evaluation question.',
    demoTitle: 'Demo 8 · Declarative Editability',
    demoBase: EXAMPLES.scatter.program,
    demoInsert: ':- not bin(e0,_).',
    demoMode: 'grid',
  },
  {
    kind: 'closing',
    title: 'Discussion End',
    question: 'Any final questions?',
    choices: [],
    correctIndex: -1,
    answerTitle: '',
    answerBody: '',
    demoTitle: '',
    demoBase: EXAMPLES.scatter.program,
    demoInsert: '',
    demoMode: 'single',
    closingTitle: 'Any final questions?',
    closingBody: 'If there are no more questions, use the Draco flow video below to recap the paper from input to output.',
  },
];

const editor = document.getElementById('query-editor') as HTMLTextAreaElement;
const lineNumbers = document.getElementById('line-numbers') as HTMLElement;
const datasetMeta = document.getElementById('dataset-meta') as HTMLElement;
const fieldCluster = document.getElementById('field-cluster') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const exampleCaption = document.getElementById('example-caption') as HTMLElement;
const selectionMeta = document.getElementById('selection-meta') as HTMLElement;
const runButton = document.getElementById('run-button') as HTMLButtonElement;
const examplesButton = document.getElementById('examples-button') as HTMLButtonElement;
const optionsButton = document.getElementById('options-button') as HTMLButtonElement;
const examplesMenu = document.getElementById('examples-menu') as HTMLElement;
const optionsMenu = document.getElementById('options-menu') as HTMLElement;
const modelCountInput = document.getElementById('model-count') as HTMLInputElement;
const singleStage = document.getElementById('single-stage') as HTMLElement;
const gridStage = document.getElementById('grid-stage') as HTMLElement;
const costRail = document.getElementById('cost-rail') as HTMLElement;
const jsonTree = document.getElementById('json-tree') as HTMLElement;
const viewMode = document.getElementById('view-mode') as HTMLElement;
const singleButton = document.getElementById('single-button') as HTMLButtonElement;
const gridButton = document.getElementById('grid-button') as HTMLButtonElement;
const modeReadout = document.getElementById('mode-readout') as HTMLElement;
const appMode = document.getElementById('app-mode') as HTMLElement;
const studioModeButton = document.getElementById('studio-mode-button') as HTMLButtonElement;
const discussionModeButton = document.getElementById('discussion-mode-button') as HTMLButtonElement;
const studioWorkspace = document.getElementById('studio-workspace') as HTMLElement;
const discussionWorkspace = document.getElementById('discussion-workspace') as HTMLElement;
const discussionStageList = document.getElementById('discussion-stage-list') as HTMLElement;
const discussionPrev = document.getElementById('discussion-prev') as HTMLButtonElement;
const discussionNext = document.getElementById('discussion-next') as HTMLButtonElement;
const discussionProgress = document.getElementById('discussion-progress') as HTMLElement;
const discussionStageTitle = document.getElementById('discussion-stage-title') as HTMLElement;
const discussionQuestionStepLabel = document.getElementById('discussion-question-step-label') as HTMLElement;
const discussionQuestionBlock = document.getElementById('discussion-question-block') as HTMLElement;
const discussionQuestion = document.getElementById('discussion-question') as HTMLElement;
const discussionChoiceList = document.getElementById('discussion-choice-list') as HTMLElement;
const discussionAudienceStatus = document.getElementById('discussion-audience-status') as HTMLElement;
const discussionVoteShell = document.getElementById('discussion-vote-shell') as HTMLElement;
const discussionVoteTotal = document.getElementById('discussion-vote-total') as HTMLElement;
const discussionVoteQr = document.getElementById('discussion-vote-qr') as HTMLCanvasElement;
const discussionVoteMeta = document.getElementById('discussion-vote-meta') as HTMLElement;
const discussionVoteLink = document.getElementById('discussion-vote-link') as HTMLAnchorElement;
const discussionVoteList = document.getElementById('discussion-vote-list') as HTMLElement;
const discussionResetVotes = document.getElementById('discussion-reset-votes') as HTMLButtonElement;
const discussionAnswerActions = document.getElementById('discussion-answer-actions') as HTMLElement;
const discussionRevealAnswer = document.getElementById('discussion-reveal-answer') as HTMLButtonElement;
const discussionResetAnswer = document.getElementById('discussion-reset-answer') as HTMLButtonElement;
const discussionAnswerBlock = document.getElementById('discussion-answer-block') as HTMLElement;
const discussionAnswerStatus = document.getElementById('discussion-answer-status') as HTMLElement;
const discussionAnswerTitle = document.getElementById('discussion-answer-title') as HTMLElement;
const discussionAnswerBody = document.getElementById('discussion-answer-body') as HTMLElement;
const discussionDemoBlock = document.getElementById('discussion-demo-block') as HTMLElement;
const discussionDemoTitle = document.getElementById('discussion-demo-title') as HTMLElement;
const discussionDemoBase = document.getElementById('discussion-demo-base') as HTMLTextAreaElement;
const discussionDemoInsert = document.getElementById('discussion-demo-insert') as HTMLTextAreaElement;
const discussionLoadDemo = document.getElementById('discussion-load-demo') as HTMLButtonElement;
const discussionRunDemo = document.getElementById('discussion-run-demo') as HTMLButtonElement;
const discussionResetDemo = document.getElementById('discussion-reset-demo') as HTMLButtonElement;
const discussionVoteResultBlock = document.getElementById('discussion-vote-result-block') as HTMLElement;
const discussionClosingBlock = document.getElementById('discussion-closing-block') as HTMLElement;
const discussionClosingTitle = document.getElementById('discussion-closing-title') as HTMLElement;
const discussionClosingBody = document.getElementById('discussion-closing-body') as HTMLElement;
const discussionFlowBlock = document.getElementById('discussion-flow-block') as HTMLElement;
const discussionFlowVideo = document.getElementById('discussion-flow-video') as HTMLVideoElement;
const searchParams = new URLSearchParams(window.location.search);
const currentAudienceMode = searchParams.get('audience') === '1';
const voteSessionId = searchParams.get('session') || createSessionId();
const audienceClientId = getOrCreateAudienceClientId();

let currentExample = 'scatter';
let currentMode = 'single';
let currentAppMode = currentAudienceMode ? 'discussion' : 'studio';
let currentDiscussionIndex = 0;
let solverReady = false;
let solverBusy = false;
let selectedResultIndex = 0;
let currentSolution: any = null;
let singleView: any = null;
let previewViews: any[] = [];
let voteSocket: WebSocket | null = null;
let voteSocketReady = false;
let voteTransportReady = false;
let voteLocalIp = '';
let voteAudienceCount = 0;
let votePollTimer = 0;
let closingStageVisible = false;
const discussionSelectedChoices = DISCUSSION_STAGES.map(function initChoice() {
  return -1;
});
const discussionAnswerRevealed = DISCUSSION_STAGES.map(function initReveal() {
  return false;
});
const discussionDemoInserts = DISCUSSION_STAGES.map(function initInsert(stage) {
  return stage.demoInsert;
});
const discussionVoteCounts = DISCUSSION_STAGES.map(function initVotes(stage) {
  return stage.choices.map(function initChoiceVotes() {
    return 0;
  });
});
const audienceVoteSelections = DISCUSSION_STAGES.map(function initAudienceChoice() {
  return -1;
});

const draco = new Draco(SOLVER_URL, function onStatus(text: string) {
  if (!text || text.indexOf('Received output on stderr.') === 0) {
    return;
  }
  setStatus(text, 'info');
});

function setStatus(text: string, tone: string = 'success') {
  statusEl.textContent = text;
  statusEl.setAttribute('data-tone', tone);
}

function setBusy(nextBusy: boolean) {
  solverBusy = nextBusy;
  runButton.disabled = nextBusy || !solverReady;
  modelCountInput.disabled = nextBusy || !solverReady;
}

function renderFieldCluster() {
  const visibleFields = ['horsepower', 'acceleration', 'origin', 'year'];
  fieldCluster.innerHTML = '';

  visibleFields.forEach(function renderField(field) {
    const chip = document.createElement('span');
    chip.className = 'field-chip';
    chip.textContent = `${field} · ${fieldCardinality(field)}`;
    fieldCluster.appendChild(chip);
  });
}

function updateLineNumbers() {
  const count = editor.value.split('\n').length;
  const fragment = document.createDocumentFragment();
  let index = 0;

  lineNumbers.innerHTML = '';
  for (index = 1; index <= count; index += 1) {
    const line = document.createElement('span');
    line.className = 'line-number';
    line.textContent = String(index);
    fragment.appendChild(line);
  }

  lineNumbers.appendChild(fragment);
}

function syncEditorScroll() {
  lineNumbers.scrollTop = editor.scrollTop;
}

function hidePopovers() {
  examplesMenu.classList.add('hidden');
  optionsMenu.classList.add('hidden');
}

function toggleMenu(target: string) {
  if (target === 'examples') {
    examplesMenu.classList.toggle('hidden');
    optionsMenu.classList.add('hidden');
  } else {
    optionsMenu.classList.toggle('hidden');
    examplesMenu.classList.add('hidden');
  }
}

function cleanupViews() {
  if (singleView && singleView.finalize) {
    singleView.finalize();
  }

  previewViews.forEach(function finalize(view) {
    if (view && view.finalize) {
      view.finalize();
    }
  });

  singleView = null;
  previewViews = [];
  singleStage.innerHTML = '';
  gridStage.innerHTML = '';
}

function cloneSpec(spec: any) {
  return JSON.parse(JSON.stringify(spec));
}

function createRenderableSpec(spec: any) {
  const renderSpec = cloneSpec(spec);
  renderSpec.data = { values: CARS_DATA };
  return renderSpec;
}

function buildView(container: HTMLElement, spec: any) {
  const compiled = (vegaLite as any).compile(createRenderableSpec(spec)).spec;
  const runtime = vega.parse(compiled);
  const view = new vega.View(runtime, {
    container: container as any,
    renderer: 'canvas',
    hover: true,
  });

  return view.runAsync().then(function afterRun() {
    return view;
  });
}

function selectedResult() {
  if (!currentSolution || !currentSolution.models || !currentSolution.models.length) {
    return null;
  }

  return {
    model: currentSolution.models[selectedResultIndex],
    spec: currentSolution.specs[selectedResultIndex],
    cost:
      currentSolution.models[selectedResultIndex].costs.length === 1
        ? currentSolution.models[selectedResultIndex].costs[0]
        : currentSolution.models[selectedResultIndex].costs.join(', '),
  };
}

function renderCostRail() {
  let index = 0;
  costRail.innerHTML = '';

  if (!currentSolution || !currentSolution.models || !currentSolution.models.length) {
    return;
  }

  for (index = 0; index < currentSolution.models.length; index += 1) {
    const chipIndex = index;
    const model = currentSolution.models[chipIndex];
    const chip = document.createElement('button');
    const costText = model.costs.join(', ');
    chip.type = 'button';
    chip.className = 'cost-chip';
    chip.textContent = chipIndex === selectedResultIndex ? `cost: ${costText}` : costText;
    chip.setAttribute('aria-label', `model ${chipIndex + 1}, cost ${costText}`);

    if (chipIndex === selectedResultIndex) {
      chip.classList.add('is-active');
    }

    chip.addEventListener('click', function onSelect() {
      selectResult(chipIndex);
    });

    costRail.appendChild(chip);
  }
}

function renderDiscussionTimeline() {
  discussionStageList.innerHTML = '';

  DISCUSSION_STAGES.forEach(function appendStage(stage, index) {
    const button = document.createElement('button');
    const title = document.createElement('span');

    button.type = 'button';
    button.className = 'discussion-stage-button';
    button.setAttribute('aria-label', stage.title);
    if (index === currentDiscussionIndex) {
      button.classList.add('is-active');
      button.setAttribute('aria-pressed', 'true');
    } else {
      button.setAttribute('aria-pressed', 'false');
    }

    title.className = 'discussion-stage-name';
    title.textContent = stage.title;

    button.appendChild(title);
    button.addEventListener('click', function onJump() {
      setDiscussionStage(index);
    });

    discussionStageList.appendChild(button);
  });
}

function currentDiscussionStage() {
  return DISCUSSION_STAGES[currentDiscussionIndex];
}

function isClosingDiscussionStage(stage: DiscussionStage = currentDiscussionStage()) {
  return stage.kind === 'closing';
}

function resetDiscussionFlowVideo(autoPlay: boolean = false) {
  discussionFlowVideo.currentTime = 0;

  if (autoPlay) {
    discussionFlowVideo.play().catch(function ignoreVideoPlayError() {
      return;
    });
  }
}

function pauseDiscussionFlowVideo() {
  discussionFlowVideo.pause();
}

function composeDiscussionDemoProgram() {
  const extra = discussionDemoInsert.value.trim();
  const base = currentDiscussionStage().demoBase;

  if (!extra) {
    return base;
  }

  return `${base}\n\n% ====== Demo insert ======\n${extra}\n`;
}

function renderDiscussionChoices() {
  const stage = currentDiscussionStage();
  const selected = currentAudienceMode ? audienceVoteSelections[currentDiscussionIndex] : discussionSelectedChoices[currentDiscussionIndex];
  const revealed = discussionAnswerRevealed[currentDiscussionIndex];

  discussionChoiceList.innerHTML = '';

  if (!stage.choices.length) {
    return;
  }

  stage.choices.forEach(function appendChoice(choice, index) {
    const button = document.createElement('button');
    const indexTag = document.createElement('span');
    const label = document.createElement('span');

    button.type = 'button';
    button.className = 'discussion-choice-button';
    button.disabled = currentAudienceMode ? !voteTransportReady : revealed;

    if (index === selected) {
      button.classList.add('is-selected');
    }

    if (!currentAudienceMode && revealed && index === stage.correctIndex) {
      button.classList.add('is-correct');
    }

    if (!currentAudienceMode && revealed && index === selected && index !== stage.correctIndex) {
      button.classList.add('is-wrong');
    }

    indexTag.className = 'discussion-choice-index';
    indexTag.textContent = String.fromCharCode(65 + index);
    label.className = 'discussion-choice-text';
    label.textContent = choice;

    button.appendChild(indexTag);
    button.appendChild(label);
    button.addEventListener('click', function onSelectChoice() {
      if (currentAudienceMode) {
        audienceVoteSelections[currentDiscussionIndex] = index;

        if (!voteTransportReady) {
          discussionAudienceStatus.textContent = 'Vote channel offline. Reconnect the page and try again.';
          renderDiscussionChoices();
          return;
        }

        sendVoteMessage({
          type: 'vote',
          sessionId: voteSessionId,
          clientId: audienceClientId,
          stageIndex: currentDiscussionIndex,
          choiceIndex: index,
        });

        discussionAudienceStatus.textContent = `Vote recorded for ${String.fromCharCode(65 + index)}.`;
        renderDiscussionChoices();
        return;
      }

      discussionSelectedChoices[currentDiscussionIndex] = index;
      renderDiscussionChoices();
    });

    discussionChoiceList.appendChild(button);
  });
}

function discussionVoteTotalForStage(index: number) {
  return discussionVoteCounts[index].reduce(function sumVotes(total, count) {
    return total + count;
  }, 0);
}

function replaceDiscussionVoteCounts(nextVoteCounts: number[][]) {
  DISCUSSION_STAGES.forEach(function syncStage(stage, stageIndex) {
    const stageVotes = nextVoteCounts[stageIndex] || [];

    stage.choices.forEach(function syncChoice(_choice, choiceIndex) {
      discussionVoteCounts[stageIndex][choiceIndex] = typeof stageVotes[choiceIndex] === 'number' ? stageVotes[choiceIndex] : 0;
    });
  });
}

function syncSessionUrl() {
  const nextParams = new URLSearchParams(window.location.search);
  nextParams.set('session', voteSessionId);

  if (currentAudienceMode) {
    nextParams.set('audience', '1');
  } else {
    nextParams.delete('audience');
  }

  const nextQuery = nextParams.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', nextUrl);
}

function resolveVoteSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:${VOTE_SOCKET_PORT}`;
}

function resolveVoteHttpUrl(path: string) {
  return `${window.location.protocol}//${window.location.hostname}:${VOTE_SOCKET_PORT}${path}`;
}

function resolveVoteJoinUrl() {
  const hostname =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? voteLocalIp : window.location.hostname;

  if (!hostname) {
    return '';
  }

  const port = window.location.port ? `:${window.location.port}` : '';
  return `${window.location.protocol}//${hostname}${port}${window.location.pathname}?audience=1&session=${encodeURIComponent(voteSessionId)}`;
}

function baseVoteMessage() {
  return {
    sessionId: voteSessionId,
    clientId: currentAudienceMode ? audienceClientId : `host-${voteSessionId}`,
    role: currentAudienceMode ? 'audience' : 'host',
  };
}

function markVoteTransportReady() {
  voteTransportReady = true;
  renderDiscussionChoices();
  renderVoteJoin();
}

function fetchVoteState() {
  const params = new URLSearchParams();

  params.set('sessionId', voteSessionId);
  params.set('clientId', currentAudienceMode ? audienceClientId : `host-${voteSessionId}`);

  return fetch(resolveVoteHttpUrl(`/state?${params.toString()}`))
    .then(function onResponse(response) {
      if (!response.ok) {
        throw new Error(`vote state ${response.status}`);
      }

      return response.json();
    })
    .then(function onState(message) {
      markVoteTransportReady();
      applyVoteState(message);
      return message;
    });
}

function postVoteMessage(payload: any) {
  return fetch(resolveVoteHttpUrl('/message'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(function onResponse(response) {
    if (!response.ok) {
      throw new Error(`vote message ${response.status}`);
    }

    return response.json();
  });
}

function sendVoteMessage(payload: any) {
  if (voteSocket && voteSocket.readyState === WebSocket.OPEN) {
    voteSocket.send(JSON.stringify(payload));
    return Promise.resolve(null);
  }

  return postVoteMessage(payload).then(function onState(message) {
    markVoteTransportReady();
    applyVoteState(message);
    return message;
  });
}

function scheduleVotePolling() {
  if (votePollTimer) {
    window.clearInterval(votePollTimer);
  }

  votePollTimer = window.setInterval(function pollVoteState() {
    fetchVoteState().catch(function onPollError() {
      if (currentAudienceMode) {
        discussionAudienceStatus.textContent = 'Connecting to the live poll…';
      }
    });
  }, VOTE_POLL_INTERVAL);
}

function renderVoteJoin() {
  const joinUrl = resolveVoteJoinUrl();
  const totalConnected = voteAudienceCount === 1 ? '1 phone connected' : `${voteAudienceCount} phones connected`;
  const qrContext = discussionVoteQr.getContext('2d');
  const hideJoin = currentAudienceMode || isClosingDiscussionStage();

  discussionVoteShell.classList.toggle('hidden', hideJoin);

  if (hideJoin) {
    return;
  }

  if (!voteTransportReady) {
    discussionVoteMeta.textContent = 'Connecting to the local vote channel…';
  } else if (!joinUrl) {
    discussionVoteMeta.textContent = `Vote channel ready · session ${voteSessionId} · waiting for LAN address`;
  } else {
    discussionVoteMeta.textContent = `${totalConnected} · session ${voteSessionId}`;
  }

  if (!joinUrl) {
    discussionVoteLink.textContent = 'Open with your local network address to generate the QR link.';
    discussionVoteLink.removeAttribute('href');
    if (qrContext) {
      qrContext.clearRect(0, 0, discussionVoteQr.width || 180, discussionVoteQr.height || 180);
    }
    return;
  }

  discussionVoteLink.href = joinUrl;
  discussionVoteLink.textContent = joinUrl.replace(/^https?:\/\//, '');
  QRCode.toCanvas(
    discussionVoteQr,
    joinUrl,
    {
      width: 176,
      margin: 1,
      color: {
        dark: '#1d1d1f',
        light: '#ffffff',
      },
    },
    function onQr(_error: Error | null) {
      return;
    }
  );
}

function applyVoteState(message: any) {
  if (message.localIp) {
    voteLocalIp = message.localIp;
  }

  if (typeof message.audienceCount === 'number') {
    voteAudienceCount = message.audienceCount;
  }

  if (Array.isArray(message.voteCounts)) {
    replaceDiscussionVoteCounts(message.voteCounts);
  }

  if (message.clientVotes && currentAudienceMode) {
    DISCUSSION_STAGES.forEach(function syncAudienceVote(_stage, stageIndex) {
      const value = message.clientVotes[String(stageIndex)];
      audienceVoteSelections[stageIndex] = typeof value === 'number' ? value : -1;
    });
  }

  if (currentAudienceMode && typeof message.stageIndex === 'number' && message.stageIndex !== currentDiscussionIndex) {
    setDiscussionStage(message.stageIndex, true);
  } else {
    renderDiscussionChoices();
    renderDiscussionVotes();
    renderVoteJoin();
  }

  if (currentAudienceMode && voteTransportReady) {
    discussionAudienceStatus.textContent = `Connected to session ${voteSessionId}.`;
  }
}

function syncVoteStage() {
  if (currentAudienceMode || !voteTransportReady) {
    return;
  }

  sendVoteMessage({
    ...baseVoteMessage(),
    type: 'host_sync',
    stageIndex: currentDiscussionIndex,
    choiceCounts: DISCUSSION_STAGES.map(function mapChoiceCounts(stage) {
      return stage.choices.length;
    }),
  });
}

function connectVoteChannel() {
  syncSessionUrl();
  renderVoteJoin();
  scheduleVotePolling();

  sendVoteMessage({
    ...baseVoteMessage(),
    type: 'join',
    stageIndex: currentDiscussionIndex,
    choiceCounts: DISCUSSION_STAGES.map(function mapChoiceCounts(stage) {
      return stage.choices.length;
    }),
  }).catch(function onJoinError() {
    if (currentAudienceMode) {
      discussionAudienceStatus.textContent = 'Connecting to the live poll…';
    }
  });

  voteSocket = new WebSocket(resolveVoteSocketUrl());

  voteSocket.addEventListener('open', function onOpen() {
    voteSocketReady = true;
    markVoteTransportReady();
    if (currentAudienceMode) {
      discussionAudienceStatus.textContent = 'Connected. Waiting for the current question…';
    }

    voteSocket!.send(
      JSON.stringify({
        ...baseVoteMessage(),
        type: 'join',
        stageIndex: currentDiscussionIndex,
        choiceCounts: DISCUSSION_STAGES.map(function mapChoiceCounts(stage) {
          return stage.choices.length;
        }),
      })
    );

    syncVoteStage();
    renderDiscussionChoices();
    renderVoteJoin();
  });

  voteSocket.addEventListener('message', function onMessage(event) {
    let message: any = null;

    try {
      message = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    if (!message || message.sessionId !== voteSessionId || message.type !== 'state') {
      return;
    }

    markVoteTransportReady();
    applyVoteState(message);
  });

  voteSocket.addEventListener('error', function onError() {
    fetchVoteState().catch(function ignoreError() {
      return;
    });
  });

  voteSocket.addEventListener('close', function onClose() {
    voteSocketReady = false;

    if (!voteTransportReady) {
      voteAudienceCount = 0;
      renderDiscussionChoices();
      renderVoteJoin();
    }

    if (currentAudienceMode) {
      discussionAudienceStatus.textContent = 'Connecting to the live poll…';
    }

    window.setTimeout(connectVoteChannel, 1500);
  });
}

function resetDiscussionVotes() {
  discussionVoteCounts[currentDiscussionIndex] = currentDiscussionStage().choices.map(function clearVotes() {
    return 0;
  });
  renderDiscussionVotes();

  if (!currentAudienceMode) {
    sendVoteMessage({
      type: 'reset_votes',
      sessionId: voteSessionId,
      clientId: `host-${voteSessionId}`,
      stageIndex: currentDiscussionIndex,
    });
  }
}

function renderDiscussionVotes() {
  const stage = currentDiscussionStage();
  const voteCounts = discussionVoteCounts[currentDiscussionIndex];
  const totalVotes = discussionVoteTotalForStage(currentDiscussionIndex);
  const revealed = discussionAnswerRevealed[currentDiscussionIndex];

  discussionVoteList.innerHTML = '';
  discussionVoteTotal.textContent = totalVotes === 1 ? '1 vote' : `${totalVotes} votes`;

  if (!stage.choices.length) {
    return;
  }

  stage.choices.forEach(function appendVoteRow(choice, index) {
    const row = document.createElement('div');
    const info = document.createElement('div');
    const topLine = document.createElement('div');
    const optionTag = document.createElement('span');
    const text = document.createElement('span');
    const bar = document.createElement('div');
    const fill = document.createElement('div');
    const stats = document.createElement('p');
    const count = voteCounts[index];
    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

    row.className = 'discussion-vote-row';
    if (revealed && index === stage.correctIndex) {
      row.classList.add('is-correct');
    }

    info.className = 'discussion-vote-info';
    topLine.className = 'discussion-vote-copy';
    optionTag.className = 'discussion-vote-option';
    optionTag.textContent = String.fromCharCode(65 + index);
    text.className = 'discussion-vote-text';
    text.textContent = choice;
    topLine.appendChild(optionTag);
    topLine.appendChild(text);

    bar.className = 'discussion-vote-bar';
    fill.className = 'discussion-vote-bar-fill';
    fill.style.width = `${percent}%`;
    bar.appendChild(fill);

    info.appendChild(topLine);
    info.appendChild(bar);

    stats.className = 'discussion-vote-stats';
    stats.textContent = `${count} · ${percent}%`;

    row.appendChild(info);
    row.appendChild(stats);
    discussionVoteList.appendChild(row);
  });
}

function renderDiscussionAnswer() {
  const stage = currentDiscussionStage();
  const selected = discussionSelectedChoices[currentDiscussionIndex];
  const revealed = discussionAnswerRevealed[currentDiscussionIndex];

  if (isClosingDiscussionStage(stage)) {
    discussionAnswerBlock.classList.add('hidden');
    return;
  }

  discussionAnswerBlock.classList.toggle('hidden', currentAudienceMode || !revealed);
  if (!revealed) {
    return;
  }

  if (selected === -1) {
    discussionAnswerStatus.textContent = 'Answer revealed.';
  } else if (selected === stage.correctIndex) {
    discussionAnswerStatus.textContent = 'You picked the correct answer.';
  } else {
    discussionAnswerStatus.textContent = `You picked ${String.fromCharCode(65 + selected)}. The correct answer is ${String.fromCharCode(65 + stage.correctIndex)}.`;
  }

  discussionAnswerTitle.textContent = stage.answerTitle;
  discussionAnswerBody.textContent = stage.answerBody;
}

function renderDiscussionDemo() {
  const stage = currentDiscussionStage();

  discussionDemoTitle.textContent = stage.demoTitle;
  discussionDemoBase.value = stage.demoBase;
  discussionDemoInsert.value = discussionDemoInserts[currentDiscussionIndex];
}

function renderDiscussionClosingState() {
  const stage = currentDiscussionStage();
  const closing = isClosingDiscussionStage(stage);

  discussionQuestionStepLabel.textContent = closing ? 'Discussion End' : 'Step 1';
  discussionQuestionBlock.classList.toggle('is-closing', closing);
  discussionChoiceList.classList.toggle('hidden', closing);
  discussionAnswerActions.classList.toggle('hidden', closing);
  discussionDemoBlock.classList.toggle('hidden', closing);
  discussionVoteResultBlock.classList.toggle('hidden', closing);
  discussionClosingBlock.classList.toggle('hidden', !closing);
  discussionFlowBlock.classList.toggle('hidden', !closing || currentAudienceMode);
  discussionAudienceStatus.classList.toggle('hidden', !currentAudienceMode || closing);

  if (closing) {
    discussionClosingTitle.textContent = stage.closingTitle || 'Any final questions?';
    discussionClosingBody.textContent =
      stage.closingBody || 'If there are no more questions, use the Draco flow video below to recap the paper from input to output.';
    if (!closingStageVisible) {
      resetDiscussionFlowVideo(!currentAudienceMode);
    }
  } else if (closingStageVisible) {
    pauseDiscussionFlowVideo();
  }

  closingStageVisible = closing;
}

function loadProgram(program: string, description: string) {
  editor.value = program;
  exampleCaption.textContent = description;
  updateLineNumbers();
  syncEditorScroll();
  hidePopovers();
}

function openProgramInStudio(program: string, description: string, autoRun: boolean, preferredMode: 'single' | 'grid' = 'single') {
  setAppMode('studio');
  if (currentMode !== preferredMode) {
    setMode(preferredMode);
  }
  loadProgram(program, description);

  if (autoRun && solverReady && !solverBusy) {
    runSolver();
  }
}

function renderDiscussionStage() {
  const stage = currentDiscussionStage();

  discussionProgress.textContent = `Stage ${currentDiscussionIndex + 1} of ${DISCUSSION_STAGES.length}`;
  discussionStageTitle.textContent = stage.title;
  discussionQuestion.textContent = stage.question;
  discussionPrev.disabled = currentDiscussionIndex === 0;
  discussionNext.disabled = currentDiscussionIndex === DISCUSSION_STAGES.length - 1;
  renderDiscussionTimeline();
  renderDiscussionChoices();
  renderDiscussionVotes();
  renderDiscussionAnswer();
  renderDiscussionDemo();
  renderDiscussionClosingState();
  renderVoteJoin();
}

function setDiscussionStage(nextIndex: number, fromRemote: boolean = false) {
  currentDiscussionIndex = Math.max(0, Math.min(DISCUSSION_STAGES.length - 1, nextIndex));
  renderDiscussionStage();

  if (!fromRemote) {
    syncVoteStage();
  }
}

function revealDiscussionAnswer() {
  if (isClosingDiscussionStage()) {
    return;
  }

  discussionAnswerRevealed[currentDiscussionIndex] = true;
  renderDiscussionChoices();
  renderDiscussionVotes();
  renderDiscussionAnswer();
}

function resetDiscussionAnswer() {
  if (isClosingDiscussionStage()) {
    return;
  }

  discussionSelectedChoices[currentDiscussionIndex] = -1;
  discussionAnswerRevealed[currentDiscussionIndex] = false;
  renderDiscussionChoices();
  renderDiscussionVotes();
  renderDiscussionAnswer();
}

function renderAppMode() {
  const buttons = appMode.querySelectorAll('button');

  buttons.forEach(function toggle(button) {
    const active = (button as HTMLElement).getAttribute('data-app-mode') === currentAppMode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  studioWorkspace.classList.toggle('hidden', currentAppMode !== 'studio');
  discussionWorkspace.classList.toggle('hidden', currentAppMode !== 'discussion');
  document.body.classList.toggle('is-audience-mode', currentAudienceMode);
  discussionAudienceStatus.classList.toggle('hidden', !currentAudienceMode);
}

function setAppMode(nextMode: string) {
  if (currentAudienceMode) {
    currentAppMode = 'discussion';
  } else {
    currentAppMode = nextMode === 'discussion' ? 'discussion' : 'studio';
  }
  renderAppMode();

  if (currentAppMode !== 'discussion') {
    pauseDiscussionFlowVideo();
  }
}

function jsonValueClass(value: any) {
  if (typeof value === 'string') {
    return 'json-value-string';
  }
  if (typeof value === 'number') {
    return 'json-value-number';
  }
  if (typeof value === 'boolean') {
    return 'json-value-boolean';
  }
  return '';
}

function createJsonLeaf(label: string, value: any) {
  const row = document.createElement('div');
  const key = document.createElement('span');
  const punctuation = document.createElement('span');
  const valueNode = document.createElement('span');

  row.className = 'json-leaf';
  key.className = 'json-key';
  punctuation.className = 'json-punctuation';
  valueNode.className = jsonValueClass(value);

  key.textContent = `"${label}"`;
  punctuation.textContent = ':';

  if (typeof value === 'string') {
    valueNode.textContent = `"${value}"`;
  } else {
    valueNode.textContent = String(value);
  }

  row.appendChild(key);
  row.appendChild(punctuation);
  row.appendChild(valueNode);

  return row;
}

function createJsonNode(label: string, value: any, depth: number) {
  const wrapper = document.createElement('div');
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  const key = document.createElement('span');
  const punctuation = document.createElement('span');
  const type = document.createElement('span');
  const meta = document.createElement('span');
  const children = document.createElement('div');
  const closing = document.createElement('div');
  const isArray = Array.isArray(value);
  const entries = isArray ? value : Object.keys(value);

  if (!value || typeof value !== 'object') {
    return createJsonLeaf(label, value);
  }

  wrapper.className = 'json-node';
  if (depth < 2) {
    details.open = true;
  }

  key.className = 'json-key';
  punctuation.className = 'json-punctuation';
  type.className = 'json-type';
  meta.className = 'json-meta-count';
  key.textContent = `"${label}"`;
  punctuation.textContent = ':';
  type.textContent = isArray ? '[' : '{';
  meta.textContent = ` ${entries.length} item${entries.length === 1 ? '' : 's'}`;

  summary.appendChild(key);
  summary.appendChild(punctuation);
  summary.appendChild(type);
  summary.appendChild(meta);
  details.appendChild(summary);

  children.className = 'json-children';

  if (isArray) {
    value.forEach(function renderArrayEntry(entry: any, index: number) {
      children.appendChild(createJsonNode(String(index), entry, depth + 1));
    });
  } else {
    Object.keys(value).forEach(function renderObjectEntry(objectKey: string) {
      children.appendChild(createJsonNode(objectKey, value[objectKey], depth + 1));
    });
  }

  closing.className = 'json-closing';
  closing.textContent = isArray ? ']' : '}';

  details.appendChild(children);
  details.appendChild(closing);
  wrapper.appendChild(details);

  return wrapper;
}

function renderJsonTree() {
  const selected = selectedResult();
  let payload: any;

  jsonTree.innerHTML = '';

  if (!selected) {
    jsonTree.innerHTML = '<div class="json-empty">Run Draco to inspect the selected result object.</div>';
    selectionMeta.textContent = 'No result selected.';
    return;
  }

  payload = {
    spec: selected.spec,
    cost: selected.model.costs.length === 1 ? selected.model.costs[0] : selected.model.costs,
    violations: selected.model.violations.map(function mapViolation(violation: any) {
      return violation.witness || violation.name;
    }),
  };

  selectionMeta.textContent = `model ${selectedResultIndex + 1} of ${currentSolution.models.length}`;
  jsonTree.appendChild(createJsonNode('root', payload, 0));
}

function renderSingleStage() {
  const selected = selectedResult();
  const shell = document.createElement('div');

  singleStage.innerHTML = '';
  shell.className = 'single-chart-shell';

  if (!selected) {
    singleStage.innerHTML = '<div class="empty-state">No selected result.</div>';
    return Promise.resolve();
  }

  singleStage.appendChild(shell);

  return buildView(shell, selected.spec).then(function assignView(view: any) {
    singleView = view;
  });
}

function renderGridStage() {
  const work: Promise<any>[] = [];
  gridStage.innerHTML = '';

  if (!currentSolution || !currentSolution.specs || !currentSolution.specs.length) {
    gridStage.innerHTML = '<div class="empty-state">No recommendations available.</div>';
    return Promise.resolve();
  }

  currentSolution.specs.forEach(function renderSpec(spec: any, index: number) {
    const card = document.createElement('div');
    const header = document.createElement('div');
    const label = document.createElement('span');
    const cost = document.createElement('span');
    const visual = document.createElement('div');

    card.className = 'grid-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `model ${index + 1}, cost ${currentSolution.models[index].costs.join(', ')}`);

    if (index === selectedResultIndex) {
      card.classList.add('is-selected');
      card.setAttribute('aria-pressed', 'true');
    } else {
      card.setAttribute('aria-pressed', 'false');
    }

    card.addEventListener('click', function onClick() {
      selectResult(index);
    });

    card.addEventListener('keydown', function onKeydown(event) {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      selectResult(index);
    });

    header.className = 'grid-card-head';
    label.className = 'grid-card-label';
    label.textContent = `model ${index + 1}`;
    cost.className = 'grid-card-cost';
    cost.textContent = `cost ${currentSolution.models[index].costs.join(', ')}`;
    header.appendChild(label);
    header.appendChild(cost);

    visual.className = 'grid-card-visual';
    card.appendChild(header);
    card.appendChild(visual);
    gridStage.appendChild(card);

    work.push(
      buildView(visual, spec).then(function rememberView(view: any) {
        previewViews.push(view);
      })
    );
  });

  return Promise.all(work);
}

function renderCurrentMode() {
  const buttons = viewMode.querySelectorAll('button');

  modeReadout.textContent = `viewing ${currentMode} · press 1/2`;

  buttons.forEach(function toggle(button: Element) {
    if ((button as HTMLElement).getAttribute('data-mode') === currentMode) {
      button.classList.add('is-active');
      button.setAttribute('aria-pressed', 'true');
    } else {
      button.classList.remove('is-active');
      button.setAttribute('aria-pressed', 'false');
    }
  });

  cleanupViews();

  if (currentMode === 'single') {
    singleStage.classList.remove('hidden');
    gridStage.classList.add('hidden');
    return renderSingleStage();
  }

  singleStage.classList.add('hidden');
  gridStage.classList.remove('hidden');
  return renderGridStage();
}

function setMode(nextMode: string) {
  currentMode = nextMode === 'grid' ? 'grid' : 'single';
  return renderCurrentMode();
}

function selectResult(index: number) {
  selectedResultIndex = index;
  renderCostRail();
  renderJsonTree();

  return renderCurrentMode();
}

function loadExample(name: string, autoRun: boolean) {
  currentExample = name;
  loadProgram(EXAMPLES[name].program, EXAMPLES[name].description);

  if (autoRun && solverReady && !solverBusy) {
    runSolver();
  }
}

function showEmptyState(message: string) {
  cleanupViews();
  singleStage.classList.remove('hidden');
  gridStage.classList.add('hidden');
  singleStage.innerHTML = `<div class="empty-state">${message}</div>`;
  gridStage.innerHTML = '';
}

function runSolver() {
  const query = editor.value.trim();
  let solution: any = null;
  let models = 7;

  if (!query) {
    showEmptyState('The editor is empty.');
    setStatus('Enter an ASP query before running Draco.', 'warning');
    return Promise.resolve();
  }

  if (!solverReady || solverBusy) {
    return Promise.resolve();
  }

  models = parseInt(modelCountInput.value, 10) || 7;
  setBusy(true);
  setStatus('Running Draco query…', 'info');

  try {
    solution = draco.solve(query, { models });
  } catch (error) {
    currentSolution = null;
    renderCostRail();
    renderJsonTree();
    showEmptyState('The query could not be solved.');
    setStatus(`Solver error: ${(error as Error).message}`, 'error');
    setBusy(false);
    return Promise.resolve();
  }

  if (!solution || !solution.specs || !solution.specs.length) {
    currentSolution = null;
    renderCostRail();
    renderJsonTree();
    showEmptyState('No satisfiable model was found.');
    setStatus('No satisfiable model found.', 'warning');
    setBusy(false);
    return Promise.resolve();
  }

  currentSolution = solution;
  selectedResultIndex = 0;
  renderCostRail();
  renderJsonTree();

  return renderCurrentMode()
    .then(function onRendered() {
      setStatus(`Ready. Generated ${currentSolution.models.length} model(s).`, 'success');
      setBusy(false);
    })
    .catch(function onRenderError(error: Error) {
      showEmptyState('Draco returned a model, but the chart could not be rendered.');
      setStatus(`Render failed: ${error.message}`, 'error');
      setBusy(false);
    });
}

function initializeInteractions() {
  examplesButton.addEventListener('click', function onExamplesClick(event) {
    event.stopPropagation();
    toggleMenu('examples');
  });

  optionsButton.addEventListener('click', function onOptionsClick(event) {
    event.stopPropagation();
    toggleMenu('options');
  });

  examplesMenu.querySelectorAll('[data-example]').forEach(function bindExample(button) {
    button.addEventListener('click', function onSelect() {
      const name = (button as HTMLElement).getAttribute('data-example') || 'scatter';
      loadExample(name, true);
    });
  });

  document.addEventListener('click', function onDocumentClick(event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.toolbar')) {
      hidePopovers();
    }
  });

  editor.addEventListener('input', updateLineNumbers);
  editor.addEventListener('scroll', syncEditorScroll);
  editor.addEventListener('keydown', function onKeydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      runSolver();
    }
  });

  runButton.addEventListener('click', function onRunClick() {
    runSolver();
  });

  studioModeButton.addEventListener('click', function onStudioModeClick(event) {
    event.preventDefault();
    setAppMode('studio');
  });

  discussionModeButton.addEventListener('click', function onDiscussionModeClick(event) {
    event.preventDefault();
    setAppMode('discussion');
  });

  appMode.addEventListener('click', function onAppModeClick(event) {
    const target = (event.target as HTMLElement).closest('[data-app-mode]') as HTMLElement | null;
    if (!target) {
      return;
    }

    event.preventDefault();
    setAppMode(target.getAttribute('data-app-mode') || 'studio');
  });

  singleButton.addEventListener('click', function onSingleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    setMode('single');
  });

  gridButton.addEventListener('click', function onGridClick(event) {
    event.preventDefault();
    event.stopPropagation();
    setMode('grid');
  });

  viewMode.addEventListener('click', function onModeClick(event) {
    const target = (event.target as HTMLElement).closest('[data-mode]') as HTMLElement | null;
    if (!target) {
      return;
    }

    event.preventDefault();
    setMode(target.getAttribute('data-mode') || 'single');
  });

  document.addEventListener('keydown', function onModeShortcut(event) {
    const target = event.target as HTMLElement | null;
    const isEditorTarget =
      !!target &&
      (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable);

    if (isEditorTarget || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.key === '1') {
      event.preventDefault();
      setMode('single');
    }

    if (event.key === '2') {
      event.preventDefault();
      setMode('grid');
    }
  });

  discussionPrev.addEventListener('click', function onDiscussionPrev() {
    setDiscussionStage(currentDiscussionIndex - 1);
  });

  discussionNext.addEventListener('click', function onDiscussionNext() {
    setDiscussionStage(currentDiscussionIndex + 1);
  });

  discussionRevealAnswer.addEventListener('click', function onRevealAnswer() {
    revealDiscussionAnswer();
  });

  discussionResetAnswer.addEventListener('click', function onResetAnswer() {
    resetDiscussionAnswer();
  });

  discussionResetVotes.addEventListener('click', function onResetVotes() {
    resetDiscussionVotes();
  });

  discussionDemoInsert.addEventListener('input', function onDemoInsertInput() {
    discussionDemoInserts[currentDiscussionIndex] = discussionDemoInsert.value;
  });

  discussionLoadDemo.addEventListener('click', function onLoadDemo() {
    const stage = currentDiscussionStage();
    openProgramInStudio(composeDiscussionDemoProgram(), `${stage.demoTitle} · loaded from discussion`, false, stage.demoMode);
  });

  discussionRunDemo.addEventListener('click', function onRunDemo() {
    const stage = currentDiscussionStage();
    openProgramInStudio(composeDiscussionDemoProgram(), `${stage.demoTitle} · answer demo`, true, stage.demoMode);
  });

  discussionResetDemo.addEventListener('click', function onResetDemo() {
    discussionDemoInserts[currentDiscussionIndex] = currentDiscussionStage().demoInsert;
    discussionDemoInsert.value = discussionDemoInserts[currentDiscussionIndex];
  });
}

function initialize() {
  datasetMeta.textContent = `cars.json · ${CARS_DATA.length} rows · normalized browser copy`;
  discussionFlowVideo.src = `${FLOW_VIDEO_MP4}?v=core-3`;
  discussionFlowVideo.poster = `${FLOW_VIDEO_POSTER}?v=core-3`;
  renderFieldCluster();
  loadExample('scatter', false);
  showEmptyState('Loading the WebAssembly solver…');
  renderJsonTree();
  renderDiscussionStage();
  renderAppMode();
  initializeInteractions();
  if (currentAudienceMode) {
    discussionAudienceStatus.textContent = 'Connecting to the live poll…';
  }
  connectVoteChannel();
  if (currentAudienceMode) {
    setBusy(false);
    setStatus('Audience voting mode.', 'info');
    return;
  }
  setBusy(true);
  setStatus('Downloading solver…', 'info');

  draco
    .init()
    .then(function onReady() {
      solverReady = true;
      setBusy(false);
      setStatus('Solver ready. Running the default example…', 'success');
      return runSolver();
    })
    .catch(function onError(error: Error) {
      setBusy(false);
      showEmptyState('Draco could not initialize in this browser session.');
      setStatus(`Failed to initialize Draco: ${error.message}`, 'error');
      console.error(error);
    });
}

initialize();
