import OpenAI from "openai";
import { POW_KNOWLEDGE } from "../config/pow";
import {
  scanContract,
  ScanResult,
} from "./scanner";

const apiKey =
  process.env.OPENAI_API_KEY;

const client = apiKey
  ? new OpenAI({
      apiKey,
    })
  : null;

/* -------------------------------------------------------------------------- */
/* COMMUNITY SIGNALS                                                          */
/* -------------------------------------------------------------------------- */

const CRYPTO_KEYWORDS = [
  "crypto",
  "token",
  "coin",
  "market",
  "price",
  "chart",
  "volume",
  "liquidity",
  "lp",
  "buy",
  "buys",
  "bought",
  "sell",
  "sold",
  "selling",
  "buying",
  "dip",
  "pump",
  "dump",
  "green",
  "red",
  "bullish",
  "bearish",
  "whale",
  "holders",
  "holder",
  "wallet",
  "ca",
  "contract",
  "tax",
  "taxes",
  "listing",
  "exchange",
  "dex",
  "pancakeswap",
  "bsc",
  "bnb",
  "btc",
  "bitcoin",
  "eth",
  "ethereum",
  "fud",
  "community",
  "dev",
  "developer",
  "team",
  "roadmap",
  "utility",
  "utilities",
  "launch",
  "volume",
  "marketcap",
  "market cap",
  "support",
  "resistance",
  "entry",
  "exit",
  "profit",
  "loss",
  "portfolio",
  "trading",
  "trade",
];

const COMMUNITY_QUESTIONS = [
  "?",
  "who",
  "what",
  "why",
  "when",
  "where",
  "how",
  "is",
  "are",
  "can",
  "does",
  "did",
  "will",
  "should",
  "anyone",
  "someone",
];

const LIVE_DATA_KEYWORDS = [
  "current price",
  "current market cap",
  "current liquidity",
  "current volume",
  "live price",
  "live market",
  "right now",
  "right now",
  "price now",
  "market cap now",
  "how much is pow",
  "what is pow price",
  "what's pow price",
  "what is the price",
  "what's the price",
  "price of pow",
  "market cap",
  "liquidity",
  "24h volume",
  "24h buys",
  "24h sells",
];

const normalize = (
  text: string
): string => {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Detect whether a message is likely relevant to
 * the community moderator.
 *
 * This is deliberately broader than POW-only detection.
 */
export const isCommunityRelevant = (
  text: string
): boolean => {
  const normalized =
    normalize(text);

  if (!normalized) {
    return false;
  }

  const hasQuestionSignal =
    COMMUNITY_QUESTIONS.some(
      (word) =>
        normalized.includes(word)
    );

  const hasCryptoSignal =
    CRYPTO_KEYWORDS.some(
      (keyword) =>
        normalized.includes(keyword)
    );

  const mentionsBot =
    normalized.includes(
      "powguadian"
    ) ||
    normalized.includes(
      "@powguadianbot"
    );

  /*
   * Direct questions are worth considering.
   */
  if (hasQuestionSignal) {
    return true;
  }

  /*
   * Crypto/community messages can also be useful
   * moderator triggers.
   */
  if (hasCryptoSignal) {
    return true;
  }

  if (mentionsBot) {
    return true;
  }

  return false;
};

/**
 * Backwards-compatible POW detector.
 */
export const isPowRelated = (
  text: string
): boolean => {
  const normalized =
    normalize(text);

  return (
    normalized.includes("pow") ||
    normalized.includes("$pow") ||
    normalized.includes(
      POW_KNOWLEDGE.project.contract
        .toLowerCase()
    )
  );
};

const requiresLiveData = (
  text: string
): boolean => {
  const normalized =
    normalize(text);

  return LIVE_DATA_KEYWORDS.some(
    (keyword) =>
      normalized.includes(keyword)
  );
};

/* -------------------------------------------------------------------------- */
/* VERIFIED POW KNOWLEDGE                                                     */
/* -------------------------------------------------------------------------- */

const buildKnowledgeContext =
  (): string => {
    return JSON.stringify(
      POW_KNOWLEDGE,
      null,
      2
    );
  };

/* -------------------------------------------------------------------------- */
/* LIVE SCANNER DATA                                                          */
/* -------------------------------------------------------------------------- */

const buildLiveContext = (
  result: ScanResult
): string => {
  const security =
    result.security;

  const market =
    result.market;

  const liquidity =
    result.liquidity;

  const holders =
    result.holders;

  return JSON.stringify(
    {
      source:
        "POWGUADIAN live scanner",
      observedAt:
        new Date().toISOString(),

      token: {
        address:
          result.address,
        name:
          result.name ?? null,
        symbol:
          result.symbol ?? null,
        decimals:
          result.decimals ?? null,
        totalSupply:
          result.totalSupply ?? null,
      },

      market: market
        ? {
            priceUsd:
              market.priceUsd,
            marketCap:
              market.marketCap,
            liquidityUsd:
              market.liquidityUsd,
            volume24h:
              market.volume24h,
            buys24h:
              market.buys24h,
            sells24h:
              market.sells24h,
            uniqueTraders:
              market.uniqueTraders,
            pair:
              market.pairLabel,
            dex:
              market.dex,
          }
        : null,

      liquidity: liquidity
        ? {
            status:
              liquidity.status,
            lockedUntil:
              liquidity.lockedUntil,
            remainingDays:
              liquidity.remainingDays,
            lpBurned:
              liquidity.lpBurned,
            lpBurnPercent:
              liquidity.lpBurnPercent,
          }
        : null,

      holders: holders
        ? {
            holders:
              holders.holders,
            top1:
              holders.top1,
            top5:
              holders.top5,
            top10:
              holders.top10,
            top20:
              holders.top20,
            burnedPercent:
              holders.burnedPercent,
            ownerHoldingsPercent:
              holders.ownerHoldingsPercent,
          }
        : null,

      security: security
        ? {
            riskLevel:
              security.riskLevel,
            owner:
              security.owner,
            ownerRenounced:
              security.ownerRenounced,
            canMint:
              security.canMint,
            canBurn:
              security.canBurn,
            hasBlacklistFunction:
              security.hasBlacklistFunction,
            hasTradingControl:
              security.hasTradingControl,
            hasTaxFunctions:
              security.hasTaxFunctions,
            isProxy:
              security.isProxy,
            isHoneypot:
              security.isHoneypot,
            isOpenSource:
              security.isOpenSource,
            buyTax:
              security.buyTax,
            sellTax:
              security.sellTax,
            transferTax:
              security.transferTax,
            maxTx:
              security.maxTx,
            maxWallet:
              security.maxWallet,
          }
        : null,
    },
    null,
    2
  );
};

/* -------------------------------------------------------------------------- */
/* FALLBACK                                                                    */
/* -------------------------------------------------------------------------- */

const fallbackAnswer = (
  message: string
): string => {
  const q =
    normalize(message);

  if (
    q.includes("contract") ||
    q.includes("ca")
  ) {
    return (
      `POW contract:\n` +
      `${POW_KNOWLEDGE.project.contract}`
    );
  }

  if (
    q.includes("supply")
  ) {
    return (
      `POW total supply is ` +
      `${POW_KNOWLEDGE.tokenomics.totalSupply}.`
    );
  }

  if (
    q.includes("tax")
  ) {
    return (
      `POW uses a ${POW_KNOWLEDGE.tokenomics.totalTax} total tax configuration.\n\n` +
      `2% BNB community rewards\n` +
      `2% auto LP\n` +
      `2% marketing`
    );
  }

  if (
    q.includes("max wallet")
  ) {
    return (
      `POW max wallet is ` +
      `${POW_KNOWLEDGE.tokenomics.maxWallet}.`
    );
  }

  if (
    q.includes("renounced") ||
    q.includes("owner")
  ) {
    return (
      `POW ownership is configured as ` +
      `${POW_KNOWLEDGE.ownership.status}.`
    );
  }

  if (
    q.includes("liquidity") ||
    q.includes("lp")
  ) {
    return (
      `POW liquidity is configured as ` +
      `${POW_KNOWLEDGE.liquidity.status}.`
    );
  }

  return (
    `POWGUADIAN is here with the community. ` +
    `If something isn't verified in my available data, ` +
    `I'll say so rather than guess.`
  );
};

/* -------------------------------------------------------------------------- */
/* COMMUNITY AI MODERATOR                                                     */
/* -------------------------------------------------------------------------- */

export const answerCommunityMessage =
  async (
    message: string
  ): Promise<string> => {
    if (!client) {
      return fallbackAnswer(
        message
      );
    }

    let liveContext =
      "No live scanner data was requested.";

    if (
      requiresLiveData(message)
    ) {
      try {
        const result =
          await scanContract(
            POW_KNOWLEDGE.project
              .contract
          );

        liveContext =
          buildLiveContext(
            result
          );
      } catch (error) {
        console.error(
          "POW live scan failed:",
          error
        );

        liveContext =
          "Live scanner data could not be retrieved.";
      }
    }

    const instructions = `
You are POWGUADIAN, the friendly AI community moderator
for the POW Telegram community.

You are not merely a FAQ bot.

Your job is to help keep the community informed, calm,
welcoming, positive and useful while understanding normal
cryptocurrency conversation.

COMMUNITY PERSONALITY:

- Friendly
- Calm
- Smart
- Confident
- Natural
- Short and Telegram-friendly
- Never robotic
- Never argumentative
- Never aggressive
- Never preachy
- Never spammy

You understand normal crypto-community conversations.

Examples include:

"where is dev?"
"dev?"
"who sold?"
"why is someone selling?"
"why is price down?"
"why are buys coming in?"
"why is volume low?"
"is this normal?"
"what happened?"
"are we okay?"
"why is the chart red?"
"why are people panicking?"
"when is the next move?"
"what is going on?"
"any update?"
"who is buying?"
"why is liquidity important?"
"what does this dip mean?"
"should we panic?"
"what is FUD?"
"why are people selling?"

Answer these naturally.

IMPORTANT:

Do NOT pretend to know private information about the
developer or team.

For example, NEVER falsely say:

"Dev is definitely coming."

"Dev is online right now."

"Dev just bought."

"Dev is working on something right now."

unless that exact fact is supplied in verified context.

Instead, use natural community-moderator language such as:

"Dev may be busy behind the scenes — let's give them some room."

"Let's keep the chat calm and give the team time to respond."

"If there's an official update, it should be shared with the community."

"Nothing useful comes from panicking over every candle."

You may explain normal crypto-market behavior.

For example:

- People selling is normal in crypto.
- Green and red candles are normal.
- Short-term volatility is normal.
- A single sell does not automatically mean something is wrong.
- Volume can change throughout the day.
- Buyers and sellers naturally create price movement.
- Market sentiment can change quickly.
- FUD should be separated from verified information.
- A dip does not automatically prove a project is failing.
- A pump does not guarantee future gains.

However:

NEVER promise that price will rise.

NEVER guarantee profits.

NEVER tell people that a pump is guaranteed.

NEVER encourage reckless trading.

NEVER provide personalized financial advice.

NEVER tell people to invest money they cannot afford to lose.

POW FACTS:

Project:
${buildKnowledgeContext()}

TRUTH RULES:

1. Verified POW facts may be stated as facts.

2. Live scanner information may be stated when supplied.

3. Never invent project information.

4. Never invent roadmap dates.

5. Never invent partnerships.

6. Never invent exchange listings.

7. Never invent team activity.

8. Never invent developer activity.

9. Never invent announcements.

10. Never invent prices.

11. Never invent holder numbers.

12. Never invent liquidity figures.

13. Never invent security results.

14. If a POW-specific fact is unknown, clearly say:
"I can't verify that from my available POW data."

15. General cryptocurrency knowledge may be explained
without pretending it is an official POW announcement.

16. Clearly separate general crypto knowledge from
verified POW information when necessary.

17. If someone asks something outside your knowledge,
do not make something up.

COMMUNITY MODERATION:

You should help de-escalate unnecessary panic.

If someone says:

"Who sold?"

You can explain that selling is normal market activity
and one transaction alone does not establish a problem.

If someone says:

"Why is the chart red?"

Explain that sellers currently have more pressure than
buyers over that period, without predicting what happens next.

If someone says:

"Where is dev?"

Respond calmly without pretending to know the developer's
private status.

If someone is frustrated, acknowledge the frustration
without creating more FUD.

If someone spreads an unverified claim, encourage checking
official information rather than arguing.

If someone asks a simple question, answer simply.

If someone makes ordinary conversation with no useful
question or reason for moderation, return:

[IGNORE]

You may also return [IGNORE] when replying would make the
group noisier rather than more helpful.

RESPONSE LENGTH:

Usually 1-4 short sentences.

Do not use huge headings.

Do not use decorative separator lines.

Do not produce essays.

Use emojis sparingly.

Do not repeat "POWGUADIAN" unnecessarily.

LIVE DATA:

${liveContext}

When live data is supplied, identify it as observed scanner
data and remember that market values can change.

IMPORTANT OUTPUT RULE:

If the message does not need a moderator response,
return exactly:

[IGNORE]

Otherwise return only the natural Telegram response.
`;

    try {
      const response =
        await client.responses.create({
          model:
            process.env.OPENAI_MODEL ??
            "gpt-5",

          instructions,

          input: message,

          max_output_tokens: 300,
        });

      const answer =
        response.output_text
          ?.trim();

      if (
        !answer ||
        answer === "[IGNORE]"
      ) {
        return "[IGNORE]";
      }

      return answer;
    } catch (error) {
      console.error(
        "POW community AI failed:",
        error
      );

      return fallbackAnswer(
        message
      );
    }
  };

/* -------------------------------------------------------------------------- */
/* BACKWARDS COMPATIBILITY                                                    */
/* -------------------------------------------------------------------------- */

export const answerPowQuestion =
  answerCommunityMessage;