import { progressReporter } from '../src/cli/progress.js';

describe('progress reporter', () => {
  it('weighs the steps, maps the install share onto its part and only grows', () => {
    const events = [];
    const reporter = progressReporter({
      command: 'create webapp',
      steps: ['render', 'write', 'install'],
      emit: (event) => events.push(event),
    });

    reporter.onStep('render');
    reporter.onStep('write');
    reporter.onStep('install');
    reporter.onProgress('install', { phase: 'resolving', found: 400, share: 0.24 });
    reporter.onProgress('install', { phase: 'resolving', found: 401, share: 0.2401 });
    reporter.onProgress('install', { phase: 'installing', done: 512, total: 1203, share: 0.71 });
    reporter.onProgress('install', { phase: 'installing', done: 400, total: 1203, share: 0.6 });
    reporter.done();

    expect(events.map((event) => event.progress)).toEqual([0, 2, 5, 27, 72, 100]);
    expect(events[3].message).toBe('Installing dependencies: working out which packages it needs (400 found)');
    expect(events[4]).toMatchObject({ phase: 'installing', done: 512, packages: 1203 });
  });

  it('reports the packages found every few while the total is unknown', () => {
    const events = [];
    const reporter = progressReporter({
      command: 'create landing',
      steps: ['install'],
      emit: (event) => events.push(event),
    });

    for (let found = 1; found <= 60; found += 1)
      reporter.onProgress('install', { phase: 'resolving', found, share: null });

    expect(events.map((event) => event.found)).toEqual([1, 26, 51]);
  });

  it('reports nothing for a run that had nothing to do', () => {
    const events = [];
    progressReporter({
      command: 'update',
      steps: ['write', 'install', 'verify'],
      emit: (event) => events.push(event),
    }).done();

    expect(events).toEqual([]);
  });
});
