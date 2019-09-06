chrome.storage.local.get("darkTheme", function(response){
	document.getElementById("guydhtDarkThemeActivate").checked = response.darkTheme;
	if(response.darkTheme)
		document.body.classList.add("dark");
});

document.getElementById("guydhtDarkThemeActivate").onchange = function(){
	chrome.storage.local.set({darkTheme: this.checked});
	let mapping = {
		'true': 'black',
		'false': 'white'
	};
	chrome.browserAction.setIcon({path: `${mapping[this.checked.toString()]}.png`});
	document.body.classList.toggle("dark");
};

chrome.storage.local.get("doTransition", ({doTransition}) => {
	document.getElementById("guydhtTransitionToggle").checked = doTransition;
	if(!doTransition)
		document.getElementById("changeTransitionWrapper").classList.add("d-none");
});

document.getElementById("guydhtTransitionToggle").onchange = function(){
	chrome.storage.local.set({doTransition: this.checked});
	document.getElementById("changeTransitionWrapper").classList.toggle("d-none");
};

chrome.storage.local.get("transitionMilliSeconds", ({transitionMilliSeconds}) => {
	document.getElementById("transitionMilliSeconds").value = transitionMilliSeconds;	
});

document.getElementById("transitionMilliSeconds").onchange = function(){
	chrome.storage.local.set({"transitionMilliSeconds": this.value});
};

chrome.storage.sync.get("currentList", function({currentList}){
	
	if(currentList === "Blacklist"){
		document.querySelector("#list").classList.add("blacklist");
	}
	
	let addDomain = document.querySelector("#addDomain");
	chrome.storage.sync.get(currentList, function({[currentList]: list}){
		fillListWithList(list);

		chrome.tabs.query({active: true, currentWindow: true}, function(response){
				url = response[0].url;
			addDomain.dataset.currenturl = url;
			try{
				let domain = new URL(url).origin;
				setAddDomainButtonText(domain, currentList, list);
			}catch(e){
				addDomain.innerHTML = `Sorry, I can't run in this page!`;
			}
		});

	});
	
	addDomain.onclick = function(){
		chrome.storage.sync.get("currentList", function({currentList}){
			chrome.storage.sync.get(currentList, function({[currentList]: list = []}){
				let domain = new URL(addDomain.dataset.currenturl).origin;
				if(!list.includes(domain)){
					list.push(domain);
					fillListWithList(list);
					chrome.storage.sync.set({[currentList]: list});
				}
				else{
					list.splice(list.indexOf(domain), 1);
					fillListWithList(list);
					chrome.storage.sync.set({[currentList]: list});
				}
				setAddDomainButtonText(domain, currentList, list);
			});
		});
	};
});

document.querySelector("#listTypeToggle").onclick = function(){
	this.parentNode.classList.toggle("blacklist");
	let currentList = this.parentNode.classList.contains("blacklist") ? "Blacklist" : "Whitelist";
	chrome.storage.sync.set({currentList});
	chrome.storage.sync.get(currentList, function({[currentList]: list}){
		fillListWithList(list);
		setAddDomainButtonText(null, currentList, list);
	});
}

function fillListWithList(list = []){
	document.querySelectorAll("#list-items li:not(:first-child)").forEach(ele => ele.remove());
	list.forEach(item => {
		let ele = document.querySelector("#list-items li").cloneNode(true);
		ele.classList.remove("d-none");
		ele.classList.add("d-flex");
		ele.querySelector(".domain-name").innerHTML = item;
		document.querySelector("#list-items").append(ele);
		ele.querySelector(".badge").onclick = function(){
			this.parentNode.remove();
			chrome.storage.sync.get("currentList", function({currentList}){
				chrome.storage.sync.get(currentList, function({[currentList]: list}){
					list.splice(list.indexOf(item), 1);
					chrome.storage.sync.set({[currentList]: list});
				});
			});
		};
	});
}

function setAddDomainButtonText(domain, listType, list){
	var addDomain = document.getElementById("addDomain"),
		domain = domain || addDomain.dataset.domain,
		listType = listType || addDomain.dataset.domain,
		action = "Add";
	if(list.includes(domain))
		action = "Remove"
	addDomain.dataset.domain = domain;
	addDomain.dataset.listType = listType;
	addDomain.dataset.action = action;
	loadTemplateHTML(addDomain, {domain, listType, action, "to/from": list.includes(domain) ? "from" : "to"});
}

function loadTemplateHTML(element, data){
	element.innerHTML = element.dataset.innerHTMLTemplate.replace(/\{[^\{\}]+\}/g, str => {
		str = str.slice(1, -1);
		if(str in data)
			return data[str];
		return str;
	});
}