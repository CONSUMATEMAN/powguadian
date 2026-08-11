import { ethers } from "ethers";
import { config } from "../config/env";
import {
  analyzeSecurity,
  SecurityResult,
} from "./security";

const provider = new ethers.JsonRpcProvider(
  config.bscRpcUrl
);

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const WBNB_ADDRESS =
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";

const DEAD_ADDRESSES = [
  ethers.ZeroAddress.toLowerCase(),
  "0x000000000000000000000000000000000000dead",
];

interface DexScreenerPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  priceUsd?: string;
  priceNative?: string;
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;

  baseToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  };

  quoteToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  };

  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };

  volume?: {
    h24?: number;
  };

  txns?: {
    h24?: {
      buys?: number;
      sells?: number;
    };
  };

  info?: {
    websites?: Array<{
      url?: string;
    }>;

    socials?: Array<{
      type?: string;
      url?: string;
    }>;
  };
}

interface DexScreenerResponse {
  pairs?: DexScreenerPair[];
}

interface BscScanResponse {
  status?: string;
  message?: string;
  result?: string | string[];
}

export interface MarketData {
  priceUsd: number | null;
  marketCap: number | null;
  liquidityUsd: number | null;

  volume24h: number | null;
  buys24h: number | null;
  sells24h: number | null;
  uniqueTraders: number | null;

  pairAddress: string | null;
  dex: string | null;
  pairLabel: string | null;

  pairCreatedAt: number | null;

  priceNative: number | null;

  lpBnb: number | null;
  lpRatio: number | null;

  website: string | null;
  telegram: string | null;
  twitter: string | null;
}

export interface LPData {
  status:
    | "LOCKED"
    | "EXPIRED"
    | "BURNED"
    | "UNKNOWN";

  lockedUntil: string | null;
  durationDays: number | null;
  remainingDays: number | null;

  lpBurned: boolean;
  lpBurnPercent: number | null;
}

export interface HolderData {
  holders: number | null;

  top1: number | null;
  top5: number | null;
  top10: number | null;
  top20: number | null;

  burnedPercent: number | null;
  ownerHoldingsPercent: number | null;
}

export interface ScanResult {
  address: string;

  isContract: boolean;

  type:
    | "token"
    | "pair"
    | "contract"
    | "unknown";

  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: string;

  token0?: string;
  token1?: string;

  reserve0?: string;
  reserve1?: string;

  security?: SecurityResult;

  market?: MarketData;

  liquidity?: LPData;

  holders?: HolderData;
}

const emptyMarketData = (): MarketData => ({
  priceUsd: null,
  marketCap: null,
  liquidityUsd: null,

  volume24h: null,
  buys24h: null,
  sells24h: null,
  uniqueTraders: null,

  pairAddress: null,
  dex: null,
  pairLabel: null,

  pairCreatedAt: null,

  priceNative: null,

  lpBnb: null,
  lpRatio: null,

  website: null,
  telegram: null,
  twitter: null,
});

const emptyLPData = (): LPData => ({
  status: "UNKNOWN",

  lockedUntil: null,
  durationDays: null,
  remainingDays: null,

  lpBurned: false,
  lpBurnPercent: null,
});

const emptyHolderData = (): HolderData => ({
  holders: null,

  top1: null,
  top5: null,
  top10: null,
  top20: null,

  burnedPercent: null,
  ownerHoldingsPercent: null,
});

export const extractAddresses = (
  text: string
): string[] => {
  const matches =
    text.match(/0x[a-fA-F0-9]{40}/g) ?? [];

  const uniqueAddresses =
    new Set<string>();

  for (const address of matches) {
    try {
      uniqueAddresses.add(
        ethers.getAddress(address)
      );
    } catch {
      // Ignore invalid addresses.
    }
  }

  return Array.from(uniqueAddresses);
};

/**
 * Checks whether an address is a PancakeSwap-style
 * liquidity pair before attempting ERC20 detection.
 *
 * This is important because an LP/pair is also a smart
 * contract and must never be presented as the token CA.
 */
const detectPair = async (
  address: string
): Promise<{
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
} | null> => {
  try {
    const pair =
      new ethers.Contract(
        address,
        PAIR_ABI,
        provider
      );

    const token0 =
      ethers.getAddress(
        await pair.token0()
      );

    const token1 =
      ethers.getAddress(
        await pair.token1()
      );

    const reserves =
      await pair.getReserves();

    return {
      token0,
      token1,
      reserve0: reserves[0],
      reserve1: reserves[1],
    };
  } catch {
    return null;
  }
};

const getUnderlyingTokenFromPair = (
  token0: string,
  token1: string
): string => {
  const token0Lower =
    token0.toLowerCase();

  if (
    token0Lower ===
    WBNB_ADDRESS.toLowerCase()
  ) {
    return token1;
  }

  if (
    token1.toLowerCase() ===
    WBNB_ADDRESS.toLowerCase()
  ) {
    return token0;
  }

  // For non-WBNB pairs, use token0 as the
  // deterministic fallback. DexScreener will
  // later provide the actual market pair.
  return token0;
};

const fetchDexScreenerData = async (
  tokenAddress: string
): Promise<MarketData> => {
  const market =
    emptyMarketData();

  try {
    const response =
      await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
      );

    if (!response.ok) {
      return market;
    }

    const data =
      (await response.json()) as DexScreenerResponse;

    const pairs =
      Array.isArray(data.pairs)
        ? data.pairs
        : [];

    const bscPairs =
      pairs.filter(
        (pair) =>
          pair?.chainId?.toLowerCase() ===
          "bsc"
      );

    if (
      bscPairs.length === 0
    ) {
      return market;
    }

    bscPairs.sort(
      (a, b) =>
        Number(
          b?.liquidity?.usd ?? 0
        ) -
        Number(
          a?.liquidity?.usd ?? 0
        )
    );

    const pair =
      bscPairs[0];

    market.priceUsd =
      pair?.priceUsd != null
        ? Number(pair.priceUsd)
        : null;

    market.priceNative =
      pair?.priceNative != null
        ? Number(pair.priceNative)
        : null;

    market.marketCap =
      pair?.marketCap != null
        ? Number(pair.marketCap)
        : pair?.fdv != null
          ? Number(pair.fdv)
          : null;

    market.liquidityUsd =
      pair?.liquidity?.usd != null
        ? Number(
            pair.liquidity.usd
          )
        : null;

    market.volume24h =
      pair?.volume?.h24 != null
        ? Number(
            pair.volume.h24
          )
        : null;

    market.buys24h =
      pair?.txns?.h24?.buys != null
        ? Number(
            pair.txns.h24.buys
          )
        : null;

    market.sells24h =
      pair?.txns?.h24?.sells != null
        ? Number(
            pair.txns.h24.sells
          )
        : null;

    market.pairAddress =
      pair?.pairAddress ?? null;

    market.dex =
      pair?.dexId ?? null;

    market.pairLabel =
      pair?.baseToken?.symbol &&
      pair?.quoteToken?.symbol
        ? `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`
        : null;

    market.pairCreatedAt =
      pair?.pairCreatedAt != null
        ? Number(
            pair.pairCreatedAt
          )
        : null;

    const websites =
      pair?.info?.websites ?? [];

    for (
      const website of websites
    ) {
      if (
        website?.url &&
        !market.website
      ) {
        market.website =
          website.url;
      }
    }

    const socials =
      pair?.info?.socials ?? [];

    for (
      const social of socials
    ) {
      if (!social?.url) {
        continue;
      }

      const type =
        String(
          social.type ?? ""
        ).toLowerCase();

      if (
        type.includes("telegram") &&
        !market.telegram
      ) {
        market.telegram =
          social.url;
      }

      if (
        (type === "twitter" ||
          type === "x") &&
        !market.twitter
      ) {
        market.twitter =
          social.url;
      }
    }

    if (
      market.marketCap !== null &&
      market.marketCap > 0 &&
      market.liquidityUsd !== null
    ) {
      market.lpRatio =
        (market.liquidityUsd /
          market.marketCap) *
        100;
    }

    if (
      market.pairAddress
    ) {
      await enrichPairData(
        market,
        market.pairAddress
      );
    }
  } catch (error) {
    console.error(
      "DexScreener request failed:",
      error
    );
  }

  return market;
};

const enrichPairData = async (
  market: MarketData,
  pairAddress: string
): Promise<void> => {
  try {
    if (
      !ethers.isAddress(
        pairAddress
      )
    ) {
      return;
    }

    const pair =
      new ethers.Contract(
        pairAddress,
        PAIR_ABI,
        provider
      );

    const token0 =
      ethers.getAddress(
        await pair.token0()
      );

    const token1 =
      ethers.getAddress(
        await pair.token1()
      );

    const reserves =
      await pair.getReserves();

    let wbnbReserve =
      0;

    if (
      token0.toLowerCase() ===
      WBNB_ADDRESS.toLowerCase()
    ) {
      wbnbReserve =
        Number(
          ethers.formatEther(
            reserves[0]
          )
        );
    }

    if (
      token1.toLowerCase() ===
      WBNB_ADDRESS.toLowerCase()
    ) {
      wbnbReserve =
        Number(
          ethers.formatEther(
            reserves[1]
          )
        );
    }

    if (
      wbnbReserve > 0
    ) {
      market.lpBnb =
        wbnbReserve;
    }
  } catch {
    // Pair enrichment is supplementary.
  }
};

const analyzeLP = async (
  market: MarketData
): Promise<LPData> => {
  const result =
    emptyLPData();

  if (
    !market.pairAddress
  ) {
    return result;
  }

  try {
    const pair =
      new ethers.Contract(
        market.pairAddress,
        PAIR_ABI,
        provider
      );

    const lpSupply =
      await pair.totalSupply();

    if (
      lpSupply === 0n
    ) {
      return result;
    }

    let burnedBalance =
      0n;

    for (
      const deadAddress of
        DEAD_ADDRESSES
    ) {
      try {
        burnedBalance +=
          await pair.balanceOf(
            deadAddress
          );
      } catch {
        // Ignore individual dead-address failures.
      }
    }

    if (
      burnedBalance > 0n
    ) {
      const burnPercent =
        Number(
          ethers.formatUnits(
            (burnedBalance *
              10000n) /
              lpSupply,
            2
          )
        );

      result.lpBurnPercent =
        burnPercent;

      if (
        burnPercent >= 99
      ) {
        result.status =
          "BURNED";

        result.lpBurned =
          true;

        return result;
      }
    }
  } catch {
    // Leave LP status UNKNOWN.
  }

  return result;
};

const analyzeHolders = async (
  tokenAddress: string,
  totalSupply: string,
  decimals: number
): Promise<HolderData> => {
  const result =
    emptyHolderData();

  const apiKey =
    process.env.BSCSCAN_API_KEY;

  if (!apiKey) {
    return result;
  }

  try {
    const url =
      "https://api.bscscan.com/api" +
      `?module=token` +
      `&action=tokenholdercount` +
      `&contractaddress=${tokenAddress}` +
      `&apikey=${apiKey}`;

    const response =
      await fetch(url);

    if (!response.ok) {
      return result;
    }

    const data =
      (await response.json()) as BscScanResponse;

    if (
      data?.status === "1" &&
      typeof data?.result ===
        "string"
    ) {
      const holders =
        Number(data.result);

      if (
        Number.isFinite(holders)
      ) {
        result.holders =
          holders;
      }
    }
  } catch (error) {
    console.error(
      "Holder API request failed:",
      error
    );
  }

  void totalSupply;
  void decimals;

  return result;
};

const readToken = async (
  address: string
): Promise<{
  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: string;
  hasTokenData: boolean;
}> => {
  const token =
    new ethers.Contract(
      address,
      ERC20_ABI,
      provider
    );

  let hasTokenData =
    false;

  const result: {
    name?: string;
    symbol?: string;
    decimals?: number;
    totalSupply?: string;
    hasTokenData: boolean;
  } = {
    hasTokenData: false,
  };

  try {
    result.name =
      await token.name();

    hasTokenData =
      true;
  } catch {
    // Not an ERC20 name implementation.
  }

  try {
    result.symbol =
      await token.symbol();

    hasTokenData =
      true;
  } catch {
    // Not an ERC20 symbol implementation.
  }

  try {
    result.decimals =
      Number(
        await token.decimals()
      );

    hasTokenData =
      true;
  } catch {
    // Decimals unavailable.
  }

  try {
    const supply =
      await token.totalSupply();

    if (
      result.decimals !==
      undefined
    ) {
      result.totalSupply =
        ethers.formatUnits(
          supply,
          result.decimals
        );
    } else {
      result.totalSupply =
        supply.toString();
    }

    hasTokenData =
      true;
  } catch {
    // Total supply unavailable.
  }

  result.hasTokenData =
    hasTokenData;

  return result;
};

export const scanContract = async (
  address: string
): Promise<ScanResult> => {
  if (
    !ethers.isAddress(address)
  ) {
    throw new Error(
      "Invalid contract address."
    );
  }

  const normalizedAddress =
    ethers.getAddress(address);

  const code =
    await provider.getCode(
      normalizedAddress
    );

  if (
    code === "0x"
  ) {
    return {
      address:
        normalizedAddress,
      isContract: false,
      type: "unknown",
    };
  }

  /**
   * IMPORTANT:
   *
   * Detect LP/pair contracts BEFORE ERC20 detection.
   *
   * A liquidity pair is a smart contract and may expose
   * functions that can confuse generic token detection.
   */
  const pairData =
    await detectPair(
      normalizedAddress
    );

  if (pairData) {
    const tokenAddress =
      getUnderlyingTokenFromPair(
        pairData.token0,
        pairData.token1
      );

    const tokenData =
      await readToken(
        tokenAddress
      );

    if (
      tokenData.hasTokenData
    ) {
      const tokenSecurity =
        await analyzeSecurity(
          tokenAddress
        );

      const market =
        await fetchDexScreenerData(
          tokenAddress
        );

      const liquidity =
        await analyzeLP(
          market
        );

      const holders =
        tokenData.totalSupply &&
        tokenData.decimals !==
          undefined
          ? await analyzeHolders(
              tokenAddress,
              tokenData.totalSupply,
              tokenData.decimals
            )
          : emptyHolderData();

      return {
        address:
          tokenAddress,

        isContract: true,

        type: "token",

        name:
          tokenData.name,

        symbol:
          tokenData.symbol,

        decimals:
          tokenData.decimals,

        totalSupply:
          tokenData.totalSupply,

        token0:
          pairData.token0,

        token1:
          pairData.token1,

        reserve0:
          pairData.reserve0.toString(),

        reserve1:
          pairData.reserve1.toString(),

        security:
          tokenSecurity,

        market:
          market.pairAddress
            ? market
            : {
                ...market,
                pairAddress:
                  normalizedAddress,
              },

        liquidity,

        holders,
      };
    }

    return {
      address:
        normalizedAddress,

      isContract: true,

      type: "pair",

      token0:
        pairData.token0,

      token1:
        pairData.token1,

      reserve0:
        pairData.reserve0.toString(),

      reserve1:
        pairData.reserve1.toString(),
    };
  }

  /**
   * Normal token contract.
   */
  const tokenData =
    await readToken(
      normalizedAddress
    );

  if (
    tokenData.hasTokenData
  ) {
    const security =
      await analyzeSecurity(
        normalizedAddress
      );

    const market =
      await fetchDexScreenerData(
        normalizedAddress
      );

    const liquidity =
      await analyzeLP(
        market
      );

    const holders =
      tokenData.totalSupply &&
      tokenData.decimals !==
        undefined
        ? await analyzeHolders(
            normalizedAddress,
            tokenData.totalSupply,
            tokenData.decimals
          )
        : emptyHolderData();

    return {
      address:
        normalizedAddress,

      isContract: true,

      type: "token",

      name:
        tokenData.name,

      symbol:
        tokenData.symbol,

      decimals:
        tokenData.decimals,

      totalSupply:
        tokenData.totalSupply,

      security,

      market,

      liquidity,

      holders,
    };
  }

  return {
    address:
      normalizedAddress,

    isContract: true,

    type: "contract",
  };
};