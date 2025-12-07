import process from "process";
import fs from "fs";
import path from "path";
import concurrently from "concurrently";
import { config } from "./lib.js";

function joinCommand(...parts) {
	return parts.filter((part) => !!part).join(" ");
}

function watchPackages() {
	return [
		{
			command: 'yarn watch --preserveWatchOutput',
			cwd: "packages",
			name: "TSC",
			prefixColor: "red",
		},
	];
}

function watchWorker() {
	return [
		{
			command: "yarn watch-for-worker-changes",
			cwd: "packages",
			name: "WORKER-RESTART",
			prefixColor: "green",
		},
	];
}

function watchMeteor() {
	const settingsFileExists = fs.existsSync("meteor-settings.json");
	if (settingsFileExists) {
		console.log('Found meteor-settings.json')
	} else {
		console.log('No meteor-settings.json')
	}

	// If a ROOT_URL is defined, meteor will serve under that. We should use the same for vite, to get the correct proxying
	const rootUrl = process.env.ROOT_URL ? new URL(process.env.ROOT_URL) : null

	return [
		{
			command: joinCommand(
				'yarn debug',
				config.inspectMeteor ? " --inspect" : "",
				config.verbose ? " --verbose" : "",
				settingsFileExists ? " --settings ../meteor-settings.json" : ""
			),
			cwd: "meteor",
			name: "METEOR",
			prefixColor: "cyan",
		},
		{
			command: `yarn dev`,
			cwd: "packages/webui",
			name: "VITE",
			prefixColor: "yellow",
			env: {
				SOFIE_BASE_PATH: rootUrl && rootUrl.pathname.length > 1 ? rootUrl.pathname : '',
			},
		},
	];
}

function hr() {
	// write regular dashes if this is a "simple" output stream ()
	if (!process.stdout.hasColors || !process.stdout.hasColors())
		return "-".repeat(process.stdout.columns ?? 40);
	return "─".repeat(process.stdout.columns ?? 40);
}

function switchDatabase(dbName) {
	const meteorLocalDir = path.join('meteor', '.meteor', 'local');
	const dbLink = path.join(meteorLocalDir, 'db');
	const dbTarget = path.join(meteorLocalDir, `db.${dbName}`);

	// Check if we're already using this database
	if (fs.existsSync(dbLink)) {
		const currentTarget = fs.readlinkSync(dbLink);
		if (currentTarget === `db.${dbName}`) {
			console.log(`✓ Already using database: ${dbName}`);
			return;
		}
	}

	// Create target directory if it doesn't exist
	if (!fs.existsSync(dbTarget)) {
		console.log(`Creating new database directory: ${dbName}`);
		fs.mkdirSync(dbTarget, { recursive: true });
	}

	// Remove existing db link/directory
	if (fs.existsSync(dbLink)) {
		const stats = fs.lstatSync(dbLink);
		if (stats.isSymbolicLink()) {
			fs.unlinkSync(dbLink);
		} else {
			// It's a real directory - back it up as 'default'
			const defaultDb = path.join(meteorLocalDir, 'db.default');
			if (!fs.existsSync(defaultDb)) {
				console.log(`Backing up existing database to: default`);
				fs.renameSync(dbLink, defaultDb);
			} else {
				// Default already exists, just remove current
				fs.rmSync(dbLink, { recursive: true, force: true });
			}
		}
	}

	// Create symlink to target database
	fs.symlinkSync(`db.${dbName}`, dbLink);
	console.log(`✓ Switched to database: ${dbName}`);
}

try {
	// Note: This script assumes that install-and-build.mjs has been run before

	// Switch database if requested
	if (config.dbName) {
		switchDatabase(config.dbName);
	}

	// The main watching execution
	console.log(hr());
	console.log(" ⚙️  Starting up in development mode...         ");
	console.log(hr());
	await concurrently(
		[
			...(config.uiOnly ? [] : watchPackages()),
			...(config.uiOnly ? [] : watchWorker()),
			...watchMeteor(),
		],
		{
			prefix: "name",
			killOthers: ["failure", "success"],
			restartTries: 0,
		}
	).result;
} catch (e) {
	console.error(e.message);
	process.exit(1);
}

function signalHandler(signal) {
	process.exit();
}

// Make sure to exit on interrupt
process.on("SIGINT", signalHandler);
process.on("SIGTERM", signalHandler);
process.on("SIGQUIT", signalHandler);
