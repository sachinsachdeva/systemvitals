'use strict';

/**
 * One group of metrics: a status bar entry of its own, and the hover that
 * belongs to it.
 *
 * Splitting the display this way is what lets the hover answer the question
 * actually being asked — pointing at the GPU reading explains the GPU, and
 * nothing else.
 */
export interface Section {
    /** Identifies the status bar entry, so it can be hidden on its own. */
    id: string;
    name: string;
    icon: string;
    /** What the settings search is narrowed to when the entry is clicked. */
    settingsFilter: string;
}

/**
 * A single label/value pair in the hover.
 */
export interface DetailRow {
    label: string;
    value: string;
}

/**
 * What one resource contributes to its section's hover: its rows, plus an
 * optional footnote for figures people commonly misread.
 *
 * Several resources feed one section — CPU usage, frequency and temperature all
 * land under "CPU" — and their rows appear in the order the resources are
 * registered.
 */
export interface Detail {
    rows: DetailRow[];
    note?: string;
}

// Clicking the entry opens the details panel, so the hover points at that
// rather than carrying a command link of its own. Keeping commands out of the
// markdown means the hover need not be trusted at all, and a mount point named
// to look like a link is inert whatever else goes wrong.
const DETAILS_HINT: string = '_Click to open the details panel._';

/**
 * Every character that could turn a mount point, CPU model or battery model
 * into markup rather than text.
 *
 * The hover renders theme icons, so an unescaped `$(zap)` in a volume name
 * would become an icon rather than the name. Brackets and parentheses keep
 * link syntax inert, and pipes matter because every value sits in a table cell.
 */
const MARKDOWN_SYNTAX: RegExp = /[\\`*_[\]()<>|~#]/g;

// One glyph per core, from idle to pegged.
const LOAD_BARS: string[] = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

// Beyond this, a bar per core is a wall of glyphs that wraps badly in a hover,
// so many-core machines get the summary alone.
const MAX_CORE_BARS: number = 32;

/**
 * Escapes text that came from the system, so it renders as what it says.
 */
export function escapeMarkdown(text: string): string {
    return text.replace(MARKDOWN_SYNTAX, '\\$&');
}

/**
 * Renders per-core load as a row of bars.
 *
 * The bars answer a question the single usage percentage cannot: whether the
 * machine is evenly busy or one core is pinned while the rest idle.
 */
export function formatCoreLoads(loads: number[]): string {
    if (loads.length === 0) {
        return '';
    }

    let peak: number = 0;
    let peakCore: number = 0;
    loads.forEach((load, core) => {
        if (sanitizeLoad(load) > peak) {
            peak = sanitizeLoad(load);
            peakCore = core;
        }
    });

    let summary = `peak ${peak.toFixed(0)}% on core ${peakCore}`;
    if (loads.length > MAX_CORE_BARS) {
        return `${loads.length} cores, ${summary}`;
    }

    return `${loads.map(loadBar).join('')}  ${summary}`;
}

/**
 * Formats a duration given in minutes the way a battery indicator reads it.
 *
 * Returns null for the negative or zero values reported when a machine has no
 * estimate to give, which is the caller's cue to leave the row out entirely
 * rather than show "0m remaining".
 */
export function formatMinutes(minutes: number): string | null {
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return null;
    }

    let wholeMinutes = Math.round(minutes);
    let hours = Math.floor(wholeMinutes / 60);
    if (hours === 0) {
        return `${wholeMinutes}m`;
    }

    return `${hours}h ${wholeMinutes % 60}m`;
}

/**
 * Formats the update interval for the details panel, so the figures visibly
 * changing there have a stated cadence.
 */
export function formatInterval(milliseconds: number): string {
    if (milliseconds < 1000) {
        return `${Math.round(milliseconds)} ms`;
    }

    let seconds = milliseconds / 1000;
    return `${seconds % 1 === 0 ? seconds : seconds.toFixed(1)} s`;
}

/**
 * Builds one section's hover: a table of its rows, any footnotes, and the hint
 * that the entry can be clicked.
 *
 * Returns an empty string when the section has nothing to report, which the
 * caller turns into no tooltip at all rather than an empty hover.
 */
export function renderTooltip(section: Section, details: Detail[]): string {
    let rows = details.reduce((all, detail) => all.concat(detail.rows), [] as DetailRow[]);
    if (rows.length === 0) {
        return '';
    }

    let blocks: string[] = [renderTable(section, rows)];

    details.forEach(detail => {
        if (detail.note !== undefined) {
            blocks.push(`_${escapeMarkdown(detail.note)}_`);
        }
    });

    return blocks.concat(DETAILS_HINT).join('\n\n');
}

function renderTable(section: Section, rows: DetailRow[]): string {
    // The section name lives in the table header, so each hover is titled
    // without a heading level competing with the hover's own styling.
    let lines: string[] = [
        `| ${section.icon} **${escapeMarkdown(section.name)}** | |`,
        '|:---|:---|',
    ];

    rows.forEach(row => {
        lines.push(`| ${escapeMarkdown(row.label)} | ${escapeMarkdown(row.value)} |`);
    });

    return lines.join('\n');
}

function loadBar(load: number): string {
    let index = Math.floor(sanitizeLoad(load) / 100 * LOAD_BARS.length);
    return LOAD_BARS[Math.min(index, LOAD_BARS.length - 1)];
}

/**
 * Per-core load is a ratio of tick deltas, so it arrives as NaN whenever two
 * samples land in the same tick.
 */
function sanitizeLoad(load: number): number {
    if (!Number.isFinite(load)) {
        return 0;
    }
    return Math.min(Math.max(load, 0), 100);
}
