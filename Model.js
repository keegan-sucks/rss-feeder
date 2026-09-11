function barSection(value) {
  var name = String(value || "").trim().toLowerCase()
  if (name === "left" || name === "center" || name === "right") return name
  return "right"
}

function sectionFromLayout(layout, id) {
  var key = String(id || "")
  var sections = ["left", "center", "right"]
  if (!layout) return ""
  for (var s = 0; s < sections.length; s++) {
    var entries = layout[sections[s]] || []
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i]
      var entryId = entry && typeof entry === "object" ? entry.id : entry
      if (String(entryId || "") === key) return sections[s]
    }
  }
  return ""
}

function entryFromLayout(layout, ids) {
  var idList = Array.isArray(ids) ? ids : [ids]
  var sections = ["left", "center", "right"]
  if (!layout) return null
  for (var s = 0; s < sections.length; s++) {
    var entries = layout[sections[s]] || []
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i]
      if (entry && typeof entry === "object") {
        for (var k = 0; k < idList.length; k++) {
          if (String(entry.id || "") === String(idList[k] || "")) return entry
        }
      }
    }
  }
  return null
}

function pollIntervalMinutes(value) {
  var n = Number(value)
  if (value === undefined || value === null || value === "" || !isFinite(n)) return 15
  if (n < 5) return 5
  return n
}

function recentListSize(value) {
  var n = Number(value)
  if (value === undefined || value === null || value === "" || !isFinite(n)) return 20
  if (n < 1) return 1
  return Math.floor(n)
}

function maxItemsPerFeed(value) {
  var n = Number(value)
  if (value === undefined || value === null || value === "" || !isFinite(n)) return 10
  if (n < 1) return 1
  return Math.floor(n)
}

function maxFeedBytes() {
  return 2097152
}

function isHttpsUrl(url) {
  var value = String(url || "").trim()
  if (!value) return false
  if (/\s/.test(value)) return false
  return /^https:\/\/[^\/?#\s]+/i.test(value)
}

function httpsFeedUrls(value) {
  var list = feedUrls(value)
  var out = []
  for (var i = 0; i < list.length; i++) {
    if (isHttpsUrl(list[i])) out.push(list[i])
  }
  return out
}

function feedUrls(value) {
  if (value === undefined || value === null) return []
  if (typeof value !== "string" && value.length !== undefined && typeof value !== "function") {
    var fromList = []
    for (var i = 0; i < value.length; i++) {
      var item = String(value[i] || "").trim()
      if (item) fromList.push(item)
    }
    if (fromList.length) return fromList
  }
  var text = String(value)
  var lines = text.split(/\r?\n/)
  var urls = []
  for (var j = 0; j < lines.length; j++) {
    var line = lines[j].trim()
    if (line.length > 0) urls.push(line)
  }
  return urls
}

function filterItems(items, query) {
  var needle = String(query || "").trim().toLowerCase()
  var list = items || []
  if (!needle) return list
  var out = []
  for (var i = 0; i < list.length; i++) {
    var item = list[i] || {}
    var hay = [item.title, item.excerpt, item.feedName, item.link, item.identity].join(" ").toLowerCase()
    if (hay.indexOf(needle) !== -1) out.push(item)
  }
  return out
}

function serializeState(items, readSet, shortsCache) {
  return JSON.stringify({
    version: 1,
    items: items || [],
    readIdentities: readIdentities(serializeReadIdentities(readSet)),
    shortsCache: normalizeShortsCache(shortsCache)
  })
}

function parseState(text) {
  var empty = { items: [], readIdentities: [], shortsCache: {} }
  if (!text) return empty
  try {
    var data = JSON.parse(String(text))
    if (!data || typeof data !== "object") return empty
    return {
      items: uniqueItems(data.items || []),
      readIdentities: readIdentities(data.readIdentities),
      shortsCache: normalizeShortsCache(data.shortsCache)
    }
  } catch (e) {
    return empty
  }
}

function uniqueItems(items) {
  var list = recentList(items || [], (items && items.length) || 1)
  var seen = {}
  var out = []
  for (var i = 0; i < list.length; i++) {
    var id = itemIdentity(list[i])
    if (!id || seen[id]) continue
    seen[id] = true
    out.push(list[i])
  }
  return out
}

function emptyPanelCopy(urls) {
  if (!urls || urls.length === 0) return "Add feed URLs in Settings."
  return "No recent items"
}

var DEFAULT_RETENTION_DAYS = 30
var MIN_RETENTION_DAYS = 1
var MAX_RETENTION_DAYS = 3650

function normalizeRetentionDays(value, fallback) {
  var fb = 30
  if (fallback !== undefined && fallback !== null && fallback !== "") {
    var fbNum = Number(fallback)
    if (isFinite(fbNum) && fbNum >= 1 && fbNum <= 3650 && Math.floor(fbNum) === fbNum) {
      fb = Math.floor(fbNum)
    }
  }

  if (value === undefined || value === null) return fb
  if (typeof value === "boolean") return fb
  var s = String(value).trim()
  if (!s || !/^[0-9]+$/.test(s)) return fb

  var n = Number(s)
  if (!isFinite(n) || isNaN(n)) return fb
  if (n < 1 || n > 3650) return fb
  return Math.floor(n)
}

function pruneArticlesByRetention(items, retentionDays, nowMs) {
  var list = items || []
  var days = normalizeRetentionDays(retentionDays, DEFAULT_RETENTION_DAYS)
  var now = (typeof nowMs === "number" && isFinite(nowMs) && nowMs > 0) ? nowMs : Date.now()
  var retentionMs = days * 24 * 60 * 60 * 1000
  var cutoffMs = now - retentionMs

  var out = []
  for (var i = 0; i < list.length; i++) {
    var a = list[i]
    if (!a) continue
    var ts = a.pubDateMs
    if (ts === undefined || ts === null || !isFinite(ts) || ts <= 0) {
      if (a.pubDate) ts = parsePubDate(a.pubDate)
    }
    if (ts === undefined || ts === null || !isFinite(ts) || ts <= 0) {
      if (a.fetchedAtMs && isFinite(a.fetchedAtMs) && a.fetchedAtMs > 0) {
        ts = a.fetchedAtMs
      } else {
        // Fallback: If publication timestamp is completely unavailable, use now so fresh item is kept
        ts = now
      }
    }

    if (ts >= cutoffMs) {
      out.push(a)
    }
  }
  return out
}

function pageSize(value) {
  var n = Number(value)
  if (value === undefined || value === null || value === "" || !isFinite(n)) return 10
  if (n < 1) return 1
  if (n > 100) return 100
  return Math.floor(n)
}

function pageCount(items, perPage) {
  var n = items && items.length ? items.length : 0
  if (n === 0) return 1
  return Math.ceil(n / pageSize(perPage))
}

function pageIndex(items, page, perPage) {
  var max = pageCount(items, perPage) - 1
  var n = Number(page)
  if (!isFinite(n) || n < 0) return 0
  if (n > max) return max
  return Math.floor(n)
}

function pageItems(items, page, perPage) {
  var list = items || []
  var size = pageSize(perPage)
  var index = pageIndex(list, page, size)
  var start = index * size
  return list.slice(start, start + size)
}

function serializeFeedUrls(urls) {
  var list = urls || []
  var lines = []
  for (var i = 0; i < list.length; i++) {
    var line = String(list[i] || "").trim()
    if (line) lines.push(line)
  }
  return lines.join("\n")
}

function sharePayload(urls) {
  return JSON.stringify({
    omarchyRss: 1,
    feeds: httpsFeedUrls(serializeFeedUrls(urls))
  })
}

function filePathFromUrl(urlOrPath) {
  var raw = String(urlOrPath || "").trim()
  if (!raw) return ""
  if (/^file:\/\//i.test(raw)) {
    var pathOnly = raw.replace(/^file:\/\/(localhost)?/i, "")
    try {
      return decodeURIComponent(pathOnly)
    } catch (e) {
      return pathOnly
    }
  }
  return raw
}

function filenameFromPath(filePath) {
  var raw = String(filePath || "").trim()
  if (!raw) return ""
  return raw.replace(/^.*[\\\/]/, "")
}

function extractDomainTitle(url) {
  var str = String(url || "").trim()
  if (!str) return ""
  try {
    var match = /^https?:\/\/([^\/?#]+)/i.exec(str)
    if (match && match[1]) {
      return match[1].replace(/^www\./i, "")
    }
  } catch (e) {}
  return str
}

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function normalizeSubscriptions(rawSubscriptions, rawFeedUrls) {
  var subs = []
  if (typeof rawSubscriptions === "string") {
    var trimmed = rawSubscriptions.trim()
    if (trimmed.indexOf("[") === 0) {
      try {
        var parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) subs = parsed
      } catch (e) {}
    }
  } else if (Array.isArray(rawSubscriptions)) {
    subs = rawSubscriptions.slice()
  }

  var existingMap = {}
  var out = []
  for (var i = 0; i < subs.length; i++) {
    var s = subs[i]
    if (s && typeof s === "object" && isHttpsUrl(s.url)) {
      var u = String(s.url || "").trim()
      if (!existingMap[u]) {
        var catPath = Array.isArray(s.categoryPath)
          ? s.categoryPath.map(function(c) { return String(c || "").trim() }).filter(Boolean)
          : (s.category ? [String(s.category).trim()] : [])
        var normSub = {
          url: u,
          title: String(s.title || extractDomainTitle(u)).trim() || extractDomainTitle(u),
          categoryPath: catPath,
          category: catPath.length ? catPath[catPath.length - 1] : "",
          enabled: s.enabled !== false
        }
        existingMap[u] = normSub
        out.push(normSub)
      }
    } else if (typeof s === "string" && isHttpsUrl(s)) {
      var uStr = s.trim()
      if (!existingMap[uStr]) {
        var plainSub = {
          url: uStr,
          title: extractDomainTitle(uStr),
          categoryPath: [],
          category: "",
          enabled: true
        }
        existingMap[uStr] = plainSub
        out.push(plainSub)
      }
    }
  }

  // Migration from legacy rawFeedUrls
  var fallbackUrls = httpsFeedUrls(rawFeedUrls)
  for (var j = 0; j < fallbackUrls.length; j++) {
    var url = fallbackUrls[j]
    if (!existingMap[url]) {
      var newSub = {
        url: url,
        title: extractDomainTitle(url),
        categoryPath: [],
        category: "",
        enabled: true
      }
      existingMap[url] = newSub
      out.push(newSub)
    }
  }

  return out
}

function serializeSubscriptions(subscriptions) {
  return JSON.stringify(normalizeSubscriptions(subscriptions))
}

function getXmlAttr(attrs, name) {
  var re = new RegExp(name + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i")
  var m = re.exec(attrs)
  return m ? decodeEntities(m[2]).trim() : ""
}

function parseOpmlStructured(text) {
  var raw = String(text || "").trim()
  if (!raw) return { subscriptions: [], categories: [], totalFound: 0, invalidCount: 0 }

  var subscriptions = []
  var categoryStack = []
  var invalidCount = 0
  var totalFound = 0

  var tagRe = /<\/?outline\b([^>]*?)(\/?)>/gi
  var match

  while ((match = tagRe.exec(raw))) {
    var fullMatch = match[0]
    var attrs = match[1] || ""
    var isSelfClosing = match[2] === "/" || fullMatch.indexOf("/>") !== -1
    var isClosingTag = fullMatch.indexOf("</outline") === 0

    if (isClosingTag) {
      if (categoryStack.length > 0) {
        categoryStack.pop()
      }
      continue
    }

    var xmlUrl = getXmlAttr(attrs, "xmlUrl")
    var title = getXmlAttr(attrs, "title") || getXmlAttr(attrs, "text") || ""
    var textAttr = getXmlAttr(attrs, "text") || getXmlAttr(attrs, "title") || ""

    if (xmlUrl) {
      totalFound++
      if (isHttpsUrl(xmlUrl)) {
        var catPath = categoryStack.filter(function(c) { return Boolean(c) })
        subscriptions.push({
          url: xmlUrl,
          title: title || extractDomainTitle(xmlUrl),
          categoryPath: catPath,
          category: catPath.length ? catPath[catPath.length - 1] : "",
          enabled: true
        })
      } else {
        invalidCount++
      }
    }

    if (!isSelfClosing) {
      var catName = textAttr || title || ""
      if (catName && !xmlUrl) {
        categoryStack.push(catName)
      } else if (!xmlUrl) {
        categoryStack.push("Uncategorized")
      } else {
        categoryStack.push(null)
      }
    }
  }

  var catMap = {}
  for (var i = 0; i < subscriptions.length; i++) {
    var sub = subscriptions[i]
    if (sub.categoryPath && sub.categoryPath.length) {
      for (var c = 0; c < sub.categoryPath.length; c++) {
        var cName = sub.categoryPath[c]
        catMap[cName] = (catMap[cName] || 0) + 1
      }
    }
  }

  var categories = Object.keys(catMap)

  return {
    subscriptions: subscriptions,
    categories: categories,
    totalFound: totalFound,
    invalidCount: invalidCount
  }
}

function parseOpmlDetails(text) {
  var structured = parseOpmlStructured(text)
  var validUrls = []
  for (var i = 0; i < structured.subscriptions.length; i++) {
    validUrls.push(structured.subscriptions[i].url)
  }
  return {
    feeds: validUrls,
    subscriptions: structured.subscriptions,
    categories: structured.categories,
    invalidCount: structured.invalidCount,
    totalFound: structured.totalFound
  }
}

function parseOpml(text) {
  return parseOpmlDetails(text).feeds
}

function mergeSubscriptions(current, incoming) {
  var existing = normalizeSubscriptions(current)
  var inc = normalizeSubscriptions(incoming)
  var map = {}
  var out = []
  for (var i = 0; i < existing.length; i++) {
    map[existing[i].url] = existing[i]
    out.push(existing[i])
  }
  for (var j = 0; j < inc.length; j++) {
    var s = inc[j]
    if (!map[s.url]) {
      map[s.url] = s
      out.push(s)
    } else {
      if ((!map[s.url].categoryPath || !map[s.url].categoryPath.length) && s.categoryPath && s.categoryPath.length) {
        map[s.url].categoryPath = s.categoryPath
        map[s.url].category = s.category
      }
      if (s.title && s.title !== s.url && (!map[s.url].title || map[s.url].title === map[s.url].url)) {
        map[s.url].title = s.title
      }
    }
  }
  return out
}

function normalizeFeedInputUrl(input) {
  var s = String(input || "").trim()
  if (!s) return ""
  if (s.indexOf("://") === -1) {
    s = "https://" + s
  }
  return s
}

function getAvailableCategories(subscriptions) {
  var subs = normalizeSubscriptions(subscriptions)
  var map = {}
  var out = []

  for (var i = 0; i < subs.length; i++) {
    var sub = subs[i]
    var cat = String(sub.category || "").trim()
    var path = Array.isArray(sub.categoryPath) ? sub.categoryPath : []
    var display = path.length > 1 ? path.join(" / ") : cat

    if (display && !map[display.toLowerCase()]) {
      map[display.toLowerCase()] = true
      out.push({
        id: cat || display,
        name: cat || display,
        display: display,
        category: cat || display,
        categoryPath: path.length ? path : [cat || display]
      })
    }
  }

  out.sort(function(a, b) {
    return a.display.toLowerCase().localeCompare(b.display.toLowerCase())
  })

  return out
}

function normalizeCategorySelection(inputCategory, subscriptions) {
  var raw = String(inputCategory || "").trim()
  if (!raw || raw.toLowerCase() === "no category" || raw.toLowerCase() === "none") {
    return { category: "", categoryPath: [] }
  }

  var subs = normalizeSubscriptions(subscriptions)
  // Check against existing subscriptions case-insensitively
  for (var i = 0; i < subs.length; i++) {
    var s = subs[i]
    var cat = String(s.category || "").trim()
    var path = Array.isArray(s.categoryPath) ? s.categoryPath : []
    var pathStr = path.join(" / ").trim()

    if (pathStr && pathStr.toLowerCase() === raw.toLowerCase()) {
      return { category: cat || path[path.length - 1], categoryPath: path }
    }
    if (cat && cat.toLowerCase() === raw.toLowerCase()) {
      return { category: cat, categoryPath: path.length ? path : [cat] }
    }
  }

  // If user typed a new path with " / "
  if (raw.indexOf("/") !== -1) {
    var parts = raw.split(/\s*\/\s*/).map(function(p) { return p.trim() }).filter(Boolean)
    if (parts.length > 0) {
      return { category: parts[parts.length - 1], categoryPath: parts }
    }
  }

  return { category: raw, categoryPath: [raw] }
}

function addSubscription(subscriptions, inputUrl, inputTitle, inputCategory) {
  var url = normalizeFeedInputUrl(inputUrl)
  if (!isHttpsUrl(url)) {
    return { ok: false, error: "Please enter a valid HTTPS feed URL", subscriptions: normalizeSubscriptions(subscriptions) }
  }

  var list = normalizeSubscriptions(subscriptions)
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].url || "").trim().toLowerCase() === url.toLowerCase()) {
      return { ok: false, error: "Already subscribed", subscriptions: list }
    }
  }

  var title = String(inputTitle || "").trim() || extractDomainTitle(url)
  var catInfo = normalizeCategorySelection(inputCategory, list)

  var newSub = {
    url: url,
    title: title,
    categoryPath: catInfo.categoryPath,
    category: catInfo.category,
    enabled: true
  }

  var next = [newSub].concat(list)
  return { ok: true, newSub: newSub, subscriptions: next }
}

function removeSubscription(subscriptions, targetUrl) {
  var url = String(targetUrl || "").trim().toLowerCase()
  var list = normalizeSubscriptions(subscriptions)
  var next = []
  var removed = null
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].url || "").trim().toLowerCase() === url) {
      removed = list[i]
    } else {
      next.push(list[i])
    }
  }
  return { ok: removed !== null, removed: removed, subscriptions: next }
}

function pruneArticlesBySubscriptions(articles, subscriptions) {
  var subs = normalizeSubscriptions(subscriptions)
  var allowedMap = {}
  for (var i = 0; i < subs.length; i++) {
    allowedMap[subs[i].url] = true
  }
  var list = articles || []
  var out = []
  for (var a = 0; a < list.length; a++) {
    var item = list[a]
    if (!item) continue
    var fUrl = item.feedUrl || item.subscriptionUrl || ""
    if (!fUrl || allowedMap[fUrl]) {
      out.push(item)
    }
  }
  return out
}

function calculateImportResult(currentSubs, parsedResult, filename) {
  var current = normalizeSubscriptions(currentSubs)
  var incoming = []
  var invalidCount = 0
  var parsedCategories = []

  if (parsedResult && typeof parsedResult === "object") {
    if (parsedResult.subscriptions && Array.isArray(parsedResult.subscriptions)) {
      incoming = normalizeSubscriptions(parsedResult.subscriptions)
    } else if (parsedResult.feeds && Array.isArray(parsedResult.feeds)) {
      incoming = normalizeSubscriptions(parsedResult.feeds)
    } else {
      incoming = normalizeSubscriptions(parsedResult)
    }
    invalidCount = typeof parsedResult.invalidCount === "number" ? parsedResult.invalidCount : 0
    if (Array.isArray(parsedResult.categories)) parsedCategories = parsedResult.categories
  } else {
    incoming = normalizeSubscriptions(parsedResult)
  }

  var currentUrls = {}
  for (var i = 0; i < current.length; i++) currentUrls[current[i].url] = true

  var added = []
  var duplicates = 0
  for (var j = 0; j < incoming.length; j++) {
    if (!currentUrls[incoming[j].url]) {
      added.push(incoming[j])
      currentUrls[incoming[j].url] = true
    } else {
      duplicates++
    }
  }

  var nameLabel = filename ? (" from " + filename) : ""
  var parts = []
  if (added.length > 0) {
    parts.push("Imported " + added.length + " feed" + (added.length === 1 ? "" : "s") + nameLabel)
  } else if (duplicates > 0) {
    parts.push("All " + duplicates + " feed" + (duplicates === 1 ? "" : "s") + nameLabel + " already added")
  } else {
    parts.push("No valid feeds found" + nameLabel)
  }
  if (duplicates > 0 && added.length > 0) {
    parts.push(duplicates + " duplicate" + (duplicates === 1 ? "" : "s"))
  }
  if (invalidCount > 0) {
    parts.push(invalidCount + " need attention")
  }
  var message = parts.join(" · ")
  var nextSubs = mergeSubscriptions(current, added)
  var nextFeeds = []
  for (var k = 0; k < nextSubs.length; k++) nextFeeds.push(nextSubs[k].url)

  return {
    status: (added.length > 0 || duplicates > 0) ? "success" : "error",
    imported: added.length,
    duplicates: duplicates,
    invalid: invalidCount,
    message: message,
    newSubscriptions: nextSubs,
    newFeeds: nextFeeds,
    categories: parsedCategories
  }
}

function matchCategory(article, selectedCategory) {
  if (!selectedCategory || String(selectedCategory).trim().toLowerCase() === "all") return true
  if (!article) return false
  var target = String(selectedCategory).trim().toLowerCase()

  var cat = String(article.category || "").trim().toLowerCase()
  if (cat && cat === target) return true

  var path = article.categoryPath
  if (Array.isArray(path)) {
    for (var i = 0; i < path.length; i++) {
      if (String(path[i] || "").trim().toLowerCase() === target) return true
    }
  }

  return false
}

function enrichArticles(articles, subscriptions) {
  var list = articles || []
  var subs = normalizeSubscriptions(subscriptions)
  var subMap = {}
  for (var s = 0; s < subs.length; s++) {
    subMap[subs[s].url] = subs[s]
  }

  var out = []
  for (var i = 0; i < list.length; i++) {
    var a = list[i]
    if (!a) continue
    var feedUrl = String(a.feedUrl || a.subscriptionUrl || "").trim()
    var sub = feedUrl ? subMap[feedUrl] : null
    var cat = a.category || (sub ? sub.category : "") || ""
    var catPath = (a.categoryPath && a.categoryPath.length)
      ? a.categoryPath
      : ((sub && sub.categoryPath && sub.categoryPath.length) ? sub.categoryPath : (cat ? [cat] : []))
    var feedName = a.feedName || (sub ? sub.title : "") || extractDomainTitle(feedUrl || a.link)

    out.push({
      identity: a.identity || a.link || "",
      link: a.link || "",
      title: a.title || "",
      excerpt: a.excerpt || "",
      feedName: feedName,
      feedTitle: feedName,
      feedUrl: feedUrl || (sub ? sub.url : ""),
      subscriptionUrl: feedUrl || (sub ? sub.url : ""),
      category: cat,
      categoryPath: catPath,
      pubDateMs: a.pubDateMs
    })
  }

  return out
}

var MAX_CONCURRENT_FETCHES = 4

function mergeFeedArticles(existingArticles, incomingArticles, feedUrl, maxPerFeed, retentionDays, subscriptions) {
  var existing = existingArticles || []
  var incoming = incomingArticles || []
  var targetUrl = String(feedUrl || "").trim()

  // Cap incoming items for this feed
  var perFeedCap = maxItemsPerFeed(maxPerFeed)
  var cappedIncoming = recentList(incoming, perFeedCap)
  if (targetUrl) {
    for (var k = 0; k < cappedIncoming.length; k++) {
      if (!cappedIncoming[k].feedUrl) cappedIncoming[k].feedUrl = targetUrl
      if (!cappedIncoming[k].subscriptionUrl) cappedIncoming[k].subscriptionUrl = targetUrl
    }
  }

  // Keep articles from other feeds intact
  var others = []
  if (targetUrl) {
    for (var i = 0; i < existing.length; i++) {
      var it = existing[i]
      var itemFeed = String((it && (it.feedUrl || it.subscriptionUrl)) || "").trim()
      if (itemFeed !== targetUrl) {
        others.push(it)
      }
    }
  } else {
    others = existing.slice()
  }

  // Combine new incoming articles with existing others (incoming first so newest data takes precedence)
  var combined = cappedIncoming.concat(others)

  // Deduplicate by itemIdentity
  var seen = {}
  var deduped = []
  for (var j = 0; j < combined.length; j++) {
    var item = combined[j]
    var id = itemIdentity(item)
    if (!id || seen[id]) continue
    seen[id] = true
    deduped.push(item)
  }

  // Sort newest first
  deduped = recentList(deduped, deduped.length || 1)

  // Prune by retention days
  var pruned = pruneArticlesByRetention(deduped, retentionDays)

  // Enrich with subscription metadata
  return enrichArticles(pruned, subscriptions)
}

function createFetchScheduler(options) {
  var opts = options || {}
  var maxConcurrent = Math.max(1, Math.min(16, Number(opts.maxConcurrent) || MAX_CONCURRENT_FETCHES))
  var fetchFn = typeof opts.fetchFn === "function" ? opts.fetchFn : null
  var onFeedPublished = typeof opts.onFeedPublished === "function" ? opts.onFeedPublished : null
  var onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null
  var onBatchComplete = typeof opts.onBatchComplete === "function" ? opts.onBatchComplete : null

  var queue = []
  var activeWorkers = {}
  var totalFeeds = 0
  var completedFeeds = 0
  var failedFeeds = 0
  var isFetching = false
  var refreshPending = false
  var articles = (opts.initialArticles || []).slice()
  var subscriptions = opts.subscriptions || []

  function getStatus() {
    return {
      isFetching: isFetching,
      refreshPending: refreshPending,
      totalFeeds: totalFeeds,
      completedFeeds: completedFeeds,
      failedFeeds: failedFeeds,
      queuedFeeds: queue.length,
      activeFetches: Object.keys(activeWorkers).length,
      articles: articles
    }
  }

  function pump() {
    while (Object.keys(activeWorkers).length < maxConcurrent && queue.length > 0) {
      var url = queue.shift()
      if (!isHttpsUrl(url)) {
        completedFeeds++
        failedFeeds++
        if (onProgress) onProgress(getStatus())
        continue
      }

      var workerId = "w_" + Math.random().toString(36).slice(2, 9)
      activeWorkers[workerId] = url

      if (onProgress) onProgress(getStatus())

      if (fetchFn) {
        (function(wId, targetUrl) {
          fetchFn(targetUrl, function(err, result) {
            delete activeWorkers[wId]
            if (err || !result || !result.ok) {
              failedFeeds++
              completedFeeds++
            } else {
              completedFeeds++
              var incomingItems = result.items || []
              articles = mergeFeedArticles(
                articles,
                incomingItems,
                targetUrl,
                opts.maxItemsPerFeed,
                opts.retentionDays,
                subscriptions
              )
              if (onFeedPublished) {
                onFeedPublished(targetUrl, articles, getStatus())
              }
            }

            if (onProgress) onProgress(getStatus())

            if (Object.keys(activeWorkers).length === 0 && queue.length === 0) {
              isFetching = false
              if (onBatchComplete) onBatchComplete(articles, getStatus())
              if (refreshPending) {
                refreshPending = false
                start(opts.getFeedUrls ? opts.getFeedUrls() : [])
              }
            } else {
              pump()
            }
          })
        })(workerId, url)
      }
    }

    if (Object.keys(activeWorkers).length === 0 && queue.length === 0) {
      isFetching = false
      if (onBatchComplete) onBatchComplete(articles, getStatus())
      if (refreshPending) {
        refreshPending = false
        start(opts.getFeedUrls ? opts.getFeedUrls() : [])
      }
    }
  }

  function start(urls) {
    if (isFetching) {
      refreshPending = true
      return
    }

    var list = urls || []
    var dedupedUrls = []
    var seen = {}
    for (var i = 0; i < list.length; i++) {
      var u = String(list[i] || "").trim()
      if (isHttpsUrl(u) && !seen[u]) {
        seen[u] = true
        dedupedUrls.push(u)
      }
    }

    if (dedupedUrls.length === 0) {
      isFetching = false
      refreshPending = false
      totalFeeds = 0
      completedFeeds = 0
      failedFeeds = 0
      queue = []
      if (onBatchComplete) onBatchComplete(articles, getStatus())
      return
    }

    queue = dedupedUrls.slice()
    totalFeeds = dedupedUrls.length
    completedFeeds = 0
    failedFeeds = 0
    isFetching = true
    refreshPending = false

    if (onProgress) onProgress(getStatus())
    pump()
  }

  function setSubscriptions(subs) {
    subscriptions = subs || []
  }

  function setArticles(arts) {
    articles = arts || []
  }

  return {
    start: start,
    getStatus: getStatus,
    setSubscriptions: setSubscriptions,
    setArticles: setArticles,
    MAX_CONCURRENT: maxConcurrent
  }
}

function extractCategories(subscriptions, articles, readSet) {
  var subs = normalizeSubscriptions(subscriptions)
  var arts = enrichArticles(articles, subs)
  var reads = readSet || []

  var totalCount = arts.length
  var totalUnread = unreadCount(arts, reads)

  var catMap = {}
  for (var i = 0; i < subs.length; i++) {
    var sub = subs[i]
    if (sub.category && !catMap[sub.category]) {
      catMap[sub.category] = true
    }
    if (Array.isArray(sub.categoryPath)) {
      for (var p = 0; p < sub.categoryPath.length; p++) {
        var pName = String(sub.categoryPath[p] || "").trim()
        if (pName && !catMap[pName]) catMap[pName] = true
      }
    }
  }

  var catNames = Object.keys(catMap).sort()
  var list = [
    { id: "all", name: "All", count: totalCount, unreadCount: totalUnread }
  ]

  for (var k = 0; k < catNames.length; k++) {
    var name = catNames[k]
    var catArticles = []
    var catUnread = 0
    for (var a = 0; a < arts.length; a++) {
      var item = arts[a]
      if (matchCategory(item, name)) {
        catArticles.push(item)
        if (!isRead(reads, item)) catUnread++
      }
    }
    list.push({
      id: name,
      name: name,
      count: catArticles.length,
      unreadCount: catUnread
    })
  }

  return list
}

function filterReaderArticles(articles, options) {
  var opts = options || {}
  var category = String(opts.category || "all").trim()
  var unreadOnly = Boolean(opts.unreadOnly)
  var search = String(opts.search || "").trim().toLowerCase()
  var readSet = opts.readSet || []
  var list = enrichArticles(articles, opts.subscriptions)

  var out = []
  for (var i = 0; i < list.length; i++) {
    var item = list[i] || {}

    // 1. Category Matching
    if (!matchCategory(item, category)) {
      continue
    }

    // 2. Unread Check
    if (unreadOnly && isRead(readSet, item)) {
      continue
    }

    // 3. Search Query Check
    if (search) {
      var catStr = Array.isArray(item.categoryPath) ? item.categoryPath.join(" ") : (item.category || "")
      var hay = [item.title, item.excerpt, item.feedName, item.feedTitle, catStr, item.link, item.feedUrl].join(" ").toLowerCase()
      if (hay.indexOf(search) === -1) {
        continue
      }
    }

    out.push(item)
  }

  return out
}

function generateOpml(subscriptions) {
  var subs = normalizeSubscriptions(subscriptions)
  var xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<opml version="2.0">', '  <head>', '    <title>Omarchy RSS Subscriptions</title>', '  </head>', '  <body>']

  var byCategory = {}
  var flat = []
  for (var i = 0; i < subs.length; i++) {
    var s = subs[i]
    var cat = s.category || (s.categoryPath && s.categoryPath.length ? s.categoryPath[0] : "")
    if (cat) {
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push(s)
    } else {
      flat.push(s)
    }
  }

  var catNames = Object.keys(byCategory).sort()
  for (var c = 0; c < catNames.length; c++) {
    var catName = catNames[c]
    xml.push('    <outline text="' + escapeXml(catName) + '" title="' + escapeXml(catName) + '">')
    var items = byCategory[catName]
    for (var j = 0; j < items.length; j++) {
      var item = items[j]
      xml.push('      <outline type="rss" text="' + escapeXml(item.title) + '" title="' + escapeXml(item.title) + '" xmlUrl="' + escapeXml(item.url) + '"/>')
    }
    xml.push('    </outline>')
  }

  for (var k = 0; k < flat.length; k++) {
    var f = flat[k]
    xml.push('    <outline type="rss" text="' + escapeXml(f.title) + '" title="' + escapeXml(f.title) + '" xmlUrl="' + escapeXml(f.url) + '"/>')
  }

  xml.push('  </body>', '</opml>')
  return xml.join('\n')
}

function parseSharePayload(text) {
  var raw = String(text || "").trim()
  if (!raw) return []
  try {
    var data = JSON.parse(raw)
    if (data && typeof data === "object") {
      if (data.feeds) return httpsFeedUrls(data.feeds)
      if (data.omarchyRss && data.urls) return httpsFeedUrls(data.urls)
    }
  } catch (e) {}
  var fromOpml = parseOpml(raw)
  if (fromOpml.length) return fromOpml
  return httpsFeedUrls(raw)
}

function mergeFeedLists(current, incoming) {
  var next = httpsFeedUrls(serializeFeedUrls(current))
  var add = httpsFeedUrls(serializeFeedUrls(incoming))
  for (var i = 0; i < add.length; i++) next = addFeedUrl(next, add[i])
  return next
}

function addFeedUrl(urls, url) {
  var next = httpsFeedUrls(serializeFeedUrls(urls))
  var value = String(url || "").trim()
  if (!isHttpsUrl(value)) return next
  for (var i = 0; i < next.length; i++) {
    if (next[i] === value) return next
  }
  next.push(value)
  return next
}

function removeFeedUrl(urls, url) {
  var next = []
  var value = String(url || "").trim()
  var list = urls || []
  for (var i = 0; i < list.length; i++) {
    if (String(list[i] || "").trim() !== value) next.push(list[i])
  }
  return next
}

function activateUrl(item) {
  if (!item) return ""
  var link = String(item.link || "").trim()
  return isHttpsUrl(link) ? link : ""
}

function itemIdentity(item) {
  if (!item) return ""
  if (typeof item === "string") return item.trim()
  return String(item.identity || item.guid || item.id || item.link || "").trim()
}

function readIdentities(value) {
  return feedUrls(value)
}

function serializeReadIdentities(ids) {
  return serializeFeedUrls(ids)
}

function isRead(readSet, item) {
  var id = itemIdentity(item)
  if (!id) return false
  var list = readSet || []
  for (var i = 0; i < list.length; i++) {
    if (String(list[i]).trim() === id) return true
  }
  return false
}

function markRead(readSet, item) {
  var id = itemIdentity(item)
  var next = readIdentities(serializeReadIdentities(readSet))
  if (!id) return next
  for (var i = 0; i < next.length; i++) {
    if (next[i] === id) return next
  }
  next.push(id)
  return next
}

function unreadCount(items, readSet) {
  return tabItems(items, readSet, "new").length
}

function compactCount(value) {
  var n = Number(value)
  if (!isFinite(n) || n <= 0) return "0"
  n = Math.floor(n)
  return n > 99 ? "99+" : String(n)
}

function markAllRead(readSet, items) {
  var next = readIdentities(serializeReadIdentities(readSet))
  var list = items || []
  for (var i = 0; i < list.length; i++) next = markRead(next, list[i])
  return next
}

function mergeFeeds(feedItemLists, perFeedMax) {
  var cap = maxItemsPerFeed(perFeedMax)
  var mixed = []
  var lists = feedItemLists || []
  for (var i = 0; i < lists.length; i++) {
    var capped = recentList(lists[i], cap)
    for (var j = 0; j < capped.length; j++) mixed.push(capped[j])
  }
  return recentList(mixed, mixed.length || 1)
}

function tabItems(items, readSet, tab) {
  var list = items || []
  var wantRead = tab === "read"
  var out = []
  for (var i = 0; i < list.length; i++) {
    if (isRead(readSet, list[i]) === wantRead) out.push(list[i])
  }
  return out
}

function stripCdata(text) {
  var value = String(text || "")
  var wrapped = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/)
  return wrapped ? wrapped[1] : value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}

function stripHtml(text) {
  return decodeEntities(stripCdata(text))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim()
}

function tagInner(block, tag) {
  var pattern = new RegExp("<" + tag + "\\b[^>]*>([\\s\\S]*?)</" + tag + "\\s*>", "i")
  var match = String(block || "").match(pattern)
  return match ? match[1] : ""
}

function parsePubDate(text) {
  var raw = stripHtml(text)
  if (!raw) return null
  var ms = Date.parse(raw)
  if (!isFinite(ms)) return null
  return ms
}

function attributeValue(tag, name) {
  var match = String(tag || "").match(new RegExp(name + "\\s*=\\s*[\"']([^\"']+)[\"']", "i"))
  return match ? match[1] : ""
}

function alternateLink(block) {
  var tags = String(block || "").match(/<link\b[^>]*>/gi) || []
  var fallback = ""
  for (var i = 0; i < tags.length; i++) {
    var href = attributeValue(tags[i], "href")
    if (!href) continue
    var rel = attributeValue(tags[i], "rel")
    if (!rel || rel === "alternate") return href
    if (!fallback) fallback = href
  }
  return fallback
}

function looksLikeHtml(body) {
  var source = String(body || "")
  if (!source) return false
  if (/<rss\b/i.test(source) || /<feed\b/i.test(source)) return false
  return /<!doctype html/i.test(source) || /<html\b/i.test(source)
}

function looksLikeFeedText(body) {
  var source = String(body || "")
  if (!source || source.indexOf("\0") !== -1) return false
  if (looksLikeHtml(source)) return true
  return /<\?xml\b/i.test(source) || /<rss\b/i.test(source) || /<feed\b/i.test(source)
}

function splitFetchedBody(text) {
  var raw = String(text == null ? "" : text)
  var marker = "\n__OMARCHY_CT__:"
  var at = raw.lastIndexOf(marker)
  if (at === -1) {
    if (raw.indexOf("__OMARCHY_CT__:") === 0)
      return { body: "", contentType: raw.slice("__OMARCHY_CT__:".length) }
    return { body: raw, contentType: "" }
  }
  return {
    body: raw.slice(0, at),
    contentType: raw.slice(at + marker.length)
  }
}

function isFeedTextResponse(contentType, body) {
  var source = String(body || "")
  if (!source || source.length > maxFeedBytes() || source.indexOf("\0") !== -1) return false
  var type = String(contentType || "").split(";")[0].trim().toLowerCase()
  if (!type) return looksLikeFeedText(source)
  if (type.indexOf("image/") === 0 || type.indexOf("audio/") === 0 || type.indexOf("video/") === 0)
    return false
  if (type === "application/octet-stream" || type === "application/pdf" || type === "application/zip")
    return false
  if (
    type === "application/rss+xml" ||
    type === "application/atom+xml" ||
    type === "application/xml" ||
    type === "text/xml" ||
    type === "text/html" ||
    type === "application/xhtml+xml"
  )
    return true
  return looksLikeFeedText(source)
}

function originOf(url) {
  if (!isHttpsUrl(url)) return ""
  var match = String(url || "").match(/^(https:\/\/[^\/]+)/i)
  return match ? match[1] : ""
}

function resolveUrl(base, href) {
  var ref = String(href || "").trim()
  if (!ref) return ""
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return isHttpsUrl(ref) ? ref : ""
  if (ref.indexOf("//") === 0) {
    if (!isHttpsUrl(base)) return ""
    var joined = "https:" + ref
    return isHttpsUrl(joined) ? joined : ""
  }
  var origin = originOf(base)
  if (!origin) return ""
  var resolved = ""
  if (ref.charAt(0) === "/") resolved = origin + ref
  else {
    var dir = String(base || "").replace(/[?#].*$/, "")
    dir = dir.replace(/\/[^\/]*$/, "/")
    if (dir.indexOf(origin) !== 0) dir = origin + "/"
    resolved = dir + ref
  }
  return isHttpsUrl(resolved) ? resolved : ""
}

function discoverFeedUrls(html, pageUrl) {
  var tags = String(html || "").match(/<link\b[^>]*>/gi) || []
  var found = []
  for (var i = 0; i < tags.length; i++) {
    var tag = tags[i]
    var rel = attributeValue(tag, "rel").toLowerCase()
    var type = attributeValue(tag, "type").toLowerCase()
    var href = attributeValue(tag, "href")
    var isFeedType = type.indexOf("rss+xml") !== -1 || type.indexOf("atom+xml") !== -1
    var isAlternate = rel.indexOf("alternate") !== -1
    if (!href || !isFeedType || !isAlternate) continue
    var absolute = resolveUrl(pageUrl, href)
    if (!isHttpsUrl(absolute)) continue
    var seen = false
    for (var j = 0; j < found.length; j++) if (found[j] === absolute) seen = true
    if (!seen) found.push(absolute)
  }
  return found
}

function guessFeedUrls(pageUrl) {
  var origin = originOf(pageUrl)
  if (!origin) return []
  var paths = ["/feed.xml", "/atom.xml", "/rss.xml", "/feed", "/index.xml"]
  var out = []
  for (var i = 0; i < paths.length; i++) out.push(origin + paths[i])
  return out
}

function parseAtom(xml) {
  var source = String(xml || "")
  if (!/<feed\b/i.test(source)) return { ok: false, feedName: "", items: [] }

  var entries = source.match(/<entry\b[\s\S]*?<\/entry>/gi) || []
  var withoutEntries = source.replace(/<entry\b[\s\S]*?<\/entry>/gi, "")
  var feedName = stripHtml(tagInner(withoutEntries, "title"))
  var items = []
  for (var i = 0; i < entries.length; i++) {
    var block = entries[i]
    var identity = stripHtml(tagInner(block, "id")) || alternateLink(block)
    if (!identity) continue
    var link = alternateLink(block)
    var title = stripHtml(tagInner(block, "title"))
    var excerpt = stripHtml(tagInner(block, "content")) || stripHtml(tagInner(block, "summary"))
    var published = parsePubDate(tagInner(block, "published"))
    if (published == null) published = parsePubDate(tagInner(block, "updated"))
    items.push({
      identity: identity,
      link: link,
      title: title,
      excerpt: excerpt,
      feedName: feedName,
      pubDateMs: published
    })
  }
  return { ok: true, feedName: feedName, items: items }
}

function parseFeed(xml) {
  var rss = parseRss20(xml)
  if (rss.ok) return rss
  return parseAtom(xml)
}

function parseRss20(xml) {
  var source = String(xml || "")
  var hasRss20 = /<rss\b[^>]*version\s*=\s*["']2\.0["']/i.test(source)
  var hasAtomFeed = /<feed\b[^>]*xmlns\s*=\s*["'][^"']*Atom/i.test(source) || /<feed\b[^>]*xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(source)
  if (!hasRss20 || hasAtomFeed) {
    return { ok: false, feedName: "", items: [] }
  }

  var channel = (source.match(/<channel\b[\s\S]*<\/channel>/i) || [source])[0]
  var feedName = stripHtml(tagInner(channel, "title"))
  var items = []
  var itemBlocks = channel.match(/<item\b[\s\S]*?<\/item>/gi) || []
  for (var i = 0; i < itemBlocks.length; i++) {
    var block = itemBlocks[i]
    var guid = stripHtml(tagInner(block, "guid"))
    var link = stripHtml(tagInner(block, "link"))
    var identity = guid || link
    if (!identity) continue
    var title = stripHtml(tagInner(block, "title"))
    var excerpt = stripHtml(tagInner(block, "description"))
    items.push({
      identity: identity,
      link: link,
      title: title,
      excerpt: excerpt,
      feedName: feedName,
      pubDateMs: parsePubDate(tagInner(block, "pubDate"))
    })
  }
  return { ok: true, feedName: feedName, items: items }
}

function recentList(items, n) {
  var size = recentListSize(n)
  var copy = (items || []).slice()
  copy.sort(function (a, b) {
    var aDate = a && a.pubDateMs != null && isFinite(a.pubDateMs) ? a.pubDateMs : null
    var bDate = b && b.pubDateMs != null && isFinite(b.pubDateMs) ? b.pubDateMs : null
    if (aDate === null && bDate === null) {
      var aId = a && a.identity ? String(a.identity) : ""
      var bId = b && b.identity ? String(b.identity) : ""
      if (aId < bId) return -1
      if (aId > bId) return 1
      return 0
    }
    if (aDate === null) return 1
    if (bDate === null) return -1
    return bDate - aDate
  })
  return copy.slice(0, size)
}

function rowText(item) {
  if (!item) return ""
  if (item.title) return item.title
  return item.excerpt || ""
}

function relativeTime(pubDateMs, nowMs) {
  if (pubDateMs == null || !isFinite(pubDateMs)) return ""
  var now = nowMs != null ? nowMs : Date.now()
  var delta = now - pubDateMs
  if (!isFinite(delta) || delta < 0) return ""
  var minutes = Math.floor(delta / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return minutes + "m"
  var hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + "h"
  var days = Math.floor(hours / 24)
  return days + "d"
}

// Assign (or clear) the category of a single existing subscription, identified by
// url. An empty / "none" input clears it; an unknown name creates a new category.
// Returns { subscriptions } ready for hostWidget.updateSubscriptions.
function setSubscriptionCategory(subscriptions, url, categoryInput) {
  var list = normalizeSubscriptions(subscriptions)
  var target = String(url || "")
  var catInfo = normalizeCategorySelection(categoryInput, list)
  var out = []
  for (var i = 0; i < list.length; i++) {
    var s = list[i]
    if (s && s.url === target) {
      out.push({
        url: s.url,
        title: s.title,
        categoryPath: catInfo.categoryPath,
        category: catInfo.category,
        enabled: s.enabled
      })
    } else {
      out.push(s)
    }
  }
  return { subscriptions: normalizeSubscriptions(out) }
}

// --- YouTube Shorts filtering -------------------------------------------------
// YouTube's RSS feed carries no duration or Shorts flag, so a Short and a normal
// upload look identical in the feed. We detect Shorts out-of-band: requesting
// https://www.youtube.com/shorts/<id> returns HTTP 200 for a real Short and a
// 3xx redirect (to /watch) for a regular video. Results are cached per video id
// so each video is probed at most once.

function isYouTubeFeedUrl(url) {
  var u = String(url || "").toLowerCase()
  return u.indexOf("youtube.com/feeds/videos.xml") !== -1
    || u.indexOf("youtube.com/feeds/") !== -1
}

function youTubeVideoId(item) {
  if (!item) return ""
  var id = String(item.identity || "")
  var m = id.match(/yt:video:([A-Za-z0-9_-]{6,})/)
  if (m) return m[1]
  var link = String(item.link || "")
  var lm = link.match(/[?&]v=([A-Za-z0-9_-]{6,})/)
  if (lm) return lm[1]
  var sm = link.match(/\/shorts\/([A-Za-z0-9_-]{6,})/)
  if (sm) return sm[1]
  return ""
}

function shortsProbeUrl(videoId) {
  return "https://www.youtube.com/shorts/" + String(videoId || "")
}

// Classify from the HTTP status of a (non-following) request to the /shorts/ URL.
// 200 => Short; any 3xx redirect => regular video; anything else => unknown
// (leave unclassified rather than risk dropping a real video on a transient error).
function classifyShortStatus(httpCode) {
  var code = Number(httpCode)
  if (code === 200) return "short"
  if (code >= 300 && code < 400) return "video"
  return ""
}

function normalizeShortsCache(raw) {
  var out = {}
  if (raw && typeof raw === "object") {
    for (var k in raw) {
      var v = raw[k]
      if (v === "short" || v === "video") out[k] = v
    }
  }
  return out
}

// Drop items whose video id is cached as a Short. Non-YouTube items (no video id)
// are always kept. A no-op when `enabled` is false.
function filterShorts(items, cache, enabled) {
  var list = items || []
  if (!enabled) return list
  var c = normalizeShortsCache(cache)
  var out = []
  for (var i = 0; i < list.length; i++) {
    var vid = youTubeVideoId(list[i])
    if (vid && c[vid] === "short") continue
    out.push(list[i])
  }
  return out
}

// Distinct video ids among these items that have no cached verdict yet.
function unknownShortCandidates(items, cache, enabled) {
  if (!enabled) return []
  var list = items || []
  var c = normalizeShortsCache(cache)
  var seen = {}
  var out = []
  for (var i = 0; i < list.length; i++) {
    var vid = youTubeVideoId(list[i])
    if (!vid || c[vid] || seen[vid]) continue
    seen[vid] = true
    out.push(vid)
  }
  return out
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    pollIntervalMinutes: pollIntervalMinutes,
    barSection: barSection,
    sectionFromLayout: sectionFromLayout,
    entryFromLayout: entryFromLayout,
    recentListSize: recentListSize,
    maxItemsPerFeed: maxItemsPerFeed,
    unreadCount: unreadCount,
    compactCount: compactCount,
    markAllRead: markAllRead,
    mergeFeeds: mergeFeeds,
    uniqueItems: uniqueItems,
    filterItems: filterItems,
    serializeState: serializeState,
    parseState: parseState,
    feedUrls: feedUrls,
    httpsFeedUrls: httpsFeedUrls,
    isHttpsUrl: isHttpsUrl,
    maxFeedBytes: maxFeedBytes,
    splitFetchedBody: splitFetchedBody,
    isFeedTextResponse: isFeedTextResponse,
    emptyPanelCopy: emptyPanelCopy,
    pageSize: pageSize,
    pageCount: pageCount,
    pageIndex: pageIndex,
    pageItems: pageItems,
    serializeFeedUrls: serializeFeedUrls,
    addFeedUrl: addFeedUrl,
    sharePayload: sharePayload,
    filePathFromUrl: filePathFromUrl,
    filenameFromPath: filenameFromPath,
    parseOpmlDetails: parseOpmlDetails,
    parseOpmlStructured: parseOpmlStructured,
    parseOpml: parseOpml,
    calculateImportResult: calculateImportResult,
    parseSharePayload: parseSharePayload,
    mergeFeedLists: mergeFeedLists,
    normalizeSubscriptions: normalizeSubscriptions,
    serializeSubscriptions: serializeSubscriptions,
    mergeSubscriptions: mergeSubscriptions,
    matchCategory: matchCategory,
    enrichArticles: enrichArticles,
    extractCategories: extractCategories,
    filterReaderArticles: filterReaderArticles,
    generateOpml: generateOpml,
    extractDomainTitle: extractDomainTitle,
    escapeXml: escapeXml,
    removeFeedUrl: removeFeedUrl,
    activateUrl: activateUrl,
    itemIdentity: itemIdentity,
    readIdentities: readIdentities,
    serializeReadIdentities: serializeReadIdentities,
    isRead: isRead,
    markRead: markRead,
    tabItems: tabItems,
    parseRss20: parseRss20,
    parseAtom: parseAtom,
    parseFeed: parseFeed,
    isYouTubeFeedUrl: isYouTubeFeedUrl,
    youTubeVideoId: youTubeVideoId,
    shortsProbeUrl: shortsProbeUrl,
    classifyShortStatus: classifyShortStatus,
    normalizeShortsCache: normalizeShortsCache,
    filterShorts: filterShorts,
    unknownShortCandidates: unknownShortCandidates,
    looksLikeHtml: looksLikeHtml,
    discoverFeedUrls: discoverFeedUrls,
    guessFeedUrls: guessFeedUrls,
    resolveUrl: resolveUrl,
    recentList: recentList,
    rowText: rowText,
    normalizeFeedInputUrl: normalizeFeedInputUrl,
    getAvailableCategories: getAvailableCategories,
    normalizeCategorySelection: normalizeCategorySelection,
    addSubscription: addSubscription,
    setSubscriptionCategory: setSubscriptionCategory,
    removeSubscription: removeSubscription,
    pruneArticlesBySubscriptions: pruneArticlesBySubscriptions,
    mergeFeedArticles: mergeFeedArticles,
    MAX_CONCURRENT_FETCHES: MAX_CONCURRENT_FETCHES,
    createFetchScheduler: createFetchScheduler,
    DEFAULT_RETENTION_DAYS: DEFAULT_RETENTION_DAYS,
    MIN_RETENTION_DAYS: MIN_RETENTION_DAYS,
    MAX_RETENTION_DAYS: MAX_RETENTION_DAYS,
    normalizeRetentionDays: normalizeRetentionDays,
    pruneArticlesByRetention: pruneArticlesByRetention,
    relativeTime: relativeTime,
    stripHtml: stripHtml
  }
}
