import "./config"
import debug  from 'debug'

import { startBrowser } from './scrapper';
import InvestingScrapper from './scrapper/InvestingScrapper'; 
import MongoConnection from "./database/MongoConnection";


import { Bot } from "./bot"

const log = debug("bot:index");

async function main(): Promise<void>{

	const browser = await startBrowser();
	const investingScrapper = new InvestingScrapper(browser);
	const connection = MongoConnection.getConnection();

	let bot: Bot;
	if(process.env.BOT_TOKEN){
		bot = new Bot(process.env.BOT_TOKEN, {
			telegram: {
				apiRoot: process.env.API_ROOT
			}
		})

	} else {
		throw new Error("Environment variable $BOT_TOKEN was not provided.");
	}

	connection.once("open", async () => {
		bot.use( async (ctx, next) => {
			ctx.state.mongoConnection = connection;
			await next();
		});

		bot.setBotCommands();
		bot.applyBotSettings(investingScrapper);

		await investingScrapper.accessPageForLink( InvestingScrapper.Operations.USDtoBRL );

		log("Launching bot");
		bot.launch().catch( (reason) => {
			console.error(`An error ocurred: "${reason}"`);
		})

		log("Starting monitory")
		bot.startMonitoring(investingScrapper);
	})

}

main()
	.then( () => {
	})
	.catch( (error) => {
		console.error(error);
		process.exit(1);
	});
