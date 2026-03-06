export const state = {
  allLinks: [],
  sourceUrl: '',
  sourceTitle: '',
  isCollectionView: false,
  isRegexMode: false,
  isDedupActive: false,
  isGroupedView: false,
  currentItemTypeFilter: 'all',
  sortField: 'none',
  sortDir: 'asc',
  healthResults: {},
  focusedIndex: -1,
  pendingChord: null,
  selectedCollectionIds: new Set(),
  duplicateMap: {},
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

export { $, $$ };

// DOM refs initialized after DOMContentLoaded
export const dom = {};

export function initDom() {
  dom.linksList = $('#linksList');
  dom.countPill = $('#countPill');
  dom.sourceMeta = $('#sourceMeta');
  dom.searchInput = $('#searchInput');
  dom.typeFilter = $('#typeFilter');
  dom.locationFilter = $('#locationFilter');
  dom.resetFiltersBtn = $('#resetFiltersBtn');
  dom.actionBar = $('#actionBar');
  dom.selectAllCb = $('#selectAll');
  dom.selectionCount = $('#selectionCount');
  dom.actionButtons = $('#actionButtons');
  dom.moreToggle = $('#moreToggle');
  dom.moreMenu = $('#moreMenu');
  dom.copyAllBtn = $('#copyAllBtn');
  dom.exportToggle = $('#exportToggle');
  dom.exportMenu = $('#exportMenu');
  dom.saveSection = $('#saveSection');
  dom.saveToggle = $('#saveToggle');
  dom.saveForm = $('#saveForm');
  dom.saveCancelBtn = $('#saveCancelBtn');
  dom.collectionNameInput = $('#collectionNameInput');
  dom.collectionTagsInput = $('#collectionTagsInput');
  dom.collectionsContainer = $('#collectionsContainer');
  dom.confirmDialog = $('#confirmDialog');
  dom.toastContainer = $('#toastContainer');
  dom.typePopover = $('#typePopover');
  dom.regexToggle = $('#regexToggle');
  dom.dedupToggle = $('#dedupToggle');
  dom.patternInput = $('#patternInput');
  dom.domainStatsBar = $('#domainStatsBar');
  dom.suggestionsBar = $('#suggestionsBar');
  dom.healthSummary = $('#healthSummary');
  dom.historyContainer = $('#historyContainer');
  dom.viewFlatBtn = $('#viewFlat');
  dom.viewGroupedBtn = $('#viewGrouped');
  dom.autoCopyToggle = $('#autoCopyToggle');
  dom.cleanUrlsBtn = $('#cleanUrlsBtn');
  dom.checkLinksBtn = $('#checkLinksBtn');
  dom.shareBtn = $('#shareBtn');
  dom.importLinksBtn = $('#importLinksBtn');
  dom.mergeCollectionsBtn = $('#mergeCollectionsBtn');
  dom.diffCollectionsBtn = $('#diffCollectionsBtn');
  dom.tagFilterBar = $('#tagFilterBar');
}
