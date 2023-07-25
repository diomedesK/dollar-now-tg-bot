# dollar-now-tg-bot
A Telegraf bot which retrieves the current USD price in relation to some specific currencies, and sends updates on it's value in a time based schedule.

Mainly developed as a personal project for learning how to use Telegraf.

Set the following environment variables in a .env file or pass them to your docker container:
``` bash
BOT_TOKEN="YOUR BOT_TOKEN"
MONGODB_URI="YOUR_MONGO_DB_URI"
```

The following variables are optional:
``` bash
DEBUG="telegraf:main bot:* investing-scrapper:main browser-factory:main" # default | adds debug info to the console
API_ROOT="http://localhost:8888"  # if set, uses it as the API root for the bot
```

Check [this link](https://core.telegram.org/bots/api) for more info on the API root.
