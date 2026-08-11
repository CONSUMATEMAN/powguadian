import { ethers } from "ethers";
import { config } from "../config/env";
import {
  analyzeSecurity,
  SecurityResult,
} from "./security";

const provider =
  new ethers.JsonRpcProvider(
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

const LOCKER_ABI = [
  "function unlockTime() view returns (uint256)",
  "function lockEndTime() view returns (uint256)",
  "function endTime() view returns (uint256)",
  "function getUnlockTime() view returns (uint256)",
  "function lockedUntil() view returns (uint256)",
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
  result?: unknown;
}

interface BscScanHolder {
  TokenHolderAddress?: string;
  TokenHolderQuantity?: string;
  address?: string;
  quantity?: string;
}

interface BscScanSource {
  SourceCode?: string;
  ContractName?: string;
  ABI?: string;
  Proxy?: string;
  Implementation?: string;
}

interface SocialLinks {
  website: string | null;
  telegram: string | null;
  twitter: string | null;
  discord: string | null;
  github: string | null;
  youtube: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
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

  tokenReserve: number | null;
  tokenInPoolPercent: number | null;

  website: string | null;
  telegram: string | null;
  twitter: string | null;
  discord: string | null;
  github: string | null;
  youtube: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
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

  lpAmount: number | null;
  lpTotalSupply: string | null;

  lockProvider: string | null;
}

export interface TopHolder {
  address: string;
  percent: number;
}

export interface HolderData {
  holders: number | null;

  top1: number | null;
  top5: number | null;
  top10: number | null;
  top20: number | null;

  topHolders: TopHolder[];

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

  socials?: SocialLinks;

  sourceVerified?: boolean;

  launchTime?: number | null;
}

const emptySocialLinks =
  (): SocialLinks => ({
    website: null,
    telegram: null,
    twitter: null,
    discord: null,
    github: null,
    youtube: null,
    instagram: null,
    facebook: null,
    tiktok: null,
  });

const emptyMarketData =
  (): MarketData => ({
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

    tokenReserve: null,
    tokenInPoolPercent: null,

    website: null,
    telegram: null,
    twitter: null,
    discord: null,
    github: null,
    youtube: null,
    instagram: null,
    facebook: null,
    tiktok: null,
  });

const emptyLPData =
  (): LPData => ({
    status: "UNKNOWN",

    lockedUntil: null,
    durationDays: null,
    remainingDays: null,

    lpBurned: false,
    lpBurnPercent: null,

    lpAmount: null,
    lpTotalSupply: null,

    lockProvider: null,
  });

const emptyHolderData =
  (): HolderData => ({
    holders: null,

    top1: null,
    top5: null,
    top10: null,
    top20: null,

    topHolders: [],

    burnedPercent: null,
    ownerHoldingsPercent: null,
  });

export const extractAddresses =
  (
    text: string
  ): string[] => {
    const matches =
      text.match(
        /0x[a-fA-F0-9]{40}/g
      ) ?? [];

    const uniqueAddresses =
      new Set<string>();

    for (
      const address of matches
    ) {
      try {
        uniqueAddresses.add(
          ethers.getAddress(
            address
          )
        );
      } catch {
        // Ignore invalid addresses.
      }
    }

    return Array.from(
      uniqueAddresses
    );
  };

const getBscScanApiKey =
  (): string | null => {
    const key =
      process.env.BSCSCAN_API_KEY;

    return key &&
      key.trim().length > 0
      ? key.trim()
      : null;
  };

const detectPair =
  async (
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

const getUnderlyingTokenFromPair =
  (
    token0: string,
    token1: string
  ): string => {
    if (
      token0.toLowerCase() ===
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

    return token0;
  };

const fetchDexScreenerData =
  async (
    tokenAddress: string,
    totalSupply?: string,
    decimals?: number
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

      /*
       * Prefer actual market cap.
       *
       * If DexScreener doesn't provide it,
       * calculate it from price × total supply.
       *
       * Do NOT silently use FDV as market cap.
       */

      if (
        pair?.marketCap != null &&
        Number.isFinite(
          Number(pair.marketCap)
        )
      ) {
        market.marketCap =
          Number(pair.marketCap);
      } else if (
        market.priceUsd !== null &&
        totalSupply &&
        decimals !== undefined
      ) {
        const supply =
          Number(totalSupply);

        if (
          Number.isFinite(
            supply
          )
        ) {
          market.marketCap =
            market.priceUsd *
            supply;
        }
      }

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
          type.includes(
            "telegram"
          ) &&
          !market.telegram
        ) {
          market.telegram =
            social.url;
        }

        if (
          (
            type.includes(
              "twitter"
            ) ||
            type === "x"
          ) &&
          !market.twitter
        ) {
          market.twitter =
            social.url;
        }

        if (
          type.includes(
            "discord"
          ) &&
          !market.discord
        ) {
          market.discord =
            social.url;
        }

        if (
          type.includes(
            "github"
          ) &&
          !market.github
        ) {
          market.github =
            social.url;
        }

        if (
          type.includes(
            "youtube"
          ) &&
          !market.youtube
        ) {
          market.youtube =
            social.url;
        }

        if (
          type.includes(
            "instagram"
          ) &&
          !market.instagram
        ) {
          market.instagram =
            social.url;
        }

        if (
          type.includes(
            "facebook"
          ) &&
          !market.facebook
        ) {
          market.facebook =
            social.url;
        }

        if (
          type.includes(
            "tiktok"
          ) &&
          !market.tiktok
        ) {
          market.tiktok =
            social.url;
        }
      }

      if (
        market.marketCap !== null &&
        market.marketCap > 0 &&
        market.liquidityUsd !== null
      ) {
        market.lpRatio =
          (
            market.liquidityUsd /
            market.marketCap
          ) * 100;
      }

      if (
        market.pairAddress
      ) {
        await enrichPairData(
          market,
          market.pairAddress,
          tokenAddress,
          decimals,
          totalSupply
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

const enrichPairData =
  async (
    market: MarketData,
    pairAddress: string,
    tokenAddress: string,
    decimals?: number,
    totalSupply?: string
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

      let tokenReserve =
        0n;

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

        if (
          token1.toLowerCase() ===
          tokenAddress.toLowerCase()
        ) {
          tokenReserve =
            reserves[1];
        }
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

        if (
          token0.toLowerCase() ===
          tokenAddress.toLowerCase()
        ) {
          tokenReserve =
            reserves[0];
        }
      }

      if (
        wbnbReserve > 0
      ) {
        market.lpBnb =
          wbnbReserve;
      }

      if (
        tokenReserve > 0n &&
        decimals !== undefined
      ) {
        market.tokenReserve =
          Number(
            ethers.formatUnits(
              tokenReserve,
              decimals
            )
          );

        if (
          totalSupply
        ) {
          const supply =
            Number(
              totalSupply
            );

          if (
            Number.isFinite(
              supply
            ) &&
            supply > 0
          ) {
            market.tokenInPoolPercent =
              (
                market.tokenReserve /
                supply
              ) * 100;
          }
        }
      }
    } catch {
      // Pair enrichment is supplementary.
    }
  };

const getContractSource =
  async (
    address: string
  ): Promise<{
    verified: boolean;
    sourceCode: string | null;
    contractName: string | null;
  }> => {
    const result = {
      verified: false,
      sourceCode: null as string | null,
      contractName: null as string | null,
    };

    const apiKey =
      getBscScanApiKey();

    if (!apiKey) {
      return result;
    }

    try {
      const url =
        `https://api.bscscan.com/api` +
        `?module=contract` +
        `&action=getsourcecode` +
        `&address=${address}` +
        `&apikey=${apiKey}`;

      const response =
        await fetch(url);

      if (!response.ok) {
        return result;
      }

      const data =
        (await response.json()) as BscScanResponse;

      if (
        !Array.isArray(
          data.result
        ) ||
        data.result.length === 0
      ) {
        return result;
      }

      const item =
        data.result[0] as BscScanSource;

      const source =
        item?.SourceCode ?? "";

      if (
        source.trim().length > 0
      ) {
        result.verified =
          true;

        result.sourceCode =
          source;

        result.contractName =
          item.ContractName ??
          null;
      }
    } catch (error) {
      console.error(
        "Source verification request failed:",
        error
      );
    }

    return result;
  };

const extractSocialLinks =
  (
    sourceCode: string | null
  ): SocialLinks => {
    const result =
      emptySocialLinks();

    if (
      !sourceCode
    ) {
      return result;
    }

    const urls =
      sourceCode.match(
        /https?:\/\/[^\s"'<>\\)]+/gi
      ) ?? [];

    for (
      const rawUrl of urls
    ) {
      const url =
        rawUrl.replace(
          /[),.;]+$/,
          ""
        );

      const lower =
        url.toLowerCase();

      if (
        (
          lower.includes(
            "twitter.com"
          ) ||
          lower.includes(
            "x.com"
          )
        ) &&
        !result.twitter
      ) {
        result.twitter =
          url;
      } else if (
        lower.includes(
          "t.me"
        ) ||
        lower.includes(
          "telegram.me"
        ) ||
        lower.includes(
          "telegram."
        )
      ) {
        if (
          !result.telegram
        ) {
          result.telegram =
            url;
        }
      } else if (
        lower.includes(
          "discord"
        ) &&
        !result.discord
      ) {
        result.discord =
          url;
      } else if (
        lower.includes(
          "github.com"
        ) &&
        !result.github
      ) {
        result.github =
          url;
      } else if (
        lower.includes(
          "youtube.com"
        ) ||
        lower.includes(
          "youtu.be"
        )
      ) {
        if (
          !result.youtube
        ) {
          result.youtube =
            url;
        }
      } else if (
        lower.includes(
          "instagram.com"
        ) &&
        !result.instagram
      ) {
        result.instagram =
          url;
      } else if (
        lower.includes(
          "facebook.com"
        ) &&
        !result.facebook
      ) {
        result.facebook =
          url;
      } else if (
        lower.includes(
          "tiktok.com"
        ) &&
        !result.tiktok
      ) {
        result.tiktok =
          url;
      } else if (
        !result.website &&
        !lower.includes(
          "bscscan.com"
        ) &&
        !lower.includes(
          "etherscan.io"
        )
      ) {
        result.website =
          url;
      }
    }

    return result;
  };

const mergeSocialLinks =
  (
    primary: SocialLinks,
    secondary: SocialLinks
  ): SocialLinks => ({
    website:
      primary.website ??
      secondary.website,

    telegram:
      primary.telegram ??
      secondary.telegram,

    twitter:
      primary.twitter ??
      secondary.twitter,

    discord:
      primary.discord ??
      secondary.discord,

    github:
      primary.github ??
      secondary.github,

    youtube:
      primary.youtube ??
      secondary.youtube,

    instagram:
      primary.instagram ??
      secondary.instagram,

    facebook:
      primary.facebook ??
      secondary.facebook,

    tiktok:
      primary.tiktok ??
      secondary.tiktok,
  });

const getUnlockTime =
  async (
    address: string
  ): Promise<number | null> => {
    try {
      const locker =
        new ethers.Contract(
          address,
          LOCKER_ABI,
          provider
        );

      const methods = [
        "unlockTime",
        "lockEndTime",
        "endTime",
        "getUnlockTime",
        "lockedUntil",
      ];

      for (
        const method of methods
      ) {
        try {
          const value =
            await locker[method]();

          const timestamp =
            Number(value);

          if (
            Number.isFinite(
              timestamp
            ) &&
            timestamp > 0
          ) {
            return timestamp;
          }
        } catch {
          // Try next common locker method.
        }
      }
    } catch {
      // Not a readable locker.
    }

    return null;
  };

const getBscScanHolders =
  async (
    tokenAddress: string,
    page = 1,
    offset = 20
  ): Promise<BscScanHolder[]> => {
    const apiKey =
      getBscScanApiKey();

    if (!apiKey) {
      return [];
    }

    try {
      const url =
        `https://api.bscscan.com/api` +
        `?module=token` +
        `&action=tokenholderlist` +
        `&contractaddress=${tokenAddress}` +
        `&page=${page}` +
        `&offset=${offset}` +
        `&apikey=${apiKey}`;

      const response =
        await fetch(url);

      if (!response.ok) {
        return [];
      }

      const data =
        (await response.json()) as BscScanResponse;

      if (
        !Array.isArray(
          data.result
        )
      ) {
        return [];
      }

      return data.result as BscScanHolder[];
    } catch (error) {
      console.error(
        "Holder list request failed:",
        error
      );

      return [];
    }
  };

const analyzeLP =
  async (
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

      result.lpTotalSupply =
        lpSupply.toString();

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
          // Ignore.
        }
      }

      if (
        burnedBalance > 0n
      ) {
        const burnPercent =
          Number(
            ethers.formatUnits(
              (
                burnedBalance *
                10000n
              ) /
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

          result.lpAmount =
            Number(
              ethers.formatEther(
                burnedBalance
              )
            );

          return result;
        }
      }

      const holders =
        await getBscScanHolders(
          market.pairAddress,
          1,
          20
        );

      for (
        const holder of holders
      ) {
        const holderAddress =
          holder.TokenHolderAddress ??
          holder.address;

        const quantity =
          holder.TokenHolderQuantity ??
          holder.quantity;

        if (
          !holderAddress ||
          !quantity ||
          !ethers.isAddress(
            holderAddress
          )
        ) {
          continue;
        }

        const normalizedHolder =
          ethers.getAddress(
            holderAddress
          );

        if (
          DEAD_ADDRESSES.includes(
            normalizedHolder.toLowerCase()
          )
        ) {
          continue;
        }

        const balance =
          BigInt(quantity);

        if (
          balance === 0n
        ) {
          continue;
        }

        const code =
          await provider.getCode(
            normalizedHolder
          );

        if (
          code === "0x"
        ) {
          continue;
        }

        const unlockTime =
          await getUnlockTime(
            normalizedHolder
          );

        if (
          unlockTime !== null
        ) {
          const now =
            Math.floor(
              Date.now() / 1000
            );

          const lockedDate =
            new Date(
              unlockTime * 1000
            );

          result.lockedUntil =
            lockedDate.toISOString();

          result.durationDays =
            Math.max(
              0,
              Math.round(
                (
                  unlockTime -
                  now
                ) /
                  86400
              )
            );

          result.remainingDays =
            result.durationDays;

          if (
            unlockTime > now
          ) {
            result.status =
              "LOCKED";
          } else {
            result.status =
              "EXPIRED";
          }

          result.lockProvider =
            normalizedHolder;

          result.lpAmount =
            Number(
              ethers.formatEther(
                balance
              )
            );

          return result;
        }
      }
    } catch {
      // Leave LP status UNKNOWN.
    }

    return result;
  };

const analyzeHolders =
  async (
    tokenAddress: string,
    totalSupply: string,
    decimals: number,
    ownerAddress?: string | null,
    pairAddress?: string | null
  ): Promise<HolderData> => {
    const result =
      emptyHolderData();

    const apiKey =
      getBscScanApiKey();

    if (!apiKey) {
      return result;
    }

    try {
      const countUrl =
        `https://api.bscscan.com/api` +
        `?module=token` +
        `&action=tokenholdercount` +
        `&contractaddress=${tokenAddress}` +
        `&apikey=${apiKey}`;

      const countResponse =
        await fetch(
          countUrl
        );

      if (
        countResponse.ok
      ) {
        const countData =
          (await countResponse.json()) as BscScanResponse;

        if (
          countData?.status ===
            "1" &&
          typeof countData.result ===
            "string"
        ) {
          const holders =
            Number(
              countData.result
            );

          if (
            Number.isFinite(
              holders
            )
          ) {
            result.holders =
              holders;
          }
        }
      }

      const holderList =
        await getBscScanHolders(
          tokenAddress,
          1,
          20
        );

      const supply =
        Number(
          totalSupply
        );

      if (
        !Number.isFinite(
          supply
        ) ||
        supply <= 0
      ) {
        return result;
      }

      const excluded =
        new Set(
          DEAD_ADDRESSES
        );

      if (
        pairAddress &&
        ethers.isAddress(
          pairAddress
        )
      ) {
        excluded.add(
          pairAddress.toLowerCase()
        );
      }

      const topHolders:
        TopHolder[] = [];

      let runningPercent =
        0;

      for (
        const holder of
          holderList
      ) {
        const holderAddress =
          holder.TokenHolderAddress ??
          holder.address;

        const quantity =
          holder.TokenHolderQuantity ??
          holder.quantity;

        if (
          !holderAddress ||
          !quantity ||
          !ethers.isAddress(
            holderAddress
          )
        ) {
          continue;
        }

        const normalized =
          ethers.getAddress(
            holderAddress
          );

        if (
          excluded.has(
            normalized.toLowerCase()
          )
        ) {
          continue;
        }

        const rawBalance =
          Number(
            quantity
          );

        const balance =
          rawBalance /
          10 ** decimals;

        if (
          !Number.isFinite(
            balance
          )
        ) {
          continue;
        }

        const percent =
          (
            balance /
            supply
          ) * 100;

        if (
          !Number.isFinite(
            percent
          )
        ) {
          continue;
        }

        topHolders.push({
          address:
            normalized,
          percent,
        });

        runningPercent +=
          percent;

        if (
          topHolders.length >=
          20
        ) {
          break;
        }
      }

      result.topHolders =
        topHolders;

      result.top1 =
        topHolders[0]?.percent ??
        null;

      result.top5 =
        topHolders
          .slice(0, 5)
          .reduce(
            (sum, holder) =>
              sum +
              holder.percent,
            0
          );

      result.top10 =
        topHolders
          .slice(0, 10)
          .reduce(
            (sum, holder) =>
              sum +
              holder.percent,
            0
          );

      result.top20 =
        runningPercent;

      let burned =
        0;

      for (
        const holder of
          holderList
      ) {
        const holderAddress =
          holder.TokenHolderAddress ??
          holder.address;

        const quantity =
          holder.TokenHolderQuantity ??
          holder.quantity;

        if (
          !holderAddress ||
          !quantity ||
          !ethers.isAddress(
            holderAddress
          )
        ) {
          continue;
        }

        if (
          DEAD_ADDRESSES.includes(
            holderAddress.toLowerCase()
          )
        ) {
          const balance =
            Number(
              quantity
            ) /
            10 ** decimals;

          if (
            Number.isFinite(
              balance
            )
          ) {
            burned +=
              balance;
          }
        }
      }

      if (
        burned > 0
      ) {
        result.burnedPercent =
          (
            burned /
            supply
          ) * 100;
      }

      if (
        ownerAddress &&
        ethers.isAddress(
          ownerAddress
        )
      ) {
        for (
          const holder of
            holderList
        ) {
          const holderAddress =
            holder.TokenHolderAddress ??
            holder.address;

          const quantity =
            holder.TokenHolderQuantity ??
            holder.quantity;

          if (
            holderAddress &&
            quantity &&
            holderAddress.toLowerCase() ===
              ownerAddress.toLowerCase()
          ) {
            const balance =
              Number(
                quantity
              ) /
              10 ** decimals;

            if (
              Number.isFinite(
                balance
              )
            ) {
              result.ownerHoldingsPercent =
                (
                  balance /
                  supply
                ) * 100;
            }

            break;
          }
        }
      }
    } catch (error) {
      console.error(
        "Holder analysis failed:",
        error
      );
    }

    return result;
  };

const readToken =
  async (
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
      // Ignore.
    }

    try {
      result.symbol =
        await token.symbol();

      hasTokenData =
        true;
    } catch {
      // Ignore.
    }

    try {
      result.decimals =
        Number(
          await token.decimals()
        );

      hasTokenData =
        true;
    } catch {
      // Ignore.
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
      // Ignore.
    }

    result.hasTokenData =
      hasTokenData;

    return result;
  };

export const scanContract =
  async (
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
      ethers.getAddress(
        address
      );

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

    /*
     * Detect pair first.
     */

    const pairData =
      await detectPair(
        normalizedAddress
      );

    if (
      pairData
    ) {
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
        const security =
          await analyzeSecurity(
            tokenAddress
          );

        const market =
          await fetchDexScreenerData(
            tokenAddress,
            tokenData.totalSupply,
            tokenData.decimals
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
                tokenData.decimals,
                security.owner,
                market.pairAddress
              )
            : emptyHolderData();

        const source =
          await getContractSource(
            tokenAddress
          );

        const sourceSocials =
          extractSocialLinks(
            source.sourceCode
          );

        const marketSocials: SocialLinks = {
          website:
            market.website,
          telegram:
            market.telegram,
          twitter:
            market.twitter,
          discord:
            market.discord,
          github:
            market.github,
          youtube:
            market.youtube,
          instagram:
            market.instagram,
          facebook:
            market.facebook,
          tiktok:
            market.tiktok,
        };

        const socials =
          mergeSocialLinks(
            marketSocials,
            sourceSocials
          );

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

          security,

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

          socials,

          sourceVerified:
            source.verified,

          launchTime:
            market.pairCreatedAt,
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

    /*
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
          normalizedAddress,
          tokenData.totalSupply,
          tokenData.decimals
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
              tokenData.decimals,
              security.owner,
              market.pairAddress
            )
          : emptyHolderData();

      const source =
        await getContractSource(
          normalizedAddress
        );

      const sourceSocials =
        extractSocialLinks(
          source.sourceCode
        );

      const marketSocials: SocialLinks = {
        website:
          market.website,
        telegram:
          market.telegram,
        twitter:
          market.twitter,
        discord:
          market.discord,
        github:
          market.github,
        youtube:
          market.youtube,
        instagram:
          market.instagram,
        facebook:
          market.facebook,
        tiktok:
          market.tiktok,
      };

      const socials =
        mergeSocialLinks(
          marketSocials,
          sourceSocials
        );

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

        socials,

        sourceVerified:
          source.verified,

        launchTime:
          market.pairCreatedAt,
      };
    }

    return {
      address:
        normalizedAddress,

      isContract: true,

      type: "contract",
    };
  };