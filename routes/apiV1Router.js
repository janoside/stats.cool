const express = require("express");
const router = express.Router();
const app = require("../app/app.js");
const db = require("../app/db.js");
const debugLog = require("debug")("app:rootRouter");
const asyncHandler = require("express-async-handler");
const { DateTime } = require("luxon");


const commonDataPointKeys = [ "projectId", "name", "tags", "date" ];

router.post("/project/:projectId/dataPoint", asyncHandler(async (req, res, next) => {
	const projectId = req.params.projectId;
	const name = req.body.name;

	if (!name) {
		res.status(500);
		res.json({error: "Missing required param: name"});

		return;
	}

	const dataPoint = {
		projectId: projectId,
		name: name
	};

	if (req.body.tags) {
		dataPoint.tags = req.body.tags.split(",").map(x => x.trim().toLowerCase());
	}

	if (req.body.date) {
		dataPoint.date = DateTime.fromISO(req.body.date);
	}


	for (const [key, value] of Object.entries(req.body)) {
		if (!commonDataPointKeys.includes(key)) {
			dataPoint[key] = value;
		}
	}

	if (!dataPoint.date) {
		dataPoint.date = new Date();
	}

	const savedDataPoint = await db.insertObject("dataPoints", dataPoint);

	res.json({success:true});
}));


module.exports = router;
