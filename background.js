// this is the background code...

// MV3 service worker background script
// Notifications replace alert() and action replaces browserAction


var currentTab;
var version = "1.0";

function isHttpUrl(u){
    try {
        var url = new URL(u);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch(e) {
        return false;
    }
}

// INSERT helpers de validation pour réduire les faux positifs
function base64urlDecode(input){
    try {
        var s = String(input).replace(/-/g,'+').replace(/_/g,'/');
        while (s.length % 4 !== 0) { s += '='; }
        return atob(s);
    } catch(e) { return null; }
}
function isLikelyDiscordBotToken(token){
    try {
        if (typeof token !== 'string') return false;
        var parts = token.split('.');
        if (parts.length !== 3) return false;
        var p1 = base64urlDecode(parts[0]);
        if (!p1) return false;
        return /^\d{15,21}$/.test(p1);
    } catch(e){ return false; }
}
function hasContextNear(data, index, keywords){
    try {
        var start = Math.max(0, index - 140);
        var end = Math.min(data.length, index + 140);
        var windowStr = data.substring(start, end).toLowerCase();
        for (var i=0;i<keywords.length;i++){
            if (windowStr.indexOf(keywords[i]) !== -1){ return true; }
        }
        return false;
    } catch(e){ return false; }
}
function isLikelySendGrid(token, data, index){
    try {
        if (typeof token !== 'string') return false;
        if (!/^SG\.[A-Za-z0-9\-_]{22}\.[A-Za-z0-9\-_]{43}$/.test(token)) return false;
        var parts = token.split('.');
        if (parts.length !== 3) return false;
        var d1 = base64urlDecode(parts[1]);
        if (!d1 || d1.length < 8 || d1.length > 128) return false;
        if (!hasContextNear(data, index, ['sendgrid','authorization','email'])) return false;
        return true;
    } catch(e){ return false; }
}

// Déduplication / rate limit notifications (120s par finding)
var recentNotifications = {};
function shouldNotify(finding){
    try {
        var sig = [finding.parentOrigin, finding.key, finding.src, finding.match].join('|');
        var now = Date.now();
        var last = recentNotifications[sig] || 0;
        if (now - last < 120000) { return false; }
        recentNotifications[sig] = now;
        return true;
    } catch(e){ return true; }
}

// Aides réduction de faux positifs (Discord)
function base64urlDecode(input){
    try {
        var s = String(input).replace(/-/g,'+').replace(/_/g,'/');
        while (s.length % 4 !== 0) { s += '='; }
        return atob(s);
    } catch(e) { return null; }
}
function isLikelyDiscordBotToken(token){
    try {
        if (typeof token !== 'string') return false;
        var parts = token.split('.');
        if (parts.length !== 3) return false;
        var p1 = base64urlDecode(parts[0]);
        if (!p1) return false;
        return /^\d{15,21}$/.test(p1);
    } catch(e){ return false; }
}

// Agrégateur d'une seule notification globale
var summaryGlobal = {count: 0, keys: {}, timer: null};
function scheduleGlobalSummary(){
    var entry = summaryGlobal;
    if (entry.timer) return;
    entry.timer = setTimeout(function(){
        chrome.storage.sync.get(["alerts"], function(result) {
            if (result.alerts == undefined || result.alerts){
                var total = entry.count || 0;
                var top = Object.keys(entry.keys).sort(function(a,b){ return (entry.keys[b]-entry.keys[a]); }).slice(0,3);
                var parts = [];
                for (let k of top){ parts.push(k+":"+entry.keys[k]); }
                var body = total + " finding" + (total>1?"s":"");
                if (parts.length){ body += " (" + parts.join(", ") + ")"; }
                if (total > 0) { showNotification('Trufflehog summary', body); }
            }
            // reset counters
            summaryGlobal.count = 0;
            summaryGlobal.keys = {};
            entry.timer = null;
        });
    }, 1500);
}

chrome.storage.sync.get(['ranOnce'], function(ranOnce) {
    if (! ranOnce.ranOnce){
        chrome.storage.sync.set({"ranOnce": true});
        chrome.storage.sync.set({"originDenyList": ["https://www.google.com"]});
    }

})


let specifics = {
    "Slack Token": "(xox[pboa]-[0-9]{12}-[0-9]{12}-[0-9]{12}-[a-z0-9]{32})",
    "RSA private key": "-----BEGIN RSA PRIVATE KEY-----",
    "SSH (DSA) private key": "-----BEGIN DSA PRIVATE KEY-----",
    "SSH (EC) private key": "-----BEGIN EC PRIVATE KEY-----",
    "PGP private key block": "-----BEGIN PGP PRIVATE KEY BLOCK-----",
    "Amazon MWS Auth Token": "amzn\\.mws\\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    "AWS AppSync GraphQL Key": "da2-[a-z0-9]{26}",
    "Facebook Access Token": "EAACEdEose0cBA[0-9A-Za-z]+",
    "Facebook OAuth": "[fF][aA][cC][eE][bB][oO][oO][kK].{0,20}['|\"][0-9a-f]{32}['|\"]",
    "GitHub": "[gG][iI][tT][hH][uU][bB].{0,20}['|\"][0-9a-zA-Z]{35,40}['|\"]",
   // "Google API Key": "AIza[0-9A-Za-z\\-_]{35}",
   // "Google Cloud Platform API Key": "AIza[0-9A-Za-z\\-_]{35}",
   // "Google Cloud Platform OAuth": "[0-9]+-[0-9A-Za-z_]{32}\\.apps\\.googleusercontent\\.com",
   // "Google Drive API Key": "AIza[0-9A-Za-z\\-_]{35}",
   // "Google Drive OAuth": "[0-9]+-[0-9A-Za-z_]{32}\\.apps\\.googleusercontent\\.com",
    "Google (GCP) Service-account": "\"type\": \"service_account\"",
   // "Google Gmail API Key": "AIza[0-9A-Za-z\\-_]{35}",
   // "Google Gmail OAuth": "[0-9]+-[0-9A-Za-z_]{32}\\.apps\\.googleusercontent\\.com",
   // "Google OAuth Access Token": "ya29\\.[0-9A-Za-z\\-_]+",
   // "Google YouTube API Key": "AIza[0-9A-Za-z\\-_]{35}",
  //  "Google YouTube OAuth": "[0-9]+-[0-9A-Za-z_]{32}\\.apps\\.googleusercontent\\.com",
    "Heroku API Key": "[hH][eE][rR][oO][kK][uU].{0,20}[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}",
    "Json Web Token" : "eyJhbGciOiJ",
    "MailChimp API Key": "[0-9a-f]{32}-us[0-9]{1,2}",
    "Mailgun API Key": "key-[0-9a-zA-Z]{32}",
    "Password in URL": "[a-zA-Z]{3,10}://[^/\\s:@]{3,20}:[^/\\s:@]{3,20}@.{1,100}[\"'\\s]",
    "PayPal Braintree Access Token": "access_token\\$production\\$[0-9a-z]{16}\\$[0-9a-f]{32}",
    "Picatic API Key": "sk_live_[0-9a-z]{32}",
    "Slack Webhook": "https://hooks\\.slack\\.com/services/T[a-zA-Z0-9_]{8}/B[a-zA-Z0-9_]{8}/[a-zA-Z0-9_]{24}",
    "Stripe API Key": "sk_live_[0-9a-zA-Z]{24}",
    "Stripe Restricted API Key": "rk_live_[0-9a-zA-Z]{24}",
    "Square Access Token": "sq0atp-[0-9A-Za-z\\-_]{22}",
    "Square OAuth Secret": "sq0csp-[0-9A-Za-z\\-_]{43}",
    "Telegram Bot API Key": "[0-9]+:AA[0-9A-Za-z\\-_]{33}",
    "Twilio API Key": "SK[0-9a-fA-F]{32}",
    "Github Auth Creds": "https:\/\/[a-zA-Z0-9]{40}@github\.com",
   // "Twitter Access Token": "[tT][wW][iI][tT][tT][eE][rR].*[1-9][0-9]+-[0-9a-zA-Z]{40}",
   // "Twitter OAuth": "[tT][wW][iI][tT][tT][eE][rR].*['|\"][0-9a-zA-Z]{35,44}['|\"]",

    // 2025 additional providers
    "GitHub Token": "gh[pousr]_[A-Za-z0-9]{36}",
    "GitLab Personal Access Token": "glpat-[A-Za-z0-9_-]{20}",
    "Slack Bot Token (xoxb)": "xoxb-[0-9]{11,}-[0-9]{11,}-[A-Za-z0-9]{24}",
    "Slack User Token (xoxp)": "xoxp-[0-9]{11,}-[0-9]{11,}-[0-9]{11,}-[A-Za-z0-9]{32}",
    "Slack App Token (xapp)": "xapp-1-[A-Za-z0-9-]{64,}",
    "Discord Bot Token": "[A-Za-z0-9_\-]{24}\.[A-Za-z0-9_\-]{6}\.[A-Za-z0-9_\-]{27}",
    "Discord Webhook": "https:\/\/discord\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_\-]+",
    "Stripe Publishable Key": "pk_live_[A-Za-z0-9]{24,}",
    "Twilio Account SID": "AC[0-9a-fA-F]{32}",
    "SendGrid API Key": "SG\.[A-Za-z0-9\-_]{22}\.[A-Za-z0-9\-_]{43}",
    "Datadog API Key": "ddapi_[a-f0-9]{32}",
    "Datadog Application Key": "ddapp_[a-f0-9]{40}",
    "Google API Key": "AIza[0-9A-Za-z\-_]{35}",
    "Google OAuth Client ID": "[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com",
    "Shopify Access Token": "shpat_[a-f0-9]{32}",
    "Shopify Private App Password": "shppa_[a-f0-9]{32}",
    "OpenAI API Key": "sk-[A-Za-z0-9]{32,}"
}

let generics = {
    "Generic API Key": "[aA][pP][iI]_?[kK][eE][yY].{0,20}['|\"][0-9a-zA-Z]{32,45}['|\"]",
    "Generic Secret": "[sS][eE][cC][rR][eE][tT].{0,20}['|\"][0-9a-zA-Z]{32,45}['|\"]",
    "Bearer Token": "Bearer\\s+[A-Za-z0-9\-_.=]{20,}"
}

let aws = {
    "AWS API Key": "((?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16})",
}

let denyList = ["AIDAAAAAAAAAAAAAAAAA"]

a = ""
b = ""




var checkData = function(data, src, regexes, fromEncoded=false, parentUrl=undefined, parentOrigin=undefined){
    var findings = [];
    for (let key in regexes){
        let re = new RegExp(regexes[key])
        let matchObj = re.exec(data);
        if (!matchObj) { continue; }
        let match = Array.isArray(matchObj) ? matchObj[0] : String(matchObj);
        if (Array.isArray(match)){match = match.toString()}
        if (denyList.includes(match)){
            continue;
        }
        if (match){
            // validations spécifiques pour réduire les faux positifs
            if (key === "Discord Bot Token" && !isLikelyDiscordBotToken(match)){
                continue;
            }
            if (key === "SendGrid API Key" && !isLikelySendGrid(match, data, matchObj.index)){
                continue;
            }
            let finding = {};
            finding = {src: src, match:match, key:key, encoded:fromEncoded, parentUrl:parentUrl, parentOrigin: parentOrigin};
            a = data;
            b = re;
            findings.push(finding);
        }
    }
    if (findings){
        chrome.storage.sync.get(["leakedKeys"], function(result) {
            if (Array.isArray(result.leakedKeys) || ! result.leakedKeys){
                var keys = {};
            }else{
                var keys = result.leakedKeys;
            };
            for (let finding of findings){
                if(Array.isArray(keys[parentOrigin])){
                    var newFinding = true;
                    for (key of keys[parentOrigin]){
                        if (key["src"] == finding["src"] && key["match"] == finding["match"] && key["key"] == finding["key"] && key["encoded"] == finding["encoded"] && key["parentUrl"] == finding["parentUrl"]){
                            newFinding = false;
                            break;
                        }
                    }
                    if(newFinding){
                        keys[parentOrigin].push(finding)
                        chrome.storage.sync.set({"leakedKeys": keys}, function(){
                            updateTabAndAlert(finding);
                        });
                    }
                }else{
                    keys[parentOrigin] = [finding];
                    chrome.storage.sync.set({"leakedKeys": keys}, function(){
                        updateTabAndAlert(finding);
                    })
                }
             }
        })
    }
    let decodedStrings = getDecodedb64(data);
    for (encoded of decodedStrings){
        checkData(encoded[1], src, regexes, encoded[0], parentUrl, parentOrigin);
    }
}
var showNotification = function(title, message){
    try {
        chrome.notifications.create('', {
            type: 'basic',
            iconUrl: 'icon128.png',
            title: title,
            message: message
        });
    } catch(e) {}
}

var updateTabAndAlert = function(finding){
    // Agrégation pour une seule notification de résumé (service worker: pas de window)
    var k = finding["key"] || "Unknown";
    if (!summaryGlobal) { summaryGlobal = {count: 0, keys: {}, timer: null}; }
    summaryGlobal.count += 1;
    summaryGlobal.keys[k] = (summaryGlobal.keys[k] || 0) + 1;
    scheduleGlobalSummary();
    updateTab();
}

var updateTab = function(){
     chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || !tabs[0]) { return; }
        var tab = tabs[0];
        var tabId = tab.id;
        var tabUrl = tab.url || '';
        var origin = '';
        try {
            var u = new URL(tabUrl);
            if (u.protocol === 'http:' || u.protocol === 'https:') {
                origin = u.origin;
            }
        } catch(e) {}
        if (!origin) {
            try { chrome.action.setBadgeText({text: '', tabId: tabId}); } catch(e) {}
            return;
        }
        chrome.storage.sync.get(["leakedKeys"], function(result) {
            var keys = result.leakedKeys || {};
            var keysForOrigin = keys[origin];
            var originKeys = Array.isArray(keysForOrigin) ? keysForOrigin.length.toString() : "";
            try {
                chrome.action.setBadgeText({text: originKeys, tabId: tabId});
                chrome.action.setBadgeBackgroundColor({color: '#ff0000', tabId: tabId});
            } catch(e) {}
        })
    });
}

chrome.tabs.onActivated.addListener(function(activeInfo) {
    updateTab();
});

var getStringsOfSet = function(word, char_set, threshold=20){
    let count = 0;
    let letters = "";
    let strings = [];
    if (! word){
        return []
    }
    for(let char of word){
        if (char_set.indexOf(char) > -1){
            letters += char;
            count += 1;
        } else{
            if ( count > threshold ){
                strings.push(letters);
            }
            letters = "";
            count = 0;
        }
    }
    if(count > threshold){
        strings.push(letters);
    }
    return strings
}

var getDecodedb64 = function(inputString){
    let b64CharSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let encodeds = getStringsOfSet(inputString, b64CharSet);
    let decodeds = [];
    for (encoded of encodeds){
        try {
            let decoded = [encoded, atob(encoded)];
            decodeds.push(decoded);
        } catch(e) {
        }
    }
    return decodeds;
}

var checkIfOriginDenied = function(check_url, cb){
    let skip = false;
    chrome.storage.sync.get(["originDenyList"], function(result) {
        let originDenyList = result.originDenyList;
        for (origin of originDenyList){
            if(check_url.startsWith(origin)){
                skip = true;
            }
        }
        cb(skip);
    })
}
var checkForGitDir = function(data, url){
    if(data.startsWith("[core]")){
        showNotification('Trufflehog', ".git dir found in " + url + " feature to check this for secrets not supported");
    }

}
var js_url;
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

    chrome.storage.sync.get(['generics'], function(useGenerics) {
        chrome.storage.sync.get(['specifics'], function(useSpecifics) {
            chrome.storage.sync.get(['aws'], function(useAws) {
                chrome.storage.sync.get(['checkEnv'], function(checkEnv) {
                    chrome.storage.sync.get(['checkGit'], function(checkGit) {
                        let regexes = {};
                        if(useGenerics["generics"] || useGenerics["generics"] == undefined){
                            regexes = {
                                ...regexes,
                                ...generics
                            }
                        }
                        if(useSpecifics["specifics"] || useSpecifics["specifics"] == undefined){
                            regexes = {
                                ...regexes,
                                ...specifics
                            }
                        }
                        if(useAws["aws"] || useAws["aws"] == undefined){
                            regexes = {
                                ...regexes,
                                ...aws
                            }
                        }
                        if (request.scriptUrl) {
                            let js_url = request.scriptUrl;
                            let parentUrl = request.parentUrl;
                            let parentOrigin = request.parentOrigin;
                            checkIfOriginDenied(js_url, function(skip){
                                if (!skip && isHttpUrl(js_url)){
                                    fetch(js_url, {"credentials": 'include'})
                                        .then(function(response){ if(!response.ok) { throw new Error('HTTP '+response.status); } return response.text(); })
                                        .then(function(data){ checkData(data, js_url, regexes, undefined, parentUrl, parentOrigin); })
                                        .catch(function(err){ console.debug('fetch script failed', js_url, err && err.message); });
                                }

                            })

                        }else if(request.pageBody){
                            checkIfOriginDenied(request.origin, function(skip){
                                if (!skip){
                                    checkData(request.pageBody, request.origin, regexes, undefined, request.parentUrl, request.parentOrigin);
                                }
                            })
                        }else if(request.envFile){
                            if(checkEnv['checkEnv'] && isHttpUrl(request.envFile)){
                                fetch(request.envFile, {"credentials": 'include'})
                                    .then(function(response){ if(!response.ok) { throw new Error('HTTP '+response.status); } return response.text(); })
                                    .then(function(data){ checkData(data, ".env file at " + request.envFile, regexes, undefined, request.parentUrl, request.parentOrigin); })
                                    .catch(function(err){ console.debug('fetch env failed', request.envFile, err && err.message); });
                            }
                        }else if(request.openTabs){
                            for (tab of request.openTabs){
                                try { chrome.tabs.create({ url: tab }); } catch(e) {}
                                console.log(tab)
                            }
                        }else if(request.gitDir){
                            if(checkGit['checkGit'] && isHttpUrl(request.gitDir)){
                                fetch(request.gitDir, {"credentials": 'include'})
                                    .then(function(response){ if(!response.ok) { throw new Error('HTTP '+response.status); } return response.text(); })
                                    .then(function(data){ checkForGitDir(data, request.gitDir); })
                                    .catch(function(err){ console.debug('fetch git failed', request.gitDir, err && err.message); });
                            }

                        }
                    });
                });
            });

        });
    });



});

