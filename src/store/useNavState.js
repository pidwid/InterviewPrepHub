/**
 * Persists navigation state in the URL hash so refreshing restores position.
 *
 * Hash format:  #<tab>/<dashTab>/<topicId>
 * Examples:
 *   #sd/roadmap
 *   #lld/categories/lld-parking-lot
 *   #sd/practice/q-uber
 *
 * All three segments are optional — missing segments fall back to defaults.
 */

const VALID_TABS = ['sd', 'lld'];
const VALID_DASH_TABS = ['roadmap', 'categories', 'practice', 'index'];

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '');
  const [tab, dashTab, topicId] = raw.split('/');
  return {
    tab:     VALID_TABS.includes(tab)      ? tab     : 'sd',
    dashTab: VALID_DASH_TABS.includes(dashTab) ? dashTab : 'roadmap',
    topicId: topicId || null,
  };
}

function writeHash(tab, dashTab, topicId) {
  const parts = [tab, dashTab];
  if (topicId) parts.push(topicId);
  // Replace so refresh doesn't create browser history entries
  window.history.replaceState(null, '', '#' + parts.join('/'));
}

export function useNavState() {
  const initial = parseHash();
  return { initial, writeHash };
}
