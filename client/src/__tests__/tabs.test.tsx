import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import React from 'react';
import { Platform, Text } from 'react-native';
import TabsLayout from '../app/(tabs)/_layout';

jest.setTimeout(30000);

/**
 * The real tab layout, with stand-in screens, so these tests are about the
 * tabs themselves and not about what each screen draws. renderRouter returns
 * a promise (expo-router 58), so every test awaits it.
 */
function renderTabs(initialUrl = '/') {
  return renderRouter(
    {
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': () => <Text>Forecast screen</Text>,
      '(tabs)/week': () => <Text>This week screen</Text>,
    },
    { initialUrl }
  );
}

// Expo Router gives each tab the "tab" role, except on iOS (where Jest runs
// by default), where it uses "button" because "tab" misbehaves there.
const tabRole = Platform.OS === 'ios' ? 'button' : 'tab';
const tab = (name: RegExp) => screen.getByRole(tabRole, { name });

describe('Option A: tabs, one focus per screen (#96)', () => {
  it('opens on the Forecast tab', async () => {
    await renderTabs();
    expect(screen.getByText('Forecast screen')).toBeTruthy();
    expect(tab(/Forecast/)).toBeSelected();
    expect(tab(/This week/)).not.toBeSelected();
  });

  it('switches to This week when its tab is pressed', async () => {
    const app = await renderTabs();
    fireEvent.press(tab(/This week/));
    expect(screen.getByText('This week screen')).toBeTruthy();
    expect(app.getPathname()).toBe('/week');
    expect(tab(/This week/)).toBeSelected();
  });

  it('keeps the /week address, so links to it still land on its tab', async () => {
    await renderTabs('/week');
    expect(screen.getByText('This week screen')).toBeTruthy();
    expect(tab(/This week/)).toBeSelected();
  });
});
