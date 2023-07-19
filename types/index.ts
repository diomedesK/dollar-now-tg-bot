import { Context, Scenes } from "telegraf";
import { Page } from "puppeteer";

export type NextFn = () => void | Promise<void>;

export enum Intervals {
	Hourly = "hourly",
	Daily = "daily",
	Weekly = "weekly"
};

export enum currencyISOs {
	BRL = "BRL",
	EUR = "EUR"
};

export interface userSettings {
	currency?: currencyISOs,
	interval?: Intervals
};

export interface IUserData{
	settings: userSettings
};

export interface IPriceChange{
	ISO?: currencyISOs,
	lastPrice: number | null,
	priceChange: number | null,
	percentChange: number | null
};


/* I had to dig into Telegraf's source code to understand what to put here */
interface MyWizardSessionData extends Scenes.WizardSessionData{
	// things that will last during a scene session (ctx.scene.session)
}

interface MyWizardSession extends Scenes.WizardSession<MyWizardSessionData>{
	// things that will last during a session (ctx.session)
	user: IUserData;
}

export interface MyWizardContext extends Context{
	session: MyWizardSession;
	scene: Scenes.SceneContextScene<MyWizardContext, MyWizardSessionData>;
	wizard: Scenes.WizardContextWizard<MyWizardContext>;
}
