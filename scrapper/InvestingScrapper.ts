import { Browser, Page, ElementHandle } from "puppeteer"; 

import debug from  "debug";
const log = debug("investing-scrapper:main")

import { IPriceChange, currencyISOs } from "../types";

type OptionalString = string | null | undefined;

enum allowedOperations {
	USDtoBRL = "USDtoBRL",
	USDtoEUR = "USDtoEUR"
};

interface ILink {
	TO: currencyISOs,
	page: Page | null,
	URL: string
};

export default class InvestingScrapper{

	constructor( browser: Browser ){
		this.browser = browser;
	};

	protected browser: Browser;

	private links: { [ K in allowedOperations ]: ILink } = {
		USDtoBRL: {
			TO: currencyISOs.BRL,
			page: null,
			URL: "https://investing.com/currencies/usd-brl"
		},
		USDtoEUR: {
			TO: currencyISOs.EUR,
			page: null,
			URL: "https://www.investing.com/currencies/usd-eur"
		}
	};

	public static Operations = allowedOperations;

	private async getPageFromLink( linkName: allowedOperations ): Promise<Page>{
		const link: ILink = this.links[linkName];

		log(`Creating new ${linkName} page`);
		let page: Page = await this.browser.newPage();

		log("Accessing page");
		await page.goto(link.URL, {timeout: 30000, waitUntil: "domcontentloaded"});
		log("Page accessed succesfully");

		return page;
	}

	async accessPageForLink( linkName: allowedOperations ): Promise<boolean>{
		return new Promise( (resolve, reject) => {
			this.getPageFromLink(linkName).then( (page) => {
				this.links[linkName].page = page;
				resolve(true)
			}).catch((reason) => {
				reject(reason);
			});
		});
	};

	async getPriceFromInvesting( operation: allowedOperations ): Promise<IPriceChange>{

		if(Object.keys(this.links).indexOf(operation) < 0){
			throw new Error("Received an invalid operation");
		};

		if(this.links[operation].page == null){
			this.links[operation].page = await this.getPageFromLink(operation);
		} else {
			log("Using cached page");
		};

		let targetPage: Page | null = this.links[operation].page;
		if(targetPage == null){
			throw new Error("Target page is null");
		}

		log("Waiting for price element");
		let priceDetails: ElementHandle | null = await targetPage.waitForSelector("[data-test='instrument-header-details']");

		log("Extracting price info");
		let result: IPriceChange = await targetPage.evaluate((priceDetails) => {

			let lastPrice = priceDetails?.querySelector("[data-test='instrument-price-last']")?.textContent?.replace(",", ".");
			let priceChange = priceDetails?.querySelector('[data-test="instrument-price-change"]')?.textContent?.replace(",", ".");
			let percentChange = priceDetails?.querySelector('[data-test="instrument-price-change-percent"]')
				?.textContent
				?.match(/\((.*)\)/)?.[1]
				?.replace(",", ".")?.replace("%", "");

			function parseObjectToNumbers(data: {[key: string] : OptionalString}): IPriceChange{
				const { lastPrice, priceChange, percentChange, ISO } = data;

				const parsedData = {
					lastPrice: lastPrice ? parseFloat(lastPrice) : null,
					priceChange: priceChange ? parseFloat(priceChange) : null,
					percentChange: percentChange ? parseFloat(percentChange) : null
				};

				return parsedData;
			};

			return parseObjectToNumbers({
				lastPrice,
				priceChange,
				percentChange
			});

		}, priceDetails);

		log("Returning scrape result");
		return {
			...result,
			ISO: this.links[operation].TO
		};

	};

	destroyPages(): void{
		Object.keys(this.links).forEach( (key) => {
			this.links[key as allowedOperations].page = null;
		});
	}

}
