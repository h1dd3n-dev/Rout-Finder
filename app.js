/**
 * BD Bank Details Parser & Routing Number Finder
 * 100% Client-side Vanilla JavaScript with Gemini AI & Smart Offline Engine
 */

(function () {
  'use strict';

  // --- STORAGE KEYS ---
  const HISTORY_STORAGE_KEY = 'bd_bank_parser_history_v1';
  const THEME_STORAGE_KEY = 'bd_bank_parser_theme';
  const GEMINI_API_KEY_STORAGE = 'bd_bank_gemini_api_key';
  const GEMINI_AUTO_USE_STORAGE = 'bd_bank_gemini_auto_use';

  // --- STATE ---
  let banksDb = [];
  let currentParsedResult = null;
  let autoParseEnabled = true;
  let historyItems = [];
  let geminiApiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
  let geminiAutoUse = localStorage.getItem(GEMINI_AUTO_USE_STORAGE) === 'true';

  // --- DOM ELEMENTS ---
  const rawInput = document.getElementById('raw-message-input');
  const btnParse = document.getElementById('btn-parse');
  const btnParseAi = document.getElementById('btn-parse-ai');
  const btnClear = document.getElementById('btn-clear');
  const btnPasteClipboard = document.getElementById('btn-paste-clipboard');
  const autoParseToggle = document.getElementById('auto-parse-toggle');
  const inputStats = document.getElementById('input-stats');
  
  const emptyState = document.getElementById('empty-state');
  const resultView = document.getElementById('result-view');
  const parserStatusTag = document.getElementById('parser-status-tag');

  // Fields
  const fieldName = document.getElementById('field-name');
  const fieldBank = document.getElementById('field-bank');
  const fieldAcc = document.getElementById('field-acc');
  const fieldBranch = document.getElementById('field-branch');
  const fieldRouting = document.getElementById('field-routing');
  
  const displayRoutingNumber = document.getElementById('display-routing-number');
  const routingSourceBadge = document.getElementById('routing-source-badge');
  const bdBankCode = document.getElementById('bd-bank-code');
  const bdDistCode = document.getElementById('bd-dist-code');
  const bdBranchCode = document.getElementById('bd-branch-code');
  const bdCheckDigit = document.getElementById('bd-check-digit');
  
  const bankCodeBadge = document.getElementById('bank-code-badge');
  const accLenBadge = document.getElementById('acc-len-badge');
  const branchDistBadge = document.getElementById('branch-dist-badge');
  
  const candidatesBox = document.getElementById('branch-candidates-box');
  const candidatesList = document.getElementById('candidates-pills');

  const btnCopyAll = document.getElementById('btn-copy-all');
  const btnSaveHistory = document.getElementById('btn-save-history');
  const themeToggle = document.getElementById('theme-toggle');
  const toastContainer = document.getElementById('toast-container');
  const historyBadge = document.getElementById('history-badge');

  // Search tab elements
  const searchBankSelect = document.getElementById('search-bank-select');
  const searchDistrictSelect = document.getElementById('search-district-select');
  const searchQueryInput = document.getElementById('search-query-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const searchResultsCount = document.getElementById('search-results-count');
  const branchesTableBody = document.getElementById('branches-table-body');

  // History tab elements
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');
  const btnClearHistory = document.getElementById('btn-clear-history');

  // AI Modal elements
  const aiModal = document.getElementById('ai-modal');
  const btnOpenAiSettings = document.getElementById('btn-open-ai-settings');
  const btnCloseAiModal = document.getElementById('ai-modal-close');
  const btnCancelAiModal = document.getElementById('btn-cancel-ai-modal');
  const btnSaveApiKey = document.getElementById('btn-save-api-key');
  const btnRemoveApiKey = document.getElementById('btn-remove-api-key');
  const aiApiKeyInput = document.getElementById('ai-api-key-input');
  const aiKeyToggleVisibility = document.getElementById('ai-key-toggle-visibility');
  const aiAutoUseToggle = document.getElementById('ai-auto-use-toggle');
  const apiStatusPill = document.getElementById('api-status-pill');
  const headerAiStatusText = document.getElementById('header-ai-status-text');

  // --- INITIALIZATION ---
  function init() {
    initTheme();
    loadDatabase();
    initEventListeners();
    loadHistory();
    updateAiStatusUI();
    populateSearchFilters();
    renderSearchTable();
    initPWA();
  }

  // --- THEME ---
  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark-theme';
    document.body.className = savedTheme;
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    const newTheme = isDark ? 'light-theme' : 'dark-theme';
    document.body.className = newTheme;
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    showToast(isDark ? 'লাইট থিম সক্রিয় করা হয়েছে' : 'ডার্ক থিম সক্রিয় করা হয়েছে');
  }

  // --- DATABASE ---
  function loadDatabase() {
    const db = (typeof window !== 'undefined' ? window.BANKS_DATABASE : globalThis.BANKS_DATABASE);
    if (db && Array.isArray(db)) {
      banksDb = db;
      const totalBranches = banksDb.reduce((sum, b) => sum + (b.b ? b.b.length : 0), 0);
      const statusBadge = document.getElementById('db-status-badge');
      if (statusBadge) {
        statusBadge.textContent = `🏦 ${banksDb.length} ব্যাংক • ${totalBranches.toLocaleString('bn-BD')} ব্রাঞ্চ`;
      }
    } else {
      showToast('ব্যাংক ডেটাবেজ লোড হতে সমস্যা হয়েছে!', 'error');
    }
  }

  // --- UTILITIES ---
  function bengaliToLatinDigits(str) {
    if (!str) return '';
    const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return str.replace(/[০-৯]/g, d => bnDigits.indexOf(d).toString());
  }

  function cleanText(str) {
    if (!str) return '';
    return str
      .replace(/^['"“]+|['"”]+$/g, '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ')
      .trim();
  }

  function isUnwantedText(line) {
    const l = line.trim().toLowerCase();
    if (!l || l === '-' || l === '--' || l === '---' || l === '.' || l === '/' || l === '//') return true;
    if (/^(minimum|min|maximum|max|limit|amount|amt|টাকার পরিমাণ|টাকা|পরিমাণ)\s*[:\-\s]*[\d,]+/i.test(l)) return true;
    if (/^(bdt|tk|tk\.|taka|টাকা)\s*[:\-\s]*[\d,]+(\.\d+)?/i.test(l)) return true;
    if (/^[\d,]+(\.\d+)?\s*(\/\-|\/=)?\s*(k|bdt|tk|tk\.|taka|টাকা|টাকার|হাজার|lakh|lac|cr)\b/i.test(l)) return true;
    if (/^\d+(\.\d+)?\s*(k|bdt|tk|tk\.|taka|টাকা|হাজার|lakh|lac|cr)$/i.test(l)) return true;
    if (/^\d+\s*k$/i.test(l)) return true;
    if (/^[\d,]+\s*(\/\-|\/=)$/i.test(l)) return true;
    if (/^(fee|charge|chargeable|note|notice|remarks|warning|alert|সতর্কতা|নোট)\b/i.test(l)) return true;
    return false;
  }

  function normalizeStr(str) {
    return cleanText(bengaliToLatinDigits(str))
      .toLowerCase()
      .replace(/[^\w\s\u0980-\u09FF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function toPhonetic(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/ai|ay|ey/g, 'i')
      .replace(/ee|ea/g, 'i')
      .replace(/oo|ou/g, 'u')
      .replace(/o/g, 'a')
      .replace(/th/g, 't')
      .replace(/dh/g, 'd')
      .replace(/bh/g, 'b')
      .replace(/kh/g, 'k')
      .replace(/gh/g, 'g')
      .replace(/ch/g, 'c')
      .replace(/jh/g, 'j')
      .replace(/sh/g, 's')
      .replace(/z/g, 'j')
      .replace(/w/g, 'v')
      .replace(/q/g, 'k')
      .replace(/e$/g, '')
      .replace(/h$/g, '')
      .trim();
  }

  function levenshteinDistance(s1, s2) {
    if (s1 === s2) return 0;
    if (!s1.length) return s2.length;
    if (!s2.length) return s1.length;
    const d = [];
    for (let i = 0; i <= s1.length; i++) d[i] = [i];
    for (let j = 0; j <= s2.length; j++) d[0][j] = j;
    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost
        );
      }
    }
    return d[s1.length][s2.length];
  }

  function stringSimilarity(s1, s2) {
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;
    return 1.0 - (levenshteinDistance(s1, s2) / maxLen);
  }

  // Known Bangladeshi bank acronyms and aliases (matched to Bangladesh Bank 3-digit bank codes)
  const KNOWN_BANKS_MAP = [
    { code: '010', names: ['agrani bank', 'agrani', 'অগ্রণী ব্যাংক', 'অগ্রণী'] },
    { code: '015', names: ['aibl', 'al arafah islami bank', 'al-arafah islami bank', 'al arafah', 'al-arafah', 'আল-আরাফাহ ইসলামী ব্যাংক', 'আল আরাফাহ'] },
    { code: '020', names: ['ab bank', 'abbl', 'arab bangladesh bank', 'এবি ব্যাংক', 'আরব বাংলাদেশ ব্যাংক'] },
    { code: '025', names: ['bangladesh bank', 'bb', 'বাংলাদেশ ব্যাংক'] },
    { code: '030', names: ['bangladesh commerce bank', 'bcbl', 'বাংলাদেশ কমার্স ব্যাংক'] },
    { code: '035', names: ['bangladesh krishi bank', 'bkb', 'কৃষি ব্যাংক', 'বাংলাদেশ কৃষি ব্যাংক'] },
    { code: '040', names: ['bangladesh samabaya bank', 'সমবায় ব্যাংক'] },
    { code: '047', names: ['bangladesh development bank', 'bdbl', 'বাংলাদেশ ডেভেলপমেন্ট ব্যাংক', 'বিডিবিএল'] },
    { code: '055', names: ['basic bank', 'বেসিক ব্যাংক'] },
    { code: '060', names: ['brac bank', 'brac', 'ব্র্যাক ব্যাংক', 'ব্র্যাক'] },
    { code: '065', names: ['bank al falah', 'bank al-falah', 'আল-ফালাহ'] },
    { code: '070', names: ['bank asia', 'ব্যাংক এশিয়া'] },
    { code: '075', names: ['citibank', 'citibank n.a', 'সিটিব্যাংক'] },
    { code: '080', names: ['commercial bank of ceylon', 'ceylon bank'] },
    { code: '085', names: ['dhaka bank', 'dbl', 'ঢাকা ব্যাংক'] },
    { code: '090', names: ['dbbl', 'dutch bangla bank', 'dutch bangla', 'dutch-bangla', 'ডাচ বাংলা', 'ডাচ-বাংলা', 'ডাচ বাংলা ব্যাংক'] },
    { code: '095', names: ['eastern bank', 'ebl', 'ইস্টার্ন ব্যাংক', 'ইস্টার্ন'] },
    { code: '100', names: ['exim bank', 'exim', 'export import bank of bangladesh', 'এক্সিম ব্যাংক', 'এক্সিম'] },
    { code: '105', names: ['fsibl', 'first security islami bank', 'first security islamic bank', 'first security', 'ফার্স্ট সিকিউরিটি ইসলামী ব্যাংক', 'ফার্স্ট সিকিউরিটি'] },
    { code: '110', names: ['habib bank', 'hbl', 'habib bank ltd', 'হাবিব ব্যাংক'] },
    { code: '115', names: ['hsbc', 'hsbc bank', 'hongkong and shanghai banking'] },
    { code: '120', names: ['ific bank', 'ific', 'আইএফআইসি ব্যাংক', 'আইএফআইসি'] },
    { code: '125', names: ['ibbl', 'islami bank bangladesh', 'islami bank', 'islamic bank', 'ইসলামী ব্যাংক বাংলাদেশ', 'ইসলামী ব্যাংক'] },
    { code: '130', names: ['jamuna bank', 'যমুনা ব্যাংক'] },
    { code: '135', names: ['janata bank', 'janata', 'জনতা ব্যাংক', 'জনতা'] },
    { code: '140', names: ['mercantile bank', 'mbl', 'মার্কেন্টাইল ব্যাংক'] },
    { code: '145', names: ['mutual trust bank', 'mtb', 'mtbl', 'মিউচুয়াল ট্রাস্ট ব্যাংক'] },
    { code: '150', names: ['national bank', 'nbl', 'ন্যাশনাল ব্যাংক'] },
    { code: '155', names: ['national bank of pakistan'] },
    { code: '160', names: ['national credit & commerce bank', 'ncc bank', 'nccb', 'এনসিসি ব্যাংক', 'এনসিসি'] },
    { code: '165', names: ['one bank', 'obl', 'ওয়ান ব্যাংক'] },
    { code: '170', names: ['prime bank', 'prime', 'প্রাইম ব্যাংক', 'প্রাইম'] },
    { code: '175', names: ['pubali bank', 'pubali', 'পূবালী ব্যাংক', 'পূবালী'] },
    { code: '180', names: ['rajshahi krishi unnayan bank', 'rakub', 'রাকাব', 'রাজশাহী কৃষি উন্নয়ন ব্যাংক'] },
    { code: '185', names: ['rupali bank', 'rupali', 'রূপালী ব্যাংক', 'রূপালী'] },
    { code: '190', names: ['sjibl', 'shahjalal islami bank', 'shahjalal', 'শাহজালাল ইসলামী ব্যাংক', 'শাহজালাল'] },
    { code: '195', names: ['sibl', 'social islami bank', 'সোশ্যাল ইসলামী ব্যাংক', 'সোশ্যাল'] },
    { code: '200', names: ['sonali bank', 'sonali', 'সোনালী ব্যাংক', 'সোনালী'] },
    { code: '205', names: ['southeast bank', 'sebl', 'সাউথইস্ট ব্যাংক'] },
    { code: '210', names: ['standard islami bank', 'standard bank', 'স্ট্যান্ডার্ড ব্যাংক', 'স্ট্যান্ডার্ড ইসলামী ব্যাংক'] },
    { code: '215', names: ['standard chartered', 'scb', 'standard chartered bank', 'স্ট্যান্ডার্ড চার্টার্ড'] },
    { code: '220', names: ['state bank of india', 'sbi'] },
    { code: '225', names: ['the city bank', 'city bank', 'cbl', 'সিটি ব্যাংক'] },
    { code: '230', names: ['icb islamic bank', 'icb islamic', 'icb'] },
    { code: '235', names: ['the premier bank', 'premier bank', 'প্রিমিয়ার ব্যাংক'] },
    { code: '240', names: ['trust bank', 'tbl', 'ট্রাস্ট ব্যাংক'] },
    { code: '245', names: ['united commercial bank', 'ucb', 'ucbl', 'ইউসিবি', 'ইউনাইটেড কমার্শিয়াল ব্যাংক'] },
    { code: '250', names: ['uttara bank', 'উত্তরা ব্যাংক'] },
    { code: '255', names: ['woori bank', 'উরি ব্যাংক'] },
    { code: '260', names: ['nrb commercial bank', 'nrbc bank', 'nrbc', 'এনআরবি কমার্শিয়াল ব্যাংক'] },
    { code: '265', names: ['union bank', 'ইউনিয়ন ব্যাংক'] },
    { code: '270', names: ['sbac bank', 'south bangla agriculture', 'এসবিএসি ব্যাংক'] },
    { code: '275', names: ['meghna bank', 'মেঘনা ব্যাংক'] },
    { code: '280', names: ['padma bank', 'পদ্মা ব্যাংক'] },
    { code: '285', names: ['midland bank', 'মিডল্যান্ড ব্যাংক'] },
    { code: '290', names: ['nrb bank', 'এনআরবি ব্যাংক'] },
    { code: '295', names: ['modhumoti bank', 'মধুমতি ব্যাংক'] },
    { code: '300', names: ['gibl', 'global islami bank', 'গ্লোবাল ইসলামী ব্যাংক', 'গ্লোবাল'] },
    { code: '305', names: ['shimanto bank', 'সীমান্ত ব্যাংক'] },
    { code: '310', names: ['community bank bangladesh', 'community bank', 'কমিউনিটি ব্যাংক'] },
    { code: '315', names: ['bengal commercial bank', 'বেঙ্গল কমার্শিয়াল ব্যাংক'] },
    { code: '320', names: ['citizens bank', 'সিটিজেন্স ব্যাংক'] }
  ];

  function findBank(text) {
    const norm = normalizeStr(text);
    if (!norm) return null;

    let bestMatch = null;
    let bestScore = 0;

    // 1. Check known aliases (prioritize longest, most specific match)
    for (const item of KNOWN_BANKS_MAP) {
      for (const alias of item.names) {
        const aNorm = normalizeStr(alias);
        const regex = new RegExp(`\\b${aNorm}\\b`, 'i');
        if (regex.test(norm)) {
          // Guard: Do not let generic 'islami bank' match if text specifies another Islamic bank
          if ((aNorm === 'islami bank' || aNorm === 'islamic bank' || aNorm === 'ইসলামী ব্যাংক') &&
              /first security|fsibl|social|sibl|al arafah|al-arafah|aibl|shahjalal|sjibl|global|gibl|icb|ফার্স্ট সিকিউরিটি|সোশ্যাল|আল আরাফাহ|শাহজালাল/i.test(norm)) {
            continue;
          }
          const score = aNorm.length * 10;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = banksDb.find(b => b.c === item.code);
          }
        }
      }
    }

    // 2. Check full database bank names and database aliases
    for (const b of banksDb) {
      const bNorm = normalizeStr(b.n).replace(/plc|ltd|limited|bank|ব্যাংক/gi, '').trim();
      if (bNorm.length > 2 && new RegExp(`\\b${bNorm}\\b`, 'i').test(norm)) {
        const score = bNorm.length * 10;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = b;
        }
      }
      if (b.al) {
        for (const a of b.al) {
          const aNorm = normalizeStr(a).replace(/plc|ltd|limited|bank|ব্যাংক/gi, '').trim();
          if (aNorm.length > 2 && new RegExp(`\\b${aNorm}\\b`, 'i').test(norm)) {
            const score = aNorm.length * 10;
            if (score > bestScore) {
              bestScore = score;
              bestMatch = b;
            }
          }
        }
      }
    }

    return bestMatch;
  }

  // --- SMART OFFLINE PARSER ---
  function parseMessageOffline(rawText) {
    if (!rawText || !rawText.trim()) return null;

    const lines = rawText.split(/\r?\n/)
      .map(l => cleanText(bengaliToLatinDigits(l)))
      .filter(l => l && !isUnwantedText(l));

    let detectedName = '';
    let detectedBank = null;
    let detectedBankName = '';
    let detectedAcc = '';
    let detectedBranchName = '';
    let detectedDistrict = '';
    let detectedThana = '';
    let detectedRouting = '';

    const consumed = new Set();

    // Pre-pass: Lines with BOTH Bank and Account number (e.g. "DBBL 2161030966332")
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const bankMatch = findBank(line);
      const accMatch = line.match(/\b(\d{10,20})\b/);
      if (bankMatch && accMatch) {
        detectedBank = bankMatch;
        detectedBankName = bankMatch.n;
        detectedAcc = accMatch[1];
        consumed.add(i);
        break;
      }
    }

    // Pre-pass 2: Lines with BOTH Account number and Branch (e.g. "No.20508370200078406 Guptachara Bazar Branch")
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const line = lines[i];
      const accMatch = line.match(/(?:no\.?|acc\.?|a\/c\.?|\b)(\d{11,20})\b/i);
      const branchWordMatch = line.match(/(?:branch|শাখা)/i);
      if (accMatch && branchWordMatch) {
        detectedAcc = accMatch[1];
        let rest = line.replace(/(?:no\.?|acc\.?|a\/c\.?|\b)\d{11,20}\b/i, '').trim();
        if (rest) detectedBranchName = rest;
        consumed.add(i);
        break;
      }
    }

    // Pass 1: Labeled Key-Value lines
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const line = lines[i];

      // Routing Number label
      if (/^(routing(\s*no|\s*number)?|রাউটিং(\s*নম্বর|\s*নং)?)\b/i.test(line)) {
        const rMatch = line.match(/(\d{9})/);
        if (rMatch) {
          detectedRouting = rMatch[1];
          consumed.add(i);
          continue;
        } else if (i + 1 < lines.length && /^\d{9}$/.test(lines[i + 1])) {
          detectedRouting = lines[i + 1];
          consumed.add(i);
          consumed.add(i + 1);
          i++;
          continue;
        }
      }

      // Account Number label (supports 'Ac=', 'A/C:', 'Account No -', etc.)
      if (/^(acc?(?:ount)?(?:\s*no|\s*number)?|a\/?c(?:\s*no)?|হিসাব(?:\s*নম্বর|\s*নং)?)\s*[:\-\/\u2013\u2014=]*/i.test(line)) {
        const m = line.match(/(?:acc?(?:ount)?(?:\s*no|\s*number)?|a\/?c(?:\s*no)?|হিসাব(?:\s*নম্বর|\s*নং)?)\s*[:\-\/\u2013\u2014=]*\s*([\d\-\.]{8,25})/i);
        if (m) {
          detectedAcc = m[1].replace(/[^\d]/g, '');
          consumed.add(i);
          continue;
        } else if (i + 1 < lines.length && /^[\d\-\.]{8,25}$/.test(lines[i + 1])) {
          detectedAcc = lines[i + 1].replace(/[^\d]/g, '');
          consumed.add(i);
          consumed.add(i + 1);
          i++;
          continue;
        }
      }

      // Account Name / Title label
      if (/^(?:acc(?:ount)?\s*(?:title|name)|account\s*holder(?:\s*name)?|acc?\s*name|name|a\/?c\s*(?:title|name)|হিসাবের\s*নাম|হিসাবধারীর\s*নাম|নাম|beneficiary(?:\s*name)?)\s*[:\-\/\u2013\u2014=]*/i.test(line)) {
        const isHeaderOnly = /^(?:acc(?:ount)?\s*(?:title|name)|account\s*holder(?:\s*name)?|acc?\s*name|name|a\/?c\s*(?:title|name)|হিসাবের\s*নাম|হিসাবধারীর\s*নাম|নাম|beneficiary(?:\s*name)?)\s*[:\-\/\u2013\u2014=]*$/i.test(line);
        if (isHeaderOnly && i + 1 < lines.length) {
          detectedName = lines[i + 1].trim();
          consumed.add(i);
          consumed.add(i + 1);
          i++;
          continue;
        } else {
          const m = line.match(/^(?:acc(?:ount)?\s*(?:title|name)|account\s*holder(?:\s*name)?|acc?\s*name|name|a\/?c\s*(?:title|name)|হিসাবের\s*নাম|হিসাবধারীর\s*নাম|নাম|beneficiary(?:\s*name)?)\s*[:\-\/\u2013\u2014=]+\s*(.+)/i);
          if (m && m[1].trim() && !/^[\d\-\.]+$/.test(m[1].trim())) {
            detectedName = m[1].trim();
            consumed.add(i);
            continue;
          }
        }
      }

      // District & Branch combined label (e.g. "Dist & Branch : Feni")
      if (/^(dist(?:rict)?\s*&\s*branch)\s*[:\-\/\u2013\u2014]*/i.test(line)) {
        const m = line.match(/^dist(?:rict)?\s*&\s*branch\s*[:\-\/\u2013\u2014]+\s*(.+)/i);
        if (m && m[1].trim()) {
          detectedBranchName = m[1].trim();
          detectedDistrict = m[1].trim();
          consumed.add(i);
          continue;
        }
      }

      // District label
      if (/^(district|জেলা)\b/i.test(line)) {
        const m = line.match(/^(?:district|জেলা)\s*[:\-\/\u2013\u2014\s]\s*(.+)/i);
        if (m && m[1].trim()) {
          detectedDistrict = m[1].trim();
          consumed.add(i);
          continue;
        }
      }

      // Thana label
      if (/^(thana|থানা|upazila|উপজেলা)\b/i.test(line)) {
        const m = line.match(/^(?:thana|থানা|upazila|উপজেলা)\s*[:\-\/\u2013\u2014\s]\s*(.+)/i);
        if (m && m[1].trim()) {
          detectedThana = m[1].trim();
          consumed.add(i);
          continue;
        }
      }

      // Branch label
      if (/^(branch(?:\s*name)?|শাখার?\s*নাম|শাখা)\b/i.test(line)) {
        const isHeaderOnly = /^(branch(?:\s*name)?|শাখার?\s*নাম|শাখা)\s*[:\-\/\u2013\u2014]*$/i.test(line);
        if (isHeaderOnly && i + 1 < lines.length) {
          detectedBranchName = lines[i + 1].trim();
          consumed.add(i);
          consumed.add(i + 1);
          i++;
          continue;
        } else {
          const m = line.match(/^(?:branch(?:\s*name)?|শাখার?\s*নাম|শাখা)\s*[:\-\/\u2013\u2014]*\s*(.+)/i);
          if (m && m[1].trim()) {
            detectedBranchName = m[1].trim();
            consumed.add(i);
            continue;
          }
        }
      }

      // Bank name label
      if (/^(bank(?:\s*name)?|ব্যাংকের?\s*নাম|ব্যাংক)\b/i.test(line)) {
        const m = line.match(/^(?:bank(?:\s*name)?|ব্যাংকের?\s*নাম|ব্যাংক)\s*[:\-\/\u2013\u2014]+\s*(.+)/i);
        if (m && m[1].trim()) {
          const b = findBank(m[1].trim());
          if (b) {
            detectedBank = b;
            detectedBankName = b.n;
          } else {
            detectedBankName = m[1].trim();
          }
          consumed.add(i);
          continue;
        }
      }
    }

    // Pass 2: Unlabeled Account Number
    if (!detectedAcc) {
      for (let i = 0; i < lines.length; i++) {
        if (consumed.has(i)) continue;
        const cleanDigits = lines[i].replace(/[^\d]/g, '');
        if (cleanDigits.length >= 8 && cleanDigits.length <= 20) {
          detectedAcc = cleanDigits;
          consumed.add(i);
          break;
        }
      }
    }

    // Pass 3: Bank detection from remaining lines
    if (!detectedBank) {
      for (let i = 0; i < lines.length; i++) {
        if (consumed.has(i)) continue;
        const b = findBank(lines[i]);
        if (b) {
          detectedBank = b;
          detectedBankName = b.n;
          consumed.add(i);
          break;
        }
      }
    }

    // Pass 4: Branch detection from remaining lines
    if (!detectedBranchName) {
      for (let i = 0; i < lines.length; i++) {
        if (consumed.has(i)) continue;
        const line = lines[i];
        if (/branch|শাখা|sub-branch|উপশাখা/i.test(line)) {
          detectedBranchName = line;
          consumed.add(i);
          break;
        }
      }
    }

    // Pass 5: Account Holder Name detection from remaining lines
    if (!detectedName) {
      for (let i = 0; i < lines.length; i++) {
        if (consumed.has(i)) continue;
        const line = lines[i];
        if (/^(md\.?|mohammad|mst\.?|mrs\.?|mr\.?|dr\.?|engr\.?|মো:|মুহাম্মদ)/i.test(line) ||
            (/^[A-Za-z\s\.\u0980-\u09FF]{3,45}$/.test(line) && !/bank|branch|district|thana|chittagong|dhaka/i.test(line))) {
          detectedName = line;
          consumed.add(i);
          break;
        }
      }
    }

    // Authoritative Routing Check: If 9-digit routing number is present,
    // verify/override the bank using the first 3 digits (Bangladesh Bank Bank Code)
    if (detectedRouting && detectedRouting.length === 9) {
      const routingBankCode = detectedRouting.substring(0, 3);
      const bankFromRt = banksDb.find(b => b.c === routingBankCode);
      if (bankFromRt) {
        detectedBank = bankFromRt;
        detectedBankName = bankFromRt.n;

        // If routing matches an exact branch, also extract its official branch name & district
        const exactBr = bankFromRt.b.find(br => br[0] === detectedRouting);
        if (exactBr) {
          if (!detectedBranchName) detectedBranchName = exactBr[1];
          if (!detectedDistrict) detectedDistrict = exactBr[2];
        }
      }
    }

    // Resolve routing number from detected bank & branch
    const routingResult = resolveRoutingNumber(detectedBank, detectedBranchName, detectedDistrict, detectedThana);

    return {
      name: detectedName,
      bank: detectedBank,
      bankName: detectedBank ? detectedBank.n : detectedBankName,
      bankCode: detectedBank ? detectedBank.c : '',
      accountNumber: detectedAcc,
      branchName: detectedBranchName,
      routingNumber: detectedRouting || routingResult.routing,
      routingSource: detectedRouting ? 'মেসেজ থেকে প্রাপ্ত' : routingResult.source,
      district: detectedDistrict || routingResult.district,
      matchedBranch: routingResult.branch,
      candidates: routingResult.candidates
    };
  }

  // Helper: Find exact routing number for bank + branch + district
  function resolveRoutingNumber(bankObj, branchQuery, districtQuery, thanaQuery) {
    if (!bankObj) {
      return { routing: '', source: '', district: '', branch: '', candidates: [] };
    }

    let specificQueries = [];
    if (branchQuery) {
      if (!districtQuery && branchQuery.includes(',')) {
        const parts = branchQuery.split(',').map(s => s.trim());
        for (const part of parts) {
          const pNorm = normalizeStr(part);
          if (bankObj.b.some(br => {
            const bDist = normalizeStr(br[2] || '');
            return bDist === pNorm ||
              (pNorm === 'bogura' && bDist === 'bogra') ||
              (pNorm === 'bogra' && bDist === 'bogura') ||
              (pNorm === 'chittagong' && bDist === 'chattogram') ||
              (pNorm === 'comilla' && bDist === 'cumilla') ||
              (pNorm === 'jessore' && bDist === 'jashore') ||
              (pNorm === 'barisal' && bDist === 'barishal');
          })) {
            districtQuery = part;
            break;
          }
        }
      }

      // Split parts by comma or slash
      const parts = branchQuery.split(/[,/]+/).map(p => p.trim()).filter(Boolean);
      parts.forEach(part => {
        let specific = part
          .replace(/branch|শাখা|sub\s*branch|uposhakha|উপশাখা|sme|corporate|bazar|বাজার|market|মার্কেট|road|রোড/gi, '')
          .trim();
        if (specific.length > 2) specificQueries.push(specific);
        let partClean = part.replace(/branch|শাখা|sub\s*branch|uposhakha|উপশাখা/gi, '').trim();
        if (partClean.length > 2 && partClean !== specific) specificQueries.push(partClean);
      });

      let specific = branchQuery
        .replace(/branch|শাখা|sub\s*branch|uposhakha|উপশাখা|sme|corporate|bazar|বাজার|market|মার্কেট|road|রোড/gi, '')
        .trim();
      if (specific.length > 2 && !specificQueries.includes(specific)) specificQueries.push(specific);
      specificQueries.push(branchQuery.replace(/branch|শাখা|sub\s*branch|uposhakha|উপশাখা/gi, '').trim());

      const words = branchQuery.split(/[\s,]+/).filter(Boolean);
      if (words.length > 1) {
        specificQueries.push(words[0]);
        specificQueries.push(words[words.length - 1]);
      }
    }

    if (thanaQuery) specificQueries.push(thanaQuery);
    if (districtQuery && !specificQueries.length) specificQueries.push(districtQuery);

    const distNorm = normalizeStr(districtQuery);
    let candidates = [];

    for (const q of specificQueries) {
      const qNorm = normalizeStr(q);
      if (!qNorm || qNorm.length < 2) continue;
      const qPhonetic = toPhonetic(qNorm);

      bankObj.b.forEach(br => {
        const [rNum, bName, brDist, aliases] = br;
        const bNorm = normalizeStr(bName).replace(/branch|শাখা/gi, '').trim();
        const branchDistNorm = normalizeStr(brDist || '').trim();
        const altNorms = (aliases || []).map(a => normalizeStr(a).replace(/branch|শাখা/gi, '').trim());

        const isDistMatch = distNorm && (
          branchDistNorm === distNorm ||
          branchDistNorm.includes(distNorm) ||
          distNorm.includes(branchDistNorm) ||
          (distNorm === 'chittagong' && branchDistNorm === 'chattogram') ||
          (distNorm === 'comilla' && branchDistNorm === 'cumilla') ||
          (distNorm === 'bogra' && branchDistNorm === 'bogura') ||
          (distNorm === 'jessore' && branchDistNorm === 'jashore') ||
          (distNorm === 'barisal' && branchDistNorm === 'barishal')
        );

        if (distNorm && !isDistMatch) return;

        let score = 0;
        if (bNorm === qNorm) score = 100;
        else if (altNorms.includes(qNorm)) score = 95;
        else if (bNorm.includes(qNorm) || qNorm.includes(bNorm)) score = 85;
        else if (altNorms.some(a => a.includes(qNorm) || qNorm.includes(a))) score = 80;
        else if (branchDistNorm === qNorm) score = 75;
        else if (toPhonetic(bNorm) === qPhonetic) score = 75;
        else {
          // Fuzzy transliteration similarity (e.g. Digpait vs DIGPITE, Ashulia vs Asulia)
          const sim = stringSimilarity(bNorm, qNorm);
          const pSim = stringSimilarity(toPhonetic(bNorm), qPhonetic);
          const maxSim = Math.max(sim, pSim);
          if (maxSim >= 0.65) {
            score = Math.round(maxSim * 68);
          }
        }

        if (score > 0) {
          if (isDistMatch) score += 20;
          candidates.push({
            routing: rNum,
            name: bName,
            district: brDist,
            score
          });
        }
      });

      if (candidates.length > 0) break;
    }

    // Fallback for sub-branches: If no candidate matched by branch name, but district is known and bank only has 1 branch in that district
    if (!candidates.length && distNorm) {
      const distBranches = bankObj.b.filter(br => {
        const branchDistNorm = normalizeStr(br[2] || '').trim();
        return branchDistNorm === distNorm ||
          (distNorm === 'bogra' && branchDistNorm === 'bogura') ||
          (distNorm === 'bogura' && branchDistNorm === 'bogra') ||
          (distNorm === 'chittagong' && branchDistNorm === 'chattogram') ||
          (distNorm === 'comilla' && branchDistNorm === 'cumilla') ||
          (distNorm === 'jessore' && branchDistNorm === 'jashore') ||
          (distNorm === 'barisal' && branchDistNorm === 'barishal');
      });
      if (distBranches.length === 1) {
        candidates.push({
          routing: distBranches[0][0],
          name: distBranches[0][1],
          district: distBranches[0][2],
          score: 75
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    return {
      routing: candidates.length ? candidates[0].routing : '',
      source: 'অটো-ডিটেক্টেড ✓',
      district: candidates.length ? candidates[0].district : '',
      branch: candidates.length ? candidates[0].name : '',
      candidates: candidates
    };
  }

  // --- GEMINI AI PARSER ---
  async function parseWithGeminiAI(rawText) {
    if (!geminiApiKey) {
      openAiModal();
      showToast('অনুগ্রহ করে প্রথমে আপনার ফ্রি Gemini API Key দিন!', 'error');
      return null;
    }

    const systemPrompt = `You are a specialized Bangladeshi banking data extractor and routing lookup expert.
Extract the banking fields from the customer message into JSON.
Refer to official Bangladesh Bank directory and banksbd.org knowledge base for Bangladesh routing numbers.
RULES:
1. Ignore all unwanted text like amounts ("100k", "2000 BDT", "5000 tk", "81900 tk", "63900 Tk"), fees, conditions, phone numbers, warnings, or notes.
2. Return JSON with exact keys:
   - "name": Account holder / title / beneficiary name.
   - "bankName": Official bank name in Bangladesh (e.g. "PUBALI BANK PLC", "DUTCH-BANGLA BANK PLC", "BRAC BANK PLC", "ISLAMI BANK BANGLADESH PLC", "FIRST SECURITY ISLAMI BANK PLC", "PRIME BANK PLC", "UNITED COMMERCIAL BANK PLC").
   - "accountNumber": Clean digits without spaces, hyphens or dots.
   - "branchName": Specific branch, sub-branch or area (e.g. "Joypurhat", "PARBOTIPUR", "Ashulia", "Digpait", "Guptachara Bazar", "Burichang", "Mymensingh", "Feni").
   - "district": District name if mentioned or known (e.g. "Jamalpur", "Joypurhat", "Dinajpur", "Dhaka", "Chittagong", "Feni", "Cumilla").
   - "routingNumber": 9-digit official routing number (look up from banksbd.org/Bangladesh Bank directory if known for this bank & branch, or extract from message), otherwise null.`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: `${systemPrompt}\n\nCustomer message to extract:\n\"\"\"\n${rawText}\n\"\"\"` }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    };

    // Use latest Gemini models: gemini-3.8-flash first, followed by available fallbacks
    const models = [
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-2.5-flash'
    ];
    let lastError = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) throw new Error('AI থেকে কোনো রেসপন্স পাওয়া যায়নি');

        let jsonStr = candidateText.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        }
        const parsedJson = JSON.parse(jsonStr);

        // Find bank in our database using AI's bankName
        let detectedBank = findBank(parsedJson.bankName || '');
        const cleanAcc = (parsedJson.accountNumber || '').toString().replace(/[^\d]/g, '');

        // Resolve routing using AI's bank + branch + district
        let routingNumber = (parsedJson.routingNumber || '').toString().replace(/[^\d]/g, '');

        // Authoritative: If 9-digit routing number is present, verify/override bank from first 3 digits
        if (routingNumber && routingNumber.length === 9) {
          const routingBankCode = routingNumber.substring(0, 3);
          const bankFromRt = banksDb.find(b => b.c === routingBankCode);
          if (bankFromRt) {
            detectedBank = bankFromRt;
          }
        }

        let routingResult = { routing: '', source: '', district: '', branch: '', candidates: [] };

        if (!routingNumber && detectedBank) {
          routingResult = resolveRoutingNumber(detectedBank, parsedJson.branchName, parsedJson.district, '');
          routingNumber = routingResult.routing;
        } else if (routingNumber && detectedBank) {
          routingResult = resolveRoutingNumber(detectedBank, parsedJson.branchName, parsedJson.district, '');
        }

        return {
          name: parsedJson.name || '',
          bank: detectedBank,
          bankName: detectedBank ? detectedBank.n : (parsedJson.bankName || ''),
          bankCode: detectedBank ? detectedBank.c : '',
          accountNumber: cleanAcc,
          branchName: parsedJson.branchName || '',
          routingNumber: routingNumber,
          routingSource: parsedJson.routingNumber ? 'মেসেজ থেকে (AI)' : (routingNumber ? 'AI + অটো-রাউটিং ✓' : ''),
          district: parsedJson.district || routingResult.district,
          matchedBranch: routingResult.branch,
          candidates: routingResult.candidates,
          isAi: true
        };

      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} failed:`, err.message);
      }
    }

    throw lastError || new Error('Gemini API কল সফল হয়নি');
  }

  // --- RENDER PARSED RESULT ---
  function displayParsedResult(result) {
    currentParsedResult = result;

    if (!result) {
      emptyState.classList.remove('hidden');
      resultView.classList.add('hidden');
      parserStatusTag.textContent = 'ইনপুটের অপেক্ষায়';
      parserStatusTag.className = 'badge badge-waiting';
      return;
    }

    emptyState.classList.add('hidden');
    resultView.classList.remove('hidden');

    // Status Badge
    if (result.isAi) {
      parserStatusTag.textContent = '✨ Gemini AI পার্সড ✓';
      parserStatusTag.className = 'badge badge-ai';
    } else {
      parserStatusTag.textContent = 'পার্স সম্পন্ন ✓';
      parserStatusTag.className = 'badge badge-success';
    }

    // Populate Fields
    fieldName.value = result.name || '';
    fieldBank.value = result.bankName || '';
    fieldAcc.value = result.accountNumber || '';
    fieldBranch.value = result.branchName || '';
    fieldRouting.value = result.routingNumber || '';

    // Badges
    bankCodeBadge.textContent = result.bankCode ? `ব্যাংক কোড: ${result.bankCode}` : 'কোড: ---';
    accLenBadge.textContent = result.accountNumber ? `${result.accountNumber.length} ডিজিট` : '০ ডিজিট';
    branchDistBadge.textContent = result.district ? `জেলা: ${result.district}` : 'জেলা: ---';

    // Featured Routing Display
    updateRoutingCard(result.routingNumber, result.routingSource, result.bankCode);

    // Candidates Switcher
    renderCandidateBranches(result.candidates, result.routingNumber);

    // Update Dynamic BanksBD.org Search Link
    updateBanksBdSearchLink(result.bankName, result.branchName);
  }

  function updateBanksBdSearchLink(bankName, branchName) {
    const linkBanksBd = document.getElementById('link-search-banksbd');
    if (!linkBanksBd) return;

    const bName = (bankName || fieldBank.value || '').trim();
    const brName = (branchName || fieldBranch.value || '').trim();

    if (bName || brName) {
      linkBanksBd.href = `https://www.google.com/search?q=site:banksbd.org+${encodeURIComponent(bName + ' ' + brName + ' routing')}`;
      linkBanksBd.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span>🌐 BanksBD.org-এ '${brName || bName}' দেখুন ↗</span>
      `;
      linkBanksBd.title = `BanksBD.org-এ ${bName} ${brName} ব্রাঞ্চের তথ্য সরাসরি দেখুন`;
    } else {
      linkBanksBd.href = 'https://www.banksbd.org/';
      linkBanksBd.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span>🌐 BanksBD.org-এ ১-ক্লিকে দেখুন ↗</span>
      `;
      linkBanksBd.title = 'BanksBD.org-এ সরাসরি ব্রাউজ করুন';
    }
  }

  function updateRoutingCard(routingNumber, source, bankCode) {
    if (routingNumber && routingNumber.length === 9) {
      displayRoutingNumber.textContent = routingNumber;
      fieldRouting.value = routingNumber;
      routingSourceBadge.textContent = source || 'অটো-ডিটেক্টেড ✓';
      routingSourceBadge.className = 'badge badge-success';

      bdBankCode.textContent = routingNumber.substring(0, 3);
      bdDistCode.textContent = routingNumber.substring(3, 5);
      bdBranchCode.textContent = routingNumber.substring(5, 8);
      bdCheckDigit.textContent = routingNumber.substring(8, 9);
    } else {
      displayRoutingNumber.textContent = 'পাওয়া যায়নি';
      fieldRouting.value = '';
      routingSourceBadge.textContent = 'ব্রাঞ্চ সিলেক্ট করুন';
      routingSourceBadge.className = 'badge badge-waiting';
      bdBankCode.textContent = bankCode || '---';
      bdDistCode.textContent = '--';
      bdBranchCode.textContent = '---';
      bdCheckDigit.textContent = '-';
    }
  }

  function renderCandidateBranches(candidates, currentRouting) {
    if (!candidates || candidates.length <= 1) {
      candidatesBox.classList.add('hidden');
      candidatesList.innerHTML = '';
      return;
    }

    candidatesBox.classList.remove('hidden');
    candidatesList.innerHTML = '';

    candidates.slice(0, 5).forEach(c => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `candidate-pill ${c.routing === currentRouting ? 'active' : ''}`;
      pill.innerHTML = `<span>${c.name} (${c.district})</span> <code>${c.routing}</code>`;
      pill.addEventListener('click', () => {
        fieldBranch.value = c.name;
        fieldRouting.value = c.routing;
        branchDistBadge.textContent = `জেলা: ${c.district}`;
        updateRoutingCard(c.routing, 'ব্যবহারকারীর নির্বাচিত', bdBankCode.textContent);
        
        candidatesList.querySelectorAll('.candidate-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        showToast(`ব্রাঞ্চ পরিবর্তিত: ${c.name}`);
      });
      candidatesList.appendChild(pill);
    });
  }

  // --- COPY OPERATIONS ---
  function copyToClipboard(text, successMsg) {
    if (!text) {
      showToast('কপি করার জন্য কোনো তথ্য পাওয়া যায়নি!', 'error');
      return Promise.reject('No text');
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg || 'কপি হয়েছে! ✓');
      }).catch(() => fallbackCopy(text, successMsg));
    } else {
      fallbackCopy(text, successMsg);
      return Promise.resolve();
    }
  }

  function fallbackCopy(text, successMsg) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast(successMsg || 'কপি হয়েছে! ✓');
    } catch (e) {
      showToast('কপি ব্যর্থ হয়েছে, ম্যানুয়ালি কপি করুন!', 'error');
    }
    document.body.removeChild(textarea);
  }

  function attachCopyFeedback(button) {
    const originalHtml = button.innerHTML;
    button.classList.add('copied');
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      <span>কপি হয়েছে!</span>
    `;
    setTimeout(() => {
      button.classList.remove('copied');
      button.innerHTML = originalHtml;
    }, 1800);
  }

  function copyAllDetails() {
    const name = fieldName.value.trim();
    const bank = fieldBank.value.trim();
    const acc = fieldAcc.value.trim();
    const branch = fieldBranch.value.trim();
    const routing = fieldRouting.value.trim();
    const district = branchDistBadge.textContent.replace('জেলা: ', '').trim();

    if (!bank && !acc && !name) {
      showToast('কপি করার জন্য কোনো তথ্য নেই!', 'error');
      return;
    }

    const format = document.querySelector('input[name="copy-format"]:checked')?.value || 'beftn';
    let outputText = '';

    if (format === 'beftn') {
      outputText = [
        `Beneficiary Name: ${name}`,
        `Bank Name: ${bank}`,
        `Account Number: ${acc}`,
        `Branch Name: ${branch}`,
        `Routing Number: ${routing}`,
        district && district !== '---' ? `District: ${district}` : ''
      ].filter(Boolean).join('\n');
    } else if (format === 'bangla') {
      outputText = [
        `হিসাবের নাম: ${name}`,
        `ব্যাংকের নাম: ${bank}`,
        `অ্যাকাউন্ট নম্বর: ${acc}`,
        `ব্রাঞ্চের নাম: ${branch}`,
        `রাউটিং নম্বর: ${routing}`,
        district && district !== '---' ? `জেলা: ${district}` : ''
      ].filter(Boolean).join('\n');
    } else if (format === 'table') {
      outputText = `${name}\t${bank}\t${acc}\t${branch}\t${routing}\t${district}`;
    }

    copyToClipboard(outputText, 'সমস্ত তথ্য একসাথে কপি করা হয়েছে! ✓').then(() => {
      attachCopyFeedback(btnCopyAll);
      saveToHistory();
    });
  }

  // --- TOAST NOTIFICATION ---
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'error') {
      toast.style.borderColor = 'var(--accent-rose)';
      toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-rose)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <span>${message}</span>
      `;
    } else {
      toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>${message}</span>
      `;
    }

    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2800);
  }

  // --- AI MODAL & SETTINGS ---
  function updateAiStatusUI() {
    if (geminiApiKey) {
      if (headerAiStatusText) headerAiStatusText.textContent = 'Gemini AI সক্রিয় ✓';
      if (btnOpenAiSettings) btnOpenAiSettings.classList.add('has-key');
      if (apiStatusPill) {
        apiStatusPill.textContent = 'কী সংরক্ষিত আছে ✓';
        apiStatusPill.className = 'badge badge-success';
      }
    } else {
      if (headerAiStatusText) headerAiStatusText.textContent = 'Gemini AI সেটআপ';
      if (btnOpenAiSettings) btnOpenAiSettings.classList.remove('has-key');
      if (apiStatusPill) {
        apiStatusPill.textContent = 'কোনো API Key সেট করা নেই';
        apiStatusPill.className = 'badge badge-waiting';
      }
    }
    if (aiAutoUseToggle) aiAutoUseToggle.checked = geminiAutoUse;
  }

  function openAiModal() {
    aiApiKeyInput.value = geminiApiKey;
    aiAutoUseToggle.checked = geminiAutoUse;
    aiModal.classList.remove('hidden');
    aiApiKeyInput.focus();
  }

  function closeAiModal() {
    aiModal.classList.add('hidden');
  }

  function saveAiSettings() {
    const key = aiApiKeyInput.value.trim();
    geminiApiKey = key;
    geminiAutoUse = aiAutoUseToggle.checked;
    
    localStorage.setItem(GEMINI_API_KEY_STORAGE, key);
    localStorage.setItem(GEMINI_AUTO_USE_STORAGE, geminiAutoUse ? 'true' : 'false');

    updateAiStatusUI();
    closeAiModal();
    showToast(key ? 'Gemini API Key সংরক্ষিত হয়েছে! ✓' : 'API Key মুছে ফেলা হয়েছে');
  }

  function removeAiKey() {
    geminiApiKey = '';
    aiApiKeyInput.value = '';
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    updateAiStatusUI();
    showToast('API Key সফলভাবে মুছে ফেলা হয়েছে');
  }

  // --- HISTORY SYSTEM ---
  function loadHistory() {
    try {
      const data = localStorage.getItem(HISTORY_STORAGE_KEY);
      historyItems = data ? JSON.parse(data) : [];
    } catch (e) {
      historyItems = [];
    }
    renderHistory();
  }

  function saveToHistory() {
    const name = fieldName.value.trim();
    const bank = fieldBank.value.trim();
    const acc = fieldAcc.value.trim();
    const branch = fieldBranch.value.trim();
    const routing = fieldRouting.value.trim();
    const district = branchDistBadge.textContent.replace('জেলা: ', '').trim();

    if (!acc && !name) return;

    const duplicate = historyItems.find(h => h.acc === acc && h.bank === bank);
    if (!duplicate) {
      historyItems.unshift({
        id: Date.now(),
        time: new Date().toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' }),
        name,
        bank,
        acc,
        branch,
        routing,
        district
      });

      if (historyItems.length > 30) historyItems.pop();
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyItems));
      } catch (e) {}
      renderHistory();
      showToast('হিস্টোরিতে সংরক্ষিত হয়েছে');
    }
  }

  function renderHistory() {
    if (historyBadge) {
      historyBadge.textContent = historyItems.length.toLocaleString('bn-BD');
    }

    if (!historyItems.length) {
      historyEmpty.classList.remove('hidden');
      historyList.classList.add('hidden');
      return;
    }

    historyEmpty.classList.add('hidden');
    historyList.classList.remove('hidden');
    historyList.innerHTML = '';

    historyItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="history-time">🕒 ${item.time}</div>
        <div class="history-name">${item.name || 'নাম নেই'}</div>
        <div class="history-bank">${item.bank} • ${item.branch || 'ব্রাঞ্চ নেই'}</div>
        <div class="history-acc">A/C: ${item.acc} ${item.routing ? `| RT: <strong>${item.routing}</strong>` : ''}</div>
        <div class="history-actions">
          <button class="btn btn-secondary btn-sm load-hist-btn">পুনরায় লোড</button>
          <button class="btn btn-primary btn-sm copy-hist-btn">কপি করুন</button>
        </div>
      `;

      card.querySelector('.load-hist-btn').addEventListener('click', () => {
        fieldName.value = item.name;
        fieldBank.value = item.bank;
        fieldAcc.value = item.acc;
        fieldBranch.value = item.branch;
        fieldRouting.value = item.routing;
        updateRoutingCard(item.routing, 'হিস্টোরি থেকে');
        emptyState.classList.add('hidden');
        resultView.classList.remove('hidden');
        document.getElementById('tab-btn-parser').click();
        showToast('হিস্টোরি থেকে লোড করা হয়েছে');
      });

      card.querySelector('.copy-hist-btn').addEventListener('click', () => {
        const text = `Beneficiary Name: ${item.name}\nBank: ${item.bank}\nAccount: ${item.acc}\nBranch: ${item.branch}\nRouting: ${item.routing}`;
        copyToClipboard(text, 'হিস্টোরি আইটেম কপি হয়েছে! ✓');
      });

      historyList.appendChild(card);
    });
  }

  // --- SEARCH TAB ---
  function populateSearchFilters() {
    if (!banksDb.length) return;

    searchBankSelect.innerHTML = '<option value="">-- সকল ব্যাংক (৬৩টি প্রতিষ্ঠান) --</option>';
    const sortedBanks = [...banksDb].sort((a, b) => a.n.localeCompare(b.n));
    sortedBanks.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.c;
      opt.textContent = `${b.n} (${b.b ? b.b.length : 0} ব্রাঞ্চ)`;
      searchBankSelect.appendChild(opt);
    });

    const districtSet = new Set();
    banksDb.forEach(b => {
      b.b.forEach(br => {
        if (br[2]) districtSet.add(br[2]);
      });
    });

    const sortedDistricts = Array.from(districtSet).sort();
    searchDistrictSelect.innerHTML = '<option value="">-- সকল জেলা (৬৪টি জেলা) --</option>';
    sortedDistricts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      searchDistrictSelect.appendChild(opt);
    });
  }

  function renderSearchTable() {
    const selectedBankCode = searchBankSelect.value;
    const selectedDistrict = searchDistrictSelect.value;
    const query = searchQueryInput.value.trim().toLowerCase();

    let matches = [];
    const maxResults = 100;

    for (const b of banksDb) {
      if (selectedBankCode && b.c !== selectedBankCode) continue;

      for (const br of b.b) {
        const [routing, brName, district, aliases] = br;
        if (selectedDistrict && district !== selectedDistrict) continue;

        if (query) {
          const matchRouting = routing.includes(query);
          const matchName = brName.toLowerCase().includes(query);
          const matchDist = (district || '').toLowerCase().includes(query);
          const matchAlias = (aliases || []).some(a => a.toLowerCase().includes(query));

          let matchFuzzy = false;
          if (!matchRouting && !matchName && !matchDist && !matchAlias) {
            const qPhone = toPhonetic(query);
            const bPhone = toPhonetic(brName);
            if (bPhone.includes(qPhone) || qPhone.includes(bPhone) || stringSimilarity(bPhone, qPhone) >= 0.68) {
              matchFuzzy = true;
            }
          }

          if (!matchRouting && !matchName && !matchDist && !matchAlias && !matchFuzzy) continue;
        }

        matches.push({
          bankName: b.n,
          branchName: brName,
          routing: routing,
          district: district || 'N/A'
        });

        if (matches.length >= maxResults) break;
      }
      if (matches.length >= maxResults) break;
    }

    searchResultsCount.textContent = `মোট প্রদর্শিত ফলাফল: ${matches.length}টি ${matches.length >= maxResults ? '(শীর্ষ ১০০টি দেখানো হচ্ছে)' : ''}`;

    branchesTableBody.innerHTML = '';
    if (matches.length === 0) {
      branchesTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">কোনো ব্রাঞ্চ বা রাউটিং নম্বর পাওয়া যায়নি</td></tr>';
      return;
    }

    matches.forEach(m => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="routing-cell">${m.routing}</td>
        <td>${m.bankName}</td>
        <td>${m.branchName}</td>
        <td>${m.district}</td>
        <td>
          <button class="btn btn-secondary btn-sm copy-table-routing-btn" data-routing="${m.routing}">
            কপি
          </button>
        </td>
      `;

      tr.querySelector('.copy-table-routing-btn').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        copyToClipboard(m.routing, `রাউটিং নম্বর ${m.routing} কপি হয়েছে! ✓`).then(() => {
          attachCopyFeedback(btn);
        });
      });

      branchesTableBody.appendChild(tr);
    });
  }

  // --- EVENT LISTENERS ---
  function initEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // AI Modal Triggers
    btnOpenAiSettings.addEventListener('click', openAiModal);
    btnCloseAiModal.addEventListener('click', closeAiModal);
    btnCancelAiModal.addEventListener('click', closeAiModal);
    btnSaveApiKey.addEventListener('click', saveAiSettings);
    btnRemoveApiKey.addEventListener('click', removeAiKey);

    aiModal.addEventListener('click', (e) => {
      if (e.target === aiModal) closeAiModal();
    });

    aiKeyToggleVisibility.addEventListener('click', () => {
      if (aiApiKeyInput.type === 'password') {
        aiApiKeyInput.type = 'text';
        aiKeyToggleVisibility.textContent = '🔒';
      } else {
        aiApiKeyInput.type = 'password';
        aiKeyToggleVisibility.textContent = '👁️';
      }
    });

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetTab = document.getElementById(btn.getAttribute('data-tab'));
        if (targetTab) targetTab.classList.add('active');
      });
    });

    // Standard Parse button (Offline)
    btnParse.addEventListener('click', () => {
      const text = rawInput.value;
      if (!text || !text.trim()) {
        showToast('অনুগ্রহ করে মেসেজ পেস্ট করুন!', 'error');
        return;
      }
      const res = parseMessageOffline(text);
      displayParsedResult(res);
      if (res) showToast('মেসেজ সফলভাবে পার্স করা হয়েছে! ✓');
    });

    // Gemini AI Parse button
    btnParseAi.addEventListener('click', async () => {
      const text = rawInput.value;
      if (!text || !text.trim()) {
        showToast('অনুগ্রহ করে মেসেজ পেস্ট করুন!', 'error');
        return;
      }

      if (!geminiApiKey) {
        openAiModal();
        showToast('Gemini AI দিয়ে পার্স করতে প্রথমে ফ্রি API Key দিন', 'error');
        return;
      }

      btnParseAi.classList.add('loading');
      btnParseAi.disabled = true;
      const originalText = btnParseAi.innerHTML;
      btnParseAi.innerHTML = `<span>⏳ AI বিশ্লেষণ করছে...</span>`;

      try {
        const res = await parseWithGeminiAI(text);
        if (res) {
          displayParsedResult(res);
          showToast('✨ Gemini AI সফলভাবে তথ্য বের করেছে! ✓');
        }
      } catch (err) {
        showToast(`AI পার্স ত্রুটি: ${err.message}. সাধারণ পার্সার চালানো হচ্ছে...`, 'error');
        // Fallback to offline parser
        const fallbackRes = parseMessageOffline(text);
        displayParsedResult(fallbackRes);
      } finally {
        btnParseAi.classList.remove('loading');
        btnParseAi.disabled = false;
        btnParseAi.innerHTML = originalText;
      }
    });

    // Keyboard shortcut (Ctrl + Enter)
    rawInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (geminiAutoUse && geminiApiKey) {
          btnParseAi.click();
        } else {
          btnParse.click();
        }
      }
    });

    // Input stats & auto-parse
    rawInput.addEventListener('input', () => {
      const text = rawInput.value;
      const charCount = text.length;
      const lineCount = text ? text.split(/\r?\n/).length : 0;
      inputStats.textContent = `${charCount.toLocaleString('bn-BD')} অক্ষর • ${lineCount.toLocaleString('bn-BD')} লাইন`;

      if (autoParseEnabled && text.trim().length > 10) {
        clearTimeout(rawInput._parseTimer);
        rawInput._parseTimer = setTimeout(() => {
          if (geminiAutoUse && geminiApiKey) {
            btnParseAi.click();
          } else {
            const res = parseMessageOffline(text);
            displayParsedResult(res);
          }
        }, 350);
      }
    });

    autoParseToggle.addEventListener('change', (e) => {
      autoParseEnabled = e.target.checked;
    });

    // Clear button
    btnClear.addEventListener('click', () => {
      rawInput.value = '';
      rawInput.focus();
      inputStats.textContent = '০ অক্ষর • ০ লাইন';
      displayParsedResult(null);
      showToast('ইনপুট পরিষ্কার করা হয়েছে');
    });

    // Paste from clipboard button
    btnPasteClipboard.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            rawInput.value = text;
            rawInput.dispatchEvent(new Event('input'));
            if (geminiAutoUse && geminiApiKey) {
              btnParseAi.click();
            } else {
              btnParse.click();
            }
            showToast('ক্লিপবোর্ড থেকে পেস্ট করা হয়েছে! ✓');
          } else {
            showToast('ক্লিপবোর্ডে কোনো লেখা নেই!', 'error');
          }
        } else {
          showToast('ব্রাউজারে ক্লিপবোর্ড পারমিশন দিন বা Ctrl+V চাপুন', 'error');
        }
      } catch (err) {
        showToast('ক্লিপবোর্ড থেকে রিড করা সম্ভব হয়নি, Ctrl+V দিয়ে পেস্ট করুন', 'error');
      }
    });



    // Copy single fields
    document.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-copy-target');
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          const val = targetEl.value || targetEl.textContent;
          copyToClipboard(val, 'কপি হয়েছে! ✓').then(() => {
            attachCopyFeedback(btn);
          });
        }
      });
    });

    // Copy All button
    btnCopyAll.addEventListener('click', copyAllDetails);

    // Dynamic BanksBD search link updates on field changes
    fieldBank.addEventListener('input', () => updateBanksBdSearchLink(fieldBank.value, fieldBranch.value));
    fieldBranch.addEventListener('input', () => updateBanksBdSearchLink(fieldBank.value, fieldBranch.value));

    // Save history button
    btnSaveHistory.addEventListener('click', saveToHistory);

    // Clear history button
    btnClearHistory.addEventListener('click', () => {
      if (confirm('আপনি কি সমস্ত সংরক্ষিত হিস্টোরি মুছে ফেলতে চান?')) {
        historyItems = [];
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        renderHistory();
        showToast('সমস্ত হিস্টোরি মুছে ফেলা হয়েছে');
      }
    });

    // Search filters listeners
    searchBankSelect.addEventListener('change', renderSearchTable);
    searchDistrictSelect.addEventListener('change', renderSearchTable);
    searchQueryInput.addEventListener('input', () => {
      if (searchQueryInput.value.trim()) {
        searchClearBtn.classList.remove('hidden');
      } else {
        searchClearBtn.classList.add('hidden');
      }
      renderSearchTable();
    });

    searchClearBtn.addEventListener('click', () => {
      searchQueryInput.value = '';
      searchClearBtn.classList.add('hidden');
      renderSearchTable();
    });

    // Re-evaluate routing when user manually edits branch
    fieldBranch.addEventListener('input', () => {
      if (currentParsedResult && currentParsedResult.bank) {
        const cleanQuery = normalizeStr(fieldBranch.value)
          .replace(/branch|শাখা/gi, '')
          .trim();
        const found = currentParsedResult.bank.b.find(br => {
          return normalizeStr(br[1]).includes(cleanQuery) ||
                 normalizeStr(br[2] || '').includes(cleanQuery);
        });
        if (found) {
          updateRoutingCard(found[0], 'ম্যানুয়াল এডিটেড ✓', currentParsedResult.bank.c);
          branchDistBadge.textContent = `জেলা: ${found[2] || '---'}`;
        }
      }
    });
  }

  // --- PWA & OFFLINE CACHE SYSTEM ---
  function initPWA() {
    // 1. Register Service Worker for 100% offline usage
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered with scope:', reg.scope);
            reg.onupdatefound = () => {
              const installing = reg.installing;
              if (installing) {
                installing.onstatechange = () => {
                  if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                    showToast('অ্যাপের নতুন আপডেট প্রস্তুত! রিলোড করুন।');
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.log('[PWA] SW note:', err.message);
          });
      });
    }

    // 2. Install App prompt handling
    let deferredInstallPrompt = null;
    const btnInstallPwa = document.getElementById('btn-install-pwa');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (btnInstallPwa) {
        btnInstallPwa.classList.remove('hidden');
      }
    });

    if (btnInstallPwa) {
      btnInstallPwa.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const { outcome } = await deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            showToast('অ্যাপ ইনস্টলেশন সফলভাবে শুরু হয়েছে! 🎉');
            btnInstallPwa.classList.add('hidden');
          }
          deferredInstallPrompt = null;
        } else {
          showToast('অ্যাপ ইনস্টল করতে আপনার ব্রাউজার মেন্যু থেকে "Add to Home screen" বা "Install" সিলেক্ট করুন।');
        }
      });
    }

    window.addEventListener('appinstalled', () => {
      showToast('অ্যাপটি সফলভাবে আপনার ডিভাইসে ইনস্টল করা হয়েছে! 📲');
      if (btnInstallPwa) btnInstallPwa.classList.add('hidden');
      deferredInstallPrompt = null;
    });

    // 3. Network status updates
    window.addEventListener('online', () => {
      showToast('ইন্টারনেট সংযোগ চালু হয়েছে! 🌐');
    });
    window.addEventListener('offline', () => {
      showToast('অফলাইন মোড সক্রিয় — ক্যাশ থেকে ১০০% কাজ করবে! ⚡');
    });
  }

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
