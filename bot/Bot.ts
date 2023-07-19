import { Telegraf, Scenes, session } from "telegraf";
import { MyWizardContext,  IPriceChange, Intervals, currencyISOs } from "../types/";
import InvestingScrapper from '../scrapper/InvestingScrapper'; 
import { privateOnly, groupOnly } from "./middlewares";

import settingsWizardScene from "./stages/settings";

import nodecron from "node-cron";
import User from "../database/model/User";

import debug  from 'debug';

export class Bot extends Telegraf<MyWizardContext>{
	private log = debug("bot:main");

	public static DEFAULT_ERROR_MESSAGE = "Oops, something went wrong";

	constructor(token: string, options: Partial<Telegraf.Options<MyWizardContext>> | undefined){
		super(token, options);
		this.applyDefaults();

		process.once('SIGINT', () => this.stop('SIGINT'));
		process.once('SIGTERM', () => this.stop('SIGTERM'));
	}

	public static textifyPrice( prices: IPriceChange ): string{
		const answer = (
`<b>USD</b> -> <b>${prices.ISO}</b>
<b>Preço:</b> ${prices.lastPrice} 💵
<b>Mudança:</b> {prices.priceChange} 💹 (${prices.percentChange}%)`
		);

		return answer;
	}

	private static currencyToScrapper: { [K in currencyISOs] : [ (arg?: any) => Promise<IPriceChange>, any[] ] }  = {
		[currencyISOs.BRL]: [ InvestingScrapper.prototype.getPriceFromInvesting, [ InvestingScrapper.Operations.USDtoBRL ] ],
		[currencyISOs.EUR]: [ InvestingScrapper.prototype.getPriceFromInvesting, [ InvestingScrapper.Operations.USDtoEUR ] ]
	};

	startMonitoring( investingScrapper: InvestingScrapper ){
		const log = debug("bot:monitor");

		const intervalsToCron: { [K in Intervals]: string } = {
			[Intervals.Hourly]: "0 * * * *", // Run at minute 0 of every hour 
			[Intervals.Daily]: "0 6 * * *", // Run at 10:00 AM every day
			[Intervals.Weekly]: "0 12 * * 1"  // Run at 12:00 PM every Monday (day 1 of the week)
		};

		Object.entries(intervalsToCron).forEach( ([intervalType, nodecronScheduleString], i) => {
			log(`Setting up ${intervalType} interval (${nodecronScheduleString})`);

			nodecron.schedule(nodecronScheduleString, async () => {
				log(`${intervalType.charAt(0).toUpperCase() + intervalType.slice(1)} interval schedule`);

				const users = await User.find().byIntervalType(intervalType as Intervals);

				log(`Retrieved ${users.length} users with ${intervalType} interval`);

				const prices: { [K in currencyISOs]: IPriceChange } = {} as { [K in currencyISOs]: IPriceChange };

				const promisePoll: Array<Promise<IPriceChange>> = [];
				Object.entries(Bot.currencyToScrapper).map(async ([key, [priceFunction, priceFunctionArguments]]) => {
					const p = priceFunction.call(investingScrapper, ...priceFunctionArguments);
					promisePoll.push(p);
					p.then( (price) => {
						prices[key as currencyISOs] = price;
					});
				});
				await Promise.all(promisePoll);

				log(`Received the following prices`, prices);

				log("Iterating over retrieved users...");
				users.forEach( (user) => {
					user.reminder && (
							this.telegram.sendMessage( user.telegramID, Bot.textifyPrice(prices[user.reminder.currency]), { parse_mode: "HTML" })
							.catch( (err) => {
								if(  err.response.description === "Bad Request: chat not found") {
									User.findOneAndDelete( {telegramID: user.telegramID} ).then( (e) => {
										log(`User of id ${user.telegramID} deleted`);
									});
								} else{ 
									console.error(err);
								}
							})
						);
				});

			});

		}, { runOnInit: true });

	}

	private async applyDefaults(){
		this.use( async (ctx, next) => {
			this.log("Setting error handling middleware");
			try {
				await next();
			} catch(error) {
				console.error("An error was catched", error);
			}
		});

		this.use( async (ctx, next) => {
			this.log("Received an request", ctx.message);
			await next();
		});

		this.use( async (ctx, next) => {
			this.log("Setting inner debug middleware");
			ctx.state.log = debug("bot:bot");
			await next();
		});

		this.use( async (ctx, next) => {
			this.log("Setting timer middleware");
			console.time(`Processing update ${ctx.update.update_id}`);
			await next();
			console.timeEnd(`Processing update ${ctx.update.update_id}`);
		});

		this.use( async (ctx, next) => {
			this.log("Setting timeout middleware");
			const timeoutPromise = new Promise( (resolve, reject) => {
				setTimeout( () => {
					reject( new Error("timeout") );
				}, 100);
			});

			const nextPromise = next();

			return Promise.race([timeoutPromise, nextPromise])
				.catch( (error) => {
					if(error.message === "timeout"){
						return false;
					}

					if(ctx?.chat?.type === "private"){
						ctx.replyWithHTML(
							Bot.DEFAULT_ERROR_MESSAGE,
							{
								reply_to_message_id: ctx?.message?.message_id,
								allow_sending_without_reply: true
							}
						);
					}

					throw error;
				});
		});

	};

	async applyBotSettings( investingScrapper: InvestingScrapper ){

		this.use( session() );
		this.use( new Scenes.Stage<MyWizardContext>([ settingsWizardScene ]).middleware() );
		this.log("Stage has been set");

		this.use( async (ctx, next) => {
			this.log("Setting restore session from DB middleware");

			if( ctx.session.user === undefined ){
				this.log("Received a sessionless request");
				ctx.session.user = {
					settings: {
					}
				};

				this.log(`Fetching sessionless telegramID "${ctx.message?.from.id}" in database`);

				await User.findOne( { telegramID: ctx.message?.from.id }).then( (user) => {
					this.log("Setting user session from database");
					user?.reminder?.currency && (ctx.session.user.settings.currency = user.reminder.currency);
				}).catch( (err) => {
					console.error(err);
				});

			};

			this.log("Calling next");
			await next();
		});

		this.command("start", privateOnly, async (ctx) => {
			ctx.state.log("Received a /start command");
			await ctx.reply("Hi. I'm the dolarBOT. You can use me to get the current USD prices at your target currency.", {
				reply_to_message_id: ctx.message.message_id, 
				allow_sending_without_reply: true
			});

			ctx.scene.enter("settings");
		});

		this.command("settings", privateOnly, async (ctx) => {
			ctx.state.log("Received a /settings command");
			await ctx.scene.enter("settings");
		});

		this.command("price", async (ctx) => {
			ctx.state.log("Received a /price command");

			if(ctx.session.user.settings.currency){
				const [ priceFunction, priceFunctionArguments ] =  Bot.currencyToScrapper[ctx.session.user.settings.currency];
				const prices = await priceFunction.call(investingScrapper, ...priceFunctionArguments);

				await ctx.replyWithHTML(Bot.textifyPrice(prices));
			} else {
				await ctx.reply("Please, set your curency first using the /settings command");
			}

		});

		this.log("All the settings were applied");
	}

	setBotCommands(){
		// TODO don't ever dare calling this function before applyDefaults (in tests), NEVER!
		this.telegram.setMyCommands( [ 
			{ command: "price", description: "get the current price of the dolar to your target currency" },
			{ command: "settings", description: "set your settings" },
		]);
	}

}

