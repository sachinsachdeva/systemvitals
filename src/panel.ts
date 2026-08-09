'use strict';
import { commands, window, CancellationToken, Disposable, WebviewView, WebviewViewProvider, WebviewViewResolveContext } from 'vscode';
import { DetailRow } from './tooltip';
import { getPanelHtml } from './panelHtml';

/**
 * One section as the details view shows it.
 */
export interface PanelSection {
    id: string;
    name: string;
    rows: DetailRow[];
    notes: string[];
}

const VIEW_ID: string = 'systemvitals.details';

// The view is contributed behind this context key, so the panel carries no
// System Vitals tab until one is asked for, and closing the view takes the tab
// away again rather than leaving an empty shell behind.
const CONTEXT_KEY: string = 'systemvitals.detailsRequested';

/**
 * The details view: what the hovers show, for every section at once, docked in
 * the panel just above the status bar it belongs to.
 *
 * It stays put while it is read, unlike a hover, and unlike an editor tab it
 * goes away for good when closed.
 */
export class DetailsView implements WebviewViewProvider {
    private _view: WebviewView | undefined;
    private _registration: Disposable;

    // The last data sampled, held so the view can be answered the moment it
    // asks. It is torn down whenever it is closed or hidden behind another
    // panel tab, and waiting a whole update interval to redraw on the way back
    // would show an empty view.
    private _sections: PanelSection[];
    private _cadence: string;

    // Which section the view is singling out, kept so it can be re-sent
    // whenever the view rebuilds itself.
    private _focused: string | undefined;

    // What a section's Settings button should open.
    private _onSettings: (sectionId: string) => void;

    constructor(onSettings: (sectionId: string) => void) {
        this._sections = [];
        this._cadence = "";
        this._registration = window.registerWebviewViewProvider(VIEW_ID, this, {
            // Nothing is worth keeping alive while hidden: the view rebuilds
            // itself from the next sample, which is never far away.
            webviewOptions: { retainContextWhenHidden: false },
        });
        this._onSettings = onSettings;
    }

    public resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext, token: CancellationToken) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            // Nothing is loaded from disk: the document is self-contained.
            localResourceRoots: [],
        };
        webviewView.webview.html = getPanelHtml(createNonce());

        webviewView.webview.onDidReceiveMessage(message => {
            if (message.type === 'ready') {
                this.post();
                this.postFocus();
            } else if (message.type === 'settings') {
                this._onSettings(message.id);
            }
        });

        webviewView.onDidDispose(() => {
            this._view = undefined;
            this._focused = undefined;
        });
    }

    /**
     * Whether the view is on screen showing the given section, which is what
     * makes clicking the same reading twice close it again.
     */
    public isShowing(sectionId: string): boolean {
        return this._view !== undefined && this._view.visible && this._focused === sectionId;
    }

    /**
     * Brings the view up, and the given section to attention with it.
     */
    public async reveal(sectionId?: string) {
        this._focused = sectionId;

        // The context key has to land before the view can be focused, or there
        // is no view yet to focus.
        await commands.executeCommand('setContext', CONTEXT_KEY, true);
        await commands.executeCommand(`${VIEW_ID}.focus`);
        this.postFocus();
    }

    /**
     * Takes the view away, tab and all.
     */
    public hide() {
        this._focused = undefined;
        commands.executeCommand('setContext', CONTEXT_KEY, false);
    }

    public update(sections: PanelSection[], cadence: string) {
        this._sections = sections;
        this._cadence = cadence;
        if (this._view !== undefined && this._view.visible) {
            this.post();
        }
    }

    public dispose() {
        this._registration.dispose();
    }

    private post() {
        if (this._view !== undefined) {
            this._view.webview.postMessage({ type: 'sections', sections: this._sections, cadence: this._cadence });
        }
    }

    /**
     * Tells the view which section to single out.
     *
     * Sent from _focused every time rather than handed over once: a message
     * posted before the view's script has attached its listener is dropped, and
     * the view is torn down and rebuilt every time it is hidden behind another
     * panel tab. Re-sending on each handshake covers both, so the outline
     * survives a round trip to the terminal and back.
     */
    private postFocus() {
        if (this._view === undefined || this._focused === undefined) {
            return;
        }

        this._view.webview.postMessage({ type: 'focus', id: this._focused });
    }
}

/**
 * A one-off token for the content security policy, so that the view's own
 * script and stylesheet are the only ones it will run.
 */
function createNonce(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let index = 0; index < 32; index++) {
        nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return nonce;
}
