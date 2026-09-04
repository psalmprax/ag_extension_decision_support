import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCandidatesFromDocument } from './extract.js';

// Minimal DOM stand-in: enough of querySelector(All)/textContent/getAttribute/closest
// to exercise the extractor without a browser or jsdom dependency.
function el(tag, { attrs = {}, text = '', children = [] } = {}) {
  const node = {
    tag, attrs, children, parentElement: null,
    get textContent() { return text + children.map(c => c.textContent).join(' '); },
    getAttribute: (k) => attrs[k] ?? null,
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) {
      const wanted = sel.split(',').map(s => s.trim());
      const out = [];
      const walk = (n) => { for (const c of n.children) { if (wanted.some(w => matches(c, w))) out.push(c); walk(c); } };
      walk(this);
      return out;
    },
    closest(sel) { let p = this.parentElement; const wanted = sel.split(',').map(s => s.trim()); while (p) { if (wanted.some(w => matches(p, w))) return p; p = p.parentElement; } return null; },
  };
  for (const c of children) c.parentElement = node;
  return node;
}
function matches(n, sel) {
  if (sel === 'a[href]') return n.tag === 'a' && n.attrs.href;
  if (sel.startsWith('.')) return (n.attrs.class || '').split(' ').includes(sel.slice(1));
  if (sel.startsWith('#')) return n.attrs.id === sel.slice(1);
  if (sel === '[role="main"]') return n.attrs.role === 'main';
  return n.tag === sel;
}

test('container mode: one candidate per selector match with title/description/url', () => {
  const doc = el('body', { children: [
    el('div', { attrs: { class: 'result' }, children: [
      el('h3', { text: 'Maize lethal necrosis disease' }),
      el('a', { attrs: { href: '/factsheet/1' }, text: 'Read more' }),
      el('p', { text: 'Symptoms include chlorotic mottling and dead heart.' }),
    ] }),
    el('div', { attrs: { class: 'result' }, children: [
      el('h3', { text: 'Short' }), // title too short → dropped
      el('a', { attrs: { href: '/factsheet/2' } }),
    ] }),
  ] });
  const out = extractCandidatesFromDocument(doc, { containerSelector: '.result', maxResults: 10, pageUrl: 'https://cabi.test/search' });
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'Maize lethal necrosis disease');
  assert.equal(out[0].url, 'https://cabi.test/factsheet/1');
  assert.match(out[0].description, /chlorotic mottling/);
});

test('generic mode: harvests substantive anchors, dedupes urls, skips fragments and honours maxResults', () => {
  const doc = el('body', { children: [ el('main', { children: [
    el('a', { attrs: { href: '#top' }, text: 'Skip this fragment link please' }),
    el('a', { attrs: { href: '/a' }, text: 'Integrated pest management for fall armyworm' }),
    el('a', { attrs: { href: '/a' }, text: 'Integrated pest management for fall armyworm (dup)' }),
    el('a', { attrs: { href: '/b' }, text: 'Push-pull technology against stemborers' }),
    el('a', { attrs: { href: '/c' }, text: 'Tiny' }),
  ] }) ] });
  const out = extractCandidatesFromDocument(doc, { containerSelector: null, maxResults: 1, pageUrl: 'https://fao.test/' });
  assert.equal(out.length, 1);
  assert.equal(out[0].url, 'https://fao.test/a');
});

test('returns [] on an empty document instead of throwing', () => {
  const doc = el('body');
  assert.deepEqual(extractCandidatesFromDocument(doc, { containerSelector: '.x', maxResults: 5, pageUrl: 'https://x.test' }), []);
});
