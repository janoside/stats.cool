const { DateTime } = require("luxon");
const debugLog = require("debug")("app:utils");


// safely handles circular references
JSON.safeStringify = (obj, indent = 2) => {
	let cache = [];
	const retVal = JSON.stringify(
	  obj,
	  (key, value) =>
		typeof value === "object" && value !== null
		  ? cache.includes(value)
			? undefined // Duplicate reference found, discard key
			: cache.push(value) && value // Store value in our collection
		  : value,
	  indent
	);
	cache = null;
	return retVal;
};

function formatDate(date, formatStr="yyyy-MM-dd h:mma") {
	return DateTime.fromJSDate(date).toFormat(formatStr).replace("AM", "am").replace("PM", "pm");
}

function randomString(length, chars="aA#") {
	var mask = "";
	
	if (chars.indexOf("a") > -1) {
		mask += "abcdefghijklmnopqrstuvwxyz";
	}
	
	if (chars.indexOf("A") > -1) {
		mask += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	}
	
	if (chars.indexOf("#") > -1) {
		mask += "0123456789";
	}
	
	if (chars.indexOf("!") > -1) {
		mask += "~`!@#$%^&*()_+-={}[]:\";'<>?,./|\\";
	}
	
	var result = "";
	for (var i = length; i > 0; --i) {
		result += mask[Math.floor(Math.random() * mask.length)];
	}
	
	return result;
}

function newProjectId(length=10) {
	return `${randomString(1, "a")}${randomString(length - 1, "a#")}`;
}

function ellipsize(str, length, ending="…") {
	if (str.length <= length) {
		return str;

	} else {
		return str.substring(0, length - ending.length) + ending;
	}
}

function ellipsizeFront(str, length, start="…") {
	if (str.length <= length) {
		return str;

	} else {
		return start + str.substring(str.length - length + start.length);
	}
}

function dayMillis() {
	return 1000 * 60 * 60 * 24;
}

function weekMillis() {
	return dayMillis() * 7;
}

function monthMillis() {
	return dayMillis() * 30;
}

function yearMillis() {
	return parseInt(dayMillis() * 365.2422);
}

function toUrlString(str) {
	return str.replace(" ", "-");
}

function objectProperties(obj) {
	const props = [];
	for (const prop in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, prop)) {
			props.push(prop);
		}
	}

	return props;
}

function objectHasProperty(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}

function parseTimeSpan(str) {
	if (str.indexOf("-") == -1) {
		// we just have 1 value, assume it's the "start" and "end"=now
		
		return [ DateTime.local().plus(-1 * timeSpanStringMillis(str)).toJSDate(), new Date() ];

	} else {
		const parts = str.split("-").map(x => x.trim());

		if (parts.length != 2) {
			throw "Invalid timeSpan string";
		}

		return [ DateTime.local().plus(-1 * timeSpanStringMillis(parts[0])).toJSDate(), DateTime.local().plus(-1 * timeSpanStringMillis(parts[1])).toJSDate() ];
	}
}

function timeSpanStringMillis(str) {
	const timeSpansByChar = { "s":1000, "m":60000, "h":3600000, "d":86400000, "w":604800000, "M":2592000000, "y":31556926080 };

	for (const [key, value] of Object.entries(timeSpansByChar)) {
		if (str.endsWith(key)) {
			const multiplier = parseFloat(str.substring(0, str.length - 1));

			return multiplier * value;
		}
	}
}

// each item: {name:"abc[.def[.ghi]]...", count: N}
const buildItemMap = (items) => {
	const map = {allItems:[], branches:{}};

	items.forEach(item => {
		const nameParts = item.name.split(".");
		
		map.allItems.push(item);

		let parent = map.branches;
		for (let i = 0; i < nameParts.length; i++) {
			if (!parent[nameParts[i]]) {
				parent[nameParts[i]] = {path:nameParts.slice(0, i + 1).join("."), branches:{}, allItems:[], leafItems:[]};
			}

			parent[nameParts[i]].allItems.push(item);

			if (i == nameParts.length - 1) {
				parent[nameParts[i]].leafItems.push(item);
			}

			parent = parent[nameParts[i]].branches;
		}
	});

	return map;
};


module.exports = {
	formatDate: formatDate,
	randomString: randomString,
	ellipsize: ellipsize,
	ellipsizeFront: ellipsizeFront,
	dayMillis: dayMillis,
	weekMillis: weekMillis,
	monthMillis: monthMillis,
	yearMillis: yearMillis,
	toUrlString: toUrlString,
	objectProperties: objectProperties,
	objectHasProperty: objectHasProperty,
	newProjectId: newProjectId,
	parseTimeSpan: parseTimeSpan,
	timeSpanStringMillis: timeSpanStringMillis,
	buildItemMap: buildItemMap
};