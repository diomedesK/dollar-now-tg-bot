import "../config"

import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import { GetUpdatesResponse } from "telegram-test-api/lib/routes/client/getUpdates";

import { Browser } from "puppeteer"; 
import TelegramServer from "telegram-test-api";
import { TelegramClient } from "telegram-test-api/lib/modules/telegramClient";

import { startBrowser, InvestingScrapper } from '../scrapper';
import { Bot } from "../bot"
import User from "../database/model/User";

import MongoConnection from "../database/MongoConnection";

describe("Bot commands that run fast", () => {
	const DEFAULT_TIMEOUT = 20 * 1000;
	const MOCK_USER_ID = 123456789;

	let server: TelegramServer;
	let client: TelegramClient;
	let browser: Browser;

	let bot: Bot;

	MongoConnection.getConnection();

	server = new TelegramServer({ port: 9000 });

	jest.setTimeout(DEFAULT_TIMEOUT);

	beforeEach( async () => {
		console.log("Starting a new test");
		
		await server.start();
		client = server.getClient(process.env.BOT_TOKEN as string, { timeout: DEFAULT_TIMEOUT });
		server.getClient(process.env.BOT_TOKEN as string, {
			userId: MOCK_USER_ID,
			userName: "Mockery"
		});

		bot = new Bot(process.env.BOT_TOKEN as string, {
			telegram: {
				apiRoot: server.config.apiURL
			}
		})

		browser = await startBrowser();
		const investingScrapper = new InvestingScrapper(browser);
		bot.applyBotSettings(investingScrapper);

		bot.launch();
	});

	afterEach( (done) => {
		browser.close().then( () => {
			server.stop().then( () => {
				done();
			})
		});
	});

	afterAll( (done) => {
		User.findOneAndDelete({telegramID: MOCK_USER_ID}).then( (res) => {
			done();
		});
	});


	it("should make sure tests are being executed", () => {
		expect(true).toEqual(true);
	})

	const getButtonFromUpdates = (updates: GetUpdatesResponse, targetButtonText: string, logResults = false): InlineKeyboardButton.CallbackButton => {
		if(logResults){
			updates.result.forEach( (result) => {
				console.log(result);
			})
		}

		const targetButton: InlineKeyboardButton.CallbackButton = updates.result
			.map( (result) => { return result.message } )
			.filter( (message) => { return message.reply_markup?.inline_keyboard? true: false } )
			.map( (message) => { return message.reply_markup.inline_keyboard } )
			.flatMap(( row ) => { return row } )
			.flatMap(( row ) => { return row } )
			.find(( button: InlineKeyboardButton.CallbackButton ) =>  { return button.text.toLowerCase() === targetButtonText.toLowerCase() });

		return targetButton;
	};

	it("should interact with the '/settings' command, set 'BRL' and 'hourly', unconfirm the settings clicking 'no' and go back to the beginning'", (done) => {
		const wrap = async () => {
			await client.sendCommand(client.makeCommand('/settings'));
			const initialUpdates = await client.getUpdates();
			const firstReceivedText = initialUpdates.result[0].message.text;

			const BRLButton = getButtonFromUpdates( initialUpdates, "BRL");

			await client.sendCallback(client.makeCallbackQuery(BRLButton.callback_data));

			const hourlyButton = getButtonFromUpdates( await client.getUpdates(), "hourly");
			await client.sendCallback(client.makeCallbackQuery(hourlyButton.callback_data));

			console.log("No button");
			const noButton = getButtonFromUpdates( await client.getUpdates(), "No", true);
			await client.sendCallback(client.makeCallbackQuery(noButton.callback_data));

			await client.getUpdates().then( (updates) => {
				updates.result.forEach( (result) => {
					console.log(result);
				})

				console.log(firstReceivedText);

				expect(updates.result[0].message.text).toEqual(firstReceivedText);
			})

		}

		wrap().finally( () => {
			done();
		});
	});

	it("should interact with the '/settings' command, set 'BRL' and 'hourly' and receive a 'goodbye!'", (done) => {
		const wrap = async () => {
			await client.sendCommand(client.makeCommand('/settings'));

			const BRLButton = getButtonFromUpdates( await client.getUpdates(), "BRL");
			console.log("BRLButton ok");

			await client.sendCallback(client.makeCallbackQuery(BRLButton.callback_data));

			const hourlyButton = getButtonFromUpdates( await client.getUpdates(), "hourly");

			await client.sendCallback(client.makeCallbackQuery(hourlyButton.callback_data));

			const yesButton = getButtonFromUpdates( await client.getUpdates(), "Yes");
			await client.sendCallback(client.makeCallbackQuery(yesButton.callback_data));

			await client.getUpdates().then( (updates) => {
				expect(updates.result[0].message.text).toEqual("Goodbye!");
			});

		};

		wrap().finally( () => {
			done();
		});
	});

})

describe("Bot commands that take long to finish", () => {
	let server: TelegramServer;
	let client: TelegramClient;
	let browser: Browser;

	let bot: Bot;

	server = new TelegramServer({ port: 9000 });

	const DEFAULT_TIMEOUT = 30 * 1000;
	jest.setTimeout(DEFAULT_TIMEOUT);


	beforeEach( async () => {
		await server.start();
		client = server.getClient(process.env.BOT_TOKEN as string, { timeout: DEFAULT_TIMEOUT });

		console.log(server.config);
		bot = new Bot(process.env.BOT_TOKEN as string, {
			telegram: {
				apiRoot: server.config.apiURL
			}
		})

		browser = await startBrowser();
		const investingScrapper = new InvestingScrapper(browser);

		bot.applyBotSettings(investingScrapper);

		bot.launch();
	})

	afterAll( (done) => {
		browser.close().then( () => {
			server.stop().then( () => {
				done();
			})
		});
	})

	it("should receive USD prices in BRL", (done) => {
		const message = client.makeCommand("/price");

		client.sendCommand(message).then( (stt) => {
			console.log(stt);
			client.getUpdates().then( (updates) => {
				console.log("Got updates");
				console.log(updates.result[0]);

				expect(updates.result[0].message.text).not.toEqual(Bot.DEFAULT_ERROR_MESSAGE);

				done();
			}).catch( (e) => {
				console.error(e);
			})

		}).catch( (e) => {
			console.error(e);
		})
	})

})
