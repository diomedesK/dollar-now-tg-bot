import puppeteer, { Browser } from "puppeteer";

export async function startBrowser() : Promise<Browser>{
	let browser: Browser;
	try {
		browser = await puppeteer.launch({
			headless: "new",
			args: ["--disable-setuid-sandbox"],
			ignoreHTTPSErrors: true
		})
	} catch (e) {
		throw(e);
	}

	return browser;
}
