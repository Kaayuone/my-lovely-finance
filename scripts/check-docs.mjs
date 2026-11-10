#!/usr/bin/env node
/**
 * Mechanical checks for the documentation. What it can prove it proves; meaning stays with the
 * author of the change (docs/workflows/docs-update.md).
 *
 * - links and anchors resolve
 * - every document carries the status block its directory requires
 * - a plan in plans/completed/ has its outcome written down
 * - the «Сверен» field keeps the latest reconciliation only, not a journal of «ранее …» entries
 * - version numbers a document claims as current match the code
 *
 * No dependencies on purpose: adding one to the repository needs agreement (AGENTS.md).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const problems = [];
const report = (file, message) => problems.push(`${toRepoPath(file)}: ${message}`);

const toRepoPath = file => path.relative(root, file).split(path.sep).join('/');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.md')) acc.push(full);
  }
  return acc;
}

const docFiles = walk(path.join(root, 'docs'));
const files = [
  ...docFiles,
  path.join(root, 'README.md'),
  path.join(root, 'AGENTS.md'),
  path.join(root, 'TODO.md'),
  path.join(root, 'CHANGELOG.md'),
];

const read = file => fs.readFileSync(file, 'utf8');

/**
 * Fenced blocks are examples, not claims: a `# comment` in a shell block is not a heading and a
 * `](target)` in a markdown example is not a link. Everything that scans for real ones drops them.
 */
const withoutFences = text => text.replace(/^ {0,3}(`{3,}|~{3,})[\s\S]*?^ {0,3}\1[^\n]*$/gm, '');
const isTemplate = file => toRepoPath(file).startsWith('docs/templates/');
const inDir = (file, dir) => toRepoPath(file).startsWith(`docs/${dir}/`);

/**
 * The «Сверен» field of a status block: the line with the label plus the continuation lines of the
 * quote, up to a blank quote line or the next `**Field:**`. Every check reads the field whole, so a
 * claim on a continuation line is not skipped.
 */
function verifiedField(block) {
  const lines = block.split('\n');
  const start = lines.findIndex(line => line.includes('**Сверен:**'));
  if (start < 0) return '';
  const field = [lines[start]];
  for (const line of lines.slice(start + 1)) {
    const continuation = line.match(/^>\s?(.*)$/)?.[1].trim();
    if (!continuation || /^\*\*[^*]+:\*\*/.test(continuation)) break;
    field.push(continuation);
  }
  return field.join(' ');
}

/**
 * The status block is the first paragraph after the title: from the first non-empty line below the
 * heading to the next blank line (a bare `>` line is not blank). The shape of the document decides
 * the window, not a line count, so a longer «Статус» cannot push «Дата» out of it, and a field in a
 * later paragraph does not count.
 */
function statusBlock(text) {
  const lines = text.split('\n');
  const title = lines.findIndex(line => /^#{1,6}\s/.test(line));
  if (title < 0) return '';
  const rest = lines.slice(title + 1);
  const start = rest.findIndex(line => line.trim());
  if (start < 0) return '';
  const length = rest.slice(start).findIndex(line => !line.trim());
  return rest.slice(start, length < 0 ? undefined : start + length).join('\n');
}

// --- versions the code actually carries -------------------------------------------------------

const appVersion = JSON.parse(read(path.join(root, 'package.json'))).version;
// No step yet means the schema is at version 0, the one the runner starts from
const schemaVersion = Math.max(
  0,
  ...[
    ...read(path.join(root, 'src/database/migrations/definitions.ts')).matchAll(
      /^\s*version: (\d+),/gm,
    ),
  ].map(m => Number(m[1])),
);

// --- anchors ----------------------------------------------------------------------------------

/** GitHub's heading slug: lowercase, drop punctuation, spaces to dashes. Cyrillic survives. */
function slug(heading) {
  return heading
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');
}

const anchorsOf = new Map();
for (const file of files) {
  const set = new Set();
  for (const m of withoutFences(read(file)).matchAll(/^#{1,6} +(.+?)\s*$/gm)) set.add(slug(m[1]));
  anchorsOf.set(path.normalize(file), set);
}

// --- checks -----------------------------------------------------------------------------------

for (const file of files) {
  const text = read(file);
  const prose = withoutFences(text);
  const dir = path.dirname(file);

  // links and anchors
  for (const [, target] of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:)/.test(target)) continue;
    const [relTarget, anchor] = target.split('#');
    const resolved = relTarget ? path.normalize(path.join(dir, relTarget)) : path.normalize(file);
    if (relTarget && !fs.existsSync(resolved)) {
      report(file, `битая ссылка: ${target}`);
      continue;
    }
    if (!anchor) continue;
    if (!resolved.endsWith('.md')) continue;
    const anchors = anchorsOf.get(resolved);
    if (anchors && !anchors.has(decodeURIComponent(anchor).toLowerCase())) {
      report(file, `ссылка на несуществующий якорь: ${target}`);
    }
  }

  if (isTemplate(file) || !toRepoPath(file).startsWith('docs/')) continue;

  // status block
  const block = statusBlock(text);
  const status = block.match(/\*\*Статус:\*\* *([^\n]*)/);
  if (!status) {
    report(file, 'нет статус-блока: ожидается `**Статус:**` в статус-блоке сразу после заголовка');
  } else {
    const allowed = [
      'действует',
      'черновик',
      'принято',
      'выполнен',
      'приостановлен',
      'заменён',
      'архив',
      'отклонено',
    ];
    const first = status[1]
      .trim()
      .split(/[ ,;—]/)[0]
      .toLowerCase();
    if (!allowed.includes(first)) {
      report(file, `неизвестный статус «${status[1].trim()}»; допустимы: ${allowed.join(', ')}`);
    }
  }

  const maintained =
    inDir(file, 'architecture') ||
    inDir(file, 'conventions') ||
    inDir(file, 'product') ||
    inDir(file, 'testing') ||
    inDir(file, 'workflows') ||
    inDir(file, 'plans') ||
    toRepoPath(file) === 'docs/README.md';

  if (maintained && !/\*\*Сверен:\*\* *\S/.test(block)) {
    report(file, 'нет поля `**Сверен:**` с датой сверки и тем, что сверялось');
  }
  const verified = verifiedField(block);
  if (
    maintained &&
    !inDir(file, 'plans/completed') &&
    /(?<!\p{L})ранее(?!\p{L})/iu.test(verified)
  ) {
    report(
      file,
      'поле `**Сверен:**` хранит историю («ранее …»): оставьте только последнюю сверку, история — в git',
    );
  }
  if (maintained && !inDir(file, 'plans/completed') && !/\*\*Пересмотр:\*\* *\S/.test(block)) {
    report(file, 'нет поля `**Пересмотр:**` с условием пересмотра');
  }
  if (inDir(file, 'adr') && !/\*\*Дата:\*\* *\S/.test(block)) {
    report(file, 'ADR без поля `**Дата:**`');
  }
  if (inDir(file, 'archive') && !/архив/i.test(status?.[1] ?? '')) {
    report(file, 'документ в archive/ должен иметь статус «архив»');
  }

  // a finished plan says what came out of it
  if (inDir(file, 'plans/completed') && !/^#{1,3} +Итог\s*$/m.test(prose)) {
    report(file, 'выполненный план без раздела «Итог»');
  }

  // versions claimed as current
  if (inDir(file, 'archive')) continue;

  const claim = (label, actual, ...matches) => {
    for (const m of matches) {
      if (m && Number(m[1]) !== Number(actual)) {
        report(file, `${label}: в тексте ${m[1]}, в коде ${actual} — «${m[0].trim()}»`);
      }
    }
  };

  if (/приложение \d/.test(verified) && !verified.includes(appVersion)) {
    report(file, `статус-блок ссылается на версию приложения, отличную от ${appVersion}`);
  }
  claim(
    'версия схемы БД',
    schemaVersion,
    verified.match(/схема БД (\d+)/),
    prose.match(/[Сс]хема БД — версия (\d+)/),
  );
}

if (problems.length) {
  console.error(`check:docs — ${problems.length} проблем(ы):\n`);
  for (const problem of problems) console.error('  ' + problem);
  console.error('\nПравила: docs/workflows/docs-update.md');
  process.exit(1);
}

console.log(
  `check:docs — без замечаний: ${files.length} файлов, ` +
    `приложение ${appVersion}, схема БД ${schemaVersion}.`,
);
