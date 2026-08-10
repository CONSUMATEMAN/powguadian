import { Telegraf } from "telegraf";
import { config } from "./config/env";
import {
  extractAddresses,
  scanContract,
  ScanResult,
} from "./services/scanner";

const bot =
  new Telegraf(
    config.telegramBotToken
  );

const line =
  "━━━━━━━━━━━━━━━━━━━━━━";

const shortenAddress = (
  address: string
): string => {
  if (
    address.length < 12
  ) {
    return address;
  }

  return `${address.slice(
    0,
    6
  )}...${address.slice(-4)}`;
};

const formatNumber = (
  value?: string | number | null
): string => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "❓";
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return String(value);
  }

  return number.toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 4,
    }
  );
};

const formatMoney = (
  value?: number | null
): string => {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value)
  ) {
    return "❓";
  }

  if (
    value < 0.000001
  ) {
    return `$${value.toExponential(
      4
    )}`;
  }

  if (
    value < 0.01
  ) {
    return `$${value.toFixed(
      8
    )}`;
  }

  return `$${value.toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 2,
    }
  )}`;
};

const formatPercent = (
  value?: number | null
): string => {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value)
  ) {
    return "❓";
  }

  return `${value.toFixed(
    2
  )}%`;
};

const riskEmoji = (
  risk?: string
): string => {
  switch (risk) {
    case "LOW":
      return "🟢";

    case "MEDIUM":
      return "🟡";

    case "HIGH":
      return "🔴";

    default:
      return "⚪";
  }
};

const formatDate = (
  date?: string | null
): string => {
  if (!date) {
    return "❓";
  }

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return date;
  }

  return parsed.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
};

const formatRemaining = (
  remainingDays?: number | null
): string => {
  if (
    remainingDays ===
      undefined ||
    remainingDays === null ||
    !Number.isFinite(
      remainingDays
    )
  ) {
    return "❓";
  }

  if (
    remainingDays <= 0
  ) {
    return "EXPIRED";
  }

  if (
    remainingDays < 1
  ) {
    return `${Math.round(
      remainingDays * 24
    )} hours`;
  }

  return `${remainingDays.toFixed(
    1
  )} days`;
};

const formatSecurity = (
  result: ScanResult
): string => {
  const security =
    result.security;

  if (!security) {
    return (
      `${line}\n` +
      `🛡️ SECURITY\n` +
      `${line}\n\n` +
      `❓ Security analysis unavailable\n\n`
    );
  }

  const ownerText =
    security.ownerRenounced ===
    true
      ? "RENOUNCED"
      : security.owner
        ? "ACTIVE"
        : "UNKNOWN";

  const mintText =
    security.canMint ===
    true
      ? "⚠️ Detected"
      : security.canMint ===
          false
        ? "❌ No"
        : "❓ Unknown";

  const burnText =
    security.canBurn ===
    true
      ? "✅ Detected"
      : security.canBurn ===
          false
        ? "❌ Not detected"
        : "❓ Unknown";

  const blacklistText =
    security.hasBlacklistFunction ===
    true
      ? "⚠️ Detected"
      : security.hasBlacklistFunction ===
          false
        ? "❌ No"
        : "❓ Unknown";

  const tradingText =
    security.hasTradingControl ===
    true
      ? "⚠️ Detected"
      : security.hasTradingControl ===
          false
        ? "❌ No"
        : "❓ Unknown";

  const proxyText =
    security.isProxy
      ? "⚠️ Detected"
      : "❌ No";

  const honeypotText =
    security.isHoneypot ===
    null
      ? "❓ Unknown"
      : security.isHoneypot
        ? "🔴 Possible"
        : "🟢 No indication";

  const sourceText =
    security.isOpenSource ===
    null
      ? "❓ Unknown"
      : security.isOpenSource
        ? "✅ Yes"
        : "❌ No";

  return (
    `${line}\n` +
    `🛡️ SECURITY\n` +
    `${line}\n\n` +

    `Risk: ${riskEmoji(
      security.riskLevel
    )} ${
      security.riskLevel
    }\n\n` +

    `Minting: ${mintText}\n` +
    `Burn: ${burnText}\n` +
    `Blacklist: ${blacklistText}\n` +
    `Trading Control: ${tradingText}\n` +
    `Tax/Fee Code: ${
      security.hasTaxFunctions
        ? "⚠️ Detected"
        : security.hasTaxFunctions ===
            false
          ? "❌ Not detected"
          : "❓ Unknown"
    }\n` +
    `Proxy: ${proxyText}\n` +
    `Honeypot: ${honeypotText}\n` +
    `Open Source: ${sourceText}\n\n` +

    `👤 Owner: ${ownerText}\n` +

    `${
      security.implementation
        ? `Implementation: ${shortenAddress(
            security.implementation
          )}\n`
        : ""
    }` +

    `Buy Tax: ${
      security.buyTax !==
      null
        ? `${security.buyTax}%`
        : "❓"
    }\n` +

    `Sell Tax: ${
      security.sellTax !==
      null
        ? `${security.sellTax}%`
        : "❓"
    }\n\n`
  );
};

const formatScanResult = (
  result: ScanResult
): string => {
  if (
    !result.isContract
  ) {
    return (
      `${line}\n` +
      `🐾 POWGUADIAN\n` +
      `${line}\n\n` +
      `❌ No contract found.\n\n` +
      `📄 Address:\n` +
      `${result.address}`
    );
  }

  if (
    result.type ===
    "pair"
  ) {
    return (
      `${line}\n` +
      `🐾 POWGUADIAN\n` +
      `LIQUIDITY PAIR ANALYSIS\n` +
      `${line}\n\n` +

      `📄 Pair:\n` +
      `${result.address}\n\n` +

      `🪙 Token 0:\n` +
      `${result.token0 ?? "❓"}\n\n` +

      `🪙 Token 1:\n` +
      `${result.token1 ?? "❓"}\n\n` +

      `💧 Reserve 0: ${
        formatNumber(
          result.reserve0
        )
      }\n` +

      `💧 Reserve 1: ${
        formatNumber(
          result.reserve1
        )
      }\n`
    );
  }

  if (
    result.type !==
    "token"
  ) {
    return (
      `${line}\n` +
      `🐾 POWGUADIAN\n` +
      `${line}\n\n` +
      `📜 Smart Contract\n\n` +
      `📄 Address:\n` +
      `${result.address}\n`
    );
  }

  const security =
    result.security;

  const market =
    result.market;

  const liquidity =
    result.liquidity;

  const holders =
    result.holders;

  const risk =
    security?.riskLevel ??
    "UNKNOWN";

  let response =
    `${line}\n` +
    `🐾 POWGUADIAN\n` +
    `${result.symbol ?? "TOKEN"} • BSC TOKEN ANALYSIS\n` +
    `${line}\n\n`;

  /*
   * RISK
   */

  response +=
    `${riskEmoji(
      risk
    )} RISK: ${risk}\n\n`;

  /*
   * TOKEN
   */

  response +=
    `🔹 TOKEN\n` +
    `Name: ${
      result.name ??
      "❓"
    }\n` +
    `Symbol: ${
      result.symbol ??
      "❓"
    }\n` +
    `CA: ${
      shortenAddress(
        result.address
      )
    }\n\n`;

  /*
   * MARKET
   */

  response +=
    `💰 MARKET\n` +
    `Price: ${
      formatMoney(
        market?.priceUsd
      )
    }\n` +
    `Market Cap: ${
      formatMoney(
        market?.marketCap
      )
    }\n` +
    `Liquidity: ${
      formatMoney(
        market?.liquidityUsd
      )
    }\n` +
    `LP: ${
      market?.lpBnb !==
      null &&
      market?.lpBnb !==
        undefined
        ? `${market.lpBnb.toFixed(
            4
          )} BNB`
        : "❓"
    }\n` +
    `LP Ratio: ${
      formatPercent(
        market?.lpRatio
      )
    }\n` +
    `24h Volume: ${
      formatMoney(
        market?.volume24h
      )
    }\n` +
    `24h Buys: ${
      formatNumber(
        market?.buys24h
      )
    }\n` +
    `24h Sells: ${
      formatNumber(
        market?.sells24h
      )
    }\n` +
    `Unique Traders: ${
      formatNumber(
        market?.uniqueTraders
      )
    }\n\n`;

  /*
   * LIQUIDITY
   */

  response +=
    `💧 LIQUIDITY\n` +
    `DEX: ${
      market?.dex ??
      "❓"
    }\n` +
    `Pair: ${
      market?.pairLabel ??
      "❓"
    }\n` +
    `Pair Address: ${
      market?.pairAddress
        ? shortenAddress(
            market.pairAddress
          )
        : "❓"
    }\n\n`;

  /*
   * LP STATUS
   */

  const lpStatus =
    liquidity?.status ??
    "UNKNOWN";

  const lpStatusEmoji =
    lpStatus === "BURNED"
      ? "🔥"
      : lpStatus ===
          "LOCKED"
        ? "🔒"
        : lpStatus ===
            "EXPIRED"
          ? "⚠️"
          : "❓";

  response +=
    `🔒 LP STATUS\n` +
    `Status: ${
      lpStatusEmoji
    } ${lpStatus}\n` +
    `Locked Until: ${
      formatDate(
        liquidity?.lockedUntil
      )
    }\n` +
    `Duration: ${
      liquidity?.durationDays !==
        null &&
      liquidity?.durationDays !==
        undefined
        ? `${liquidity.durationDays} days`
        : "❓"
    }\n` +
    `Remaining: ${
      formatRemaining(
        liquidity?.remainingDays
      )
    }\n` +
    `LP Burned: ${
      liquidity?.lpBurned
        ? "🔥 Yes"
        : liquidity?.lpBurnPercent !==
              null &&
            liquidity?.lpBurnPercent !==
              undefined
          ? `❌ No (${liquidity.lpBurnPercent.toFixed(
              2
            )}%)`
          : "❓ Unknown"
    }\n\n`;

  /*
   * HOLDERS
   */

  response +=
    `👥 HOLDERS\n` +
    `Holders: ${
      formatNumber(
        holders?.holders
      )
    }\n` +
    `Top 1: ${
      formatPercent(
        holders?.top1
      )
    }\n` +
    `Top 5: ${
      formatPercent(
        holders?.top5
      )
    }\n` +
    `Top 10: ${
      formatPercent(
        holders?.top10
      )
    }\n` +
    `Top 20: ${
      formatPercent(
        holders?.top20
      )
    }\n\n` +

    `🔥 Burned: ${
      formatPercent(
        holders?.burnedPercent
      )
    }\n` +

    `👤 Owner Holdings: ${
      formatPercent(
        holders?.ownerHoldingsPercent
      )
    }\n\n`;

  /*
   * TRADING
   */

  response +=
    `⚙️ TRADING\n` +
    `Buy Tax: ${
      security?.buyTax !==
      null &&
      security?.buyTax !==
        undefined
        ? `${security.buyTax}%`
        : "❓"
    }\n` +
    `Sell Tax: ${
      security?.sellTax !==
      null &&
      security?.sellTax !==
        undefined
        ? `${security.sellTax}%`
        : "❓"
    }\n` +
    `Transfer Tax: ${
      security?.transferTax !==
      null &&
      security?.transferTax !==
        undefined
        ? `${security.transferTax}%`
        : "❓"
    }\n` +
    `Max TX: ${
      security?.maxTx ??
      "❓"
    }\n` +
    `Max Wallet: ${
      security?.maxWallet ??
      "❓"
    }\n\n`;

  /*
   * SECURITY
   */

  response +=
    formatSecurity(
      result
    );

  /*
   * PROJECT
   */

  response +=
    `🌐 PROJECT\n` +
    `Telegram: ${
      market?.telegram ??
      "❓"
    }\n` +
    `Website: ${
      market?.website ??
      "❓"
    }\n` +
    `X: ${
      market?.twitter ??
      "❓"
    }\n\n`;

  /*
   * LINKS
   */

  response +=
    `🔗 LINKS\n` +
    `BscScan: https://bscscan.com/address/${result.address}\n` +
    `DexScreener: ${
      market?.pairAddress
        ? `https://dexscreener.com/bsc/${market.pairAddress}`
        : "❓"
    }\n` +
    `PancakeSwap: ${
      market?.pairAddress
        ? `https://pancakeswap.finance/swap?outputCurrency=${result.address}`
        : "❓"
    }\n\n`;

  /*
   * ANALYSIS
   */

  response +=
    `⚠️ ANALYSIS\n`;

  if (
    security?.ownerRenounced
  ) {
    response +=
      `Ownership is renounced.\n`;
  }

  if (
    security?.canMint ===
    false
  ) {
    response +=
      `No mint capability detected.\n`;
  }

  if (
    security?.hasBlacklistFunction ===
    false
  ) {
    response +=
      `No blacklist capability detected.\n`;
  }

  if (
    security?.hasTradingControl ===
    true
  ) {
    response +=
      `Trading-control code detected.\n`;
  }

  if (
    security?.hasTaxFunctions ===
    true
  ) {
    response +=
      `Tax/fee functionality detected.\n`;
  }

  if (
    liquidity?.status ===
    "BURNED"
  ) {
    response +=
      `LP tokens appear to be burned.\n`;
  }

  if (
    liquidity?.status ===
    "EXPIRED"
  ) {
    response +=
      `Liquidity lock appears to be expired.\n`;
  }

  if (
    !security
  ) {
    response +=
      `Security analysis unavailable.\n`;
  }

  response +=
    `\nℹ️ Automated analysis only. DYOR.\n` +
    `${line}`;

  return response;
};

const scanAddresses = async (
  ctx: any,
  addresses: string[]
): Promise<void> => {
  if (
    addresses.length === 0
  ) {
    await ctx.reply(
      `🐾 POWGUADIAN\n\n` +
      `I couldn't find a BSC contract address.\n\n` +
      `Paste a token CA, pair address, or a link containing one.`
    );

    return;
  }

  await ctx.reply(
    `🔎 POWGUADIAN is analyzing...\n\n` +
    `Found ${addresses.length} address${
      addresses.length ===
      1
        ? ""
        : "es"
    }.\n\n` +
    `Market data → Liquidity → Holders → Security\n\n` +
    `Please wait.`
  );

  for (
    const address of addresses
  ) {
    try {
      const result =
        await scanContract(
          address
        );

      await ctx.reply(
        formatScanResult(
          result
        ),
        {
          disable_web_page_preview:
            true,
        }
      );
    } catch (error) {
      console.error(
        `Failed to scan ${address}:`,
        error
      );

      await ctx.reply(
        `❌ Scan failed\n\n` +
        `Address:\n${address}\n\n` +
        `Please try again.`
      );
    }
  }
};

bot.start(
  async (ctx) => {
    await ctx.reply(
      `🐾 POWGUADIAN is online.\n\n` +
      `Your BSC token intelligence guardian is ready.\n\n` +
      `Paste any BSC contract address or token link and I will analyze it.\n\n` +
      `/help`
    );
  }
);

bot.help(
  async (ctx) => {
    await ctx.reply(
      `🐾 POWGUADIAN COMMANDS\n\n` +
      `/start — Start POWGUADIAN\n` +
      `/help — Show help\n` +
      `/scan — Scan a contract\n\n` +
      `🤖 AUTOMATIC SCANNER\n\n` +
      `Paste:\n` +
      `• Token contract\n` +
      `• Pair address\n` +
      `• PancakeSwap link\n` +
      `• BscScan link\n` +
      `• DexScreener link\n\n` +
      `POWGUADIAN will detect the address automatically.`
    );
  }
);

bot.command(
  "scan",
  async (ctx) => {
    const text =
      ctx.message.text.trim();

    const addresses =
      extractAddresses(
        text
      );

    await scanAddresses(
      ctx,
      addresses
    );
  }
);

bot.on(
  "text",
  async (ctx) => {
    const text =
      ctx.message.text.trim();

    if (
      text.startsWith("/")
    ) {
      return;
    }

    const addresses =
      extractAddresses(
        text
      );

    if (
      addresses.length === 0
    ) {
      return;
    }

    await scanAddresses(
      ctx,
      addresses
    );
  }
);

bot.catch(
  (error) => {
    console.error(
      "POWGUADIAN BOT ERROR:",
      error
    );
  }
);

const startBot =
  async (): Promise<void> => {
    console.log(
      "🐾 POWGUADIAN is starting..."
    );

    console.log(
      "🔎 Testing Telegram connection..."
    );

    const botInfo =
      await bot.telegram.getMe();

    console.log(
      "✅ Telegram connection successful."
    );

    console.log(
      `🤖 Bot: @${botInfo.username}`
    );

    await bot.launch();

    console.log(
      "🐾 POWGUADIAN is online and listening."
    );
  };

startBot().catch(
  (error) => {
    console.error(
      "Failed to start POWGUADIAN:",
      error
    );

    process.exit(1);
  }
);

process.once(
  "SIGINT",
  () => {
    console.log(
      "🛑 POWGUADIAN stopping..."
    );

    bot.stop(
      "SIGINT"
    );
  }
);

process.once(
  "SIGTERM",
  () => {
    console.log(
      "🛑 POWGUADIAN stopping..."
    );

    bot.stop(
      "SIGTERM"
    );
  }
);