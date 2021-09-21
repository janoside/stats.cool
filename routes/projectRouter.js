const express = require("express");
const router = express.Router();
const app = require("../app/app.js");
const debugLog = require("debug")("app:rootRouter");
const asyncHandler = require("express-async-handler");
const { DateTime } = require("luxon");

const appUtils = require("@janoside/app-utils");
const utils = appUtils.utils;

const statsUtils = require("../app/statsUtils.js");


router.get("*", asyncHandler(async (req, res, next) => {
	var loginNeeded = false;

	if (req.session.username == null) {
		loginNeeded = true;
	}

	if (loginNeeded) {
		req.session.userMessage = "Login required.";

		res.redirect("/");

	} else {
		next();
	}
}));

router.get("/new", asyncHandler(async (req, res, next) => {
	res.render("project/new");
}));

router.post("/new", asyncHandler(async (req, res, next) => {
	const name = req.body.name;

	const project = {
		id: statsUtils.newProjectId(10),
		ownerUsername: req.session.username,
		name: name,
		createdAt: new Date()
	};

	const savedProjectId = await db.insertOne("projects", project);

	req.session.userMessage = "Saved!";
	req.session.userMessageType = "success";

	res.redirect(`/project/${project.id}`);
}));

router.get("/:projectId", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;
	const [startDate, endDate] = statsUtils.parseTimeSpan(req.query.timespan || "30d");

	res.locals.project = await db.findOne("projects", {id: projectId});
	res.locals.timespan = req.query.timespan || "30d";

	const matchProperties = { projectId: projectId, date: { $gte: startDate, $lt: endDate } };
	if (req.query.prefix) {
		res.locals.prefix = req.query.prefix;

		matchProperties.name = { $regex: new RegExp("^" + req.query.prefix, "i") };
	}

	const dataPointsCollection = await db.getCollection("dataPoints");
	const dataPointAggregation = await dataPointsCollection.aggregate([
		{ $match: matchProperties },
		{ $group: { _id: "$name", count: { $sum: 1 } } },
		{ $sort: { _id: 1 }}
	]).toArray();

	res.locals.dataPointNames = [];
	//res.locals.dataPointCountsByName = {};

	const dataPointObjects = [];
	const dataPointNameMap = {items:[], branches:{}, leafItems:[]};
	dataPointAggregation.forEach(x => {
		dataPointObjects.push({name: x._id, count: x.count});

		res.locals.dataPointNames.push(x._id);
		//res.locals.dataPointCountsByName[x._id] = x.count;
	});

	res.locals.dataPointMap = statsUtils.buildItemMap(dataPointObjects);

	res.render("project/home");
}));

router.get("/:projectId/create-test-data/:x/:y", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;
	const x = parseInt(req.params.x);
	const y = parseInt(req.params.y);

	res.locals.project = await db.findOne("projects", { id: projectId });

	const ptsPerName = y;

	const prefixes = [ utils.randomString(8, "a") + ".1" + utils.randomString(5, "a"), utils.randomString(6, "a"), utils.randomString(7, "a"), utils.randomString(5, "a") ];

	const dataPoints = [];
	for (let i = 0; i < x; i++) {
		const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
		let name = prefix + "." + utils.randomString(6, "a");
		if (Math.random() > 0.5) {
			name += ("." + utils.randomString(7, "a"));
		}

		if (Math.random() > 0.9) {
			name += ("/" + utils.randomString(7, "a") + "/" + utils.randomString(5, "a"));
		}

		for (let j = 0; j < ptsPerName; j++) {
			const date = DateTime.local().plus(-1 * statsUtils.timeSpanStringMillis("30d") * j / ptsPerName).toJSDate();

			dataPoints.push({
				projectId: projectId,
				name: name,
				date: date,
				min: Math.random() * i,
				max: Math.random() * i + i,
				avg: Math.random() * i + i/2,
				val: Math.random() * Math.log10(i * i),
				count: Math.floor(Math.random() * 1000)
			});
		}
	}

	await db.insertMany("dataPoints", dataPoints);

	res.locals.userMessage = "Created test data.";

	res.redirect(`/project/${projectId}`);
}));

router.get("/:projectId/delete", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;

	res.locals.project = await db.findOne("projects", {id: projectId});

	const dataPointsCollection = await db.getCollection("dataPoints");

	res.locals.dataPointCount = await dataPointsCollection.countDocuments({ projectId: projectId });

	res.render("project/deleteConfirmation");
}));

router.post("/:projectId/delete", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;

	res.locals.project = await db.findOne("projects", {id: projectId});

	const dataPointsDeleteResult = await db.deleteMany("dataPoints", { projectId: projectId });

	debugLog("deleteResult.dataPoints: " + JSON.stringify(dataPointsDeleteResult));

	const projectDeleteResult = await db.deleteOne("projects", { id: projectId });

	debugLog("deleteResult.project: " + JSON.stringify(projectDeleteResult));

	req.session.userMessage = "Project deleted.";
	req.session.userMessageType = "success";

	res.redirect("/");
}));

router.get("/:projectId/delete-data-points/:dataPointName", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;
	const dataPointName = req.params.dataPointName;

	res.locals.project = await db.findOne("projects", {id: projectId});
	res.locals.dataPointName = dataPointName;

	const dataPointsCollection = await db.getCollection("dataPoints");

	res.locals.dataPointCount = await dataPointsCollection.countDocuments({
		projectId: projectId,
		name: dataPointName
	});

	res.render("project/deleteDataPointsConfirmation");
}));

router.post("/:projectId/delete-data-points/:dataPointName", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;
	const dataPointName = req.params.dataPointName;

	res.locals.project = await db.findOne("projects", {id: projectId});

	const dataPointsDeleteResult = await db.deleteMany(
		"dataPoints",
		{
			projectId: projectId,
			name: dataPointName
		});

	debugLog("deleteResult.dataPoints: " + JSON.stringify(dataPointsDeleteResult));

	req.session.userMessage = "Data points deleted.";
	req.session.userMessageType = "success";

	res.redirect(`/project/${projectId}`);
}));


router.get("/:projectId/:dataPointName/:timespan?", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;
	const dataPointName = req.params.dataPointName;
	const [startDate, endDate] = statsUtils.parseTimeSpan(req.params.timespan || "24h");

	res.locals.project = await db.findOne("projects", { id: projectId });
	res.locals.dataPointName = dataPointName;
	res.locals.timespan = req.params.timespan || "24h";

	res.locals.dataPoints = await db.findMany(
		"dataPoints",
		{
			projectId: projectId,
			name: dataPointName,
			date: { $gte: startDate, $lt: endDate }
		});

	// these are "special" properties that we know what to do with "out of the box"
	const managedPropertyNames = [ "min", "max", "avg", "val", "sum", "count" ];
	const managedPropertySelectors = {
		min: (a, b) => { return Math.min(a || 1000000, b); },
		max: (a, b) => { return Math.max(a || 0, b); },
		sum: (a, b) => { return ((a || 0) + b); },
		count: (a, b) => { return ((a || 0) + b); }
	};
	
	res.locals.data = {};
	res.locals.summary = {};

	res.locals.dataPoints.forEach(x => {
		managedPropertyNames.forEach(propName => {
			if (x.hasOwnProperty(propName)) {
				if (!res.locals.data[propName]) {
					res.locals.data[propName] = [];
				}
				
				res.locals.data[propName].push({t: x.date, y: x[propName]});
				
				if (managedPropertySelectors[propName]) {
					res.locals.summary[propName] = managedPropertySelectors[propName](res.locals.summary[propName], x[propName]);
				}
			}
		});
	});

	res.render("project/dataPointType");
}));


module.exports = router;
