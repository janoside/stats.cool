const express = require("express");
const router = express.Router();
const app = require("../app/app.js");
const utils = require("../app/util/utils.js");
const debugLog = require("debug")("app:rootRouter");
const asyncHandler = require("express-async-handler");
const passwordUtils = require("../app/util/password.js");
const appConfig = require("../app/config.js");
const db = require("../app/db.js");
const { ObjectID } = require("mongodb");
const MongoObjectID = require("mongodb").ObjectID;

router.get("/", asyncHandler(async (req, res, next) => {
	if (req.session.user) {
		res.locals.projects = await db.findObjects("projects", {ownerUsername: req.session.username});
	}

	res.render("index");
}));

router.get("/signup", asyncHandler(async (req, res, next) => {
	res.render("signup");
}));

router.post("/signup", asyncHandler(async (req, res, next) => {
	const username = req.body.username;
	const passwordHash = await passwordUtils.hash(req.body.password);

	const existingUser = await db.findObject("users", {username:username});
	if (existingUser) {
		debugLog("Username already exists");

		res.locals.userMessage = "Sorry, that username is already taken.";
		res.locals.userMessageType = "danger";

		res.render("signup");

		return;
	}

	const user = {
		username: username,
		passwordHash: passwordHash
	};

	const insertedUser = await db.insertObject("users", user);

	req.session.username = username;
	req.session.user = insertedUser;

	req.session.userMessage = "Success!";
	req.session.userMessageType = "success";

	if (req.body.rememberme) {
		const props = {username:req.body.username, passwordHash:user.passwordHash};

		res.cookie("rememberme", JSON.stringify(props), {
			maxAge: (3 * utils.monthMillis()),
			httpOnly: appConfig.secureSite
		});

	} else {
		res.clearCookie("rememberme");
	}

	res.redirect("/");
}));

router.post("/login", asyncHandler(async (req, res, next) => {
	const user = await app.authenticate(req.body.username, req.body.password);

	if (user) {
		req.session.username = user.username;
		req.session.user = user;

		req.session.userMessage = "Success!";
		req.session.userMessageType = "success";

		if (req.body.rememberme) {
			const props = {username:req.body.username, passwordHash:user.passwordHash};

			res.cookie("rememberme", JSON.stringify(props), {
				maxAge: (3 * utils.monthMillis()),
				httpOnly: appConfig.secureSite
			});

		} else {
			res.clearCookie("rememberme");
		}

		res.redirect("/");

	} else {
		req.session.userMessage = "Login failed - invalid username or password";
		req.session.userMessageType = "danger";

		res.redirect("/");
	}
}));

router.get("/logout", async (req, res, next) => {
	req.session.username = null;
	req.session.user = null;

	res.clearCookie("rememberme");

	res.redirect("/");
});

router.get("/settings", asyncHandler(async (req, res, next) => {
	res.render("settings");
}));

router.get("/account", asyncHandler(async (req, res, next) => {
	res.render("account");
}));



/*
router.get("/link/:linkId", asyncHandler(async (req, res, next) => {
	if (!req.session.user) {
		res.redirect("/");

		return;
	}

	const linkId = req.params.linkId;
	const link = await db.findObject("links", {_id:ObjectID(linkId)});

	if (req.session.username != link.username) {
		res.redirect("/");

		return;
	}

	res.locals.link = link;

	res.render("link");
}));

router.get("/link/:linkId/edit", asyncHandler(async (req, res, next) => {
	const linkId = req.params.linkId;
	const link = await db.findObject("links", {_id:ObjectID(linkId)});

	res.locals.link = link;

	res.render("link-edit");
}));

router.post("/link/:linkId/edit", asyncHandler(async (req, res, next) => {
	const linkId = req.params.linkId;
	const link = await db.findObject("links", {_id:ObjectID(linkId)});

	link.url = req.body.url;
	link.desc = req.body.desc;
	link.tags = req.body.tags.split(",").map(x => x.trim());

	debugLog("updatedLink: " + JSON.stringify(link));

	const linksCollection = await db.getCollection("links");
	const updateResult = await linksCollection.updateOne({_id:ObjectID(linkId)}, {$set: link});

	req.session.userMessage = updateResult.result.ok == 1 ? "Link saved." : ("Status unknown: " + JSON.stringify(updateResult));
	req.session.userMessageType = "success";

	res.redirect(`/link/${linkId}`);
}));

router.get("/link/:linkId/raw", asyncHandler(async (req, res, next) => {
	if (!req.session.user) {
		res.redirect("/");

		return;
	}

	const linkId = req.params.linkId;
	const link = await db.findObject("links", {_id:ObjectID(linkId)});

	if (req.session.username != link.username) {
		res.redirect("/");

		return;
	}

	res.locals.link = link;

	res.render("link-raw");
}));

router.get("/link/:linkId/delete", asyncHandler(async (req, res, next) => {
	const linkId = req.params.linkId;
	const link = await db.findObject("links", {_id:ObjectID(linkId)});

	res.locals.link = link;

	res.render("link-delete");
}));

router.post("/link/:linkId/delete", asyncHandler(async (req, res, next) => {
	const linkId = req.params.linkId;
	const link = await db.findObject("links", {_id:ObjectID(linkId)});

	const result = await db.deleteObject("links", {_id:link._id});

	debugLog("deleteResult: " + JSON.stringify(result));
	
	req.session.userMessage = "Link deleted."

	res.redirect("/");
}));

router.get("/links", asyncHandler(async (req, res, next) => {
	if (!req.session.user) {
		res.redirect("/");

		return;
	}

	const user = await db.findObject("users", {username:req.session.username});
	const links = await db.findObjects(
		"links",
		{ userId: user._id.toString()},
		{ sort: [["date", 1]] });

	const linksCollection = await db.getCollection("links");
	const tagsData = await linksCollection.aggregate([
		{ $match: { userId: req.session.user._id.toString() } },
		{ $unwind: "$tags" },
		{ $group: { _id: "$tags", count: { $sum: 1 } } },
		{ $sort: { count: -1, _id: 1 }}
	]).toArray();

	res.locals.user = user;
	res.locals.links = links;
	res.locals.tags = [];
	res.locals.tagsData = tagsData;

	res.render("user-links");
}));

router.get("/tags/:tags", asyncHandler(async (req, res, next) => {
	const tags = req.params.tags.split(",");
	const links = await db.findObjects(
		"links",
		{ userId: req.session.user._id.toString(), tags: { $all: tags }},
		{ sort: [["date", 1]] });

	const linksCollection = await db.getCollection("links");
	const tagsData = await linksCollection.aggregate([
		{ $match: { userId: req.session.user._id.toString(), tags: { $all: tags } } },
		{ $unwind: "$tags" },
		{ $group: { _id: "$tags", count: { $sum: 1 } } },
		{ $sort: { count: -1, _id: 1 }}
	]).toArray();

	res.locals.tags = tags;
	res.locals.links = links;
	res.locals.tagsData = tagsData;

	res.render("tag-links");
}));

router.get("/search", asyncHandler(async (req, res, next) => {
	const query = req.query.query;

	const regex = new RegExp(query, "i");
	
	const links = await db.findObjects(
		"links",
		{
			$and: [
				{ userId: req.session.user._id.toString() },
				{
					$or:[
						{ desc: regex },
						{ url: regex },
						{ tags: regex }
					]
				}
			]
		},
		{ sort: [["date", 1]] });

	const linksCollection = await db.getCollection("links");
	const tagsData = await linksCollection.aggregate([
		{ $match: { userId: req.session.user._id.toString(), $or: [ { desc: new RegExp(query, "i") }, { url: new RegExp(query, "i") } ] } },
		{ $unwind: "$tags" },
		{ $group: { _id: "$tags", count: { $sum: 1 } } },
		{ $sort: { count: -1, _id: 1 }}
	]).toArray();
	
	res.locals.query = query;
	res.locals.links = links;
	res.locals.tags = [];
	res.locals.tagsData = tagsData;

	res.render("search-links");
}));

router.get("/tags", asyncHandler(async (req, res, next) => {
	const linksCollection = await db.getCollection("links");
	const tagsData = await linksCollection.aggregate([
		{ $match: { userId: req.session.user._id.toString() } },
		{ $unwind: "$tags" },
		{ $group: { _id: "$tags", count: { $sum: 1 } } },
		{ $sort: { count: -1, _id: 1 }}
	]).toArray();

	res.locals.tagsData = tagsData;
	
	res.render("tags");
}));
*/

module.exports = router;
