import "dotenv/config";

const requiredEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const config = {
  telegramBotToken: requiredEnv("TELEGRAM_BOT_TOKEN"),
  bscRpcUrl:
    process.env.BSC_RPC_URL ||
    "https://bsc-dataseed.binance.org/",
  nodeEnv: process.env.NODE_ENV || "development",
};