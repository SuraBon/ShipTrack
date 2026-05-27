import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(currentDir, 'ConfirmReceipt.tsx'), 'utf8');

describe('ConfirmReceipt delivery flow', () => {
  it('submits from the final details step without opening a second review dialog', () => {
    expect(source).not.toContain('ConfirmReceiptReviewDialog');
    expect(source).not.toContain('isConfirmDialogOpen');
    expect(source).not.toContain('setIsConfirmDialogOpen');
    expect(source).toContain('onClick={executeConfirm}');
  });
});
