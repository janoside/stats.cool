const fs = require('fs');
const debug = require("debug");
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const session = require("express-session");
const { marked } = require("marked");
const simpleGit = require("simple-git");
const { DateTime } = require("luxon");

const app = require("./app/app.js");
const statsUtils = require("./app/statsUtils.js");

const appUtils = require("@janoside/app-utils");
const utils = appUtils.utils;

const debugLog = debug("app:app");

const package_json = require('./package.json');
global.appVersion = package_json.version;

const appConfig = require("./app/config.js");

const rootRouter = require("./routes/rootRouter.js");
const adminRouter = require("./routes/adminRouter.js");
const projectRouter = require("./routes/projectRouter.js");
const apiV1Router = require("./routes/apiV1Router.js");

const expressApp = express();

const dbSetup = require("./app/dbSetup.js");


process.on("unhandledRejection", (reason, p) => {
	debugLog("Unhandled Rejection at: Promise", p, "reason:", reason, "stack:", (reason != null ? reason.stack : "null"));
});

expressApp.onStartup = function() {
	global.appStartDate = new Date();
	global.nodeVersion = process.version;

	(async () => {
		try {
			let db = await dbSetup.connect();

		} catch (err) {
			utils.logError("db-connection-failure", err);
		}
	})();
	if (global.sourcecodeVersion == null && fs.existsSync('.git')) {
		simpleGit(".").log(["-n 1"], function(err, log) {
			if (err) {
				utils.logError("3fehge9ee", err, {desc:"Error accessing git repo"});

				debugLog(`Starting ${global.appConfig.siteName}, v${global.appVersion} (code: unknown commit)`);

			} else {
				global.sourcecodeVersion = log.all[0].hash.substring(0, 10);
				global.sourcecodeDate = log.all[0].date.substring(0, "0000-00-00".length);

				debugLog(`Starting ${global.appConfig.siteName}, v${global.appVersion} (commit: '${global.sourcecodeVersion}', date: ${global.sourcecodeDate})`);
			}
		});

	} else {
		debugLog(`Starting ${global.appConfig.siteName}, v${global.appVersion}`);
	}
};

// view engine setup
expressApp.set("views", path.join(__dirname, "views"));
expressApp.set("view engine", "pug");

expressApp.disable("x-powered-by");

const sessionCookieConfig = {
	secret: appConfig.cookiePassword,
	resave: false,
	saveUninitialized: true,
	cookie: {
		secure: appConfig.secureSite,
		domain: appConfig.siteDomain
	}
};

// Helpful reference for production: nginx HTTPS proxy:
// https://gist.github.com/nikmartin/5902176
debugLog(`Session cookie config: ${JSON.stringify(sessionCookieConfig)}`);

expressApp.enable("trust proxy");
expressApp.set("trust proxy", 1); // trust first proxy, needed for {cookie:{secure:true}} below

expressApp.use(session(sessionCookieConfig));

expressApp.use(logger('dev'));
expressApp.use(express.json());
expressApp.use(express.urlencoded({ extended: false }));
expressApp.use(cookieParser());
expressApp.use(express.static(path.join(__dirname, "public")));

expressApp.use(async (req, res, next) => {
	res.locals.appConfig = global.appConfig;
	res.locals.session = req.session;

	// rememberme auto-login
	if (!req.session.username && req.cookies.rememberme) {
		var rememberme = JSON.parse(req.cookies.rememberme);
		
		var user = await app.authenticate(rememberme.username, rememberme.passwordHash, true);
		if (user) {
			req.session.username = rememberme.username;
			req.session.user = user;
		}
	}

	if (req.session.userMessage) {
		res.locals.userMessage = req.session.userMessage;
		req.session.userMessage = null;
	}

	if (req.session.userMessageMarkdown) {
		res.locals.userMessageMarkdown = req.session.userMessageMarkdown;
		req.session.userMessageMarkdown = null;
	}

	// default "info" style for user messages
	res.locals.userMessageType = "info";
	if (req.session.userMessageType) {
		res.locals.userMessageType = req.session.userMessageType;
		req.session.userMessageType = null;
	}

	if (req.session.userErrors && req.session.userErrors.length > 0) {
		res.locals.userErrors = req.session.userErrors;

		req.session.userErrors = null;
	}

	res.locals.url = req.url;
	res.locals.path = req.path;

	next();
});

expressApp.use("/api/v1", apiV1Router);
expressApp.use("/project", projectRouter);
expressApp.use("/admin", adminRouter);
expressApp.use("/", rootRouter);


// catch 404 and forward to error handler
expressApp.use(function(req, res, next) {
	next(createError(404));
});

// error handler
expressApp.use(function(err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get("env") === "development" ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render("error");
});


expressApp.locals.marked = marked;
expressApp.locals.DateTime = DateTime;
expressApp.locals.utils = utils;


module.exports = expressApp;
