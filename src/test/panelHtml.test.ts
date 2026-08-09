import * as assert from 'assert';
import { test } from 'node:test';
import { getPanelHtml } from '../panelHtml';

const NONCE = 'abc123';

test('the panel loads nothing from anywhere', () => {
    // A webview that can reach the network is a webview that can leak what it
    // is displaying, and this one displays the machine it runs on.
    let html = getPanelHtml(NONCE);

    assert.ok(html.indexOf("default-src 'none'") !== -1, 'the policy must deny by default');
    assert.strictEqual(html.indexOf('http://'), -1);
    assert.strictEqual(html.indexOf('https://'), -1);
});

test('only the panel\'s own script and stylesheet may run', () => {
    let html = getPanelHtml(NONCE);

    assert.ok(html.indexOf(`script-src 'nonce-${NONCE}'`) !== -1);
    assert.ok(html.indexOf(`style-src 'nonce-${NONCE}'`) !== -1);
    assert.ok(html.indexOf(`<script nonce="${NONCE}">`) !== -1);
    assert.ok(html.indexOf(`<style nonce="${NONCE}">`) !== -1);
    assert.strictEqual(html.indexOf("'unsafe-inline'"), -1, 'a nonce is pointless beside unsafe-inline');
});

test('a fresh nonce is what makes the policy worth having', () => {
    assert.ok(getPanelHtml('firstnonce').indexOf('firstnonce') !== -1);
    assert.strictEqual(getPanelHtml('firstnonce').indexOf('secondnonce'), -1);
});

test('figures reach the page as text, never as markup', () => {
    // Volume names come from the system, so the panel writes every value with
    // textContent. innerHTML anywhere here would be a way in.
    let html = getPanelHtml(NONCE);

    assert.strictEqual(html.indexOf('innerHTML'), -1);
    assert.strictEqual(html.indexOf('insertAdjacentHTML'), -1);
    assert.ok(html.indexOf('textContent') !== -1);
});

test('the panel asks for its data rather than waiting to be told', () => {
    // It is torn down and rebuilt every time it is hidden and reshown, and a
    // message posted before its script runs is simply lost.
    assert.ok(getPanelHtml(NONCE).indexOf("postMessage({ type: 'ready' })") !== -1);
});
