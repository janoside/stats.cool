const { DateTime } = require("luxon");
const debugLog = require("debug")("app:utils");

const appUtils = require("@janoside/app-utils");
const utils = appUtils.utils;


function newProjectId(length=10) {
	return `${utils.randomString(1, "a")}${utils.randomString(length - 1, "a#")}`;
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
	newProjectId: newProjectId,
	parseTimeSpan: parseTimeSpan,
	timeSpanStringMillis: timeSpanStringMillis,
	buildItemMap: buildItemMap
};