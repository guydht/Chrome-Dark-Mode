let darkenParams = {keepDark: true},
	brightenParams = {keepBright: true},
	alwaysChangeParams = {doInversion: true},
	defaultStyle = document.createElement("style"),
	darkThemeInterval,
	propertiesMapping = {
		"background-color": [darkenParams, darkenParams.keys()[0]],
		"background": [darkenParams, darkenParams.keys()[0]],
		"background-color": [darkenParams, darkenParams.keys()[0]],
		"background-image": [darkenParams, darkenParams.keys()[0]],
		"text-shadow": [darkenParams, darkenParams.keys()[0]],
		"border-bottom-color": [darkenParams, darkenParams.keys()[0]],
		"border-top-color": [darkenParams, darkenParams.keys()[0]],
		"border-left-color": [darkenParams, darkenParams.keys()[0]],
		"border-right-color": [darkenParams, darkenParams.keys()[0]],
		"outline": [darkenParams, darkenParams.keys()[0]],
		"box-shadow": [darkenParams, darkenParams.keys()[0]],
		"color": [brightenParams, brightenParams.keys()[0]],
		"fill": [alwaysChangeParams, alwaysChangeParams.keys()[0]],
		"stroke": [alwaysChangeParams, alwaysChangeParams.keys()[0]]
	},
	attributesMapping = {
		"background-color": "bgColor",
		"color": "text",
		"fill": "fill",
		"stroke": "stroke"
	},
	DEFAULT_TRANSITION_MILLISECONDS = 400;

defaultStyle.href = chrome.extension.getURL("css/default_style.css");

checkStorage().then(response => {
	if(response){
		let tempStyle = document.createElement("style"); 
		document.documentElement.append(tempStyle);
		// tempStyle.innerHTML = ":root, :root *{background-color: rgb(20, 20, 20); color: white;}";
		waitFor(function(){
			return document.readyState == 'complete';
		},
		function(){
			tempStyle.remove();
		}, 0);
	}
});

function checkStorage(){
	return new Promise(resolve => {
		chrome.storage.sync.get("currentList", function({currentList = "BlackList"}){
			chrome.storage.sync.get(currentList, function({[currentList]: list = []}){
				chrome.storage.local.get("darkTheme", async function({darkTheme = false}){
					let shouldActivate = darkTheme &&
						((currentList === "Whitelist" && list.includes(location.origin))
						|| (currentList === "Blacklist" && !list.includes(location.origin)));
					await fetchMappingJSON();
					if(shouldActivate)
						activateDarkMode();
					else
						disableDarkMode();
					resolve(shouldActivate);
				});
			});
		});
	});
}

let mappingWithRegex = [];
async function fetchMappingJSON(){
	let mapping = await fetch(chrome.extension.getURL("json/colorNameMappings.json")).then(r => r.json());
	Object.entries(mapping).forEach(([key, val]) => {
		mappingWithRegex.push([new RegExp(`(?<!\\S)(${key})(?!\\S)`), val]);
	});
}

chrome.storage.onChanged.addListener(function(data){
	if(data.darkTheme)
		checkStorage();
});

let	savedStyles = new Map,
	changedStyles = {};

let mutationTimeout = new Map;

function activateDarkMode(window = this.window){
	window.defaultStyle = defaultStyle.cloneNode(true);
	window.document.head.prepend(window.defaultStyle)

	let currentStyleSheets = [...window.document.styleSheets];
	window.listenToStyleSheetChange = window.setInterval(() => {
		if(currentStyleSheets.size != window.document.styleSheets.length){
			let added = [...window.document.styleSheets].filter(ele => !currentStyleSheets.includes(ele));
			added.forEach(changeStyleSheet);

			currentStyleSheets = [...window.document.styleSheets];
		}
	});

	savedStyles.forEach((value, style) => {
		for([prop, val] of Object.entries(value.new))
			style.setProperty(prop, val);
	});

	chrome.storage.sync.get("doTransition", ({doTransition}) => {
		if(doTransition)
			tempTransition(window);
	});
	changePage(window, true);

	listenToPageNodeChanges(window, function(mutationRecords){
		for(let mutationRecord of mutationRecords){
			for(let node of mutationRecord.addedNodes){
				let newNodes = [],
					treeWalker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
				while(treeWalker.nextNode()) newNodes.push(treeWalker.currentNode);
				for(node of newNodes){
					if(node.sheet && node.tagName && node.tagName.toLowerCase() == "style")
						changeStyleSheet(node.sheet);
					else if((node.style && node.style[0]) || attributesMapping.values().some(attr => node.hasAttribute(attr))){
						mutationTimeout.set(node, true);
						changeElement(node);
						mutationTimeout.set(node, false);
					}
				}
			}
			if(mutationRecord.target && mutationRecord.target.tagName.toLowerCase() == "style" && mutationRecord.target.sheet)
				changeStyleSheet(mutationRecord.target.sheet);
		}
	});
	listenToAttributesChanges(window, function(mutationRecords){
		for(let mutationRecord of mutationRecords){
			if(mutationRecord.attributeName == 'style'){
				if(!mutationTimeout.get(mutationRecord.target)){
					mutationTimeout.set(mutationRecord.target, true);
					setTimeout(() => mutationTimeout.set(mutationRecord.target, false));
					changeStyle(mutationRecord.target.style, true);
				}
			}
		}
	});

	window.document.querySelectorAll("iframe").forEach(frame => {
		try{
			activateDarkMode(frame.contentWindow);
		}catch(e){}
	});
}

function changeElement(ele){
	if(
		ele.tagName && ele.tagName.toLowerCase() == "svg" || 
		ele.ancestors.some(ele => ele.tagName && ele.tagName.toLowerCase() == "svg") ||
		attributesMapping.values().some(attr => ele.hasAttribute(attr))){
		changeStyle(getComputedStyle(ele)).then(changes => {
			ele.setProperty = ele.setAttribute.bind(ele);
			for(let [prop, oldVal, newVal] of changes){
				if(attributesMapping[prop] && ele.hasAttribute(attributesMapping[prop])){
					prop = attributesMapping[prop];
					addToPrevStyle(ele, prop, oldVal, newVal);
					ele.setAttribute(prop, newVal);
				}
				else if(ele.style[prop]){
					addToPrevStyle(ele.style, prop, oldVal, newVal);
					ele.style.setProperty(prop, newVal);
				}
			}
		});
	}
	else
		changeStyle(ele.style, true);
}

function disableDarkMode(window = this.window){
	window.defaultStyle.remove();

	window.clearInterval(window.listenToStyleSheetChange);

	savedStyles.forEach((value, style) => {
		for([prop, val] of Object.entries(value.old))
			style.setProperty(prop, val);
	});
	
	chrome.storage.sync.get("doTransition", ({doTransition}) => {
		if(doTransition)
			tempTransition(window);
	});

	stopListeningToPageStuff();
	
	window.document.querySelectorAll("iframe").forEach(frame => {
		try{
			disableDarkMode(frame.contentWindow);
		}catch(e){}
	});
}

let observers = [];
function listenToPageNodeChanges(window, callback){
	let observer = new MutationObserver(callback);
	observers.push(observer);
	observer.observe(window.document.documentElement, {
		childList: true,
		subtree: true
	});
}
function listenToAttributesChanges(window, callback){
	let observer = new MutationObserver(callback);
	observers.push(observer);
	observer.observe(window.document.documentElement, {
		subtree: true,
		attributes: true
	});
}
function stopListeningToPageStuff(){
	observers.forEach(observer => observer.disconnect());
}

let attributesSelector = attributesMapping.values().map(ele => `[${ele}]`).join(", ");
function changePage(window, doExtraWork = false){
	for(let styleSheet of window.document.styleSheets)
		changeStyleSheet(styleSheet);
	if(doExtraWork)
		window.document.querySelectorAll("svg, svg *, [style], " + attributesSelector).forEach(changeElement);
}

function changeStyleSheet(styleSheet){
	try{
		for(let cssRule of styleSheet.cssRules)
			changeCssRule(cssRule);
	}
	catch(e){
		if(!styleSheet.ownerNode || !styleSheet.ownerNode.dataset.guydhtWillRemove)
			replaceCrossOriginStyle(window, styleSheet.href, styleSheet.ownerNode);
	}
}

function changeCssRule(cssRule){
	let style = cssRule.style;
	if(style)
		changeStyle(style, true);
	if(cssRule.styleSheet)
		changeStyleSheet(cssRule.styleSheet);
	else if(cssRule.cssRules)
		for(let childCssRule of cssRule.cssRules)
			changeCssRule(childCssRule);
}

function isDarkRGB(rgbArr){
	return rgbArr.reduce((acc, ele) => acc + ele, 0) / rgbArr.length <= 150;
}

function isBlackOrWhite(rgbArr){
	return Math.max(...rgbArr) - Math.min(...rgbArr) < 15;
}

function isBrightRGB(rgbArr){
	return rgbArr.reduce((acc, ele) => acc + ele, 0) / rgbArr.length >= 180;
}

function rgbTextToRGB(rgbText){
	arr = rgbText.substringLastIndexOf("(", 1).substringLastIndexOf(0, ")").split(",").map(Number);
	return [arr.slice(0, 3), arr[3]];
}

function darkenRGB(rgbArr){
	return lightenRGB(rgbArr, 50);
}

function lightenRGB(rgbArr, newAvg = 200){
	let oldAvg = rgbArr.reduce((a, b) => a + b, 0) / rgbArr.length;
	return rgbArr.map(ele => Math.min(255, Math.max(0, ele - oldAvg + newAvg)));
}

function invertRGB(rgbArr, offset = 0){
	return rgbArr.map(ele => Math.min(255, 255 - ele + offset));
}

function replaceCrossOriginStyle(window, href, styleElement){
	if(styleElement) styleElement.dataset.guydhtWillRemove = true;
	chrome.runtime.sendMessage({
		request: true,
		url: href
	}, function(response){
		let style = window.document.createElement("style");
		style.innerHTML = response.responseText;
		(styleElement || document.head.children[0]).insertAdjacentElement('beforebegin', style);
		if(styleElement) styleElement.disabled = true;
	});
}

function colorHasSomethingThatLooksLikeAColorName(color){
	return /(?<!\S)([a-zA-Z]+)(?!\S)/.test(color);
}

function colorNameToRGB(color){
	if(colorHasSomethingThatLooksLikeAColorName(color))
		mappingWithRegex.forEach(([reg, value]) => {
			if(reg.test(color))
				color = color.replace(reg, "rgb" + value);
		});
	return color;
}

function hexToRGB(hex){
    let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;;
	hex = hex.replace(shorthandRegex, function(m, r, g, b) {
		return r + r + g + g + b + b;
    });
	let bigint = parseInt(hex, 16),
		r = (bigint >> 16) & 255,
		g = (bigint >> 8) & 255,
		b = bigint & 255;
    return `(${r}, ${g}, ${b})`;
}

async function changeStyle(cssStyleDecleration, setStyle = false){
	let changesArr = [];
	propertiesMapping.keys().forEach(prop => {
		let params = propertiesMapping[prop];
		if(!params || typeof params === "function") return;
		let originalStyleText = colorNameToRGB(cssStyleDecleration.getPropertyValue(prop)),
			found = changedStyles[params[1] + originalStyleText];
		if(found)
			return changesArr.push([prop, originalStyleText, found]);
		let newStyleText = originalStyleText,
			colors = newStyleText.match(/\(([0-9]+,\s)+[0-9]+\.?[0-9]*\)|\#[a-zA-Z0-9]+/g) || [];
		colors.forEach(color => {
			newStyleText = newStyleText.replace(color, changeColor(color, params[0]));
		});
		if (newStyleText !== originalStyleText){
			changesArr.push([prop, originalStyleText, newStyleText]);
			changedStyles[params[1] + originalStyleText] = newStyleText;
		}
	});
	if(setStyle)
		for(let [prop, oldVal, newVal] of changesArr){
			addToPrevStyle(cssStyleDecleration, prop, oldVal, newVal, newVal);
			cssStyleDecleration.setProperty(prop, newVal);
		}
	return changesArr;
}

function addToPrevStyle(style, prop, currentVal, newVal){
	let exists = savedStyles.get(style);
	if(!exists){
		exists = {
			new: {}, 
			old: {}
		};
		savedStyles.set(style, exists);
	}
	exists.new[prop] = newVal;
	exists.old[prop] = currentVal;
}

function changeColor(color, params){
	if(color.startsWith("#"))
		color = hexToRGB(color.substring(1));
	let rgba = rgbTextToRGB(color),
		opacityString = '';
	if(rgba[1] !== undefined)
		opacityString = `, ${rgba[1]}`;
	return `(${changeRGB(rgba[0], params).join(", ") + opacityString})`;
}

function changeRGB(rgbArr, {keepDark, keepBright, doInversion}){
	if(doInversion){
		if(isBlackOrWhite(rgbArr))
			rgbArr = invertRGB(rgbArr);
		else
			rgbArr = isDarkRGB(rgbArr) ? lightenRGB(rgbArr) : isBrightRGB(rgbArr) ? darkenRGB(rgbArr) : rgbArr;
	}
	else if(!keepDark && isDarkRGB(rgbArr)){
		if(isBlackOrWhite(rgbArr))
			rgbArr = invertRGB(rgbArr);
		else
			rgbArr = lightenRGB(rgbArr);
	}
	else if (!keepBright && isBrightRGB(rgbArr)){
		if(isBlackOrWhite(rgbArr))
			rgbArr = invertRGB(rgbArr, 30);
		else
			rgbArr = darkenRGB(rgbArr);
	}
	return rgbArr;
}

function tempTransition(window, transitionTimeInSeconds = .4){
	let tmp = window.document.createElement("style");
	tmp.innerHTML = ":root, :root *{transition: ";
	propertiesMapping.entries().forEach(([prop, [params]]) => {
		if(params !== brightenParams)
			tmp.innerHTML += `${prop.replace(/[A-Z]/g, l => '-' + l.toLowerCase())} ${ transitionTimeInMilliseconds}ms ease-out, `;
	});
	tmp.innerHTML = tmp.innerHTML.slice(0, -2) + " !important;}";
	setTimeout(tmp.remove.bind(tmp), transitionTimeInMilliseconds);
	window.document.head.prepend(tmp);
}
