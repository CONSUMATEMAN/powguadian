import { Telegraf } from "telegraf";

import { config } from "./config/env";

import {
  extractAddresses,
  scanContract,
  ScanResult,
} from "./services/scanner";

import {
  answerCommunityMessage,
  isCommunityRelevant,
} from "./services/moderator";

const bot =
  new Telegraf(
    config.telegramBotToken
  );

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const shortenAddress = (
  address: string
): string => {
  if (
    !address ||
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
    return "—";
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
    return "—";
  }

  if (value === 0) {
    return "$0";
  }

  if (
    Math.abs(value) < 0.000001
  ) {
    return `$${value.toExponential(
      4
    )}`;
  }

  if (
    Math.abs(value) < 0.01
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
    return "—";
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
    return "—";
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
    return "—";
  }

  if (
    remainingDays <= 0
  ) {
    return "Expired";
  }

  if (
    remainingDays < 1
  ) {
    return `${Math.round(
      remainingDays * 24
    )}h`;
  }

  return `${remainingDays.toFixed(
    1
  )}d`;
};

const statusText = (
  value:
    | boolean
    | null
    | undefined,
  positive = "Yes",
  negative = "No"
): string => {
  if (value === true) {
    return positive;
  }

  if (value === false) {
    return negative;
  }

  return "Unknown";
};

/* -------------------------------------------------------------------------- */
/* SECURITY SUMMARY                                                           */
/* -------------------------------------------------------------------------- */

const formatSecurity = (
  result: ScanResult
): string => {
  const security =
    result.security;

  if (!security) {
    return (
      `Security\n` +
      `Unavailable`
    );
  }

  const ownerText =
    security.ownerRenounced ===
    true
      ? "Renounced"
      : security.owner
        ? "Active"
        : "Unknown";

  const honeypot =
    security.isHoneypot === null ||
    security.isHoneypot ===
      undefined
      ? "Unknown"
      : security.isHoneypot
        ? "Possible"
        : "No indication";

  const openSource =
    security.isOpenSource ===
      null ||
    security.isOpenSource ===
      undefined
      ? "Unknown"
      : security.isOpenSource
        ? "Yes"
        : "No";

  return (
    `Security\n` +
    `Risk: ${riskEmoji(
      security.riskLevel
    )} ${
      security.riskLevel ??
      "UNKNOWN"
    }\n` +
    `Owner: ${ownerText}\n` +
    `Mint: ${statusText(
      security.canMint,
      "Detected",
      "No"
    )}\n` +
    `Burn: ${statusText(
      security.canBurn,
      "Detected",
      "No"
    )}\n` +
    `Blacklist: ${statusText(
      security.hasBlacklistFunction,
      "Detected",
      "No"
    )}\n` +
    `Trading control: ${statusText(
      security.hasTradingControl,
      "Detected",
      "No"
    )}\n` +
    `Tax code: ${statusText(
      security.hasTaxFunctions,
      "Detected",
      "No"
    )}\n` +
    `Proxy: ${
      security.isProxy
        ? "Yes"
        : "No"
    }\n` +
    `Honeypot: ${honeypot}\n` +
    `Open source: ${openSource}\n` +
    `Buy tax: ${
      security.buyTax !==
        null &&
      security.buyTax !==
        undefined
        ? `${security.buyTax}%`
        : "—"
    }\n` +
    `Sell tax: ${
      security.sellTax !==
        null &&
      security.sellTax !==
        undefined
        ? `${security.sellTax}%`
        : "—"
    }`
  );
};

/* -------------------------------------------------------------------------- */
/* TOKEN FORMATTER                                                            */
/* -------------------------------------------------------------------------- */

const formatScanResult = (
  result: ScanResult
): string => {
  if (!result.isContract) {
    return (
      `🐾 POWGUADIAN\n\n` +
      `No contract found.\n\n` +
      `Address\n` +
      `${result.address}`
    );
  }

  if (
    result.type === "pair"
  ) {
    return (
      `🐾 POWGUADIAN\n` +
      `Liquidity Pair\n\n` +
      `Pair: ${shortenAddress(
        result.address
      )}\n` +
      `Token 0: ${
        result.token0 ?? "—"
      }\n` +
      `Token 1: ${
        result.token1 ?? "—"
      }\n` +
      `Reserve 0: ${formatNumber(
        result.reserve0
      )}\n` +
      `Reserve 1: ${formatNumber(
        result.reserve1
      )}`
    );
  }

  if (
    result.type !== "token"
  ) {
    return (
      `🐾 POWGUADIAN\n\n` +
      `Smart Contract\n\n` +
      `Address\n${result.address}`
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
    `🐾 POWGUADIAN\n` +
    `${
      result.name ??
      "Unknown Token"
    } ` +
    `• ${
      result.symbol ??
      "TOKEN"
    }\n\n`;

  /* TOKEN */

  response +=
    `Token\n` +
    `Name: ${
      result.name ?? "—"
    }\n` +
    `Symbol: ${
      result.symbol ?? "—"
    }\n` +
    `CA: ${shortenAddress(
      result.address
    )}\n\n`;

  /* RISK */

  response +=
    `Risk: ${riskEmoji(
      risk
    )} ${risk}\n\n`;

  /* MARKET */

  response +=
    `Market\n` +
    `Price: ${formatMoney(
      market?.priceUsd
    )}\n` +
    `Market cap: ${formatMoney(
      market?.marketCap
    )}\n` +
    `Liquidity: ${formatMoney(
      market?.liquidityUsd
    )}\n` +
    `24h volume: ${formatMoney(
      market?.volume24h
    )}\n` +
    `Buys / Sells: ${
      formatNumber(
        market?.buys24h
      )
    } / ${
      formatNumber(
        market?.sells24h
      )
    }\n\n`;

  /* LIQUIDITY */

  const lpStatus =
    liquidity?.status ??
    "UNKNOWN";

  response +=
    `Liquidity\n` +
    `DEX: ${
      market?.dex ?? "—"
    }\n` +
    `Pair: ${
      market?.pairLabel ?? "—"
    }\n` +
    `LP status: ${lpStatus}\n` +
    `LP burned: ${
      liquidity?.lpBurned
        ? "Yes"
        : liquidity?.lpBurnPercent !==
              null &&
            liquidity?.lpBurnPercent !==
              undefined
          ? `No (${liquidity.lpBurnPercent.toFixed(
              2
            )}%)`
          : "Unknown"
    }\n` +
    `Lock: ${
      liquidity?.lockedUntil
        ? formatDate(
            liquidity.lockedUntil
          )
        : "—"
    }\n` +
    `Remaining: ${formatRemaining(
      liquidity?.remainingDays
    )}\n\n`;

  /* HOLDERS */

  response +=
    `Holders\n` +
    `Total: ${formatNumber(
      holders?.holders
    )}\n` +
    `Top 1: ${formatPercent(
      holders?.top1
    )}\n` +
    `Top 5: ${formatPercent(
      holders?.top5
    )}\n` +
    `Top 10: ${formatPercent(
      holders?.top10
    )}\n` +
    `Burned: ${formatPercent(
      holders?.burnedPercent
    )}\n` +
    `Owner: ${formatPercent(
      holders?.ownerHoldingsPercent
    )}\n\n`;

  /* TRADING */

  response +=
    `Trading\n` +
    `Buy tax: ${
      security?.buyTax !==
          null &&
      security?.buyTax !==
          undefined
        ? `${security.buyTax}%`
        : "—"
    }\n` +
    `Sell tax: ${
      security?.sellTax !==
          null &&
      security?.sellTax !==
          undefined
        ? `${security.sellTax}%`
        : "—"
    }\n` +
    `Transfer tax: ${
      security?.transferTax !==
          null &&
      security?.transferTax !==
          undefined
        ? `${security.transferTax}%`
        : "—"
    }\n` +
    `Max TX: ${
      security?.maxTx ??
      "—"
    }\n` +
    `Max wallet: ${
      security?.maxWallet ??
      "—"
    }\n\n`;

  /* SECURITY */

  response +=
    `${formatSecurity(
      result
    )}\n\n`;

  /* PROJECT */

  response +=
    `Project\n` +
    `Telegram: ${
      market?.telegram ?? "—"
    }\n` +
    `Website: ${
      market?.website ?? "—"
    }\n` +
    `X: ${
      market?.twitter ?? "—"
    }\n\n`;

  /* LINKS */

  response +=
    `Links\n` +
    `BscScan: https://bscscan.com/address/${result.address}\n`;

  if (
    market?.pairAddress
  ) {
    response +=
      `DexScreener: https://dexscreener.com/bsc/${market.pairAddress}\n`;
  }

  response +=
    `PancakeSwap: https://pancakeswap.finance/swap?outputCurrency=${result.address}\n\n`;

  /* SMART SUMMARY */

  const observations: string[] =
    [];

  if (
    security?.ownerRenounced
  ) {
    observations.push(
      "Ownership is renounced."
    );
  }

  if (
    security?.canMint === true
  ) {
    observations.push(
      "Mint capability detected."
    );
  }

  if (
    security?.hasBlacklistFunction ===
    true
  ) {
    observations.push(
      "Blacklist functionality detected."
    );
  }

  if (
    security?.hasTradingControl ===
    true
  ) {
    observations.push(
      "Trading-control functionality detected."
    );
  }

  if (
    security?.hasTaxFunctions ===
    true
  ) {
    observations.push(
      "Tax or fee functionality detected."
    );
  }

  if (
    liquidity?.status ===
    "BURNED"
  ) {
    observations.push(
      "LP tokens appear to be burned."
    );
  }

  if (
    liquidity?.status ===
    "EXPIRED"
  ) {
    observations.push(
      "Liquidity lock appears expired."
    );
  }

  if (
    observations.length > 0
  ) {
    response +=
      `Analysis\n`;

    for (
      const observation of observations
    ) {
      response +=
        `• ${observation}\n`;
    }

    response +=
      `\n`;
  }

  response +=
    `POWGUADIAN automated analysis. DYOR.`;

  return response;
};

/* -------------------------------------------------------------------------- */
/* SCANNING                                                                   */
/* -------------------------------------------------------------------------- */

const scanAddresses =
  async (
    ctx: any,
    addresses: string[]
  ): Promise<void> => {
    if (
      addresses.length === 0
    ) {
      await ctx.reply(
        `🐾 POWGUADIAN\n\n` +
        `I couldn't find a BSC contract address.\n\n` +
        `Send a token CA, pair address, ` +
        `or a BSC token link.`
      );

      return;
    }

    await ctx.reply(
      `🔎 POWGUADIAN is analyzing...\n\n` +
      `Market • Liquidity • Holders • Security`
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
          )
        );
      } catch (error) {
        console.error(
          `Failed to scan ${address}:`,
          error
        );

        await ctx.reply(
          `🐾 POWGUADIAN\n\n` +
          `Scan failed.\n\n` +
          `Address: ${shortenAddress(
            address
          )}\n\n` +
          `Please try again.`
        );
      }
    }
  };

/* -------------------------------------------------------------------------- */
/* COMMANDS                                                                   */
/* -------------------------------------------------------------------------- */

bot.start(
  async (ctx) => {
    await ctx.reply(
      `🐾 POWGUADIAN\n\n` +
      `Your BSC token intelligence guardian.\n\n` +
      `Send me a token contract address ` +
      `or token link and I'll analyze it.\n\n` +
      `Use /help for commands.`
    );
  }
);

bot.help(
  async (ctx) => {
    await ctx.reply(
      `🐾 POWGUADIAN\n\n` +
      `Commands\n\n` +
      `/start — Start the bot\n` +
      `/help — Show commands\n` +
      `/scan — Scan a token\n\n` +
      `Automatic scanning\n\n` +
      `Send a:\n` +
      `• Token contract\n` +
      `• Pair address\n` +
      `• PancakeSwap link\n` +
      `• BscScan link\n` +
      `• DexScreener link\n\n` +
      `Community moderator\n\n` +
      `POWGUADIAN can also answer ` +
      `community and crypto questions ` +
      `when appropriate.`
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

/* -------------------------------------------------------------------------- */
/* NEW MEMBER WELCOME                                                         */
/* -------------------------------------------------------------------------- */

bot.on(
  "new_chat_members",
  async (ctx) => {
    try {
      const members =
        ctx.message
          .new_chat_members;

      for (
        const member of members
      ) {
        const firstName =
          member.first_name ||
          "friend";

        const username =
          member.username
            ? `@${member.username}`
            : firstName;

        await ctx.reply(
          `Welcome ${username} 👋🐾\n\n` +
          `Glad to have you with the POW community.\n` +
          `Feel free to ask questions and join the conversation.`
        );
      }
    } catch (error) {
      console.error(
        "Welcome message error:",
        error
      );
    }
  }
);

/* -------------------------------------------------------------------------- */
/* COMMUNITY AI MODERATOR + AUTOMATIC SCANNER                                */
/* -------------------------------------------------------------------------- */

bot.on(
  "text",
  async (ctx) => {
    const text =
      ctx.message.text.trim();

    if (!text) {
      return;
    }

    /*
     * Commands are handled separately.
     */
    if (
      text.startsWith("/")
    ) {
      return;
    }

    /*
     * Contract addresses always go directly
     * to the scanner.
     *
     * This preserves the existing automatic
     * scanning behavior.
     */
    const addresses =
      extractAddresses(
        text
      );

    if (
      addresses.length > 0
    ) {
      await scanAddresses(
        ctx,
        addresses
      );

      return;
    }

    /*
     * The community intelligence layer decides
     * whether the message deserves an answer.
     *
     * Ordinary messages that don't need moderation
     * are ignored.
     */
    if (
      !isCommunityRelevant(
        text
      )
    ) {
      return;
    }

    try {
      await ctx.sendChatAction(
        "typing"
      );

      const answer =
        await answerCommunityMessage(
          text
        );

      /*
       * The AI can deliberately decide
       * that no response is necessary.
       */
      if (
        !answer ||
        answer === "[IGNORE]"
      ) {
        return;
      }

      await ctx.reply(
        answer
      );
    } catch (error) {
      console.error(
        "POW community moderator error:",
        error
      );
    }
  }
);

/* -------------------------------------------------------------------------- */
/* ERROR HANDLING                                                             */
/* -------------------------------------------------------------------------- */

bot.catch(
  (error) => {
    console.error(
      "POWGUADIAN BOT ERROR:",
      error
    );
  }
);

/* -------------------------------------------------------------------------- */
/* START                                                                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* GRACEFUL SHUTDOWN                                                          */
/* -------------------------------------------------------------------------- */

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