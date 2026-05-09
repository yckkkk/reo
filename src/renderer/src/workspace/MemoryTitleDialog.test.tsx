import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryTitleDialog } from './MemoryTitleDialog';

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('MemoryTitleDialog', () => {
  it('keeps the dialog open while submit is pending', async () => {
    const user = userEvent.setup();
    const save = deferred<string | null>();
    const onOpenChange = vi.fn();

    render(
      <MemoryTitleDialog
        description="保持简短且易识别"
        onOpenChange={onOpenChange}
        onSubmitTitle={() => save.promise}
        open
        submitLabel="保存"
        title="重命名记忆"
      />
    );

    await user.type(screen.getByLabelText('记忆名称'), '产品灵感与思考');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog', { name: '重命名记忆' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    save.resolve(null);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
