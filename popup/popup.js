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

chrome.storage.local.get("transitionMilliSeconds", ({transitionMilliSeconds = 400}) => {
	document.getElementById("transitionMilliSeconds").value = transitionMilliSeconds;	
});

document.getElementById("transitionMilliSeconds").onchange = function(){
	chrome.storage.local.set({"transitionMilliSeconds": this.value});
};

chrome.storage.sync.get("currentList", function({currentList}){
	
	if(currentList === "Blacklist"){
		document.querySelector("#list").classList.add("blacklist");
	}
	
	let addDomain = document.querySelector("#add-domain");
	chrome.storage.sync.get(currentList, function({[currentList]: list}){
		fillListWithList(list);

		chrome.tabs.query({active: true, currentWindow: true}, function(response){
				url = response[0].url;
			addDomain.dataset.currenturl = url;
			try{
				let domain = new URL(url).origin;
				addDomain.innerHTML = addDomain.innerHTML.replace("{x}", domain).replace("{y}", currentList)
					.replace("{action}", list.includes(domain) ? "Remove" : "Add");
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
					addDomain.innerHTML = addDomain.innerHTML.replace("Add", "Remove");
				}
				else{
					list.splice(list.indexOf(domain), 1);
					fillListWithList(list);
					chrome.storage.sync.set({[currentList]: list});
					addDomain.innerHTML = addDomain.innerHTML.replace("Remove", "Add");
				}
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
	});
	let ele = document.querySelector("#add-domain");
	if(this.parentNode.classList.contains("blacklist"))
		ele.innerHTML = ele.innerHTML.replace("Whitelist", "Blacklist");
	else
		ele.innerHTML = ele.innerHTML.replace("Blacklist", "Whitelist");
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