let darkenParams = [{keepDark: true}, "keepDark"],
	brightenParams = [{keepBright: true}, "keepBright"],
	alwaysChangeParams = [{doInversion: true}, "doInversion"],
	defaultStyle = document.createElement("link"),
	darkThemeInterval,
	propertiesMapping = {
		"background-color": darkenParams,
		"background": darkenParams,
		"background-color": darkenParams,
		"background-image": darkenParams,
		"text-shadow": darkenParams,
		"border-bottom-color": darkenParams,
		"border-top-color": darkenParams,
		"border-left-color": darkenParams,
		"border-right-color": darkenParams,
		"outline": darkenParams,
		"box-shadow": darkenParams,
		"color": brightenParams,
		"fill": alwaysChangeParams,
		"stroke": alwaysChangeParams
	},
	attributesMapping = {
		"background-color": "bgColor",
		"color": "text",
		"fill": "fill",
		"stroke": "stroke"
	},
	DEFAULT_TRANSITION_MILLISECONDS = 400;

defaultStyle.rel = "stylesheet";
defaultStyle.href = chrome.extension.getURL("css/default_style.css");

checkStorage();

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
	if(data.darkTheme || data.currentList || data.Blacklist || data.WhiteList)
		checkStorage();
});

let	savedStyles = new Map,
	changedStyles = {};

let mutationTimeout = new Map;

async function activateDarkMode(window = this.window){
	if(!window.defaultStyle){
		window.defaultStyle = defaultStyle.cloneNode(true);
		window.document.head.prepend(window.defaultStyle)
	}
	else
		window.defaultStyle.disabled = false;

	await new Promise(resolve => {
		chrome.storage.local.get(["doTransition", "transitionMilliSeconds"],
		 ({doTransition, transitionMilliSeconds}) => {
			if(doTransition)
				tempTransition(window, transitionMilliSeconds || DEFAULT_TRANSITION_MILLISECONDS);
			resolve();
		});
	});

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
	await changePage(window, true);

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
			frame.contentWindow.document
			activateDarkMode(frame.contentWindow);
		}catch(e){}
	});
}

async function changeElement(ele){
	if(
		(ele.tagName && ele.tagName.toLowerCase() == "svg") || 
		ele.ancestors.some(ele => ele.tagName && ele.tagName.toLowerCase() == "svg") ||
		attributesMapping.values().some(attr => ele.hasAttribute(attr))
	){
		let changes = await changeStyle(getComputedStyle(ele));
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
	}
	else
		await changeStyle(ele.style, true);
}

async function disableDarkMode(window = this.window){
	window.defaultStyle.disabled = true;

	window.clearInterval(window.listenToStyleSheetChange);
	
	await new Promise(resolve => {
		chrome.storage.local.get(["doTransition", "transitionMilliSeconds"], 
		 ({doTransition, transitionMilliSeconds}) => {
			if(doTransition)
				tempTransition(window, transitionMilliSeconds || DEFAULT_TRANSITION_MILLISECONDS);
			resolve();
		});
	});

	savedStyles.forEach((value, style) => {
		for([prop, val] of Object.entries(value.old))
			style.setProperty(prop, val);
	});

	stopListeningToPageStuff();
	
	window.document.querySelectorAll("iframe").forEach(frame => {
		try{
			frame.contentWindow.document;
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
async function changePage(window, doExtraWork = false){
	for(let styleSheet of window.document.styleSheets)
		await changeStyleSheet(styleSheet);
	if(doExtraWork)
		await window.document.querySelectorAll("svg, svg *, [style], " + attributesSelector).map(changeElement);
}

async function changeStyleSheet(styleSheet){
	try{
		for(let cssRule of styleSheet.cssRules)
			await changeCssRule(cssRule);
	}
	catch(e){
		if(!styleSheet.ownerNode || !styleSheet.ownerNode.dataset.guydhtWillRemove)
			await replaceCrossOriginStyle(window, styleSheet.href, styleSheet.ownerNode);
	}
}

async function changeCssRule(cssRule){
	let style = cssRule.style;
	if(style)
		await changeStyle(style, true);
	if(cssRule.styleSheet)
		await changeStyleSheet(cssRule.styleSheet);
	else if(cssRule.cssRules)
		for(let childCssRule of cssRule.cssRules)
			await changeCssRule(childCssRule);
}

function isDarkRGB(rgbArr){
	return rgbArr.reduce((acc, ele) => acc + ele, 0) / rgbArr.length <= 150;
}

function isBlackOrWhite(rgbArr){
	return Math.max(...rgbArr) - Math.min(...rgbArr) < 15;
}

function isBrightRGB(rgbArr){
	return rgbArr.reduce((acc, ele) => acc + ele, 0) / rgbArr.length >= 180 || rgbArr.max() > 250;
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
	return new Promise(resolve => {
		if(styleElement) styleElement.dataset.guydhtWillRemove = true;
		chrome.runtime.sendMessage({
			request: true,
			url: href
		}, function(response){
			let style = window.document.createElement("style");
			style.innerHTML = response.responseText;
			(styleElement || document.head.children[0]).insertAdjacentElement('beforebegin', style);
			if(styleElement) styleElement.disabled = true;
			resolve();
		});
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
	propertiesMapping.entries().forEach(([prop, params]) => {
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

function tempTransition(window, transitionTimeInMilliseconds){
	let tmp = window.document.createElement("style");
	tmp.innerHTML = ":root, :root *{transition: ";
	propertiesMapping.entries().forEach(([prop, params]) => {
		if(params !== brightenParams)
			tmp.innerHTML += `${prop.replace(/[A-Z]/g, l => '-' + l.toLowerCase())} ${ transitionTimeInMilliseconds}ms ease-out, `;
	});
	tmp.innerHTML = tmp.innerHTML.slice(0, -2) + " !important;}";
	setTimeout(tmp.remove.bind(tmp), transitionTimeInMilliseconds);
	window.document.head.prepend(tmp);
}
