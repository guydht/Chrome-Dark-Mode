function doEnhancements(win){
	win.NodeList = NodeList;
	class NodeList {
		constructor(elements) {
			this[Symbol.iterator] = function () {
				var self = this, values = [], i = 0;
				if (this.length == null)
					while (this[i] != null && !isNaN(i++))
						this.length = (this.length || 0) + 1;
				for (i = 0; i < this.length; i++)
					values.push(i);
				i = 0;
				return {
					next: function () {
						return {
							value: self[values[i++]],
							done: i > values.length
						};
					}
				};
			};
			if (elements == null)
				return;
			for (var i = 0; i < elements.length; i++)
				this[i] = elements[i];
			this.length = elements.length;
		}
	}
	win.createNodeList = createNodeList;
	function createNodeList(elements){
		if(!elements.forEach) return false;
		if(elements.length == 0) return new Proxy(new NodeList([]), {});
		var proxy = new Proxy(new NodeList(elements), {
			get: function(target, property){
				if(target[property] == null)
					return target.map(ele => ele[property]);
				else return target[property];
			},
			set: function(target, property, value){
				if(target[property] != null)
					target[property] = value;
				else
					target.forEach(ele => ele[property] = value);
			}
		});
		return proxy;
	}
	window.open = function(url){
		chrome.runtime.sendMessage({
			url: url,
			newTab: true,
			likeWindowOpen: true
		});
	};
	[win.String.prototype, win.Array.prototype].forEach(ele => {
		defineProperty(ele, "includesSome", {
			value: function(s){
				return this.includes(s) || s.includes(this);
			}
		});
	});
	function tempFunctionForPrivateVar(){
		var dataArr = [],
			addEvent = win.EventTarget.prototype.addEventListener,
			removeEvent = win.EventTarget.prototype.removeEventListener;
			win.EventTarget.prototype.addEventListener = function(...args){
			if(dataArr[this.guydhtIndexInEventDataArr] == null){
				win.Object.defineProperty(this, "guydhtIndexInEventDataArr", {
					configurable: false,
					writable: false,
					enurable: false,
					value: dataArr.length
				});
				let obj = {};
				obj[args[0]] = [args.slice(1)];
				obj[args[0]][0].target = this;
				defineProperty(obj[args[0]][0], "remove", {
					value: removeEleFunction.bind(obj[args[0]][0], args[0])
				});
				dataArr.push(obj);
			}
			else if(dataArr[this.guydhtIndexInEventDataArr][args[0]] == null){
				dataArr[this.guydhtIndexInEventDataArr][args[0]] = [args.slice(1)];
				dataArr[this.guydhtIndexInEventDataArr][args[0]][0].target = this;
				defineProperty(dataArr[this.guydhtIndexInEventDataArr][args[0]][0], "remove", {
					value: removeEleFunction.bind(dataArr[this.guydhtIndexInEventDataArr][args[0]][0], args[0])
				});
			}
			else{
				let arr = args.slice(1);
				arr.target = this;
				defineProperty(arr, "remove", {
					value: removeEleFunction.bind(arr, args[0])
				});
				dataArr[this.guydhtIndexInEventDataArr][args[0]].push(arr);
			}
			if(args[2] != null && args[2].once == true)
				addEvent.call(this, args[0], function(){this.removeEventListener(args[0], args[1], "guydhtDontRemove");}, args[2]);
			return addEvent.apply(this, args);
			function removeEleFunction(type){
				this.target.removeEventListener(type, this[0]);
			}
		};
		win.EventTarget.prototype.removeEventListener = function(type, listener, options){
			if(this.guydhtIndexInEventDataArr == null || dataArr[this.guydhtIndexInEventDataArr][type] == null)
				return removeEvent.call(this, type, listener, options);
			var index = dataArr[this.guydhtIndexInEventDataArr][type].findIndex((a, i, arr) => {
				return a[0].toString() == listener.toString() &&
					(a[1] != null && options != null ? 
						win.Object.keys(a[1]).every(ele => Owin.bject.keys(options).includes(ele)) &&
						win.Object.values(a[1]).every(ele => win.Object.values(options).includes(ele))
					: true);
			});
			dataArr[this.guydhtIndexInEventDataArr][type].splice(index, 1);
			return options == "guydhtDontRemove" ? "" : removeEvent.call(this, type, listener);
		};
		win.EventTarget.prototype.getEventListeners = function(ok){
			var obj = {};
			win.Object.assign(obj, dataArr[this.guydhtIndexInEventDataArr] || {});
			if(this.constructor == Window){
				this.children = createNodeList([this.document.documentElement]);
			}
			if(ok)
				this.children.forEach(function needsAname(element){
					let tempObj = element.getEventListeners();
					element.children.forEach(needsAname);
					var indexToRemove = win.Object.keys(tempObj).indexOf("target");
					win.Object.keys(tempObj).filter((ele, i) => i != indexToRemove).forEach((ele, i) => {
						if(obj[ele] == null)
							obj[ele] = [];
						obj[ele].push(...win.Object.values(tempObj).filter((ele, i) => {return i != indexToRemove})[i]);
					});
				});
			return obj;
		};
	};
	tempFunctionForPrivateVar();
	window.forEach = function(obj, func){
		var values = win.Object.values(obj),
			keys = win.Object.keys(obj);
		for(var i=0;i<values.length;i++)
			func(keys[i], values[i], i);
		};
	win.Object.defineProperty(win.Node.prototype, "ancestors", {
		get(){
			var arr = [], ele = this.parentNode;
			while(ele != null){
				arr.push(ele);
				ele = ele.parentNode;
			}
			return createNodeList(arr);
		}
	});
	win.Object.defineProperty(win.Node.prototype, "childNodes", {
		get(){
			var arr = [],
				element = this.firstChild;
			while(element != null){
				arr.push(element);
				element = element.nextSibling;
			}
			return createNodeList(arr);
		}
	});
	win.Object.defineProperty(win.Element.prototype, "children", {
		get(){
			var arr = [],
				element = this.firstElementChild;
			while(element != null){
				arr.push(element);
				element = element.nextElementSibling;
			}
			return createNodeList(arr);
		}
	});
	var selector = document.querySelector.bind(document),
		selectorAll = document.querySelectorAll.bind(document),
		eSelector = win.Element.prototype.querySelector,
		eSelectorAll = win.Element.prototype.querySelectorAll;
	win.Element.prototype.querySelectorAll = function(...text){return helper(text, eSelectorAll.bind(this));};
	win.Element.prototype.querySelector = function(text){try{return eSelector.call(this, text);}catch(e){return helper([text], eSelector.bind(this));}};
	document.querySelectorAll = function(...text){return helper(text, selectorAll)};
	document.querySelector = function(text){try{return selector(text)}catch(e){return helper([text], selectorAll)[0];}};
	function helper(text, sele){
		if(text.length > 1 || text.length == 0)
			return createNodeList([].concat(...text.map(ele => document.querySelectorAll(ele))));
		text = text[0].toString();
		try{
			return createNodeList(sele(text));
		}catch(e){
			let customSelector = text.match(/\:[^{}]+{[^{}]*}/g) || [],
				property = customSelector.map(ele => ele.substringIndexOf(1, "{"));
			text = text.replace(/\:[^{}]+{[^{}]*}/g, "");
			customSelector = customSelector.map(ele => ele.replace(/\:[^{}]+{/g, "").slice(0, -1).toLowerCase());
			var arr = [].concat.apply([], sele(text)).filter(ele => property.every((property, i) => customSelector[i] == ((ele[property] || ele.getAttribute(property) || "").toString().toLowerCase())));
			return createNodeList(arr);
		}
	};
	function defineProperty(obj, name, data){
		if(arguments.length != 3 || name in obj.constructor.prototype) return;
		data.enurable = false;
		data.configurable = true;
		if(!data.get && !data.set) data.writable = true;
		win.Object.defineProperty(obj, name, data);
	}
	defineProperty(win.String.prototype, "decodeEscapeSequence", {
		value: function() {
			return this.replace(/\\x([0-9A-Fa-f]{2})/g, function() {
				return win.String.fromCharCode(parseInt(arguments[1], 16));
			});
		}
	});
	defineProperty(win.Array.prototype, "equals", {
		value: function(arr){
			if(!arr || this.length != arr.length) return false;
			for(var i=0;i<arr.length;i++)
				if(arr[i] != this[i])
					return false;
			return true;
		}
	});
	defineProperty(win.Object.prototype, 'values', {
		value: function(){
			return win.Object.values(this);
		}
	});
	['values', 'keys', 'entries'].forEach(prop => {
		defineProperty(win.Object.prototype, prop, {
			value: function(){
				return win.Object[prop](this);
			}
		});
	});
	defineProperty(win.Array.prototype, "max", {
		value: function(){
			var params = arguments.toArr();
			var arr = this.map(ele => {
				params.forEach(param => {
					if(param.constructor == win.Function)
						ele = param(ele);
					else
						ele = ele[param]
				});
				return ele;
			});
			return this[arr.indexOf(Math.max(...arr))];
		}
	});
	defineProperty(win.Array.prototype, "min", {
		value: function(){
			var params = arguments.toArr();
			var arr = this.map(ele => {
				params.forEach(param => {
					if(param.constructor == win.Function)
						ele = param(ele);
					else
						ele = ele[param]
				});
				return ele;
			});
			return this[arr.indexOf(Math.min(...arr))];
		}
	});
	defineProperty(win.String.prototype, "trunct", {
		value: function(limit){
			if(limit == null) limit = 50;
			if(this.length <= limit) return this;
			var substring = this.substr(0, limit - 1);
			return substring.substr(0, substring.lastIndexOf(" ")) + "&hellip;";
		}
	});
	defineProperty(win.String.prototype, "capital", {
		value: function(){
			return this.replace(/\w\s*/, function(text){
				return text.charAt(0).toUpperCase() + text.substring(1).toLowerCase();
			});
		}
	});
	defineProperty(win.Element.prototype, "styleAdd", {
		set(styleToAdd){
			var arr = styleToAdd.split(";").filter(ele => ele != ""),
				element = this;
			arr.forEach(ele => {
				ele = ele.split(":");
				element.style[ele[0].trim()] = ele[1].trim();
			});
		},
		get: function(){return "Nope";}
	});
	(function pseudoStyle(){
		var elementIdCounter = 1;
		["hover", "after", "before", "active"].forEach(function(pe){
			defineProperty(win.Element.prototype, "style" + pe.capital(), {
				set(ruleText){
					var text = ruleText.replace(/:[^;:]+;|:[^;:]+}/g, match => match.replace("!important", "").slice(0, -1) + " !important" + match.slice(-1)),
						sheet = document.styleSheets.toArr().find(ele => {try{return ele.cssRules != null;}catch(e){return false}}) || document.styleSheets[0],
						selector = this.dataset.guydhtCustomSelector;
					if(selector == null){
						this.dataset.guydhtCustomSelector = elementIdCounter;
						sheet.insertRule("[data-guydht-custom-selector='" + elementIdCounter + "']:" + pe + "{" + text + "}", sheet.cssRules != null ? sheet.cssRules.length : 0);
						elementIdCounter++;
					}
					else{
						var sheet = document.styleSheets.toArr().find(ele => ele.cssRules != null && ele.cssRules.toArr().some(ele => ele.cssText.includes("[data-guydht-custom-selector='" + selector + "']")));
						if(sheet == null){
							sheet = document.styleSheets.toArr().find(ele => ele.cssRules != null) || document.styleSheets[0];
							sheet.insertRule("[data-guydht-custom-selector='" + selector + "']:" + pe + "{" + text + "}", sheet.cssRules != null ? sheet.cssRules.length : 0);
						}
						else{
							index = sheet.cssRules.toArr().findIndex(ele => ele.cssText.includes("[data-guydht-custom-selector='" + selector + "']"));
							sheet.deleteRule(index);
							sheet.insertRule("[data-guydht-custom-selector='" + selector + "']:" + pe + "{" + text + "}", sheet.cssRules != null ? sheet.cssRules.length : 0);
						}
					}
				}
			});
		});
	})();
	defineProperty(win.HTMLSelectElement.prototype, "getSelected", {
		value: function(){
			return this.options[this.selectedIndex];
		}
	});
	defineProperty(win.String.prototype, "substringIndexOf", {
		value: function(text, offset, maybeOffset){
			if(typeof text == "number") return this.substring(text, this.indexOf(offset) + (maybeOffset != null ? maybeOffset : 0));
			return this.substring(this.indexOf(text) + (offset != null ? offset : 0));
		}
	});
	defineProperty(win.String.prototype, "substringLastIndexOf", {
		value: function(text, offset, maybeOffset){
			if(typeof text == "number") return this.substring(text, this.lastIndexOf(offset) + (maybeOffset != null ? maybeOffset : 0));
			return this.substring(this.lastIndexOf(text) + (offset != null ? offset : 0));
		}
	});
	defineProperty(win.Node.prototype, "text", {
		get: function(){
			function addToText(node){
				var nodes = node.childNodes,
					textToAdd = node.nodeValue || "";
				for(var i=0;i<nodes.length;i++)
					if(nodes[i].nodeType == Node.TEXT_NODE){
						textToAdd += nodes[i].nodeValue.trim();
					}
					else if(nodes[i].nodeType == Node.ELEMENT_NODE){
						var obj = nodes[i].getBoundingClientRect();
						if(obj.visible)
							textToAdd += (getComputedStyle(nodes[i]).display == "block" ? `\n${addToText(nodes[i])}\n` : ` ${addToText(nodes[i])} `);
						else
							textToAdd += addToText(nodes[i]);
					}
				return textToAdd.replace(/\n{2,}/g, "\n").trim();
			}
			return addToText(this).replace(/\s{2,}/g, " ");
		}
	});
	var arrayToMove = ["addEventListener", "removeEventListener", "value"];
	win.Object.getOwnPropertyNames(win.Node.prototype).concat(arrayToMove).concat(win.Object.getOwnPropertyNames(win.HTMLElement.prototype))
	.concat(win.Object.getOwnPropertyNames(win.Element.prototype)).filter(function(ele, i, arr){return arr.indexOf(ele) == i;}).forEach(function(Ele, i){
		if(win.NodeList.prototype[Ele] != null || "classList" == Ele || Ele == "style") return;
		if(typeof document.createElement("asd")[Ele] == "function")
			defineProperty(win.NodeList.prototype, Ele, {
				value: function(...args){
					this.forEach(function(ele){
						if(typeof ele[Ele] == "function")
							ele[Ele](...args);
					});
					return this;
				}
			});
		else
			defineProperty(win.NodeList.prototype, Ele, {
				set: function(arg){
					this.forEach(function(ele){
						ele[Ele] = arg;
					});
				}
			});
	});
	defineProperty(win.Element.prototype, "getSelector", {
		value: function(){
			var id = "#" + (this.id || ""),
				element = this,
				path = [];
			while(id == "#" && element != null){
				id = "#" + (element.id || "");
				path.push(element);
				element = element.parentNode;
			}
			if(path.length == 0) return id;
			path = path.reduce((accu, val) => {
				if(val.tagName == null) return accu.tagName || accu;
				var toAdd = "";
				if(val.parentNode != null && val.parentNode.constructor != HTMLDocument)
					if(val.parentNode.children.some(ele => ele != val && ele.tagName == val.tagName))
						toAdd = ":nth-child(" + (val.parentNode.children.indexOf(val) + 1) + ")";
				return val.tagName + toAdd + " > " + (accu.tagName || accu);
			});
			if(id == "#")
				return path;
			return id + " " + path;
		}
	});
	defineProperty(win.NodeList.prototype, "where", {
		value: function(property, value){
			for(var i=0;i<this.length;i++)
				if(this[i][property] == value)
					return this[i];
			for(var i=0;i<this.length;i++)
				if(this[i][property].includes(value) || value.includes(this[i][property]))
					return this[i];
			return this;
		}
	});
	win.Object.getOwnPropertyNames(win.Array.prototype).filter(function(ele, i, arr){return arr.indexOf(ele) == i;}).forEach(function(Ele){
		if(Ele == "length" || win.NodeList.prototype[Ele] != null) return;
		defineProperty(win.NodeList.prototype, Ele, {
			value: function(){
				var arr = [...this];
				arr = arr[Ele](...arguments);
				if(arr && arr.every && arr.every(function(ele){return ele != null && ele.tagName != null;})) return createNodeList(arr);
				return arr;
			}
		});
	});
	defineProperty(win.NodeList.prototype, "visible", {
		value: function(){
			var arr = [];
			this.forEach(function(ele){
				var rect = ele.getBoundingClientRect(),
					x = Math.max(window.innerWidth, document.documentElement.clientWidth),
					y = Math.max(window.innerHeight, document.documentElement.clientHeight);
				if(!(rect.bottom < 0 || rect.top >= y) && !(rect.right < 0 || rect.left >= x))
					if(elementFromPoint(ele, rect))
						arr.push(ele);
			});
			return createNodeList(arr);
		}
	});
	defineProperty(win.Element.prototype, "visible", {
		get: function(){
			if(!(this.offsetWidth || this.offsetHeight || this.getClientRects().length)) return false;
			var style = getComputedStyle(this),
				rect = this.getBoundingClientRect(),
				styleOk = style.visibility != "hidden" && style.opacity != 0 && style.display != "none",
				x = Math.max(window.innerWidth, document.documentElement.clientWidth),
				y = Math.max(window.innerHeight, document.documentElement.clientHeight);
				rectOk = !(rect.bottom < 0 || rect.top >= y) && !(rect.right < 0 || rect.left >= x);
			return styleOk && rectOk && elementFromPoint(this, rect);
		}
	});
	["entries", "keys", "values"].forEach(prop => {
		defineProperty(win.Object.prototype, prop, {
			value: function(){
				return win.Object[prop](this);
			}
		});
	});
	defineProperty(win.Object.prototype, "filter", {
		value: function(func){
			if(typeof func != "function") return null;
			var names = win.Object.getOwnPropertyNames(this).filter(ele => func(this[ele], ele, this)),
				obj = {};
			names.forEach(ele => obj[ele] = this[ele]);
			return obj
		}
	});
	defineProperty(win.Object.prototype, "toArr", {
		value: function(){
			try{
				return Array.from(this);
			}
			catch(e){
				return e;
			}
		}
	});
	defineProperty(win.HTMLCollection.prototype, "forEach", {
		value: function(...args){
			return this.toArr().forEach(...args);
		}
	});
	["style", "classList"].forEach(function(ele){
		defineProperty(win.NodeList.prototype, ele, {
			get: function(){
				return new Proxy(this.map(Ele => Ele[ele]), {
					get(target, name){
						var arr = [], ele = target;
						for(var i=0;i<target.length;i++)
							if(target[i] != null)
								arr.push(target[i][name]);
						if(typeof arr[0] == "function")
							return new Proxy(function(){}, {
								apply(target, thisArg, args){
									for(var i=0;i<ele.length;i++)
										ele[i][name](...args);
									return ele;
								}
							});
						return arr;
					},
					set(target, name, value){
						if(value.constructor.name != "Array"){
							for(var i=0;i<target.length;i++)
								if(target[i] != null)
									target[i][name] = value;
							return value;
						}
						var min = Math.min(target.length, value.length);
						for(var i=0;i<min;i++)
							if(target[i] != null && value[i] != null)
								target[i][name] = value[i];
						return name;
					},
					
				});
			}
		});
	});
	defineProperty(win.DOMRect.prototype, "toObj", {
		value: function(){
			return {left: this.left, top: this.top, bottom: this.bottom, right: this.right, height: this.height, width: this.width, x: this.x, y: this.y};
		}
	});
	win.waitFor = waitFor;
	function waitFor(condition, myFunction, amount){
		var interval;
		if(condition()) myFunction();
		else interval = setInterval(check, amount != null ? amount : 500, condition, myFunction);
		function check(condition, myFunction){
			if(condition()){
				clearInterval(interval);
				if(myFunction) myFunction();
			}
		}
		return interval;
	}
	win.cssRule = cssRule;
	function cssRule(text, index){
		text = text.replace(/:[^;:]+;|:[^;:]*}/g, match => match.replace("!important", "").slice(0, -1) + " !important" + match.slice(-1));
		var matches = text.match(/[^{},]+{[^{}]*}/g),
			style = (document.getElementById("guydht-style-element") || createGuydhtStyleElement()).sheet,
			cssRules = new Set;
		if([...(style.cssRules || [])].some(ele => matches.map(ele => ele.toLowerCase().replace(/[\s\'\"\`]/g, "")).includes(ele.cssText.toLowerCase().replace(/[\s\'\"\`]/g, ""))))
			return 'already exists';
		style.disabled = true;
		for(var i=0;i<matches.length;i++){
			style.insertRule(matches[i].trim(), (index || 0));
			cssRules.add(style.cssRules[index || 0]);
		}
		style.disabled = false;
		function createGuydhtStyleElement(){
			const style = document.createElement("style");
			style.id = "guydht-style-element";
			document.head.prepend(style);
			return style;
		}
		return {
			enable(){
				for(var i=0;i<matches.length;i++){
					style.insertRule(matches[i].trim(), (index || 0));
					cssRules.add(style.cssRules[index || 0]);
				}
			},
			disable(){
				let numOfElementsRemoved = 0;
				style.cssRules.toArr().forEach((ele, i) => {
					if(cssRules.has(ele)){
						style.removeRule(i - numOfElementsRemoved);
						numOfElementsRemoved++;
					}
				});
			},
			remove(){
				this.disable();
				cssRules = new Set;
				matches = [];
			}
		};
	}
	win.elementFromPoint = elementFromPoint
	function elementFromPoint(element, rect, accuracy){
		if(rect == null || typeof rect == "number"){
			accuracy = rect;
			rect = element.getBoundingClientRect();
		}
		if(accuracy == null) accuracy = 4;
		for(var i=0;i<accuracy;i++){
			var elements = document.elementsFromPoint(rect.left + rect.width*i/accuracy, rect.top + rect.height*i/accuracy).reverse();
			if(elements.includes(element) && 
				elements.slice(elements.indexOf(element) + 1).every(ele => {
					return (ele.style.opacity >= 0 && ele.style.opacity < 1) || ['none', 'transparent'].includes(getComputedStyle(ele).background)
				}))
				return true;
		}
		return false;
	}
}
doEnhancements(this.window);