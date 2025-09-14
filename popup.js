
let toggles = ["generics", "specifics", "aws", "checkEnv", "checkGit", "alerts"];

let toggleDefaults = {
    "generics": true,
    "specifics": true,
    "aws": true,
    "checkEnv": false,
    "checkGit": false,
    "alerts":true
}

for (let toggle of toggles){
    chrome.storage.sync.get([toggle], function(result) {
        if (result[toggle] == undefined){
            document.getElementById(toggle).checked = toggleDefaults[toggle];
            var setObj = {}
            setObj[toggle] = toggleDefaults[toggle];
            chrome.storage.sync.set(setObj);
        }else if (result[toggle] == true) {
           document.getElementById(toggle).checked = true;
        }

    });
    document.getElementById(toggle).addEventListener('click', function(){
        var toggleChecked = document.getElementById(toggle).checked;
        var value = false;
        if (toggleChecked){
            value = true;
        }
        var setObj = {}
        setObj[toggle] = value;
        chrome.storage.sync.set(setObj);

    });

}


function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
var acc = document.getElementsByClassName("accordion");
var i;

for (i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function() {
    /* Toggle between adding and removing the "active" class,
    to highlight the button that controls the panel */
    this.classList.toggle("active");

    /* Toggle between hiding and showing the active panel */
    var panel = this.nextElementSibling;
    if (panel.style.display === "block") {
      panel.style.display = "none";
    } else {
      panel.style.display = "block";
      var el = document.getElementById("denyList");
      chrome.storage.sync.get(["originDenyList"], function(result) {
        el.value = result.originDenyList.join(",");
        el.focus();
      })
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || !tabs[0]) { return; }
        var tab = tabs[0];
        var origin = (new URL(tab.url)).origin;
        chrome.storage.sync.get(["leakedKeys"], function(result) {
            var keys = result.leakedKeys ? result.leakedKeys[origin] : [];
            let keyInfo = "";
            let htmlList = "";
            if(!keys){keys = []}
            for (let key of keys){
                keyInfo = key["key"] + ": " + key["match"] + " found in " + key["src"];
                if (key["encoded"]){
                     keyInfo += " decoded from " + key["encoded"].substring(0,9) + "..."
                }
                keyInfo = htmlEntities(keyInfo);
                var copyPayload = htmlEntities(key["match"]);
                var link = key["src"] ? (" <a href=\"" + htmlEntities(key["src"]) + "\" target=\"_blank\" rel=\"noopener noreferrer\">open</a>") : "";
                htmlList += "<li>" + keyInfo + link + " <button class=\"copyFinding\" data-text=\"" + copyPayload + "\">Copy</button></li>\n"
            }
            document.getElementById("findingList").innerHTML = htmlList;
            var buttons = document.getElementsByClassName('copyFinding');
            for (var j = 0; j < buttons.length; j++){
                buttons[j].addEventListener('click', function(e){
                    var text = e.target.getAttribute('data-text');
                    navigator.clipboard.writeText(text).catch(function(){
                        try {
                            var ta = document.createElement('textarea');
                            ta.value = text;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            document.body.removeChild(ta);
                        } catch(err) {}
                    });
                });
            }
        })
      })

    }
  });
}

var downloadCSV = function(){
    chrome.storage.sync.get(["leakedKeys"], function(result) {
        let csvRows = [];
        for (let origin in result.leakedKeys){
            var findings = result.leakedKeys[origin];
            for (finding of findings){
                csvRows.push([origin, finding["src"], finding["parentUrl"], finding["key"], finding["match"], finding["encoded"]])
            }
        }
        let csvContent = "data:text/csv;charset=utf-8,"
            + csvRows.map(e => e.join(",")).join("\n");
        var encodedUri = encodeURI(csvContent);
        window.open(encodedUri);
    })
}

document.getElementById("downloadAllFindings").addEventListener("click", function() {
    downloadCSV();
})
document.getElementById("copyAllFindings").addEventListener("click", function() {
    chrome.storage.sync.get(["leakedKeys"], function(result) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || !tabs[0]) { return; }
            var tab = tabs[0];
            var origin = (new URL(tab.url)).origin;
            var keys = (result.leakedKeys && result.leakedKeys[origin]) ? result.leakedKeys[origin] : [];
            var lines = [];
            for (var i=0;i<keys.length;i++){
                var k = keys[i];
                var line = k["key"] + ": " + k["match"] + " | src=" + k["src"] + (k["encoded"] ? (" | decoded from=" + k["encoded"]) : "");
                lines.push(line);
            }
            var text = lines.join("\n");
            navigator.clipboard.writeText(text).catch(function(){
                try {
                    var ta = document.createElement('textarea');
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                } catch(err) {}
            });
        })
    })
})
document.getElementById("clearOriginFindings").addEventListener("click", function() {
    chrome.storage.sync.get(["leakedKeys"], function(result) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || !tabs[0]) { return; }
            var tab = tabs[0];
            var origin = (new URL(tab.url)).origin;
            if (!result.leakedKeys) { result.leakedKeys = {}; }
            result.leakedKeys[origin] = {};
            chrome.storage.sync.set({"leakedKeys": result.leakedKeys});
            chrome.action.setBadgeText({text: ''});
            document.getElementById("findingList").innerHTML = "";
        })
    })
})
document.getElementById("clearAllFindings").addEventListener("click", function() {
    chrome.storage.sync.get(["leakedKeys"], function(result) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || !tabs[0]) { return; }
            result.leakedKeys = {};
            chrome.storage.sync.set({"leakedKeys": result.leakedKeys});
            chrome.action.setBadgeText({text: ''});
            document.getElementById("findingList").innerHTML = "";
        })
    })
})
document.getElementById("openTabs").addEventListener("click", function() {
    var rawTabList = document.getElementById("tabList").value;
    var tabList = rawTabList.split(",").map(function(item) {
        return item.trim();
    })
    for (tab of tabList){
        console.log(tab)
    }
    chrome.runtime.sendMessage({"openTabs": tabList});
})


var denyListElement = document.getElementById("denyList");
var changeEvent = function(){
    var rawDenyList = denyListElement.value;
    var denyList = rawDenyList.split(",").map(function(item) {
        return item.trim();
    })
    chrome.storage.sync.set({"originDenyList": denyList});
};

denyListElement.addEventListener('keyup', changeEvent);
denyListElement.addEventListener('paste', changeEvent);
