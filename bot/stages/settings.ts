import { debug } from "debug";

import { Scenes, Markup } from "telegraf";
import { MyWizardContext, currencyISOs, Intervals, userSettings } from "../../types";
import User from "../../database/model/User";

const log = debug("bot:settings-scene");


interface MyStateStructure {
	user_info : any,
	settings: userSettings
};

const stepWrapper = {
	"entry": ( async (ctx: MyWizardContext) => {
		log("Inside entry");

		( ctx.scene.state as MyStateStructure ).user_info = ctx.message?.from;
		( ctx.scene.state as MyStateStructure ).settings = {};

		ctx.reply(
			"What is your target currency",
			Markup.inlineKeyboard([  Object.keys(currencyISOs).map( (ISO) => ( Markup.button.callback(ISO, `!currency=${ISO}`) ) ) ])
		);
		ctx.wizard.next();
	}),

	"subscribe": ( async (ctx: MyWizardContext) => {
		log("Inside subscribe")

		ctx.reply("You want to receive updates", 
			Markup.inlineKeyboard( [ ...Object.values(Intervals) ].map( (e) => Markup.button.callback(e, `!interval=${e}`) ) )
		)
		ctx.wizard.next();
	}),

	"confirmation": (  async (ctx: MyWizardContext) => {
		log("Inside confirmation")

		ctx.reply("Apply settings?",
			Markup.inlineKeyboard([
				[ Markup.button.callback("Yes", "!confirm=yes"), Markup.button.callback("No", "!confirm=no") ]
			])
		)
		ctx.wizard.next();
	})
};

const settingsWizardScene = new Scenes.WizardScene<MyWizardContext>(
	"settings",
	...Object.values(stepWrapper)
);

settingsWizardScene.action(/^!currency=(\w+)$/, (ctx) => {
	log("Received '!currency' action");

	const ISO = ctx.match[1];

	( ctx.scene.state as MyStateStructure ).settings.currency =  ISO as currencyISOs;

	ctx.reply(`You choose ${ISO}`);

	ctx.wizard.selectStep(Object.keys(stepWrapper).indexOf("subscribe"));
	( ctx.wizard as any ).step(ctx);
});


settingsWizardScene.action(/^\!interval=(\w+)$/, async (ctx) => {
	log("Received '!interval' action");

	const option = ctx.match[1] as Intervals;

	if( [...Object.values(Intervals)].indexOf(option) > -1 ){
		( ctx.scene.state as MyStateStructure ).settings.interval = option;

		ctx.wizard.selectStep( Object.keys(stepWrapper).indexOf("confirmation") );
		(ctx.wizard as any).step(ctx);
	} else {
		throw new Error(`Received a value that is not in the target enum ${ctx.match[1]}`);
	}
});

settingsWizardScene.action(/^\!confirm=(\w+)$/, async (ctx) => {
	log("Received '!confirm' action");

	const option = ctx.match[1];

	if( option === "yes" ){
		const s = ctx.scene.state as MyStateStructure;
		
		const name = s.user_info.first_name;
		const telegramID = s.user_info.id;
		const username = s.user_info.username;

		const user = ({
			name,
			telegramID,
			username,
			reminder: {
				interval: s.settings.interval,
				currency: s.settings.currency
			}

		});

		log(`Saving settings for ${telegramID}`, s.settings);

		await User.findOneAndUpdate({telegramID}, user, {
			upsert: true,
			new: true
		}).catch( (err) => {
			console.error(err);
			throw(err);
		})

		ctx.session.user.settings = {...s.settings};

		log(`User settings persisted in DB and session`);

		ctx.reply("Goodbye!");
		ctx.scene.leave();

	} else {
		ctx.wizard.selectStep( Object.keys(stepWrapper).indexOf("entry") );
		(ctx.wizard as any).step(ctx);
	}

});



export default settingsWizardScene;
