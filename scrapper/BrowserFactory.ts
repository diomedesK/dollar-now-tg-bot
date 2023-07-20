import puppeteer, { Browser, PuppeteerLaunchOptions } from "puppeteer";
import debug from "debug";

const log = debug("browser-factory:main")

export async function startBrowser() : Promise<Browser>{
	let browser: Browser;
	try {
		const options: PuppeteerLaunchOptions = {
			headless: "new",
			args: ["--disable-setuid-sandbox"],
			ignoreHTTPSErrors: true
		};

		if( process.env.IS_DOCKER_CONTAINER === "true"){
			options.args?.push("--no-sandbox");
		}

		log("Launching puppeteer with the options", options);

		browser = await puppeteer.launch(options);
	} catch (e) {
		throw(e);
	}

	return browser;
}
