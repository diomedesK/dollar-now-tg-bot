import * as mongoose from "mongoose"; 
import { Intervals, currencyISOs } from "../../types"

const UserSchema = new mongoose.Schema(
	{
		name: String,
		username: String,
		telegramID: {
			type: String,
			unique: true,
			required: true,
			index: true
		},
		reminder: {
			interval: {
				type: String,
				enum: Object.values(Intervals),
				required: true
			},
			currency: {
				type: String,
				enum: Object.values(currencyISOs),
				required: true
			},
			latestRemind: {
				type: mongoose.Schema.Types.Date
			}
		}
	},
	{
		query: {
			byIntervalType( interval: Intervals ){
				return this.where({ "reminder.interval": interval });
			}
		}
	}
)


const User = mongoose.model("User", UserSchema);

export default User;
