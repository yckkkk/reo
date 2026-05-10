import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@/components/ui/toaster';
import { MemoryTitleDialog } from './MemoryTitleDialog';

vi.mock('@/components/ui/toaster', () => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  });

  return { toast };
});

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('MemoryTitleDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses toast feedback for save failures instead of root inline errors', async () => {
    const user = userEvent.setup();

    render(
      <MemoryTitleDialog
        description="保持简短且易识别"
        onOpenChange={vi.fn()}
        onSubmitTitle={async () => '无法重命名记忆。'}
        open
        submitLabel="保存"
        title="重命名记忆"
      />
    );

    await user.type(screen.getByLabelText('记忆名称'), '产品灵感与思考');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(toast.error).toHaveBeenCalledWith('无法保存记忆名称', {
      description: '无法重命名记忆。',
    });
    expect(screen.queryByText('无法重命名记忆。')).not.toBeInTheDocument();
  });

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
