const args = process.argv.slice(2);

// Parse --db=name option
const dbArg = args.find(arg => arg.startsWith('--db='));
const dbName = dbArg ? dbArg.split('=')[1] : null;

const config = {
	uiOnly: args.indexOf("--ui-only") >= 0 || false,
	inspectMeteor: args.indexOf("--inspect-meteor") >= 0 || false,
	verbose: args.indexOf("--verbose") >= 0 || false,
	dbName: dbName,
};

module.exports = {
	config,
};
