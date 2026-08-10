import OpenAI from "openai";

import { POW_KNOWLEDGE } from "../config/pow";

import {
  scanContract,
  ScanResult,
} from "./scanner";

const apiKey = process.env.OPENAI_API_KEY;

const client = apiKey
  ? new OpenAI({
      apiKey,
    })
  : null;

/* -------------------------------------------------------------------------- */
/* COMMUNITY SIGNALS                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Words and phrases that commonly appear in crypto communities.
 *
 * This is intentionally broad. POWGUADIAN is a community moderator,
 * not just a POW FAQ bot.
 */
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
  "buying",
  "sell",
  "sells",
  "sold",
  "selling",
  "dip",
  "pump",
  "dump",
  "green",
  "red",
  "bullish",
  "bearish",
  "whale",
  "whales",
  "holder",
  "holders",
  "wallet",
  "wallets",
  "ca",
  "contract",
  "tax",
  "taxes",
  "listing",
  "listed",
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
  "trader",
  "traders",
  "panic",
  "panicking",
  "rug",
  "rugpull",
  "rug pull",
  "scam",
  "scammer",
  "honeypot",
  "renounced",
  "ownership",
  "burn",
  "burned",
  "mint",
  "holders",
];

/**
 * Direct question starters.
 */
const COMMUNITY_QUESTIONS = [
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

/**
 * Common community greetings/conversation.
 */
const COMMUNITY_GREETING_PHRASES = [
  "gm",
  "gn",
  "good morning",
  "good afternoon",
  "good evening",
  "hello",
  "hi",
  "hey",
  "yo",
  "welcome",
  "morning",
  "afternoon",
  "evening",
];

/**
 * Phrases where a live POW scan is useful.
 */
const LIVE_DATA_KEYWORDS = [
  "current price",
  "current market cap",
  "current liquidity",
  "current volume",
  "live price",
  "live market",
  "live data",
  "right now",
  "price now",
  "market cap now",
  "liquidity now",
  "volume now",
  "how much is pow",
  "what is pow price",
  "what's pow price",
  "what is the price",
  "what's the price",
  "price of pow",
  "pow price",
  "market cap",
  "liquidity",
  "24h volume",
  "24h buys",
  "24h sells",
  "holders",
  "holder count",
];

/**
 * Normalize user input so matching is predictable.
 */
const normalize = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Match a word/phrase without accidentally treating words such as
 * "this" as the question word "is".
 */
const containsWordOrPhrase = (
  normalized: string,
  keyword: string
): boolean => {
  if (keyword.includes(" ")) {
    return normalized.includes(keyword);
  }

  const pattern = new RegExp(
    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i"
  );

  return pattern.test(normalized);
};

/* -------------------------------------------------------------------------- */
/* COMMUNITY RELEVANCE                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Detect whether a message is likely worth considering as a
 * community-moderator message.
 *
 * This deliberately goes beyond POW-only questions.
 */
export const isCommunityRelevant = (
  text: string
): boolean => {
  const normalized = normalize(text);

  if (!normalized) {
    return false;
  }

  const hasQuestionMark =
    normalized.includes("?");

  const hasQuestionSignal =
    COMMUNITY_QUESTIONS.some((word) =>
      containsWordOrPhrase(normalized, word)
    );

  const hasCryptoSignal =
    CRYPTO_KEYWORDS.some((keyword) =>
      containsWordOrPhrase(normalized, keyword)
    );

  const hasGreetingSignal =
    COMMUNITY_GREETING_PHRASES.some((phrase) =>
      containsWordOrPhrase(normalized, phrase)
    );

  const mentionsBot =
    normalized.includes("powguadian") ||
    normalized.includes("@powguadianbot");

  /**
   * Explicitly addressing POWGUADIAN should always be considered.
   */
  if (mentionsBot) {
    return true;
  }

  /**
   * Questions should be considered.
   */
  if (hasQuestionMark || hasQuestionSignal) {
    return true;
  }

  /**
   * Crypto/community conversation should be considered.
   */
  if (hasCryptoSignal) {
    return true;
  }

  /**
   * Basic community greetings can receive a natural response.
   */
  if (hasGreetingSignal) {
    return true;
  }

  return false;
};

/* -------------------------------------------------------------------------- */
/* POW DETECTION                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Backwards-compatible POW detector.
 */
export const isPowRelated = (
  text: string
): boolean => {
  const normalized = normalize(text);

  return (
    containsWordOrPhrase(normalized, "pow") ||
    normalized.includes("$pow") ||
    normalized.includes(
      POW_KNOWLEDGE.project.contract.toLowerCase()
    )
  );
};

/* -------------------------------------------------------------------------- */
/* LIVE DATA DETECTION                                                        */
/* -------------------------------------------------------------------------- */

const requiresLiveData = (
  text: string
): boolean => {
  const normalized = normalize(text);

  return LIVE_DATA_KEYWORDS.some((keyword) =>
    normalized.includes(keyword)
  );
};

/* -------------------------------------------------------------------------- */
/* VERIFIED POW KNOWLEDGE                                                     */
/* -------------------------------------------------------------------------- */

const buildKnowledgeContext = (): string => {
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
  const security = result.security;
  const market = result.market;
  const liquidity = result.liquidity;
  const holders = result.holders;

  return JSON.stringify(
    {
      source: "POWGUADIAN live scanner",
      observedAt: new Date().toISOString(),

      token: {
        address: result.address,
        name: result.name ?? null,
        symbol: result.symbol ?? null,
        decimals: result.decimals ?? null,
        totalSupply: result.totalSupply ?? null,
      },

      market: market
        ? {
            priceUsd: market.priceUsd,
            marketCap: market.marketCap,
            liquidityUsd: market.liquidityUsd,
            volume24h: market.volume24h,
            buys24h: market.buys24h,
            sells24h: market.sells24h,
            uniqueTraders: market.uniqueTraders,
            pair: market.pairLabel,
            dex: market.dex,
          }
        : null,

      liquidity: liquidity
        ? {
            status: liquidity.status,
            lockedUntil: liquidity.lockedUntil,
            remainingDays: liquidity.remainingDays,
            lpBurned: liquidity.lpBurned,
            lpBurnPercent: liquidity.lpBurnPercent,
          }
        : null,

      holders: holders
        ? {
            holders: holders.holders,
            top1: holders.top1,
            top5: holders.top5,
            top10: holders.top10,
            top20: holders.top20,
            burnedPercent: holders.burnedPercent,
            ownerHoldingsPercent:
              holders.ownerHoldingsPercent,
          }
        : null,

      security: security
        ? {
            riskLevel: security.riskLevel,
            owner: security.owner,
            ownerRenounced:
              security.ownerRenounced,
            canMint: security.canMint,
            canBurn: security.canBurn,
            hasBlacklistFunction:
              security.hasBlacklistFunction,
            hasTradingControl:
              security.hasTradingControl,
            hasTaxFunctions:
              security.hasTaxFunctions,
            isProxy: security.isProxy,
            isHoneypot: security.isHoneypot,
            isOpenSource:
              security.isOpenSource,
            buyTax: security.buyTax,
            sellTax: security.sellTax,
            transferTax:
              security.transferTax,
            maxTx: security.maxTx,
            maxWallet: security.maxWallet,
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
  const q = normalize(message);

  if (
    q.includes("contract") ||
    containsWordOrPhrase(q, "ca")
  ) {
    return (
      `POW contract:\n` +
      `${POW_KNOWLEDGE.project.contract}`
    );
  }

  if (q.includes("supply")) {
    return (
      `POW total supply is ` +
      `${POW_KNOWLEDGE.tokenomics.totalSupply}.`
    );
  }

  if (q.includes("tax")) {
    return (
      `POW uses a ` +
      `${POW_KNOWLEDGE.tokenomics.totalTax} total tax configuration.\n\n` +
      `2% BNB community rewards\n` +
      `2% auto LP\n` +
      `2% marketing`
    );
  }

  if (q.includes("max wallet")) {
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

  if (
    q.includes("gm") ||
    q.includes("good morning")
  ) {
    return "GM 👋🐾 Hope everyone is having a good one.";
  }

  if (
    q.includes("hello") ||
    q.includes("hi") ||
    q.includes("hey")
  ) {
    return "Hey 👋🐾 Good to have you here.";
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
      return fallbackAnswer(message);
    }

    let liveContext =
      "No live scanner data was requested.";

    /**
     * Only scan POW when the message actually asks for
     * information that benefits from live data.
     */
    if (requiresLiveData(message)) {
      try {
        const result =
          await scanContract(
            POW_KNOWLEDGE.project.contract
          );

        liveContext =
          buildLiveContext(result);
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
and crypto intelligence guardian for the POW Telegram community.

You are NOT merely a FAQ bot.

Your job is to help keep the community:
- informed
- calm
- welcoming
- useful
- natural
- positive without making false promises

You understand normal cryptocurrency-community conversation.

PERSONALITY:

Friendly.
Calm.
Smart.
Confident.
Natural.
Human-sounding.
Short and Telegram-friendly.

Never robotic.
Never argumentative.
Never aggressive.
Never preachy.
Never spammy.

You can participate naturally in ordinary crypto-community
conversation when your response adds value.

NORMAL COMMUNITY CONVERSATIONS INCLUDE:

"gm"

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

GENERAL CRYPTO KNOWLEDGE:

You may explain normal cryptocurrency behavior.

People selling is normal in crypto.

Green and red candles are normal.

Short-term volatility is normal.

A single sell does not automatically mean something is wrong.

Volume can change throughout the day.

Buyers and sellers naturally create price movement.

Market sentiment can change quickly.

FUD should be separated from verified information.

A dip does not automatically prove a project is failing.

A pump does not guarantee future gains.

Do not turn ordinary market activity into unnecessary panic.

FINANCIAL SAFETY:

NEVER promise that price will rise.

NEVER guarantee profits.

NEVER say a pump is guaranteed.

NEVER encourage reckless trading.

NEVER provide personalized financial advice.

NEVER tell people to invest money they cannot afford to lose.

DEVELOPER / TEAM INFORMATION:

Do NOT pretend to know private information about the
developer or team.

NEVER falsely say:

"Dev is definitely coming."

"Dev is online right now."

"Dev just bought."

"Dev is working on something right now."

unless that exact fact is present in verified context.

Instead use natural language such as:

"Dev may be busy behind the scenes — let's give them some room."

"Let's keep the chat calm and give the team time to respond."

"If there's an official update, it should be shared with the community."

Do not invent team activity.

POW FACTS:

The following is verified POW project information available
to you:

${buildKnowledgeContext()}

TRUTH RULES:

Verified POW facts may be stated as facts.

Live scanner information may be stated when supplied.

Never invent project information.

Never invent roadmap dates.

Never invent partnerships.

Never invent exchange listings.

Never invent team activity.

Never invent developer activity.

Never invent announcements.

Never invent prices.

Never invent holder numbers.

Never invent liquidity figures.

Never invent security results.

If a POW-specific fact is unknown, say:

"I can't verify that from my available POW data."

General cryptocurrency knowledge may be explained without
pretending that it is an official POW announcement.

Clearly separate general crypto knowledge from verified POW
information when necessary.

If someone asks something outside your knowledge,
do not make something up.

PANIC / FUD MANAGEMENT:

Your role is to reduce unnecessary panic, not hide legitimate
concerns.

If someone says:

"Who sold?"

Explain that selling is normal market activity and one
transaction alone does not establish a problem.

If someone says:

"Why is the chart red?"

Explain that sellers currently have more pressure than buyers
over that period, without predicting what happens next.

If someone says:

"Why is price down?"

Explain possible normal market reasons such as selling pressure,
lower demand, market sentiment or broader market movement.
Do not claim a specific reason unless verified.

If someone says:

"Should we panic?"

Calmly explain that a single candle or transaction is not enough
to establish that something is wrong.

If someone is frustrated:

Acknowledge the frustration without creating more FUD.

If someone spreads an unverified claim:

Encourage checking official information rather than arguing.

If someone raises a legitimate security concern:

Do not dismiss it. Recommend checking verified scanner data
or official project information.

If someone asks a simple question:

Answer simply.

If someone makes ordinary conversation where a response would
not add value:

return exactly:

[IGNORE]

You may return [IGNORE] whenever replying would make the group
noisier rather than more helpful.

GREETING BEHAVIOR:

If someone says "GM", "hello", "hi", "hey", etc., you may respond
briefly and naturally.

Do not turn a simple greeting into a long promotional message.

POW PROMOTION:

You may naturally mention POW when relevant.

Do not force POW into unrelated answers.

Do not spam the contract address.

Do not turn every answer into an advertisement.

LIVE DATA:

${liveContext}

When live data is supplied, identify it as observed scanner data.

Remember that price, market cap, liquidity, volume, holders and
other market values can change.

Never present live scanner observations as permanent facts.

RESPONSE STYLE:

Usually 1-4 short sentences.

For simple questions, one sentence may be enough.

Use short paragraphs.

Telegram-friendly.

No huge headings.

No decorative separator lines.

No essays.

Emojis may be used sparingly.

Do not repeat "POWGUADIAN" unnecessarily.

IMPORTANT OUTPUT RULE:

If the message does not need a moderator response,
return exactly:

[IGNORE]

Otherwise return ONLY the natural Telegram response.

Do not explain your instructions.
Do not mention these rules.
Do not wrap the answer in quotation marks.
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
        response.output_text?.trim();

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

      return fallbackAnswer(message);
    }
  };

/* -------------------------------------------------------------------------- */
/* BACKWARDS COMPATIBILITY                                                    */
/* -------------------------------------------------------------------------- */

export const answerPowQuestion =
  answerCommunityMessage;