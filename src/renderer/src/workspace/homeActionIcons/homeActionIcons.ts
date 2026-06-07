type HomeActionIconSource = {
  readonly light: string;
  readonly dark: string;
};

const homeActionIconSources = {
  write: {
    light: new URL('./write-light.png', import.meta.url).toString(),
    dark: new URL('./write-dark.png', import.meta.url).toString(),
  },
  record: {
    light: new URL('./record-light.png', import.meta.url).toString(),
    dark: new URL('./record-dark.png', import.meta.url).toString(),
  },
  create: {
    light: new URL('./create-light.png', import.meta.url).toString(),
    dark: new URL('./create-dark.png', import.meta.url).toString(),
  },
  capture: {
    light: new URL('./capture-light.png', import.meta.url).toString(),
    dark: new URL('./capture-dark.png', import.meta.url).toString(),
  },
} as const;

export type HomeActionIconId = keyof typeof homeActionIconSources;

export function homeActionIconSource(id: HomeActionIconId): HomeActionIconSource {
  return homeActionIconSources[id];
}
