import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Label } from './label';

describe('Label primitive', () => {
  it('labels form controls through the accessible name', () => {
    render(
      <>
        <Label htmlFor="workspace-title">Workspace title</Label>
        <input id="workspace-title" type="text" />
      </>
    );

    expect(screen.getByLabelText('Workspace title')).toBeInTheDocument();
  });
});
