const express = require("express");
const router = express.Router();
const app = require("../app/app.js");
const db = require("../app/db.js");
const debugLog = require("debug")("app:rootRouter");
const asyncHandler = require("express-async-handler");
const utils = require("../app/util/utils.js");
const { DateTime } = require("luxon");

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
		id: utils.newProjectId(10),
		ownerUsername: req.session.username,
		name: name
	};

	const savedProject = await db.insertObject("projects", project);

	req.session.userMessage = "Saved!";
	req.session.userMessageType = "success";

	res.redirect(`/project/${savedProject.id}`);
}));

router.get("/:projectId", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;

	res.locals.project = await db.findObject("projects", {id: projectId});

	const dataPointsCollection = await db.getCollection("dataPoints");
	const dataPointNames = await dataPointsCollection.aggregate([
		{ $match: { projectId: projectId } },
		{ $group: { _id: "$name" } },
		{ $sort: { _id: 1 }}
	]).toArray();

	res.locals.dataPointNames = [];
	dataPointNames.forEach(x => res.locals.dataPointNames.push(x._id));

	res.render("project/home");
}));

router.get("/:projectId/create-test-data/:x/:y", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;
	const x = parseInt(req.params.x);
	const y = parseInt(req.params.y);

	res.locals.project = await db.findObject("projects", { id: projectId });

	const ptsPerName = y;

	const dataPoints = [];
	for (let i = 0; i < x; i++) {
		const name = utils.randomString(10);

		for (let j = 0; j < ptsPerName; j++) {
			const date = DateTime.local().plus(-1 * utils.timeSpanStringMillis("30d") * j / ptsPerName).toJSDate();

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

	await db.insertObjects("dataPoints", dataPoints);

	res.locals.userMessage = "Created test data.";

	res.redirect(`/project/${projectId}`);
}));

router.get("/:projectId/delete", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;

	res.locals.project = await db.findObject("projects", {id: projectId});

	const dataPointsCollection = await db.getCollection("dataPoints");

	res.locals.dataPointCount = await dataPointsCollection.countDocuments({ projectId: projectId });

	res.render("project/deleteConfirmation");
}));

router.post("/:projectId/delete", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;

	res.locals.project = await db.findObject("projects", {id: projectId});

	const dataPointsDeleteResult = await db.deleteObjects("dataPoints", { projectId: projectId });

	debugLog("deleteResult.dataPoints: " + JSON.stringify(dataPointsDeleteResult));

	const projectDeleteResult = await db.deleteObject("projects", { id: projectId });

	debugLog("deleteResult.project: " + JSON.stringify(projectDeleteResult));

	req.session.userMessage = "Project deleted.";
	req.session.userMessageType = "success";

	res.redirect("/");
}));




router.get("/:projectId/:dataPointName", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;
	const dataPointName = req.params.dataPointName;
	const [startDate, endDate] = utils.parseTimeSpan("24h");

	res.locals.project = await db.findObject("projects", { id: projectId });
	res.locals.dataPointName = dataPointName;
	res.locals.timespan = "24h";

	res.locals.dataPoints = await db.findObjects(
		"dataPoints",
		{
			projectId: projectId,
			name: dataPointName,
			date: { $gte: startDate, $lt: endDate }
		});

	// these are "special" properties that we know what to do with "out of the box"
	const managedPropertyNames = [ "min", "max", "avg", "val", "sum", "count" ];
	
	res.locals.data = {};

	res.locals.dataPoints.forEach(x => {
		managedPropertyNames.forEach(propName => {
			if (x.hasOwnProperty(propName)) {
				if (!res.locals.data[propName]) {
					res.locals.data[propName] = [];
				}
				
				res.locals.data[propName].push({t: x.date, y: x[propName]});
			}
		});
	});

	res.render("project/dataPointType");
}));

router.get("/:projectId/:dataPointName/:timeSpan", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;
	const dataPointName = req.params.dataPointName;
	const [startDate, endDate] = utils.parseTimeSpan(req.params.timeSpan);

	res.locals.project = await db.findObject("projects", { id: projectId });
	res.locals.dataPointName = dataPointName;
	res.locals.timespan = req.params.timeSpan;

	res.locals.dataPoints = await db.findObjects(
		"dataPoints",
		{
			projectId: projectId,
			name: dataPointName,
			date: { $gte: startDate, $lt: endDate }
		});

	// these are "special" properties that we know what to do with "out of the box"
	const managedPropertyNames = [ "min", "max", "avg", "val", "sum", "count" ];
	
	res.locals.data = {};

	res.locals.dataPoints.forEach(x => {
		managedPropertyNames.forEach(propName => {
			if (x.hasOwnProperty(propName)) {
				if (!res.locals.data[propName]) {
					res.locals.data[propName] = [];
				}
				
				res.locals.data[propName].push({t: x.date, y: x[propName]});
			}
		});
	});

	res.render("project/dataPointType");
}));


module.exports = router;
