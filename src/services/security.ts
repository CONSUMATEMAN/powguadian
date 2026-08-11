import { ethers } from "ethers";
import { config } from "../config/env";

const provider = new ethers.JsonRpcProvider(
  config.bscRpcUrl
);

const SECURITY_ABI = [
  "function owner() view returns (address)",

  "function mint(address,uint256)",
  "function burn(uint256)",

  "function blacklist(address)",
  "function setBlacklist(address,bool)",
  "function isBlacklisted(address) view returns (bool)",
  "function blacklisted(address) view returns (bool)",

  "function whitelist(address)",
  "function setWhitelist(address,bool)",
  "function isWhitelisted(address) view returns (bool)",
  "function whitelisted(address) view returns (bool)",

  "function tradingEnabled() view returns (bool)",
  "function tradingOpen() view returns (bool)",
  "function swapEnabled() view returns (bool)",

  "function buyTax() view returns (uint256)",
  "function sellTax() view returns (uint256)",
  "function buyFee() view returns (uint256)",
  "function sellFee() view returns (uint256)",
  "function totalBuyTax() view returns (uint256)",
  "function totalSellTax() view returns (uint256)",
  "function totalBuyFee() view returns (uint256)",
  "function totalSellFee() view returns (uint256)",

  "function transferTax() view returns (uint256)",
  "function transferFee() view returns (uint256)",

  "function maxTxAmount() view returns (uint256)",
  "function maxTransactionAmount() view returns (uint256)",
  "function maxWallet() view returns (uint256)",
  "function maxWalletAmount() view returns (uint256)",

  "function paused() view returns (bool)",

  "function renounceOwnership()",
  "function upgradeTo(address)",
  "function upgradeToAndCall(address,bytes)",

  "function implementation() view returns (address)",
];

const PROXY_ABI = [
  "function implementation() view returns (address)",
];

export interface SecurityResult {
  riskLevel:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "UNKNOWN";

  owner: string | null;
  ownerRenounced: boolean | null;

  canMint: boolean | null;
  canBurn: boolean | null;

  hasBlacklistFunction: boolean | null;
  hasWhitelistFunction: boolean | null;

  hasTradingControl: boolean | null;
  hasTaxFunctions: boolean | null;

  hasMaxTx: boolean | null;
  hasMaxWallet: boolean | null;

  isPausable: boolean | null;

  isProxy: boolean;
  implementation: string | null;

  isOpenSource: boolean | null;
  isHoneypot: boolean | null;

  buyTax: number | null;
  sellTax: number | null;
  transferTax: number | null;

  maxTx: string | null;
  maxWallet: string | null;

  warnings: string[];
}

const isZeroAddress = (
  address: string
): boolean =>
  address.toLowerCase() ===
  ethers.ZeroAddress.toLowerCase();

const getSelector = (
  signature: string
): string | null => {
  try {
    const iface =
      new ethers.Interface([
        `function ${signature}`,
      ]);

    const functionName =
      signature.split("(")[0];

    const fragment =
      iface.getFunction(
        functionName
      );

    return fragment?.selector
      ? fragment.selector.toLowerCase()
      : null;
  } catch {
    return null;
  }
};

const bytecodeHasFunction = (
  bytecode: string,
  signature: string
): boolean => {
  const selector =
    getSelector(signature);

  if (!selector) {
    return false;
  }

  return bytecode
    .toLowerCase()
    .includes(
      selector.slice(2)
    );
};

const emptySecurityResult =
  (): SecurityResult => ({
    riskLevel: "UNKNOWN",

    owner: null,
    ownerRenounced: null,

    canMint: null,
    canBurn: null,

    hasBlacklistFunction: null,
    hasWhitelistFunction: null,

    hasTradingControl: null,
    hasTaxFunctions: null,

    hasMaxTx: null,
    hasMaxWallet: null,

    isPausable: null,

    isProxy: false,
    implementation: null,

    isOpenSource: null,
    isHoneypot: null,

    buyTax: null,
    sellTax: null,
    transferTax: null,

    maxTx: null,
    maxWallet: null,

    warnings: [],
  });

const safeReadNumber = async (
  contract: ethers.Contract,
  functionName: string
): Promise<number | null> => {
  try {
    const value =
      await contract[functionName]();

    const number =
      Number(value);

    if (
      !Number.isFinite(number)
    ) {
      return null;
    }

    return number;
  } catch {
    return null;
  }
};

const safeReadString = async (
  contract: ethers.Contract,
  functionName: string
): Promise<string | null> => {
  try {
    const value =
      await contract[functionName]();

    if (
      typeof value === "bigint"
    ) {
      return value.toString();
    }

    return String(value);
  } catch {
    return null;
  }
};

export const analyzeSecurity =
  async (
    address: string
  ): Promise<SecurityResult> => {
    const result =
      emptySecurityResult();

    if (
      !ethers.isAddress(address)
    ) {
      return result;
    }

    const normalizedAddress =
      ethers.getAddress(
        address
      );

    let bytecode: string;

    try {
      bytecode =
        await provider.getCode(
          normalizedAddress
        );
    } catch {
      return result;
    }

    if (
      bytecode === "0x"
    ) {
      return result;
    }

    const contract =
      new ethers.Contract(
        normalizedAddress,
        SECURITY_ABI,
        provider
      );

    /*
     * IMPORTANT:
     *
     * Function detection is based on the deployed
     * bytecode selectors, not merely on our ABI.
     *
     * This prevents false positives caused by
     * putting a function into the ABI ourselves.
     */

    const ownerSelector =
      bytecodeHasFunction(
        bytecode,
        "owner()"
      );

    if (
      ownerSelector
    ) {
      try {
        const owner =
          await contract.owner();

        if (
          typeof owner ===
            "string" &&
          ethers.isAddress(
            owner
          )
        ) {
          result.owner =
            ethers.getAddress(
              owner
            );

          result.ownerRenounced =
            isZeroAddress(
              owner
            );
        }
      } catch {
        result.ownerRenounced =
          null;
      }
    }

    /*
     * MINT
     */

    const mintDetected =
      bytecodeHasFunction(
        bytecode,
        "mint(address,uint256)"
      );

    result.canMint =
      mintDetected;

    /*
     * BURN
     */

    result.canBurn =
      bytecodeHasFunction(
        bytecode,
        "burn(uint256)"
      );

    /*
     * BLACKLIST
     */

    const blacklistDetected =
      bytecodeHasFunction(
        bytecode,
        "blacklist(address)"
      ) ||
      bytecodeHasFunction(
        bytecode,
        "setBlacklist(address,bool)"
      ) ||
      bytecodeHasFunction(
        bytecode,
        "isBlacklisted(address)"
      ) ||
      bytecodeHasFunction(
        bytecode,
        "blacklisted(address)"
      );

    result.hasBlacklistFunction =
      blacklistDetected;

    /*
     * WHITELIST
     */

    const whitelistDetected =
      bytecodeHasFunction(
        bytecode,
        "whitelist(address)"
      ) ||
      bytecodeHasFunction(
        bytecode,
        "setWhitelist(address,bool)"
      ) ||
      bytecodeHasFunction(
        bytecode,
        "isWhitelisted(address)"
      ) ||
      bytecodeHasFunction(
        bytecode,
        "whitelisted(address)"
      );

    result.hasWhitelistFunction =
      whitelistDetected;

    /*
     * TRADING CONTROLS
     */

    const tradingDetected =
      bytecodeHasFunction(
        bytecode,
        "tradingEnabled()"
      ) ||
      bytecodeHasFunction(
        bytecode,
        "tradingOpen()"
      ) ||
      bytecodeHasFunction(
        bytecode,
        "swapEnabled()"
      );

    result.hasTradingControl =
      tradingDetected;

    /*
     * TAX / FEE GETTERS
     */

    const buyTaxGetter =
      bytecodeHasFunction(
        bytecode,
        "buyTax()"
      );

    const sellTaxGetter =
      bytecodeHasFunction(
        bytecode,
        "sellTax()"
      );

    const buyFeeGetter =
      bytecodeHasFunction(
        bytecode,
        "buyFee()"
      );

    const sellFeeGetter =
      bytecodeHasFunction(
        bytecode,
        "sellFee()"
      );

    const totalBuyTaxGetter =
      bytecodeHasFunction(
        bytecode,
        "totalBuyTax()"
      );

    const totalSellTaxGetter =
      bytecodeHasFunction(
        bytecode,
        "totalSellTax()"
      );

    const totalBuyFeeGetter =
      bytecodeHasFunction(
        bytecode,
        "totalBuyFee()"
      );

    const totalSellFeeGetter =
      bytecodeHasFunction(
        bytecode,
        "totalSellFee()"
      );

    result.hasTaxFunctions =
      buyTaxGetter ||
      sellTaxGetter ||
      buyFeeGetter ||
      sellFeeGetter ||
      totalBuyTaxGetter ||
      totalSellTaxGetter ||
      totalBuyFeeGetter ||
      totalSellFeeGetter;

    /*
     * BUY TAX
     */

    if (
      buyTaxGetter
    ) {
      result.buyTax =
        await safeReadNumber(
          contract,
          "buyTax"
        );
    } else if (
      buyFeeGetter
    ) {
      result.buyTax =
        await safeReadNumber(
          contract,
          "buyFee"
        );
    } else if (
      totalBuyTaxGetter
    ) {
      result.buyTax =
        await safeReadNumber(
          contract,
          "totalBuyTax"
        );
    } else if (
      totalBuyFeeGetter
    ) {
      result.buyTax =
        await safeReadNumber(
          contract,
          "totalBuyFee"
        );
    }

    /*
     * SELL TAX
     */

    if (
      sellTaxGetter
    ) {
      result.sellTax =
        await safeReadNumber(
          contract,
          "sellTax"
        );
    } else if (
      sellFeeGetter
    ) {
      result.sellTax =
        await safeReadNumber(
          contract,
          "sellFee"
        );
    } else if (
      totalSellTaxGetter
    ) {
      result.sellTax =
        await safeReadNumber(
          contract,
          "totalSellTax"
        );
    } else if (
      totalSellFeeGetter
    ) {
      result.sellTax =
        await safeReadNumber(
          contract,
          "totalSellFee"
        );
    }

    /*
     * TRANSFER TAX
     */

    const transferTaxGetter =
      bytecodeHasFunction(
        bytecode,
        "transferTax()"
      );

    const transferFeeGetter =
      bytecodeHasFunction(
        bytecode,
        "transferFee()"
      );

    if (
      transferTaxGetter
    ) {
      result.transferTax =
        await safeReadNumber(
          contract,
          "transferTax"
        );
    } else if (
      transferFeeGetter
    ) {
      result.transferTax =
        await safeReadNumber(
          contract,
          "transferFee"
        );
    }

    /*
     * MAX TRANSACTION
     */

    const maxTxAmountGetter =
      bytecodeHasFunction(
        bytecode,
        "maxTxAmount()"
      );

    const maxTransactionAmountGetter =
      bytecodeHasFunction(
        bytecode,
        "maxTransactionAmount()"
      );

    result.hasMaxTx =
      maxTxAmountGetter ||
      maxTransactionAmountGetter;

    if (
      maxTxAmountGetter
    ) {
      result.maxTx =
        await safeReadString(
          contract,
          "maxTxAmount"
        );
    } else if (
      maxTransactionAmountGetter
    ) {
      result.maxTx =
        await safeReadString(
          contract,
          "maxTransactionAmount"
        );
    }

    /*
     * MAX WALLET
     */

    const maxWalletGetter =
      bytecodeHasFunction(
        bytecode,
        "maxWallet()"
      );

    const maxWalletAmountGetter =
      bytecodeHasFunction(
        bytecode,
        "maxWalletAmount()"
      );

    result.hasMaxWallet =
      maxWalletGetter ||
      maxWalletAmountGetter;

    if (
      maxWalletGetter
    ) {
      result.maxWallet =
        await safeReadString(
          contract,
          "maxWallet"
        );
    } else if (
      maxWalletAmountGetter
    ) {
      result.maxWallet =
        await safeReadString(
          contract,
          "maxWalletAmount"
        );
    }

    /*
     * PAUSABLE
     */

    const pausedGetter =
      bytecodeHasFunction(
        bytecode,
        "paused()"
      );

    result.isPausable =
      pausedGetter;

    /*
     * PROXY
     */

    const proxyContract =
      new ethers.Contract(
        normalizedAddress,
        PROXY_ABI,
        provider
      );

    try {
      const implementation =
        await proxyContract.implementation();

      if (
        typeof implementation ===
          "string" &&
        ethers.isAddress(
          implementation
        ) &&
        !isZeroAddress(
          implementation
        ) &&
        implementation.toLowerCase() !==
          normalizedAddress.toLowerCase()
      ) {
        result.isProxy =
          true;

        result.implementation =
          ethers.getAddress(
            implementation
          );
      }
    } catch {
      result.isProxy =
        false;
    }

    /*
     * Open-source verification is provided
     * by scanner/BscScan enrichment.
     */

    result.isOpenSource =
      null;

    result.isHoneypot =
      null;

    /*
     * SECURITY WARNINGS
     *
     * Do not automatically classify every detected
     * function as HIGH risk.
     */

    if (
      result.ownerRenounced ===
      false
    ) {
      result.warnings.push(
        "Ownership is still active"
      );
    }

    if (
      result.canMint ===
      true
    ) {
      result.warnings.push(
        "Mint capability detected"
      );
    }

    if (
      result.hasBlacklistFunction ===
      true
    ) {
      result.warnings.push(
        "Blacklist capability detected"
      );
    }

    if (
      result.hasWhitelistFunction ===
      true
    ) {
      result.warnings.push(
        "Whitelist capability detected"
      );
    }

    if (
      result.hasTradingControl ===
      true
    ) {
      result.warnings.push(
        "Trading control detected"
      );
    }

    if (
      result.isProxy
    ) {
      result.warnings.push(
        "Upgradeable proxy detected"
      );
    }

    if (
      result.isPausable
    ) {
      result.warnings.push(
        "Pause control detected"
      );
    }

    /*
     * RISK SCORE
     *
     * Function presence alone is not automatically HIGH.
     */

    let score = 0;

    if (
      result.ownerRenounced ===
      false
    ) {
      score += 1;
    }

    if (
      result.canMint ===
      true
    ) {
      score += 1;
    }

    if (
      result.hasBlacklistFunction ===
      true
    ) {
      score += 1;
    }

    if (
      result.hasWhitelistFunction ===
      true
    ) {
      score += 1;
    }

    if (
      result.hasTradingControl ===
      true
    ) {
      score += 1;
    }

    if (
      result.isProxy
    ) {
      score += 2;
    }

    if (
      result.isPausable
    ) {
      score += 1;
    }

    if (
      result.buyTax !== null &&
      result.buyTax > 10
    ) {
      score += 2;
    }

    if (
      result.sellTax !== null &&
      result.sellTax > 10
    ) {
      score += 2;
    }

    if (
      result.buyTax !== null &&
      result.buyTax > 20
    ) {
      score += 2;
    }

    if (
      result.sellTax !== null &&
      result.sellTax > 20
    ) {
      score += 2;
    }

    if (
      score >= 7
    ) {
      result.riskLevel =
        "HIGH";
    } else if (
      score >= 3
    ) {
      result.riskLevel =
        "MEDIUM";
    } else {
      result.riskLevel =
        "LOW";
    }

    return result;
  };