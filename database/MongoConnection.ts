import mongoose, {ConnectOptions} from "mongoose";

export default class MongoConnection{
	private static instance: mongoose.Connection;

	private constructor(){
	}

	static getConnection(): mongoose.Connection{
		if(this.instance === ( null || undefined )){
			if( process.env.MONGODB_URI ){
				const connectionOptions: ConnectOptions = {
					useNewUrlParser: true,
					useUnifiedTopology: true
				} as ConnectOptions;

				mongoose.connect(process.env.MONGODB_URI, connectionOptions);

				mongoose.connection.on( "error", (error) => {
					console.error(error);
				})

				this.instance = mongoose.connection;

			} else {
				throw new Error("Missing environment variable $MONGODB_URI.");
			}
		}

		return this.instance;
	}

}
