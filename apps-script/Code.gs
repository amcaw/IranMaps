/**
 * Gmail → GitHub automation for ISW-CTP Shapefiles.
 * Handles both Middle East (Iran Crisis) and Ukraine data.
 *
 * Finds the LATEST email only (data is cumulative), extracts zip
 * attachments, and pushes them to data/{region}/zips/ on GitHub.
 * A GitHub Action then converts to GeoJSON.
 *
 * Setup:
 *   1. Script Properties → GITHUB_TOKEN = your fine-grained PAT
 *   2. Run createDailyTrigger() once to schedule daily execution
 */

var REPO_OWNER = "amcaw";
var REPO_NAME = "WarMaps";
var BRANCH = "main";

// ── Region configurations ──────────────────────────────────────────

var REGIONS = {
  "middle-east": {
    query: 'subject:"ISW" subject:"Iran" subject:"Shapefiles" after:2026/03/01',
    label: "processed-iran-maps",
    dataPath: "data/middle-east/zips/",
    layerMap: {
      "us and israeli strikes in iran": "us_israeli_strikes_iran",
      "iran and axis response": "iran_axis_response",
      "israeli strikes in lebanon": "israeli_strikes_lebanon",
      "us and israeli strikes in iraq": "us_israeli_strikes_iraq",
      "iran strikes against civilian vessels": "iran_civilian_vessels",
      "hezbollah attacks in lebanon": "hezbollah_lebanon"
    }
  },
  "ukraine": {
    query: 'subject:"ISW" subject:"Shapefiles" subject:"Ukraine" after:2026/03/01',
    label: "processed-ukraine-maps",
    dataPath: "data/ukraine/zips/",
    layerMap: {
      "ukrainecontrolmap": "ukraine_control_map",
      "assessedrussianadvances": "russian_advances",
      "assessedrussianinfiltration": "russian_infiltration",
      "claimedrussianterritory": "claimed_russian_territory",
      "claimedukrainiancounteroffensives": "ukrainian_counteroffensives"
    }
  }
};

function normalizeFilename(attName, layerMap) {
  if (!attName) return "unknown.zip";
  var lower = attName.toLowerCase().replace(/[^a-z]/g, '');
  for (var key in layerMap) {
    var normalizedKey = key.replace(/[^a-z]/g, '');
    if (lower.indexOf(normalizedKey) !== -1) {
      return layerMap[key] + ".zip";
    }
  }
  // Fallback: sanitize the original name
  return attName.toLowerCase().replace(/[^a-z0-9.]/g, '_').replace(/_+/g, '_');
}

// ── Date extraction from email subjects ────────────────────────────

var MONTHS = {
  "january": "01", "february": "02", "march": "03", "april": "04",
  "may": "05", "june": "06", "july": "07", "august": "08",
  "september": "09", "october": "10", "november": "11", "december": "12"
};

/**
 * Extracts a date string from ISW email subjects like:
 *   "ISW–CTP Daily Shapefiles (Ukraine) – April 12, 2026"
 *   "ISW Iran Crisis Shapefiles Evening of April 12, 2026"
 * Returns "2026-04-12" or null if not found.
 */
function extractSubjectDate(subject) {
  if (!subject) return null;
  var match = subject.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!match) return null;
  var month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  var day = match[2].length === 1 ? "0" + match[2] : match[2];
  return match[3] + "-" + month + "-" + day;
}

// ── Entry point (called by daily trigger) ──────────────────────────

function processNewEmails() {
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) throw new Error("GITHUB_TOKEN not set in Script Properties");

  for (var regionName in REGIONS) {
    processRegion(regionName, REGIONS[regionName], token);
  }
}

function processRegion(regionName, config, token) {
  var label = getOrCreateLabel(config.label);

  var threads = GmailApp.search(config.query + ' -label:' + config.label, 0, 50);
  if (threads.length === 0) {
    Logger.log("[" + regionName + "] No new emails");
    return;
  }

  Logger.log("[" + regionName + "] Found " + threads.length + " unprocessed thread(s)");

  // Pick the thread with the latest subject date; break ties by received time.
  var latestThread = null;
  var latestSubjectDate = null;

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var subjectDate = extractSubjectDate(thread.getFirstMessageSubject());
    var isNewer = !latestThread
      || (subjectDate && (!latestSubjectDate || subjectDate > latestSubjectDate))
      || (subjectDate === latestSubjectDate && thread.getLastMessageDate().getTime() > latestThread.getLastMessageDate().getTime());
    if (isNewer) {
      latestSubjectDate = subjectDate;
      latestThread = thread;
    }
  }

  // Skip if this email's data is not newer than what we last processed
  var lastDateKey = "last_date_" + regionName;
  var lastProcessedDate = PropertiesService.getScriptProperties().getProperty(lastDateKey);
  if (latestSubjectDate && lastProcessedDate && latestSubjectDate < lastProcessedDate) {
    Logger.log("[" + regionName + "] Skipping — email date " + latestSubjectDate + " is not newer than last processed " + lastProcessedDate);
    // Still label threads so they don't get picked up again
    for (var t = 0; t < threads.length; t++) {
      threads[t].addLabel(label);
    }
    return;
  }

  var messages = latestThread.getMessages();
  var latestMsg = messages[messages.length - 1];

  Logger.log("[" + regionName + "] Processing: " + latestMsg.getSubject() + " (date: " + latestSubjectDate + ")");

  var attachments = latestMsg.getAttachments();
  var filesToCommit = [];

  for (var a = 0; a < attachments.length; a++) {
    var att = attachments[a];
    if (!att.getName().toLowerCase().endsWith(".zip")) continue;

    var blob = att.copyBlob();
    var stableName = normalizeFilename(att.getName(), config.layerMap);

    try {
      var innerFiles = Utilities.unzip(blob);
      var hasInnerZips = false;
      for (var i = 0; i < innerFiles.length; i++) {
        if (innerFiles[i].getName().toLowerCase().endsWith(".zip")) {
          hasInnerZips = true;
          break;
        }
      }

      if (hasInnerZips) {
        for (var i = 0; i < innerFiles.length; i++) {
          if (!innerFiles[i].getName().toLowerCase().endsWith(".zip")) continue;
          var innerName = normalizeFilename(innerFiles[i].getName(), config.layerMap);
          filesToCommit.push({
            path: config.dataPath + innerName,
            content: Utilities.base64Encode(innerFiles[i].getBytes())
          });
          Logger.log("  Queued: " + innerName);
        }
      } else {
        filesToCommit.push({
          path: config.dataPath + stableName,
          content: Utilities.base64Encode(blob.getBytes())
        });
        Logger.log("  Queued: " + stableName);
      }
    } catch (e) {
      filesToCommit.push({
        path: config.dataPath + stableName,
        content: Utilities.base64Encode(blob.getBytes())
      });
      Logger.log("  Queued (raw): " + stableName);
    }
  }

  // Deduplicate
  var seen = {};
  var uniqueFiles = [];
  for (var f = 0; f < filesToCommit.length; f++) {
    if (!seen[filesToCommit[f].path]) {
      seen[filesToCommit[f].path] = true;
      uniqueFiles.push(filesToCommit[f]);
    }
  }

  if (uniqueFiles.length > 0) {
    commitFilesToGitHub(uniqueFiles, "Update " + regionName + " shapefiles", token);
  }

  // Save last processed date so we don't regress to older data
  if (latestSubjectDate) {
    PropertiesService.getScriptProperties().setProperty(lastDateKey, latestSubjectDate);
  }

  // Label threads only after successful commit (data is cumulative,
  // so the latest supersedes all older ones — safe to mark all as done).
  // If commitFilesToGitHub throws, we never reach here and threads
  // will be reprocessed on the next run.
  for (var t = 0; t < threads.length; t++) {
    threads[t].addLabel(label);
  }
  Logger.log("[" + regionName + "] Labeled " + threads.length + " thread(s) as processed");
}

// ── Commit files to GitHub (overwrites existing) ───────────────────

function commitFilesToGitHub(files, message, token) {
  var baseUrl = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME;
  var headers = {
    "Authorization": "Bearer " + token,
    "Accept": "application/vnd.github+json"
  };

  var refResp = githubApi("GET", baseUrl + "/git/ref/heads/" + BRANCH, null, headers);
  var latestCommitSha = refResp.object.sha;

  var commitResp = githubApi("GET", baseUrl + "/git/commits/" + latestCommitSha, null, headers);
  var baseTreeSha = commitResp.tree.sha;

  var treeItems = [];
  for (var i = 0; i < files.length; i++) {
    var blobResp = githubApi("POST", baseUrl + "/git/blobs", {
      content: files[i].content,
      encoding: "base64"
    }, headers);

    treeItems.push({
      path: files[i].path,
      mode: "100644",
      type: "blob",
      sha: blobResp.sha
    });
  }

  var treeResp = githubApi("POST", baseUrl + "/git/trees", {
    base_tree: baseTreeSha,
    tree: treeItems
  }, headers);

  // Skip commit if tree is unchanged (data already up to date)
  if (treeResp.sha === baseTreeSha) {
    Logger.log("No changes — data already up to date, skipping commit");
    return;
  }

  var newCommitResp = githubApi("POST", baseUrl + "/git/commits", {
    message: message,
    tree: treeResp.sha,
    parents: [latestCommitSha]
  }, headers);

  githubApi("PATCH", baseUrl + "/git/refs/heads/" + BRANCH, {
    sha: newCommitResp.sha
  }, headers);

  Logger.log("Committed " + files.length + " files");
}

// ── GitHub API helper ──────────────────────────────────────────────

function githubApi(method, url, payload, headers) {
  var options = {
    method: method.toLowerCase(),
    headers: headers,
    contentType: "application/json",
    muteHttpExceptions: true
  };
  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  var resp = UrlFetchApp.fetch(url, options);
  var code = resp.getResponseCode();

  if (code < 200 || code >= 300) {
    throw new Error("GitHub API error " + code + ": " + resp.getContentText());
  }

  return JSON.parse(resp.getContentText());
}

// ── Gmail label helper ─────────────────────────────────────────────

function getOrCreateLabel(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}

// ── Reset: clear last-processed dates (run once to force reprocess) ──

function resetProcessedDates() {
  var props = PropertiesService.getScriptProperties();
  for (var regionName in REGIONS) {
    props.deleteProperty("last_date_" + regionName);
    Logger.log("Cleared last_date_" + regionName);
  }
}

// ── Reset: remove processed labels (run once to reprocess) ─────────

function resetProcessedLabel() {
  var labels = [REGIONS["middle-east"].label, REGIONS["ukraine"].label];
  for (var l = 0; l < labels.length; l++) {
    var label = GmailApp.getUserLabelByName(labels[l]);
    if (!label) continue;
    var threads = label.getThreads();
    for (var i = 0; i < threads.length; i++) {
      threads[i].removeLabel(label);
    }
    Logger.log("Removed " + labels[l] + " from " + threads.length + " thread(s)");
  }
}

// ── Trigger setup (run once manually) ──────────────────────────────

function createDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processNewEmails") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("processNewEmails")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  Logger.log("Daily trigger created: processNewEmails will run at ~8am every day");
}
