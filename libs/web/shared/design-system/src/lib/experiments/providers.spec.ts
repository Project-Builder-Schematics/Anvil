import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  EXPERIMENT_OVERRIDES,
  ExposureSink,
  provideExperiments,
  SUBJECT_ID,
} from './experiments';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
}

describe('experiment providers', () => {
  beforeEach(() => {
    // Node's built-in localStorage shadows the jsdom one and is unusable without a flag.
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, {
        value: memoryStorage(),
        configurable: true,
      });
    }
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  it('keeps one anonymous subject id across reads', () => {
    const first = TestBed.inject(SUBJECT_ID);
    TestBed.resetTestingModule();
    expect(TestBed.inject(SUBJECT_ID)).toBe(first);
    expect(window.localStorage.getItem('ds-subject-id')).toBe(first);
  });

  it('reads ?exp= and keeps it for the session', () => {
    window.history.replaceState(null, '', '/?exp=theme:b');
    expect(TestBed.inject(EXPERIMENT_OVERRIDES)).toEqual({ theme: 'b' });

    TestBed.resetTestingModule();
    window.history.replaceState(null, '', '/');
    expect(TestBed.inject(EXPERIMENT_OVERRIDES)).toEqual({ theme: 'b' });
  });

  it('lets a new query override the stored one', () => {
    window.sessionStorage.setItem(
      'ds-exp-overrides',
      JSON.stringify({ theme: 'b' }),
    );
    window.history.replaceState(null, '', '/?exp=theme:control');
    expect(TestBed.inject(EXPERIMENT_OVERRIDES)).toEqual({ theme: 'control' });
  });

  it('applies the theme at app initialization', async () => {
    window.history.replaceState(null, '', '/?exp=theme:b');
    TestBed.configureTestingModule({
      providers: [
        provideExperiments(),
        { provide: ExposureSink, useValue: () => undefined },
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;
    expect(document.documentElement.getAttribute('data-theme')).toBe('stripe');
  });

  it('logs exposures to the console by default', () => {
    const debug = vi
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const exposure = { experiment: 'theme', variant: 'b', subjectId: 's' };
    TestBed.inject(ExposureSink)(exposure);
    expect(debug).toHaveBeenCalledWith('exposure', exposure);
  });
});
