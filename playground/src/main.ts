import { lintMarkdown } from '../../src/browser/lintMarkdown.js';
import { decodeSharePayload, encodeSharePayload } from './share.js';

const SAMPLE = `# My Project

## Project Overview

Short description of the project.

## Development Commands

\`\`\`
npm test
\`\`\`

## Architecture

Hexagonal layout with a CLI entry point.
`;

const source = document.getElementById('source') as HTMLTextAreaElement;
const list = document.getElementById('violations') as HTMLUListElement;
const status = document.getElementById('status') as HTMLSpanElement;
const shareBtn = document.getElementById('share') as HTMLButtonElement;

let timer: number | undefined;

function render(): void {
  const result = lintMarkdown(source.value);
  list.replaceChildren();

  if (result.violations.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No violations — looking good.';
    list.append(li);
  } else {
    for (const v of result.violations) {
      const li = document.createElement('li');
      const sev = document.createElement('span');
      sev.className = `sev ${v.severity}`;
      sev.textContent = v.severity;
      const msg = document.createElement('p');
      msg.className = 'msg';
      msg.textContent = v.message;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${v.ruleId} · ${v.line}:${v.column}`;
      li.append(sev, msg, meta);
      list.append(li);
    }
  }

  status.textContent = `${result.errorCount}e / ${result.warningCount}w / ${result.infoCount}i`;
}

function scheduleLint(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(render, 220);
}

async function init(): Promise<void> {
  const fromHash = await decodeSharePayload(location.hash);
  source.value = fromHash ?? SAMPLE;
  render();

  source.addEventListener('input', scheduleLint);

  shareBtn.addEventListener('click', async () => {
    const payload = await encodeSharePayload(source.value);
    const url = `${location.origin}${location.pathname}#${payload}`;
    history.replaceState(null, '', `#${payload}`);
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'Share link copied';
    } catch {
      status.textContent = 'Share link updated in URL';
    }
  });
}

void init();
