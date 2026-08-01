const axios = require('axios');
const cheerio = require('cheerio');
const zlib = require('zlib');
const Job = require('../models/Job');
const JobSource = require('../models/JobSource');

const HTTP_TIMEOUT = 45000;
const UA = 'MissionHubJobAggregator/1.0';

const SOURCE_DEFINITIONS = [
  {
    key: 'mifotra',
    name: 'MIFOTRA (Rwanda Civil Service)',
    url: 'https://recruitment.mifotra.gov.rw/',
    adapter: 'mifotra',
    enabled: true
  },
  {
    key: 'opportunity',
    name: 'Opportunity INI',
    url: 'https://opportunity.ini.rw/',
    adapter: 'opportunity',
    enabled: true,
    config: {
      keepActive: true,
      limit: 5000
    }
  },
  {
    key: 'greatrwandajobs',
    name: 'Great Rwanda Jobs',
    url: 'https://www.greatrwandajobs.com/search-your-job/newest-jobs',
    adapter: 'greatrwandajobs',
    enabled: true
  },
  {
    key: 'kigalijob',
    name: 'Kigali Job',
    url: 'https://www.kigalijob.com/jobs',
    adapter: 'kigalijob',
    enabled: true,
    config: {
      apiBase: 'https://www.kigalijob.com/api'
    }
  }
];

const CATEGORY_KEYWORDS = {
  technology: ['software', 'developer', 'engineer', 'engineering', 'it ', 'information technology', 'data ', 'analyst', 'programmer', 'network', 'devops', 'computer', 'digital', 'ict', 'telecom', 'cyber', 'web ', 'systems', 'machine learning'],
  healthcare: ['health', 'medical', 'nurse', 'doctor', 'clinical', 'hospital', 'pharma', 'pharmac', 'laboratory', 'lab ', 'surgeon', 'dentist', 'nutrition', 'midwife', 'radiolog'],
  finance: ['finance', 'account', 'audit', 'bank', 'tax', 'budget', 'econom', 'treasury', 'insurance', 'risk', 'credit', 'compliance'],
  education: ['teacher', 'education', 'lecturer', 'instructor', 'professor', 'school', 'training', 'curriculum', 'academic', 'university', 'student'],
  marketing: ['marketing', 'brand', 'communications', 'social media', 'advertis', 'public relations', 'pr ', 'content', 'seo', 'digital marketing', 'sales promotion'],
  sales: ['sales', 'account manager', 'business development', 'retail', 'merchant', 'client'],
  design: ['design', 'graphic', 'ux', 'ui ', 'creative', 'illustrator', 'architecture', 'architect']
};

function normalizeType(raw) {
  const t = String(raw || '').toLowerCase().trim();
  if (t.includes('tender')) return 'tender';
  if (t.includes('consult')) return 'consultancy';
  if (t.includes('intern')) return 'internship';
  if (t.includes('part')) return 'part-time';
  if (t.includes('contract')) return 'contract';
  if (t.includes('remote') || t.includes('work from home')) return 'remote';
  if (t.includes('volunteer')) return 'other';
  if (t.includes('public') || t.includes('government') || t.includes('statute')) return 'public';
  if (t.includes('fellowship') || t.includes('grant')) return 'other';
  return 'full-time';
}

function normalizeCategory(raw, title, description) {
  const text = `${raw || ''} ${title || ''} ${description || ''}`.toLowerCase();
  if (!text.trim()) return 'other';
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some(w => text.includes(w))) return cat;
  }
  return 'other';
}

function normalizeExperience(raw, title) {
  const t = `${raw || ''} ${title || ''}`.toLowerCase();
  if (/lead|manager|director|head|principal|chief|executive/.test(t)) return 'lead';
  if (/senior|experienced|expert/.test(t)) return 'senior';
  if (/junior|entry|graduate|intern/.test(t)) return 'entry';
  if (/mid-?level|intermediate/.test(t)) return 'mid';
  if (raw && /^\d+\s*[-+]?\s*\d*\s*(yrs?|years?)/i.test(String(raw))) {
    const m = String(raw).match(/(\d+)/);
    const n = parseInt(m[1], 10);
    if (n >= 5) return 'senior';
    if (n >= 3) return 'mid';
    if (n >= 1) return 'junior';
    return 'entry';
  }
  return 'mid';
}

function htmlToText(html) {
  if (!html) return '';
  return cheerio.load(html).text().replace(/\s+/g, ' ').trim();
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function parseRelativeDate(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return null;
  if (t === 'today') return new Date();
  if (t === 'yesterday') return new Date(Date.now() - 86400000);
  const m = t.match(/^(\d+)\s+(day|days|week|weeks|month|months|hour|hours)\s*ago$/);
  if (m) {
    const n = parseInt(m[1], 10);
    const mult = m[2].startsWith('week') ? 7 * 86400000 : m[2].startsWith('month') ? 30 * 86400000 : m[2].startsWith('hour') ? 3600000 : 86400000;
    return new Date(Date.now() - n * mult);
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function stripBullets(text) {
  if (!text) return [];
  return text
    .split(/\r?\n|•|\u2022||-|\u25aa/)
    .map(s => s.replace(/^[\s\u00a0]+|[\s\u00a0]+$/g, '').trim())
    .filter(Boolean)
    .slice(0, 30);
}

function absoluteUrl(path, base) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('//')) return 'https:' + path;
  try {
    return new URL(path, base).toString();
  } catch (e) {
    return path;
  }
}

async function axiosGet(url, opts = {}) {
  return axios.get(url, {
    timeout: opts.timeout || HTTP_TIMEOUT,
    headers: { 'User-Agent': UA, Accept: 'application/json, text/html', ...(opts.headers || {}) },
    ...opts
  });
}

// ==================== ADAPTERS ====================

async function fetchMifotra(source) {
  const res = await axiosGet('https://recruitment.mifotra.gov.rw/api/recruitment/open-advertisements', {
    headers: { Accept: 'application/json' }
  });
  let json = res.data;
  const raw = json && (json._data_ || json.data);
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const buf = Buffer.from(Object.values(raw));
    json = JSON.parse(zlib.inflateSync(buf).toString('utf8'));
  }
  const list = Array.isArray(json) ? json : json.data || json.result || json._data;
  if (!Array.isArray(list)) {
    throw new Error('Unexpected MIFOTRA payload shape');
  }
  return list.map((item) => {
    const title = String(item.positionName || '').trim() || 'Public Service Position';
    const description = String(item.jobDescriptions || '').trim();
    return {
      sourceId: String(item.id),
      title,
      company: String(item.entityName || item.entityAcronym || '').trim() || 'Government of Rwanda',
      location: 'Rwanda',
      type: 'public',
      category: normalizeCategory(null, title, description),
      experience: normalizeExperience(item.levelName, title),
      salary: item.scaleName ? `Salary Scale ${item.scaleName}` : '',
      description: description || `Position: ${title}\nInstitution: ${item.entityName || ''}\nPosts available: ${item.numberOfPosts || 1}`,
      responsibilities: stripBullets(description),
      requirements: [],
      benefits: [],
      skills: [],
      remote: false,
      deadline: toDate(item.closingDate),
      posted: toDate(item.openingDate || item.requisitionStatusOn),
      image: '',
      applyUrl: source.url
    };
  });
}

async function fetchOpportunity(source) {
  const config = source.config || {};
  const limit = Math.min(parseInt(config.limit, 10) || 5000, 5000);
  const url = `https://opportunityapi.ini.rw/api/opportunities?limit=${limit}`;
  const res = await axiosGet(url, { headers: { Accept: 'application/json' } });
  const d = res.data;
  const list = Array.isArray(d) ? d : d.data || d.items || d.results;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Unexpected Opportunity payload shape');
  }

  const seen = new Set();
  const uniq = list.filter((x) => {
    const id = String(x.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return uniq.map((item) => {
    const title = String(item.title_en || item.title_rw || '').trim() || 'Opportunity';
    const desc = htmlToText(item.description_en || item.description_rw);
    const company = String(item.company_name || item.company?.name || '').trim();
    const logo = absoluteUrl(item.company?.logo_url || '', 'https://opportunityapi.ini.rw');
    return {
      sourceId: String(item.id),
      title,
      company,
      location: String(item.location_en || item.location_rw || '').trim() || 'Rwanda',
      type: item.type === 'tender' ? 'tender' : normalizeType(item.employment_type_en || item.employment_type_rw),
      category: normalizeCategory(item.company?.industry, title, desc),
      experience: normalizeExperience(item.seniority, title),
      salary: item.salary || '',
      description: desc || `${title} at ${company || 'a company'} in Rwanda`,
      responsibilities: [],
      requirements: [],
      benefits: [],
      skills: String(item.skills || '').split(',').map(s => s.trim()).filter(Boolean),
      remote: /remote/i.test(String(item.location_en || '')) || /remote/i.test(String(item.employment_type_en || '')),
      deadline: toDate(item.closing_date),
      posted: toDate(item.created_at),
      image: logo,
      applyUrl: String(item.apply_url || '').trim() || source.url
    };
  });
}

async function fetchGreatRwandaJobs(source, existingIds) {
  const res = await axiosGet(source.url);
  const $ = cheerio.load(res.data);
  const jobs = [];

  $('.js-toprow').each((i, el) => {
    const $el = $(el);
    const titleEl = $el.find('a.jobtitle').first();
    const href = titleEl.attr('href');
    if (!href) return;
    const rawTitle = titleEl.text().replace(/\s+/g, ' ').trim();
    const companyMatch = rawTitle.match(/\s+job\s+at\s+(.+)$/i);
    const title = companyMatch ? rawTitle.slice(0, rawTitle.length - companyMatch[0].length).trim() : rawTitle;
    const company = companyMatch
      ? companyMatch[1].trim()
      : String($el.find('.js-image img').attr('title') || '').trim();

    const idMatch = href.match(/-(\d+)$/);
    const sourceId = idMatch ? idMatch[1] : href;

    const typeText = $el.find('.js-type').first().text().trim();
    const salary = $el.find('.js-jobsalary').first().text().replace(/\s+/g, ' ').trim();
    const image = absoluteUrl($el.find('.js-image img').attr('src') || '', source.url);

    let category = 'other';
    let location = '';
    let deadline = null;
    let posted = null;
    $el.find('.js-fields').each((j, f) => {
      const label = $(f).find('.js-bold').text().replace(/[:\s]/g, '').toLowerCase();
      const value = $(f).find('.get-text').text().replace(/\s+/g, ' ').trim();
      if (label.includes('category')) category = value;
      if (label.includes('dutystation')) location = value;
      if (label.includes('deadline')) deadline = toDate(value);
      if (label.includes('posted')) posted = parseRelativeDate(value);
    });

    jobs.push({
      sourceId,
      title,
      company,
      location: location || 'Rwanda',
      type: normalizeType(typeText),
      category: normalizeCategory(category, title),
      experience: normalizeExperience(null, title),
      salary,
      description: '',
      responsibilities: [],
      requirements: [],
      benefits: [],
      skills: [],
      remote: false,
      deadline,
      posted,
      image,
      detailUrl: absoluteUrl(href, source.url),
      applyUrl: absoluteUrl(href, source.url)
    });
  });

  if (jobs.length === 0) {
    throw new Error('No job cards found on Great Rwanda Jobs listing page');
  }

  // Enrich with detail-page description for jobs we do not have yet
  const toEnrich = jobs.filter(j => !existingIds.has(String(j.sourceId)));
  await runPool(toEnrich, 4, async (job) => {
    try {
      const detail = await axiosGet(job.detailUrl);
      const $d = cheerio.load(detail.data);
      const desc = $d('.jsjobs_description_data').first().text().replace(/\s+/g, ' ').trim();
      if (desc) {
        job.description = desc;
        job.responsibilities = stripBullets(desc).slice(0, 15);
      }
      if (!job.deadline) {
        const body = $d('body').text().replace(/\s+/g, ' ');
        const dm = body.match(/Deadline[^:]*:\s*([A-Z][a-z]+,\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4})/);
        if (dm) job.deadline = toDate(dm[1]);
      }
    } catch (e) {
      job.description = `${job.title} at ${job.company || 'a company'} in ${job.location}. Apply via the source listing.`;
    }
  });

  return jobs.map(({ detailUrl, ...rest }) => rest);
}

async function fetchKigaliJob(source) {
  const config = source.config || {};
  const base = config.apiBase || 'https://www.kigalijob.com/api';
  const candidates = [
    `${base}/jobs`,
    `${base}/v1/jobs`,
    `${base}/job-posts`,
    `${base}/jobs?limit=50`,
    'https://www.kigalijob.com/api/jobs',
    'https://www.kigalijob.com/jobs.json'
  ];
  for (const url of candidates) {
    try {
      const res = await axiosGet(url, { timeout: 15000, headers: { Accept: 'application/json' } });
      let d = res.data;
      if (typeof d === 'string') {
        try { d = JSON.parse(d); } catch (e) { continue; }
      }
      const list = Array.isArray(d) ? d : d.data || d.jobs || d.items || d.results;
      if (!Array.isArray(list) || list.length === 0) continue;
      return list
        .filter(j => j && (j.title || j.job_title || j.position))
        .map(j => normalizeKigaliJob(j, source));
    } catch (e) {
      // try next candidate
    }
  }
  throw new Error('Kigali Job API endpoint not reachable. Set a working API base URL in source config.');
}

function normalizeKigaliJob(j, source) {
  const title = String(j.title || j.job_title || j.position || '').trim() || 'Job';
  return {
    sourceId: String(j.id || j._id || j.slug || j.title),
    title,
    company: String(j.company || j.company_name || j.employer || '').trim() || 'Kigali Job',
    location: String(j.location || j.city || '').trim() || 'Kigali, Rwanda',
    type: normalizeType(j.type || j.job_type || j.employment_type),
    category: normalizeCategory(null, title, j.description),
    experience: normalizeExperience(j.experience || j.experience_level, title),
    salary: String(j.salary || j.salary_range || '').trim(),
    description: htmlToText(j.description || j.summary || '') || title,
    responsibilities: [],
    requirements: [],
    benefits: [],
    skills: Array.isArray(j.skills) ? j.skills.map(s => String(s)) : [],
    remote: !!(j.remote || /remote/i.test(String(j.location || ''))),
    deadline: toDate(j.deadline || j.closing_date || j.application_deadline),
    posted: toDate(j.created_at || j.posted_at || j.date),
    image: String(j.image || j.logo || j.company_logo || ''),
    applyUrl: String(j.apply_url || j.url || '').trim() || source.url
  };
}

async function runPool(items, concurrency, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await fn(item);
    }
  });
  await Promise.all(workers);
}

// ==================== SERVICE ====================

const ADAPTERS = {
  mifotra: fetchMifotra,
  opportunity: fetchOpportunity,
  greatrwandajobs: fetchGreatRwandaJobs,
  kigalijob: fetchKigaliJob
};

async function ensureSources() {
  const ops = SOURCE_DEFINITIONS.map(def => ({
    updateOne: {
      filter: { key: def.key },
      update: {
        $set: {
          name: def.name,
          url: def.url,
          adapter: def.adapter,
          enabled: def.enabled
        },
        $setOnInsert: {
          autoSync: true,
          syncIntervalHours: 6,
          config: def.config || {}
        }
      },
      upsert: true
    }
  }));
  await JobSource.bulkWrite(ops);
  return JobSource.find().sort({ key: 1 }).lean();
}

async function getSources() {
  return ensureSources();
}

async function getEnabledSources() {
  await ensureSources();
  return JobSource.find({ enabled: true }).lean();
}

async function buildUpsertOps(source, jobs) {
  const ops = [];
  for (const raw of jobs) {
    const externalId = String(raw.sourceId || '').slice(0, 200);
    if (!externalId) continue;

    const postedAt = raw.posted && !isNaN(new Date(raw.posted)) ? new Date(raw.posted) : new Date();

    const data = {
      title: String(raw.title || '').trim().slice(0, 100) || 'Untitled position',
      company: String(raw.company || '').trim().slice(0, 100) || source.name,
      location: String(raw.location || '').trim().slice(0, 100) || 'Rwanda',
      type: raw.type || 'full-time',
      category: raw.category || 'other',
      experience: raw.experience || 'mid',
      salary: String(raw.salary || '').trim().slice(0, 200),
      description: String(raw.description || '').trim().slice(0, 20000) || `${raw.title || 'Job'} at ${raw.company || source.name}`,
      responsibilities: Array.isArray(raw.responsibilities) ? raw.responsibilities.slice(0, 30) : [],
      requirements: Array.isArray(raw.requirements) ? raw.requirements.slice(0, 30) : [],
      benefits: Array.isArray(raw.benefits) ? raw.benefits.slice(0, 30) : [],
      skills: Array.isArray(raw.skills) ? raw.skills.slice(0, 40) : [],
      remote: !!raw.remote,
      image: String(raw.image || ''),
      deadline: raw.deadline ? new Date(raw.deadline) : null,
      urgent: false,
      featured: false,
      status: 'active',
      source: {
        key: source.key,
        name: source.name,
        url: source.url,
        externalId,
        applyUrl: String(raw.applyUrl || '').trim() || source.url,
        importedAt: new Date()
      }
    };

    ops.push({
      updateOne: {
        filter: { 'source.key': source.key, 'source.externalId': externalId },
        update: {
          $set: data,
          $setOnInsert: { createdAt: postedAt }
        },
        upsert: true
      }
    });
  }
  return ops;
}

async function closeExpiredForSource(key) {
  const result = await Job.updateMany(
    {
      'source.key': key,
      status: 'active',
      deadline: { $ne: null, $lt: new Date() }
    },
    { $set: { status: 'closed' } }
  );
  return result.modifiedCount || 0;
}

async function syncSource(source) {
  const startedAt = Date.now();
  await JobSource.updateOne({ key: source.key }, { $set: { lastStatus: 'running' } });

  try {
    const existing = await Job.find({ 'source.key': source.key }).select('source.externalId').lean();
    const existingIds = new Set(existing.map(j => String(j.source && j.source.externalId)));

    const jobs = await ADAPTERS[source.adapter](source, existingIds);

    const ops = await buildUpsertOps(source, jobs);
    let created = 0;
    let updated = 0;
    for (let i = 0; i < ops.length; i += 50) {
      const batch = ops.slice(i, i + 50);
      if (batch.length === 0) continue;
      const res = await Job.bulkWrite(batch, { ordered: false });
      created += res.upsertedCount || 0;
      updated += res.modifiedCount || 0;
    }

    const closed = source.config?.keepActive ? 0 : await closeExpiredForSource(source.key);

    await JobSource.updateOne({ key: source.key }, {
      $set: {
        lastStatus: 'success',
        lastSync: new Date(),
        lastError: null,
        lastJobCount: jobs.length
      },
      $inc: { totalImported: created }
    });

    return {
      sourceKey: source.key,
      found: jobs.length,
      created,
      updated,
      closed,
      duration: Date.now() - startedAt
    };
  } catch (error) {
    await JobSource.updateOne({ key: source.key }, {
      $set: {
        lastStatus: 'error',
        lastError: String(error.message || error).slice(0, 500)
      }
    });
    throw error;
  }
}

async function syncAll(options = {}) {
  const sources = options.sources && options.sources.length
    ? await JobSource.find({ key: { $in: options.sources } }).lean()
    : await getEnabledSources();

  const results = [];
  for (const s of sources) {
    try {
      const r = await syncSource(s);
      results.push({ ...r, success: true });
    } catch (e) {
      results.push({ sourceKey: s.key, success: false, error: e.message });
    }
  }
  return results;
}

async function getStatus() {
  const sources = await getSources();
  const importStats = await Job.aggregate([
    { $match: { 'source.key': { $ne: null } } },
    { $group: { _id: '$source.key', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } }
  ]);
  const statsByKey = {};
  for (const s of importStats) {
    statsByKey[s._id] = { total: s.total, active: s.active };
  }
  return {
    sources: sources.map(s => ({ ...s, stats: statsByKey[s.key] || { total: 0, active: 0 } })),
    totalImported: importStats.reduce((sum, s) => sum + s.total, 0)
  };
}

module.exports = {
  SOURCE_DEFINITIONS,
  ADAPTERS,
  ensureSources,
  getSources,
  getEnabledSources,
  syncSource,
  syncAll,
  getStatus
};
