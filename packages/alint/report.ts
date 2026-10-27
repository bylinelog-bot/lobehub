/**
 * Publish an `alint --format json` run to GitHub:
 *
 * - an "ALint" check run on the head commit, red when any finding is at
 *   `error` level, with the findings attached as line annotations;
 * - one pull request review per PR: the summary body is rewritten in place on
 *   every push and each finding gets an inline comment on its own line, so it
 *   can be replied to and resolved where it was raised (created only once
 *   there is something to report);
 * - the same table in the job's step summary.
 *
 * The review is submitted as `COMMENT`: it informs, it does not block. The
 * ALint check is what turns red on errors.
 *
 * Calibration fixtures are dropped: bad fixtures fire by design and are
 * checked by the fixture suite instead.
 *
 *   bun packages/alint/report.ts alint-output.json
 *
 * Env: GITHUB_TOKEN, GITHUB_REPOSITORY, HEAD_SHA, HEAD_REF (branch name),
 * PR_NUMBER (optional; looked up from HEAD_REF when absent), RUN_URL.
 */
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface AlintDiagnostic {
  evidence?: { suggestion?: unknown };
  filePath: string;
  loc?: { start?: { line?: number } };
  message: string;
  ruleId: string;
  severity: 'error' | 'warn';
}

export interface AlintOutput {
  diagnostics: AlintDiagnostic[];
  execution?: { cached?: number; completed?: number; failed?: number; planned?: number };
  usage?: { inputTokens?: number; outputTokens?: number };
}

/**
 * The cost of one run, carried in every summary so spend can be read back
 * from the check runs: model calls made, calls served from the cache, and
 * tokens sent and received.
 */
export const toUsageLine = ({ execution, usage }: AlintOutput): string | undefined => {
  if (!execution && !usage) return undefined;
  const calls = execution?.completed ?? 0;
  const cached = execution?.cached ?? 0;
  const input = usage?.inputTokens ?? 0;
  const output = usage?.outputTokens ?? 0;
  return `${calls} model calls, ${cached} cached · ${input.toLocaleString('en-US')} input / ${output.toLocaleString('en-US')} output tokens`;
};

export interface Finding {
  file: string;
  line: number;
  message: string;
  rule: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

/** Marks the review summarizing the run, so later pushes update it in place. */
export const REVIEW_MARKER = '<!-- alint-summary -->';
/** Marks the inline comments of a run, so a fix removes the previous ones. */
export const FINDING_MARKER = '<!-- alint-finding -->';

/**
 * Calibration fixtures fire by design. Rules live in more than one place —
 * repo-wide rules in `packages/alint`, package-level rules next to their
 * package (`packages/<pkg>/alint`) — so match the fixtures directory of any.
 */
const isFixture = (file: string) => /^packages\/(?:[^/]+\/)?alint\/fixtures\//.test(file);

/** alint JSON → findings relative to the repo root, fixtures dropped, errors first. */
export const toFindings = (output: AlintOutput, rootDir: string): Finding[] =>
  output.diagnostics
    .map((diagnostic) => {
      const [message, ...rest] = diagnostic.message.split('\n');
      // Declarative rules put the fix in `evidence.suggestion`; hand-written
      // rules append a "Suggestion:" paragraph to the message instead.
      const fromEvidence = diagnostic.evidence?.suggestion;
      const suggestion =
        typeof fromEvidence === 'string' && fromEvidence.trim()
          ? fromEvidence.trim()
          : rest
              .join(' ')
              .replace(/^\s*Suggestion:\s*/i, '')
              .trim();
      return {
        file: path.relative(rootDir, diagnostic.filePath),
        line: diagnostic.loc?.start?.line ?? 1,
        message: message.trim(),
        rule: diagnostic.ruleId.replace(/^lobehub\//, ''),
        severity: diagnostic.severity === 'error' ? ('error' as const) : ('warning' as const),
        suggestion: suggestion || undefined,
      };
    })
    .filter((finding) => !isFixture(finding.file))
    .sort(
      (a, b) =>
        Number(b.severity === 'error') - Number(a.severity === 'error') ||
        a.file.localeCompare(b.file) ||
        a.line - b.line,
    );

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

export const toTitle = (findings: Finding[]) => {
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.length - errors;
  if (findings.length === 0) return 'No findings on the changed lines';
  return [errors ? count(errors, 'error') : '', warnings ? count(warnings, 'warning') : '']
    .filter(Boolean)
    .join(', ');
};

const cell = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ');

/** Markdown body shared by the review and the step summary. */
export const toMarkdown = (
  findings: Finding[],
  { repo, sha, runUrl, usage }: { repo: string; runUrl?: string; sha: string; usage?: string },
): string => {
  const icon = findings.some((f) => f.severity === 'error') ? '❌' : findings.length ? '⚠️' : '✅';
  const lines = [`${REVIEW_MARKER}`, `### ${icon} ALint · ${toTitle(findings)}`, ''];
  if (findings.length === 0) {
    lines.push(`Checked the changed lines at \`${sha.slice(0, 7)}\`.`);
  } else {
    lines.push('| | Location | Rule | Finding |', '| --- | --- | --- | --- |');
    for (const finding of findings) {
      const link = `https://github.com/${repo}/blob/${sha}/${finding.file}#L${finding.line}`;
      const detail = finding.suggestion
        ? `${cell(finding.message)}<br><sub>💡 ${cell(finding.suggestion)}</sub>`
        : cell(finding.message);
      lines.push(
        `| ${finding.severity === 'error' ? '❌' : '⚠️'} | [\`${finding.file}:${finding.line}\`](${link}) | \`${finding.rule}\` | ${detail} |`,
      );
    }
    lines.push(
      '',
      'Errors fail the ALint check. Fix them, or explain in the PR why the rule does not apply. Rules live in `packages/alint/rules`.',
    );
  }
  lines.push(
    '',
    `<sub>Commit \`${sha.slice(0, 7)}\`${runUrl ? ` · [run](${runUrl})` : ''}${usage ? ` · ${usage}` : ''}</sub>`,
  );
  return lines.join('\n');
};

/** Check-run annotations; the API accepts at most 50 per request. */
export const toAnnotations = (findings: Finding[]) =>
  findings.slice(0, 50).map((finding) => ({
    annotation_level: finding.severity === 'error' ? 'failure' : 'warning',
    end_line: finding.line,
    message: finding.suggestion ? `${finding.message}\n\n${finding.suggestion}` : finding.message,
    path: finding.file,
    start_line: finding.line,
    title: finding.rule,
  }));

/**
 * Inline comments of the review, anchored on the finding's own line in the head
 * version of the file. Capped like the annotations: a review with hundreds of
 * comments is unreadable, and the summary table already lists them all.
 */
export const toReviewComments = (findings: Finding[]) =>
  findings.slice(0, 50).map((finding) => ({
    body: [
      FINDING_MARKER,
      `**\`${finding.rule}\`** · ${finding.severity}`,
      '',
      finding.message,
      ...(finding.suggestion ? ['', `💡 ${finding.suggestion}`] : []),
    ].join('\n'),
    line: finding.line,
    path: finding.file,
    side: 'RIGHT' as const,
  }));

export const toConclusion = (findings: Finding[]) =>
  findings.some((f) => f.severity === 'error')
    ? 'failure'
    : findings.length
      ? 'neutral'
      : 'success';

/* ------------------------------------------------------------------ GitHub */

const api = async (method: string, url: string, body?: unknown) => {
  const response = await fetch(`https://api.github.com${url}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    method,
  });
  if (!response.ok)
    throw new Error(`${method} ${url} → ${response.status} ${await response.text()}`);
  return response.status === 204 ? undefined : response.json();
};

const findPullRequest = async (repo: string, branch?: string) => {
  if (process.env.PR_NUMBER) return Number(process.env.PR_NUMBER);
  if (!branch) return undefined;
  const owner = repo.split('/')[0];
  const pulls = (await api(
    'GET',
    `/repos/${repo}/pulls?state=open&head=${owner}:${encodeURIComponent(branch)}`,
  )) as { number: number }[];
  return pulls[0]?.number;
};

/**
 * Keep one review on the PR current across pushes. A submitted review cannot be
 * deleted or replaced, only edited, so the summary body is rewritten in place
 * while the inline comments of the previous run are deleted and re-created for
 * this run's findings — a fixed finding loses its comment instead of piling up.
 */
const publishReview = async (
  repo: string,
  pr: number,
  sha: string,
  markdown: string,
  findings: Finding[],
) => {
  const reviews = (await api('GET', `/repos/${repo}/pulls/${pr}/reviews?per_page=100`)) as {
    body?: string | null;
    id: number;
  }[];
  const existing = [...reviews].reverse().find((review) => review.body?.includes(REVIEW_MARKER));

  if (existing) {
    await api('PUT', `/repos/${repo}/pulls/${pr}/reviews/${existing.id}`, { body: markdown });
  } else if (findings.length > 0) {
    await api('POST', `/repos/${repo}/pulls/${pr}/reviews`, {
      body: markdown,
      commit_id: sha,
      event: 'COMMENT',
    });
  }

  const previous = (await api('GET', `/repos/${repo}/pulls/${pr}/comments?per_page=100`)) as {
    body?: string | null;
    id: number;
  }[];
  for (const comment of previous.filter((c) => c.body?.includes(FINDING_MARKER)))
    await api('DELETE', `/repos/${repo}/pulls/comments/${comment.id}`);

  for (const comment of toReviewComments(findings)) {
    // A line that is not part of the PR diff cannot carry an inline comment;
    // the summary row and the check annotation still carry the finding.
    try {
      await api('POST', `/repos/${repo}/pulls/${pr}/comments`, { ...comment, commit_id: sha });
    } catch (error) {
      console.warn(`alint: no inline comment on ${comment.path}:${comment.line}: ${String(error)}`);
    }
  }
};

const main = async () => {
  const [inputPath] = process.argv.slice(2);
  if (!inputPath) {
    console.error('usage: bun packages/alint/report.ts <alint-output.json>');
    process.exit(2);
  }
  const output = JSON.parse(await readFile(inputPath, 'utf8')) as AlintOutput;
  const findings = toFindings(output, process.cwd());
  const usage = toUsageLine(output);
  const repo = process.env.GITHUB_REPOSITORY ?? '';
  const sha = process.env.HEAD_SHA ?? '';
  const markdown = toMarkdown(findings, { repo, runUrl: process.env.RUN_URL, sha, usage });

  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  else console.info(markdown);

  if (!process.env.GITHUB_TOKEN || !repo || !sha) return;

  await api('POST', `/repos/${repo}/check-runs`, {
    conclusion: toConclusion(findings),
    head_sha: sha,
    name: 'ALint',
    output: { annotations: toAnnotations(findings), summary: markdown, title: toTitle(findings) },
    status: 'completed',
  });

  // The review is a convenience; never let it fail the report.
  try {
    const pr = await findPullRequest(repo, process.env.HEAD_REF);
    if (pr) await publishReview(repo, pr, sha, markdown, findings);
  } catch (error) {
    console.warn(`alint: could not publish the PR review: ${String(error)}`);
  }
};

if (import.meta.main) await main();
