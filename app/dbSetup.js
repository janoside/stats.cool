const debug = require("debug");

const appConfig = require("./config.js");

const appUtils = require("@janoside/app-utils");

const mongoClient = appUtils.mongoClient;



var debugLog = debug("app:db");
 


const dbConfig = appConfig.db;

const dbSchema = [
	{
		name: "users",
		indexes: [
			{
				name: "username_1",
				key: { "username":1 },
				properties: { unique:true }
			},
			{
				name:"roles_1",
				key: { "roles":1 }
			}
		]
	},
	{
		name: "projectGroups",
		indexes: [
			{
				name: "ownerUsername_1",
				key: { "ownerUsername":1 }
			},
			{
				name: "name_1",
				key: { "name":1 }
			}
		]
	},
	{
		name: "projects",
		indexes: [
			{
				name: "id_1",
				key: { "id":1 },
				properties: { unique:true }
			},
			{
				name: "ownerUsername_1",
				key: { "ownerUsername":1 }
			},
			{
				name: "name_1",
				key: { "name":1 }
			}
		]
	},
	{
		name: "dataPoints",
		indexes: [
			{
				name: "projectId_1",
				key: { "projectId":1 }
			},
			{
				name: "name_1",
				key: { "name": 1 }
			},
			{
				name: "date_1",
				key: { "date": 1 }
			},
			{
				name: "date_1_projectId_1_name_1",
				key: { "date": 1, "projectId": 1, "name": 1 }
			}
		]
	}
];


const connect = async () => {
	global.db = await mongoClient.createClient(dbConfig.host, dbConfig.port, dbConfig.username, dbConfig.password, dbConfig.name, dbSchema);

	await createAdminUserIfNeeded();

	return global.db;
};

const createAdminUserIfNeeded = async () => {
	// create admin user if needed
	const adminUser = await db.findOne("users", {username: appConfig.db.adminUser.username});
	if (!adminUser) {
		debugLog(`Creating admin user '${appConfig.db.adminUser.username}'...`);

		const passwordHash = await passwordUtils.hash(appConfig.db.adminUser.password);

		const adminUser = {
			username: appConfig.db.adminUser.username,
			passwordHash: passwordHash,
			roles: ["admin"]
		};

		await db.insertOne("users", adminUser);

		debugLog(`Admin user '${appConfig.db.adminUser.username}' created.`);

	} else {
		debugLog(`Admin user '${appConfig.db.adminUser.username}' already exists`);
	}
};



module.exports = {
	connect: connect
}