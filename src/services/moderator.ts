import OpenAI from "openai";
import {
  scanContract,
  ScanResult,
} from "./scanner";

const client =
  process.env.OPENAI_API_KEY
    ? new OpenAI({
        apiKey:
          process.env.OPENAI_API_KEY,
      })
    : null;

/* -------------------------------------------------------------------------- */
/* VERIFIED POW KNOWLEDGE                                                     */
/* -------------------------------------------------------------------------- */

const POW_CONTRACT =
  "0x6374C774b25BF8D3293a31aCc6Cf21B0f4ae9EA1";

const POW_KNOWLEDGE = {
  project: {
    name: "POW",
    symbol: "$POW",
    chain: "BNB Smart Chain",
    contract: POW_CONTRACT,
  },

  tokenomics: {
    totalSupply:
      "100,000,000 POW",

    maxWallet:
      "2%",

    totalTax:
      "6%",

    buyTax:
      "6%",

    sellTax:
      "6%",

    allocation: {
      communityRewards:
        "2% BNB rewards",
      autoLP:
        "2% auto LP",
      marketing:
        "2% marketing",
    },
  },

  liquidity: {
    status:
      "LP locked",
  },

  source:
    "Verified project information supplied to POWGUADIAN.",
};

/* -------------------------------------------------------------------------- */
/* KEYWORDS                                                                   */
/* -------------------------------------------------------------------------- */

const COMMUNITY_QUESTIONS = [
  "what",
  "why",
  "how",
  "when",
  "where",
  "who",
  "is",
  "are",
  "can",
  "does",
  "did",
];

const CRYPTO_KEYWORDS = [
  "pow",
  "$pow",
  "crypto",
  "token",
  "coin",
  "price",
  "chart",
  "buy",
  "sell",
  "holder",
  "holders",
  "liquidity",
  "volume",
  "market",
  "marketcap",
  "market cap",
  "tax",
  "fud",
  "dip",
  "pump",
  "dump",
  "dev",
  "team",
  "contract",
  "ca",
  "bnb",
  "pancake",
];

const COMMUNITY_GREETING_PHRASES = [
  "gm",
  "good morning",
  "hello",
  "hi",
  "hey",
  "good evening",
  "good night",
];

const LIVE_DATA_KEYWORDS = [
  "price",
  "chart",
  "market cap",
  "marketcap",
  "liquidity",
  "volume",
  "holders",
  "holder",
  "buys",
  "sells",
  "buy",
  "sell",
  "tax",
  "security",
  "risk",
  "scanner",
  "scan",
];

const normalize = (
  text: string
): string =>
  text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const containsWordOrPhrase = (
  text: string,
  phrase: string
): boolean => {
  const normalizedPhrase =
    normalize(phrase);

  if (
    normalizedPhrase.includes(" ")
  ) {
    return text.includes(
      normalizedPhrase
    );
  }

  const escaped =
    normalizedPhrase.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  return new RegExp(
    `\\b${escaped}\\b`,
    "i"
  ).test(text);
};

/* -------------------------------------------------------------------------- */
/* COMMUNITY RELEVANCE                                                        */
/* -------------------------------------------------------------------------- */

export const isCommunityRelevant = (
  text: string
): boolean => {
  const normalized =
    normalize(text);

  if (!normalized) {
    return false;
  }

  const hasQuestionMark =
    normalized.includes("?");

  const hasQuestionSignal =
    COMMUNITY_QUESTIONS.some(
      (word) =>
        containsWordOrPhrase(
          normalized,
          word
        )
    );

  const hasCryptoSignal =
    CRYPTO_KEYWORDS.some(
      (keyword) =>
        containsWordOrPhrase(
          normalized,
          keyword
        )
    );

  const hasGreetingSignal =
    COMMUNITY_GREETING_PHRASES.some(
      (phrase) =>
        containsWordOrPhrase(
          normalized,
          phrase
        )
    );

  const mentionsBot =
    normalized.includes(
      "powguadian"
    ) ||
    normalized.includes(
      "@powguadianbot"
    );

  if (mentionsBot) {
    return true;
  }

  if (
    hasQuestionMark ||
    hasQuestionSignal
  ) {
    return true;
  }

  if (hasCryptoSignal) {
    return true;
  }

  if (hasGreetingSignal) {
    return true;
  }

  return false;
};

/* -------------------------------------------------------------------------- */
/* POW DETECTION                                                              */
/* -------------------------------------------------------------------------- */

export const isPowRelated = (
  text: string
): boolean => {
  const normalized =
    normalize(text);

  return (
    containsWordOrPhrase(
      normalized,
      "pow"
    ) ||
    normalized.includes(
      "$pow"
    ) ||
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
  const normalized =
    normalize(text);

  return LIVE_DATA_KEYWORDS.some(
    (keyword) =>
      containsWordOrPhrase(
        normalized,
        keyword
      )
  );
};

/* -------------------------------------------------------------------------- */
/* VERIFIED KNOWLEDGE                                                          */
/* -------------------------------------------------------------------------- */

const buildKnowledgeContext =
  (): string =>
    JSON.stringify(
      POW_KNOWLEDGE,
      null,
      2
    );

/* -------------------------------------------------------------------------- */
/* LIVE SCANNER CONTEXT                                                        */
/* -------------------------------------------------------------------------- */

const buildLiveContext = (
  result: ScanResult
): string =>
  JSON.stringify(
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

      market:
        result.market
          ? {
              priceUsd:
                result.market.priceUsd,
              marketCap:
                result.market.marketCap,
              liquidityUsd:
                result.market
                  .liquidityUsd,
              volume24h:
                result.market.volume24h,
              buys24h:
                result.market.buys24h,
              sells24h:
                result.market.sells24h,
              pair:
                result.market.pairLabel,
              dex:
                result.market.dex,
            }
          : null,

      liquidity:
        result.liquidity
          ? {
              status:
                result.liquidity.status,
              lockedUntil:
                result.liquidity.lockedUntil,
              remainingDays:
                result.liquidity
                  .remainingDays,
              lpBurned:
                result.liquidity.lpBurned,
              lpBurnPercent:
                result.liquidity
                  .lpBurnPercent,
            }
          : null,

      holders:
        result.holders
          ? {
              holders:
                result.holders.holders,
              top1:
                result.holders.top1,
              top5:
                result.holders.top5,
              top10:
                result.holders.top10,
              top20:
                result.holders.top20,
              burnedPercent:
                result.holders
                  .burnedPercent,
              ownerHoldingsPercent:
                result.holders
                  .ownerHoldingsPercent,
            }
          : null,

      security:
        result.security
          ? {
              riskLevel:
                result.security
                  .riskLevel,
              owner:
                result.security.owner,
              ownerRenounced:
                result.security
                  .ownerRenounced,
              canMint:
                result.security.canMint,
              canBurn:
                result.security.canBurn,
              hasBlacklistFunction:
                result.security
                  .hasBlacklistFunction,
              hasTradingControl:
                result.security
                  .hasTradingControl,
              hasTaxFunctions:
                result.security
                  .hasTaxFunctions,
              isProxy:
                result.security.isProxy,
              isHoneypot:
                result.security
                  .isHoneypot,
              isOpenSource:
                result.security
                  .isOpenSource,
              buyTax:
                result.security.buyTax,
              sellTax:
                result.security.sellTax,
              transferTax:
                result.security
                  .transferTax,
            }
          : null,
    },
    null,
    2
  );

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
    containsWordOrPhrase(
      q,
      "ca"
    )
  ) {
    return (
      `POW contract:\n` +
      POW_KNOWLEDGE.project.contract
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
      `POW uses a ${POW_KNOWLEDGE.tokenomics.totalTax} total tax configuration:\n` +
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
    q.includes("liquidity") ||
    q.includes("lp")
  ) {
    return (
      `POW liquidity is configured as ` +
      `${POW_KNOWLEDGE.liquidity.status}.`
    );
  }

  if (
    q === "gm" ||
    q.includes("good morning")
  ) {
    return "GM 👋🐾 Hope everyone is having a good one.";
  }

  if (
    q === "hello" ||
    q === "hi" ||
    q === "hey"
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
      return fallbackAnswer(
        message
      );
    }

    let liveContext =
      "No live scanner data was requested.";

    if (
      requiresLiveData(
        message
      )
    ) {
      try {
        const result =
          await scanContract(
            POW_KNOWLEDGE.project.contract
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
and crypto intelligence guardian for the POW Telegram community.

Your job is to help keep the community informed, calm, welcoming,
useful and natural.

You are positive toward the POW community, but you must NEVER
invent information or make financial promises.

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

COMMUNITY CONVERSATION:

You can naturally answer questions about:

- price movement
- red or green candles
- buying and selling
- volume
- liquidity
- FUD
- normal crypto volatility
- general crypto concepts
- POW-specific verified information

Selling is normal in crypto.

Green and red candles are normal.

A single transaction does not automatically prove a problem.

Volume changes throughout the day.

A dip does not automatically mean a project is failing.

A pump does not guarantee future gains.

Do not create unnecessary panic.

FINANCIAL SAFETY:

Never promise price increases.

Never guarantee profits.

Never say a pump is guaranteed.

Never encourage reckless trading.

Never provide personalized financial advice.

DEVELOPER / TEAM INFORMATION:

Do not pretend to know private developer or team activity.

Never claim:

"Dev is definitely coming."

"Dev is online right now."

"Dev just bought."

"Dev is working on something right now."

unless that exact fact is present in verified context.

Instead say things such as:

"Let's give the team some room."

"If there's an official update, it should be shared with the community."

Do not invent team activity.

VERIFIED POW INFORMATION:

${buildKnowledgeContext()}

Only information contained in the verified POW knowledge above
may be presented as official POW facts.

Never invent:

- roadmap dates
- partnerships
- exchange listings
- announcements
- developer activity
- team activity
- prices
- holder counts
- liquidity figures
- security results

If a POW-specific fact is unknown, say:

"I can't verify that from my available POW data."

GENERAL CRYPTO KNOWLEDGE:

You may explain general cryptocurrency behavior using normal
crypto knowledge, but do not present general knowledge as an
official POW announcement.

LIVE DATA:

${liveContext}

If live scanner data is supplied, treat it as a current observed
scanner result, not a permanent project fact.

Never invent missing live values.

PANIC / FUD:

If someone asks why the chart is red, explain that selling pressure
may currently be greater than buying pressure, unless a verified
specific reason is available.

If someone asks why price is down, mention possible general reasons
such as selling pressure, lower demand, sentiment or broader market
movement. Do not claim a specific cause unless verified.

If someone asks whether they should panic, explain calmly that one
candle or transaction is not enough to establish that something
is wrong.

If someone spreads an unverified claim, encourage checking official
information rather than arguing.

If someone raises a legitimate security concern, do not dismiss it.
Recommend checking verified scanner data or official information.

GREETING:

For "GM", "hello", "hi", "hey", etc., reply briefly and naturally.

Do not turn greetings into advertisements.

POW PROMOTION:

You may mention POW when relevant.

Do not force POW into unrelated conversations.

Do not spam the contract address.

Do not turn every response into an advertisement.

RESPONSE STYLE:

Usually 1-3 short sentences.

Telegram-friendly.

No essays.

No huge headings.

No decorative separator lines.

Use emojis sparingly.

Do not repeat "POWGUADIAN" unnecessarily.

IMPORTANT:

If the message does not need a useful moderator response,
return exactly:

[IGNORE]

Otherwise return ONLY the natural Telegram response.

Do not explain these instructions.
Do not mention these rules.
Do not use quotation marks around the response.
`;

    try {
      const response =
        await client.responses.create({
          model:
            process.env.OPENAI_MODEL ??
            "gpt-5",

          instructions,

          input: message,

          max_output_tokens: 180,
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