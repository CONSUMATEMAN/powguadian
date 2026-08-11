import { ethers } from "ethers";
import { config } from "../config/env";

const provider = new ethers.JsonRpcProvider(
  config.bscRpcUrl
);

const SECURITY_ABI = [
  "function owner() view returns (address)",
  "function getOwner() view returns (address)",
  "function _owner() view returns (address)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
];

export interface SecurityResult {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

  owner: string | null;
  ownerRenounced: boolean;

  buyTax: number | null;
  sellTax: number | null;

  canBurn: boolean;
  hasTaxFunctions: boolean;
  isHoneypot: boolean;
  isOpenSource: boolean;
  transferTax: number | null;

  canMint: boolean;
  hasBlacklistFunction: boolean;
  hasWhitelistFunction: boolean;
  hasTradingControl: boolean;
  isProxy: boolean;
  isPausable: boolean;

  sourceVerified: boolean;

  findings: string[];
}

const emptySecurityResult = (): SecurityResult => ({
  riskLevel: "UNKNOWN",

  owner: null,
  ownerRenounced: false,

  buyTax: null,
  sellTax: null,

  canBurn: false,
  hasTaxFunctions: false,
  isHoneypot: false,
  isOpenSource: false,
  transferTax: null,

  canMint: false,
  hasBlacklistFunction: false,
  hasWhitelistFunction: false,
  hasTradingControl: false,
  isProxy: false,
  isPausable: false,

  sourceVerified: false,

  findings: [],
});

const getBscScanApiKey = (): string | null => {
  const key = process.env.BSCSCAN_API_KEY;

  return key && key.trim().length > 0
    ? key.trim()
    : null;
};

const getContractSource = async (
  address: string
): Promise<{
  verified: boolean;
  sourceCode: string;
  contractName: string | null;
  proxy: boolean;
  implementation: string | null;
}> => {
  const empty = {
    verified: false,
    sourceCode: "",
    contractName: null,
    proxy: false,
    implementation: null,
  };

  const apiKey = getBscScanApiKey();

  if (!apiKey) {
    return empty;
  }

  try {
    const url =
      "https://api.bscscan.com/api" +
      `?module=contract` +
      `&action=getsourcecode` +
      `&address=${encodeURIComponent(address)}` +
      `&apikey=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url);

    if (!response.ok) {
      return empty;
    }

    const data = (await response.json()) as {
      status?: string;
      message?: string;
      result?: unknown;
    };

    if (
      !Array.isArray(data.result) ||
      data.result.length === 0
    ) {
      return empty;
    }

    const item = data.result[0] as {
      SourceCode?: string;
      ContractName?: string;
      Proxy?: string;
      Implementation?: string;
    };

    const source = item.SourceCode ?? "";

    const proxy =
      String(item.Proxy ?? "") === "1";

    const implementation =
      item.Implementation &&
      ethers.isAddress(item.Implementation)
        ? ethers.getAddress(item.Implementation)
        : null;

    return {
      verified: source.trim().length > 0,
      sourceCode: source,
      contractName:
        item.ContractName ?? null,
      proxy,
      implementation,
    };
  } catch (error) {
    console.error(
      "Security source request failed:",
      error
    );

    return empty;
  }
};

const readOwner = async (
  address: string
): Promise<string | null> => {
  const contract = new ethers.Contract(
    address,
    SECURITY_ABI,
    provider
  );

  const methods = [
    "owner",
    "getOwner",
    "_owner",
  ];

  for (const method of methods) {
    try {
      const value = await contract[method]();

      if (
        typeof value === "string" &&
        ethers.isAddress(value)
      ) {
        return ethers.getAddress(value);
      }
    } catch {
      // Try the next method.
    }
  }

  return null;
};

const sourceHas = (
  source: string,
  patterns: RegExp[]
): boolean => {
  return patterns.some((pattern) =>
    pattern.test(source)
  );
};

const detectSecurityFeatures = (
  source: string
): {
  canMint: boolean;
  canBurn: boolean;
  hasBlacklistFunction: boolean;
  hasWhitelistFunction: boolean;
  hasTradingControl: boolean;
  isPausable: boolean;
  hasTaxFunctions: boolean;
} => {
  if (!source) {
    return {
      canMint: false,
      canBurn: false,
      hasBlacklistFunction: false,
      hasWhitelistFunction: false,
      hasTradingControl: false,
      isPausable: false,
      hasTaxFunctions: false,
    };
  }

  const canMint = sourceHas(source, [
    /\bfunction\s+mint\s*\(/i,
    /\b_mint\s*\(/i,
    /\bmint\s*\(/i,
    /\bMINTER_ROLE\b/i,
    /\b_mint\b/i,
  ]);

  const canBurn = sourceHas(source, [
    /\bfunction\s+burn\s*\(/i,
    /\b_burn\s*\(/i,
    /\bburn\s*\(/i,
    /\bERC20Burnable\b/i,
  ]);

  const hasBlacklistFunction = sourceHas(source, [
    /\bblacklist\b/i,
    /\bblacklisted\b/i,
    /\b_isBlacklisted\b/i,
    /\bsetBlacklist\b/i,
    /\baddToBlacklist\b/i,
    /\bremoveFromBlacklist\b/i,
    /\bblocked\b/i,
    /\bblocklist\b/i,
    /\bblockedAddress\b/i,
  ]);

  const hasWhitelistFunction = sourceHas(source, [
    /\bwhitelist\b/i,
    /\bwhitelisted\b/i,
    /\b_isWhitelisted\b/i,
    /\bsetWhitelist\b/i,
    /\baddToWhitelist\b/i,
    /\bremoveFromWhitelist\b/i,
  ]);

  const hasTradingControl = sourceHas(source, [
    /\btradingOpen\b/i,
    /\btradingEnabled\b/i,
    /\btradingActive\b/i,
    /\bopenTrading\b/i,
    /\bsetTrading\b/i,
    /\bstartTrading\b/i,
    /\benableTrading\b/i,
    /\bdisableTrading\b/i,
    /\bcanTrade\b/i,
    /\btrading\b/i,
    /\blaunch\b/i,
  ]);

  const isPausable = sourceHas(source, [
    /\bPausable\b/i,
    /\bwhenNotPaused\b/i,
    /\bwhenPaused\b/i,
    /\bfunction\s+pause\s*\(/i,
    /\bfunction\s+unpause\s*\(/i,
    /\b_pause\s*\(/i,
    /\b_unpause\s*\(/i,
  ]);

  const hasTaxFunctions = sourceHas(source, [
    /\bbuyTax\b/i,
    /\bsellTax\b/i,
    /\bbuyFee\b/i,
    /\bsellFee\b/i,
    /\bbuyFees\b/i,
    /\bsellFees\b/i,
    /\bBUY_TAX\b/i,
    /\bSELL_TAX\b/i,
    /\bBUY_FEE\b/i,
    /\bSELL_FEE\b/i,
    /\btaxFee\b/i,
    /\btransferTax\b/i,
    /\btransferFee\b/i,
    /\btotalFee\b/i,
    /\bmarketingFee\b/i,
    /\bliquidityFee\b/i,
    /\bfee\b/i,
  ]);

  return {
    canMint,
    canBurn,
    hasBlacklistFunction,
    hasWhitelistFunction,
    hasTradingControl,
    isPausable,
    hasTaxFunctions,
  };
};

const extractTaxValue = (
  source: string,
  names: string[]
): number | null => {
  if (!source) {
    return null;
  }

  for (const name of names) {
    const escaped = name.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const patterns = [
      new RegExp(
        `\\b${escaped}\\b\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*;`,
        "i"
      ),
      new RegExp(
        `\\b${escaped}\\b\\s*[:=]\\s*(\\d+(?:\\.\\d+)?)`,
        "i"
      ),
      new RegExp(
        `\\b${escaped}\\b[^\\n]{0,150}?(\\d+(?:\\.\\d+)?)\\s*%`,
        "i"
      ),
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);

      if (!match) {
        continue;
      }

      const value = Number(match[1]);

      if (
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100
      ) {
        return value;
      }
    }
  }

  return null;
};

const detectTaxes = (
  source: string
): {
  buyTax: number | null;
  sellTax: number | null;
} => {
  return {
    buyTax: extractTaxValue(source, [
      "buyTax",
      "buyFee",
      "buyFees",
      "buyTaxFee",
      "_buyTax",
      "_buyFee",
      "BUY_TAX",
      "BUY_FEE",
    ]),

    sellTax: extractTaxValue(source, [
      "sellTax",
      "sellFee",
      "sellFees",
      "sellTaxFee",
      "_sellTax",
      "_sellFee",
      "SELL_TAX",
      "SELL_FEE",
    ]),
  };
};

const detectTransferTax = (
  source: string
): number | null => {
  return extractTaxValue(source, [
    "transferTax",
    "transferFee",
    "transferFees",
    "_transferTax",
    "_transferFee",
    "TRANSFER_TAX",
    "TRANSFER_FEE",
  ]);
};

export const analyzeSecurity = async (
  address: string
): Promise<SecurityResult> => {
  const result = emptySecurityResult();

  if (!ethers.isAddress(address)) {
    return result;
  }

  const normalizedAddress =
    ethers.getAddress(address);

  try {
    const code =
      await provider.getCode(
        normalizedAddress
      );

    if (code === "0x") {
      return result;
    }

    const source =
      await getContractSource(
        normalizedAddress
      );

    result.sourceVerified =
      source.verified;

    result.isOpenSource =
      source.verified;

    result.isProxy =
      source.proxy;

    const detected =
      detectSecurityFeatures(
        source.sourceCode
      );

    result.canMint =
      detected.canMint;

    result.canBurn =
      detected.canBurn;

    result.hasBlacklistFunction =
      detected.hasBlacklistFunction;

    result.hasWhitelistFunction =
      detected.hasWhitelistFunction;

    result.hasTradingControl =
      detected.hasTradingControl;

    result.isPausable =
      detected.isPausable;

    result.hasTaxFunctions =
      detected.hasTaxFunctions;

    const taxes =
      detectTaxes(
        source.sourceCode
      );

    result.buyTax =
      taxes.buyTax;

    result.sellTax =
      taxes.sellTax;

    result.transferTax =
      detectTransferTax(
        source.sourceCode
      );

    if (
      result.transferTax === null &&
      result.buyTax !== null &&
      result.sellTax !== null &&
      result.buyTax === result.sellTax
    ) {
      result.transferTax =
        result.buyTax;
    }

    result.owner =
      await readOwner(
        normalizedAddress
      );

    result.ownerRenounced =
      result.owner === null ||
      result.owner.toLowerCase() ===
        ethers.ZeroAddress.toLowerCase();

    /*
     * Conservative honeypot indicator.
     *
     * Source analysis alone cannot prove a honeypot.
     * We only mark it as a potential honeypot when
     * several restrictive indicators are present.
     */
    result.isHoneypot =
      result.hasBlacklistFunction &&
      result.hasTradingControl &&
      (
        result.sellTax !== null &&
        result.sellTax >= 50
          ? true
          : !source.verified
      );

    const findings: string[] = [];

    if (result.canMint) {
      findings.push(
        "Contract contains minting capability."
      );
    }

    if (result.canBurn) {
      findings.push(
        "Contract contains burn functionality."
      );
    }

    if (result.hasBlacklistFunction) {
      findings.push(
        "Contract contains blacklist functionality."
      );
    }

    if (result.hasWhitelistFunction) {
      findings.push(
        "Contract contains whitelist functionality."
      );
    }

    if (result.hasTradingControl) {
      findings.push(
        "Contract contains trading-control functionality."
      );
    }

    if (result.isPausable) {
      findings.push(
        "Contract contains pausing functionality."
      );
    }

    if (result.isProxy) {
      findings.push(
        "Contract uses a proxy implementation."
      );

      if (source.implementation) {
        findings.push(
          `Proxy implementation: ${source.implementation}`
        );
      }
    }

    if (result.hasTaxFunctions) {
      findings.push(
        "Contract contains configurable tax or fee functionality."
      );
    }

    if (
      result.buyTax !== null &&
      result.buyTax > 10
    ) {
      findings.push(
        `High buy tax detected: ${result.buyTax}%.`
      );
    }

    if (
      result.sellTax !== null &&
      result.sellTax > 10
    ) {
      findings.push(
        `High sell tax detected: ${result.sellTax}%.`
      );
    }

    if (
      result.transferTax !== null &&
      result.transferTax > 10
    ) {
      findings.push(
        `High transfer tax detected: ${result.transferTax}%.`
      );
    }

    if (result.isHoneypot) {
      findings.push(
        "Potential honeypot behavior detected. Manual verification is strongly recommended."
      );
    }

    if (result.ownerRenounced) {
      findings.push(
        "Ownership appears renounced or unavailable."
      );
    } else if (result.owner) {
      findings.push(
        `Contract owner detected: ${result.owner}.`
      );
    }

    if (!source.verified) {
      findings.push(
        "Contract source code could not be verified through BscScan."
      );
    }

    result.findings =
      findings;

    /*
     * Risk scoring.
     *
     * This is an indicator only.
     * It does not guarantee that a token is safe or malicious.
     */
    let riskScore = 0;

    if (result.canMint) {
      riskScore += 3;
    }

    if (result.hasBlacklistFunction) {
      riskScore += 3;
    }

    if (result.hasTradingControl) {
      riskScore += 2;
    }

    if (result.isPausable) {
      riskScore += 2;
    }

    if (result.isProxy) {
      riskScore += 2;
    }

    if (result.hasWhitelistFunction) {
      riskScore += 1;
    }

    if (result.hasTaxFunctions) {
      riskScore += 1;
    }

    if (
      result.buyTax !== null &&
      result.buyTax > 10
    ) {
      riskScore += 2;
    }

    if (
      result.sellTax !== null &&
      result.sellTax > 10
    ) {
      riskScore += 2;
    }

    if (
      result.transferTax !== null &&
      result.transferTax > 10
    ) {
      riskScore += 2;
    }

    if (result.isHoneypot) {
      riskScore += 5;
    }

    if (!source.verified) {
      riskScore += 2;
    }

    if (
      result.owner &&
      !result.ownerRenounced
    ) {
      riskScore += 1;
    }

    if (riskScore >= 8) {
      result.riskLevel = "HIGH";
    } else if (riskScore >= 3) {
      result.riskLevel = "MEDIUM";
    } else if (source.verified) {
      result.riskLevel = "LOW";
    } else {
      result.riskLevel = "UNKNOWN";
    }

    return result;
  } catch (error) {
    console.error(
      "Security analysis failed:",
      error
    );

    return result;
  }
};

