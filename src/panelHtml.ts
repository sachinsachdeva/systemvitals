'use strict';

/**
 * The details panel's document.
 *
 * Only the shell is built here. Every figure is filled in by the script below
 * from data the extension posts, written with textContent rather than markup,
 * so a volume named after a script tag is displayed as a volume named after a
 * script tag. That is also why the content security policy can forbid
 * everything except this one script and stylesheet.
 */
export function getPanelHtml(nonce: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<title>System Vitals</title>
<style nonce="${nonce}">
    body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        /* The panel is short, so vertical space is spent on figures. */
        padding: 0.5rem 0.75rem 1rem;
    }
    .cadence {
        color: var(--vscode-descriptionForeground);
        font-size: 0.9em;
        display: block;
        margin-bottom: 0.5rem;
    }
    #sections {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
        gap: 0.75rem;
        align-items: start;
    }
    section {
        border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
        border-radius: 4px;
        padding: 0.75rem 0.9rem 0.9rem;
    }
    section.focused {
        border-color: var(--vscode-focusBorder);
    }
    .heading {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
    }
    h2 {
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
    }
    .settings {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.85em;
        color: var(--vscode-textLink-foreground);
    }
    .settings:hover {
        color: var(--vscode-textLink-activeForeground);
        text-decoration: underline;
    }
    table {
        border-collapse: collapse;
        width: 100%;
    }
    th, td {
        text-align: left;
        font-weight: normal;
        padding: 0.2rem 0;
        vertical-align: baseline;
    }
    th {
        color: var(--vscode-descriptionForeground);
        padding-right: 1rem;
        white-space: nowrap;
        width: 1%;
    }
    td {
        font-variant-numeric: tabular-nums;
    }
    .note {
        color: var(--vscode-descriptionForeground);
        font-size: 0.9em;
        line-height: 1.45;
        margin: 0.6rem 0 0;
    }
    .empty {
        color: var(--vscode-descriptionForeground);
    }
</style>
</head>
<body>
<span class="cadence" id="cadence"></span>
<div id="sections"><p class="empty">Sampling…</p></div>
<script nonce="${nonce}">
(function () {
    var vscode = acquireVsCodeApi();
    var container = document.getElementById('sections');
    var cadence = document.getElementById('cadence');
    var pendingFocus = null;

    function row(label, value) {
        var tr = document.createElement('tr');
        var th = document.createElement('th');
        th.textContent = label;
        var td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(th);
        tr.appendChild(td);
        return tr;
    }

    function card(data) {
        var element = document.createElement('section');
        element.id = data.id;

        var heading = document.createElement('div');
        heading.className = 'heading';
        var title = document.createElement('h2');
        title.textContent = data.name;
        heading.appendChild(title);

        var settings = document.createElement('button');
        settings.className = 'settings';
        settings.textContent = 'Settings';
        settings.addEventListener('click', function () {
            vscode.postMessage({ type: 'settings', id: data.id });
        });
        heading.appendChild(settings);
        element.appendChild(heading);

        var table = document.createElement('table');
        var body = document.createElement('tbody');
        data.rows.forEach(function (entry) {
            body.appendChild(row(entry.label, entry.value));
        });
        table.appendChild(body);
        element.appendChild(table);

        data.notes.forEach(function (note) {
            var paragraph = document.createElement('p');
            paragraph.className = 'note';
            paragraph.textContent = note;
            element.appendChild(paragraph);
        });

        return element;
    }

    /**
     * Writes new figures into a card that is already on screen, or reports that
     * its shape has changed and it needs rebuilding.
     *
     * Values change on every sample; labels almost never do. Rewriting only the
     * figures keeps text the reader has selected, and their scroll position,
     * where a card replaced wholesale every few seconds would lose both.
     */
    function refresh(element, data) {
        var rows = element.querySelectorAll('tbody tr');
        var notes = element.querySelectorAll('.note');
        if (rows.length !== data.rows.length || notes.length !== data.notes.length) {
            return false;
        }

        for (var i = 0; i < rows.length; i++) {
            if (rows[i].children[0].textContent !== data.rows[i].label) {
                return false;
            }
        }
        for (var j = 0; j < notes.length; j++) {
            if (notes[j].textContent !== data.notes[j]) {
                return false;
            }
        }

        for (var k = 0; k < rows.length; k++) {
            var value = rows[k].children[1];
            if (value.textContent !== data.rows[k].value) {
                value.textContent = data.rows[k].value;
            }
        }
        return true;
    }

    function render(sections) {
        var seen = {};
        sections.forEach(function (data, index) {
            seen[data.id] = true;
            var existing = document.getElementById(data.id);
            if (existing && refresh(existing, data)) {
                return;
            }

            var replacement = card(data);
            if (existing) {
                if (existing.classList.contains('focused')) {
                    replacement.classList.add('focused');
                }
                existing.replaceWith(replacement);
            } else if (index < container.children.length) {
                container.insertBefore(replacement, container.children[index]);
            } else {
                container.appendChild(replacement);
            }
        });

        Array.prototype.slice.call(container.children).forEach(function (child) {
            if (!seen[child.id]) {
                child.remove();
            }
        });

        if (container.children.length === 0) {
            var empty = document.createElement('p');
            empty.className = 'empty';
            empty.textContent = 'Nothing to report. Every metric is either switched off or unavailable on this machine.';
            container.appendChild(empty);
        }

        if (pendingFocus) {
            focus(pendingFocus);
            pendingFocus = null;
        }
    }

    function focus(id) {
        var element = document.getElementById(id);
        if (!element) {
            // The section is not on screen yet; the next render will do it.
            pendingFocus = id;
            return;
        }

        Array.prototype.slice.call(container.children).forEach(function (child) {
            child.classList.remove('focused');
        });
        element.classList.add('focused');
        // The outline is the part that matters, so it goes on first and the
        // scroll is attempted only where the host implements it.
        if (element.scrollIntoView) {
            element.scrollIntoView({ block: 'nearest' });
        }
    }

    window.addEventListener('message', function (event) {
        var message = event.data;
        if (message.type === 'sections') {
            cadence.textContent = message.cadence;
            render(message.sections);
        } else if (message.type === 'focus') {
            focus(message.id);
        }
    });

    // Messages sent before this script runs are lost, so the panel asks.
    vscode.postMessage({ type: 'ready' });
}());
</script>
</body>
</html>`;
}
