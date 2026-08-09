import * as assert from 'assert';
import { test } from 'node:test';
import { Detail, Section, escapeMarkdown, formatCoreLoads, formatInterval, formatMinutes, renderTooltip } from '../tooltip';

const CPU: Section = { id: 'systemvitals.cpu', name: 'CPU', icon: '$(pulse)', settingsFilter: 'cpu' };
const DISK: Section = { id: 'systemvitals.disk', name: 'Disk', icon: '$(database)', settingsFilter: 'disk' };

function detail(rows: [string, string][], note?: string): Detail {
    return { rows: rows.map(row => ({ label: row[0], value: row[1] })), note: note };
}

test('a section hover is titled once, however many resources feed it', () => {
    let markdown = renderTooltip(CPU, [detail([['Usage', '9.03%']]), detail([['Frequency', '2.40 GHz']])]);

    assert.strictEqual(markdown.match(/\*\*CPU\*\*/g)!.length, 1);
    assert.ok(markdown.indexOf('| $(pulse) **CPU** |') !== -1);
});

test('rows appear in the order their resources are registered', () => {
    let markdown = renderTooltip(CPU, [detail([['Usage', '9.03%']]), detail([['Frequency', '2.40 GHz']])]);

    assert.ok(markdown.indexOf('| Usage') < markdown.indexOf('| Frequency'));
});

test('a hover covers its own section and nothing else', () => {
    // The whole point of the split: pointing at the disk reading must not
    // produce a wall of CPU figures.
    let markdown = renderTooltip(DISK, [detail([['/', '153.26 GB of 228.27 GB used']])]);

    assert.strictEqual(markdown.indexOf('CPU'), -1);
    assert.ok(markdown.indexOf('**Disk**') !== -1);
});

test('a section with nothing to report yields no tooltip at all', () => {
    assert.strictEqual(renderTooltip(CPU, []), '');
    assert.strictEqual(renderTooltip(CPU, [detail([])]), '');
});

test('every hover says the entry can be clicked', () => {
    assert.ok(renderTooltip(CPU, [detail([['Usage', '9.03%']])]).indexOf('_Click to open the details panel._') !== -1);
});

test('no hover carries a command of its own', () => {
    // The click opens the settings, so the markdown needs no command link and
    // therefore need not be trusted.
    assert.strictEqual(renderTooltip(CPU, [detail([['Usage', '9.03%']])]).indexOf('command:'), -1);
});

test('a note is rendered under the table, not inside it', () => {
    let markdown = renderTooltip(CPU, [detail([['Usage', '9.03%']], 'Averaged across cores.')]);

    assert.ok(markdown.indexOf('_Averaged across cores._') !== -1);
    assert.ok(markdown.indexOf('| Usage') < markdown.indexOf('_Averaged'));
});

test('a volume named to look like a command link stays inert', () => {
    // Mount points are attacker-influenced on a shared machine. The hover is
    // untrusted, so this could not run anything even unescaped, but a link that
    // renders at all is a link someone can be fooled by.
    let markdown = renderTooltip(DISK, [detail([['[Click me](command:workbench.action.terminal.new)', '10 GB']])]);

    assert.strictEqual(markdown.indexOf('](command:workbench.action.terminal.new)'), -1);
});

test('a volume named like a theme icon renders as its name', () => {
    let markdown = renderTooltip(DISK, [detail([['$(zap)', '10 GB']])]);

    // The escaped parenthesis is what stops the codicon syntax matching.
    assert.ok(markdown.indexOf('$\\(zap\\)') !== -1);
});

test('a pipe in a volume name does not break out of its table cell', () => {
    assert.strictEqual(escapeMarkdown('/mnt/a|b'), '/mnt/a\\|b');
});

test('escaping leaves ordinary readings alone', () => {
    // Escaping is deliberately narrow: full stops and percent signs run through
    // untouched, or every reading would render as '2\\.40 GHz'.
    assert.strictEqual(escapeMarkdown('2.40 GHz'), '2.40 GHz');
    assert.strictEqual(escapeMarkdown('Apple M4 · 10 cores'), 'Apple M4 · 10 cores');
    assert.strictEqual(escapeMarkdown('9.03% user'), '9.03% user');
});

test('core loads render one bar per core, plus where the peak is', () => {
    let bars = formatCoreLoads([0, 50, 100, 3]);

    assert.strictEqual(bars, '▁▅█▁  peak 100% on core 2');
});

test('core loads survive the NaN a zero-length sampling window produces', () => {
    // Per-core load is a ratio of tick deltas, so two samples in one tick
    // divide by zero.
    let bars = formatCoreLoads([NaN, 25]);

    assert.strictEqual(bars, '▁▃  peak 25% on core 1');
});

test('many-core machines get the summary rather than a wall of bars', () => {
    let loads = new Array(64).fill(0);
    loads[40] = 77;

    let summary = formatCoreLoads(loads);

    assert.strictEqual(summary, '64 cores, peak 77% on core 40');
    assert.strictEqual(summary.indexOf('▁'), -1);
});

test('no cores reported yields nothing to show', () => {
    assert.strictEqual(formatCoreLoads([]), '');
});

test('battery time is read as hours and minutes', () => {
    assert.strictEqual(formatMinutes(134), '2h 14m');
    assert.strictEqual(formatMinutes(45), '45m');
    assert.strictEqual(formatMinutes(60), '1h 0m');
});

test('a battery with no estimate to give gets no row', () => {
    // systeminformation reports -1 where the platform will not say.
    assert.strictEqual(formatMinutes(-1), null);
    assert.strictEqual(formatMinutes(0), null);
    assert.strictEqual(formatMinutes(NaN), null);
});

test('the panel states its cadence naturally at any setting', () => {
    assert.strictEqual(formatInterval(10000), '10 s');
    assert.strictEqual(formatInterval(2500), '2.5 s');
    assert.strictEqual(formatInterval(200), '200 ms');
});
