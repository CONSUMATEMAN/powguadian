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

  if (
    value === 0
  ) {
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
      maximumFractionDigits: 2,
    }
  );
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

const formatLaunchTime = (
  timestamp?: number | null
): string | null => {
  if (
    timestamp === null ||
    timestamp === undefined ||
    !Number.isFinite(timestamp)
  ) {
    return null;
  }

  try {
    const date =
      new Date(
        timestamp
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return date.toLocaleString(
      "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }
    ) + " UTC";
  } catch {
    return null;
  }
};

const formatSocials = (
  result: ScanResult
): string | null => {
  const socials =
    result.socials;

  if (!socials) {
    return null;
  }

  const found: string[] =
    [];

  if (
    socials.twitter
  ) {
    found.push("X");
  }

  if (
    socials.telegram
  ) {
    found.push("Telegram");
  }

  if (
    socials.website
  ) {
    found.push("Website");
  }

  if (
    socials.discord
  ) {
    found.push("Discord");
  }

  if (
    socials.github
  ) {
    found.push("GitHub");
  }

  if (
    socials.youtube
  ) {
    found.push("YouTube");
  }

  if (
    socials.instagram
  ) {
    found.push("Instagram");
  }

  if (
    socials.facebook
  ) {
    found.push("Facebook");
  }

  if (
    socials.tiktok
  ) {
    found.push("TikTok");
  }

  if (
    found.length === 0
  ) {
    return null;
  }

  return found.join(
    " • "
  );
};

/* -------------------------------------------------------------------------- */
/* SHORT SCAN FORMATTER                                                       */
/* -------------------------------------------------------------------------- */

const formatScanResult = (
  result: ScanResult
): string => {
  if (
    !result.isContract
  ) {
    return (
      `🐾 POWGUADIAN\n\n` +
      `No BSC contract found.\n\n` +
      `Address: ${result.address}`
    );
  }

  if (
    result.type === "pair"
  ) {
    return (
      `🐾 POWGUADIAN\n\n` +
      `Liquidity pair detected.\n\n` +
      `Pair: ${shortenAddress(
        result.address
      )}\n` +
      `Token 0: ${shortenAddress(
        result.token0 ?? "Unknown"
      )}\n` +
      `Token 1: ${shortenAddress(
        result.token1 ?? "Unknown"
      )}\n\n` +
      `Send the token CA for a full token scan.`
    );
  }

  if (
    result.type !== "token"
  ) {
    return (
      `🐾 POWGUADIAN\n\n` +
      `Smart contract detected.\n\n` +
      `Address: ${result.address}\n\n` +
      `This address could not be verified as an ERC20 token.`
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

  const name =
    result.name ??
    "Unknown Token";

  const symbol =
    result.symbol ??
    "TOKEN";

  let response =
    `🐾 POWGUADIAN\n\n` +
    `${name} • $${symbol}\n` +
    `CA: ${shortenAddress(
      result.address
    )}\n\n`;

  /* ------------------------------------------------------------------------ */
  /* SECURITY                                                                 */
  /* ------------------------------------------------------------------------ */

  response +=
    `Security: ${riskEmoji(
      risk
    )} ${risk}\n`;

  /* ------------------------------------------------------------------------ */
  /* MARKET                                                                   */
  /* ------------------------------------------------------------------------ */

  if (
    market &&
    (
      market.priceUsd !== null ||
      market.marketCap !== null ||
      market.liquidityUsd !== null
    )
  ) {
    response +=
      `Price: ${formatMoney(
        market.priceUsd
      )}\n` +
      `Market Cap: ${formatMoney(
        market.marketCap
      )}\n` +
      `Liquidity: ${formatMoney(
        market.liquidityUsd
      )}\n`;

    if (
      market.volume24h !==
      null
    ) {
      response +=
        `24h Volume: ${formatMoney(
          market.volume24h
        )}\n`;
    }

    if (
      market.buys24h !== null ||
      market.sells24h !== null
    ) {
      response +=
        `Buys / Sells: ` +
        `${formatNumber(
          market.buys24h
        )} / ` +
        `${formatNumber(
          market.sells24h
        )}\n`;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* LP                                                                       */
  /* ------------------------------------------------------------------------ */

  if (
    liquidity
  ) {
    response +=
      `\nLP: `;

    switch (
      liquidity.status
    ) {
      case "BURNED":
        response +=
          "Burned";
        break;

      case "LOCKED":
        response +=
          "Locked";
        break;

      case "EXPIRED":
        response +=
          "Lock expired";
        break;

      default:
        response +=
          "Unknown";
        break;
    }

    if (
      liquidity.lpAmount !==
      null
    ) {
      response +=
        ` • ${formatNumber(
          liquidity.lpAmount
        )} LP`;
    }

    response +=
      `\n`;

    if (
      market
    ) {
      const tokenInPoolPercent =
        market.tokenInPoolPercent;

      const tokenReserve =
        market.tokenReserve;

      if (
        tokenInPoolPercent !==
        null
      ) {
        response +=
          `Pool: ${formatPercent(
            tokenInPoolPercent
          )} of supply`;

        if (
          tokenReserve !==
          null
        ) {
          response +=
            ` (${formatNumber(
              tokenReserve
            )} tokens)`;
        }

        response +=
          `\n`;
      }
    }

    if (
      liquidity.lpBurnPercent !==
        null &&
      liquidity.status !==
        "BURNED"
    ) {
      response +=
        `LP Burned: ${formatPercent(
          liquidity.lpBurnPercent
        )}\n`;
    }

    if (
      liquidity.status ===
        "LOCKED" &&
      liquidity.remainingDays !==
        null
    ) {
      response +=
        `Lock: ${formatNumber(
          liquidity.remainingDays
        )} days remaining\n`;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* HOLDERS                                                                  */
  /* ------------------------------------------------------------------------ */

  if (
    holders?.holders !==
      null &&
    holders?.holders !==
      undefined
  ) {
    response +=
      `Holders: ${formatNumber(
        holders.holders
      )}\n`;
  }

  if (
    holders?.topHolders &&
    holders.topHolders.length > 0
  ) {
    const top =
      holders.topHolders
        .slice(0, 3)
        .map(
          (
            holder,
            index
          ) =>
            `${index + 1}. ${shortenAddress(
              holder.address
            )} ${formatPercent(
              holder.percent
            )}`
        )
        .join(" • ");

    response +=
      `Top: ${top}\n`;
  }

  /* ------------------------------------------------------------------------ */
  /* TAX                                                                      */
  /* ------------------------------------------------------------------------ */

  if (
    security?.buyTax !==
      null ||
    security?.sellTax !==
      null
  ) {
    response +=
      `Tax: ` +
      `${
        security?.buyTax !==
          null &&
        security?.buyTax !==
          undefined
          ? `${security.buyTax}%`
          : "?"
      } buy / ` +
      `${
        security?.sellTax !==
          null &&
        security?.sellTax !==
          undefined
          ? `${security.sellTax}%`
          : "?"
      } sell\n`;
  }

  /* ------------------------------------------------------------------------ */
  /* LAUNCH                                                                   */
  /* ------------------------------------------------------------------------ */

  const launch =
    formatLaunchTime(
      result.launchTime
    );

  if (
    launch
  ) {
    response +=
      `Launched: ${launch}\n`;
  }

  /* ------------------------------------------------------------------------ */
  /* SECURITY FINDINGS                                                        */
  /* ------------------------------------------------------------------------ */

  const warnings: string[] =
    [];

  if (
    security?.canMint ===
    true
  ) {
    warnings.push(
      "Mint"
    );
  }

  if (
    security?.hasBlacklistFunction ===
    true
  ) {
    warnings.push(
      "Blacklist"
    );
  }

  if (
    security?.hasWhitelistFunction ===
    true
  ) {
    warnings.push(
      "Whitelist"
    );
  }

  if (
    security?.hasTradingControl ===
    true
  ) {
    warnings.push(
      "Trading control"
    );
  }

  if (
    security?.isProxy ===
    true
  ) {
    warnings.push(
      "Proxy"
    );
  }

  if (
    security?.isPausable ===
    true
  ) {
    warnings.push(
      "Pausable"
    );
  }

  if (
    security?.isHoneypot ===
    true
  ) {
    warnings.push(
      "Potential honeypot"
    );
  }

  if (
    security?.canBurn ===
    true
  ) {
    warnings.push(
      "Burn function"
    );
  }

  if (
    warnings.length > 0
  ) {
    response +=
      `\n⚠️ ${warnings.join(
        " • "
      )}\n`;
  }

  /* ------------------------------------------------------------------------ */
  /* SOCIALS                                                                  */
  /* ------------------------------------------------------------------------ */

  const socialSummary =
    formatSocials(
      result
    );

  if (
    socialSummary
  ) {
    response +=
      `🔗 ${socialSummary}\n`;
  }

  /* ------------------------------------------------------------------------ */
  /* SOURCE                                                                   */
  /* ------------------------------------------------------------------------ */

  if (
    result.sourceVerified
  ) {
    response +=
      `Source: Verified\n`;
  }

  /* ------------------------------------------------------------------------ */
  /* DEX                                                                      */
  /* ------------------------------------------------------------------------ */

  if (
    market?.dex ||
    market?.pairLabel
  ) {
    response +=
      `\nDEX: ${
        market.dex ??
        "Unknown"
      }`;

    if (
      market.pairLabel
    ) {
      response +=
        ` • ${market.pairLabel}`;
    }

    response +=
      `\n`;
  }

  response +=
    `\nDYOR • POWGUADIAN`;

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
      `🔎 POWGUADIAN is scanning...`
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
      `Automatic scanning:\n` +
      `Send a token CA, pair address, ` +
      `PancakeSwap link, BscScan link, ` +
      `or DexScreener link.\n\n` +
      `POWGUADIAN can also answer ` +
      `community and crypto questions.`
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
/* COMMUNITY AI MODERATOR + AUTOMATIC SCANNER                                 */
/* -------------------------------------------------------------------------- */

bot.on(
  "text",
  async (ctx) => {
    const text =
      ctx.message.text.trim();

    if (
      !text
    ) {
      return;
    }

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
      addresses.length > 0
    ) {
      await scanAddresses(
        ctx,
        addresses
      );

      return;
    }

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