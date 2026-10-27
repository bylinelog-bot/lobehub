import { describe, expect, it } from 'vitest';

import { formatModifyNodesResult, PENDING_REVIEW_NOTE } from '../formatModifyNodesResult';

describe('formatModifyNodesResult', () => {
  it('summarises a fully applied batch', () => {
    expect(
      formatModifyNodesResult({
        results: [
          { action: 'insert', success: true },
          { action: 'insert', success: true },
        ],
        successCount: 2,
        totalCount: 2,
      }),
    ).toBe('Successfully executed 2 inserts (2/2 operations succeeded).');
  });

  it('does not report a partially applied batch as a success', () => {
    const content = formatModifyNodesResult({
      results: [
        { action: 'modify', error: 'node "zzzz" not found in the document', success: false },
        { action: 'insert', success: true },
      ],
      successCount: 1,
      totalCount: 2,
    });

    expect(content).not.toContain('Successfully');
    expect(content).toMatchInlineSnapshot(`
      "Only 1/2 operations succeeded (1 modify, 1 insert requested). Failed operations were not applied:
      - Operation 1 (modify): node "zzzz" not found in the document
      Call getPageContent to get the current node ids before retrying the failed operations."
    `);
  });

  it('flags an operation that failed after part of it was applied', () => {
    const content = formatModifyNodesResult({
      results: [
        {
          action: 'modify',
          error: 'node "zzzz" not found in the document',
          partiallyApplied: true,
          success: false,
        },
      ],
      successCount: 0,
      totalCount: 1,
    });

    expect(content).toContain('except those marked PARTIALLY APPLIED');
    expect(content).toContain('- Operation 1 (modify): PARTIALLY APPLIED');
  });

  it('says the edits are not live when the editor keeps them as review diffs', () => {
    const content = formatModifyNodesResult(
      {
        results: [{ action: 'insert', success: true }],
        successCount: 1,
        totalCount: 1,
      },
      { pendingReview: true },
    );

    expect(content).toContain('Successfully executed 1 insert');
    expect(content).toContain(PENDING_REVIEW_NOTE);
  });

  it('stays silent about review diffs when every operation failed', () => {
    const content = formatModifyNodesResult(
      {
        results: [{ action: 'remove', error: 'node "zzzz" not found', success: false }],
        successCount: 0,
        totalCount: 1,
      },
      { pendingReview: true },
    );

    expect(content).not.toContain(PENDING_REVIEW_NOTE);
  });

  it('keeps the previous wording when the host applies edits directly', () => {
    const content = formatModifyNodesResult({
      results: [{ action: 'insert', success: true }],
      successCount: 1,
      totalCount: 1,
    });

    expect(content).not.toContain('review diff');
  });
});
