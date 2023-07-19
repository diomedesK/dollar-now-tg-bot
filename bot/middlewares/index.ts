import { Context } from "telegraf";
import { NextFn } from "../../types"

const privateOnly = async<T extends Context>( ctx: T, next: NextFn )  => {
	if(ctx.chat?.type !== "private"){
		throw new Error("Private chat only");
	} else {
		await next();
	}
}

const groupOnly = async<T extends Context>( ctx: T, next: NextFn )  => {
	if (ctx.chat && ['supergroup', 'group'].includes(ctx.chat.type)) {
		await next();
	} else {
		throw new Error("Group/supergroup chat only");
	}
}

export {
	privateOnly,
	groupOnly
}
