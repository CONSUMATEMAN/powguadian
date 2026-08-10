export const POW_KNOWLEDGE = {
  project: {
    name: "POW",
    symbol: "$POW",
    network: "BNB Smart Chain (BSC)",
    contract:
      "0x6374C774b25BF8D3293a31aCc6Cf21B0f4ae9EA1",
  },

  tokenomics: {
    totalSupply: "100,000,000 POW",
    maxWallet: "2%",
    totalTax: "6%",
    buyTax: "6%",
    sellTax: "6%",

    taxBreakdown: {
      communityRewards: "2% BNB rewards",
      liquidity: "2% auto LP",
      marketing: "2% marketing",
    },
  },

  liquidity: {
    status: "LP locked",
    burned: false,
  },

  ownership: {
    status: "Renounced",
  },

  utilities: [
    "POWGUADIAN",
    "Token intelligence",
    "Contract analysis",
    "Security analysis",
    "Market monitoring",
  ],

  officialLinks: {
    bscscan:
      "https://bscscan.com/address/0x6374C774b25BF8D3293a31aCc6Cf21B0f4ae9EA1",

    pancakeSwap:
      "https://pancakeswap.finance/swap?outputCurrency=0x6374C774b25BF8D3293a31aCc6Cf21B0f4ae9EA1",

    website: "",
    telegram: "",
    x: "",
  },

  rules: {
    neverInventFacts: true,
    neverGuaranteeProfit: true,
    neverGiveFinancialAdvice: true,
    clearlyIdentifyUnknownInformation: true,
  },
} as const;