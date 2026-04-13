/**
 * Gmail → GitHub automation for ISW-CTP Iran Crisis Shapefiles.
 *
 * Finds the LATEST email only (data is cumulative), extracts zip
 * attachments, and pushes them to data/zips/ on GitHub, overwriting
 * previous versions. A GitHub Action then converts to GeoJSON.
 *
 * Setup:
 *   1. Script Properties → GITHUB_TOKEN = your fine-grained PAT
 *   2. Run createDailyTrigger() once to schedule daily execution
 */

var REPO_OWNER = "amcaw";
var REPO_NAME = "WarMaps";
var BRANCH = "main";
var GMAIL_QUERY = 'subject:"ISW" subject:"Iran Crisis Shapefiles" after:2026/03/01';
var LABEL_NAME = "processed-iran-maps";

// Normalize attachment names to stable filenames
var LAYER_MAP = {
  "us and israeli strikes in iran": "us_israeli_strikes_iran",
  "iran and axis response": "iran_axis_response",
  "israeli strikes in lebanon": "israeli_strikes_lebanon",
  "us and israeli strikes in iraq": "us_israeli_strikes_iraq",
  "iran strikes against civilian vessels": "iran_civilian_vessels",
  "hezbollah attacks in lebanon": "hezbollah_lebanon"
};

function normalizeFilename(attName) {
  var lower = attName.toLowerCase();
  for (var key in LAYER_MAP) {
    if (lower.indexOf(key) !== -1) {
      return LAYER_MAP[key] + ".zip";
    }
  }
  // Fallback: sanitize the original name
  return lower.replace(/[^a-z0-9.]/g, '_').replace(/_+/g, '_');
}

// ── Entry point (called by daily trigger) ──────────────────────────

function processNewEmails() {
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) throw new Error("GITHUB_TOKEN not set in Script Properties");

  var label = getOrCreateLabel(LABEL_NAME);

  // Find unprocessed threads
  var threads = GmailApp.search(GMAIL_QUERY + ' -label:' + LABEL_NAME, 0, 50);
  if (threads.length === 0) {
    Logger.log("No new emails to process");
    return;
  }

  Logger.log("Found " + threads.length + " unprocessed thread(s)");

  // Sort threads by date descending, process only the latest
  threads.sort(function(a, b) {
    return b.getLastMessageDate().getTime() - a.getLastMessageDate().getTime();
  });

  // Process only the latest thread's latest message
  var latestThread = threads[0];
  var messages = latestThread.getMessages();
  var latestMsg = messages[messages.length - 1];

  Logger.log("Processing latest: " + latestMsg.getSubject());

  var attachments = latestMsg.getAttachments();
  var filesToCommit = [];

  for (var a = 0; a < attachments.length; a++) {
    var att = attachments[a];
    if (!att.getName().toLowerCase().endsWith(".zip")) continue;

    var blob = att.copyBlob();
    var stableName = normalizeFilename(att.getName());

    // Check if outer zip (contains inner zips) or direct shapefile zip
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
          var innerName = normalizeFilename(innerFiles[i].getName());
          filesToCommit.push({
            path: "data/zips/" + innerName,
            content: Utilities.base64Encode(innerFiles[i].getBytes())
          });
          Logger.log("  Queued: " + innerName);
        }
      } else {
        filesToCommit.push({
          path: "data/zips/" + stableName,
          content: Utilities.base64Encode(blob.getBytes())
        });
        Logger.log("  Queued: " + stableName);
      }
    } catch (e) {
      filesToCommit.push({
        path: "data/zips/" + stableName,
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
    commitFilesToGitHub(uniqueFiles, "Update shapefiles", token);
  }

  // Label ALL unprocessed threads (not just latest)
  for (var t = 0; t < threads.length; t++) {
    threads[t].addLabel(label);
  }
  Logger.log("Labeled " + threads.length + " thread(s) as processed");
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

// ── Reset: remove processed label (run once to reprocess) ──────────

function resetProcessedLabel() {
  var label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) { Logger.log("Label not found"); return; }
  var threads = label.getThreads();
  for (var i = 0; i < threads.length; i++) {
    threads[i].removeLabel(label);
  }
  Logger.log("Removed label from " + threads.length + " thread(s)");
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
