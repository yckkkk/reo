import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './input';
import { FieldControl, FieldGroup, FieldHint, FieldLabel, FieldRow } from './field';

describe('Field primitives', () => {
  it('uses spacing instead of divider lines between form rows', () => {
    render(
      <FieldGroup aria-label="记忆空间设置">
        <FieldRow>
          <div>
            <FieldLabel htmlFor="workspace-title">记忆空间名称</FieldLabel>
            <FieldHint>给新的记忆空间起一个名字</FieldHint>
          </div>
          <FieldControl>
            <Input id="workspace-title" />
          </FieldControl>
        </FieldRow>
      </FieldGroup>
    );

    const group = screen.getByRole('group', { name: '记忆空间设置' });
    expect(group).toHaveClass('grid', 'gap-8');
    expect(group).not.toHaveClass('divide-y', 'divide-border');
    expect(screen.getByText('记忆空间名称')).toHaveClass('text-ui-sm', 'font-medium');
    expect(screen.getByText('给新的记忆空间起一个名字')).toHaveClass('text-ui-xs', 'font-regular');
    expect(screen.getByLabelText('记忆空间名称')).toBeInTheDocument();
  });
});
