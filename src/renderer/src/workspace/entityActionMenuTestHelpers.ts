import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';

export function installWorkspaceBridgeForEntityActionTests(
  reoWorkspace: Partial<Window['reoWorkspace']>
) {
  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: reoWorkspace as Window['reoWorkspace'],
  });
}

export async function openEntityActionMenu(menuLabel: string) {
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', { name: menuLabel }));

  return {
    menu: await screen.findByRole('menu', { name: menuLabel }),
    user,
  };
}

export function expectEntityActionMenuItems(menu: HTMLElement, expectedItems: string[]) {
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent)
  ).toEqual(expectedItems);
}

export function expectEntityActionMenuChrome(menu: HTMLElement) {
  for (const item of within(menu).getAllByRole('menuitem')) {
    expect(item.querySelector('svg')).toBeInTheDocument();
  }
  expect(within(menu).getAllByRole('group')).toHaveLength(3);
  expect(within(menu).getAllByRole('separator')).toHaveLength(2);
}

export function expectNoRenderedRawPath() {
  expect(document.body).not.toHaveTextContent(/\/Users\/|[A-Za-z]:\\/);
}
