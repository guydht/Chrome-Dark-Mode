chrome.runtime.onMessage.addListener(function(data, sender, sendResponse){
	if(data.request){
		let xml = new XMLHttpRequest();
		xml.open(data.method || "GET", data.url, true);
		xml.send(data.data);
		xml.onreadystatechange = function(){
			console.log(xml);
			if(xml.readyState == 4)
				sendResponse({responseText: xml.responseText, responseURL: xml.responseURL, readyState: xml.readyState, status: xml.status, headers: xml.getAllResponseHeaders()});
		}
	}
	return true;
});

chrome.storage.onChanged.addListener(function(data, name){
	if(name === "local" && data.darkTheme)
		setIcon();
});

chrome.runtime.onStartup.addListener(setIcon);

function setIcon(){
	chrome.storage.local.get("darkTheme", function({darkTheme: response}){
		let mapping = {
			'true': 'black',
			'false': 'white'
		};
		chrome.browserAction.setIcon({path: `${mapping[response.toString()]}.png`});
	});
}