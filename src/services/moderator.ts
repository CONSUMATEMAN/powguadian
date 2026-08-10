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
/* POW QUESTION DETECTION                                                     */
/* -------------------------------------------------------------------------- */

const POW_KEYWORDS = [
  "pow",
  "$pow",
  "6374c774",
  "token",
  "contract",
  "ca",
  "tax",
  "taxes",
  "supply",
  "max wallet",
  "wallet",
  "liquidity",
  "lp",
  "burn",
  "burned",
  "renounced",
  "owner",
  "roadmap",
  "utility",
  "utilities",
  "website",
  "telegram",
  "twitter",
  "x account",
  "price",
  "market cap",
  "marketcap",
  "volume",
  "buy",
  "sell",
  "dex",
  "pancakeswap",
  "holders",
  "holder",
  "security",
  "honeypot",
  "risk",
  "scanner",
  "guadian",
  "powguadian",
];

const LIVE_DATA_KEYWORDS = [
  "price",
  "market cap",
  "marketcap",
  "liquidity",
  "volume",
  "buys",
  "sells",
  "holders",
  "holder",
  "risk",
  "security",
  "honeypot",
  "lp",
  "pair",
  "live",
  "current",
  "right now",
  "today",
];

export const isPowRelated = (
  text: string
): boolean => {
  const normalized =
    text.toLowerCase();

  return POW_KEYWORDS.some(
    (keyword) =>
      normalized.includes(keyword)
  );
};

const requiresLiveData = (
  text: string
): boolean => {
  const normalized =
    text.toLowerCase();

  return LIVE_DATA_KEYWORDS.some(
    (keyword) =>
      normalized.includes(keyword)
  );
};

/* -------------------------------------------------------------------------- */
/* VERIFIED KNOWLEDGE                                                          */
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
/* LIVE SCANNER DATA                                                           */
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
/* SIMPLE FALLBACK WITHOUT AI                                                  */
/* -------------------------------------------------------------------------- */

const fallbackAnswer = (
  question: string
): string => {
  const q =
    question.toLowerCase();

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
      `POW uses a ${POW_KNOWLEDGE.tokenomics.totalTax} ` +
      `total tax configuration.\n\n` +
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
      `${POW_KNOWLEDGE.liquidity.status}. ` +
      `LP is not configured as burned.`
    );
  }

  return (
    `I can help with POW's contract, ` +
    `tokenomics, taxes, supply, liquidity, ` +
    `utilities and available live scanner data.\n\n` +
    `If you ask about something that isn't in my ` +
    `verified information, I'll tell you when I can't verify it.`
  );
};

/* -------------------------------------------------------------------------- */
/* AI RESPONSE                                                                 */
/* -------------------------------------------------------------------------- */

export const answerPowQuestion =
  async (
    question: string
  ): Promise<string> => {
    if (!client) {
      return fallbackAnswer(
        question
      );
    }

    let liveContext =
      "No live scanner data was requested.";

    if (
      requiresLiveData(question)
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
You are POWGUADIAN, the official information assistant
for the POW community.

Your job is to answer questions about POW clearly,
naturally and concisely.

IMPORTANT TRUTH RULES:

1. You may only state project facts contained in the
   VERIFIED POW KNOWLEDGE below.

2. You may use LIVE SCANNER DATA when supplied.

3. Never invent project information.

4. Never invent roadmap dates.

5. Never invent partnerships, listings, exchange support,
   team information, announcements or utilities.

6. Never invent prices, market caps, holder numbers,
   liquidity or security results.

7. If information is not available, say:
   "I can't verify that from my available POW data."

8. Do not turn guesses into facts.

9. Do not promise profits or investment returns.

10. Do not provide personalized financial advice.

11. When discussing live market information, make clear
    that it is current observed scanner data and can change.

12. Keep normal answers short enough for Telegram.

13. Do not use huge sections or decorative separator lines.

14. Do not sound robotic.

15. If the user is simply chatting and not asking about POW,
    respond naturally and briefly.

VERIFIED POW KNOWLEDGE:
${buildKnowledgeContext()}

LIVE SCANNER DATA:
${liveContext}
`;

    try {
      const response =
        await client.responses.create(
          {
            model:
              process.env.OPENAI_MODEL ??
              "gpt-5",
            instructions,
            input: question,
            max_output_tokens: 350,
          }
        );

      const answer =
        response.output_text
          ?.trim();

      if (
        !answer
      ) {
        return fallbackAnswer(
          question
        );
      }

      return answer;
    } catch (error) {
      console.error(
        "POW AI response failed:",
        error
      );

      return fallbackAnswer(
        question
      );
    }
  };