import { ethers } from "ethers";
import { config } from "../config/env";

const provider = new ethers.JsonRpcProvider(
  config.bscRpcUrl
);

const ERC20_ABI = [
  "function owner() view returns (address)",
  "function mint(address,uint256)",
  "function burn(uint256)",
  "function blacklist(address)",
  "function setBlacklist(address,bool)",
  "function tradingEnabled() view returns (bool)",
  "function tradingOpen() view returns (bool)",
  "function swapEnabled() view returns (bool)",
  "function buyTax() view returns (uint256)",
  "function sellTax() view returns (uint256)",
  "function buyFee() view returns (uint256)",
  "function sellFee() view returns (uint256)",
];

const PROXY_ABI = [
  "function implementation() view returns (address)",
];

export interface SecurityResult {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

  owner: string | null;
  ownerRenounced: boolean | null;

  canMint: boolean | null;
  canBurn: boolean | null;

  hasBlacklistFunction: boolean | null;
  hasTradingControl: boolean | null;
  hasTaxFunctions: boolean | null;

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

const isZeroAddress = (address: string): boolean =>
  address.toLowerCase() === ethers.ZeroAddress.toLowerCase();

const hasFunction = (
  contract: ethers.Contract,
  signature: string
): boolean => {
  try {
    const functionName = signature.split("(")[0];

    return (
      contract.interface.getFunction(functionName) !== null
    );
  } catch {
    return false;
  }
};

const emptySecurityResult = (): SecurityResult => ({
  riskLevel: "UNKNOWN",

  owner: null,
  ownerRenounced: null,

  canMint: null,
  canBurn: null,

  hasBlacklistFunction: null,
  hasTradingControl: null,
  hasTaxFunctions: null,

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

export const analyzeSecurity = async (
  address: string
): Promise<SecurityResult> => {
  const result = emptySecurityResult();

  if (!ethers.isAddress(address)) {
    return result;
  }

  const normalizedAddress = ethers.getAddress(address);

  const contract = new ethers.Contract(
    normalizedAddress,
    ERC20_ABI,
    provider
  );

  /*
   * OWNERSHIP
   */
  if (hasFunction(contract, "owner()")) {
    try {
      const owner = await contract.owner();

      if (
        typeof owner === "string" &&
        ethers.isAddress(owner)
      ) {
        result.owner = ethers.getAddress(owner);

        result.ownerRenounced =
          isZeroAddress(owner);

        if (!result.ownerRenounced) {
          result.warnings.push(
            "Contract ownership appears to remain active."
          );
        }
      }
    } catch {
      result.warnings.push(
        "Ownership could not be verified."
      );
    }
  }

  /*
   * MINT
   */
  result.canMint = hasFunction(
    contract,
    "mint(address,uint256)"
  );

  if (result.canMint) {
    result.warnings.push(
      "Mint functionality was detected."
    );
  }

  /*
   * BURN
   */
  result.canBurn = hasFunction(
    contract,
    "burn(uint256)"
  );

  /*
   * BLACKLIST
   */
  result.hasBlacklistFunction =
    hasFunction(
      contract,
      "blacklist(address)"
    ) ||
    hasFunction(
      contract,
      "setBlacklist(address,bool)"
    );

  if (result.hasBlacklistFunction) {
    result.warnings.push(
      "Blacklist functionality was detected."
    );
  }

  /*
   * TRADING CONTROL
   */
  result.hasTradingControl =
    hasFunction(
      contract,
      "tradingEnabled()"
    ) ||
    hasFunction(
      contract,
      "tradingOpen()"
    ) ||
    hasFunction(
      contract,
      "swapEnabled()"
    );

  if (result.hasTradingControl) {
    result.warnings.push(
      "Trading-control functionality was detected."
    );
  }

  /*
   * TAX / FEE FUNCTIONS
   */
  const hasBuyTax =
    hasFunction(contract, "buyTax()") ||
    hasFunction(contract, "buyFee()");

  const hasSellTax =
    hasFunction(contract, "sellTax()") ||
    hasFunction(contract, "sellFee()");

  result.hasTaxFunctions =
    hasBuyTax || hasSellTax;

  /*
   * READ BUY TAX
   */
  if (hasFunction(contract, "buyTax()")) {
    try {
      result.buyTax = Number(
        await contract.buyTax()
      );
    } catch {}
  } else if (
    hasFunction(contract, "buyFee()")
  ) {
    try {
      result.buyTax = Number(
        await contract.buyFee()
      );
    } catch {}
  }

  /*
   * READ SELL TAX
   */
  if (hasFunction(contract, "sellTax()")) {
    try {
      result.sellTax = Number(
        await contract.sellTax()
      );
    } catch {}
  } else if (
    hasFunction(contract, "sellFee()")
  ) {
    try {
      result.sellTax = Number(
        await contract.sellFee()
      );
    } catch {}
  }

  if (result.hasTaxFunctions) {
    result.warnings.push(
      "Buy/sell tax or fee functionality was detected."
    );
  }

  /*
   * PROXY
   */
  const proxyContract = new ethers.Contract(
    normalizedAddress,
    PROXY_ABI,
    provider
  );

  try {
    const implementation =
      await proxyContract.implementation();

    if (
      typeof implementation === "string" &&
      ethers.isAddress(implementation) &&
      !isZeroAddress(implementation)
    ) {
      result.isProxy = true;

      result.implementation =
        ethers.getAddress(implementation);

      result.warnings.push(
        "Proxy implementation was detected."
      );
    }
  } catch {
    result.isProxy = false;
  }

  /*
   * These cannot be reliably determined from
   * simple ABI inspection alone.
   *
   * Keep them UNKNOWN instead of inventing data.
   */
  result.isOpenSource = null;
  result.isHoneypot = null;
  result.transferTax = null;
  result.maxTx = null;
  result.maxWallet = null;

  /*
   * RISK SCORE
   *
   * Important:
   * The presence of a function does NOT automatically
   * mean the token is malicious.
   *
   * We therefore keep the score conservative.
   */
  let score = 0;

  if (result.ownerRenounced === false) {
    score += 1;
  }

  if (result.canMint === true) {
    score += 2;
  }

  if (result.hasBlacklistFunction === true) {
    score += 2;
  }

  if (result.hasTradingControl === true) {
    score += 1;
  }

  if (result.isProxy === true) {
    score += 1;
  }

  if (score >= 5) {
    result.riskLevel = "HIGH";
  } else if (score >= 2) {
    result.riskLevel = "MEDIUM";
  } else {
    result.riskLevel = "LOW";
  }

  return result;
};